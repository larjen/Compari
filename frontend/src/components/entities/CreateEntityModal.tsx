'use client';

import { memo } from 'react';
import { Dialog, Button } from '@/components/ui';
import { FileUploadDropzone } from '@/components/shared/FileUploadDropzone';
import { useBlueprints } from '@/hooks/useBlueprints';

interface CreateEntityModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (files: File[]) => Promise<void>;
  entityType: 'requirement' | 'offering';
}

/**
 * Modal component for capturing file input to create entities.
 * This component acts purely as an input mechanism - as soon as files are selected or dropped,
 * it triggers the creation process and closes immediately.
 * The parent component is responsible for managing async state, queue indicators, and toasts.
 */
function CreateEntityModalComponent({ open, onClose, onCreate, entityType }: CreateEntityModalProps) {
  const { blueprints } = useBlueprints();

  const activeBlueprint = blueprints.find(b => b.is_active) || blueprints[0];

  /**
   * Infrastructure: Metadata is stored as JSON/unknown; explicit casting is required for frontend type safety.
   * Safely extract labels with fallbacks to prevent runtime crashes during string manipulation.
   * If no blueprints exist in the database, defaults to standard domain terminology.
   */
  const labelSingular = entityType === 'requirement' 
    ? (activeBlueprint?.requirementLabelSingular || 'Requirement')
    : (activeBlueprint?.offeringLabelSingular || 'Offering');
    
  const docTypeLabel = entityType === 'requirement' 
    ? activeBlueprint?.requirementDocTypeLabel 
    : activeBlueprint?.offeringDocTypeLabel;

  /**
   * Handles file selection from the dropzone.
   * Fire-and-forget: immediately triggers creation and closes modal.
   * The parent component handles async state and notifications.
   * @param files - Array of selected files
   */
  const handleFileSelectAndCreate = (files: File[]) => {
    onCreate(files).catch(() => {
      // Silently catch here as the parent handleCreateEntity already triggers error toasts
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={`Create ${labelSingular}`}>
      <div className="space-y-6">
        <p className="text-accent-forest/80 text-sm p-4 bg-accent-sage/10 rounded-lg border border-accent-sage/20">
          {docTypeLabel || `Upload a document to create a new ${labelSingular.toLowerCase()}.`}
        </p>

        <div className="pt-2">
          <FileUploadDropzone
            onFileSelect={handleFileSelectAndCreate}
            accept=".pdf,.docx,.txt"
            title="Attach Document"
            subtitle="Supports PDF, DOCX, and TXT files"
            multiple={true}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export const CreateEntityModal = memo(CreateEntityModalComponent);
