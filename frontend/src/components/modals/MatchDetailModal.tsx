'use client';

import { useState } from 'react';
import { DeleteAction, EditButton } from '@/components/ui';
import { EntityMatch } from '@/lib/types';
import { formatDate, cn, getNuancedEntityName, parseMatchEntities, formatPercentage } from '@/lib/utils';
import { useBlueprints } from '@/hooks/useBlueprints';
import { useMatchFiles, useMatchReport } from '@/hooks/useMatchData';
import { useToast } from '@/hooks/useToast';
import { matchApi } from '@/lib/api/matchApi';
import { User, Briefcase, Clock, AlertCircle, CheckCircle, FileText, Files, Info, Download } from 'lucide-react';
import { FileViewer } from '@/components/shared/FileViewer';
import { FilesTabContent } from '@/components/shared/FilesTabContent';
import { EntityDetailLayout } from '@/components/shared/EntityDetailLayout';
import { MatchReportViewer } from '@/components/matches/MatchReportViewer';
import { Button } from '@/components/ui/Button';

interface MatchDetailModalProps {
  match: EntityMatch | null;
  open: boolean;
  onClose: () => void;
  onDelete: (id: number) => Promise<void>;
  onEdit?: () => void;
}

type TabId = 'info' | 'files' | 'report';

const tabs = [
  { id: 'info', label: 'General Info', icon: Info },
  { id: 'files', label: 'Files', icon: Files },
  { id: 'report', label: 'Report', icon: FileText },
];

export function MatchDetailModal({ match, open, onClose, onDelete, onEdit }: MatchDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('info');
  const { blueprints } = useBlueprints();

  const { files, loading: loadingFiles } = useMatchFiles(match?.id);
  const { reportData, loading: loadingReport } = useMatchReport(match?.id, match?.report_path);
  const { addToast } = useToast();

  const activeBlueprint = blueprints?.find((bp) => bp.is_active);
  const reqLabel = activeBlueprint?.requirementLabelSingular || 'Requirement';
  const offLabel = activeBlueprint?.offeringLabelSingular || 'Offering';

  if (!match) return null;

  const handleDelete = async () => {
    try {
      await onDelete(match.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete match:', err);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const response = await fetch(`/api/matches/${match.id}/pdf`);
      
      if (!response.ok) {
        let errorMessage = "Failed to generate PDF";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
        }
        throw new Error(errorMessage);
      }
      
      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `Compari_Match_Report_${match.id}.pdf`;
      if (contentDisposition && contentDisposition.includes('filename=')) {
        const matches = /filename="([^"]+)"/.exec(contentDisposition);
        if (matches != null && matches) { 
          filename = matches[1];
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error(error);
      addToast('error', error instanceof Error ? error.message : "There was an error downloading the PDF.");
    }
  };

  const { reqEntity, offEntity } = parseMatchEntities(match);

  const sourceName = getNuancedEntityName(reqEntity, blueprints);
  const targetName = getNuancedEntityName(offEntity, blueprints);

  const customTitle = (
    <div className="flex flex-col gap-1.5 pt-1 w-full overflow-hidden">
      <div className="flex items-start gap-2 min-w-0">
        <span className="text-xs uppercase tracking-wider font-bold text-accent-forest/50 w-24 shrink-0 mt-1.5">{reqLabel}</span>
        <span className="text-xl font-serif font-semibold text-accent-forest leading-tight truncate whitespace-nowrap">{sourceName}</span>
      </div>
      <div className="flex items-start gap-2 min-w-0">
        <span className="text-xs uppercase tracking-wider font-bold text-accent-forest/50 w-24 shrink-0 mt-1">{offLabel}</span>
        <span className="text-lg font-medium text-accent-forest/80 leading-tight truncate whitespace-nowrap">{targetName}</span>
      </div>
    </div>
  );

  return (
    <EntityDetailLayout
      title={customTitle}
      subtitle={undefined}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as TabId)}
      layoutIdPrefix="matchDetail"
      open={open}
      onClose={onClose}
      footerActions={
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleDownloadPdf} 
            variant="secondary" 
            className="bg-white border-accent-sand/30 hover:bg-accent-sand/10 shadow-sm"
          >
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
          {onEdit && <EditButton entityName="Match" onClick={onEdit} />}
          <DeleteAction onDelete={handleDelete} />
        </div>
      }
    >
      <>
        {activeTab === 'info' && (
          <div className="space-y-4">
            {match.status === 'failed' && match.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
                  <AlertCircle className="w-4 h-4" />
                  Error
                </div>
                <p className="text-red-600 text-sm mt-1">{match.error}</p>
              </div>
            )}

            {/* Simple Match Score Display */}
            {match.match_score !== null && (
              <div>
                <div className="flex items-center gap-2 text-accent-forest/60 text-sm mb-1">
                  <CheckCircle className="w-4 h-4" />
                  Overall Match Score
                </div>
                <p className="text-2xl font-bold text-accent-forest">
                  {formatPercentage(match.match_score)}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 text-accent-forest/60 text-sm mb-1">
                  <Clock className="w-4 h-4" />
                  Created
                </div>
                <p className="text-sm text-accent-forest">
                  {match.created_at ? formatDate(match.created_at) : 'N/A'}
                </p>
              </div>

              {match.updated_at && (
                <div>
                  <div className="flex items-center gap-2 text-accent-forest/60 text-sm mb-1">
                    <Clock className="w-4 h-4" />
                    Updated
                  </div>
                  <p className="text-sm text-accent-forest">
                    {formatDate(match.updated_at)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <FilesTabContent
            folderPath={match.folder_path}
            files={files}
            loadingFiles={loadingFiles}
            getDownloadUrl={(filename) => `/api/matches/${match.id}/files/${encodeURIComponent(filename)}`}
            onOpenFolder={() => matchApi.openFolder(match.id)}
          />
        )}

        {activeTab === 'report' && (
          <MatchReportViewer
            reportData={reportData}
            matchId={match.id}
          />
        )}
      </>
    </EntityDetailLayout>
  );
}
