import React, { useEffect, useState } from 'react';
import { ActiveTab, Navbar } from './components/Navbar';
import { AppSettings, RoastLog } from './types';
import {
  DEFAULT_SETTINGS,
  exportAllData,
  loadRoastLogs,
  loadSettings,
  saveRoastLogs,
  saveSettings,
} from './services/storage';
import { RoastLogPage } from './pages/RoastLogPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { ResearchPage } from './pages/ResearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { createSampleArtisanLog } from './services/artisanParser';
import { googleDriveService } from './services/googleDriveService';
import { generateRoastLogsCsv } from './services/csvExport';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('logs');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [logs, setLogs] = useState<RoastLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [researchBeanId, setResearchBeanId] = useState<string | null>(null);

  // Initialize and load persistent data from IndexedDB
  useEffect(() => {
    async function init() {
      try {
        const loadedSettings = await loadSettings();
        setSettings(loadedSettings);

        // Pre-initialize Google Drive GIS client if client ID is configured
        if (loadedSettings.googleDrive.clientId) {
          googleDriveService.loadGoogleScripts().then(() => {
            googleDriveService.initTokenClient(loadedSettings.googleDrive.clientId);
          });
        }

        let loadedLogs = await loadRoastLogs();

        // If first launch and no logs exist, seed with 3 realistic roast profiles
        if (!loadedLogs || loadedLogs.length === 0) {
          const sample1 = createSampleArtisanLog('Ethiopia_Chelchele_Filter_Batch1.alog', 'Excellent');
          const sample2 = createSampleArtisanLog('Colombia_Pink_Bourbon_Batch4.alog', 'Good');
          const sample3 = createSampleArtisanLog('Costa_Rica_Canet_Baked_Trial.alog', 'Bad');

          const initialSampleLogs: RoastLog[] = [
            {
              id: 'roast-sample-1',
              date: new Date(Date.now() - 86400000 * 2).toISOString(),
              roasterId: loadedSettings.roasters[0]?.id || 'roaster-1',
              beanId: loadedSettings.greenBeans[0]?.id || 'bean-1',
              greenWeightGrams: 250,
              roastedWeightGrams: 216,
              weightLossPercent: 13.6,
              rating: 'Excellent',
              tastingNotes: 'Exceptional transparency. Meyer lemon, bergamot florals, honeyed peach sweetness. Clean tea-like finish with zero astringency.',
              flavorDescriptors: ['Bergamot', 'Jasmine', 'Peach', 'Clean Acidity'],
              roastDegree: 'City',
              artisanLogDriveFileName: 'Ethiopia_Chelchele_Filter_Batch1.alog',
              artisanLogParsed: sample1,
              createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
              updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
            },
            {
              id: 'roast-sample-2',
              date: new Date(Date.now() - 86400000 * 5).toISOString(),
              roasterId: loadedSettings.roasters[0]?.id || 'roaster-1',
              beanId: loadedSettings.greenBeans[1]?.id || 'bean-2',
              greenWeightGrams: 300,
              roastedWeightGrams: 258,
              weightLossPercent: 14.0,
              rating: 'Very good',
              tastingNotes: 'Juicy pink grapefruit and sugarcane sweetness. Bright malic acidity, pleasant cacao finish.',
              flavorDescriptors: ['Citrus', 'Panela', 'Cacao', 'Juicy Body'],
              roastDegree: 'City+',
              artisanLogDriveFileName: 'Colombia_Pink_Bourbon_Batch4.alog',
              artisanLogParsed: sample2,
              createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
              updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
            },
            {
              id: 'roast-sample-3',
              date: new Date(Date.now() - 86400000 * 10).toISOString(),
              roasterId: loadedSettings.roasters[1]?.id || 'roaster-2',
              beanId: loadedSettings.greenBeans[2]?.id || 'bean-3',
              greenWeightGrams: 250,
              roastedWeightGrams: 211,
              weightLossPercent: 15.6,
              rating: 'Bad',
              tastingNotes: 'Roast stalled at First Crack resulting in baked, flat bread-like notes. Muffled acidity and drying finish.',
              flavorDescriptors: ['Baked', 'Flat Acidity', 'Drying'],
              roastDegree: 'Full City',
              artisanLogDriveFileName: 'Costa_Rica_Canet_Baked_Trial.alog',
              artisanLogParsed: sample3,
              createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
              updatedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
            }
          ];

          await saveRoastLogs(initialSampleLogs);
          loadedLogs = initialSampleLogs;
        }

        setLogs(loadedLogs);
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Persist settings changes
  const handleUpdateSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  // Persist new or updated log
  const handleSaveLog = async (logToSave: RoastLog) => {
    const existingIndex = logs.findIndex(l => l.id === logToSave.id);
    let updated: RoastLog[];
    if (existingIndex >= 0) {
      updated = [...logs];
      updated[existingIndex] = logToSave;
    } else {
      updated = [logToSave, ...logs];
    }
    setLogs(updated);
    await saveRoastLogs(updated);

    // If autoSync with Drive is enabled, trigger background sync
    if (settings.googleDrive.isConnected && settings.googleDrive.autoSync) {
      triggerQuickSync();
    }
  };

  // Delete log
  const handleDeleteLog = async (logId: string) => {
    const updated = logs.filter(l => l.id !== logId);
    setLogs(updated);
    await saveRoastLogs(updated);
  };

  // Quick Google Drive Sync: Saves all data into one single JSON file and updates Google Sheet
  const triggerQuickSync = async () => {
    if (!settings.googleDrive.isConnected) return;
    setIsSyncing(true);
    try {
      const jsonStr = await exportAllData();
      const res = await googleDriveService.syncAppDataToDrive(
        jsonStr,
        settings.googleDrive.appDataFolderId,
        settings.googleDrive.appDataFileId
      );

      // Also synchronize into Google Sheet if not disabled
      let sheetRes: { sheetId: string; webViewLink?: string } | undefined;
      if (settings.googleDrive.syncToGoogleSheet !== false) {
        try {
          const csvStr = generateRoastLogsCsv(logs, settings);
          sheetRes = await googleDriveService.syncLogsToGoogleSheet(
            csvStr,
            settings.googleDrive.appDataFolderId,
            settings.googleDrive.sheetFileId
          );
        } catch (sheetErr) {
          console.warn('Google Sheet sync error:', sheetErr);
        }
      }

      const updated = {
        ...settings,
        googleDrive: {
          ...settings.googleDrive,
          appDataFileId: res.fileId, // CRITICAL: Persist fileId so all edits update the SAME single JSON file!
          sheetFileId: sheetRes?.sheetId || settings.googleDrive.sheetFileId,
          sheetWebViewLink: sheetRes?.webViewLink || settings.googleDrive.sheetWebViewLink,
          lastSyncTimestamp: new Date().toISOString(),
        }
      };
      setSettings(updated);
      await saveSettings(updated);
    } catch (err: any) {
      console.warn('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Navigation shortcut: research bean from log
  const handleSelectBeanForResearch = (beanId: string) => {
    setResearchBeanId(beanId);
    setActiveTab('research');
  };

  // Navigation shortcut: start roast with bean from research
  const handleNavigateToNewRoastWithBean = (_beanId: string) => {
    setActiveTab('logs');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0c0a09] flex items-center justify-center text-stone-400 font-mono text-xs">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Loading RoastCraft PWA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0a09] text-roast-text flex flex-col font-sans selection:bg-amber-600 selection:text-stone-950">
      {/* Navbar Header & Mobile Nav */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        driveConfig={settings.googleDrive}
        onQuickSync={triggerQuickSync}
        isSyncing={isSyncing}
      />

      {/* Main Content Pages */}
      <main className="flex-1 w-full">
        {activeTab === 'logs' && (
          <RoastLogPage
            logs={logs}
            settings={settings}
            onSaveLog={handleSaveLog}
            onDeleteLog={handleDeleteLog}
            onSelectBeanForResearch={handleSelectBeanForResearch}
            onUpdateSettings={handleUpdateSettings}
          />
        )}

        {activeTab === 'analysis' && (
          <AnalysisPage logs={logs} settings={settings} />
        )}

        {activeTab === 'research' && (
          <ResearchPage
            settings={settings}
            selectedBeanIdFromNav={researchBeanId}
            onNavigateToNewRoastWithBean={handleNavigateToNewRoastWithBean}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsPage
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onRefreshData={async () => {
              const loadedLogs = await loadRoastLogs();
              setLogs(loadedLogs);
            }}
          />
        )}
      </main>
    </div>
  );
};
