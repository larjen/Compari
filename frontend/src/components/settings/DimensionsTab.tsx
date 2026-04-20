'use client';

import { useState } from 'react';
import { useDimensions } from '@/hooks/useDimensions';
import { useBlueprints } from '@/hooks/useBlueprints';
import { useToast } from '@/hooks/useToast';
import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { EmptyState } from '@/components/shared/PageStates';
import { Button } from '@/components/ui/Button';
import { CreateButton } from '@/components/ui/CreateButton';
import { SaveButton } from '@/components/ui/SaveButton';
import { EditButton } from '@/components/ui/EditButton';
import { DeleteAction } from '@/components/ui/DeleteAction';
import { ModalFooter } from '@/components/ui/ModalFooter';
import { FormLabel, FormInput, FormTextarea } from '@/components/ui/FormControls';
import { MicroBadge } from '@/components/ui/MicroBadge';
import { PercentageSlider } from '@/components/ui/PercentageSlider';
import { TOAST_TYPES } from '@/lib/constants';

interface DimensionFormData {
  name: string;
  displayName: string;
  requirementInstruction: string;
  offeringInstruction: string;
  weight: number;
}

const initialFormData: DimensionFormData = {
  name: '',
  displayName: '',
  requirementInstruction: '',
  offeringInstruction: '',
  weight: 1.0,
};

export function DimensionsTab({ isCreating, setIsCreating }: { isCreating: boolean, setIsCreating: (val: boolean) => void }) {
  const { dimensions, loading, addDimension, updateDimension, deleteDimension } = useDimensions();
  const { addToast } = useToast();
  const { blueprints } = useBlueprints();

  const activeBlueprint = blueprints.find(b => b.is_active);
  const activeDimensionIds = activeBlueprint?.dimensions?.map(d => d.id) || [];

  const [formData, setFormData] = useState<DimensionFormData>(initialFormData);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<DimensionFormData>(initialFormData);

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.displayName.trim()) {
      addToast(TOAST_TYPES.ERROR, 'Name and display name are required');
      return;
    }
    try {
      await addDimension(formData);
      setFormData(initialFormData);
      setIsCreating(false);
      addToast(TOAST_TYPES.SUCCESS, 'Dimension created successfully');
    } catch (err) {
      addToast(TOAST_TYPES.ERROR, 'Failed to create dimension');
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editFormData.displayName.trim()) {
      addToast(TOAST_TYPES.ERROR, 'Display name is required');
      return;
    }
    try {
      await updateDimension(id, {
        displayName: editFormData.displayName,
        requirementInstruction: editFormData.requirementInstruction,
        offeringInstruction: editFormData.offeringInstruction,
        weight: editFormData.weight,
      });
      setEditingId(null);
      setEditFormData(initialFormData);
      addToast(TOAST_TYPES.SUCCESS, 'Dimension updated successfully');
    } catch (err) {
      addToast(TOAST_TYPES.ERROR, 'Failed to update dimension');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteDimension(id);
      addToast(TOAST_TYPES.SUCCESS, 'Dimension deleted');
    } catch (err) {
      addToast(TOAST_TYPES.ERROR, 'Failed to delete dimension');
    }
  };

  const startEditing = (dimension: any) => {
    setEditingId(dimension.id);
    setEditFormData({
      name: dimension.name,
      displayName: dimension.displayName,
      requirementInstruction: dimension.requirementInstruction || '',
      offeringInstruction: dimension.offeringInstruction || '',
      weight: dimension.weight ?? 1.0,
    });
  };

  if (loading && dimensions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <DOMAIN_ICONS.LOADING className="w-8 h-8 animate-spin text-accent-sage" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CREATION FORM */}
      {isCreating && (
        <div className="p-6 bg-themed-inner border border-themed-border rounded-xl space-y-4 mb-8">
          <h3 className="text-lg font-bold text-themed-fg-main border-b border-themed-border pb-2">Create New Dimension</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FormLabel>Internal Name (Cannot be changed)</FormLabel>
              <FormInput
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. core_skills"
              />
            </div>
            <div>
              <FormLabel>Display Name</FormLabel>
              <FormInput
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="e.g. Core Skills"
              />
            </div>
          </div>
          <div>
            <FormLabel>Requirement Instruction</FormLabel>
            <FormTextarea
              value={formData.requirementInstruction}
              onChange={(e) => setFormData({ ...formData, requirementInstruction: e.target.value })}
              placeholder="Prompt instruction for extracting requirements..."
              rows={6}
              className="font-mono"
            />
          </div>
          <div>
            <FormLabel>Offering Instruction</FormLabel>
            <FormTextarea
              value={formData.offeringInstruction}
              onChange={(e) => setFormData({ ...formData, offeringInstruction: e.target.value })}
              placeholder="Prompt instruction for extracting offerings..."
              rows={6}
              className="font-mono"
            />
          </div>
          <div>
            <FormLabel>Match Weight Calculation</FormLabel>
            <PercentageSlider
              value={formData.weight}
              onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) })}
              min="0.2"
              max="3"
              step="0.1"
              displayValue={`${Math.round(formData.weight * 100)}%`}
              valueClassName="text-sm font-medium text-accent-sage"
            />
          </div>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
            <CreateButton entityName="Dimension" size="md" onClick={handleCreate} />
          </ModalFooter>
        </div>
      )}

      {/* DIMENSIONS LIST */}
      {dimensions.length === 0 ? (
        <EmptyState icon="DIMENSION" title="No dimensions" subtitle="Define extraction categories here." />
      ) : (
        <div className="space-y-6">
          {dimensions.map((dim) => {
            const isEditing = editingId === dim.id;
            const inUse = activeDimensionIds.includes(dim.id);

            return (
              <div key={dim.id} className="p-6 bg-themed-inner border border-themed-border rounded-xl">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-themed-fg-main truncate" title={dim.displayName}>{dim.displayName}</h3>
                      {inUse && (
                        <MicroBadge variant="sage">
                          In Use
                        </MicroBadge>
                      )}
                    </div>
                    <p className="text-xs text-themed-fg-muted font-mono mt-1 truncate" title={dim.name}>System key: {dim.name}</p>
                  </div>
                  {!isEditing && (
                    <div className="flex items-center gap-4">
                      <div className="text-sm font-medium text-themed-fg-muted">
                        Weight: <span className="text-accent-sage">{Math.round((dim.weight || 1.0) * 100)}%</span>
                      </div>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  /* EDIT MODE */
                  <div className="space-y-4">
                    <div>
                      <FormLabel>Display Name</FormLabel>
                      <FormInput
                        type="text"
                        value={editFormData.displayName}
                        onChange={(e) => setEditFormData({ ...editFormData, displayName: e.target.value })}
                      />
                    </div>
                    <div>
                      <FormLabel>Requirement Instruction</FormLabel>
                      <FormTextarea
                        value={editFormData.requirementInstruction}
                        onChange={(e) => setEditFormData({ ...editFormData, requirementInstruction: e.target.value })}
                        rows={8}
                        className="font-mono"
                      />
                    </div>
                    <div>
                      <FormLabel>Offering Instruction</FormLabel>
                      <FormTextarea
                        value={editFormData.offeringInstruction}
                        onChange={(e) => setEditFormData({ ...editFormData, offeringInstruction: e.target.value })}
                        rows={8}
                        className="font-mono"
                      />
                    </div>
                    <div>
                      <FormLabel>Match Weight Calculation</FormLabel>
                      <PercentageSlider
                        value={editFormData.weight}
                        onChange={(e) => setEditFormData({ ...editFormData, weight: parseFloat(e.target.value) })}
                        min="0.2"
                        max="3"
                        step="0.1"
                        displayValue={`${Math.round(editFormData.weight * 100)}%`}
                        valueClassName="text-sm font-medium text-accent-sage"
                      />
                    </div>
                    <ModalFooter>
                      <DeleteAction onDelete={() => handleDelete(dim.id)} buttonText="Delete Dimension" />
                      <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                      <SaveButton size="md" onClick={() => handleUpdate(dim.id)} saveText="Save Changes" />
                    </ModalFooter>
                  </div>
                ) : (
                  /* READ-ONLY MODE */
                  <div className="space-y-4">
                    <div>
                      <FormLabel>Requirement Instruction</FormLabel>
                      <div className="font-mono text-sm text-themed-fg-main whitespace-pre-wrap bg-themed-inner p-4 rounded-md border border-themed-border wrap-break-word">
                        {dim.requirementInstruction || <span className="text-themed-fg-muted italic">No instruction provided.</span>}
                      </div>
                    </div>
                    <div>
                      <FormLabel>Offering Instruction</FormLabel>
                      <div className="font-mono text-sm text-themed-fg-main whitespace-pre-wrap bg-themed-inner p-4 rounded-md border border-themed-border wrap-break-word">
                        {dim.offeringInstruction || <span className="text-themed-fg-muted italic">No instruction provided.</span>}
                      </div>
                    </div>
                    <div className="flex justify-end pt-4 mt-2">
                      <EditButton entityName="Dimension" onClick={() => startEditing(dim)} />
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