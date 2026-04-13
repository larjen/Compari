'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useDimensions } from '@/hooks/useDimensions';
import { useBlueprints } from '@/hooks/useBlueprints';
import { useToast } from '@/hooks/useToast';
import { DimensionCard, DimensionFormData } from '@/components/dimensions/DimensionCard';
import { FormActions } from '@/components/ui';
import { Target, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/shared/PageStates';

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
    if (!editFormData.name.trim() || !editFormData.displayName.trim()) {
      addToast('error', 'Name and display name are required');
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
    if (!confirm('Are you sure you want to delete this dimension?')) return;
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
      requirementInstruction: dimension.requirementInstruction,
      offeringInstruction: dimension.offeringInstruction,
      weight: dimension.weight ?? 1.0,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditFormData(initialFormData);
  };

  if (loading && dimensions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent-sage" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isCreating && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-accent-sand/5 border border-border-light rounded-xl space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-accent-forest/50 uppercase mb-1">Internal Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. core_skills"
                className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-accent-sage/50 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-accent-forest/50 uppercase mb-1">Display Name</label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="e.g. Core Skills"
                className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-accent-sage/50 outline-none text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-accent-forest/50 uppercase mb-1">Requirement Instruction</label>
            <textarea
              value={formData.requirementInstruction}
              onChange={(e) => setFormData({ ...formData, requirementInstruction: e.target.value })}
              placeholder="e.g. Extract the key skills and competencies..."
              rows={4}
              className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-accent-sage/50 outline-none resize-none font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-accent-forest/50 uppercase mb-1">Offering Instruction</label>
            <textarea
              value={formData.offeringInstruction}
              onChange={(e) => setFormData({ ...formData, offeringInstruction: e.target.value })}
              placeholder="e.g. Extract the required skills and qualifications..."
              rows={4}
              className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-accent-sage/50 outline-none resize-none font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-accent-forest/50 uppercase mb-1">Weight</label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <input
                  type="range"
                  min="0.2"
                  max="3"
                  step="0.1"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-accent-forest/20 rounded-lg appearance-none cursor-pointer accent-accent-sage"
                />
              </div>
              <span className="text-sm font-medium text-accent-sage min-w-[50px] text-right">
                {Math.round(formData.weight * 100)}%
              </span>
            </div>
          </div>
          <FormActions onCancel={() => setIsCreating(false)} onSave={handleCreate} saveText="Create" />
        </motion.div>
      )}

      {dimensions.length === 0 ? (
        <EmptyState icon={Target} title="No dimensions" subtitle="Define extraction categories here." />
      ) : (
        <div className="space-y-4">
          {dimensions.map((dim) => (
            <DimensionCard
              key={dim.id}
              dimension={dim}
              isEditing={editingId === dim.id}
              editFormData={editFormData}
              inUse={activeDimensionIds.includes(dim.id)}
              onStartEdit={startEditing}
              onCancelEdit={cancelEditing}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onEditFormChange={setEditFormData}
            />
          ))}
        </div>
      )}
    </div>
  );
}