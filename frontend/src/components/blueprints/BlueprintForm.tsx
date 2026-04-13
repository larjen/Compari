'use client';

import { motion } from 'framer-motion';
import { Plus, Trash2, Check } from 'lucide-react';
import { Button, FormActions } from '@/components/ui';
import { Dimension } from '@/lib/types';
import { getThemeClasses } from '@/lib/utils';

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

export const initialFieldForm: FieldFormData = {
    fieldName: '',
    fieldType: 'string',
    description: '',
    isRequired: false,
    entityRole: 'requirement',
};

export const initialFormData: BlueprintFormData = {
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

export interface BlueprintFormProps {
    title: string;
    submitLabel: string;
    formData: BlueprintFormData;
    setFormData: (data: BlueprintFormData) => void;
    dimensions: Dimension[];
    onSubmit: () => void;
    onCancel: () => void;
    onAddField: () => void;
    onUpdateField: (index: number, field: FieldFormData) => void;
    onRemoveField: (index: number) => void;
    onToggleDimension: (dimensionId: number) => void;
}

export function BlueprintForm({
    title,
    submitLabel,
    formData,
    setFormData,
    dimensions,
    onSubmit,
    onCancel,
    onAddField,
    onUpdateField,
    onRemoveField,
    onToggleDimension,
}: BlueprintFormProps) {
    const isDark = formData.isActive;
    const theme = getThemeClasses(isDark);
    const labelClass = `block text-sm font-medium mb-1 ${theme.textMuted}`;
    const inputClass = `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${theme.input}`;

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className={`mb-8 rounded-xl border p-6 ${theme.cardBg}`}
        >
            <h2 className={`text-xl font-semibold mb-4 ${theme.textMain}`}>{title}</h2>
            <div className="space-y-4">
                <div>
                    <label className={labelClass}>Name</label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Employment Match"
                        className={inputClass}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>Requirement Singular</label>
                        <input
                            type="text"
                            value={formData.requirementLabelSingular}
                            onChange={(e) => setFormData({ ...formData, requirementLabelSingular: e.target.value })}
                            placeholder="e.g., Job Listing"
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Requirement Plural</label>
                        <input
                            type="text"
                            value={formData.requirementLabelPlural}
                            onChange={(e) => setFormData({ ...formData, requirementLabelPlural: e.target.value })}
                            placeholder="e.g., Job Listings"
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Offering Singular</label>
                        <input
                            type="text"
                            value={formData.offeringLabelSingular}
                            onChange={(e) => setFormData({ ...formData, offeringLabelSingular: e.target.value })}
                            placeholder="e.g., Candidate"
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Offering Plural</label>
                        <input
                            type="text"
                            value={formData.offeringLabelPlural}
                            onChange={(e) => setFormData({ ...formData, offeringLabelPlural: e.target.value })}
                            placeholder="e.g., Candidates"
                            className={inputClass}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>Requirement Document Guidance</label>
                        <textarea
                            value={formData.requirementDocTypeLabel}
                            onChange={(e) => setFormData({ ...formData, requirementDocTypeLabel: e.target.value })}
                            placeholder="e.g., Upload a PDF of the Job Listing..."
                            rows={2}
                            className={`${inputClass} resize-none`}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Offering Document Guidance</label>
                        <textarea
                            value={formData.offeringDocTypeLabel}
                            onChange={(e) => setFormData({ ...formData, offeringDocTypeLabel: e.target.value })}
                            placeholder="e.g., Upload a PDF of the Resume..."
                            rows={2}
                            className={`${inputClass} resize-none`}
                        />
                    </div>
                </div>

                <div>
                    <label className={labelClass}>Description</label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Optional description..."
                        rows={2}
                        className={`${inputClass} resize-none`}
                    />
                </div>

                <div>
                    <label className={`${labelClass} mb-2`}>Metadata Fields</label>

                    {formData.fields.length > 0 && (
                        <div className="space-y-2 mb-3">
                            {formData.fields.map((field, index) => (
                                <FieldRow
                                    key={index}
                                    field={field}
                                    isDark={isDark}
                                    onUpdate={(f) => onUpdateField(index, f)}
                                    onRemove={() => onRemoveField(index)}
                                />
                            ))}
                        </div>
                    )}

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onAddField}
                        className={isDark ? 'text-white/70 hover:text-white hover:bg-white/10' : ''}
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Field
                    </Button>
                </div>

                <div>
                    <label className={`${labelClass} mb-2`}>AI Extraction Dimensions</label>
                    <div className="flex flex-wrap gap-2">
                        {dimensions.map((dim) => {
                            const isSelected = formData.dimensionIds.includes(dim.id);
                            let btnClass = '';
                            if (isDark) {
                                btnClass = isSelected ? 'bg-white text-accent-forest' : 'bg-white/10 text-white/70 hover:bg-white/20';
                            } else {
                                btnClass = isSelected ? 'bg-accent-sage text-white' : 'bg-gray-100 text-accent-forest/70 hover:bg-gray-200';
                            }

                            return (
                                <button
                                    key={dim.id}
                                    type="button"
                                    onClick={() => onToggleDimension(dim.id)}
                                    className={`flex items-center px-3 py-1.5 rounded-full text-sm transition-colors ${btnClass}`}
                                >
                                    {isSelected && <Check className="w-3.5 h-3.5 mr-1.5" />}
                                    {dim.displayName}
                                </button>
                            );
                        })}
                        {dimensions.length === 0 && (
                            <p className={`text-sm ${isDark ? 'text-white/50' : 'text-accent-forest/50'}`}>No dimensions available. Create dimensions first.</p>
                        )}
                    </div>
                </div>

                <div className="pt-2">
                    <FormActions
                        onCancel={onCancel}
                        onSave={onSubmit}
                        saveText={submitLabel}
                        className={isDark ? '[&_button:first-child]:text-white/70 [&_button:first-child]:hover:text-white [&_button:first-child]:hover:bg-white/10 [&_button:last-child]:bg-white [&_button:last-child]:text-accent-forest [&_button:last-child]:hover:bg-white/90' : ''}
                    />
                </div>
            </div>
        </motion.div>
    );
}

export interface FieldRowProps {
    field: FieldFormData;
    isDark?: boolean;
    onUpdate: (field: FieldFormData) => void;
    onRemove: () => void;
}

export function FieldRow({ field, isDark, onUpdate, onRemove }: FieldRowProps) {
    const theme = getThemeClasses(!!isDark);
    const inputClass = `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${theme.input}`;

    const selectClass = `px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${isDark
            ? 'bg-accent-forest border-white/20 text-white focus:ring-white/30'
            : 'bg-white border-border-light text-accent-forest focus:ring-accent-sage/50'
        }`;

    const containerClass = `p-4 rounded-lg border ${theme.innerBox}`;

    const trashClass = isDark
        ? 'p-2 text-red-400 hover:text-red-300 hover:bg-white/10 rounded-lg transition-colors'
        : 'p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors';

    return (
        <div className={containerClass}>
            <div className="flex items-center gap-3 mb-3">
                <div className="flex-1">
                    <input
                        type="text"
                        value={field.fieldName}
                        onChange={(e) => onUpdate({ ...field, fieldName: e.target.value })}
                        placeholder="Field name (e.g., email, phone, skills)"
                        className={inputClass}
                    />
                </div>
                <select
                    value={field.fieldType}
                    onChange={(e) => onUpdate({ ...field, fieldType: e.target.value as FieldFormData['fieldType'] })}
                    className={selectClass}
                >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="boolean">Boolean</option>
                </select>
                <select
                    value={field.entityRole}
                    onChange={(e) => onUpdate({ ...field, entityRole: e.target.value as 'requirement' | 'offering' })}
                    className={selectClass}
                >
                    <option value="requirement">Requirement</option>
                    <option value="offering">Offering</option>
                </select>
                <label className={`flex items-center gap-2 text-sm ${theme.textMuted} whitespace-nowrap`}>
                    <input
                        type="checkbox"
                        checked={field.isRequired}
                        onChange={(e) => onUpdate({ ...field, isRequired: e.target.checked })}
                        className={`w-4 h-4 rounded focus:ring-accent-sage ${isDark ? 'border-white/30 bg-white/10 text-accent-sage' : 'border-border-light text-accent-sage'}`}
                    />
                    Required
                </label>
                <button
                    type="button"
                    onClick={onRemove}
                    className={trashClass}
                    title="Remove field"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
            <div>
                <label className={`block text-xs font-medium ${theme.textMuted} mb-1`}>
                    AI Extraction Instruction
                </label>
                <textarea
                    value={field.description}
                    onChange={(e) => onUpdate({ ...field, description: e.target.value })}
                    placeholder="Enter the prompt instruction that will be sent to the LLM for extracting this field. Be specific about what to extract and in what format."
                    rows={3}
                    className={`${inputClass} resize-none font-mono`}
                />
                <p className={`text-xs ${theme.textDim} mt-1`}>
                    This instruction is sent directly to the LLM. Be specific about what data to extract.
                </p>
            </div>
        </div>
    );
}