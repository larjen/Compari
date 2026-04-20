/**
 * @fileoverview Shared files tab content component.
 *
 * @socexplanation
 * This component abstracts the shared layout composition for entity files (Source, Target, etc.)
 * to keep the main Modal components thin and focused on orchestration. It renders the
 * FileViewer component for viewing files and opening folders with consistent Framer Motion animation.
 */
import { motion } from 'framer-motion';
import { FileViewer } from '@/components/shared/FileViewer';

interface FilesTabContentProps {
  /** The folder path where files are stored */
  folderPath: string | null;
  /** List of files in the folder */
  files: string[];
  /** Whether files are currently loading */
  loadingFiles: boolean;
  /** Function to generate download URL for a file */
  getDownloadUrl: (filename: string) => string;
  /** Callback to open the file folder in file explorer */
  onOpenFolder: () => void;
}

export function FilesTabContent({
  folderPath,
  files,
  loadingFiles,
  getDownloadUrl,
  onOpenFolder,
}: FilesTabContentProps) {
  return (
    <motion.div
      key="files"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      className="space-y-4"
    >
      <FileViewer
        folderPath={folderPath}
        files={files}
        isLoading={loadingFiles}
        getDownloadUrl={getDownloadUrl}
        onOpenFolder={onOpenFolder}
      />
    </motion.div>
  );
}
