'use client';

import { motion } from 'framer-motion';
import { Edit2, Trash2, Layout, FileText } from 'lucide-react';
import { Button } from '@/components/ui';
import { Blueprint, Dimension } from '@/lib/types';
import { BlueprintForm, BlueprintFormData, FieldFormData } from './BlueprintForm';
import { getThemeClasses } from '@/lib/utils';

export interface BlueprintCardProps {
    blueprint: Blueprint;
    dimensions: Dimension[];
    isEditing: boolean;
    editFormData: BlueprintFormData;
    setEditFormData: (data: BlueprintFormData) => void;
    onStartEdit: (b: Blueprint) => void;
    onCancelEdit: () => void;
    onUpdate: (id: number) => void;
    onDelete: (id: number) => void;
    onSetActive: (id: number) => void;
    onAddField: () => void;
    onUpdateField: (index: number, field: FieldFormData) => void;
    onRemoveField: (index: number) => void;
    onToggleDimension: (dimensionId: number) => void;
}

export function BlueprintCard({
    blueprint,
    dimensions,
    isEditing,
    editFormData,
    setEditFormData,
    onStartEdit,
    onCancelEdit,
    onUpdate,
    onDelete,
    onSetActive,
    onAddField,
    onUpdateField,
    onRemoveField,
    onToggleDimension,
}: BlueprintCardProps) {
    if (isEditing) {
        return (
            <BlueprintForm
                title="Edit Blueprint"
                submitLabel="Save Blueprint"
                formData={editFormData}
                setFormData={setEditFormData}
                dimensions={dimensions}
                onSubmit={() => onUpdate(blueprint.id)}
                onCancel={onCancelEdit}
                onAddField={onAddField}
                onUpdateField={onUpdateField}
                onRemoveField={onRemoveField}
                onToggleDimension={onToggleDimension}
            />
        );
    }

    const requirementFields = blueprint.fields?.filter(f => f.entity_role === 'requirement') || [];
    const offeringFields = blueprint.fields?.filter(f => f.entity_role === 'offering') || [];

    const isActive = blueprint.is_active;
    const theme = getThemeClasses(isActive);
    const cardBg = isActive ? theme.cardBg : `${theme.cardBg} opacity-60`;
    const labelBg = isActive ? 'bg-white/20 text-white' : 'bg-accent-sage/20 text-accent-forest';
    const fieldSectionBg = isActive ? 'bg-white/10' : 'bg-accent-sage/10';
    const iconColor = isActive ? 'text-white/70 hover:text-white' : 'text-accent-forest/70 hover:text-accent-forest';
    const iconDanger = isActive ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-600';
    const borderColor = isActive ? 'border-white/20' : 'border-border-light';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${cardBg} rounded-xl border p-6 transition-colors`}
        >
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className={`text-lg font-semibold ${theme.textMain}`}>{blueprint.name}</h3>
                    <p className={`text-sm ${theme.textMuted}`}>{blueprint.description || 'No description'}</p>
                    <div className="flex items-center gap-3 mt-2">
                        <span className={`text-sm px-2 py-0.5 rounded ${labelBg}`}>
                            Requirement: {blueprint.requirementLabelSingular} (Plural: {blueprint.requirementLabelPlural})
                        </span>
                        <span className={`text-sm px-2 py-0.5 rounded ${labelBg}`}>
                            Offering: {blueprint.offeringLabelSingular} (Plural: {blueprint.offeringLabelPlural})
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!isActive && (
                        <Button variant="secondary" size="sm" onClick={() => onSetActive(blueprint.id)}>
                            Make Active
                        </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => onStartEdit(blueprint)} className={theme.iconButton}>
                        <Edit2 className="w-4 h-4" />
                    </Button>
                    {!isActive && (
                        <Button variant="ghost" size="sm" onClick={() => onDelete(blueprint.id)} className={iconDanger}>
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div className={`${fieldSectionBg} rounded-lg p-4`}>
                    <div className="flex items-center gap-2 mb-3">
                        <FileText className={`w-4 h-4 ${theme.textMuted}`} />
                        <span className={`text-sm font-medium ${theme.textMuted}`}>Requirement Fields ({blueprint.requirementLabelSingular})</span>
                    </div>
                    {requirementFields.length > 0 ? (
                        <div className="space-y-1">
                            {requirementFields.map((field) => (
                                <div key={field.id} className={`text-sm ${theme.textMain} flex items-center gap-2`}>
                                    <span className="font-mono">{field.field_name}</span>
                                    <span className={theme.textDim}>({field.field_type})</span>
                                    {field.is_required && <span className="text-red-400 text-xs">required</span>}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className={`text-sm ${theme.textDim} italic`}>No fields defined</p>
                    )}
                </div>

                <div className={`${fieldSectionBg} rounded-lg p-4`}>
                    <div className="flex items-center gap-2 mb-3">
                        <FileText className={`w-4 h-4 ${theme.textMuted}`} />
                        <span className={`text-sm font-medium ${theme.textMuted}`}>Offering Fields ({blueprint.offeringLabelSingular})</span>
                    </div>
                    {offeringFields.length > 0 ? (
                        <div className="space-y-1">
                            {offeringFields.map((field) => (
                                <div key={field.id} className={`text-sm ${theme.textMain} flex items-center gap-2`}>
                                    <span className="font-mono">{field.field_name}</span>
                                    <span className={theme.textDim}>({field.field_type})</span>
                                    {field.is_required && <span className="text-red-400 text-xs">required</span>}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className={`text-sm ${theme.textDim} italic`}>No fields defined</p>
                    )}
                </div>
            </div>

            {blueprint.dimensions && blueprint.dimensions.length > 0 && (
                <div className={`mt-4 pt-4 border-t ${borderColor}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <Layout className={`w-4 h-4 ${theme.textMuted}`} />
                        <span className={`text-sm font-medium ${theme.textMuted}`}>AI Extraction Dimensions</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {blueprint.dimensions.map((dim) => (
                            <span key={dim.id} className={`px-2 py-1 text-sm rounded-full ${labelBg}`}>
                                {dim.displayName}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </motion.div>
    );
}