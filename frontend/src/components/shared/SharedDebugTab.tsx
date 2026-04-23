'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { SettingsCard } from '@/components/shared/SettingsCard';
import { Tabs } from '@/components/shared/Tabs';
import { DOMAIN_ICONS } from '@/lib/iconRegistry';

interface SharedDebugTabProps {
  /** The raw JSON data to display in the debug viewer */
  rawData: any;
  /** Async callback triggered when the user clicks 'Write master file' */
  onGenerateMasterFile: () => Promise<void>;
  /** Async callback to fetch the master file content */
  onFetchMasterFile: () => Promise<string>;
  /** Optional loading state for the generation process */
  isGenerating?: boolean;
}

/**
 * @description Shared debug tab component for displaying raw JSON data and generating master files.
 * @responsibility
 * - Displays raw JSON data for debugging purposes.
 * - Provides toggle between Raw Data (JSON) and Master File (Markdown) views.
 * - Provides a button to manually regenerate master markdown files.
 * @boundary_rules
 * - ❌ MUST NOT fetch data directly (delegated to onFetchMasterFile callback).
 * - ❌ MUST NOT manage global state beyond local loading state.
 * - ✅ MUST receive data and callbacks via props.
 */
const DEBUG_TABS = [
  { id: 'markdown', label: 'Master File (MD)', icon: DOMAIN_ICONS.FILE },
  { id: 'json', label: 'Raw Data (JSON)', icon: DOMAIN_ICONS.DATABASE },
];

export function SharedDebugTab({
  rawData,
  onGenerateMasterFile,
  onFetchMasterFile,
  isGenerating = false,
}: SharedDebugTabProps) {
  const [activeTab, setActiveTab] = useState('markdown');
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (activeTab === 'markdown' && markdownContent === null && !isFetching) {
      fetchMarkdownContent();
    }
  }, [activeTab]);

  const fetchMarkdownContent = async () => {
    setIsFetching(true);
    try {
      const content = await onFetchMasterFile();
      setMarkdownContent(content);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not been generated')) {
        setMarkdownContent(null);
      } else {
        console.error('Failed to fetch master file:', error);
      }
    } finally {
      setIsFetching(false);
    }
  };

  const handleGenerateMasterFile = async () => {
    try {
      await onGenerateMasterFile();
      if (activeTab === 'markdown') {
        await fetchMarkdownContent();
      }
    } catch (error) {
      console.error('Failed to generate master file:', error);
    }
  };

  return (
    <div className="space-y-4">
      <SettingsCard
        icon={DOMAIN_ICONS.SETTINGS}
        title="Generate Master File"
        description="Manually triggers the generation of the master markdown file in the entity's folder."
      >
        <Button variant="secondary" onClick={handleGenerateMasterFile} disabled={isGenerating}>
          {isGenerating ? 'Generating...' : 'Write master file'}
        </Button>
      </SettingsCard>

      <SettingsCard
        icon={DOMAIN_ICONS.SETTINGS}
        title="Debug Data"
        description="Toggle between raw JSON data and generated master markdown file."
        layout="column"
      >
        <div className="mb-4">
          <Tabs
            tabs={DEBUG_TABS}
            activeTab={activeTab}
            onChange={setActiveTab}
            layoutIdPrefix="debugTab"
          />
        </div>

        {activeTab === 'json' ? (
          <pre className="text-xs bg-black/5 p-4 rounded overflow-auto whitespace-pre-wrap font-mono text-accent-forest max-h-96">
            {JSON.stringify(rawData, null, 2)}
          </pre>
        ) : isFetching ? (
          <div className="text-sm text-gray-500 p-4">Loading master file...</div>
        ) : markdownContent ? (
          <pre className="text-xs bg-black/5 p-4 rounded overflow-auto whitespace-pre-wrap font-mono text-accent-forest max-h-96">
            {markdownContent}
          </pre>
        ) : (
          <div className="text-sm text-gray-500 p-4">
            No master file generated yet. Click &quot;Write master file&quot; to generate it.
          </div>
        )}
      </SettingsCard>
    </div>
  );
}