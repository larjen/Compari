'use client';

import { useState, useEffect } from 'react';
import { MessageSquareText, Loader2 } from 'lucide-react';
import { Prompt } from '@/lib/types';
import { promptApi } from '@/lib/api/promptApi';
import { Button } from '@/components/ui/Button';
import { SaveButton } from '@/components/ui/SaveButton';
import { EditButton } from '@/components/ui/EditButton';

export function PromptsTab() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      setLoading(true);
      const data = await promptApi.getPrompts();
      setPrompts(data);
    } catch (err) {
      console.error('Failed to load prompts:', err);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (prompt: Prompt) => {
    setEditingId(prompt.id);
    setEditText(prompt.prompt);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditText('');
  };

  const handleSave = async (id: number) => {
    if (!editText.trim()) return;

    setSaving(true);
    try {
      await promptApi.updatePrompt(id, editText);
      await loadPrompts();
      setEditingId(null);
      setEditText('');
    } catch (err) {
      console.error('Failed to update prompt:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-accent-sage" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {prompts.map((prompt) => (
        <div key={prompt.id} className="p-6 bg-themed-inner border border-themed-border rounded-xl">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <MessageSquareText className="w-4 h-4 text-accent-sage" />
              <h3 className="text-lg font-bold text-themed-fg-main">{prompt.title}</h3>
            </div>
            <p className="text-sm text-themed-fg-muted">{prompt.description}</p>
          </div>

          {editingId === prompt.id ? (
            <div className="space-y-4">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={12}
                className="w-full font-mono text-sm p-4 bg-themed-input-bg text-themed-fg-main border border-themed-input-border rounded-md focus:ring-accent-sage focus:border-accent-sage"
              />
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={cancelEditing} disabled={saving}>
                  Cancel
                </Button>
                <SaveButton size="md" onClick={() => handleSave(prompt.id)} isSaving={saving} saveText="Save Changes" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="font-mono text-sm text-themed-fg-main whitespace-pre-wrap bg-themed-inner p-4 rounded-md border border-themed-border">
                {prompt.prompt}
              </div>
              <div className="flex justify-end pt-4 mt-2">
                <EditButton entityName="Prompt" onClick={() => startEditing(prompt)} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}