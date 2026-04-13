'use client';

import { useState, useEffect } from 'react';
import { matchApi, MatchFiles } from '@/lib/api/matchApi';
import { MatchReportData } from '@/components/matches/MatchReportViewer';

/**
 * @fileoverview Match data fetching hooks
 * @description Custom hooks for fetching match files and report data.
 * 
 * @socexplanation
 * These hooks enforce Separation of Concerns (SoC) by moving data fetching logic
 * out of the presentation layer (components). This provides:
 * - Centralized data fetching logic that can be reused across components
 * - Consistent loading and error state management
 * - Cleaner component code focused on UI rendering
 * - Easier testing of data fetching logic in isolation
 */

/**
 * Custom hook for fetching match files.
 * 
 * @description
 * Fetches the list of files in the match folder for a given match ID.
 * Manages loading and error states internally.
 * 
 * @param matchId - Optional match ID to fetch files for
 * @returns Object containing { files, loading, error }
 * 
 * @socexplanation
 * - Data fetching logic extracted from MatchDetailModal presentation component
 * - Single source of truth for match file loading logic
 * - Returns consistent interface for files, loading, and error states
 * 
 * @example
 * const { files, loading, error } = useMatchFiles(match?.id);
 * // Use files in your component
 */
export function useMatchFiles(matchId?: number) {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!matchId) {
      setFiles([]);
      setError(null);
      return;
    }

    const fetchFiles = async () => {
      setLoading(true);
      setError(null);
      try {
        const data: MatchFiles = await matchApi.getMatchFiles(matchId);
        setFiles(data.files || []);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load match files'));
        setFiles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, [matchId]);

  return { files, loading, error };
}

/**
 * Custom hook for fetching match report data.
 * 
 * @description
 * Fetches the JSON report data for a match. The reportPath is parsed to extract the filename,
 * which is then used to fetch the report data from the API.
 * 
 * @param matchId - Optional match ID to fetch report for
 * @param reportPath - Optional report path from the match object (e.g., '/path/to/report.json')
 * @returns Object containing { reportData, loading, error }
 * 
 * @socexplanation
 * - Data fetching logic extracted from MatchDetailModal presentation component
 * - Handles filename extraction from reportPath internally
 * - Single source of truth for match report loading logic
 * - Returns consistent interface for reportData, loading, and error states
 * 
 * @example
 * const { reportData, loading, error } = useMatchReport(match?.id, match.report_path);
 * // Use reportData in your component
 */
export function useMatchReport(matchId?: number, reportPath?: string | null) {
  const [reportData, setReportData] = useState<MatchReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!matchId || !reportPath || !reportPath.endsWith('.json')) {
      setReportData(null);
      setError(null);
      return;
    }

    const filename = reportPath.split('/').pop();
    if (!filename) {
      setReportData(null);
      setError(null);
      return;
    }

    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const data: MatchReportData = await matchApi.getMatchReportData(matchId, filename);
        setReportData(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load report data'));
        setReportData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [matchId, reportPath]);

  return { reportData, loading, error };
}
