'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const browserStandardStyles = `
  .browser-standard-mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    line-height: 1.5;
    color: currentColor;
  }
  .browser-standard-mono h1 { font-size: 2em; font-weight: bold; margin: 0.67em 0; }
  .browser-standard-mono h2 { font-size: 1.5em; font-weight: bold; margin: 0.83em 0; }
  .browser-standard-mono h3 { font-size: 1.17em; font-weight: bold; margin: 1em 0; }
  .browser-standard-mono h4 { font-size: 1em; font-weight: bold; margin: 1.33em 0; }
  .browser-standard-mono h5 { font-size: 0.83em; font-weight: bold; margin: 1.67em 0; }
  .browser-standard-mono h6 { font-size: 0.67em; font-weight: bold; margin: 2.33em 0; }
  
  .browser-standard-mono p { margin: 1em 0; }
  
  .browser-standard-mono ul { 
    list-style-type: disc; 
    margin: 1em 0; 
    padding-left: 40px; 
  }
  .browser-standard-mono ol { 
    list-style-type: decimal; 
    margin: 1em 0; 
    padding-left: 40px; 
  }
  .browser-standard-mono li { display: list-item; }
  
  .browser-standard-mono strong { font-weight: bold; }
  .browser-standard-mono em { font-style: italic; }
`;



function LogViewerContent() {
  const searchParams = useSearchParams();
  const fileUrl = searchParams.get('fileUrl');
  const fileName = searchParams.get('fileName');

  const [logs, setLogs] = useState<any[]>([]);
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
          setLogs(parsedLogs);
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
  }, [fileUrl]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-serif font-semibold text-accent-forest mb-6">
          Viewing Log: <span className="font-mono text-lg font-normal bg-accent-sage/20 px-2 py-1 rounded">{fileName || 'Unknown File'}</span>
        </h1>

        <div className="space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-accent-forest/50">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Loading and parsing log file...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-red-500">
              <AlertCircle className="w-8 h-8 mb-4" />
              <p>{error}</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-accent-forest/50">
              <p>File is empty.</p>
            </div>
          ) : fileName?.toLowerCase().endsWith('.md') ? (
            /* STANDARD BROWSER MONO VIEW */
            <div className="bg-transparent p-0">
               <style>{browserStandardStyles}</style>
               <div className="browser-standard-mono text-xs">
                  <ReactMarkdown>
                    {logs[0]?.content || ''}
                  </ReactMarkdown>
               </div>
            </div>
          ) : fileName?.toLowerCase().endsWith('.json') && !fileName?.toLowerCase().endsWith('.jsonl') ? (
            <div className="bg-transparent p-0">
               <pre className="text-xs text-accent-forest/70 font-mono whitespace-pre-wrap">
                 {JSON.stringify(logs, null, 2)}
               </pre>
            </div>
          ) : fileName?.toLowerCase().endsWith('.txt') ? (
            <div className="bg-transparent p-0">
               <pre className="text-xs text-accent-forest/70 font-mono whitespace-pre-wrap">
                 {logs[0]?.content || ''}
               </pre>
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
                      {log.level && (
                         <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${log.level === 'ERROR' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                           {log.level}
                         </span>
                      )}
                    </div>

                    {log.message && (
                        <div className="text-xs text-accent-forest/70 font-mono whitespace-pre-wrap">{log.message}</div>
                    )}
                    
                    {log.error && (
                        <div className="text-xs text-red-600 font-mono whitespace-pre-wrap bg-red-50 p-4 rounded border border-red-100 mt-2">
                            {log.error}
                        </div>
                    )}

                    {log.requestMessages && (
                      <div className="space-y-3 pt-2">
                        <h4 className="text-xs font-bold text-accent-forest/50 uppercase tracking-wide">AI Request</h4>
                        {log.requestMessages.map((msg: any, i: number) => (
                          <div key={i} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <span className="inline-block px-2 py-1 bg-gray-200 text-gray-600 text-[10px] font-bold rounded mb-2 uppercase">
                              Role: {msg.role}
                            </span>
                            <div className="text-xs text-accent-forest/70 font-mono whitespace-pre-wrap">
                              {msg.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {log.responseContent && (
                      <div className="space-y-3 pt-4 border-t border-border-light mt-4">
                        <h4 className="text-xs font-bold text-accent-forest/50 uppercase tracking-wide">AI Response</h4>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="text-xs text-accent-forest/70 font-mono whitespace-pre-wrap">
                            {log.responseContent}
                          </div>
                        </div>
                      </div>
                    )}

                    {log.config && (
                      <div className="space-y-3 pt-4 border-t border-border-light mt-4">
                        <h4 className="text-xs font-bold text-accent-forest/50 uppercase tracking-wide">Configuration</h4>
                        <pre className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-xs text-accent-forest/70 overflow-x-auto">
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
      </div>
    </div>
  );
}

export default function LogViewerPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-accent-sage" /></div>}>
      <LogViewerContent />
    </Suspense>
  );
}
