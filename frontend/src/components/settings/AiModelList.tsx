'use client';

/**
 * @module AiModelList
 * @description List component for displaying AI models.
 * @responsibility
 * - Displays list of AI models with active state
 * - Handles user interactions for set/edit/delete/add
 * @separation_of_concerns
 * - Extracted from SettingsModal to enforce SoC
 * - Presentational component - no business logic
 */

import { Loader2, Edit2, Plus } from 'lucide-react';
import { Button, DeleteAction } from '@/components/ui';
import { AiModel } from '@/lib/types';
import { getThemeClasses } from '@/lib/utils';

export interface AiModelListProps {
  models: AiModel[];
  role: 'chat' | 'embedding';
  isLoading: boolean;
  showForm: boolean;
  editingModelId?: number | null;
  formComponent: React.ReactNode;
  hideAddButton?: boolean;
  onSetActive: (id: number) => Promise<void>;
  onEdit: (model: AiModel) => void;
  onDelete: (model: AiModel) => Promise<void>;
  onAddNew: (role: 'chat' | 'embedding') => void;
}

/**
 * List component displaying AI models for a specific role.
 * @param models - Array of AI models to display
 * @param role - The role type (chat or embedding)
 * @param isLoading - Whether data is loading
 * @param showForm - Whether to show the form inline
 * @param formComponent - The form component to render inline
 * @param onSetActive - Async callback when user sets a model as active
 * @param onEdit - Callback when user clicks edit
 * @param onDelete - Async callback when user deletes a model
 * @param onAddNew - Callback when user clicks add new
 */
export function AiModelList({
  models,
  role,
  isLoading,
  showForm,
  editingModelId,
  formComponent,
  hideAddButton,
  onSetActive,
  onEdit,
  onDelete,
  onAddNew,
}: AiModelListProps) {
  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-accent-sage" />
        </div>
      ) : models.length === 0 ? (
        <p className="text-sm text-accent-forest/50 py-2">
          No {role} models configured. Add one to get started.
        </p>
      ) : (
        models.map((model) => {
          const isEditingThis = editingModelId === model.id;
          const theme = getThemeClasses(model.isActive);
          const cardClasses = model.isActive ? theme.cardBg : `${theme.cardBg} hover:border-accent-sage/50`;

          return (
            <div
              key={model.id}
              className={`p-4 rounded-lg border transition-all ${cardClasses}`}
            >
              {isEditingThis ? (
                <div onClick={(e) => e.stopPropagation()}>
                  {formComponent}
                </div>
              ) : (
                <div className="flex items-start justify-between" onClick={() => onSetActive(model.id)}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-medium ${model.isActive ? 'text-white' : 'text-accent-forest'}`}>
                        {model.name}
                      </h4>
                      {model.isActive && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white">
                          Active
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${model.isActive ? 'text-white/70' : 'text-accent-forest/60'}`}>
                      {model.modelIdentifier}
                    </p>
                    <p className={`text-xs ${model.isActive ? 'text-white/50' : 'text-accent-forest/40'}`}>
                      {model.apiUrl}
                    </p>
                  </div>
                    <div className="flex gap-1">
                      {true && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(model);
                          }}
                          className={model.isActive ? 'text-white/70 hover:text-white hover:bg-white/20' : 'text-accent-forest/50 hover:text-accent-forest'}
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      )}
                    
                    {!model.isSystem && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <DeleteAction
                          onDelete={() => onDelete(model)}
                          iconOnly={true}
                          className={model.isActive ? 'text-white/70 hover:text-white' : ''}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {showForm && !editingModelId && (
        <div>{formComponent}</div>
      )}

      {!showForm && !hideAddButton && (
        <div className="flex justify-end mt-4">
          <Button
            onClick={() => onAddNew(role)}
            variant="primary"
            size="sm"
            className="text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add New Model
          </Button>
        </div>
      )}
    </div>
  );
}