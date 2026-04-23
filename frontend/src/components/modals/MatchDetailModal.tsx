'use client';

import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { useRouter } from 'next/navigation';
import { DeleteAction, EditButton, DownloadButton } from '@/components/ui';
import { EntityMatch } from '@/lib/types';
import { formatDate, cn, getEntityDisplayNames, parseMatchEntities, formatPercentage } from '@/lib/utils';
import { useUrlTabs } from '@/hooks/useUrlTabs';
import { useMatchReport } from '@/hooks/useMatchData';
import { useFiles } from '@/hooks/useEntityData';
import { useMatchOperations } from '@/hooks/useMatchOperations';
import { useTerminology } from '@/hooks/useTerminology';
import { matchApi } from '@/lib/api/matchApi';
import { FileViewer } from '@/components/shared/FileViewer';
import { FilesTabContent } from '@/components/shared/FilesTabContent';
import { EntityDetailLayout } from '@/components/shared/EntityDetailLayout';
import { MatchReportViewer } from '@/components/matches/MatchReportViewer';
import { useSettings } from '@/hooks/useSettings';
import { SettingsCard } from '@/components/shared/SettingsCard';
import { SharedDebugTab } from '@/components/shared/SharedDebugTab';

interface MatchDetailModalProps {
  match: EntityMatch | null;
  open: boolean;
  onClose: () => void;
  onDelete: (id: number) => Promise<void>;
  onEdit?: () => void;
}

const MATCH_TABS = {
  INFO: 'info',
  FILES: 'files',
  REPORT: 'report',
  DEBUG: 'debug'
} as const;
type TabId = typeof MATCH_TABS[keyof typeof MATCH_TABS];

const baseTabs = [
  { id: MATCH_TABS.INFO, label: 'General Info', icon: DOMAIN_ICONS.INFO },
  { id: MATCH_TABS.REPORT, label: 'Report', icon: DOMAIN_ICONS.FILE },
  { id: MATCH_TABS.FILES, label: 'Files', icon: DOMAIN_ICONS.FILES },
];
export function MatchDetailModal({ match, open, onClose, onDelete, onEdit }: MatchDetailModalProps) {
  const router = useRouter();
  const { activeTab, handleTabChange } = useUrlTabs(MATCH_TABS.INFO);
  const { activeLabels } = useTerminology();

  const { files, loading: loadingFiles } = useFiles(match?.id, 'match');
  const { reportData, loading: loadingReport } = useMatchReport(match?.id, match?.report_path);
  const { settings } = useSettings(open);

  const { 
    deleteWithToast, 
    downloadPdfWithToast, 
    writeMasterFileWithToast,
    fetchMasterFileWithToast 
  } = useMatchOperations({ deleteMatchFn: onDelete });

  const tabs = settings.debug_mode === 'true'
    ? [...baseTabs, { id: MATCH_TABS.DEBUG, label: 'Debug', icon: DOMAIN_ICONS.SETTINGS }]
    : baseTabs;

  if (!match) return null;

  const { reqEntity, offEntity } = parseMatchEntities(match);
  const { primary: reqName } = getEntityDisplayNames(reqEntity);
  const { primary: offName } = getEntityDisplayNames(offEntity);

  const reqLabel = activeLabels.requirement.singular;
  const offLabel = activeLabels.offering.singular;

  const customTitle = (
    <div className="flex flex-col gap-1.5 pt-1 w-full overflow-hidden">
      <div className="flex items-start gap-2 min-w-0">
        <span className="text-xs uppercase tracking-wider font-bold text-accent-forest/50 w-24 shrink-0 mt-1.5">{reqLabel}</span>
        <span className="text-xl font-serif font-semibold text-accent-forest leading-tight truncate whitespace-nowrap">{reqName}</span>
      </div>
      <div className="flex items-start gap-2 min-w-0">
        <span className="text-xs uppercase tracking-wider font-bold text-accent-forest/50 w-24 shrink-0 mt-1">{offLabel}</span>
        <span className="text-lg font-medium text-accent-forest/80 leading-tight truncate whitespace-nowrap">{offName}</span>
      </div>
    </div>
  );

  return (
    <EntityDetailLayout
      title={customTitle}
      subtitle={undefined}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      layoutIdPrefix="matchDetail"
      open={open}
      onClose={onClose}
      footerActions={
        <div className="flex items-center gap-3">
          <DownloadButton 
            itemName="PDF"
            onClick={() => downloadPdfWithToast(match.id)} 
            variant="secondary" 
            className="bg-white border-accent-sand/30 hover:bg-accent-sand/10 shadow-xs"
          />
          {onEdit && <EditButton entityName="Match" onClick={onEdit} />}
          <DeleteAction onDelete={() => deleteWithToast(match.id, onClose)} />
        </div>
      }
    >
      <>
        {activeTab === MATCH_TABS.INFO && (
          <div className="space-y-4">
            {match.status === 'failed' && match.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
                  <DOMAIN_ICONS.ERROR className="w-4 h-4" />
                  Error
                </div>
                <p className="text-red-600 text-sm mt-1">{match.error}</p>
              </div>
            )}

            {/* Simple Match Score Display */}
            {match.match_score !== null && (
              <div>
                <div className="flex items-center gap-2 text-accent-forest/60 text-sm mb-1">
                  <DOMAIN_ICONS.CHECK className="w-4 h-4" />
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
                  <DOMAIN_ICONS.CLOCK className="w-4 h-4" />
                  Created
                </div>
                <p className="text-sm text-accent-forest">
                  {match.created_at ? formatDate(match.created_at) : 'N/A'}
                </p>
              </div>

              {match.updated_at && (
                <div>
                  <div className="flex items-center gap-2 text-accent-forest/60 text-sm mb-1">
                    <DOMAIN_ICONS.CLOCK className="w-4 h-4" />
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

        {activeTab === MATCH_TABS.REPORT && (
          <MatchReportViewer
            reportData={reportData}
            matchId={match.id}
          />
        )}

        {activeTab === MATCH_TABS.FILES && (
          <FilesTabContent
            folderPath={match?.folder_path ?? (match as any)?.folderPath ?? null}
            files={files}
            loadingFiles={loadingFiles}
            getDownloadUrl={(filename) => `/api/matches/${match.id}/files/${encodeURIComponent(filename)}`}
            onOpenFolder={() => matchApi.openFolder(match.id)}
          />
        )}
        {activeTab === MATCH_TABS.DEBUG && settings.debug_mode === 'true' && (
          <SharedDebugTab
            rawData={match}
            onGenerateMasterFile={() => writeMasterFileWithToast(match.id, () => {})}
            onFetchMasterFile={() => fetchMasterFileWithToast(match.id)}
          />        )}
      </>
    </EntityDetailLayout>
  );
}
