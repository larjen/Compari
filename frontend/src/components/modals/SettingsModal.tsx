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
 * - ❌ MUST NOT fetch data directly (delegated to hooks).
 * @import_note Import paths use exact PascalCase ('@/components/ui/Button') to resolve Webpack module casing conflicts.
 */
import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { useState, useEffect } from 'react';
import { Settings, AiModel, AiModelRole } from '@/lib/types';
import { SETTING_KEYS, AI_MODEL_ROLES } from '@/lib/constants';
import { useSettings } from '@/hooks/useSettings';
import { useAiModels } from '@/hooks/useAiModels';
import { EntityDetailLayout } from '@/components/shared/EntityDetailLayout';
import { SettingsCard } from '@/components/shared/SettingsCard';
import { DimensionsTab } from '@/components/settings/DimensionsTab';
import { BlueprintsTab } from '@/components/settings/BlueprintsTab';
import { PromptsTab } from '@/components/settings/PromptsTab';
import { AiModelList, ModelFormData, initialFormData } from '@/components/settings/AiModelList';
import { ModelRoutingTab } from '@/components/settings/ModelRoutingTab';
import { Button } from '@/components/ui/Button';
import { CreateButton } from '@/components/ui/CreateButton';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { PercentageSlider } from '@/components/ui/PercentageSlider';

/**
 * Tab identifiers for the Settings modal.
 */
const SETTINGS_TABS = {
  GENERAL_SETTINGS: 'general-settings',
  CHAT_MODELS: 'chat-models',
  EMBEDDING_MODELS: 'embedding-models',
  TASK_ROUTING: 'task-routing',
  BLUEPRINTS: 'blueprints',
  DIMENSIONS: 'dimensions',
  PROMPTS: 'prompts'
} as const;
type TabId = typeof SETTINGS_TABS[keyof typeof SETTINGS_TABS];

/**
 * Tab configuration for the Settings modal.
 */
const tabs = [
  { id: SETTINGS_TABS.GENERAL_SETTINGS, label: 'General', icon: DOMAIN_ICONS.SETTINGS },
  { id: SETTINGS_TABS.CHAT_MODELS, label: 'Model Registry', icon: DOMAIN_ICONS.DATABASE },
  { id: SETTINGS_TABS.TASK_ROUTING, label: 'Task Routing', icon: DOMAIN_ICONS.BRANCH },
  { id: SETTINGS_TABS.BLUEPRINTS, label: 'Blueprints', icon: DOMAIN_ICONS.BLUEPRINT },
  { id: SETTINGS_TABS.DIMENSIONS, label: 'Dimensions', icon: DOMAIN_ICONS.DIMENSION },
  { id: SETTINGS_TABS.PROMPTS, label: 'Prompts', icon: DOMAIN_ICONS.PROMPT },
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
  const [activeTab, setActiveTab] = useState<TabId>(SETTINGS_TABS.GENERAL_SETTINGS);
  const [thresholdInput, setThresholdInput] = useState<string>('95');
  const [minFloorInput, setMinFloorInput] = useState<string>('50');
  const [perfectScoreInput, setPerfectScoreInput] = useState<string>('85');
  const [logAiInteractions, setLogAiInteractions] = useState<boolean>(false);
  const [aiVerifyMerges, setAiVerifyMerges] = useState<boolean>(true);
  const [allowConcurrentAi, setAllowConcurrentAi] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingModel, setEditingModel] = useState<AiModel | null>(null);
  const [formData, setFormData] = useState<ModelFormData>(initialFormData);
  const [isCreatingDimension, setIsCreatingDimension] = useState(false);
  const [isCreatingBlueprint, setIsCreatingBlueprint] = useState(false);

  const { settings, loading: settingsLoading, updateSetting } = useSettings(open);
  const { models, loading: modelsLoading, createModel, updateModel, deleteModel, setActiveModel, testConnection } = useAiModels(open);

  const loading = settingsLoading || modelsLoading;

  useEffect(() => {
    if (open) {
      setActiveTab(SETTINGS_TABS.GENERAL_SETTINGS);
    }
  }, [open]);

  useEffect(() => {
    cancelForm();
    setIsCreatingDimension(false);
    setIsCreatingBlueprint(false);
  }, [activeTab, open]);

  useEffect(() => {
    if (settings) {
      if (settings.auto_merge_threshold) {
        setThresholdInput(Math.round(parseFloat(settings.auto_merge_threshold) * 100).toString());
      }
      if (settings.minimum_match_floor) {
        setMinFloorInput(Math.round(parseFloat(settings.minimum_match_floor) * 100).toString());
      }
      if (settings.perfect_match_score) {
        setPerfectScoreInput(Math.round(parseFloat(settings.perfect_match_score) * 100).toString());
      }
      if (settings.log_ai_interactions) {
        setLogAiInteractions(settings.log_ai_interactions === 'true');
      }
      if (settings.ai_verify_merges) {
        setAiVerifyMerges(settings.ai_verify_merges === 'true');
      }
      if (settings.allow_concurrent_ai) {
        setAllowConcurrentAi(settings.allow_concurrent_ai === 'true');
      }
    }
  }, [settings]);

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
      await updateSetting(key, decimalValue);
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
    await handleAutoSaveSlider(SETTING_KEYS.AUTO_MERGE_THRESHOLD, value, 'Threshold updated');
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
      await updateSetting(SETTING_KEYS.LOG_AI_INTERACTIONS, newValue.toString());
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
      await updateSetting(SETTING_KEYS.AI_VERIFY_MERGES, newValue.toString());
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
      await updateSetting(SETTING_KEYS.ALLOW_CONCURRENT_AI, newValue.toString());
      onSuccess('Concurrency setting updated successfully');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save concurrency setting');
    } finally {
      setSaving(false);
    }
  };

  const handleSetActive = async (modelId: number) => {
    const targetModel = models.find((m) => m.id === modelId);
    if (targetModel?.isActive) {
      return;
    }

    try {
      await setActiveModel(modelId);
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

  const openAddForm = (role: AiModelRole) => {
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
        await updateModel(editingModel.id, {
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
        await createModel({
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
      cancelForm();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save model');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteModel = async (model: AiModel) => {
    try {
      await deleteModel(model.id);
      onSuccess('Model deleted successfully');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to delete model');
    }
  };



  const chatModels = models.filter((m) => m.role === AI_MODEL_ROLES.CHAT);
  const embeddingModels = models.filter((m) => m.role === AI_MODEL_ROLES.EMBEDDING);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <DOMAIN_ICONS.LOADING className="w-6 h-6 animate-spin text-accent-sage" />
        </div>
      );
    }

    if (activeTab === SETTINGS_TABS.GENERAL_SETTINGS) {
      return (
        <div className="space-y-4">
          <SettingsCard
            icon={DOMAIN_ICONS.DATABASE}
            title="Threshold for merging Criteria"
            description="Set the similarity threshold for automatically merging similar criteria, when a new criteria has been extracted."
          >
            <PercentageSlider
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              onCommit={handleAutoSaveThreshold}
              min="50"
              max="100"
            />
          </SettingsCard>

          <SettingsCard
            icon={DOMAIN_ICONS.DATABASE}
            title="Minimum Match Floor"
            description="Set the minimum similarity percentage required for a criteria to be considered a partial match."
          >
            <PercentageSlider
              value={minFloorInput}
              onChange={(e) => setMinFloorInput(e.target.value)}
              onCommit={(value) => handleAutoSaveSlider(SETTING_KEYS.MINIMUM_MATCH_FLOOR, value, 'Minimum floor updated')}
            />
          </SettingsCard>

          <SettingsCard
            icon={DOMAIN_ICONS.DATABASE}
            title="Perfect Match Score"
            description="Set the similarity percentage at which a match is considered a perfect match."
          >
            <PercentageSlider
              value={perfectScoreInput}
              onChange={(e) => setPerfectScoreInput(e.target.value)}
              onCommit={(value) => handleAutoSaveSlider(SETTING_KEYS.PERFECT_MATCH_SCORE, value, 'Perfect score updated')}
            />
          </SettingsCard>

          <SettingsCard
            icon={DOMAIN_ICONS.FILE}
            title="AI Debugging"
            description="Capture detailed AI prompts and responses in the System Logs for debugging match quality."
          >
            <ToggleSwitch
              checked={logAiInteractions}
              onChange={(checked) => {
                setLogAiInteractions(checked);
                handleAutoSaveLogAi(checked);
              }}
            />
          </SettingsCard>

          <SettingsCard
            icon={DOMAIN_ICONS.DATABASE}
            title="AI Merge Verification"
            description="Use the AI to double-check if similar criteria are true synonyms before merging them. Disable to strictly use vector similarity."
          >
            <ToggleSwitch
              checked={aiVerifyMerges}
              onChange={(checked) => {
                setAiVerifyMerges(checked);
                handleAutoSaveVerifyMerges(checked);
              }}
            />
          </SettingsCard>

          <SettingsCard
            icon={DOMAIN_ICONS.EXTRACTION}
            title="Allow Concurrent AI Processing"
            description="Enable this if you are using a cloud AI provider (e.g., OpenAI) to drastically speed up extraction. Leave this disabled for local models (e.g., Ollama) to prevent queue thrashing and inaccurate timing logs."
          >
            <ToggleSwitch
              checked={allowConcurrentAi}
              onChange={(checked) => {
                setAllowConcurrentAi(checked);
                handleAutoSaveConcurrentAi(checked);
              }}
            />
          </SettingsCard>
        </div>
      );
    }

    if (activeTab === SETTINGS_TABS.BLUEPRINTS) {
      return <BlueprintsTab isCreating={isCreatingBlueprint} setIsCreating={setIsCreatingBlueprint} />;
    }

    if (activeTab === SETTINGS_TABS.DIMENSIONS) {
      return <DimensionsTab isCreating={isCreatingDimension} setIsCreating={setIsCreatingDimension} />;
    }

    if (activeTab === SETTINGS_TABS.PROMPTS) {
      return <PromptsTab />;
    }

    if (activeTab === SETTINGS_TABS.TASK_ROUTING) {
      return <ModelRoutingTab settings={settings} />;
    }

    const modelList = models;
    const role = AI_MODEL_ROLES.CHAT;

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
          onTestConnection={testConnection}
        />
      </div>
    );
  };

  const renderFooterActions = () => {
    if (activeTab === SETTINGS_TABS.GENERAL_SETTINGS) return null;

    if (activeTab === SETTINGS_TABS.CHAT_MODELS) {
      if (showForm) return null;
      return (
        <CreateButton entityName="Model" onClick={() => openAddForm(AI_MODEL_ROLES.CHAT)} />
      );
    }

    if (activeTab === SETTINGS_TABS.BLUEPRINTS) {
      if (isCreatingBlueprint) return null;
      return (
        <CreateButton entityName="Blueprint" onClick={() => setIsCreatingBlueprint(true)} />
      );
    }

    if (activeTab === SETTINGS_TABS.DIMENSIONS) {
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