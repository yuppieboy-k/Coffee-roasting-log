import { get, set } from 'idb-keyval';
import { AppSettings, AppStateData, GreenBean, Roaster, RoastLog } from '../types';

const STORAGE_KEY_SETTINGS = 'roastlog_settings_v1';
const STORAGE_KEY_LOGS = 'roastlog_logs_v1';

export const DEFAULT_ROASTERS: Roaster[] = [
  {
    id: 'roaster-1',
    name: 'Aillio Bullet R1 V2',
    model: 'Bullet R1 V2',
    heatingType: 'Infrared',
    capacityGrams: 1000,
    notes: 'Induction drum roaster with IBTS infrared bean temperature sensor',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'roaster-2',
    name: 'Hottop KN-8828B-2K+',
    model: 'KN-8828B-2K+',
    heatingType: 'Electric',
    capacityGrams: 300,
    notes: 'Drum roaster with dual thermocouple probes and USB Artisan connection',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'roaster-3',
    name: 'Fresh Roast SR800',
    model: 'SR800 w/ Extension Tube',
    heatingType: 'Fluid Bed',
    capacityGrams: 220,
    notes: 'Hot air fluid bed roaster with digital heat and fan dials',
    createdAt: new Date().toISOString(),
  }
];

export const DEFAULT_BEANS: GreenBean[] = [
  {
    id: 'bean-1',
    name: 'Ethiopia Yirgacheffe Gedeb Chelchele',
    origin: 'Ethiopia',
    region: 'Gedeb, Gedeo Zone',
    farmOrStation: 'Chelchele Washing Station',
    variety: 'Kurume, Dega (Heirloom)',
    process: 'Washed',
    altitude: 2050,
    cropYear: '2025/2026',
    supplier: 'Cafe Imports',
    densityGramsPerLiter: 720,
    moisturePercent: 10.8,
    stockRemainingGrams: 2500,
    flavorProfile: ['Bergamot', 'Jasmine', 'Peach', 'Earl Grey', 'Meyer Lemon'],
    notes: 'Very dense, high-grown bean. Responds well to gentle drying, high charge, and swift development to preserve delicate florals.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'bean-2',
    name: 'Colombia Huila Pink Bourbon',
    origin: 'Colombia',
    region: 'Huila, San Adolfo',
    farmOrStation: 'Finca El Paraiso',
    variety: 'Pink Bourbon',
    process: 'Washed',
    altitude: 1850,
    cropYear: '2025',
    supplier: 'Sweet Maria\'s',
    densityGramsPerLiter: 695,
    moisturePercent: 11.2,
    stockRemainingGrams: 1800,
    flavorProfile: ['Pink Grapefruit', 'Papaya', 'Wild Honey', 'Cane Sugar'],
    notes: 'Complex sweetness and vibrant citric-malic acidity.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'bean-3',
    name: 'Costa Rica Tarrazú Anaerobic Natural',
    origin: 'Costa Rica',
    region: 'Tarrazú',
    farmOrStation: 'Canet Musician Series',
    variety: 'Caturra, Catuai',
    process: 'Anaerobic',
    altitude: 1900,
    cropYear: '2025',
    supplier: 'Red Fox Merchants',
    densityGramsPerLiter: 680,
    moisturePercent: 10.5,
    stockRemainingGrams: 1200,
    flavorProfile: ['Passionfruit', 'Boozy Wine', 'Cacao Nibs', 'Strawberry Jam'],
    notes: 'High sugar content from anaerobic fermentation. Prone to scorching if charge is too aggressive; watch RoR after yellowing.',
    createdAt: new Date().toISOString(),
  }
];

export const DEFAULT_SETTINGS: AppSettings = {
  roasters: DEFAULT_ROASTERS,
  greenBeans: DEFAULT_BEANS,
  googleDrive: {
    clientId: '',
    apiKey: '',
    isConnected: false,
    autoSync: true,
  },
  temperatureUnit: 'C',
  rorSmoothingSeconds: 30,
};

export async function loadSettings(): Promise<AppSettings> {
  try {
    const saved = await get<AppSettings>(STORAGE_KEY_SETTINGS);
    if (saved) {
      return {
        ...DEFAULT_SETTINGS,
        ...saved,
        googleDrive: {
          ...DEFAULT_SETTINGS.googleDrive,
          ...(saved.googleDrive || {}),
        }
      };
    }
  } catch (err) {
    console.error('Failed to load settings from IndexedDB:', err);
  }
  return DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    await set(STORAGE_KEY_SETTINGS, settings);
  } catch (err) {
    console.error('Failed to save settings to IndexedDB:', err);
  }
}

export async function loadRoastLogs(): Promise<RoastLog[]> {
  try {
    const saved = await get<RoastLog[]>(STORAGE_KEY_LOGS);
    if (saved && Array.isArray(saved)) {
      return saved;
    }
  } catch (err) {
    console.error('Failed to load roast logs from IndexedDB:', err);
  }
  return [];
}

export async function saveRoastLogs(logs: RoastLog[]): Promise<void> {
  try {
    await set(STORAGE_KEY_LOGS, logs);
  } catch (err) {
    console.error('Failed to save roast logs to IndexedDB:', err);
  }
}

export async function exportAllData(): Promise<string> {
  const settings = await loadSettings();
  const logs = await loadRoastLogs();
  const exportPayload: AppStateData = {
    version: 1,
    updatedAt: new Date().toISOString(),
    settings,
    logs
  };
  return JSON.stringify(exportPayload, null, 2);
}

export async function importAllData(jsonString: string): Promise<AppStateData> {
  const parsed = JSON.parse(jsonString) as AppStateData;
  if (!parsed || !parsed.settings || !Array.isArray(parsed.logs)) {
    throw new Error('Invalid roast log data backup format');
  }
  await saveSettings(parsed.settings);
  await saveRoastLogs(parsed.logs);
  return parsed;
}

