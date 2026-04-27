'use client';

import { useState, useEffect } from 'react';
import { Settings } from '@/lib/types';
import { settingsApi } from '@/lib/api/settingsApi';
import { useAiModels } from '@/hooks/useAiModels';
import { useToast } from '@/hooks/useToast';
import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { TOAST_TYPES } from '@/lib/constants';
import { SettingsCard } from '@/components/shared/SettingsCard';
import { FormSelect } from '@/components/ui/FormControls';

interface ModelRoutingTabProps {
  settings: Settings;
}

export function ModelRoutingTab({ settings }: ModelRoutingTabProps) {
  const { models, loading, error } = useAiModels();
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  const [routingGeneral, setRoutingGeneral] = useState(settings.model_routing_general || '');
  const [routingVerification, setRoutingVerification] = useState(settings.model_routing_verification || '');
  const [routingEmbedding, setRoutingEmbedding] = useState(settings.model_routing_embedding || '');
  const [routingMetadata, setRoutingMetadata] = useState(settings.model_routing_metadata || '');
  const [routingReasoning, setRoutingReasoning] = useState(settings.model_routing_reasoning || '');

  // SIDE-EFFECT: Handle error notifications after render to prevent lifecycle violations
  // * @socexplanation Adheres to React rules: Side-effects like toasts must not be triggered during render.
  useEffect(() => {
    if (error) {
      addToast(TOAST_TYPES.ERROR, 'Failed to load models');
    }
  }, [error, addToast]);

  const handleRoutingChange = async (key: string, value: string, setter: (v: string) => void) => {
    setter(value);
    setSaving(true);
    try {
      await settingsApi.updateSetting(key, value);
      addToast(TOAST_TYPES.SUCCESS, 'Routing updated');
    } catch (err) {
      addToast(TOAST_TYPES.ERROR, 'Failed to update routing');
    } finally {
      setSaving(false);
    }
  };

  const chatModels = models.filter(m => m.role === 'chat');
  const embeddingModels = models.filter(m => m.role === 'embedding');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <DOMAIN_ICONS.LOADING className="w-8 h-8 animate-spin text-accent-sage" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsCard
        icon={DOMAIN_ICONS.PROCESSING}
        title="General AI Tasks"
        description="Used for complex entity extraction and summarization."
      >
        <div>
          <FormSelect
            value={routingGeneral}
            onChange={(e) => handleRoutingChange('model_routing_general', e.target.value, setRoutingGeneral)}
            disabled={saving}
          >
            <option value="">Select a model...</option>
            {chatModels.map(model => (
              <option key={model.id} value={model.id}>
                {model.name} ({model.modelIdentifier})
              </option>
            ))}
          </FormSelect>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={DOMAIN_ICONS.EXTRACTION}
        title="Metadata Extraction"
        description="Used for pulling simple data points into structured formats."
      >
        <div>
          <FormSelect
            value={routingMetadata}
            onChange={(e) => handleRoutingChange('model_routing_metadata', e.target.value, setRoutingMetadata)}
            disabled={saving}
          >
            <option value="">Select a model...</option>
            {chatModels.map(model => (
              <option key={model.id} value={model.id}>
                {model.name} ({model.modelIdentifier})
              </option>
            ))}
          </FormSelect>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={DOMAIN_ICONS.EXTRACTION}
        title="Fast Verification"
        description="Used for lightning-fast logical checks (e.g., verifying criteria synonyms)."
      >
        <div>
          <FormSelect
            value={routingVerification}
            onChange={(e) => handleRoutingChange('model_routing_verification', e.target.value, setRoutingVerification)}
            disabled={saving}
          >
            <option value="">Select a model...</option>
            {chatModels.map(model => (
              <option key={model.id} value={model.id}>
                {model.name} ({model.modelIdentifier})
              </option>
            ))}
          </FormSelect>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={DOMAIN_ICONS.VECTOR}
        title="Vector Embeddings"
        description="Converts text into mathematical vectors for likeness scoring."
      >
        <div>
          <FormSelect
            value={routingEmbedding}
            onChange={(e) => handleRoutingChange('model_routing_embedding', e.target.value, setRoutingEmbedding)}
            disabled={saving}
          >
            <option value="">Select a model...</option>
            {embeddingModels.map(model => (
              <option key={model.id} value={model.id}>
                {model.name} ({model.modelIdentifier})
              </option>
            ))}
          </FormSelect>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={DOMAIN_ICONS.BLUEPRINT}
        title="Reasoning & Analysis"
        description="Used for high-context tasks like cultural fit analysis and complex reasoning."
      >
        <div>
          <FormSelect
            value={routingReasoning}
            onChange={(e) => handleRoutingChange('model_routing_reasoning', e.target.value, setRoutingReasoning)}
            disabled={saving}
          >
            <option value="">Select a model...</option>
            {chatModels.map(model => (
              <option key={model.id} value={model.id}>
                {model.name} ({model.modelIdentifier})
              </option>
            ))}
          </FormSelect>
        </div>
      </SettingsCard>
    </div>
  );
}