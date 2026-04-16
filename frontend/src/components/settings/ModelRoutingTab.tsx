'use client';

import { useState, useEffect } from 'react';
import { Settings } from '@/lib/types';
import { settingsApi } from '@/lib/api/settingsApi';
import { aiModelApi } from '@/lib/api/aiModelApi';
import { useToast } from '@/hooks/useToast';
import { Loader2, GitMerge, Zap, Cpu } from 'lucide-react';
import { TOAST_TYPES } from '@/lib/constants';

interface ModelRoutingTabProps {
  settings: Settings;
}

export function ModelRoutingTab({ settings }: ModelRoutingTabProps) {
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();
  
  const [routingGeneral, setRoutingGeneral] = useState(settings.model_routing_general || '');
  const [routingVerification, setRoutingVerification] = useState(settings.model_routing_verification || '');
  const [routingEmbedding, setRoutingEmbedding] = useState(settings.model_routing_embedding || '');
  const [routingMetadata, setRoutingMetadata] = useState(settings.model_routing_metadata || '');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await aiModelApi.getModels();
      setModels(data);
    } catch (err) {
      addToast(TOAST_TYPES.ERROR, 'Failed to load models');
    } finally {
      setLoading(false);
    }
  };

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
        <Loader2 className="w-8 h-8 animate-spin text-accent-sage" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RoutingCard
        icon={Cpu}
        title="General AI Tasks"
        description="Used for complex entity extraction and summarization."
        models={chatModels}
        selectedValue={routingGeneral}
        onChange={(val) => handleRoutingChange('model_routing_general', val, setRoutingGeneral)}
        saving={saving}
      />

      <RoutingCard
        icon={Zap}
        title="Metadata Extraction"
        description="Used for pulling simple data points (names, emails, basic field values) from documents into structured formats."
        models={chatModels}
        selectedValue={routingMetadata}
        onChange={(val) => handleRoutingChange('model_routing_metadata', val, setRoutingMetadata)}
        saving={saving}
      />

      <RoutingCard
        icon={Zap}
        title="Fast Verification"
        description="Used for lightning-fast logical checks, like verifying criteria synonyms."
        models={chatModels}
        selectedValue={routingVerification}
        onChange={(val) => handleRoutingChange('model_routing_verification', val, setRoutingVerification)}
        saving={saving}
      />

      <RoutingCard
        icon={GitMerge}
        title="Vector Embeddings"
        description="Used to convert text into mathematical vectors for likeness scoring."
        models={embeddingModels}
        selectedValue={routingEmbedding}
        onChange={(val) => handleRoutingChange('model_routing_embedding', val, setRoutingEmbedding)}
        saving={saving}
      />
    </div>
  );
}

function RoutingCard({ 
  icon: Icon, 
  title, 
  description, 
  models, 
  selectedValue, 
  onChange,
  saving 
}: { 
  icon: any, 
  title: string, 
  description: string, 
  models: any[], 
  selectedValue: string, 
  onChange: (val: string) => void,
  saving: boolean
}) {
  return (
    <div className="bg-themed-inner border border-themed-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-accent-sage" />
        <h3 className="text-lg font-bold text-themed-fg-main">{title}</h3>
      </div>
      <p className="text-sm text-themed-fg-muted">{description}</p>
      
      <div>
        <select
          value={selectedValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={saving}
          className="w-full px-3 py-2 border border-themed-input-border rounded-lg bg-themed-input-bg text-themed-fg-main focus:ring-2 focus:ring-accent-sage/50 outline-none text-sm"
        >
          <option value="">Select a model...</option>
          {models.map(model => (
            <option key={model.id} value={model.id}>
              {model.name} ({model.modelIdentifier})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}