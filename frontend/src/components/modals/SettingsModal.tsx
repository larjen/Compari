'use client';

/**
 * @module SettingsModal
 * @description Settings modal for managing AI models and application settings.
 * @responsibility
 * - Provides form for managing AI chat and embedding models.
 * - Provides General Settings tab for configurable thresholds.
 * - Uses EntityDetailLayout for consistent modal structure.
 * @boundary_rules
 * - ❌ MUST NOT contain business logic (delegated to hooks).
 * - ❌ MUST NOT fetch data directly (delegated to apiClient).
 * @import_note Import paths use exact PascalCase ('@/components/ui/Button') to resolve Webpack module casing conflicts.
 */
import { useState, useEffect } from 'react';
import { Settings, AiModel } from '@/lib/types';
import { settingsApi } from '@/lib/api/settingsApi';
import { aiModelApi } from '@/lib/api/aiModelApi';
import { EntityDetailLayout } from '@/components/shared/EntityDetailLayout';
import { Loader2, MessageSquare, Database, Settings as SettingsIcon, FileText, Layout, Target, MessageSquareText, GitBranch, Zap } from 'lucide-react';
import { DimensionsTab } from '@/components/settings/DimensionsTab';
import { BlueprintsTab } from '@/components/settings/BlueprintsTab';
import { PromptsTab } from '@/components/settings/PromptsTab';
import { AiModelList, ModelFormData, initialFormData } from '@/components/settings/AiModelList';
import { ModelRoutingTab } from '@/components/settings/ModelRoutingTab';
import { Button } from '@/components/ui/Button';
import { CreateButton } from '@/components/ui/CreateButton';


/**
 * Card-based wrapper for individual settings.
 * Displays an icon, title, description, and control in a styled card.
 * 
 * @param icon - Lucide icon component to display next to the title
 * @param title - Bold title for the setting section
 * @param description - Muted description text explaining the setting
 * @param children - React nodes for the control input(s)
 */
function SettingsCard({ icon: Icon, title, description, children }: { icon: React.ElementType; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-themed-inner border border-themed-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-accent-sage" />
        <h3 className="text-lg font-bold text-themed-fg-main">{title}</h3>
      </div>
      <p className="text-sm text-themed-fg-muted">{description}</p>
      {children}
    </div>
  );
}

/**
 * Tab identifiers for the Settings modal.
 */
type TabId = 'general-settings' | 'chat-models' | 'embedding-models' | 'task-routing' | 'blueprints' | 'dimensions' | 'prompts';

/**
 * Tab configuration for the Settings modal.
 */
const tabs = [
  { id: 'general-settings', label: 'General', icon: SettingsIcon },
  { id: 'chat-models', label: 'Model Registry', icon: Database },
  { id: 'task-routing', label: 'Task Routing', icon: GitBranch },
  { id: 'blueprints', label: 'Blueprints', icon: Layout },
  { id: 'dimensions', label: 'Dimensions', icon: Target },
  { id: 'prompts', label: 'Prompts', icon: MessageSquareText },
];


/**
 * Props for the SettingsModal component.
 */
interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * Settings modal component for managing AI models.
 * 
 * Layout Architecture:
 * Uses EntityDetailLayout to maintain consistent modal structure across the app.
 * 
 * Tab Architecture (Separation of Concerns):
 * This component uses two distinct tabs, each handling a separate domain:
 * - Chat Models Tab: Manages conversational AI models for user interactions
 * - Embedding Models Tab: Manages vector embedding models for search/indexing
 */
export function SettingsModal({ open, onClose, onSuccess, onError }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('general-settings');
  const [settings, setSettings] = useState<Settings>({
    ollama_host: '',
    ollama_model: '',
  });
  const [thresholdInput, setThresholdInput] = useState<string>('95');
  const [minFloorInput, setMinFloorInput] = useState<string>('50');
  const [perfectScoreInput, setPerfectScoreInput] = useState<string>('85');
  const [logAiInteractions, setLogAiInteractions] = useState<boolean>(false);
  const [aiVerifyMerges, setAiVerifyMerges] = useState<boolean>(true);
  const [allowConcurrentAi, setAllowConcurrentAi] = useState<boolean>(false);
  const [models, setModels] = useState<AiModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingModel, setEditingModel] = useState<AiModel | null>(null);
  const [formData, setFormData] = useState<ModelFormData>(initialFormData);
  const [isCreatingDimension, setIsCreatingDimension] = useState(false);
  const [isCreatingBlueprint, setIsCreatingBlueprint] = useState(false);

  useEffect(() => {
    if (open) {
      setActiveTab('general-settings');
      loadSettings();
      loadModels();
    }
  }, [open]);

  useEffect(() => {
    cancelForm();
    setIsCreatingDimension(false);
    setIsCreatingBlueprint(false);
  }, [activeTab, open]);

  const loadSettings = async () => {
    try {
      const data = await settingsApi.getSettings();
      setSettings(data);
      if (data.auto_merge_threshold) {
        setThresholdInput(Math.round(parseFloat(data.auto_merge_threshold) * 100).toString());
      }
      if (data.minimum_match_floor) {
        setMinFloorInput(Math.round(parseFloat(data.minimum_match_floor) * 100).toString());
      }
      if (data.perfect_match_score) {
        setPerfectScoreInput(Math.round(parseFloat(data.perfect_match_score) * 100).toString());
      }
      if (data.log_ai_interactions) {
        setLogAiInteractions(data.log_ai_interactions === 'true');
      }
      if (data.ai_verify_merges) {
        setAiVerifyMerges(data.ai_verify_merges === 'true');
      }
      if (data.allow_concurrent_ai) {
        setAllowConcurrentAi(data.allow_concurrent_ai === 'true');
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  /**
   * Auto-saves a slider setting to the backend.
   * Scales the whole-number UI value (0-100) to a decimal string (e.g., 0.85) for backend compatibility.
   * The backend stores thresholds as decimals representing percentages (e.g., 0.85 = 85%).
   * @param {string} key - The settings key (e.g., 'auto_merge_threshold')
   * @param {string} value - The whole-number value as a string (e.g., '85')
   * @param {string} successMessage - The message to display on toast success
   */
  const handleAutoSaveSlider = async (key: string, value: string, successMessage: string) => {
    setSaving(true);
    try {
      const decimalValue = (parseFloat(value) / 100).toFixed(2);
      await settingsApi.updateSetting(key, decimalValue);
      await loadSettings();
      onSuccess(successMessage);
    } catch (err) {
      onError(err instanceof Error ? err.message : `Failed to save ${key}`);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Auto-saves the threshold value to the backend when the user releases the slider
   * or releases keyboard focus.
   * @description SoC: Delegates success feedback to the global toast system via the onSuccess callback.
   * @param {string} value - The threshold value as string
   */
  const handleAutoSaveThreshold = async (value: string) => {
    await handleAutoSaveSlider('auto_merge_threshold', value, 'Threshold updated');
  };

/**
   * Auto-saves the log_ai_interactions toggle to the backend immediately when toggled.
   * @description
   * SoC: Delegates success feedback to the global toast system via the onSuccess callback,
   * isolating the UI toggle state from API persistence.
   * @param {boolean} newValue - The boolean state to save
   * @returns {Promise<void>}
   */
  const handleAutoSaveLogAi = async (newValue: boolean) => {
    setSaving(true);
    try {
      await settingsApi.updateSetting('log_ai_interactions', newValue.toString());
      await loadSettings();
      onSuccess('Logging settings updated successfully');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save logging setting');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoSaveVerifyMerges = async (newValue: boolean) => {
    setSaving(true);
    try {
      await settingsApi.updateSetting('ai_verify_merges', newValue.toString());
      await loadSettings();
      onSuccess('AI merge verification setting updated successfully');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save merge verification setting');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoSaveConcurrentAi = async (newValue: boolean) => {
    setSaving(true);
    try {
      await settingsApi.updateSetting('allow_concurrent_ai', newValue.toString());
      await loadSettings();
      onSuccess('Concurrency setting updated successfully');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save concurrency setting');
    } finally {
      setSaving(false);
    }
  };

  const loadModels = async () => {
    setLoading(true);
    try {
      const data = await aiModelApi.getModels();
      setModels(data);
    } catch (err) {
      onError('Failed to load AI models');
    } finally {
      setLoading(false);
    }
  };

  const handleSetActive = async (modelId: number) => {
    const targetModel = models.find((m) => m.id === modelId);
    if (targetModel?.isActive) {
      return;
    }

    try {
      await aiModelApi.setActiveModel(modelId);
      await loadModels();
      onSuccess('Active model updated');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to set active model');
    }
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingModel(null);
    setFormData(initialFormData);
  };

  const openAddForm = (role: 'chat' | 'embedding') => {
    setEditingModel(null);
    setFormData({ ...initialFormData, role });
    setShowForm(true);
  };

  const openEditForm = (model: AiModel) => {
    setEditingModel(model);
    setFormData({
      name: model.name,
      model_identifier: model.modelIdentifier,
      api_url: model.apiUrl || '',
      api_key: model.apiKey || '',
      role: model.role,
      temperature: model.temperature,
      contextWindow: model.contextWindow,
    });
    setShowForm(true);
  };

  /**
   * Handles the save operation for creating or updating an AI model.
   * Constructs a complete, validation-compliant payload mapping local form state to the API client,
   * ensuring all strict schema requirements (like role) and optional tuning parameters (temperature, context) are securely transmitted.
   * @returns {Promise<void>}
   */
  const handleSaveModel = async () => {
    if (!formData.name || !formData.model_identifier) {
      onError('Name and model identifier are required');
      return;
    }

    setSaving(true);
    try {
      if (editingModel) {
        await aiModelApi.updateModel(editingModel.id, {
          name: formData.name,
          model_identifier: formData.model_identifier,
          api_url: formData.api_url || undefined,
          api_key: formData.api_key || undefined,
          role: formData.role,
          temperature: formData.temperature,
          contextWindow: formData.contextWindow,
        });
        onSuccess('Model updated successfully');
      } else {
        await aiModelApi.createModel({
          name: formData.name,
          model_identifier: formData.model_identifier,
          api_url: formData.api_url || undefined,
          api_key: formData.api_key || undefined,
          role: formData.role,
          temperature: formData.temperature,
          contextWindow: formData.contextWindow,
        });
        onSuccess('Model created successfully');
      }
      await loadModels();
      cancelForm();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save model');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteModel = async (model: AiModel) => {
    try {
      await aiModelApi.deleteModel(model.id);
      await loadModels();
      onSuccess('Model deleted successfully');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to delete model');
    }
  };



  const chatModels = models.filter((m) => m.role === 'chat');
  const embeddingModels = models.filter((m) => m.role === 'embedding');

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-accent-sage" />
        </div>
      );
    }

    if (activeTab === 'general-settings') {
      return (
        <div className="space-y-4">
          <SettingsCard
            icon={Database}
            title="Threshold for merging Criteria"
            description="Set the similarity threshold for automatically merging similar criteria, when a new criteria has been extracted."
          >
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <input
                  type="range"
                  min="50"
                  max="100"
                  step="1"
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  onMouseUp={(e) => handleAutoSaveThreshold((e.target as HTMLInputElement).value)}
                  onKeyUp={(e) => handleAutoSaveThreshold((e.target as HTMLInputElement).value)}
                  className="w-full h-2 bg-themed-input-border rounded-lg appearance-none cursor-pointer accent-accent-sage"
                />
              </div>
              <span className="font-mono text-sm text-themed-fg-main min-w-[50px] text-right">
                {thresholdInput}%
              </span>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={Database}
            title="Minimum Match Floor"
            description="Set the minimum similarity percentage required for a criteria to be considered a partial match."
          >
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={minFloorInput}
                  onChange={(e) => setMinFloorInput(e.target.value)}
                  onMouseUp={(e) => handleAutoSaveSlider('minimum_match_floor', (e.target as HTMLInputElement).value, 'Minimum floor updated')}
                  onKeyUp={(e) => handleAutoSaveSlider('minimum_match_floor', (e.target as HTMLInputElement).value, 'Minimum floor updated')}
                  className="w-full h-2 bg-themed-input-border rounded-lg appearance-none cursor-pointer accent-accent-sage"
                />
              </div>
              <span className="font-mono text-sm text-themed-fg-main min-w-[50px] text-right">
                {minFloorInput}%
              </span>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={Database}
            title="Perfect Match Score"
            description="Set the similarity percentage at which a match is considered a perfect match."
          >
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={perfectScoreInput}
                  onChange={(e) => setPerfectScoreInput(e.target.value)}
                  onMouseUp={(e) => handleAutoSaveSlider('perfect_match_score', (e.target as HTMLInputElement).value, 'Perfect score updated')}
                  onKeyUp={(e) => handleAutoSaveSlider('perfect_match_score', (e.target as HTMLInputElement).value, 'Perfect score updated')}
                  className="w-full h-2 bg-themed-input-border rounded-lg appearance-none cursor-pointer accent-accent-sage"
                />
              </div>
              <span className="font-mono text-sm text-themed-fg-main min-w-[50px] text-right">
                {perfectScoreInput}%
              </span>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={FileText}
            title="AI Debugging"
            description="Capture detailed AI prompts and responses in the System Logs for debugging match quality."
          >
            <div className="flex items-center justify-between">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={logAiInteractions}
                  onChange={(e) => {
                    setLogAiInteractions(e.target.checked);
                    handleAutoSaveLogAi(e.target.checked);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-themed-input-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-sage"></div>
                <span className="ml-3 text-sm font-medium text-themed-fg-main">
                  {logAiInteractions ? 'On' : 'Off'}
                </span>
              </label>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={Database}
            title="AI Merge Verification"
            description="Use the AI to double-check if similar criteria are true synonyms before merging them. Disable to strictly use vector similarity."
          >
            <div className="flex items-center justify-between">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiVerifyMerges}
                  onChange={(e) => {
                    setAiVerifyMerges(e.target.checked);
                    handleAutoSaveVerifyMerges(e.target.checked);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-themed-input-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-sage"></div>
                <span className="ml-3 text-sm font-medium text-themed-fg-main">
                  {aiVerifyMerges ? 'On' : 'Off'}
                </span>
              </label>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={Zap}
            title="Allow Concurrent AI Processing"
            description="Enable this if you are using a cloud AI provider (e.g., OpenAI) to drastically speed up extraction. Leave this disabled for local models (e.g., Ollama) to prevent queue thrashing and inaccurate timing logs."
          >
            <div className="flex items-center justify-between">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowConcurrentAi}
                  onChange={(e) => {
                    setAllowConcurrentAi(e.target.checked);
                    handleAutoSaveConcurrentAi(e.target.checked);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-themed-input-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-sage"></div>
                <span className="ml-3 text-sm font-medium text-themed-fg-main">
                  {allowConcurrentAi ? 'On' : 'Off'}
                </span>
              </label>
            </div>
          </SettingsCard>
        </div>
      );
    }

    if (activeTab === 'blueprints') {
      return <BlueprintsTab isCreating={isCreatingBlueprint} setIsCreating={setIsCreatingBlueprint} />;
    }

    if (activeTab === 'dimensions') {
      return <DimensionsTab isCreating={isCreatingDimension} setIsCreating={setIsCreatingDimension} />;
    }

    if (activeTab === 'prompts') {
      return <PromptsTab />;
    }

    if (activeTab === 'task-routing') {
      return <ModelRoutingTab settings={settings} />;
    }

    const modelList = models;
    const role = 'chat';

    return (
      <div className="space-y-4">
        <AiModelList
          models={modelList}
          role={role}
          isLoading={loading}
          showForm={showForm}
          editingModelId={editingModel?.id || null}
          formData={formData}
          setFormData={setFormData}
          isSaving={saving}
          onEdit={openEditForm}
          onDelete={handleDeleteModel}
          onSave={handleSaveModel}
          onCancel={cancelForm}
        />
      </div>
    );
  };

  const renderFooterActions = () => {
    if (activeTab === 'general-settings') return null;

    if (activeTab === 'chat-models') {
      if (showForm) return null;
      return (
        <CreateButton entityName="Model" onClick={() => openAddForm('chat')} />
      );
    }

    if (activeTab === 'blueprints') {
      if (isCreatingBlueprint) return null;
      return (
        <CreateButton entityName="Blueprint" onClick={() => setIsCreatingBlueprint(true)} />
      );
    }

    if (activeTab === 'dimensions') {
      if (isCreatingDimension) return null;
      return (
        <CreateButton entityName="Dimension" onClick={() => setIsCreatingDimension(true)} />
      );
    }

    return null;
  };

  return (
    <EntityDetailLayout
      title="Settings"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as TabId)}
      layoutIdPrefix="settings"
      open={open}
      onClose={onClose}
      footerActions={renderFooterActions()}
    >
      {renderContent()}
    </EntityDetailLayout>
  );
}