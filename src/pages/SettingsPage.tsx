import React, { useState } from 'react';
import {
  AppSettings,
  GreenBean,
  Roaster,
} from '../types';
import {
  Flame,
  Coffee,
  Cloud,
  Plus,
  Trash2,
  Edit2,
  Check,
  Download,
  Upload,
  Info,
  Folder,
  Sliders,
  ExternalLink
} from 'lucide-react';
import { googleDriveService } from '../services/googleDriveService';
import { exportAllData, importAllData } from '../services/storage';

interface SettingsPageProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onRefreshData?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onUpdateSettings,
  onRefreshData,
}) => {
  const [activeSection, setActiveSection] = useState<'roasters' | 'beans' | 'drive' | 'general'>('roasters');

  // Roaster Modal / Form state
  const [isRoasterModalOpen, setIsRoasterModalOpen] = useState(false);
  const [editingRoasterId, setEditingRoasterId] = useState<string | null>(null);
  const [roasterForm, setRoasterForm] = useState<Partial<Roaster>>({
    name: '',
    model: '',
    heatingType: 'Electric',
    capacityGrams: 500,
    notes: '',
  });

  // Green Bean Modal / Form state
  const [isBeanModalOpen, setIsBeanModalOpen] = useState(false);
  const [editingBeanId, setEditingBeanId] = useState<string | null>(null);
  const [beanForm, setBeanForm] = useState<Partial<GreenBean>>({
    name: '',
    origin: '',
    region: '',
    farmOrStation: '',
    variety: '',
    process: 'Washed',
    altitude: 1800,
    cropYear: '2025/2026',
    supplier: '',
    stockRemainingGrams: 1000,
    densityGramsPerLiter: 700,
    moisturePercent: 11.0,
    notes: '',
    flavorProfile: [],
  });
  const [flavorTagInput, setFlavorTagInput] = useState('');

  // Google Drive state
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [driveStatusMsg, setDriveStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showDriveGuide, setShowDriveGuide] = useState(false);

  // Roaster handlers
  const openAddRoaster = () => {
    setEditingRoasterId(null);
    setRoasterForm({
      name: '',
      model: '',
      heatingType: 'Electric',
      capacityGrams: 500,
      notes: '',
    });
    setIsRoasterModalOpen(true);
  };

  const openEditRoaster = (r: Roaster) => {
    setEditingRoasterId(r.id);
    setRoasterForm({ ...r });
    setIsRoasterModalOpen(true);
  };

  const saveRoaster = () => {
    if (!roasterForm.name?.trim()) return;

    let updatedRoasters: Roaster[];
    if (editingRoasterId) {
      updatedRoasters = settings.roasters.map(r =>
        r.id === editingRoasterId ? ({ ...r, ...roasterForm } as Roaster) : r
      );
    } else {
      const newRoaster: Roaster = {
        id: `roaster-${Date.now()}`,
        name: roasterForm.name.trim(),
        model: roasterForm.model?.trim() || roasterForm.name.trim(),
        heatingType: roasterForm.heatingType || 'Electric',
        capacityGrams: roasterForm.capacityGrams || 500,
        notes: roasterForm.notes?.trim(),
        createdAt: new Date().toISOString(),
      };
      updatedRoasters = [...settings.roasters, newRoaster];
    }

    onUpdateSettings({ ...settings, roasters: updatedRoasters });
    setIsRoasterModalOpen(false);
  };

  const deleteRoaster = (id: string) => {
    if (confirm('Are you sure you want to delete this roaster?')) {
      const updated = settings.roasters.filter(r => r.id !== id);
      onUpdateSettings({ ...settings, roasters: updated });
    }
  };

  // Green Bean handlers
  const openAddBean = () => {
    setEditingBeanId(null);
    setBeanForm({
      name: '',
      origin: '',
      region: '',
      farmOrStation: '',
      variety: '',
      process: 'Washed',
      altitude: 1800,
      cropYear: '2025/2026',
      supplier: '',
      stockRemainingGrams: 1000,
      densityGramsPerLiter: 700,
      moisturePercent: 11.0,
      notes: '',
      flavorProfile: [],
    });
    setFlavorTagInput('');
    setIsBeanModalOpen(true);
  };

  const openEditBean = (b: GreenBean) => {
    setEditingBeanId(b.id);
    setBeanForm({ ...b });
    setFlavorTagInput('');
    setIsBeanModalOpen(true);
  };

  const addFlavorTag = () => {
    if (!flavorTagInput.trim()) return;
    const current = beanForm.flavorProfile || [];
    if (!current.includes(flavorTagInput.trim())) {
      setBeanForm({ ...beanForm, flavorProfile: [...current, flavorTagInput.trim()] });
    }
    setFlavorTagInput('');
  };

  const removeFlavorTag = (tag: string) => {
    const current = beanForm.flavorProfile || [];
    setBeanForm({ ...beanForm, flavorProfile: current.filter(t => t !== tag) });
  };

  const saveBean = () => {
    if (!beanForm.name?.trim() || !beanForm.origin?.trim()) return;

    let updatedBeans: GreenBean[];
    if (editingBeanId) {
      updatedBeans = settings.greenBeans.map(b =>
        b.id === editingBeanId ? ({ ...b, ...beanForm } as GreenBean) : b
      );
    } else {
      const newBean: GreenBean = {
        id: `bean-${Date.now()}`,
        name: beanForm.name.trim(),
        origin: beanForm.origin.trim(),
        region: beanForm.region?.trim(),
        farmOrStation: beanForm.farmOrStation?.trim(),
        variety: beanForm.variety?.trim(),
        process: beanForm.process || 'Washed',
        altitude: beanForm.altitude,
        cropYear: beanForm.cropYear?.trim(),
        supplier: beanForm.supplier?.trim(),
        densityGramsPerLiter: beanForm.densityGramsPerLiter,
        moisturePercent: beanForm.moisturePercent,
        stockRemainingGrams: beanForm.stockRemainingGrams || 1000,
        flavorProfile: beanForm.flavorProfile || [],
        notes: beanForm.notes?.trim(),
        createdAt: new Date().toISOString(),
      };
      updatedBeans = [...settings.greenBeans, newBean];
    }

    onUpdateSettings({ ...settings, greenBeans: updatedBeans });
    setIsBeanModalOpen(false);
  };

  const deleteBean = (id: string) => {
    if (confirm('Are you sure you want to delete this green bean?')) {
      const updated = settings.greenBeans.filter(b => b.id !== id);
      onUpdateSettings({ ...settings, greenBeans: updated });
    }
  };

  // Google Drive Connect
  const handleConnectGoogleDrive = async () => {
    setIsConnectingDrive(true);
    setDriveStatusMsg(null);

    try {
      if (!settings.googleDrive.clientId) {
        setDriveStatusMsg({
          text: 'Please enter your Google Cloud OAuth Client ID below before connecting.',
          type: 'error',
        });
        setIsConnectingDrive(false);
        return;
      }

      await googleDriveService.loadGoogleScripts();
      googleDriveService.initTokenClient(settings.googleDrive.clientId, () => {
        onUpdateSettings({
          ...settings,
          googleDrive: {
            ...settings.googleDrive,
            isConnected: true,
            lastSyncTimestamp: new Date().toISOString(),
          },
        });
        setDriveStatusMsg({ text: 'Google Drive connected successfully!', type: 'success' });
      });

      await googleDriveService.requestAccessToken();
      onUpdateSettings({
        ...settings,
        googleDrive: {
          ...settings.googleDrive,
          isConnected: true,
          lastSyncTimestamp: new Date().toISOString(),
        },
      });
      setDriveStatusMsg({ text: 'Google Drive connected successfully!', type: 'success' });
    } catch (err: any) {
      console.error(err);
      setDriveStatusMsg({
        text: err?.message || 'Failed to authenticate with Google Drive.',
        type: 'error',
      });
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleDisconnectDrive = () => {
    onUpdateSettings({
      ...settings,
      googleDrive: {
        ...settings.googleDrive,
        isConnected: false,
      },
    });
    setDriveStatusMsg({ text: 'Disconnected from Google Drive.', type: 'info' });
  };

  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);

  const handleCleanDuplicates = async () => {
    setIsCleaningDuplicates(true);
    setDriveStatusMsg(null);
    try {
      const file = await googleDriveService.findAppDataFile(settings.googleDrive.appDataFolderId);
      if (file) {
        onUpdateSettings({
          ...settings,
          googleDrive: {
            ...settings.googleDrive,
            appDataFileId: file.id,
          },
        });
        setDriveStatusMsg({
          text: `Cleaned up duplicate files! Single master app data file retained (ID: ${file.id.slice(0, 12)}...).`,
          type: 'success',
        });
      } else {
        setDriveStatusMsg({
          text: 'No duplicate app data files found on Google Drive.',
          type: 'info',
        });
      }
    } catch (err: any) {
      setDriveStatusMsg({ text: `Cleanup failed: ${err.message}`, type: 'error' });
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  // Export / Import Backup
  const handleExportBackup = async () => {
    const jsonStr = await exportAllData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roastcraft_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = await importAllData(text);
      onUpdateSettings(imported.settings);
      if (onRefreshData) onRefreshData();
      alert('Backup imported successfully!');
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-24">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-roast-text flex items-center gap-2">
          <Sliders className="w-6 h-6 text-amber-500" /> Settings & Configuration
        </h1>
        <p className="text-sm text-roast-muted mt-1">
          Manage your roasters, green coffee inventory, Google Drive sync folders, and app preferences. All data is persistent.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-roast-border mb-6 space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveSection('roasters')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
            activeSection === 'roasters'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-roast-muted hover:text-roast-text'
          }`}
        >
          <Flame className="w-4 h-4" /> Roasters ({settings.roasters.length})
        </button>

        <button
          onClick={() => setActiveSection('beans')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
            activeSection === 'beans'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-roast-muted hover:text-roast-text'
          }`}
        >
          <Coffee className="w-4 h-4" /> Green Beans ({settings.greenBeans.length})
        </button>

        <button
          onClick={() => setActiveSection('drive')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
            activeSection === 'drive'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-roast-muted hover:text-roast-text'
          }`}
        >
          <Cloud className="w-4 h-4" /> Google Drive Sync
          {settings.googleDrive.isConnected && (
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          )}
        </button>

        <button
          onClick={() => setActiveSection('general')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
            activeSection === 'general'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-roast-muted hover:text-roast-text'
          }`}
        >
          <Sliders className="w-4 h-4" /> Preferences & Backup
        </button>
      </div>

      {/* Section 1: Roasters */}
      {activeSection === 'roasters' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-roast-text">Available Roasters</h2>
              <p className="text-xs text-roast-muted">Selectable in your roasting logs</p>
            </div>
            <button
              onClick={openAddRoaster}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-xs shadow-md transition"
            >
              <Plus className="w-4 h-4" /> Add Roaster
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {settings.roasters.map((roaster) => (
              <div
                key={roaster.id}
                className="bg-roast-surface border border-roast-border rounded-xl p-4 flex flex-col justify-between hover:border-amber-800/60 transition group shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm text-roast-text">{roaster.name}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-800 text-amber-300 border border-stone-700">
                      {roaster.heatingType}
                    </span>
                  </div>
                  <p className="text-xs text-roast-muted mt-1 font-mono">Model: {roaster.model}</p>
                  <p className="text-xs text-roast-muted font-mono">Capacity: {roaster.capacityGrams}g</p>
                  {roaster.notes && (
                    <p className="text-xs text-stone-400 mt-2 bg-stone-900/60 p-2 rounded border border-stone-800/80 italic">
                      {roaster.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-roast-border">
                  <button
                    onClick={() => openEditRoaster(roaster)}
                    className="p-1.5 rounded text-stone-400 hover:text-amber-400 hover:bg-stone-800 transition"
                    title="Edit Roaster"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteRoaster(roaster.id)}
                    className="p-1.5 rounded text-stone-400 hover:text-rose-400 hover:bg-stone-800 transition"
                    title="Delete Roaster"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 2: Green Beans */}
      {activeSection === 'beans' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-roast-text">Green Bean Inventory</h2>
              <p className="text-xs text-roast-muted">Track origin, varietals, process, and stock levels</p>
            </div>
            <button
              onClick={openAddBean}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-xs shadow-md transition"
            >
              <Plus className="w-4 h-4" /> Add Green Bean
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {settings.greenBeans.map((bean) => (
              <div
                key={bean.id}
                className="bg-roast-surface border border-roast-border rounded-xl p-4 flex flex-col justify-between hover:border-amber-800/60 transition shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm text-roast-text">{bean.name}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60">
                      {bean.process}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1 text-xs text-roast-muted font-mono">
                    <p className="text-stone-300 font-sans">
                      🌍 {bean.origin} {bean.region ? `• ${bean.region}` : ''}
                    </p>
                    {bean.variety && <p>Varietal: {bean.variety}</p>}
                    {bean.altitude && <p>Altitude: {bean.altitude} MASL</p>}
                    <p>Stock: <span className="text-amber-400 font-semibold">{bean.stockRemainingGrams}g</span> remaining</p>
                  </div>

                  {/* Flavor Tags */}
                  {bean.flavorProfile && bean.flavorProfile.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {bean.flavorProfile.map((tag, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {bean.notes && (
                    <p className="text-xs text-stone-400 mt-2 bg-stone-900/60 p-2 rounded border border-stone-800/80 italic">
                      {bean.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-roast-border">
                  <button
                    onClick={() => openEditBean(bean)}
                    className="p-1.5 rounded text-stone-400 hover:text-amber-400 hover:bg-stone-800 transition"
                    title="Edit Bean"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteBean(bean.id)}
                    className="p-1.5 rounded text-stone-400 hover:text-rose-400 hover:bg-stone-800 transition"
                    title="Delete Bean"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Google Drive */}
      {activeSection === 'drive' && (
        <div className="max-w-3xl bg-roast-surface border border-roast-border rounded-xl p-6 shadow-xl space-y-6">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-roast-text flex items-center gap-2">
                <Cloud className="w-5 h-5 text-amber-500" /> Google Drive Configuration
              </h2>
              <button
                onClick={() => setShowDriveGuide(!showDriveGuide)}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                <Info className="w-3.5 h-3.5" /> Setup Guide
              </button>
            </div>
            <p className="text-xs text-roast-muted mt-1">
              Connect your Google Drive so the app can retrieve Artisan logs and save roast records directly to your cloud drive.
            </p>
          </div>

          {/* Quick Setup Guide Modal / Expandable */}
          {showDriveGuide && (
            <div className="bg-stone-900/90 border border-stone-800 rounded-lg p-4 text-xs text-stone-300 space-y-2">
              <h4 className="font-semibold text-amber-400">How to get your free Google OAuth credentials (3 minutes):</h4>
              <ol className="list-decimal list-inside space-y-1 text-stone-400">
                <li>Go to the <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-amber-400 underline inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="w-3 h-3" /></a>.</li>
                <li>Create a new project (e.g. "Coffee Roasting Log") and enable the <strong>Google Drive API</strong>.</li>
                <li>Go to <strong>APIs & Services &gt; Credentials</strong>, create an <strong>OAuth 2.0 Client ID</strong> (Application type: Web application).</li>
                <li>Add your app origin (e.g. <code>http://localhost:5173</code> or your custom domain) to Authorized JavaScript Origins.</li>
                <li>Copy the Client ID and paste it below.</li>
              </ol>
            </div>
          )}

          {/* Status Message */}
          {driveStatusMsg && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                driveStatusMsg.type === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-300'
                  : driveStatusMsg.type === 'error'
                  ? 'bg-rose-950/60 border border-rose-800/60 text-rose-300'
                  : 'bg-stone-900 border border-stone-800 text-stone-300'
              }`}
            >
              <Info className="w-4 h-4 flex-shrink-0" />
              <span>{driveStatusMsg.text}</span>
            </div>
          )}

          {/* OAuth Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">
                Google OAuth Client ID
              </label>
              <input
                type="text"
                placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com"
                value={settings.googleDrive.clientId}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    googleDrive: { ...settings.googleDrive, clientId: e.target.value.trim() },
                  })
                }
                className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-xs text-roast-text font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">
                Google API Key (Optional, for Picker)
              </label>
              <input
                type="text"
                placeholder="AIzaSy..."
                value={settings.googleDrive.apiKey}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    googleDrive: { ...settings.googleDrive, apiKey: e.target.value.trim() },
                  })
                }
                className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-xs text-roast-text font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Connection Actions */}
            <div className="flex items-center gap-3 pt-2">
              {!settings.googleDrive.isConnected ? (
                <button
                  onClick={handleConnectGoogleDrive}
                  disabled={isConnectingDrive}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-xs transition disabled:opacity-50"
                >
                  <Cloud className="w-4 h-4" />
                  {isConnectingDrive ? 'Connecting...' : 'Connect to Google Drive'}
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-emerald-400 flex items-center gap-1 font-mono">
                    <Check className="w-4 h-4" /> Connected to Google Drive
                  </span>
                  <button
                    onClick={handleDisconnectDrive}
                    className="px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 hover:text-rose-400 text-xs transition"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Drive Folders Configuration */}
          <div className="pt-4 border-t border-roast-border space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500">
              Designated Google Drive Folders
            </h3>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">
                Artisan Logs Google Drive Location (Folder ID / Name)
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Folder className="w-4 h-4 absolute left-3 top-2.5 text-stone-500" />
                  <input
                    type="text"
                    placeholder="e.g. Artisan_Logs or Google Drive folder ID"
                    value={settings.googleDrive.artisanLogsFolderName || ''}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        googleDrive: {
                          ...settings.googleDrive,
                          artisanLogsFolderName: e.target.value,
                          artisanLogsFolderId: e.target.value,
                        },
                      })
                    }
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg pl-9 pr-3 py-2 text-xs text-roast-text font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                Folder where your Artisan Scope .alog files are saved.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">
                App Data Google Drive Location (Folder ID / Name)
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Folder className="w-4 h-4 absolute left-3 top-2.5 text-stone-500" />
                  <input
                    type="text"
                    placeholder="e.g. Coffee_Roasting_Data or folder ID"
                    value={settings.googleDrive.appDataFolderName || ''}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        googleDrive: {
                          ...settings.googleDrive,
                          appDataFolderName: e.target.value,
                          appDataFolderId: e.target.value,
                        },
                      })
                    }
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg pl-9 pr-3 py-2 text-xs text-roast-text font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const same = settings.googleDrive.artisanLogsFolderName;
                    onUpdateSettings({
                      ...settings,
                      googleDrive: {
                        ...settings.googleDrive,
                        appDataFolderName: same,
                        appDataFolderId: same,
                      },
                    });
                  }}
                  className="px-2.5 py-2 rounded-lg bg-stone-900 border border-stone-800 text-[11px] text-stone-400 hover:text-amber-400 transition whitespace-nowrap"
                >
                  Use Same Folder
                </button>
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                Folder where app state (coffee_roasting_app_data.json) will be saved and synchronized.
              </p>
            </div>

            {/* Single JSON File & Duplicate Cleanup */}
            <div className="bg-stone-900/60 p-3.5 rounded-xl border border-stone-800 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-stone-200">
                    Single Master JSON File Storage
                  </h4>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    All logs, roasters, and settings are saved into strictly <strong>one</strong> file (<code>coffee_roasting_app_data.json</code>) updated in place with zero duplicates.
                  </p>
                </div>
                {settings.googleDrive.isConnected && (
                  <button
                    type="button"
                    onClick={handleCleanDuplicates}
                    disabled={isCleaningDuplicates}
                    className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] transition whitespace-nowrap disabled:opacity-50"
                  >
                    {isCleaningDuplicates ? 'Cleaning...' : 'Clean Up Duplicate Files'}
                  </button>
                )}
              </div>
              {settings.googleDrive.appDataFileId && (
                <p className="text-[10px] font-mono text-emerald-400">
                  Active Master File ID: {settings.googleDrive.appDataFileId}
                </p>
              )}
            </div>

            {/* Google Sheet Sync Option */}
            <div className="bg-stone-900/60 p-3.5 rounded-xl border border-stone-800 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="syncGoogleSheet"
                    checked={settings.googleDrive.syncToGoogleSheet !== false}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        googleDrive: {
                          ...settings.googleDrive,
                          syncToGoogleSheet: e.target.checked,
                        },
                      })
                    }
                    className="mt-0.5 rounded border-stone-700 bg-stone-950 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <label htmlFor="syncGoogleSheet" className="text-xs font-semibold text-stone-200 cursor-pointer">
                      Also sync all roast logs into a Google Sheet (<code>RoastCraft_Roast_Logs</code>)
                    </label>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      Automatically maintains an organized spreadsheet of all roast dates, weights, loss %, ratings, DTR%, and tasting notes directly on your Google Drive.
                    </p>
                  </div>
                </div>

                {settings.googleDrive.sheetWebViewLink && (
                  <a
                    href={settings.googleDrive.sheetWebViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 text-xs transition font-medium whitespace-nowrap"
                  >
                    Open Sheet <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 4: General Preferences & Backup */}
      {activeSection === 'general' && (
        <div className="max-w-3xl bg-roast-surface border border-roast-border rounded-xl p-6 shadow-xl space-y-6">
          <h2 className="text-base font-semibold text-roast-text flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-500" /> Roasting Preferences & Data Backup
          </h2>

          <div className="space-y-4">
            {/* Temp Unit */}
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">
                Temperature Unit
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onUpdateSettings({ ...settings, temperatureUnit: 'C' })}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                    settings.temperatureUnit === 'C'
                      ? 'bg-amber-600 text-stone-950'
                      : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
                  }`}
                >
                  Celsius (°C)
                </button>
                <button
                  onClick={() => onUpdateSettings({ ...settings, temperatureUnit: 'F' })}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                    settings.temperatureUnit === 'F'
                      ? 'bg-amber-600 text-stone-950'
                      : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
                  }`}
                >
                  Fahrenheit (°F)
                </button>
              </div>
            </div>

            {/* RoR Smoothing */}
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">
                RoR Smoothing Window (Seconds)
              </label>
              <select
                value={settings.rorSmoothingSeconds}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, rorSmoothingSeconds: Number(e.target.value) })
                }
                className="bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-xs text-roast-text focus:border-amber-500 focus:outline-none"
              >
                <option value={15}>15 seconds (Responsive / Fluid Bed)</option>
                <option value={30}>30 seconds (Artisan Standard / Drum)</option>
                <option value={45}>45 seconds (Heavy Smoothing)</option>
              </select>
            </div>

            {/* Optional Gemini API Key for Research */}
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">
                Google Gemini API Key (Optional, for Live Green Bean Deep Research)
              </label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={settings.geminiApiKey || ''}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, geminiApiKey: e.target.value.trim() })
                }
                className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-xs text-roast-text font-mono focus:border-amber-500 focus:outline-none"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                Allows the Research page to perform real-time AI deep dives into specific farms, washing stations, or lots.
              </p>
            </div>
          </div>

          {/* Backup & Restore */}
          <div className="pt-6 border-t border-roast-border space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500">
              Data Backup & Restore (Persistent Storage)
            </h3>
            <p className="text-xs text-roast-muted">
              Export all your roasters, green beans, and roasting logs to a standalone JSON file, or restore from an existing backup.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handleExportBackup}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-stone-900 border border-stone-800 hover:border-amber-600/60 text-xs text-stone-200 transition"
              >
                <Download className="w-4 h-4 text-amber-500" /> Export Backup (JSON)
              </button>

              <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-stone-900 border border-stone-800 hover:border-amber-600/60 text-xs text-stone-200 cursor-pointer transition">
                <Upload className="w-4 h-4 text-emerald-500" /> Import Backup (JSON)
                <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Roaster */}
      {isRoasterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-roast-surface border border-roast-border rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-roast-text flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500" />
              {editingRoasterId ? 'Edit Roaster' : 'Add Roaster'}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Roaster Name</label>
                <input
                  type="text"
                  placeholder="e.g. Aillio Bullet R1 V2"
                  value={roasterForm.name || ''}
                  onChange={(e) => setRoasterForm({ ...roasterForm, name: e.target.value })}
                  className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Model / Specs</label>
                <input
                  type="text"
                  placeholder="e.g. 1kg Induction Drum"
                  value={roasterForm.model || ''}
                  onChange={(e) => setRoasterForm({ ...roasterForm, model: e.target.value })}
                  className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Heating Type</label>
                  <select
                    value={roasterForm.heatingType}
                    onChange={(e) => setRoasterForm({ ...roasterForm, heatingType: e.target.value as any })}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text focus:border-amber-500 focus:outline-none"
                  >
                    <option value="Electric">Electric</option>
                    <option value="Gas">Gas</option>
                    <option value="Fluid Bed">Fluid Bed</option>
                    <option value="Infrared">Infrared</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Capacity (Grams)</label>
                  <input
                    type="number"
                    value={roasterForm.capacityGrams || 500}
                    onChange={(e) => setRoasterForm({ ...roasterForm, capacityGrams: Number(e.target.value) })}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Notes / Probes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. IBTS infrared probe, 3mm BT probe, connected via USB to Artisan"
                  value={roasterForm.notes || ''}
                  onChange={(e) => setRoasterForm({ ...roasterForm, notes: e.target.value })}
                  className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-roast-border">
              <button
                onClick={() => setIsRoasterModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200 text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={saveRoaster}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-xs transition"
              >
                Save Roaster
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Green Bean */}
      {isBeanModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-roast-surface border border-roast-border rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4 my-8">
            <h3 className="text-base font-semibold text-roast-text flex items-center gap-2">
              <Coffee className="w-5 h-5 text-amber-500" />
              {editingBeanId ? 'Edit Green Bean' : 'Add Green Bean'}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Bean Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Ethiopia Yirgacheffe Chelchele"
                  value={beanForm.name || ''}
                  onChange={(e) => setBeanForm({ ...beanForm, name: e.target.value })}
                  className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Origin Country *</label>
                  <input
                    type="text"
                    placeholder="e.g. Ethiopia"
                    value={beanForm.origin || ''}
                    onChange={(e) => setBeanForm({ ...beanForm, origin: e.target.value })}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Region / Farm</label>
                  <input
                    type="text"
                    placeholder="e.g. Gedeo, Chelchele Station"
                    value={beanForm.region || ''}
                    onChange={(e) => setBeanForm({ ...beanForm, region: e.target.value })}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Variety</label>
                  <input
                    type="text"
                    placeholder="e.g. Heirloom, Geisha, Bourbon"
                    value={beanForm.variety || ''}
                    onChange={(e) => setBeanForm({ ...beanForm, variety: e.target.value })}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Processing Method</label>
                  <select
                    value={beanForm.process}
                    onChange={(e) => setBeanForm({ ...beanForm, process: e.target.value as any })}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text focus:border-amber-500 focus:outline-none"
                  >
                    <option value="Washed">Washed</option>
                    <option value="Natural">Natural</option>
                    <option value="Honey">Honey</option>
                    <option value="Anaerobic">Anaerobic</option>
                    <option value="Wet-Hulled">Wet-Hulled</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Altitude (MASL)</label>
                  <input
                    type="number"
                    placeholder="2000"
                    value={beanForm.altitude || ''}
                    onChange={(e) => setBeanForm({ ...beanForm, altitude: Number(e.target.value) })}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Density (g/L)</label>
                  <input
                    type="number"
                    placeholder="710"
                    value={beanForm.densityGramsPerLiter || ''}
                    onChange={(e) => setBeanForm({ ...beanForm, densityGramsPerLiter: Number(e.target.value) })}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Stock (g)</label>
                  <input
                    type="number"
                    value={beanForm.stockRemainingGrams || 1000}
                    onChange={(e) => setBeanForm({ ...beanForm, stockRemainingGrams: Number(e.target.value) })}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Flavor Tags */}
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Flavor Descriptors</label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="e.g. Jasmine, Peach, Bergamot"
                    value={flavorTagInput}
                    onChange={(e) => setFlavorTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addFlavorTag();
                      }
                    }}
                    className="flex-1 bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-roast-text focus:border-amber-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={addFlavorTag}
                    className="px-3 py-1.5 rounded-lg bg-stone-800 text-stone-200 hover:bg-stone-700 transition"
                  >
                    Add
                  </button>
                </div>
                {beanForm.flavorProfile && beanForm.flavorProfile.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {beanForm.flavorProfile.map((tag, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeFlavorTag(tag)}
                          className="hover:text-rose-400"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Tasting / Sourcing Notes</label>
                <textarea
                  rows={2}
                  placeholder="Cupping score, importer notes, density insights..."
                  value={beanForm.notes || ''}
                  onChange={(e) => setBeanForm({ ...beanForm, notes: e.target.value })}
                  className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-roast-border">
              <button
                onClick={() => setIsBeanModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200 text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={saveBean}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-xs transition"
              >
                Save Green Bean
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
