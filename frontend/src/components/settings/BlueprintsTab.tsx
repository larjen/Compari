'use client';

import { useBlueprints } from '@/hooks/useBlueprints';
import { useDimensions } from '@/hooks/useDimensions';
import { useToast } from '@/hooks/useToast';
import { useBlueprintForm } from '@/hooks/useBlueprintForm';
import { Layout, Loader2, Plus, Trash2, Check, FileText } from 'lucide-react';
import { EmptyState } from '@/components/shared/PageStates';
import { Button } from '@/components/ui/Button';
import { EditButton } from '@/components/ui/EditButton';
import { DeleteAction } from '@/components/ui/DeleteAction';
import { Dimension } from '@/lib/types';

export interface FieldFormData {
  fieldName: string;
  fieldType: 'string' | 'number' | 'date' | 'boolean';
  description: string;
  isRequired: boolean;
  entityRole: 'requirement' | 'offering';
}

export interface BlueprintFormData {
  name: string;
  requirementLabelSingular: string;
  requirementLabelPlural: string;
  offeringLabelSingular: string;
  offeringLabelPlural: string;
  requirementDocTypeLabel: string;
  offeringDocTypeLabel: string;
  description: string;
  fields: FieldFormData[];
  dimensionIds: number[];
  isActive: boolean;
}

const inputClass = "w-full px-3 py-2 border border-themed-input-border rounded-lg bg-themed-input-bg text-themed-fg-main focus:ring-2 focus:ring-accent-sage/50 outline-none text-sm";
const labelClass = "block text-xs font-bold text-themed-fg-muted uppercase mb-1";

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

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.requirementLabelSingular.trim() || !formData.offeringLabelSingular.trim()) {
      addToast('error', 'Name and singular labels are required');
      return;
    }

    try {
      await addBlueprint({ ...formData });
      setIsCreating(false);
      addToast('success', 'Blueprint created');
    } catch (err) {
      addToast('error', 'Failed to create blueprint');
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editFormData.name.trim() || !editFormData.requirementLabelSingular.trim() || !editFormData.offeringLabelSingular.trim()) {
      addToast('error', 'Name and singular labels are required');
      return;
    }

    try {
      await updateBlueprint(id, { ...editFormData });
      setEditingId(null);
      addToast('success', 'Blueprint updated');
    } catch (err) {
      addToast('error', 'Failed to update blueprint');
    }
  };

  const handleDelete = async (id: number) => {
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
      {/* CREATION FORM */}
      {isCreating && (
        <div className="p-6 bg-themed-inner border border-themed-border rounded-xl space-y-4 mb-8">
          <h3 className="text-lg font-bold text-themed-fg-main border-b border-themed-border pb-2">Create New Blueprint</h3>
          <BlueprintEditor
            data={formData}
            setData={setFormData}
            dimensions={dimensions}
            onAddField={() => addField(false)}
            onUpdateField={(i: number, f: any) => updateField(i, f, false)}
            onRemoveField={(i: number) => removeField(i, false)}
            onToggleDimension={(id: number) => toggleDimension(id, false)}
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-themed-border">
            <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate}>Create Blueprint</Button>
          </div>
        </div>
      )}

      {/* LIST */}
      {blueprints.length === 0 ? (
        <EmptyState icon={Layout} title="No blueprints" subtitle="Create blueprints to define entity templates." />
      ) : (
        <div className="space-y-6">
          {blueprints.map((bp) => {
            const isEditing = editingId === bp.id;
            const isActive = bp.is_active;
            const requirementFields = bp.fields?.filter(f => f.entity_role === 'requirement') || [];
            const offeringFields = bp.fields?.filter(f => f.entity_role === 'offering') || [];

            return (
              <div key={bp.id} className="p-6 bg-themed-inner border border-themed-border rounded-xl">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-themed-fg-main">{bp.name}</h3>
                      {isActive && (
                        <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold bg-accent-sage/20 text-accent-forest rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-themed-fg-muted mt-1">{bp.description || 'No description'}</p>
                  </div>
                  {!isEditing && !isActive && (
                    <Button variant="secondary" size="sm" onClick={() => handleSetActive(bp.id)}>
                      Make Active
                    </Button>
                  )}
                </div>

                {isEditing ? (
                  /* EDIT MODE */
                  <div className="space-y-4">
                    <BlueprintEditor
                      data={editFormData}
                      setData={setEditFormData}
                      dimensions={dimensions}
                      onAddField={() => addField(true)}
                      onUpdateField={(i: number, f: any) => updateField(i, f, true)}
                      onRemoveField={(i: number) => removeField(i, true)}
                      onToggleDimension={(id: number) => toggleDimension(id, true)}
                    />
                    <div className="flex justify-end items-center gap-3 pt-4 border-t border-themed-border">
                      <DeleteAction onDelete={() => handleDelete(bp.id)} buttonText="Delete Blueprint" />
                      <Button variant="ghost" onClick={cancelEditing}>Cancel</Button>
                      <Button variant="primary" onClick={() => handleUpdate(bp.id)}>Save Changes</Button>
                    </div>
                  </div>
                ) : (
                  /* READ-ONLY MODE */
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Requirement Details ({bp.requirementLabelSingular})</label>
                        <div className="font-mono text-sm text-themed-fg-main whitespace-pre-wrap bg-themed-inner p-4 rounded-md border border-themed-border">
                          {bp.requirementDocTypeLabel || <span className="text-themed-fg-muted italic">No instruction provided.</span>}
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Offering Details ({bp.offeringLabelSingular})</label>
                        <div className="font-mono text-sm text-themed-fg-main whitespace-pre-wrap bg-themed-inner p-4 rounded-md border border-themed-border">
                          {bp.offeringDocTypeLabel || <span className="text-themed-fg-muted italic">No instruction provided.</span>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-themed-inner border border-themed-input-border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="w-4 h-4 text-themed-fg-muted" />
                          <span className="text-sm font-medium text-themed-fg-muted">Requirement Fields</span>
                        </div>
                        {requirementFields.length > 0 ? (
                          <div className="space-y-1">
                            {requirementFields.map((field) => (
                              <div key={field.id} className="text-sm text-themed-fg-main flex items-center gap-2">
                                <span className="font-mono">{field.field_name}</span>
                                <span className="text-themed-fg-muted opacity-70">({field.field_type})</span>
                                {field.is_required && <span className="text-red-400 text-xs">required</span>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-themed-fg-muted opacity-70 italic">No fields defined</p>
                        )}
                      </div>

                      <div className="bg-themed-inner border border-themed-input-border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="w-4 h-4 text-themed-fg-muted" />
                          <span className="text-sm font-medium text-themed-fg-muted">Offering Fields</span>
                        </div>
                        {offeringFields.length > 0 ? (
                          <div className="space-y-1">
                            {offeringFields.map((field) => (
                              <div key={field.id} className="text-sm text-themed-fg-main flex items-center gap-2">
                                <span className="font-mono">{field.field_name}</span>
                                <span className="text-themed-fg-muted opacity-70">({field.field_type})</span>
                                {field.is_required && <span className="text-red-400 text-xs">required</span>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-themed-fg-muted opacity-70 italic">No fields defined</p>
                        )}
                      </div>
                    </div>

                    {bp.dimensions && bp.dimensions.length > 0 && (
                      <div>
                        <label className={labelClass}>AI Extraction Dimensions</label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {bp.dimensions.map((dim) => (
                            <span key={dim.id} className="px-3 py-1 text-sm rounded-full bg-themed-inner border border-themed-border text-themed-fg-main">
                              {dim.displayName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end pt-4 mt-2">
                      <EditButton entityName="Blueprint" onClick={() => startEditing(bp)} />
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

// --- INTERNAL COMPONENTS FOR DRY FORMS ---

function BlueprintEditor({ data, setData, dimensions, onAddField, onUpdateField, onRemoveField, onToggleDimension }: any) {
  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Name</label>
        <input type="text" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} placeholder="e.g., Employment Match" className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Requirement Singular</label>
          <input type="text" value={data.requirementLabelSingular} onChange={(e) => setData({ ...data, requirementLabelSingular: e.target.value })} placeholder="e.g., Job Listing" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Requirement Plural</label>
          <input type="text" value={data.requirementLabelPlural} onChange={(e) => setData({ ...data, requirementLabelPlural: e.target.value })} placeholder="e.g., Job Listings" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Offering Singular</label>
          <input type="text" value={data.offeringLabelSingular} onChange={(e) => setData({ ...data, offeringLabelSingular: e.target.value })} placeholder="e.g., Candidate" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Offering Plural</label>
          <input type="text" value={data.offeringLabelPlural} onChange={(e) => setData({ ...data, offeringLabelPlural: e.target.value })} placeholder="e.g., Candidates" className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Requirement Document Guidance</label>
          <textarea value={data.requirementDocTypeLabel} onChange={(e) => setData({ ...data, requirementDocTypeLabel: e.target.value })} placeholder="e.g., Upload a PDF of the Job Listing..." rows={3} className={`${inputClass} resize-none`} />
        </div>
        <div>
          <label className={labelClass}>Offering Document Guidance</label>
          <textarea value={data.offeringDocTypeLabel} onChange={(e) => setData({ ...data, offeringDocTypeLabel: e.target.value })} placeholder="e.g., Upload a PDF of the Resume..." rows={3} className={`${inputClass} resize-none`} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Description</label>
        <textarea value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} placeholder="Optional description..." rows={2} className={`${inputClass} resize-none`} />
      </div>

      <div>
        <label className={labelClass}>Metadata Fields</label>
        {data.fields.length > 0 && (
          <div className="space-y-2 mb-3">
            {data.fields.map((field: any, index: number) => (
              <div key={index} className="p-4 rounded-lg border bg-themed-inner border-themed-input-border">
                <div className="flex items-end gap-3 mb-3">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-themed-fg-muted uppercase mb-1">Field Name</label>
                    <input type="text" value={field.fieldName} onChange={(e) => onUpdateField(index, { ...field, fieldName: e.target.value })} placeholder="e.g., email" className={inputClass} />
                  </div>
                  <div className="w-32">
                    <label className="block text-[10px] font-bold text-themed-fg-muted uppercase mb-1">Type</label>
                    <select value={field.fieldType} onChange={(e) => onUpdateField(index, { ...field, fieldType: e.target.value })} className={inputClass}>
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="boolean">Boolean</option>
                    </select>
                  </div>
                  <div className="w-32">
                    <label className="block text-[10px] font-bold text-themed-fg-muted uppercase mb-1">Role</label>
                    <select value={field.entityRole} onChange={(e) => onUpdateField(index, { ...field, entityRole: e.target.value })} className={inputClass}>
                      <option value="requirement">Requirement</option>
                      <option value="offering">Offering</option>
                    </select>
                  </div>
                  <div className="pb-2">
                    <label className="flex items-center gap-2 text-sm text-themed-fg-muted whitespace-nowrap cursor-pointer">
                      <input type="checkbox" checked={field.isRequired} onChange={(e) => onUpdateField(index, { ...field, isRequired: e.target.checked })} className="w-4 h-4 rounded focus:ring-accent-sage border-themed-input-border text-accent-sage" />
                      Required
                    </label>
                  </div>
                  <div className="pb-2">
                    <button type="button" onClick={() => onRemoveField(index)} className="text-red-400 opacity-70 hover:opacity-100 hover:bg-red-400/10 p-1 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-themed-fg-muted uppercase mb-1">AI Extraction Instruction</label>
                  <textarea value={field.description} onChange={(e) => onUpdateField(index, { ...field, description: e.target.value })} placeholder="Prompt instruction for extracting this field..." rows={3} className={`${inputClass} resize-none font-mono`} />
                </div>
              </div>
            ))}
          </div>
        )}
        <Button variant="secondary" size="sm" onClick={onAddField}>
          <Plus className="w-4 h-4 mr-1" /> Add Field
        </Button>
      </div>

      <div>
        <label className={labelClass}>AI Extraction Dimensions</label>
        <div className="flex flex-wrap gap-2">
          {dimensions.map((dim: any) => {
            const isSelected = data.dimensionIds.includes(dim.id);
            return (
              <button
                key={dim.id}
                type="button"
                onClick={() => onToggleDimension(dim.id)}
                className={`flex items-center px-3 py-1.5 rounded-full text-sm transition-colors ${isSelected ? 'bg-accent-sage text-accent-forest' : 'bg-themed-inner text-themed-fg-muted border border-themed-border hover:bg-themed-border'
                  }`}
              >
                {isSelected && <Check className="w-3.5 h-3.5 mr-1.5" />}
                {dim.displayName}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}