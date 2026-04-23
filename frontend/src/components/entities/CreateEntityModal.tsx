'use client';

import { memo } from 'react';
import { Dialog, Button, ModalFooter } from '@/components/ui';
import { FileUploadDropzone } from '@/components/shared/FileUploadDropzone';
import { useTerminology } from '@/hooks/useTerminology';
import { EntityType } from '@/lib/types';

interface CreateEntityModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (files: File[]) => Promise<void>;
  entityType: EntityType;
}

/**
 * Modal component for capturing file input to create entities.
 * This component acts purely as an input mechanism - as soon as files are selected or dropped,
 * it triggers the creation process and closes immediately.
 * The parent component is responsible for managing async state, queue indicators, and toasts.
 */
function CreateEntityModalComponent({ open, onClose, onCreate, entityType }: CreateEntityModalProps) {
  const { activeLabels } = useTerminology();
  const labels = activeLabels[entityType];
  const labelSingular = labels.singular;
  const docTypeLabel = labels.docType;

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
    <Dialog open={open} onClose={onClose} title={`Create ${labelSingular}`} autoHeight className="md:max-w-2xl">
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

        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </ModalFooter>
      </div>
    </Dialog>
  );
}

export const CreateEntityModal = memo(CreateEntityModalComponent);
