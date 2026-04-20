'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { APP_EVENTS } from '@/lib/constants';
import { SSEEntityUpdate, SSENotification, QueueStatus, SSEMatchUpdate } from '@/lib/types';

interface UseSSEOptions {
  onEntityUpdate?: (data: SSEEntityUpdate) => void;
  onNotification?: (data: SSENotification) => void;
  onQueueUpdate?: (data: QueueStatus) => void;
  onMatchUpdate?: (data: SSEMatchUpdate) => void;
  onBlueprintUpdate?: (data: { timestamp: number }) => void;
  onReconnect?: () => void;
}

// Global state for singleton SSE connection
let globalEventSource: EventSource | null = null;
let connectionCount = 0;
let reconnectTimeout: NodeJS.Timeout | null = null;
let wasDisconnected = false;

const listeners = {
  'entityUpdate': new Set<(data: SSEEntityUpdate) => void>(),
  'matchUpdate': new Set<(data: SSEMatchUpdate) => void>(),
  [APP_EVENTS.NOTIFICATION]: new Set<(data: SSENotification) => void>(),
  [APP_EVENTS.QUEUE_UPDATE]: new Set<(data: QueueStatus) => void>(),
  [APP_EVENTS.BLUEPRINT_UPDATE]: new Set<(data: { timestamp: number }) => void>(),
  reconnect: new Set<() => void>(),
};

function handleEvent<T>(eventName: string) {
  return (event: MessageEvent) => {
    try {
      const rawData = event.data === "undefined" || !event.data ? "{}" : event.data;
      const data = JSON.parse(rawData) as T;
      (listeners as Record<string, Set<Function>>)[eventName].forEach((callback: Function) => callback(data as any));
    } catch (err) {
      console.error(`Failed to parse ${eventName} event:`, err);
    }
  };
}

function initGlobalSSE() {
  if (globalEventSource) return;

  globalEventSource = new EventSource('/api/events');

  globalEventSource.onopen = () => {
    document.dispatchEvent(new CustomEvent('sse:connected'));
    if (wasDisconnected) {
      wasDisconnected = false;
      listeners.reconnect.forEach(cb => cb());
    }
  };

  globalEventSource.addEventListener(APP_EVENTS.RESOURCE_STATE_CHANGED, (event: MessageEvent) => {
    try {
      const rawData = event.data === "undefined" || !event.data ? "{}" : event.data;
      const data = JSON.parse(rawData);
      if (data.entity_type === 'match' || data.type === 'match') {
        listeners['matchUpdate'].forEach((callback: Function) => callback(data));
      } else {
        listeners['entityUpdate'].forEach((callback: Function) => callback(data));
      }
    } catch (err) {
      console.error('Failed to parse resourceStateChanged event:', err);
    }
  });
  globalEventSource.addEventListener(APP_EVENTS.NOTIFICATION, handleEvent(APP_EVENTS.NOTIFICATION));
  globalEventSource.addEventListener(APP_EVENTS.QUEUE_UPDATE, handleEvent(APP_EVENTS.QUEUE_UPDATE));
  globalEventSource.addEventListener(APP_EVENTS.BLUEPRINT_UPDATE, handleEvent(APP_EVENTS.BLUEPRINT_UPDATE));

  globalEventSource.onerror = () => {
    wasDisconnected = true;
    document.dispatchEvent(new CustomEvent('sse:disconnected'));
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
  onBlueprintUpdate,
  onReconnect
}: UseSSEOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const wasDisconnectedRef = useRef(false);
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  useEffect(() => {
    const handleConnected = () => setIsConnected(true);
    const handleDisconnected = () => setIsConnected(false);
    document.addEventListener('sse:connected', handleConnected);
    document.addEventListener('sse:disconnected', handleDisconnected);
    return () => {
      document.removeEventListener('sse:connected', handleConnected);
      document.removeEventListener('sse:disconnected', handleDisconnected);
    };
  }, []);
  
  useEffect(() => {
    if (connectionCount === 0) {
      initGlobalSSE();
    }
    connectionCount++;

    if (onEntityUpdate) listeners['entityUpdate'].add(onEntityUpdate);
    if (onNotification) listeners[APP_EVENTS.NOTIFICATION].add(onNotification);
    if (onQueueUpdate) listeners[APP_EVENTS.QUEUE_UPDATE].add(onQueueUpdate);
    if (onMatchUpdate) listeners['matchUpdate'].add(onMatchUpdate);
    if (onBlueprintUpdate) listeners[APP_EVENTS.BLUEPRINT_UPDATE].add(onBlueprintUpdate);
    
    const handleReconnect = () => {
      setIsConnected(true);
      if (wasDisconnectedRef.current) {
        console.log('[SSE] Reconnected to server. Triggering resync...');
        if (onReconnectRef.current) onReconnectRef.current();
      }
      wasDisconnectedRef.current = false;
    };
    
    listeners.reconnect.add(handleReconnect);

    return () => {
      if (onEntityUpdate) listeners['entityUpdate'].delete(onEntityUpdate);
      if (onNotification) listeners[APP_EVENTS.NOTIFICATION].delete(onNotification);
      if (onQueueUpdate) listeners[APP_EVENTS.QUEUE_UPDATE].delete(onQueueUpdate);
      if (onMatchUpdate) listeners['matchUpdate'].delete(onMatchUpdate);
      if (onBlueprintUpdate) listeners[APP_EVENTS.BLUEPRINT_UPDATE].delete(onBlueprintUpdate);
      listeners.reconnect.delete(handleReconnect);

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

  return { reconnect, isConnected };
}