'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { Button } from '@/components/ui/Button';
import { DeleteAction } from '@/components/ui/DeleteAction';
import { Dialog } from '@/components/ui/Dialog';
import { useTerminology } from '@/hooks/useTerminology';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onClear: () => void;
  messages: { role: 'user' | 'assistant'; content: string }[];
  loading: boolean;
  prompt: string;
  setPrompt: (v: string) => void;
  onSubmit: (text: string) => void;
  answer: string | null;
  linkMap: Record<string, string>;
}

export function ChatDrawer({ isOpen, onClose, onClear, messages, loading, prompt, setPrompt, onSubmit, answer, linkMap }: ChatDrawerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [timer, setTimer] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { activeLabels } = useTerminology();
  const reqPlural = activeLabels.requirement.plural.toLowerCase();
  const offPlural = activeLabels.offering.plural.toLowerCase();
  const offSingular = activeLabels.offering.singular.toLowerCase();

  const suggestedPrompts = [
    `Which ${offSingular} is the strongest match for the ${reqPlural}, and why?`,
    `What are the most common missing criteria among the ${offPlural}?`,
    `Compare the top ${offPlural} and summarize their key strengths.`
  ];

  // Elapsed Timer Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setTimer(0);
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Auto-scroll Logic
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, answer, loading]);

  const handleFormSubmit = (e?: React.FormEvent, overridePrompt?: string) => {
    if (e) e.preventDefault();
    onSubmit(overridePrompt || prompt);
  };

  if (!mounted) return null;

  const inputForm = (
    <div className="w-full">
      <form onSubmit={handleFormSubmit} className="relative w-full">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleFormSubmit();
            }
          }}
          placeholder="Message the assistant..."
          disabled={loading}
          rows={5}
          className="w-full pl-4 pr-48 py-4 bg-white border border-border-light rounded-xl text-sm focus:outline-none focus:border-accent-sage focus:ring-1 focus:ring-accent-sage disabled:opacity-50 transition-all shadow-sm resize-none"
        />
        <div className="absolute right-4 bottom-4 flex items-center gap-2">
          {messages.length > 0 && (
            <DeleteAction 
              onDelete={async () => { onClear(); }} 
              iconOnly={true} 
              inverted={true}
              disabled={loading}
              buttonText="Clear"
              className="h-9 text-xs" 
            />
          )}
          <Button 
            type="submit" 
            variant="primary" 
            className="w-9 h-9 p-0 rounded-lg bg-accent-forest hover:bg-accent-forest/90 flex items-center justify-center shrink-0"
            disabled={loading || !prompt.trim()}
          >
            <DOMAIN_ICONS.ARROW_UP className="w-4 h-4 text-white" />
          </Button>
        </div>
      </form>
      <p className="text-[10px] text-center text-accent-forest/40 mt-2">
        AI can make mistakes. Verify important information.
      </p>
    </div>
  );

  const content = (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title="AI Assistant"
      subtitle="Vault-Aware Assistant"
      bottomContent={inputForm}
    >
      <div ref={scrollRef} className="flex flex-col space-y-6 scroll-smooth pb-4 min-h-full">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 opacity-80 mt-10">
            <div className="w-20 h-20 bg-themed-inner border border-themed-border rounded-2xl flex items-center justify-center shadow-sm">
              <DOMAIN_ICONS.BOT className="w-10 h-10 text-accent-sage" />
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-medium text-themed-fg-main">How can I help?</h3>
<p className="text-base text-themed-fg-muted max-w-[300px] mx-auto">
                  Ask questions about your {offPlural}, {reqPlural}, and matched criteria.
                </p>
            </div>
            
            <div className="flex flex-col gap-3 w-full max-w-[320px] mt-6">
              {suggestedPrompts.map((sugPrompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleFormSubmit(undefined, sugPrompt)}
                  className="text-left text-sm bg-themed-inner border border-themed-border hover:border-accent-sage hover:bg-accent-sage/5 text-themed-fg-main p-4 rounded-xl transition-colors duration-200 shadow-sm"
                >
                  {sugPrompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div key={idx} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] px-4 py-3 shadow-sm ${
                isUser 
                  ? 'bg-accent-forest text-white rounded-2xl rounded-tr-sm' 
                  : 'bg-white border border-border-light text-accent-forest rounded-2xl rounded-tl-sm'
              }`}>
                <div className="text-sm whitespace-pre-wrap leading-relaxed break-words">
                  {msg.content.split(/(\[\[.*?\]\])/g).map((part, index) => {
                    const wikiMatch = part.match(/^\[\[(.*?)\]\]$/);
                    if (wikiMatch) {
                      const linkText = wikiMatch[0];
                      const deepLink = linkMap[linkText];
                      
                      if (deepLink) {
                        return (
                          <a 
                            key={index} 
                            href={deepLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent-sage hover:text-accent-forest underline decoration-accent-sage/30 hover:decoration-accent-forest underline-offset-2 transition-colors font-medium"
                          >
                            {linkText}
                          </a>
                        );
                      }
                      
                      return <span key={index} className="font-medium text-themed-fg-main">{linkText}</span>;
                    }
                    return <span key={index}>{part}</span>;
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {loading && !answer && (
          <div className="flex w-full justify-start">
            <div className="bg-white border border-border-light rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-4">
              <div className="flex items-center gap-1.5 h-4">
                <div className="w-1.5 h-1.5 bg-accent-sage rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-accent-sage rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-accent-sage rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-sm font-medium text-accent-forest/60 border-l border-border-light pl-4">
                Generating response... <span className="text-accent-sage tabular-nums">({timer}s)</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );

  return createPortal(content, document.body);
}