'use client';

import { useState } from 'react';
import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { Prompt } from '@/lib/types';
import { usePrompts } from '@/hooks/usePrompts';
import { Button } from '@/components/ui/Button';
import { SaveButton } from '@/components/ui/SaveButton';
import { EditButton } from '@/components/ui/EditButton';

export function PromptsTab() {
  const { prompts, loading, updatePrompt } = usePrompts();
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

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
      await updatePrompt(id, editText);
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
        <DOMAIN_ICONS.LOADING className="w-6 h-6 animate-spin text-accent-sage" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {prompts.map((prompt) => (
        <div key={prompt.id} className="p-6 bg-themed-inner border border-themed-border rounded-xl">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <DOMAIN_ICONS.PROMPT className="w-4 h-4 text-accent-sage" />
              <h3 className="text-lg font-bold text-themed-fg-main truncate" title={prompt.title}>{prompt.title}</h3>
            </div>
            <p className="text-sm text-themed-fg-muted truncate" title={prompt.description}>{prompt.description}</p>
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
              <div className="font-mono text-sm text-themed-fg-main whitespace-pre-wrap bg-themed-inner p-4 rounded-md border border-themed-border wrap-break-word">
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