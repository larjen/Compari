'use client';

import { useEffect, useCallback } from 'react';
import { SSEEntityUpdate, SSENotification, QueueStatus, SSEMatchUpdate } from '@/lib/types';

export interface UseSSEOptions {
  onEntityUpdate?: (data: SSEEntityUpdate) => void;
  onNotification?: (data: SSENotification) => void;
  onQueueUpdate?: (data: QueueStatus) => void;
  onMatchUpdate?: (data: SSEMatchUpdate) => void;
  onBlueprintUpdate?: (data: { timestamp: number }) => void;
}

// Global state for singleton SSE connection
let globalEventSource: EventSource | null = null;
let connectionCount = 0;
let reconnectTimeout: NodeJS.Timeout | null = null;

const listeners = {
  entityUpdate: new Set<(data: SSEEntityUpdate) => void>(),
  notification: new Set<(data: SSENotification) => void>(),
  queueUpdate: new Set<(data: QueueStatus) => void>(),
  matchUpdate: new Set<(data: SSEMatchUpdate) => void>(),
  blueprintUpdate: new Set<(data: { timestamp: number }) => void>(),
};

function handleEvent<T>(eventName: keyof typeof listeners) {
  return (event: MessageEvent) => {
    try {
      const rawData = event.data === "undefined" || !event.data ? "{}" : event.data;
      const data = JSON.parse(rawData) as T;
      listeners[eventName].forEach((callback) => callback(data as any));
    } catch (err) {
      console.error(`Failed to parse ${eventName} event:`, err);
    }
  };
}

function initGlobalSSE() {
  if (globalEventSource) return;

  globalEventSource = new EventSource('/api/events');

  globalEventSource.addEventListener('entityUpdate', handleEvent('entityUpdate'));
  globalEventSource.addEventListener('notification', handleEvent('notification'));
  globalEventSource.addEventListener('queueUpdate', handleEvent('queueUpdate'));
  globalEventSource.addEventListener('matchUpdate', handleEvent('matchUpdate'));
  globalEventSource.addEventListener('blueprintUpdate', handleEvent('blueprintUpdate'));

  globalEventSource.onerror = () => {
    globalEventSource?.close();
    globalEventSource = null;
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(initGlobalSSE, 3000);
  };
}

/**
 * @description Custom hook that manages Server-Sent Events (SSE) connection and event listeners.
 * Implements defensive parsing against malformed SSE payloads to prevent render-cycle crashes.
 * Uses a singleton EventSource to avoid creating multiple connections.
 * @param {UseSSEOptions} options - Callback handlers for different SSE event types
 * @returns {{ reconnect: () => void }} - Function to manually reconnect the SSE connection
 */
export function useSSE({
  onEntityUpdate,
  onNotification,
  onQueueUpdate,
  onMatchUpdate,
  onBlueprintUpdate
}: UseSSEOptions = {}) {
  
  useEffect(() => {
    if (connectionCount === 0) {
      initGlobalSSE();
    }
    connectionCount++;

    if (onEntityUpdate) listeners.entityUpdate.add(onEntityUpdate);
    if (onNotification) listeners.notification.add(onNotification);
    if (onQueueUpdate) listeners.queueUpdate.add(onQueueUpdate);
    if (onMatchUpdate) listeners.matchUpdate.add(onMatchUpdate);
    if (onBlueprintUpdate) listeners.blueprintUpdate.add(onBlueprintUpdate);

    return () => {
      if (onEntityUpdate) listeners.entityUpdate.delete(onEntityUpdate);
      if (onNotification) listeners.notification.delete(onNotification);
      if (onQueueUpdate) listeners.queueUpdate.delete(onQueueUpdate);
      if (onMatchUpdate) listeners.matchUpdate.delete(onMatchUpdate);
      if (onBlueprintUpdate) listeners.blueprintUpdate.delete(onBlueprintUpdate);

      connectionCount--;
      if (connectionCount === 0) {
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        globalEventSource?.close();
        globalEventSource = null;
      }
    };
  }, [onEntityUpdate, onNotification, onQueueUpdate, onMatchUpdate, onBlueprintUpdate]);

  const reconnect = useCallback(() => {
    if (globalEventSource) {
      globalEventSource.close();
      globalEventSource = null;
    }
    initGlobalSSE();
  }, []);

  return { reconnect };
}