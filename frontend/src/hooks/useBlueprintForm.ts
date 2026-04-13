/**
 * @fileoverview Custom hook for managing Blueprint form state with complex nested mutations.
 * @description This hook isolates complex nested form state mutations away from the presentation layer to enforce Separation of Concerns (SoC). It centralizes the logic for managing create/edit form data, editing state, and field/dimension manipulation.
 * @responsibility
 * - Manages form state for both create and edit modes.
 * - Provides mutation functions for fields (add, update, remove).
 * - Handles dimension toggle logic.
 * - Manages editing mode state transitions.
 * @boundary_rules
 * - ❌ MUST NOT contain UI components.
 * - ❌ MUST NOT contain validation logic (validation should be in the presentation layer or a separate utility).
 * - ❌ MUST NOT directly call API functions (API calls should use useBlueprints hook).
 * @example
 * const {
 *   formData, setFormData,
 *   isCreating, setIsCreating,
 *   editingId, setEditingId,
 *   editFormData, setEditFormData,
 *   startEditing, cancelEditing,
 *   addField, updateField, removeField, toggleDimension
 * } = useBlueprintForm();
 */
'use client';

import { useState } from 'react';
import { Blueprint } from '@/lib/types';
import {
  BlueprintFormData,
  FieldFormData,
  initialFormData,
  initialFieldForm
} from '@/components/blueprints/BlueprintForm';

export interface UseBlueprintFormReturn {
  formData: BlueprintFormData;
  setFormData: React.Dispatch<React.SetStateAction<BlueprintFormData>>;
  isCreating: boolean;
  setIsCreating: React.Dispatch<React.SetStateAction<boolean>>;
  editingId: number | null;
  setEditingId: React.Dispatch<React.SetStateAction<number | null>>;
  editFormData: BlueprintFormData;
  setEditFormData: React.Dispatch<React.SetStateAction<BlueprintFormData>>;
  startEditing: (blueprint: Blueprint) => void;
  cancelEditing: () => void;
  addField: (isEdit: boolean) => void;
  updateField: (index: number, field: FieldFormData, isEdit: boolean) => void;
  removeField: (index: number, isEdit: boolean) => void;
  toggleDimension: (dimensionId: number, isEdit: boolean) => void;
}

export function useBlueprintForm(): UseBlueprintFormReturn {
  const [formData, setFormData] = useState<BlueprintFormData>(initialFormData);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<BlueprintFormData>(initialFormData);

  const startEditing = (blueprint: Blueprint) => {
    setEditingId(blueprint.id);
    setEditFormData({
      name: blueprint.name,
      requirementLabelSingular: blueprint.requirementLabelSingular,
      requirementLabelPlural: blueprint.requirementLabelPlural,
      offeringLabelSingular: blueprint.offeringLabelSingular,
      offeringLabelPlural: blueprint.offeringLabelPlural,
      requirementDocTypeLabel: blueprint.requirementDocTypeLabel || '',
      offeringDocTypeLabel: blueprint.offeringDocTypeLabel || '',
      description: blueprint.description || '',
      fields: blueprint.fields?.map(f => ({
        fieldName: f.field_name,
        fieldType: f.field_type as 'string' | 'number' | 'date' | 'boolean',
        description: f.description,
        isRequired: f.is_required,
        entityRole: f.entity_role,
      })) || [],
      dimensionIds: blueprint.dimensions?.map(d => d.id) || [],
      isActive: blueprint.is_active,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditFormData(initialFormData);
  };

  const addField = (isEdit: boolean) => {
    const data = isEdit ? editFormData : formData;
    const setData = isEdit ? setEditFormData : setFormData;
    setData({
      ...data,
      fields: [...data.fields, { ...initialFieldForm }],
    });
  };

  const updateField = (index: number, field: FieldFormData, isEdit: boolean) => {
    const data = isEdit ? editFormData : formData;
    const setData = isEdit ? setEditFormData : setFormData;
    const newFields = [...data.fields];
    newFields[index] = field;
    setData({ ...data, fields: newFields });
  };

  const removeField = (index: number, isEdit: boolean) => {
    const data = isEdit ? editFormData : formData;
    const setData = isEdit ? setEditFormData : setFormData;
    setData({
      ...data,
      fields: data.fields.filter((_, i) => i !== index),
    });
  };

  const toggleDimension = (dimensionId: number, isEdit: boolean) => {
    const data = isEdit ? editFormData : formData;
    const setData = isEdit ? setEditFormData : setFormData;
    const newIds = data.dimensionIds.includes(dimensionId)
      ? data.dimensionIds.filter(id => id !== dimensionId)
      : [...data.dimensionIds, dimensionId];
    setData({ ...data, dimensionIds: newIds });
  };

  return {
    formData,
    setFormData,
    isCreating,
    setIsCreating,
    editingId,
    setEditingId,
    editFormData,
    setEditFormData,
    startEditing,
    cancelEditing,
    addField,
    updateField,
    removeField,
    toggleDimension,
  };
}