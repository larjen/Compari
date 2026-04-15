'use client';

import { useState } from 'react';
import { Dialog, Button, CreateButton } from '@/components/ui';
import { useBlueprints } from '@/hooks/useBlueprints';
import { EntityCombobox } from '@/components/shared/EntityCombobox';
import { Scale, Weight } from 'lucide-react';

interface CreateMatchModalProps {
  open: boolean;
  onClose: () => void;
  onCreateMatch: (sourceId: number, targetId: number) => Promise<number>;
}

export function CreateMatchModal({ open, onClose, onCreateMatch }: CreateMatchModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);

  const { blueprints } = useBlueprints();
  const activeBlueprint = blueprints.find(b => b.is_active) || blueprints[0];
  const requirementLabel = activeBlueprint?.requirementLabelSingular || 'Requirement';
  const offeringLabel = activeBlueprint?.offeringLabelSingular || 'Offering';

  const handleCreate = async () => {
    if (!selectedSourceId || !selectedTargetId) return;

    setIsCreating(true);
    try {
      await onCreateMatch(selectedSourceId, selectedTargetId);
      setSelectedSourceId(null);
      setSelectedTargetId(null);
      onClose();
    } catch (err) {
      console.error('Failed to create match:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setSelectedSourceId(null);
      setSelectedTargetId(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} title="Create Match">
      <div className="space-y-6">
        <p className="text-accent-forest/70">
          Select a {requirementLabel.toLowerCase()} and {offeringLabel.toLowerCase()} to create a match and start an assessment.
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-accent-forest">
              <Scale className="w-4 h-4 inline-block mr-2" />
              {requirementLabel}
            </label>
            <EntityCombobox
              type="requirement"
              label={requirementLabel}
              value={selectedSourceId}
              onChange={setSelectedSourceId}
              blueprints={blueprints}
              disabled={isCreating}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-accent-forest">
              <Weight className="w-4 h-4 inline-block mr-2" />
              {offeringLabel}
            </label>
            <EntityCombobox
              type="offering"
              label={offeringLabel}
              value={selectedTargetId}
              onChange={setSelectedTargetId}
              blueprints={blueprints}
              disabled={isCreating}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <CreateButton
            entityName="Match"
            size="md"
            onClick={handleCreate}
            isCreating={isCreating}
            disabled={!selectedSourceId || !selectedTargetId}
          />
        </div>
      </div>
    </Dialog>
  );
}