'use client';

import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { Button, CreateButton, SaveButton, EditButton, DeleteAction, ModalFooter, FormLabel, FormInput, FormSelect, MicroBadge } from '@/components/ui';
import { AiModel, AiModelRole } from '@/lib/types';
import { AI_MODEL_ROLES } from '@/lib/constants';
import { useToast } from '@/hooks/useToast';
import { TOAST_TYPES } from '@/lib/constants';
import { useState } from 'react';

export interface ModelFormData {
  name: string;
  model_identifier: string;
  api_url: string;
  api_key: string;
  role: AiModelRole;
  temperature?: number;
  contextWindow?: number;
}

export const initialFormData: ModelFormData = {
  name: '',
  model_identifier: '',
  api_url: 'http://127.0.0.1:11434/v1',
  api_key: '',
  role: AI_MODEL_ROLES.CHAT,
  temperature: 0.1,
  contextWindow: 8192,
};

/**
 * AiModelList - High-density registry view for AI models
 * 
 * This component provides a streamlined, management-focused UI for AI models.
 * 
 * View Mode: Compressed header-only view for registry density. Action buttons
 * are moved to the header for quick access.
 * 
 * Edit Mode: Expanded form view. Displays all settings immediately with action
 * buttons at the bottom for standard form UX.
 */
interface AiModelListProps {
  models: AiModel[];
  role: AiModelRole;
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
  onTestConnection: (data: {
    model_identifier: string;
    api_url?: string | null;
    api_key?: string | null;
    role?: typeof AI_MODEL_ROLES.CHAT | typeof AI_MODEL_ROLES.EMBEDDING;
  }) => Promise<{ success: boolean; message?: string }>;
}

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
  onTestConnection,
}: AiModelListProps) {
  const { addToast } = useToast();
  const [testingModelId, setTestingModelId] = useState<number | null>(null);

  const handleTestConnection = async () => {
    setTestingModelId(-1);
    try {
      await onTestConnection(formData);
      addToast(TOAST_TYPES.SUCCESS, 'Connection successful');
    } catch (err) {
      addToast(TOAST_TYPES.ERROR, err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setTestingModelId(null);
    }
  };

  const handleTestConnectionForModel = async (model: AiModel) => {
    setTestingModelId(model.id);
    try {
      await onTestConnection({
        model_identifier: model.modelIdentifier,
        api_url: model.apiUrl,
        api_key: model.apiKey,
        role: model.role,
      });
      addToast(TOAST_TYPES.SUCCESS, 'Connection successful');
    } catch (err) {
      addToast(TOAST_TYPES.ERROR, err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setTestingModelId(null);
    }
  };

  const canTest = testingModelId === null && formData.api_url && formData.model_identifier;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <DOMAIN_ICONS.LOADING className="w-8 h-8 animate-spin text-accent-sage" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CREATION FORM */}
      {showForm && !editingModelId && (
        <div className="p-6 bg-themed-inner border border-themed-border rounded-xl space-y-4 mb-8">
          <h3 className="text-lg font-bold text-themed-fg-main border-b border-themed-border pb-2">
            Add New {role === AI_MODEL_ROLES.CHAT ? 'Chat' : 'Embedding'} Model
          </h3>
          <ModelEditor data={formData} setData={setFormData} />
          <ModalFooter>
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button variant="secondary" onClick={handleTestConnection} disabled={!canTest}>
              <DOMAIN_ICONS.CONNECTION className="w-4 h-4" />
              {testingModelId === -1 ? 'Verifying...' : 'Verify'}
            </Button>
            <CreateButton entityName="Model" size="md" onClick={onSave} isCreating={isSaving} disabled={!formData.name || !formData.model_identifier} />
          </ModalFooter>
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
            // Separation of Concerns: Derived state logic to identify local infrastructure based on the API URL pattern.
            const isLocal = model.apiUrl?.includes('localhost') || model.apiUrl?.includes('127.0.0.1');

            return (
              <div key={model.id} className="p-6 bg-themed-inner border border-themed-border rounded-xl">
                {/*
                    Header Layout:
                    View Mode: Buttons in header for density and quick access.
                    Edit Mode: Buttons moved to footer for standard form usability.
                    Technical metadata is hidden in View Mode by design to reduce cognitive load.
                  */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-themed-fg-main">{model.name}</h3>
                    <MicroBadge variant="sage">
                      {model.role}
                    </MicroBadge>
                    {isLocal && (
                      <MicroBadge variant="sand">
                        Local
                      </MicroBadge>
                    )}
                  </div>
                  {!isEditing && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleTestConnectionForModel(model)}
                        disabled={testingModelId === model.id}
                        className="flex items-center gap-2"
                      >
                        <DOMAIN_ICONS.CONNECTION className="w-4 h-4" />
                        {testingModelId === model.id ? 'Verifying...' : 'Verify'}
                      </Button>
                      <EditButton entityName="Model" size="sm" onClick={() => onEdit(model)} />
                    </div>
                  )}
                </div>

                {isEditing ? (
                  /*
                    Edit Mode: Expanded form view. Displays all settings immediately
                    with action buttons at the bottom for standard form UX.
                  */
                  <div className="space-y-4">
                    <ModelEditor data={formData} setData={setFormData} />
                    <ModalFooter>
                      {model.isSystem ? (
                        <div className="text-xs text-themed-fg-muted italic">System models cannot be deleted</div>
                      ) : (
                        <DeleteAction onDelete={() => onDelete(model)} buttonText="Delete Model" />
                      )}
                      <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                      <Button variant="secondary" onClick={handleTestConnection} disabled={!canTest}>
                        <DOMAIN_ICONS.CONNECTION className="w-4 h-4" />
                        {testingModelId === -1 ? 'Verifying...' : 'Verify'}
                      </Button>
                      <SaveButton size="md" onClick={onSave} isSaving={isSaving} saveText="Save Changes" />
                    </ModalFooter>
                  </div>
                ) : null}
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
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <FormLabel>Model Name</FormLabel>
          <FormInput type="text" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} placeholder="e.g., Ollama Chat" />
        </div>
        <div>
          <FormLabel>Model Identifier</FormLabel>
          <FormInput type="text" value={data.model_identifier} onChange={(e) => setData({ ...data, model_identifier: e.target.value })} placeholder="e.g., llama3.1:8b" />
        </div>
      </div>

      <div>
        <FormLabel>Model Role</FormLabel>
        <FormSelect
          value={data.role}
          onChange={(e) => setData({ ...data, role: e.target.value as AiModelRole })}
        >
          <option value={AI_MODEL_ROLES.CHAT}>Chat (Text Generation)</option>
          <option value={AI_MODEL_ROLES.EMBEDDING}>Embedding (Vectorization)</option>
        </FormSelect>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <FormLabel>API URL</FormLabel>
          <FormInput type="text" value={data.api_url} onChange={(e) => setData({ ...data, api_url: e.target.value })} placeholder="http://127.0.0.1:11434/v1" />
        </div>
        <div>
          <FormLabel>API Key (Optional)</FormLabel>
          <FormInput type="password" value={data.api_key} onChange={(e) => setData({ ...data, api_key: e.target.value })} placeholder="Leave empty for local models" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <FormLabel>Temperature (0.0 - 2.0)</FormLabel>
          <FormInput type="number" min="0" max="2" step="0.1" value={data.temperature ?? 0.1} onChange={(e) => setData({ ...data, temperature: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
        <div>
          <FormLabel>Context Window (Tokens)</FormLabel>
          <FormInput type="number" min="1024" step="1024" value={data.contextWindow ?? 8192} onChange={(e) => setData({ ...data, contextWindow: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
      </div>
    </div>
  );
}