import { motion } from 'framer-motion';
import { Trash2, Edit2, FileText, Target } from 'lucide-react';
import { Dimension } from '@/lib/types';
import { Button, Input, FormActions, DeleteAction } from '@/components/ui';
import { getThemeClasses } from '@/lib/utils';

export interface DimensionFormData {
  name: string;
  displayName: string;
  requirementInstruction: string;
  offeringInstruction: string;
  weight: number;
}

export interface DimensionCardProps {
  dimension: Dimension;
  isEditing: boolean;
  editFormData: DimensionFormData;
  inUse: boolean;
  onStartEdit: (d: Dimension) => void;
  onCancelEdit: () => void;
  onUpdate: (id: number) => void;
  onDelete: (id: number) => void;
  onEditFormChange: (data: DimensionFormData) => void;
}

export function DimensionCard({
  dimension,
  isEditing,
  editFormData,
  inUse,
  onStartEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
  onEditFormChange,
}: DimensionCardProps) {
  const isDark = inUse;
  const theme = getThemeClasses(isDark);
  const cardBg = isDark ? theme.cardBg : `${theme.cardBg} opacity-60`;
  const variant = isDark ? 'inverted' : 'default';
  const textareaClass = `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 resize-none font-mono text-sm ${theme.input}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-6 ${cardBg}`}
    >
      {isEditing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Internal Name"
              id="internal-name"
              type="text"
              value={editFormData.name}
              disabled
              variant={variant}
            />
            <Input
              label="Display Name"
              id="display-name"
              type="text"
              value={editFormData.displayName}
              onChange={(e) => onEditFormChange({ ...editFormData, displayName: e.target.value })}
              variant={variant}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium ${theme.textMuted} mb-1`}>Requirement Instruction</label>
            <textarea
              value={editFormData.requirementInstruction}
              onChange={(e) => onEditFormChange({ ...editFormData, requirementInstruction: e.target.value })}
              rows={4}
              className={textareaClass}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium ${theme.textMuted} mb-1`}>Offering Instruction</label>
            <textarea
              value={editFormData.offeringInstruction}
              onChange={(e) => onEditFormChange({ ...editFormData, offeringInstruction: e.target.value })}
              rows={4}
              className={textareaClass}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium ${theme.textMuted} mb-1`}>Weight</label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <input
                  type="range"
                  min="0.2"
                  max="3"
                  step="0.1"
                  value={editFormData.weight}
                  onChange={(e) => onEditFormChange({ ...editFormData, weight: parseFloat(e.target.value) })}
                  className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${isDark ? 'bg-white/20' : 'bg-accent-forest/20'} accent-accent-sage`}
                />
              </div>
              <span className={`text-sm font-medium ${theme.textMain} min-w-[50px] text-right`}>
                {Math.round(editFormData.weight * 100)}%
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <FormActions
              onCancel={onCancelEdit}
              onSave={() => onUpdate(dimension.id)}
              inverted={inUse}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className={`text-lg font-semibold ${theme.textMain}`}>{dimension.displayName}</h3>
              <p className={`text-sm font-mono ${theme.textDim}`}>{dimension.name}</p>
              <p className={`text-sm mt-1 ${theme.textMuted}`}>Weight: {Math.round((dimension.weight ?? 1.0) * 100)}%</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => onStartEdit(dimension)} className={theme.iconButton}>
                <Edit2 className="w-4 h-4" />
              </Button>
              {!inUse && (
                <DeleteAction 
                  onDelete={async () => onDelete(dimension.id)} 
                  iconOnly={true} 
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className={`rounded-lg p-4 ${theme.innerBox}`}>
              <div className="flex items-center gap-2 mb-2">
                <FileText className={`w-4 h-4 ${theme.textMuted}`} />
                <span className={`text-sm font-medium ${theme.textMuted}`}>Requirement Instruction</span>
              </div>
              <p className={`text-sm whitespace-pre-wrap ${theme.textMain}`}>
                {dimension.requirementInstruction || <span className={`italic ${theme.textDim}`}>No instruction set</span>}
              </p>
            </div>
            <div className={`rounded-lg p-4 ${theme.innerBox}`}>
              <div className="flex items-center gap-2 mb-2">
                <Target className={`w-4 h-4 ${theme.textMuted}`} />
                <span className={`text-sm font-medium ${theme.textMuted}`}>Offering Instruction</span>
              </div>
              <p className={`text-sm whitespace-pre-wrap ${theme.textMain}`}>
                {dimension.offeringInstruction || <span className={`italic ${theme.textDim}`}>No instruction set</span>}
              </p>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}