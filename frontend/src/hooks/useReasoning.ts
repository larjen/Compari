import { useState } from 'react';
import { reasoningApi } from '@/lib/api/reasoningApi';

export function useReasoning() {
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [contextFiles, setContextFiles] = useState<string[]>([]);
  const [linkMap, setLinkMap] = useState<Record<string, string>>({});

  const ask = async (prompt: string) => {
    setLoading(true);
    setAnswer('');
    setProgress('Initializing...');
    setContextFiles([]);

    try {
      await reasoningApi.askStream(prompt, {
        onProgress: (msg) => setProgress(msg),
        onContext: (paths, map) => {
          setContextFiles(paths);
          if (map) {
            setLinkMap(prev => ({ ...prev, ...map }));
          }
        },
        onChunk: (text) => setAnswer((prev) => (prev || '') + text),
        onError: (err) => { throw new Error(err); },
        onDone: () => setProgress(null),
      });
    } catch (error: any) {
      setAnswer(`Error: ${error.message}`);
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

  return { ask, answer, loading, progress, contextFiles, linkMap };
}