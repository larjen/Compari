'use client';

/**
 * @module AiModelForm
 * @description Form component for creating/editing AI models.
 * @responsibility
 * - Handles form UI for AI model creation/editing
 * - Managed by parent component for state and business logic
 * @separation_of_concerns
 * - Extracted from SettingsModal to enforce SoC
 * - Pure presentational component - no business logic
 */

import { Input, FormActions } from '@/components/ui';

/**
 * Form data structure for creating/updating AI models.
 */
export interface ModelFormData {
  name: string;
  model_identifier: string;
  api_url: string;
  api_key: string;
  role: 'chat' | 'embedding';
  temperature?: number;
  contextWindow?: number;
}

/**
 * Initial form data for a new model.
 * Defaults to chat role since it's the most common use case.
 */
export const initialFormData: ModelFormData = {
  name: '',
  model_identifier: '',
  api_url: 'http://127.0.0.1:11434/v1',
  api_key: '',
  role: 'chat',
  temperature: 0.1,
  contextWindow: 8192,
};

/**
 * Props for the AiModelForm component.
 */
interface AiModelFormProps {
  formData: ModelFormData;
  setFormData: (data: ModelFormData) => void;
  isEditing: boolean;
  isSaving: boolean;
  isActive?: boolean;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * Form component for creating or editing an AI model.
 * @param formData - Current form state
 * @param setFormData - Function to update form state
 * @param isEditing - Whether in edit mode
 * @param isSaving - Whether save operation is in progress
 * @param onSave - Callback to save the model
 * @param onCancel - Callback to cancel and close form
 */
export function AiModelForm({
  formData,
  setFormData,
  isEditing,
  isSaving,
  isActive,
  onSave,
  onCancel,
}: AiModelFormProps) {
  const variant = isActive ? 'inverted' : 'default';

  return (
    <div className="space-y-4">
      <h4 className={`font-semibold ${isActive ? 'text-white' : 'text-accent-forest'}`}>
        {isEditing ? 'Edit Model' : 'Add New Model'}
      </h4>

      <Input
        label="Model Name"
        id="model-name"
        type="text"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="e.g., Ollama Chat"
        variant={variant}
      />

      <Input
        label="Model Identifier"
        id="model-identifier"
        type="text"
        value={formData.model_identifier}
        onChange={(e) => setFormData({ ...formData, model_identifier: e.target.value })}
        placeholder="e.g., llama3.1:8b"
        variant={variant}
      />

      <Input
        label="API URL"
        id="api-url"
        type="text"
        value={formData.api_url}
        onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
        placeholder="http://127.0.0.1:11434/v1"
        variant={variant}
      />

      <Input
        label="API Key (Optional)"
        id="api-key"
        type="password"
        value={formData.api_key}
        onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
        placeholder="Leave empty for local models"
        variant={variant}
      />

      <Input
        label="Temperature (0.0 - 2.0)"
        id="model-temperature"
        type="number"
        min="0"
        max="2"
        step="0.1"
        value={formData.temperature ?? 0.1}
        onChange={(e) => setFormData({ ...formData, temperature: e.target.value ? Number(e.target.value) : undefined })}
        variant={variant}
      />

      <Input
        label="Context Window (Tokens)"
        id="model-context-window"
        type="number"
        min="1024"
        step="1024"
        value={formData.contextWindow ?? 8192}
        onChange={(e) => setFormData({ ...formData, contextWindow: e.target.value ? Number(e.target.value) : undefined })}
        variant={variant}
      />

      <div className="pt-2">
        <FormActions 
          onCancel={onCancel} 
          onSave={onSave} 
          isSaving={isSaving} 
          disabled={!formData.name || !formData.model_identifier} 
          saveText={isEditing ? 'Update' : 'Create'}
          inverted={isActive}
        />
      </div>
    </div>
  );
}