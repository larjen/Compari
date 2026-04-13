'use client';

import { Loader2, FileText, ExternalLink, Sparkles, FolderOpen, Eye } from 'lucide-react';

interface FileViewerProps {
  folderPath: string | null;
  files: string[];
  isLoading: boolean;
  emptyMessage?: string;
  getDownloadUrl: (filename: string) => string;
  /**
   * Callback function to trigger AI criteria extraction on a specific file.
   * If provided, an extract button will be shown next to each file.
   */
  onExtract?: (filename: string) => void;
  /**
   * Currently extracting file name. Used to show loading state on the button.
   */
  extractingFile?: string | null;
  /**
   * Callback function to open the folder in the native OS file manager.
   * If provided, the folder path will be clickable.
   */
  onOpenFolder?: () => void;
}

export function FileViewer({
  folderPath,
  files,
  isLoading,
  emptyMessage = 'No files attached',
  getDownloadUrl,
  onExtract,
  extractingFile,
  onOpenFolder,
}: FileViewerProps) {

  return (
    <div>
      {folderPath ? (
        <div className="mb-4 p-3 bg-background rounded-lg">
          <p className="text-xs uppercase tracking-wide text-accent-forest/50 mb-1">Folder Path</p>
          {onOpenFolder ? (
            <button
              onClick={onOpenFolder}
              className="flex items-center gap-1.5 text-xs text-accent-forest/70 hover:bg-accent-sand/20 hover:text-accent-forest rounded px-1 py-0.5 transition-colors cursor-pointer group"
            >
              <span className="break-all text-left">{folderPath}</span>
              <FolderOpen className="w-3.5 h-3.5 text-accent-forest/40 group-hover:text-accent-forest flex-shrink-0" />
            </button>
          ) : (
            <p className="text-xs text-accent-forest/70 break-all">{folderPath}</p>
          )}
        </div>
      ) : (
        <div className="mb-4 p-3 bg-red-50 rounded-lg">
          <p className="text-xs text-red-600">No folder path associated with this entity. Files cannot be stored or viewed.</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-accent-forest/50 py-8">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading...</span>
        </div>
      ) : files.length > 0 ? (
        <div className="pr-2 space-y-2">
          {files.map((file) => {
            const isViewable = file.endsWith('.jsonl') || file.endsWith('.json') || file.endsWith('.md') || file.endsWith('.txt');
            const downloadUrl = getDownloadUrl(file);
            
            const pillClasses = "w-full flex items-center gap-3 p-2 rounded-lg border border-transparent hover:border-accent-sand/20 hover:bg-accent-sand/10 group transition-all text-left cursor-pointer";

            const PillContent = () => (
              <>
                <div className="p-2 bg-white rounded border border-border-light text-accent-forest/40 group-hover:text-accent-forest/60 transition-colors">
                  <FileText className="w-4 h-4" />
                </div>
                
                <span className="text-sm text-accent-forest/70 group-hover:text-accent-forest truncate flex-1 font-medium transition-colors">
                  {file}
                </span>

                <div className="flex items-center gap-1 pr-1">
                  {isViewable ? (
                    <div className="p-1.5 text-accent-forest/40 group-hover:text-accent-sage transition-colors">
                      <Eye className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="p-1.5 text-accent-forest/40 group-hover:text-accent-forest transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </>
            );

            if (isViewable) {
              return (
                <button 
                  key={file}
                  onClick={() => {
                    const viewerUrl = `/log-viewer?fileUrl=${encodeURIComponent(downloadUrl)}&fileName=${encodeURIComponent(file)}`;
                    window.open(viewerUrl, '_blank');
                  }}
                  className={pillClasses}
                  title="View formatted content in new tab"
                >
                  <PillContent />
                </button>
              );
            }

            return (
              <a 
                key={file}
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={pillClasses}
                title="Download or open raw file"
              >
                <PillContent />
              </a>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-accent-forest/40 italic py-8">{emptyMessage}</p>
      )}
    </div>
  );
}