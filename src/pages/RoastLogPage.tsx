import React, { useState } from 'react';
import {
  AppSettings,
  ParsedArtisanLog,
  RoastLog,
  RoastRating,
} from '../types';
import {
  Flame,
  Plus,
  Search,
  Calendar,
  Coffee,
  Upload,
  Cloud,
  CloudOff,
  Trash2,
  Edit2,
  FileText,
  CheckCircle2,
  X,
  FileCheck,
  RefreshCw,
  FolderSearch
} from 'lucide-react';
import { RoastChart } from '../components/RoastChart';
import { createSampleArtisanLog, parseArtisanFile } from '../services/artisanParser';
import { googleDriveService } from '../services/googleDriveService';

interface RoastLogPageProps {
  logs: RoastLog[];
  settings: AppSettings;
  onSaveLog: (log: RoastLog) => void;
  onDeleteLog: (logId: string) => void;
  onSelectBeanForResearch?: (beanId: string) => void;
  onUpdateSettings?: (settings: AppSettings) => void;
}

const RATING_COLORS: Record<RoastRating, { bg: string; text: string; border: string }> = {
  Excellent: { bg: 'bg-emerald-950/80', text: 'text-emerald-400', border: 'border-emerald-600/70' },
  'Very good': { bg: 'bg-teal-950/80', text: 'text-teal-300', border: 'border-teal-600/70' },
  Good: { bg: 'bg-amber-950/80', text: 'text-amber-400', border: 'border-amber-600/70' },
  OK: { bg: 'bg-stone-800/90', text: 'text-stone-300', border: 'border-stone-700' },
  Bad: { bg: 'bg-rose-950/80', text: 'text-rose-400', border: 'border-rose-700/70' },
};

const FLAVOR_TAGS = [
  'Floral', 'Jasmine', 'Bergamot', 'Peach', 'Apricot', 'Citrus', 'Lemon',
  'Blackberry', 'Blueberry', 'Strawberry', 'Chocolate', 'Caramel', 'Honey',
  'Panela', 'Cinnamon', 'Nutty', 'Clean Acidity', 'Juicy Body', 'Winey'
];

export const RoastLogPage: React.FC<RoastLogPageProps> = ({
  logs,
  settings,
  onSaveLog,
  onDeleteLog,
  onSelectBeanForResearch,
  onUpdateSettings,
}) => {
  const [selectedLogId, setSelectedLogId] = useState<string | null>(
    logs.length > 0 ? logs[0].id : null
  );

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRating, setFilterRating] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // New/Edit Log Form State
  const [formData, setFormData] = useState<Partial<RoastLog>>({
    date: new Date().toISOString().slice(0, 16),
    roasterId: settings.roasters[0]?.id || '',
    beanId: settings.greenBeans[0]?.id || '',
    greenWeightGrams: 250,
    roastedWeightGrams: 215,
    rating: 'Excellent',
    tastingNotes: '',
    flavorDescriptors: [],
    roastDegree: 'City',
  });
  const [uploadedArtisanLog, setUploadedArtisanLog] = useState<ParsedArtisanLog | null>(null);
  const [isLoadingDriveFiles, setIsLoadingDriveFiles] = useState(false);
  const [driveArtisanFiles, setDriveArtisanFiles] = useState<{ id: string; name: string; modifiedTime?: string }[]>([]);
  const [driveFetchError, setDriveFetchError] = useState<string | null>(null);
  const [isAuthenticatingDrive, setIsAuthenticatingDrive] = useState(false);
  const [searchAllDrive, setSearchAllDrive] = useState(false);

  // Selected Log
  const selectedLog = logs.find(l => l.id === selectedLogId) || logs[0];

  // Roaster and Bean lookups
  const getRoasterName = (id: string) =>
    settings.roasters.find(r => r.id === id)?.name || 'Unknown Roaster';
  const getBean = (id: string) =>
    settings.greenBeans.find(b => b.id === id);

  // Filtered Logs
  const filteredLogs = logs.filter(log => {
    const bean = getBean(log.beanId);
    const roasterName = getRoasterName(log.roasterId);
    const matchesSearch =
      (log.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bean?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bean?.origin || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      roasterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.tastingNotes.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRating = filterRating === 'ALL' || log.rating === filterRating;

    return matchesSearch && matchesRating;
  });

  // Calculate weight loss
  const calculateWeightLoss = (green?: number, roasted?: number) => {
    if (!green || !roasted || green <= 0 || roasted <= 0) return undefined;
    return Number((((green - roasted) / green) * 100).toFixed(1));
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingLogId(null);
    const sampleLog = createSampleArtisanLog(
      'Ethiopia_Yirgacheffe_Washed_Filter.alog',
      'Excellent'
    );
    setFormData({
      date: new Date().toISOString().slice(0, 16),
      roasterId: settings.roasters[0]?.id || '',
      beanId: settings.greenBeans[0]?.id || '',
      greenWeightGrams: 250,
      roastedWeightGrams: 214,
      rating: 'Excellent',
      tastingNotes: 'Crisp bergamot, candied peach, delicate jasmine tea body with bright citric acidity.',
      flavorDescriptors: ['Bergamot', 'Peach', 'Jasmine', 'Clean Acidity'],
      roastDegree: 'City',
    });
    setUploadedArtisanLog(sampleLog);
    setIsModalOpen(true);
    setDriveFetchError(null);
    checkAndFetchDriveFiles(false);
  };

  // Open Edit Modal - guarantees current log's linked artisan file is displayed & selectable
  const handleOpenEditModal = (log: RoastLog) => {
    setEditingLogId(log.id);
    setFormData({
      date: log.date,
      roasterId: log.roasterId,
      beanId: log.beanId,
      greenWeightGrams: log.greenWeightGrams,
      roastedWeightGrams: log.roastedWeightGrams,
      rating: log.rating,
      tastingNotes: log.tastingNotes,
      flavorDescriptors: log.flavorDescriptors || [],
      roastDegree: log.roastDegree || 'City',
      artisanLogDriveFileId: log.artisanLogDriveFileId,
      artisanLogDriveFileName: log.artisanLogDriveFileName,
    });
    setUploadedArtisanLog(log.artisanLogParsed || null);
    setIsModalOpen(true);
    setDriveFetchError(null);
    checkAndFetchDriveFiles(false, log.artisanLogDriveFileId, log.artisanLogDriveFileName);
  };

  // Fetch Google Drive Artisan Files
  const checkAndFetchDriveFiles = async (
    forceSearchAll: boolean = false,
    existingFileId?: string,
    existingFileName?: string
  ) => {
    if (!settings.googleDrive.isConnected && !googleDriveService.hasValidToken()) {
      return;
    }

    setIsLoadingDriveFiles(true);
    setDriveFetchError(null);
    try {
      const folderTarget = forceSearchAll
        ? undefined
        : (settings.googleDrive.artisanLogsFolderId || settings.googleDrive.artisanLogsFolderName);

      const files = await googleDriveService.listArtisanFilesInFolder(folderTarget);
      const mapped = files.map(f => ({
        id: f.id,
        name: f.name,
        modifiedTime: f.modifiedTime,
      }));

      // Prepend currently linked file if not already in the search results
      const targetId = existingFileId || formData.artisanLogDriveFileId;
      const targetName = existingFileName || formData.artisanLogDriveFileName;

      if (targetId && !mapped.some(f => f.id === targetId)) {
        mapped.unshift({
          id: targetId,
          name: targetName || 'Currently Linked Artisan File',
          modifiedTime: undefined,
        });
      }

      setDriveArtisanFiles(mapped);
    } catch (err: any) {
      console.warn('Could not fetch drive files:', err);
      setDriveFetchError(err?.message || 'Could not fetch files from Google Drive');
    } finally {
      setIsLoadingDriveFiles(false);
    }
  };

  // Connect Google Drive directly from modal
  const handleConnectDriveFromModal = async () => {
    setIsAuthenticatingDrive(true);
    setDriveFetchError(null);
    try {
      if (!settings.googleDrive.clientId) {
        alert('Please enter your Google Cloud OAuth Client ID in Settings first.');
        return;
      }
      await googleDriveService.loadGoogleScripts();
      googleDriveService.initTokenClient(settings.googleDrive.clientId);
      await googleDriveService.requestAccessToken();
      if (onUpdateSettings) {
        onUpdateSettings({
          ...settings,
          googleDrive: {
            ...settings.googleDrive,
            isConnected: true,
            lastSyncTimestamp: new Date().toISOString(),
          },
        });
      }
      await checkAndFetchDriveFiles(searchAllDrive);
    } catch (err: any) {
      setDriveFetchError(err?.message || 'Authentication failed');
    } finally {
      setIsAuthenticatingDrive(false);
    }
  };

  // Handle local file upload (.alog, .json, .csv)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseArtisanFile(text, file.name);
      setUploadedArtisanLog(parsed);
      setFormData(prev => ({
        ...prev,
        artisanLogDriveFileName: file.name,
      }));
    } catch (err: any) {
      alert(`Could not parse Artisan log file: ${err.message}`);
    }
  };

  // Handle select from Google Drive
  const handleSelectDriveFile = async (fileId: string, fileName: string) => {
    try {
      setIsLoadingDriveFiles(true);
      const content = await googleDriveService.downloadFileContent(fileId);
      const parsed = parseArtisanFile(content, fileName);
      setUploadedArtisanLog(parsed);
      setFormData(prev => ({
        ...prev,
        artisanLogDriveFileId: fileId,
        artisanLogDriveFileName: fileName,
      }));
    } catch (err: any) {
      alert(`Failed to load Artisan file from Drive: ${err.message}`);
    } finally {
      setIsLoadingDriveFiles(false);
    }
  };

  // Save log
  const handleSaveRoast = () => {
    if (!formData.roasterId || !formData.beanId) {
      alert('Please select a roaster and green bean');
      return;
    }

    const weightLoss = calculateWeightLoss(
      formData.greenWeightGrams,
      formData.roastedWeightGrams
    );

    const logToSave: RoastLog = {
      id: editingLogId || `roast-${Date.now()}`,
      date: formData.date || new Date().toISOString(),
      roasterId: formData.roasterId,
      beanId: formData.beanId,
      greenWeightGrams: formData.greenWeightGrams || 250,
      roastedWeightGrams: formData.roastedWeightGrams,
      weightLossPercent: weightLoss,
      rating: formData.rating || 'Good',
      tastingNotes: formData.tastingNotes?.trim() || '',
      flavorDescriptors: formData.flavorDescriptors || [],
      roastDegree: formData.roastDegree || 'City',
      artisanLogDriveFileId: formData.artisanLogDriveFileId,
      artisanLogDriveFileName: formData.artisanLogDriveFileName || uploadedArtisanLog?.fileName,
      artisanLogParsed: uploadedArtisanLog || undefined,
      createdAt: editingLogId ? (selectedLog?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveLog(logToSave);
    setSelectedLogId(logToSave.id);
    setIsModalOpen(false);
  };

  const toggleFlavorDescriptor = (tag: string) => {
    const current = formData.flavorDescriptors || [];
    if (current.includes(tag)) {
      setFormData({ ...formData, flavorDescriptors: current.filter(t => t !== tag) });
    } else {
      setFormData({ ...formData, flavorDescriptors: [...current, tag] });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 pb-24">
      {/* Top Bar: Title & New Roast button */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-roast-text flex items-center gap-2">
            <Flame className="w-6 h-6 text-amber-500" /> Roasting Logs
          </h1>
          <p className="text-sm text-roast-muted mt-0.5">
            Record batches, inspect Artisan roast curves, and document cup quality
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs shadow-lg shadow-amber-950/50 transition"
        >
          <Plus className="w-4 h-4" /> New Roast Log
        </button>
      </div>

      {/* Main Grid: Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Log List & Search (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-roast-surface border border-roast-border rounded-xl p-3 shadow-lg space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-500" />
              <input
                type="text"
                placeholder="Search by bean, roaster, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-stone-900 border border-stone-800 rounded-lg pl-9 pr-3 py-2 text-xs text-roast-text placeholder-stone-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Rating Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
              <span className="text-stone-500 text-xs px-1">Filter:</span>
              {['ALL', 'Excellent', 'Very good', 'Good', 'OK', 'Bad'].map((rating) => (
                <button
                  key={rating}
                  onClick={() => setFilterRating(rating)}
                  className={`px-2 py-0.5 rounded-full transition whitespace-nowrap font-medium ${
                    filterRating === rating
                      ? 'bg-amber-600 text-stone-950 font-semibold'
                      : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
                  }`}
                >
                  {rating}
                </button>
              ))}
            </div>
          </div>

          {/* List of Logs */}
          <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
            {filteredLogs.length === 0 ? (
              <div className="bg-roast-surface border border-roast-border rounded-xl p-8 text-center text-roast-muted">
                <Coffee className="w-8 h-8 text-stone-600 mx-auto mb-2" />
                <p className="text-sm font-medium">No roast logs found</p>
                <p className="text-xs text-stone-500 mt-1">
                  Click "New Roast Log" above to record your first batch!
                </p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const bean = getBean(log.beanId);
                const isSelected = selectedLog?.id === log.id;
                const ratingStyle = RATING_COLORS[log.rating] || RATING_COLORS.Good;

                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLogId(log.id)}
                    className={`bg-roast-surface border rounded-xl p-4 cursor-pointer transition shadow-md ${
                      isSelected
                        ? 'border-amber-500/80 ring-1 ring-amber-500/50 bg-[#1c1815]'
                        : 'border-roast-border hover:border-stone-700 hover:bg-stone-900/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${ratingStyle.bg} ${ratingStyle.text} ${ratingStyle.border}`}
                          >
                            {log.rating}
                          </span>
                          <span className="text-xs font-mono text-stone-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-stone-500" />
                            {new Date(log.date).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <h3 className="font-semibold text-sm text-roast-text mt-1.5">
                          {bean?.name || 'Custom Blend / Bean'}
                        </h3>
                        <p className="text-xs text-roast-muted font-mono mt-0.5">
                          Roaster: {getRoasterName(log.roasterId)}
                        </p>
                      </div>

                      {/* Weight Loss Badge */}
                      {log.weightLossPercent !== undefined && (
                        <div className="text-right">
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-300">
                            -{log.weightLossPercent}%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Tasting notes snippet */}
                    {log.tastingNotes && (
                      <p className="text-xs text-stone-400 mt-2 line-clamp-2 italic">
                        "{log.tastingNotes}"
                      </p>
                    )}

                    {/* Artisan curve tag */}
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-stone-800/80 text-[11px]">
                      <span className="text-stone-500 flex items-center gap-1">
                        <FileCheck className="w-3.5 h-3.5 text-amber-500" />
                        {log.artisanLogParsed ? (
                          <span className="text-amber-400/90 font-mono">
                            Artisan Curve ({Math.round(log.artisanLogParsed.metrics.totalTimeSec / 60)}m, DTR {log.artisanLogParsed.metrics.developmentPercent}%)
                          </span>
                        ) : (
                          <span className="text-stone-500">No curve attached</span>
                        )}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditModal(log);
                          }}
                          className="text-stone-400 hover:text-amber-400 p-1"
                          title="Edit Log"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this roast log?')) onDeleteLog(log.id);
                          }}
                          className="text-stone-400 hover:text-rose-400 p-1"
                          title="Delete Log"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Roast Inspector & Artisan Chart (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {selectedLog ? (
            <div className="space-y-4">
              {/* Selected Roast Card Header */}
              <div className="bg-roast-surface border border-roast-border rounded-xl p-5 shadow-xl">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border ${
                          RATING_COLORS[selectedLog.rating]?.bg || ''
                        } ${RATING_COLORS[selectedLog.rating]?.text || ''} ${
                          RATING_COLORS[selectedLog.rating]?.border || ''
                        }`}
                      >
                        {selectedLog.rating}
                      </span>
                      <span className="text-xs font-mono text-stone-400">
                        {new Date(selectedLog.date).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-roast-text mt-1.5">
                      {getBean(selectedLog.beanId)?.name || 'Custom Bean'}
                    </h2>
                    <p className="text-xs text-roast-muted mt-0.5">
                      Roasted on <span className="text-stone-200 font-semibold">{getRoasterName(selectedLog.roasterId)}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {onSelectBeanForResearch && selectedLog.beanId && (
                      <button
                        onClick={() => onSelectBeanForResearch(selectedLog.beanId)}
                        className="px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-xs text-amber-400 hover:border-amber-600 transition flex items-center gap-1.5"
                      >
                        <Coffee className="w-3.5 h-3.5" /> Research Bean
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenEditModal(selectedLog)}
                      className="px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-xs text-stone-300 hover:text-amber-400 transition flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                  </div>
                </div>

                {/* Batch Metrics Pills */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-roast-border text-xs">
                  <div className="bg-stone-900/80 p-2.5 rounded-lg border border-stone-800">
                    <span className="text-stone-500 block text-[11px]">Green Weight</span>
                    <span className="font-mono font-semibold text-stone-200 mt-0.5 block">
                      {selectedLog.greenWeightGrams}g
                    </span>
                  </div>

                  <div className="bg-stone-900/80 p-2.5 rounded-lg border border-stone-800">
                    <span className="text-stone-500 block text-[11px]">Roasted Weight</span>
                    <span className="font-mono font-semibold text-stone-200 mt-0.5 block">
                      {selectedLog.roastedWeightGrams ? `${selectedLog.roastedWeightGrams}g` : 'N/A'}
                    </span>
                  </div>

                  <div className="bg-stone-900/80 p-2.5 rounded-lg border border-stone-800">
                    <span className="text-stone-500 block text-[11px]">Weight Loss</span>
                    <span className="font-mono font-semibold text-amber-400 mt-0.5 block">
                      {selectedLog.weightLossPercent ? `${selectedLog.weightLossPercent}%` : 'N/A'}
                    </span>
                  </div>

                  <div className="bg-stone-900/80 p-2.5 rounded-lg border border-stone-800">
                    <span className="text-stone-500 block text-[11px]">Roast Degree</span>
                    <span className="font-mono font-semibold text-stone-200 mt-0.5 block">
                      {selectedLog.roastDegree || 'City'}
                    </span>
                  </div>
                </div>

                {/* Tasting Notes & Descriptors */}
                <div className="mt-4 pt-3 border-t border-roast-border">
                  <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
                    Tasting Notes & Sensory Evaluation
                  </h4>
                  {selectedLog.tastingNotes ? (
                    <p className="text-sm text-stone-200 bg-stone-900/60 p-3 rounded-lg border border-stone-800 leading-relaxed">
                      {selectedLog.tastingNotes}
                    </p>
                  ) : (
                    <p className="text-xs text-stone-500 italic">No tasting notes added yet.</p>
                  )}

                  {selectedLog.flavorDescriptors && selectedLog.flavorDescriptors.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {selectedLog.flavorDescriptors.map((desc, i) => (
                        <span
                          key={i}
                          className="text-xs px-2.5 py-0.5 rounded-full bg-amber-950/70 text-amber-300 border border-amber-800/60 font-medium"
                        >
                          {desc}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Artisan Roast Chart */}
              {selectedLog.artisanLogParsed ? (
                <RoastChart
                  parsedLog={selectedLog.artisanLogParsed}
                  temperatureUnit={settings.temperatureUnit}
                  title={`Artisan Curve: ${selectedLog.artisanLogDriveFileName || selectedLog.artisanLogParsed.fileName}`}
                />
              ) : (
                <div className="bg-roast-surface border border-roast-border rounded-xl p-8 text-center text-roast-muted shadow-lg">
                  <Flame className="w-8 h-8 text-stone-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-stone-300">No Artisan roast curve attached</p>
                  <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                    Edit this roast log to link an Artisan log file (.alog, .json, .csv) from Google Drive or your computer.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-roast-surface border border-roast-border rounded-xl p-12 text-center text-roast-muted shadow-lg">
              <Coffee className="w-10 h-10 text-stone-600 mx-auto mb-3" />
              <p className="text-base font-semibold text-stone-300">Select a roast log</p>
              <p className="text-xs text-stone-500 mt-1">
                Choose a roast log from the list on the left to view full Artisan curves and tasting notes.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create / Edit Roast Log */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-roast-surface border border-roast-border rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-roast-border">
              <h3 className="text-lg font-bold text-roast-text flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-500" />
                {editingLogId ? 'Edit Roast Log' : 'Create New Roast Log'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Row 1: Date, Roaster, Bean */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={formData.date || ''}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Roaster Used *</label>
                  <select
                    value={formData.roasterId}
                    onChange={(e) => setFormData({ ...formData, roasterId: e.target.value })}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text focus:border-amber-500 focus:outline-none"
                  >
                    {settings.roasters.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Green Beans *</label>
                  <select
                    value={formData.beanId}
                    onChange={(e) => setFormData({ ...formData, beanId: e.target.value })}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text focus:border-amber-500 focus:outline-none"
                  >
                    {settings.greenBeans.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.origin})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Weights & Degree */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Green Weight (g) *</label>
                  <input
                    type="number"
                    value={formData.greenWeightGrams || 250}
                    onChange={(e) =>
                      setFormData({ ...formData, greenWeightGrams: Number(e.target.value) })
                    }
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Roasted Weight (g)</label>
                  <input
                    type="number"
                    placeholder="215"
                    value={formData.roastedWeightGrams || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, roastedWeightGrams: Number(e.target.value) })
                    }
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Roast Degree</label>
                  <select
                    value={formData.roastDegree}
                    onChange={(e) => setFormData({ ...formData, roastDegree: e.target.value as any })}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text focus:border-amber-500 focus:outline-none"
                  >
                    <option value="Light">Light / Cinnamon</option>
                    <option value="City">City (Light-Medium Filter)</option>
                    <option value="City+">City+ (Medium)</option>
                    <option value="Full City">Full City (Omni / Espresso)</option>
                    <option value="Dark">Dark / French</option>
                  </select>
                </div>
              </div>

              {/* Classification Rating */}
              <div>
                <label className="block text-stone-300 font-semibold mb-1.5">
                  Roast Classification Rating *
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {(['Excellent', 'Very good', 'Good', 'OK', 'Bad'] as RoastRating[]).map((r) => {
                    const isSelected = formData.rating === r;
                    const style = RATING_COLORS[r];
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFormData({ ...formData, rating: r })}
                        className={`py-2 px-1 rounded-lg text-xs font-bold transition text-center border ${
                          isSelected
                            ? `${style.bg} ${style.text} ${style.border} ring-2 ring-amber-500/50`
                            : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
                        }`}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Artisan Roast Log Link / Upload */}
              <div className="p-3.5 bg-stone-900/80 border border-stone-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-stone-200 font-bold flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-500" />
                    Artisan Roast Log File (.alog / .json / .csv)
                  </label>
                  {uploadedArtisanLog && (
                    <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {uploadedArtisanLog.fileName} ({uploadedArtisanLog.dataPoints.length} pts)
                    </span>
                  )}
                </div>

                {/* Option 1: Pick from Google Drive */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-300 font-semibold flex items-center gap-1.5">
                      <Cloud className={`w-3.5 h-3.5 ${settings.googleDrive.isConnected || googleDriveService.hasValidToken() ? 'text-emerald-400' : 'text-stone-500'}`} />
                      Google Drive Artisan Logs
                    </span>

                    {/* Action buttons: Refresh & Search All */}
                    {(settings.googleDrive.isConnected || googleDriveService.hasValidToken()) && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const newMode = !searchAllDrive;
                            setSearchAllDrive(newMode);
                            checkAndFetchDriveFiles(newMode);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono transition border ${
                            searchAllDrive
                              ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                              : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
                          }`}
                        >
                          {searchAllDrive ? 'Searching All Drive' : 'Search All Drive'}
                        </button>

                        <button
                          type="button"
                          disabled={isLoadingDriveFiles}
                          onClick={() => checkAndFetchDriveFiles(searchAllDrive)}
                          className="text-stone-400 hover:text-amber-400 p-1 rounded hover:bg-stone-800 transition disabled:opacity-50"
                          title="Refresh files from Google Drive"
                        >
                          <RefreshCw className={`w-3 h-3 ${isLoadingDriveFiles ? 'animate-spin text-amber-500' : ''}`} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* If not connected or session expired */}
                  {!settings.googleDrive.isConnected && !googleDriveService.hasValidToken() ? (
                    <div className="bg-stone-950 p-3 rounded-lg border border-stone-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-stone-400">
                        <CloudOff className="w-4 h-4 text-stone-500 flex-shrink-0" />
                        <span>Connect Google Drive to select your .alog files.</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleConnectDriveFromModal}
                        disabled={isAuthenticatingDrive}
                        className="px-3 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs transition disabled:opacity-50"
                      >
                        {isAuthenticatingDrive ? 'Connecting...' : 'Connect Drive'}
                      </button>
                    </div>
                  ) : (
                    /* Connected: Display file dropdown */
                    <div className="space-y-2">
                      {isLoadingDriveFiles ? (
                        <div className="flex items-center gap-2 text-xs text-stone-400 bg-stone-950 px-3 py-2 rounded-lg border border-stone-800">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
                          <span>Searching Google Drive for .alog, .json, and .csv files...</span>
                        </div>
                      ) : driveArtisanFiles.length > 0 ? (
                        <select
                          value={formData.artisanLogDriveFileId || ''}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            if (!selectedId) {
                              setFormData(prev => ({
                                ...prev,
                                artisanLogDriveFileId: undefined,
                                artisanLogDriveFileName: undefined,
                              }));
                              return;
                            }
                            const file = driveArtisanFiles.find(f => f.id === selectedId);
                            if (file) handleSelectDriveFile(file.id, file.name);
                          }}
                          className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-roast-text font-mono focus:border-amber-500 focus:outline-none"
                        >
                          <option value="">
                            -- Select an Artisan Log ({driveArtisanFiles.length} files found) --
                          </option>
                          {driveArtisanFiles.map(f => (
                            <option key={f.id} value={f.id}>
                              {f.name} {f.modifiedTime ? `(${new Date(f.modifiedTime).toLocaleDateString()})` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="bg-stone-950 p-2.5 rounded-lg border border-stone-800 text-xs text-stone-400 space-y-1.5">
                          <p>
                            No .alog files found in folder: <strong className="text-stone-300 font-mono">{settings.googleDrive.artisanLogsFolderName || 'Root'}</strong>
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setSearchAllDrive(true);
                              checkAndFetchDriveFiles(true);
                            }}
                            className="text-amber-400 hover:text-amber-300 font-medium underline flex items-center gap-1 text-[11px]"
                          >
                            <FolderSearch className="w-3.5 h-3.5" /> Search all files across entire Google Drive
                          </button>
                        </div>
                      )}

                      {driveFetchError && (
                        <p className="text-[11px] text-rose-400 font-mono">{driveFetchError}</p>
                      )}

                      {formData.artisanLogDriveFileName && (
                        <div className="flex items-center justify-between bg-stone-950/60 border border-stone-800/80 px-2.5 py-1.5 rounded-lg text-[11px]">
                          <span className="text-emerald-400 font-mono truncate">
                            Linked: {formData.artisanLogDriveFileName}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                artisanLogDriveFileId: undefined,
                                artisanLogDriveFileName: undefined,
                              }));
                            }}
                            className="text-stone-500 hover:text-rose-400 ml-2"
                            title="Unlink file"
                          >
                            &times;
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Option 2: Upload local file */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 cursor-pointer transition text-xs font-medium">
                    <Upload className="w-3.5 h-3.5 text-amber-500" /> Upload Local .alog / .json / .csv
                    <input
                      type="file"
                      accept=".alog,.json,.csv,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      const sample = createSampleArtisanLog(
                        'Sample_Profile_Batch_1.alog',
                        formData.rating === 'Bad' ? 'Bad' : 'Excellent'
                      );
                      setUploadedArtisanLog(sample);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-stone-800/60 hover:bg-stone-800 text-stone-400 text-xs transition"
                  >
                    Generate Sample Curve
                  </button>
                </div>
              </div>

              {/* Tasting Notes */}
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Tasting Notes</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Crisp bergamot and candied peach notes with bright citric acidity and tea-like sweetness..."
                  value={formData.tastingNotes || ''}
                  onChange={(e) => setFormData({ ...formData, tastingNotes: e.target.value })}
                  className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Quick Flavor Chips */}
              <div>
                <label className="block text-stone-400 text-[11px] font-semibold mb-1">
                  Quick Flavor Tags
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {FLAVOR_TAGS.map((tag) => {
                    const isSelected = formData.flavorDescriptors?.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleFlavorDescriptor(tag)}
                        className={`text-[11px] px-2 py-0.5 rounded-full transition ${
                          isSelected
                            ? 'bg-amber-600 text-stone-950 font-semibold'
                            : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-roast-border">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200 text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRoast}
                className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs transition shadow-lg"
              >
                Save Roast Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
