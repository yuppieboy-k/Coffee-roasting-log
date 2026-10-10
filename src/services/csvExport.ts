import { AppSettings, RoastLog } from '../types';

/**
 * Generates CSV content suitable for Google Sheets or Excel export.
 */
export function generateRoastLogsCsv(logs: RoastLog[], settings: AppSettings): string {
  const getRoasterName = (id: string) =>
    settings.roasters.find(r => r.id === id)?.name || 'Unknown Roaster';
  const getBean = (id: string) =>
    settings.greenBeans.find(b => b.id === id);

  const formatTime = (sec?: number) => {
    if (!sec || isNaN(sec)) return '';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const escapeCsv = (str: string | undefined | null) => {
    if (str === undefined || str === null) return '';
    const val = String(str);
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const headers = [
    'Date',
    'Roaster',
    'Green Bean',
    'Origin',
    'Process',
    'Variety',
    'Altitude (MASL)',
    'Green Weight (g)',
    'Roasted Weight (g)',
    'Weight Loss %',
    'Rating',
    'Roast Degree',
    'Total Roast Time',
    'DTR %',
    'First Crack Temp',
    'Drop Temp',
    'Tasting Notes',
    'Flavor Descriptors',
    'Artisan Log File'
  ];

  const rows = logs.map(log => {
    const bean = getBean(log.beanId);
    const metrics = log.artisanLogParsed?.metrics;

    return [
      escapeCsv(new Date(log.date).toISOString().slice(0, 10)),
      escapeCsv(getRoasterName(log.roasterId)),
      escapeCsv(bean?.name || 'Custom Bean'),
      escapeCsv(bean?.origin || ''),
      escapeCsv(bean?.process || ''),
      escapeCsv(bean?.variety || ''),
      escapeCsv(bean?.altitude ? String(bean.altitude) : ''),
      escapeCsv(log.greenWeightGrams ? String(log.greenWeightGrams) : ''),
      escapeCsv(log.roastedWeightGrams ? String(log.roastedWeightGrams) : ''),
      escapeCsv(log.weightLossPercent ? `${log.weightLossPercent}%` : ''),
      escapeCsv(log.rating),
      escapeCsv(log.roastDegree || 'City'),
      escapeCsv(formatTime(metrics?.totalTimeSec)),
      escapeCsv(metrics?.developmentPercent ? `${metrics.developmentPercent}%` : ''),
      escapeCsv(metrics?.firstCrackTemp ? `${metrics.firstCrackTemp}°C` : ''),
      escapeCsv(metrics?.dropTemp ? `${metrics.dropTemp}°C` : ''),
      escapeCsv(log.tastingNotes),
      escapeCsv((log.flavorDescriptors || []).join(', ')),
      escapeCsv(log.artisanLogDriveFileName || log.artisanLogParsed?.fileName || '')
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

