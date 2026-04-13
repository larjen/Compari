'use client';

import { useState, useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';

/**
 * Props for the FileUploadDropzone component.
 */
interface FileUploadDropzoneProps {
  /**
   * Callback function invoked when files are selected (either via drag-drop or click).
   * The parent component is responsible for handling the actual HTTP upload.
   * @param {File[]} files - Array of selected files
   */
  onFileSelect: (files: File[]) => void;
  /**
   * Whether to allow multiple file selection.
   * @default false
   */
  multiple?: boolean;
  /**
   * Optional MIME type or extension filter for the file input.
   * Example: ".pdf,.docx,.txt" or "application/pdf"
   * @default ".pdf,.docx,.txt"
   */
  accept?: string;
  /**
   * Indicates whether an upload is in progress.
   * When true, the component displays a loading state and disables interaction.
   * @default false
   */
  isUploading?: boolean;
  /**
   * Optional title text displayed in the dropzone.
   * @default "Drop file here or click to browse"
   */
  title?: string;
  /**
   * Optional subtitle text displayed below the title.
   * @default "Supports PDF, DOCX, and TXT files"
   */
  subtitle?: string;
}

/**
 * A reusable drag-and-drop file upload component.
 * 
 * Provides a consistent UI for file selection with drag-and-drop support.
 * This component handles only the visual state and file selection - it does NOT
 * make API calls. The parent component is responsible for the actual HTTP upload
 * via the onFileSelect callback.
 * 
 * Supports both single and multiple file selection via the `multiple` prop.
 * 
 * @param props - Component props
 * @returns React component with drag-and-drop file selection UI
 * 
 * @socexplanation
 * - Separation of Concerns: This component delegates HTTP upload to the parent to keep
 *   the UI component portable and reusable across different upload scenarios (e.g., job listings,
 *   user documents, profile photos).
 * - Controlled Component: The parent controls the isUploading state, allowing consistent
 *   loading UI across the application while keeping this component stateless regarding uploads.
 * - Visual State Only: Handles dragging vs idle visual states, but delegates actual file
 *   processing (validation, upload, error handling) to the parent.
 * - Multiple Files: When multiple is true, accepts an array of files and passes them to the callback.
 */
export function FileUploadDropzone({
  onFileSelect,
  multiple = false,
  accept = '.pdf,.docx,.txt',
  isUploading = false,
  title = 'Drop file here or click to browse',
  subtitle = 'Supports PDF, DOCX, and TXT files'
}: FileUploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handles file selection from the hidden file input (triggered by click).
   * Converts FileList to array and passes to onFileSelect callback.
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      onFileSelect(files);
    }
  };

  /**
   * Handles drop event from drag-and-drop.
   * Converts FileList to array and passes to onFileSelect callback.
   */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    if (files.length > 0) {
      onFileSelect(files);
    }
  };

  /**
   * Handles drag over event to enable drop feedback.
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  /**
   * Handles drag leave event to reset dragging state.
   */
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  /**
   * Programmatically triggers the hidden file input click.
   */
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />

      <div
        onClick={triggerFileInput}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`w-full p-8 border-2 border-dashed rounded-lg transition-colors group cursor-pointer ${
          isUploading
            ? 'border-accent-sand/30 bg-accent-sand/5 cursor-not-allowed'
            : isDragging
              ? 'border-accent-sage bg-accent-sage/10'
              : 'border-accent-sand/50 hover:border-accent-sage hover:bg-accent-sand/10'
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          {isUploading ? (
            <div className="p-3 bg-accent-sand/20 rounded-full">
              <Loader2 className="w-6 h-6 text-accent-forest/60 animate-spin" />
            </div>
          ) : (
            <div className="p-3 bg-accent-sand/20 rounded-full group-hover:bg-accent-sage/20 transition-colors">
              <Upload className="w-6 h-6 text-accent-forest/60 group-hover:text-accent-forest transition-colors" />
            </div>
          )}
          <div className="text-center">
            <p className="font-medium text-accent-forest">
              {isUploading ? 'Uploading...' : title}
            </p>
            <p className="text-sm text-accent-forest/60 mt-1">
              {isUploading ? 'Please wait' : subtitle}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}