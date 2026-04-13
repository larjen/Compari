'use client';

import { useState, useEffect } from 'react';
import { Dialog, Button } from '@/components/ui';
import { Loader2, AlertCircle } from 'lucide-react';

interface LogViewerModalProps {
  open: boolean;
  onClose: () => void;
  fileUrl: string | null;
  fileName: string | null;
}

export function LogViewerModal({ open, onClose, fileUrl, fileName }: LogViewerModalProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !fileUrl) return;

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
        const parsedLogs = text
          .split('\n')
          .filter((line) => line.trim() !== '')
          .map((line) => {
            try {
              return JSON.parse(line);
            } catch (e) {
              return { unparseable: line };
            }
          });
        setLogs(parsedLogs);
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
  }, [open, fileUrl]);

  return (
    <Dialog open={open} onClose={onClose} title={`Viewing Log: ${fileName || ''}`} className="max-w-5xl h-[80vh] flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-8 bg-gray-50 rounded-lg border border-border-light mt-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-accent-forest/50">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p>Loading and parsing log file...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-red-500">
            <AlertCircle className="w-8 h-8 mb-4" />
            <p>{error}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-accent-forest/50">
            <p>Log file is empty.</p>
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-border-light space-y-4">
              {log.unparseable ? (
                <div className="text-red-500 font-mono text-sm whitespace-pre-wrap">{log.unparseable}</div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-border-light pb-2 mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-accent-forest/50">
                      Timestamp: {log.timestamp || 'Unknown'}
                    </span>
                  </div>

                  {log.requestMessages && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-accent-forest uppercase tracking-wide">AI Request</h4>
                      {log.requestMessages.map((msg: any, i: number) => (
                        <div key={i} className="bg-blue-50/50 rounded-lg p-4 border border-blue-100">
                          <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded mb-2 uppercase">
                            Role: {msg.role}
                          </span>
                          <div className="text-sm text-accent-forest/80 font-mono whitespace-pre-wrap">
                            {msg.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {log.responseContent && (
                    <div className="space-y-3 pt-4">
                      <h4 className="text-sm font-bold text-accent-sage uppercase tracking-wide">AI Response</h4>
                      <div className="bg-green-50/50 rounded-lg p-4 border border-green-100">
                        <div className="text-sm text-accent-forest/80 font-mono whitespace-pre-wrap">
                          {log.responseContent}
                        </div>
                      </div>
                    </div>
                  )}

                  {log.config && (
                    <div className="space-y-3 pt-4">
                      <h4 className="text-sm font-bold text-accent-forest/50 uppercase tracking-wide">Configuration</h4>
                      <pre className="bg-gray-100 rounded-lg p-4 border border-gray-200 text-xs text-accent-forest/70 overflow-x-auto">
                        {JSON.stringify(log.config, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
      <div className="flex justify-end pt-4 mt-2 border-t border-border-light">
        <Button onClick={onClose} variant="ghost">Close</Button>
      </div>
    </Dialog>
  );
}