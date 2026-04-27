import { API_BASE_PATH } from '../constants';

export const reasoningApi = {
  async askStream(prompt: string, callbacks: {
    onProgress?: (msg: string) => void,
    onContext?: (paths: string[], linkMap?: Record<string, string>) => void,
    onChunk?: (text: string) => void,
    onError?: (err: string) => void,
    onDone?: (model: string) => void
  }): Promise<void> {
    const res = await fetch(`${API_BASE_PATH}/reasoning/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    if (!res.body) throw new Error('Readable stream not supported');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf('\n\n');
      
      while (boundary !== -1) {
        const chunkStr = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        
        const eventMatch = chunkStr.match(/event: (.*)/);
        const dataMatch = chunkStr.match(/data: (.*)/);

        if (eventMatch && dataMatch) {
          const type = eventMatch[1].trim();
          const data = JSON.parse(dataMatch[1].trim());

          if (type === 'progress' && callbacks.onProgress) callbacks.onProgress(data.message);
          if (type === 'context' && callbacks.onContext) callbacks.onContext(data.paths, data.linkMap);
          if (type === 'chunk' && callbacks.onChunk) callbacks.onChunk(data.text);
          if (type === 'error' && callbacks.onError) callbacks.onError(data.message);
          if (type === 'done' && callbacks.onDone) callbacks.onDone(data.model);
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
  },

  async getHistory(): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    const res = await fetch(`${API_BASE_PATH}/reasoning/history`);
    if (!res.ok) throw new Error('Failed to fetch chat history');
    return res.json();
  },

  async clearHistory(): Promise<void> {
    const res = await fetch(`${API_BASE_PATH}/reasoning/history`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear chat history');
  }
};