'use client';

import { useState } from 'react';
import { useDimensions } from '@/hooks/useDimensions';
import { useBlueprints } from '@/hooks/useBlueprints';
import { useToast } from '@/hooks/useToast';
import { Target, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/shared/PageStates';
import { Button } from '@/components/ui/Button';
import { EditButton } from '@/components/ui/EditButton';
import { DeleteAction } from '@/components/ui/DeleteAction';

export interface DimensionFormData {
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
      addToast('error', 'Name and display name are required');
      return;
    }
    try {
      await addDimension(formData);
      setFormData(initialFormData);
      setIsCreating(false);
      addToast('success', 'Dimension created successfully');
    } catch (err) {
      addToast('error', 'Failed to create dimension');
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editFormData.displayName.trim()) {
      addToast('error', 'Display name is required');
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
      addToast('success', 'Dimension updated successfully');
    } catch (err) {
      addToast('error', 'Failed to update dimension');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteDimension(id);
      addToast('success', 'Dimension deleted');
    } catch (err) {
      addToast('error', 'Failed to delete dimension');
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
        <Loader2 className="w-8 h-8 animate-spin text-accent-sage" />
      </div>
    );
  }

  const inputClass = "w-full px-3 py-2 border border-themed-input-border rounded-lg bg-themed-input-bg text-themed-fg-main focus:ring-2 focus:ring-accent-sage/50 outline-none text-sm";
  const labelClass = "block text-xs font-bold text-themed-fg-muted uppercase mb-1";

  return (
    <div className="space-y-6">
      {/* CREATION FORM */}
      {isCreating && (
        <div className="p-6 bg-themed-inner border border-themed-border rounded-xl space-y-4 mb-8">
          <h3 className="text-lg font-bold text-themed-fg-main border-b border-themed-border pb-2">Create New Dimension</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Internal Name (Cannot be changed)</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. core_skills"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Display Name</label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="e.g. Core Skills"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Requirement Instruction</label>
            <textarea
              value={formData.requirementInstruction}
              onChange={(e) => setFormData({ ...formData, requirementInstruction: e.target.value })}
              placeholder="Prompt instruction for extracting requirements..."
              rows={6}
              className={`${inputClass} font-mono`}
            />
          </div>
          <div>
            <label className={labelClass}>Offering Instruction</label>
            <textarea
              value={formData.offeringInstruction}
              onChange={(e) => setFormData({ ...formData, offeringInstruction: e.target.value })}
              placeholder="Prompt instruction for extracting offerings..."
              rows={6}
              className={`${inputClass} font-mono`}
            />
          </div>
          <div>
            <label className={labelClass}>Match Weight Calculation</label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <input
                  type="range"
                  min="0.2"
                  max="3"
                  step="0.1"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-themed-border rounded-lg appearance-none cursor-pointer accent-accent-sage"
                />
              </div>
              <span className="text-sm font-medium text-accent-sage min-w-[50px] text-right">
                {Math.round(formData.weight * 100)}%
              </span>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-themed-border">
            <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate}>Create Dimension</Button>
          </div>
        </div>
      )}

      {/* DIMENSIONS LIST */}
      {dimensions.length === 0 ? (
        <EmptyState icon={Target} title="No dimensions" subtitle="Define extraction categories here." />
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
                      <h3 className="text-lg font-bold text-themed-fg-main">{dim.displayName}</h3>
                      {inUse && (
                        <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold bg-accent-sage/20 text-accent-forest rounded-full">
                          In Use
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-themed-fg-muted font-mono mt-1">System key: {dim.name}</p>
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
                      <label className={labelClass}>Display Name</label>
                      <input
                        type="text"
                        value={editFormData.displayName}
                        onChange={(e) => setEditFormData({ ...editFormData, displayName: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Requirement Instruction</label>
                      <textarea
                        value={editFormData.requirementInstruction}
                        onChange={(e) => setEditFormData({ ...editFormData, requirementInstruction: e.target.value })}
                        rows={8}
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Offering Instruction</label>
                      <textarea
                        value={editFormData.offeringInstruction}
                        onChange={(e) => setEditFormData({ ...editFormData, offeringInstruction: e.target.value })}
                        rows={8}
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Match Weight Calculation</label>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <input
                            type="range"
                            min="0.2"
                            max="3"
                            step="0.1"
                            value={editFormData.weight}
                            onChange={(e) => setEditFormData({ ...editFormData, weight: parseFloat(e.target.value) })}
                            className="w-full h-2 bg-themed-border rounded-lg appearance-none cursor-pointer accent-accent-sage"
                          />
                        </div>
                        <span className="text-sm font-medium text-accent-sage min-w-[50px] text-right">
                          {Math.round(editFormData.weight * 100)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-end items-center gap-3 pt-4 border-t border-themed-border">
                      <DeleteAction onDelete={() => handleDelete(dim.id)} buttonText="Delete Dimension" />
                      <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button variant="primary" onClick={() => handleUpdate(dim.id)}>Save Changes</Button>
                    </div>
                  </div>
                ) : (
                  /* READ-ONLY MODE */
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass}>Requirement Instruction</label>
                      <div className="font-mono text-sm text-themed-fg-main whitespace-pre-wrap bg-themed-inner p-4 rounded-md border border-themed-border">
                        {dim.requirementInstruction || <span className="text-themed-fg-muted italic">No instruction provided.</span>}
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Offering Instruction</label>
                      <div className="font-mono text-sm text-themed-fg-main whitespace-pre-wrap bg-themed-inner p-4 rounded-md border border-themed-border">
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