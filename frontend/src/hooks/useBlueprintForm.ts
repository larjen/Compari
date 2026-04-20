'use client';

import { useState } from 'react';
import { BlueprintFormData, FieldFormData } from '@/components/settings/BlueprintsTab';
import { FIELD_TYPES, ENTITY_ROLES } from '@/lib/constants';

const initialFormData: BlueprintFormData = {
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
};

interface UseBlueprintFormReturn {
  formData: BlueprintFormData;
  setFormData: React.Dispatch<React.SetStateAction<BlueprintFormData>>;
  editingId: number | null;
  setEditingId: React.Dispatch<React.SetStateAction<number | null>>;
  editFormData: BlueprintFormData;
  setEditFormData: React.Dispatch<React.SetStateAction<BlueprintFormData>>;
  startEditing: (bp: any) => void;
  cancelEditing: () => void;
  addField: (isEditing: boolean) => void;
  updateField: (index: number, field: FieldFormData, isEditing: boolean) => void;
  removeField: (index: number, isEditing: boolean) => void;
  toggleDimension: (id: number, isEditing: boolean) => void;
}

export function useBlueprintForm() {
  const [formData, setFormData] = useState<BlueprintFormData>(initialFormData);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<BlueprintFormData>(initialFormData);

  const startEditing = (bp: any) => {
    setEditingId(bp.id);
    setEditFormData({
      name: bp.name || '',
      requirementLabelSingular: bp.requirementLabelSingular || bp.requirement_label_singular || '',
      requirementLabelPlural: bp.requirementLabelPlural || bp.requirement_label_plural || '',
      offeringLabelSingular: bp.offeringLabelSingular || bp.offering_label_singular || '',
      offeringLabelPlural: bp.offeringLabelPlural || bp.offering_label_plural || '',
      requirementDocTypeLabel: bp.requirementDocTypeLabel || bp.requirement_doc_type_label || '',
      offeringDocTypeLabel: bp.offeringDocTypeLabel || bp.offering_doc_type_label || '',
      description: bp.description || '',
      fields: bp.fields?.map((f: any) => ({
        fieldName: f.field_name || f.fieldName,
        fieldType: f.field_type || f.fieldType || FIELD_TYPES.STRING,
        description: f.description || '',
        isRequired: f.is_required || f.isRequired || false,
        entityRole: f.entity_role || f.entityRole || ENTITY_ROLES.REQUIREMENT
      })) || [],
      dimensionIds: bp.dimensions?.map((d: any) => d.id) || [],
      isActive: bp.is_active || bp.isActive || false,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditFormData(initialFormData);
  };

  const addField = (isEditing: boolean) => {
    const newField: FieldFormData = { fieldName: '', fieldType: FIELD_TYPES.STRING, description: '', isRequired: false, entityRole: ENTITY_ROLES.REQUIREMENT };
    if (isEditing) {
      setEditFormData({ ...editFormData, fields: [...editFormData.fields, newField] });
    } else {
      setFormData({ ...formData, fields: [...formData.fields, newField] });
    }
  };

  const updateField = (index: number, field: FieldFormData, isEditing: boolean) => {
    if (isEditing) {
      const newFields = [...editFormData.fields];
      newFields[index] = field;
      setEditFormData({ ...editFormData, fields: newFields });
    } else {
      const newFields = [...formData.fields];
      newFields[index] = field;
      setFormData({ ...formData, fields: newFields });
    }
  };

  const removeField = (index: number, isEditing: boolean) => {
    if (isEditing) {
      setEditFormData({ ...editFormData, fields: editFormData.fields.filter((_, i) => i !== index) });
    } else {
      setFormData({ ...formData, fields: formData.fields.filter((_, i) => i !== index) });
    }
  };

  const toggleDimension = (id: number, isEditing: boolean) => {
    if (isEditing) {
      const newIds = editFormData.dimensionIds.includes(id)
        ? editFormData.dimensionIds.filter(dId => dId !== id)
        : [...editFormData.dimensionIds, id];
      setEditFormData({ ...editFormData, dimensionIds: newIds });
    } else {
      const newIds = formData.dimensionIds.includes(id)
        ? formData.dimensionIds.filter(dId => dId !== id)
        : [...formData.dimensionIds, id];
      setFormData({ ...formData, dimensionIds: newIds });
    }
  };

  return {
    formData, setFormData,
    editingId, setEditingId,
    editFormData, setEditFormData,
    startEditing, cancelEditing,
    addField, updateField, removeField, toggleDimension
  };
}