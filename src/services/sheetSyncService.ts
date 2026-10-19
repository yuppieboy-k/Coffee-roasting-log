import { AppSettings, GreenBean, Roaster, RoastLog } from '../types';
import { googleDriveService } from './googleDriveService';

/**
 * Service to handle bidirectional sync between RoastCraft and Google Sheets.
 * Stores Roasts, Green Beans, and Roasters in dedicated tabs inside a single spreadsheet.
 */

export interface SheetSyncResult {
  sheetId: string;
  webViewLink?: string;
  logsCount: number;
  beansCount: number;
  roastersCount: number;
}

export interface SheetLoadedData {
  logs: RoastLog[];
  greenBeans: GreenBean[];
  roasters: Roaster[];
}

function escapeCsvField(val: any): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function parseCsvText(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  return lines.map(parseCsvLine);
}

export class SheetSyncService {
  /**
   * Generates TSV/CSV text for Roasts
   */
  generateRoastsCsv(logs: RoastLog[], settings: AppSettings): string {
    const getRoasterName = (id: string) =>
      settings.roasters.find(r => r.id === id)?.name || '';
    const getBeanName = (id: string) =>
      settings.greenBeans.find(b => b.id === id)?.name || '';

    const headers = [
      'ID',
      'Date',
      'Roaster ID',
      'Roaster Name',
      'Green Bean ID',
      'Green Bean Name',
      'Green Weight (g)',
      'Roasted Weight (g)',
      'Weight Loss %',
      'Rating',
      'Roast Degree',
      'Total Roast Sec',
      'DTR %',
      'First Crack Sec',
      'First Crack Temp',
      'Drop Temp',
      'Tasting Notes',
      'Flavor Descriptors',
      'Artisan Log File ID',
      'Artisan Log File Name',
      'Charge Temp',
      'Turning Point Sec',
      'Turning Point Temp',
      'Dry End Sec',
      'Dry End Temp'
    ];

    const rows = logs.map(l => {
      const m = l.artisanLogParsed?.metrics;
      return [
        escapeCsvField(l.id),
        escapeCsvField(l.date),
        escapeCsvField(l.roasterId),
        escapeCsvField(getRoasterName(l.roasterId)),
        escapeCsvField(l.beanId),
        escapeCsvField(getBeanName(l.beanId)),
        escapeCsvField(l.greenWeightGrams ?? ''),
        escapeCsvField(l.roastedWeightGrams ?? ''),
        escapeCsvField(l.weightLossPercent ?? ''),
        escapeCsvField(l.rating),
        escapeCsvField(l.roastDegree || 'City'),
        escapeCsvField(m?.totalTimeSec ?? ''),
        escapeCsvField(m?.developmentPercent ?? ''),
        escapeCsvField(m?.firstCrackTimeSec ?? ''),
        escapeCsvField(m?.firstCrackTemp ?? ''),
        escapeCsvField(m?.dropTemp ?? ''),
        escapeCsvField(l.tastingNotes),
        escapeCsvField((l.flavorDescriptors || []).join(', ')),
        escapeCsvField(l.artisanLogDriveFileId || ''),
        escapeCsvField(l.artisanLogDriveFileName || ''),
        escapeCsvField(m?.chargeTemp ?? ''),
        escapeCsvField(m?.turningPointTimeSec ?? ''),
        escapeCsvField(m?.turningPointTemp ?? ''),
        escapeCsvField(m?.dryEndTimeSec ?? ''),
        escapeCsvField(m?.dryEndTemp ?? '')
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\r\n');
  }

  /**
   * Generates CSV text for Green Beans
   */
  generateBeansCsv(beans: GreenBean[]): string {
    const headers = [
      'ID',
      'Name',
      'Origin',
      'Region',
      'Farm Or Station',
      'Variety',
      'Process',
      'Altitude (MASL)',
      'Crop Year',
      'Supplier',
      'Density (g/L)',
      'Moisture %',
      'Stock Remaining (g)',
      'Flavor Profile',
      'Notes'
    ];

    const rows = beans.map(b => [
      escapeCsvField(b.id),
      escapeCsvField(b.name),
      escapeCsvField(b.origin),
      escapeCsvField(b.region || ''),
      escapeCsvField(b.farmOrStation || ''),
      escapeCsvField(b.variety || ''),
      escapeCsvField(b.process || 'Washed'),
      escapeCsvField(b.altitude ?? ''),
      escapeCsvField(b.cropYear || ''),
      escapeCsvField(b.supplier || ''),
      escapeCsvField(b.densityGramsPerLiter ?? ''),
      escapeCsvField(b.moisturePercent ?? ''),
      escapeCsvField(b.stockRemainingGrams ?? 0),
      escapeCsvField((b.flavorProfile || []).join(', ')),
      escapeCsvField(b.notes || '')
    ].join(','));

    return [headers.join(','), ...rows].join('\r\n');
  }

  /**
   * Generates CSV text for Roasters
   */
  generateRoastersCsv(roasters: Roaster[]): string {
    const headers = [
      'ID',
      'Name',
      'Model',
      'Heating Type',
      'Capacity (g)',
      'Notes'
    ];

    const rows = roasters.map(r => [
      escapeCsvField(r.id),
      escapeCsvField(r.name),
      escapeCsvField(r.model),
      escapeCsvField(r.heatingType),
      escapeCsvField(r.capacityGrams ?? 0),
      escapeCsvField(r.notes || '')
    ].join(','));

    return [headers.join(','), ...rows].join('\r\n');
  }

  /**
   * Synchronizes all Roasts, Beans, and Roasters to Google Sheet.
   * Creates or updates the multi-sheet spreadsheet file in Google Drive.
   */
  async syncAllToGoogleSheet(
    logs: RoastLog[],
    settings: AppSettings
  ): Promise<SheetSyncResult> {
    const token = googleDriveService.getAccessToken();
    if (!token) throw new Error('Not connected to Google Drive');

    const folderTarget = settings.googleDrive.appDataFolderId || settings.googleDrive.appDataFolderName;
    const resolvedFolderId = await googleDriveService.resolveFolderId(folderTarget);

    const sheetName = 'RoastCraft_Roast_Logs';

    // 1. Locate or create spreadsheet
    let sheetId = settings.googleDrive.sheetFileId;
    if (!sheetId) {
      let q = `name = '${sheetName}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
      if (resolvedFolderId) {
        q += ` and '${resolvedFolderId}' in parents`;
      }
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)&pageSize=1`;
      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          sheetId = searchData.files[0].id;
        }
      }
    }

    // Prepare tab data
    const roastsRows = parseCsvText(this.generateRoastsCsv(logs, settings));
    const beansRows = parseCsvText(this.generateBeansCsv(settings.greenBeans));
    const roastersRows = parseCsvText(this.generateRoastersCsv(settings.roasters));

    // If no spreadsheet exists yet, create one using Google Sheets API
    if (!sheetId) {
      const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
      const createBody = {
        properties: { title: sheetName },
        sheets: [
          { properties: { title: 'Roasts' } },
          { properties: { title: 'Green Beans' } },
          { properties: { title: 'Roasters' } }
        ]
      };

      const createRes = await fetch(createUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createBody)
      });

      if (!createRes.ok) {
        // Fallback to Drive CSV upload if Sheets API is restricted
        const csv = this.generateRoastsCsv(logs, settings);
        const driveRes = await googleDriveService.syncLogsToGoogleSheet(csv, folderTarget);
        return {
          sheetId: driveRes.sheetId,
          webViewLink: driveRes.webViewLink,
          logsCount: logs.length,
          beansCount: settings.greenBeans.length,
          roastersCount: settings.roasters.length
        };
      }

      const createdData = await createRes.json();
      sheetId = createdData.spreadsheetId;

      // Move into target folder if specified
      if (resolvedFolderId && sheetId) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${sheetId}?addParents=${resolvedFolderId}&fields=id,parents`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {});
      }
    }

    // 2. Ensure tabs exist and populate values via Sheets API
    try {
      // First ensure the sheets exist
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (metaRes.ok) {
        const metaData = await metaRes.json();
        const existingTitles: string[] = (metaData.sheets || []).map((s: any) => s.properties.title);
        const addRequests: any[] = [];

        if (!existingTitles.includes('Roasts')) {
          addRequests.push({ addSheet: { properties: { title: 'Roasts' } } });
        }
        if (!existingTitles.includes('Green Beans')) {
          addRequests.push({ addSheet: { properties: { title: 'Green Beans' } } });
        }
        if (!existingTitles.includes('Roasters')) {
          addRequests.push({ addSheet: { properties: { title: 'Roasters' } } });
        }

        if (addRequests.length > 0) {
          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ requests: addRequests })
          });
        }

        // Clear and write all three tabs
        const valueRanges = [
          { range: "'Roasts'!A1:Z5000", values: roastsRows },
          { range: "'Green Beans'!A1:Z5000", values: beansRows },
          { range: "'Roasters'!A1:Z5000", values: roastersRows }
        ];

        // Clear existing values
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchClear`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ranges: ["'Roasts'!A1:Z5000", "'Green Beans'!A1:Z5000", "'Roasters'!A1:Z5000"]
          })
        });

        // Write new values
        const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            valueInputOption: 'USER_ENTERED',
            data: valueRanges
          })
        });

        if (updateRes.ok && sheetId) {
          return {
            sheetId,
            webViewLink: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
            logsCount: logs.length,
            beansCount: settings.greenBeans.length,
            roastersCount: settings.roasters.length
          };
        }
      }
    } catch (sheetApiErr) {
      console.warn('Sheets API batchUpdate failed, fallback to Drive CSV:', sheetApiErr);
    }

    // Fallback: Drive CSV sync
    const fallbackCsv = this.generateRoastsCsv(logs, settings);
    const driveRes = await googleDriveService.syncLogsToGoogleSheet(fallbackCsv, folderTarget, sheetId);
    return {
      sheetId: driveRes.sheetId,
      webViewLink: driveRes.webViewLink,
      logsCount: logs.length,
      beansCount: settings.greenBeans.length,
      roastersCount: settings.roasters.length
    };
  }

  /**
   * Loads all Roasts, Beans, and Roaster data from Google Sheet.
   */
  async loadAllFromGoogleSheet(sheetId: string): Promise<SheetLoadedData> {
    const token = googleDriveService.getAccessToken();
    if (!token) throw new Error('Not connected to Google Drive');

    // Fetch values from all tabs
    const ranges = ["'Roasts'!A1:Z2000", "'Green Beans'!A1:Z2000", "'Roasters'!A1:Z2000"];
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&')}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      // If sheets API batchGet fails, try exporting the main sheet as CSV
      const exportUrl = `https://www.googleapis.com/drive/v3/files/${sheetId}/export?mimeType=text/csv`;
      const exportRes = await fetch(exportUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!exportRes.ok) {
        throw new Error(`Failed to load sheet data: ${res.statusText}`);
      }
      const csv = await exportRes.text();
      const rows = parseCsvText(csv);
      const parsedLogs = this.parseRoastLogsFromRows(rows);
      return { logs: parsedLogs, greenBeans: [], roasters: [] };
    }

    const data = await res.json();
    const valueRanges: any[] = data.valueRanges || [];

    const roastsRows = valueRanges[0]?.values || [];
    const beansRows = valueRanges[1]?.values || [];
    const roastersRows = valueRanges[2]?.values || [];

    const loadedLogs = this.parseRoastLogsFromRows(roastsRows);
    const loadedBeans = this.parseBeansFromRows(beansRows);
    const loadedRoasters = this.parseRoastersFromRows(roastersRows);

    return {
      logs: loadedLogs,
      greenBeans: loadedBeans,
      roasters: loadedRoasters
    };
  }

  private parseRoastLogsFromRows(rows: string[][]): RoastLog[] {
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.trim().toLowerCase());
    const idIdx = headers.findIndex(h => h === 'id');
    const dateIdx = headers.findIndex(h => h.includes('date'));
    const roasterIdIdx = headers.findIndex(h => h.includes('roaster id') || h === 'roaster');
    const beanIdIdx = headers.findIndex(h => h.includes('bean id') || h.includes('green bean'));
    const greenWtIdx = headers.findIndex(h => h.includes('green weight'));
    const roastedWtIdx = headers.findIndex(h => h.includes('roasted weight'));
    const ratingIdx = headers.findIndex(h => h.includes('rating'));
    const degreeIdx = headers.findIndex(h => h.includes('degree'));
    const totalSecIdx = headers.findIndex(h => h.includes('total roast sec'));
    const dtrIdx = headers.findIndex(h => h.includes('dtr'));
    const fcSecIdx = headers.findIndex(h => h.includes('first crack sec'));
    const fcTempIdx = headers.findIndex(h => h.includes('first crack temp'));
    const dropTempIdx = headers.findIndex(h => h.includes('drop temp'));
    const chargeTempIdx = headers.findIndex(h => h.includes('charge temp'));
    const tpSecIdx = headers.findIndex(h => h.includes('turning point sec'));
    const tpTempIdx = headers.findIndex(h => h.includes('turning point temp'));
    const drySecIdx = headers.findIndex(h => h.includes('dry end sec'));
    const dryTempIdx = headers.findIndex(h => h.includes('dry end temp'));
    const notesIdx = headers.findIndex(h => h.includes('tasting notes') || h.includes('notes'));
    const descIdx = headers.findIndex(h => h.includes('descriptors') || h.includes('flavor'));
    const fileIdIdx = headers.findIndex(h => h.includes('file id'));
    const fileNameIdx = headers.findIndex(h => h.includes('file name') || h.includes('file'));

    const parseOptNum = (val: string | undefined): number | undefined => {
      if (val === undefined || val === null || val.trim() === '') return undefined;
      const n = Number(val.trim());
      return isNaN(n) ? undefined : n;
    };

    const logs: RoastLog[] = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0 || !r[0]?.trim()) continue;

      const id = idIdx !== -1 && r[idIdx] ? r[idIdx] : `roast-${Date.now()}-${i}`;
      const date = dateIdx !== -1 && r[dateIdx] ? r[dateIdx] : new Date().toISOString();
      const roasterId = roasterIdIdx !== -1 ? r[roasterIdIdx] : 'roaster-1';
      const beanId = beanIdIdx !== -1 ? r[beanIdIdx] : 'bean-1';
      const greenWeightGrams = greenWtIdx !== -1 && r[greenWtIdx] ? Number(r[greenWtIdx]) : 250;
      const roastedWeightGrams = roastedWtIdx !== -1 && r[roastedWtIdx] ? Number(r[roastedWtIdx]) : undefined;
      const weightLossPercent = greenWeightGrams && roastedWeightGrams
        ? Number((((greenWeightGrams - roastedWeightGrams) / greenWeightGrams) * 100).toFixed(1))
        : undefined;

      const rating = (ratingIdx !== -1 && r[ratingIdx] ? r[ratingIdx] : 'Excellent') as any;
      const roastDegree = (degreeIdx !== -1 && r[degreeIdx] ? r[degreeIdx] : 'City') as any;
      const tastingNotes = notesIdx !== -1 && r[notesIdx] ? r[notesIdx] : '';
      const flavorDescriptors = descIdx !== -1 && r[descIdx]
        ? r[descIdx].split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const fileId = fileIdIdx !== -1 && r[fileIdIdx]?.trim() ? r[fileIdIdx].trim() : undefined;
      const fileName = fileNameIdx !== -1 && r[fileNameIdx]?.trim() ? r[fileNameIdx].trim() : undefined;

      const totalTimeSec = parseOptNum(totalSecIdx !== -1 ? r[totalSecIdx] : undefined);
      const dtrPercent = parseOptNum(dtrIdx !== -1 ? r[dtrIdx] : undefined);
      const firstCrackTimeSec = parseOptNum(fcSecIdx !== -1 ? r[fcSecIdx] : undefined);
      const firstCrackTemp = parseOptNum(fcTempIdx !== -1 ? r[fcTempIdx] : undefined);
      const dropTemp = parseOptNum(dropTempIdx !== -1 ? r[dropTempIdx] : undefined);
      const chargeTemp = parseOptNum(chargeTempIdx !== -1 ? r[chargeTempIdx] : undefined);
      const turningPointTimeSec = parseOptNum(tpSecIdx !== -1 ? r[tpSecIdx] : undefined);
      const turningPointTemp = parseOptNum(tpTempIdx !== -1 ? r[tpTempIdx] : undefined);
      const dryEndTimeSec = parseOptNum(drySecIdx !== -1 ? r[drySecIdx] : undefined);
      const dryEndTemp = parseOptNum(dryTempIdx !== -1 ? r[dryTempIdx] : undefined);

      let artisanLogParsed: RoastLog['artisanLogParsed'] = undefined;
      if (totalTimeSec !== undefined || firstCrackTimeSec !== undefined || dtrPercent !== undefined) {
        const tot = totalTimeSec || 500;
        const drySec = dryEndTimeSec ?? Math.round(tot * 0.5);
        const fcSec = firstCrackTimeSec ?? (dtrPercent ? Number((tot * (1 - dtrPercent / 100)).toFixed(1)) : undefined);
        const devSec = fcSec !== undefined ? Number(Math.max(0, tot - fcSec).toFixed(1)) : 0;
        const devPct = dtrPercent ?? (fcSec !== undefined ? Number(((devSec / tot) * 100).toFixed(1)) : 0);
        const dryPct = Number(((drySec / tot) * 100).toFixed(1));
        const mailSec = fcSec !== undefined ? Number(Math.max(0, fcSec - drySec).toFixed(1)) : 0;
        const mailPct = Number(((mailSec / tot) * 100).toFixed(1));

        artisanLogParsed = {
          fileName: fileName || 'Sheet_Synced_Profile.alog',
          durationSec: tot,
          dataPoints: [],
          events: {
            charge: chargeTemp !== undefined ? { timeSec: 0, temp: chargeTemp, type: 'CHARGE', label: 'Charge' } : undefined,
            turningPoint: turningPointTimeSec !== undefined && turningPointTemp !== undefined
              ? { timeSec: turningPointTimeSec, temp: turningPointTemp, type: 'TP', label: 'Turning Point' }
              : undefined,
            dryEnd: dryEndTimeSec !== undefined && dryEndTemp !== undefined
              ? { timeSec: dryEndTimeSec, temp: dryEndTemp, type: 'DRY_END', label: 'Dry End' }
              : undefined,
            firstCrackStart: fcSec !== undefined
              ? { timeSec: fcSec, temp: firstCrackTemp ?? 0, type: 'FC_START', label: 'First Crack' }
              : undefined,
            drop: { timeSec: tot, temp: dropTemp ?? 0, type: 'DROP', label: 'Drop' },
          },
          metrics: {
            chargeTemp,
            turningPointTimeSec,
            turningPointTemp,
            dryEndTimeSec,
            dryEndTemp,
            firstCrackTimeSec: fcSec,
            firstCrackTemp,
            dropTimeSec: tot,
            dropTemp: dropTemp ?? 0,
            totalTimeSec: tot,
            dryingTimeSec: drySec,
            dryingPercent: dryPct,
            maillardTimeSec: mailSec,
            maillardPercent: mailPct,
            developmentTimeSec: devSec,
            developmentPercent: devPct,
          },
        };
      }

      logs.push({
        id,
        date,
        roasterId,
        beanId,
        greenWeightGrams,
        roastedWeightGrams,
        weightLossPercent,
        rating,
        roastDegree,
        tastingNotes,
        flavorDescriptors,
        artisanLogDriveFileId: fileId,
        artisanLogDriveFileName: fileName,
        artisanLogParsed,
        createdAt: date,
        updatedAt: date
      });
    }

    return logs;
  }

  private parseBeansFromRows(rows: string[][]): GreenBean[] {
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.trim().toLowerCase());
    const idIdx = headers.findIndex(h => h === 'id');
    const nameIdx = headers.findIndex(h => h === 'name');
    const originIdx = headers.findIndex(h => h.includes('origin'));
    const regionIdx = headers.findIndex(h => h.includes('region'));
    const farmIdx = headers.findIndex(h => h.includes('farm') || h.includes('station'));
    const varietyIdx = headers.findIndex(h => h.includes('variety'));
    const processIdx = headers.findIndex(h => h.includes('process'));
    const altIdx = headers.findIndex(h => h.includes('altitude'));
    const cropIdx = headers.findIndex(h => h.includes('crop'));
    const supplierIdx = headers.findIndex(h => h.includes('supplier'));
    const densityIdx = headers.findIndex(h => h.includes('density'));
    const moistureIdx = headers.findIndex(h => h.includes('moisture'));
    const stockIdx = headers.findIndex(h => h.includes('stock'));
    const flavorIdx = headers.findIndex(h => h.includes('flavor'));
    const notesIdx = headers.findIndex(h => h.includes('notes'));

    const beans: GreenBean[] = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0 || !r[nameIdx]?.trim()) continue;

      beans.push({
        id: idIdx !== -1 && r[idIdx] ? r[idIdx] : `bean-${Date.now()}-${i}`,
        name: r[nameIdx] || 'Unnamed Bean',
        origin: originIdx !== -1 && r[originIdx] ? r[originIdx] : 'Unknown Origin',
        region: regionIdx !== -1 ? r[regionIdx] : undefined,
        farmOrStation: farmIdx !== -1 ? r[farmIdx] : undefined,
        variety: varietyIdx !== -1 ? r[varietyIdx] : undefined,
        process: (processIdx !== -1 && r[processIdx] ? r[processIdx] : 'Washed') as any,
        altitude: altIdx !== -1 && r[altIdx] ? Number(r[altIdx]) : undefined,
        cropYear: cropIdx !== -1 ? r[cropIdx] : undefined,
        supplier: supplierIdx !== -1 ? r[supplierIdx] : undefined,
        densityGramsPerLiter: densityIdx !== -1 && r[densityIdx] ? Number(r[densityIdx]) : undefined,
        moisturePercent: moistureIdx !== -1 && r[moistureIdx] ? Number(r[moistureIdx]) : undefined,
        stockRemainingGrams: stockIdx !== -1 && r[stockIdx] ? Number(r[stockIdx]) : 1000,
        flavorProfile: flavorIdx !== -1 && r[flavorIdx] ? r[flavorIdx].split(',').map(s => s.trim()).filter(Boolean) : [],
        notes: notesIdx !== -1 ? r[notesIdx] : undefined,
        createdAt: new Date().toISOString()
      });
    }

    return beans;
  }

  private parseRoastersFromRows(rows: string[][]): Roaster[] {
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.trim().toLowerCase());
    const idIdx = headers.findIndex(h => h === 'id');
    const nameIdx = headers.findIndex(h => h === 'name');
    const modelIdx = headers.findIndex(h => h.includes('model'));
    const heatIdx = headers.findIndex(h => h.includes('heat'));
    const capIdx = headers.findIndex(h => h.includes('capacity'));
    const notesIdx = headers.findIndex(h => h.includes('notes'));

    const roasters: Roaster[] = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0 || !r[nameIdx]?.trim()) continue;

      roasters.push({
        id: idIdx !== -1 && r[idIdx] ? r[idIdx] : `roaster-${Date.now()}-${i}`,
        name: r[nameIdx] || 'Custom Roaster',
        model: modelIdx !== -1 && r[modelIdx] ? r[modelIdx] : 'Standard',
        heatingType: (heatIdx !== -1 && r[heatIdx] ? r[heatIdx] : 'Electric') as any,
        capacityGrams: capIdx !== -1 && r[capIdx] ? Number(r[capIdx]) : 500,
        notes: notesIdx !== -1 ? r[notesIdx] : undefined,
        createdAt: new Date().toISOString()
      });
    }

    return roasters;
  }
}

export const sheetSyncService = new SheetSyncService();
