'use client';

import { useState, useEffect } from 'react';
import { ChatDrawer } from './ChatDrawer';
import { Button } from '@/components/ui/Button';
import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { useReasoning } from '@/hooks/useReasoning';
import { reasoningApi } from '@/lib/api/reasoningApi';

export function ChatDrawerWrapper() {
  const [isOpen, setIsOpen] = useState(false);
  const [iconState, setIconState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const { ask, answer, loading, linkMap } = useReasoning();

  useEffect(() => {
    if (loading) {
      setIconState('busy');
    } else if (answer) {
      setIconState('done');
    }
  }, [loading, answer]);

  useEffect(() => {
    if (!isOpen && iconState === 'done') {
      setIconState('idle');
    }
  }, [isOpen, iconState]);

  useEffect(() => {
    if (answer) {
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content = answer;
        } else {
          newMessages.push({ role: 'assistant', content: answer });
        }
        return newMessages;
      });
    }
  }, [answer]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await reasoningApi.getHistory();
        setMessages(history);
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    };
    loadHistory();
  }, []);

  const handleSubmit = async (text: string) => {
    if (!text.trim() || loading) return;
    setMessages(prev => [...prev, { role: 'user', content: text.trim() }]);
    setPrompt('');
    await ask(text);
  };

  const handleClear = async () => {
    try {
      await reasoningApi.clearHistory();
      setMessages([]);
      setIconState('idle');
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center"
        title="AI Reasoning"
      >
        {loading ? (
          <div className="relative w-4 h-4">
            <DOMAIN_ICONS.CHAT_IDLE className="absolute inset-0 w-4 h-4 text-themed-fg-main" />
            <DOMAIN_ICONS.CHAT_BUSY className="absolute inset-0 w-4 h-4 text-accent-sage animate-pulse" />
          </div>
        ) : iconState === 'done' ? (
          <DOMAIN_ICONS.CHAT_DONE className="w-4 h-4 text-accent-sage" />
        ) : (
          <DOMAIN_ICONS.CHAT_IDLE className="w-4 h-4 text-themed-fg-main" />
        )}
      </Button>

      <ChatDrawer 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        onClear={handleClear}
        messages={messages}
        loading={loading}
        prompt={prompt}
        setPrompt={setPrompt}
        onSubmit={handleSubmit}
        answer={answer}
        linkMap={linkMap}
      />
    </>
  );
}