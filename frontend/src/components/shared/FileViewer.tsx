'use client';

import { Loader2, FileText, ExternalLink, Sparkles, Folder, Eye } from 'lucide-react';

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
    <div className="pr-2 space-y-2">
      {/* 1. Folder Path Pill */}
      {folderPath ? (
        onOpenFolder ? (
          <button
            onClick={onOpenFolder}
            className="w-full flex items-center gap-3 p-2 rounded-lg border border-border-light bg-accent-sand/10 hover:bg-accent-sand/20 group transition-all text-left cursor-pointer"
            title="Open Folder Externally"
          >
            <div className="p-2 bg-white rounded border border-border-light text-accent-forest/40 group-hover:text-accent-forest/60 transition-colors shrink-0">
              <Folder className="w-4 h-4" />
            </div>
            
            <span className="text-sm text-accent-forest/70 group-hover:text-accent-forest truncate flex-1 font-medium transition-colors">
              {folderPath}
            </span>

            <div className="flex items-center gap-1 pr-1">
              <div className="p-1.5 text-accent-forest/40 group-hover:text-accent-forest transition-colors shrink-0">
                <ExternalLink className="w-4 h-4" />
              </div>
            </div>
          </button>
        ) : (
          <div className="w-full flex items-center gap-3 p-2 rounded-lg border border-border-light bg-accent-sand/10 text-left">
            <div className="p-2 bg-white rounded border border-border-light text-accent-forest/40 shrink-0">
              <Folder className="w-4 h-4" />
            </div>
            <span className="text-sm text-accent-forest/70 truncate flex-1 font-medium">
              {folderPath}
            </span>
          </div>
        )
      ) : (
        <div className="w-full p-3 bg-red-50 rounded-lg border border-red-100">
          <p className="text-xs text-red-600 font-medium">No folder path associated with this entity. Files cannot be stored or viewed.</p>
        </div>
      )}

      {/* 2. Files List */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-accent-forest/50 py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading...</span>
        </div>
      ) : files.length > 0 ? (
        <>
          {files.map((file) => {
            const isViewable = file.endsWith('.jsonl') || file.endsWith('.json') || file.endsWith('.md') || file.endsWith('.txt');
            const downloadUrl = getDownloadUrl(file);
            
            const pillClasses = "w-full flex items-center gap-3 p-2 rounded-lg border border-transparent hover:border-accent-sand/20 hover:bg-accent-sand/10 group transition-all text-left cursor-pointer";

            const PillContent = () => (
              <>
                <div className="p-2 bg-white rounded border border-border-light text-accent-forest/40 group-hover:text-accent-forest/60 transition-colors shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                
                <span className="text-sm text-accent-forest/70 group-hover:text-accent-forest truncate flex-1 font-medium transition-colors">
                  {file}
                </span>

                <div className="flex items-center gap-1 pr-1">
                  {isViewable ? (
                    <div className="p-1.5 text-accent-forest/40 group-hover:text-accent-sage transition-colors shrink-0">
                      <Eye className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="p-1.5 text-accent-forest/40 group-hover:text-accent-forest transition-colors shrink-0">
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
        </>
      ) : (
        <p className="text-sm text-accent-forest/40 italic py-4">{emptyMessage}</p>
      )}
    </div>
  );
}