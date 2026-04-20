/**
 * @fileoverview Custom hook for fetching and parsing log files.
 * @description Extracts duplicated fetch and log parsing logic from UI components.
 * @responsibility
 * - Fetches log files from arbitrary URLs.
 * - Parses various log formats (JSONL, JSON, Markdown, plain text).
 * - Returns standardized log data structures.
 * @boundary_rules
 * - ❌ MUST NOT contain any UI components or JSX.
 * - ❌ MUST NOT make assumptions about the routing or page context.
 * - ✅ MUST handle all parsing logic internally.
 * - ✅ MUST return standardized { logs, loading, error } structure.
 * @separation_of_concerns
 * This hook centralizes the fetch-and-parse pattern that was duplicated in:
 *   - src/app/log-viewer/page.tsx
 *   - src/components/shared/LogViewerModal.tsx
 * By extracting this logic, UI components become pure orchestrators that focus on presentation only.
 */
'use client';

import { useState, useEffect } from 'react';

interface LogEntry {
  timestamp?: string;
  level?: string;
  message?: string;
  error?: string;
  requestMessages?: Array<{ role: string; content: string }>;
  responseContent?: string;
  config?: Record<string, unknown>;
  unparseable?: string;
  type?: 'markdown' | 'text';
  content?: string;
}

interface UseLogFetcherReturn {
  logs: LogEntry[];
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook for fetching and parsing log files.
 * @param {string | null} fileUrl - The URL of the log file to fetch.
 * @param {string | null} fileName - The name of the file (used to determine format).
 * @returns {UseLogFetcherReturn} Object containing logs array, loading state, and error message.
 */
export function useLogFetcher(fileUrl: string | null, fileName: string | null): UseLogFetcherReturn {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileUrl) {
      setError("No log file URL provided.");
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(fileUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch log file');
        return res.text();
      })
      .then((text) => {
        if (!isMounted) return;

        const isJsonl = fileName?.toLowerCase().endsWith('.jsonl');
        const isMd = fileName?.toLowerCase().endsWith('.md');
        const isTxt = fileName?.toLowerCase().endsWith('.txt');

        if (isJsonl) {
          const parsedLogs = text
            .split('\n')
            .filter((line) => line.trim() !== '')
            .map((line) => {
              try { return JSON.parse(line); }
              catch (e) { return { unparseable: line }; }
            });
          setLogs(parsedLogs as LogEntry[]);
        } else if (isMd) {
          setLogs([{ type: 'markdown', content: text }]);
        } else if (isTxt) {
          setLogs([{ type: 'text', content: text }]);
        } else {
          try {
            const parsedData = JSON.parse(text);
            setLogs([parsedData]);
          } catch (e) {
            setLogs([{ unparseable: text }]);
          }
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [fileUrl, fileName]);

  return { logs, loading, error };
}