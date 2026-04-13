'use client';

import { motion } from 'framer-motion';
import { useBlueprints } from '@/hooks/useBlueprints';
import { useDimensions } from '@/hooks/useDimensions';
import { useToast } from '@/hooks/useToast';
import { Layout, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/shared/PageStates';
import { BlueprintForm, initialFormData } from '@/components/blueprints/BlueprintForm';
import { BlueprintCard } from '@/components/blueprints/BlueprintCard';
import { useBlueprintForm } from '@/hooks/useBlueprintForm';

export function BlueprintsTab({ isCreating, setIsCreating }: { isCreating: boolean, setIsCreating: (val: boolean) => void }) {
  const { blueprints, loading: loadingBlueprints, addBlueprint, updateBlueprint, deleteBlueprint, setActiveBlueprint } = useBlueprints();
  const { dimensions, loading: loadingDimensions } = useDimensions();
  const { addToast } = useToast();

  const {
    formData, setFormData,
    editingId, setEditingId,
    editFormData, setEditFormData,
    startEditing, cancelEditing,
    addField, updateField, removeField, toggleDimension
  } = useBlueprintForm();

  const handleSetIsCreating = (val: boolean) => {
    if (val) {
      setFormData({
        name: '',
        requirementLabelSingular: '',
        requirementLabelPlural: '',
        offeringLabelSingular: '',
        offeringLabelPlural: '',
        requirementDocTypeLabel: '',
        offeringDocTypeLabel: '',
        description: '',
        fields: [],
        dimensionIds: [],
        isActive: false,
      });
    }
    setIsCreating(val);
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.requirementLabelSingular.trim() || !formData.requirementLabelPlural.trim() || !formData.offeringLabelSingular.trim() || !formData.offeringLabelPlural.trim()) {
      addToast('error', 'Name and all four labels (singular/plural) are required');
      return;
    }

    try {
      await addBlueprint({
        name: formData.name,
        requirementLabelSingular: formData.requirementLabelSingular,
        requirementLabelPlural: formData.requirementLabelPlural,
        offeringLabelSingular: formData.offeringLabelSingular,
        offeringLabelPlural: formData.offeringLabelPlural,
        requirementDocTypeLabel: formData.requirementDocTypeLabel,
        offeringDocTypeLabel: formData.offeringDocTypeLabel,
        description: formData.description,
        fields: formData.fields.map(f => ({
          fieldName: f.fieldName,
          fieldType: f.fieldType,
          description: f.description,
          isRequired: f.isRequired,
          entityRole: f.entityRole,
        })),
        dimensionIds: formData.dimensionIds,
      });
      setFormData(initialFormData);
      setIsCreating(false);
      addToast('success', 'Blueprint created');
    } catch (err) {
      addToast('error', 'Failed to create blueprint');
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editFormData.name.trim() || !editFormData.requirementLabelSingular.trim() || !editFormData.requirementLabelPlural.trim() || !editFormData.offeringLabelSingular.trim() || !editFormData.offeringLabelPlural.trim()) {
      addToast('error', 'Name and all four labels (singular/plural) are required');
      return;
    }

    try {
      await updateBlueprint(id, {
        name: editFormData.name,
        requirementLabelSingular: editFormData.requirementLabelSingular,
        requirementLabelPlural: editFormData.requirementLabelPlural,
        offeringLabelSingular: editFormData.offeringLabelSingular,
        offeringLabelPlural: editFormData.offeringLabelPlural,
        requirementDocTypeLabel: editFormData.requirementDocTypeLabel,
        offeringDocTypeLabel: editFormData.offeringDocTypeLabel,
        description: editFormData.description,
        isActive: editFormData.isActive,
        fields: editFormData.fields.map(f => ({
          fieldName: f.fieldName,
          fieldType: f.fieldType,
          description: f.description,
          isRequired: f.isRequired,
          entityRole: f.entityRole,
        })),
        dimensionIds: editFormData.dimensionIds,
      });
      setEditingId(null);
      setEditFormData(initialFormData);
      addToast('success', 'Blueprint updated');
    } catch (err) {
      addToast('error', 'Failed to update blueprint');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this blueprint?')) return;
    try {
      await deleteBlueprint(id);
      addToast('success', 'Blueprint deleted');
    } catch (err) {
      addToast('error', 'Failed to delete blueprint');
    }
  };

  const handleSetActive = async (id: number) => {
    try {
      await setActiveBlueprint(id);
      addToast('success', 'Blueprint set as active');
    } catch (err) {
      addToast('error', 'Failed to set active blueprint');
    }
  };

  if (loadingBlueprints || loadingDimensions) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent-sage" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isCreating && (
        <BlueprintForm
          title="New Blueprint"
          submitLabel="Create"
          formData={formData}
          setFormData={setFormData}
          dimensions={dimensions}
          onSubmit={handleCreate}
          onCancel={() => setIsCreating(false)}
          onAddField={() => addField(false)}
          onUpdateField={(i, f) => updateField(i, f, false)}
          onRemoveField={(i) => removeField(i, false)}
          onToggleDimension={(id) => toggleDimension(id, false)}
        />
      )}

      {blueprints.length === 0 ? (
        <EmptyState icon={Layout} title="No blueprints" subtitle="Create blueprints to define entity templates." />
      ) : (
        <div className="space-y-4">
          {blueprints.map((bp) => (
            <BlueprintCard
              key={bp.id}
              blueprint={bp}
              dimensions={dimensions}
              isEditing={editingId === bp.id}
              editFormData={editFormData}
              setEditFormData={setEditFormData}
              onStartEdit={startEditing}
              onCancelEdit={cancelEditing}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onSetActive={handleSetActive}
              onAddField={() => addField(true)}
              onUpdateField={(i, f) => updateField(i, f, true)}
              onRemoveField={(i) => removeField(i, true)}
              onToggleDimension={(id) => toggleDimension(id, true)}
            />
          ))}
        </div>
      )}
    </div>
  );
}