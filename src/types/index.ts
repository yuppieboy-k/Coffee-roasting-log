export type RoastRating = 'Excellent' | 'Very good' | 'Good' | 'OK' | 'Bad';
export type RoastDegree = 'Light' | 'Cinnamon' | 'City' | 'City+' | 'Full City' | 'Dark';

export interface Roaster {
  id: string;
  name: string;
  model: string;
  heatingType: 'Electric' | 'Gas' | 'Fluid Bed' | 'Infrared' | 'Other';
  capacityGrams: number;
  notes?: string;
  createdAt: string;
}

export interface GreenBean {
  id: string;
  name: string;
  origin: string; // e.g. Ethiopia
  region?: string; // e.g. Guji, Uraga
  farmOrStation?: string; // e.g. Raro Boda
  variety?: string; // e.g. Heirloom, Geisha, Bourbon
  process: 'Washed' | 'Natural' | 'Honey' | 'Anaerobic' | 'Wet-Hulled' | 'Other';
  altitude?: number; // meters above sea level (MASL)
  cropYear?: string;
  supplier?: string;
  densityGramsPerLiter?: number;
  moisturePercent?: number;
  stockRemainingGrams: number;
  notes?: string;
  flavorProfile?: string[];
  createdAt: string;
}

export interface RoastEvent {
  timeSec: number;
  temp: number;
  type: 'CHARGE' | 'TP' | 'DRY_END' | 'FC_START' | 'FC_END' | 'SC_START' | 'DROP';
  label: string;
}

export interface RoastDataPoint {
  timeSec: number;
  beanTemp: number; // BT
  envTemp?: number; // ET
  rorBT?: number; // Rate of Rise BT in °/min
  rorET?: number; // Rate of Rise ET in °/min
  air?: number;
  gas?: number;
  drum?: number;
}

export interface ParsedArtisanLog {
  fileName: string;
  roastDate?: string;
  greenWeightGrams?: number;
  roastedWeightGrams?: number;
  durationSec: number;
  dataPoints: RoastDataPoint[];
  events: {
    charge?: RoastEvent;
    turningPoint?: RoastEvent;
    dryEnd?: RoastEvent;
    firstCrackStart?: RoastEvent;
    firstCrackEnd?: RoastEvent;
    secondCrackStart?: RoastEvent;
    drop?: RoastEvent;
  };
  metrics: {
    chargeTemp?: number;
    turningPointTemp?: number;
    turningPointTimeSec?: number;
    dryEndTimeSec?: number;
    dryEndTemp?: number;
    firstCrackTimeSec?: number;
    firstCrackTemp?: number;
    dropTimeSec: number;
    dropTemp: number;
    totalTimeSec: number;
    // Phases in seconds and percentages
    dryingTimeSec: number;
    dryingPercent: number;
    maillardTimeSec: number;
    maillardPercent: number;
    developmentTimeSec: number;
    developmentPercent: number; // DTR% (Development Time Ratio)
    maxRorBT?: number;
    endRorBT?: number;
  };
  rawSource?: string;
}

export interface RoastLog {
  id: string;
  date: string; // ISO date
  roasterId: string;
  beanId: string;
  title?: string;
  batchNumber?: number;
  greenWeightGrams: number;
  roastedWeightGrams?: number;
  weightLossPercent?: number; // calculated: (green - roasted) / green * 100
  rating: RoastRating;
  tastingNotes: string;
  flavorDescriptors?: string[]; // e.g. ['Bergamot', 'Jasmine', 'Peach']
  roastDegree?: 'Light' | 'Cinnamon' | 'City' | 'City+' | 'Full City' | 'Dark';
  
  // Artisan Log Connection
  artisanLogDriveFileId?: string;
  artisanLogDriveFileName?: string;
  artisanLogDriveFileUrl?: string;
  artisanLogParsed?: ParsedArtisanLog;
  
  ambientTempC?: number;
  humidityPercent?: number;
  generalNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoogleDriveConfig {
  clientId: string;
  apiKey: string;
  isConnected: boolean;
  userEmail?: string;
  artisanLogsFolderId?: string;
  artisanLogsFolderName?: string;
  appDataFolderId?: string;
  appDataFolderName?: string;
  appDataFileId?: string; // ID of the single coffee_roasting_app_data.json on Drive
  sheetFileId?: string; // ID of the synced RoastCraft_Roast_Logs Google Sheet
  sheetWebViewLink?: string; // Web URL to open the Google Sheet
  syncToGoogleSheet?: boolean; // Whether to sync logs into Google Sheet
  lastSyncTimestamp?: string;
  autoSync: boolean;
}

export interface AppSettings {
  roasters: Roaster[];
  greenBeans: GreenBean[];
  googleDrive: GoogleDriveConfig;
  temperatureUnit: 'C' | 'F';
  rorSmoothingSeconds: number; // e.g. 15 or 30
  geminiApiKey?: string;
}

export interface AppStateData {
  version: number;
  updatedAt: string;
  settings: AppSettings;
  logs: RoastLog[];
}
