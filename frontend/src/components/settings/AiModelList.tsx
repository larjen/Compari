'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CreateButton } from '@/components/ui/CreateButton';
import { SaveButton } from '@/components/ui/SaveButton';
import { EditButton } from '@/components/ui/EditButton';
import { DeleteAction } from '@/components/ui/DeleteAction';
import { AiModel } from '@/lib/types';

export interface ModelFormData {
  name: string;
  model_identifier: string;
  api_url: string;
  api_key: string;
  role: 'chat' | 'embedding';
  temperature?: number;
  contextWindow?: number;
}

export const initialFormData: ModelFormData = {
  name: '',
  model_identifier: '',
  api_url: 'http://127.0.0.1:11434/v1',
  api_key: '',
  role: 'chat',
  temperature: 0.1,
  contextWindow: 8192,
};

export interface AiModelListProps {
  models: AiModel[];
  role: 'chat' | 'embedding';
  isLoading: boolean;
  showForm: boolean;
  editingModelId?: number | null;
  formData: ModelFormData;
  setFormData: (data: ModelFormData) => void;
  isSaving: boolean;
  onEdit: (model: AiModel) => void;
  onDelete: (model: AiModel) => Promise<void>;
  onSave: () => Promise<void>;
  onCancel: () => void;
}

const inputClass = "w-full px-3 py-2 border border-themed-input-border rounded-lg bg-themed-input-bg text-themed-fg-main focus:ring-2 focus:ring-accent-sage/50 outline-none text-sm";
const labelClass = "block text-xs font-bold text-themed-fg-muted uppercase mb-1";

export function AiModelList({
  models,
  role,
  isLoading,
  showForm,
  editingModelId,
  formData,
  setFormData,
  isSaving,
  onEdit,
  onDelete,
  onSave,
  onCancel,
}: AiModelListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent-sage" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CREATION FORM */}
      {showForm && !editingModelId && (
        <div className="p-6 bg-themed-inner border border-themed-border rounded-xl space-y-4 mb-8">
          <h3 className="text-lg font-bold text-themed-fg-main border-b border-themed-border pb-2">
            Add New {role === 'chat' ? 'Chat' : 'Embedding'} Model
          </h3>
          <ModelEditor data={formData} setData={setFormData} />
          <div className="flex justify-end gap-3 pt-4 border-t border-themed-border">
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <CreateButton entityName="Model" size="md" onClick={onSave} isCreating={isSaving} disabled={!formData.name || !formData.model_identifier} />
          </div>
        </div>
      )}

      {/* LIST */}
      {models.length === 0 && !showForm ? (
        <p className="text-sm text-themed-fg-muted/50 py-4 italic">
          No {role} models configured. Add one to get started.
        </p>
      ) : (
        <div className="space-y-6">
          {models.map((model) => {
            const isEditing = editingModelId === model.id;
            const isActive = model.isActive;

            return (
              <div key={model.id} className="p-6 bg-themed-inner border border-themed-border rounded-xl">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-themed-fg-main">{model.name}</h3>
                    <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold bg-accent-sage/20 text-accent-forest rounded-full">
                      {model.role}
                    </span>
                  </div>
                </div>

                {isEditing ? (
                  /* EDIT MODE */
                  <div className="space-y-4">
                    <ModelEditor data={formData} setData={setFormData} />
                    <div className="flex justify-end items-center gap-3 pt-4 border-t border-themed-border">
                      {model.isSystem ? (
                        <div className="text-xs text-themed-fg-muted italic">System models cannot be deleted</div>
                      ) : (
                        <DeleteAction onDelete={() => onDelete(model)} buttonText="Delete Model" />
                      )}
                      <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                      <SaveButton size="md" onClick={onSave} isSaving={isSaving} saveText="Save Changes" />
                    </div>
                  </div>
                ) : (
                  /* READ-ONLY MODE */
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Model Identifier</label>
                        <div className="font-mono text-sm text-themed-fg-main bg-themed-inner p-3 rounded-md border border-themed-border">
                          {model.modelIdentifier}
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>API URL</label>
                        <div className="font-mono text-sm text-themed-fg-main bg-themed-inner p-3 rounded-md border border-themed-border">
                          {model.apiUrl || <span className="text-themed-fg-muted italic">Local / Default</span>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Temperature</label>
                        <div className="font-mono text-sm text-themed-fg-main bg-themed-inner p-3 rounded-md border border-themed-border">
                          {model.temperature ?? 'N/A'}
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Context Window</label>
                        <div className="font-mono text-sm text-themed-fg-main bg-themed-inner p-3 rounded-md border border-themed-border">
                          {model.contextWindow ?? 'N/A'} tokens
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 mt-2">
                      <EditButton entityName="Model" onClick={() => onEdit(model)} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- INTERNAL COMPONENT FOR DRY FORMS ---

function ModelEditor({ data, setData }: { data: ModelFormData, setData: (d: ModelFormData) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Model Name</label>
          <input type="text" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} placeholder="e.g., Ollama Chat" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Model Identifier</label>
          <input type="text" value={data.model_identifier} onChange={(e) => setData({ ...data, model_identifier: e.target.value })} placeholder="e.g., llama3.1:8b" className={inputClass} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Model Role</label>
        <select
          value={data.role}
          onChange={(e) => setData({ ...data, role: e.target.value as 'chat' | 'embedding' })}
          className={inputClass}
        >
          <option value="chat">Chat (Text Generation)</option>
          <option value="embedding">Embedding (Vectorization)</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>API URL</label>
          <input type="text" value={data.api_url} onChange={(e) => setData({ ...data, api_url: e.target.value })} placeholder="http://127.0.0.1:11434/v1" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>API Key (Optional)</label>
          <input type="password" value={data.api_key} onChange={(e) => setData({ ...data, api_key: e.target.value })} placeholder="Leave empty for local models" className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Temperature (0.0 - 2.0)</label>
          <input type="number" min="0" max="2" step="0.1" value={data.temperature ?? 0.1} onChange={(e) => setData({ ...data, temperature: e.target.value ? Number(e.target.value) : undefined })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Context Window (Tokens)</label>
          <input type="number" min="1024" step="1024" value={data.contextWindow ?? 8192} onChange={(e) => setData({ ...data, contextWindow: e.target.value ? Number(e.target.value) : undefined })} className={inputClass} />
        </div>
      </div>
    </div>
  );
}
