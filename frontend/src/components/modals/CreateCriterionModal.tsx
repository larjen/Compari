'use client';

import { useState } from 'react';
import { Dialog, Button, CreateButton, ModalFooter, Input, FormSelect } from '@/components/ui';
import { useDimensions } from '@/hooks/useDimensions';
import { useBlueprints } from '@/hooks/useBlueprints';
import { useTerminology } from '@/hooks/useTerminology';
import { useToast } from '@/hooks/useToast';
import { EntityCombobox } from '@/components/shared/EntityCombobox';
import { TOAST_TYPES, ENTITY_ROLES } from '@/lib/constants';

interface CreateCriterionModalProps {
  open: boolean;
  onClose: () => void;
  onCreateCriterion: (
    displayName: string,
    dimension: string,
    requirementId?: number,
    offeringId?: number
  ) => Promise<void>;
}

export function CreateCriterionModal({ open, onClose, onCreateCriterion }: CreateCriterionModalProps) {
  const { addToast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [selectedDimension, setSelectedDimension] = useState('');
  const [requirementId, setRequirementId] = useState<number | null>(null);
  const [offeringId, setOfferingId] = useState<number | null>(null);

  const { dimensions } = useDimensions();
  const { blueprints } = useBlueprints();
  const { activeLabels } = useTerminology();
  const { requirement: { singular: requirementLabel }, offering: { singular: offeringLabel } } = activeLabels;

  const handleCreate = async () => {
    if (!displayName || !selectedDimension) return;

    setIsCreating(true);
    try {
      await onCreateCriterion(
        displayName,
        selectedDimension,
        requirementId || undefined,
        offeringId || undefined
      );
      addToast(TOAST_TYPES.SUCCESS, 'Criterion created successfully');
      handleClose();
    } catch (err) {
      addToast(TOAST_TYPES.ERROR, 'Failed to create criterion');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setDisplayName('');
      setSelectedDimension('');
      setRequirementId(null);
      setOfferingId(null);
      onClose();
    }
  };

  const isValid = displayName && selectedDimension;

  return (
    <Dialog open={open} onClose={handleClose} title="Create Criterion" autoHeight className="md:max-w-xl">
      <div className="space-y-6">
        <p className="text-accent-forest/70">
          Create a new criterion and optionally link it to a {requirementLabel.toLowerCase()} and/or {offeringLabel.toLowerCase()}.
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-accent-forest">
              Display Name
            </label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., 5+ years experience in React"
              disabled={isCreating}
            />
          </div>

          <div>
            <FormSelect
              value={selectedDimension}
              onChange={(e) => setSelectedDimension(e.target.value)}
              disabled={isCreating}
            >
              <option value="">Select a dimension...</option>
              {dimensions?.filter(d => d.isActive).map(dim => (
                <option key={dim.id} value={dim.name}>
                  {dim.displayName}
                </option>
              ))}
            </FormSelect>
          </div>

          <div>
            <EntityCombobox
              type={ENTITY_ROLES.REQUIREMENT}
              label={requirementLabel}
              value={requirementId}
              onChange={setRequirementId}
              blueprints={blueprints}
              disabled={isCreating}
            />
          </div>

          <div>
            <EntityCombobox
              type={ENTITY_ROLES.OFFERING}
              label={offeringLabel}
              value={offeringId}
              onChange={setOfferingId}
              blueprints={blueprints}
              disabled={isCreating}
            />
          </div>
        </div>

        <ModalFooter>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <CreateButton
            entityName="Criterion"
            size="md"
            onClick={handleCreate}
            isCreating={isCreating}
            disabled={!isValid}
          />
        </ModalFooter>
      </div>
    </Dialog>
  );
}