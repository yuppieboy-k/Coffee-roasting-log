import { ParsedArtisanLog, RoastDataPoint } from '../types';

/**
 * Computes Rate of Rise (RoR in °/min) using a backward window moving average.
 */
function calculateRoR(
  data: { time: number; temp: number }[],
  windowSec: number = 30
): number[] {
  const ror: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const curTime = data[i].time;
    const curTemp = data[i].temp;

    // Find point approximately windowSec earlier
    let prevIdx = i;
    while (prevIdx > 0 && curTime - data[prevIdx].time < windowSec) {
      prevIdx--;
    }

    const dt = (curTime - data[prevIdx].time) / 60; // in minutes
    const dTemp = curTemp - data[prevIdx].temp;

    if (dt > 0.05) {
      const rate = dTemp / dt;
      // Cap unreasonable spikes for clean plotting
      ror.push(Math.max(-10, Math.min(60, Number(rate.toFixed(1)))));
    } else if (i > 0) {
      ror.push(ror[i - 1]);
    } else {
      ror.push(0);
    }
  }
  return ror;
}

/**
 * Converts a Python dictionary representation (used in native .alog files)
 * into a standard JS object.
 */
function parsePythonDict(text: string): any {
  // If it's already standard JSON
  try {
    return JSON.parse(text);
  } catch {
    // Clean Python literal quirks:
    // 1. Replace True, False, None
    let sanitized = text
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null')
      .replace(/\bnan\b/gi, 'null');

    // 2. Convert python single-quoted strings to double-quoted strings
    // Handle escaped quotes first
    sanitized = sanitized.replace(/\\'/g, '__ESCAPED_QUOTE__');
    sanitized = sanitized.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
    sanitized = sanitized.replace(/__ESCAPED_QUOTE__/g, "'");

    // 3. Convert Python tuples (a, b) to arrays [a, b]
    while (/\(([^()]*?)\)/.test(sanitized)) {
      sanitized = sanitized.replace(/\(([^()]*?)\)/g, '[$1]');
    }

    // 4. Remove trailing commas before closing braces/brackets
    sanitized = sanitized.replace(/,\s*([}\]])/g, '$1');

    return JSON.parse(sanitized);
  }
}

/**
 * Parses CSV exported from Artisan or data loggers.
 */
function parseArtisanCsv(csvText: string, fileName: string): ParsedArtisanLog {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error('CSV file is empty or missing headers');
  }

  // Detect delimiter (, or ;)
  const headerLine = lines[0];
  const delim = headerLine.includes(';') ? ';' : ',';
  const headers = headerLine.split(delim).map(h => h.trim().toLowerCase());

  const timeCol = headers.findIndex(h => h.includes('time') || h.includes('sec') || h === 't');
  const btCol = headers.findIndex(h => h.includes('bt') || h.includes('bean') || h.includes('temp2'));
  const etCol = headers.findIndex(h => h.includes('et') || h.includes('env') || h.includes('temp1'));

  if (timeCol === -1 || (btCol === -1 && etCol === -1)) {
    throw new Error('CSV must contain time and at least one temperature column (BT or ET)');
  }

  const rawPoints: { time: number; bt: number; et?: number }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim).map(c => c.trim());
    if (cols.length < 2) continue;

    let time = 0;
    const timeStr = cols[timeCol];
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':').map(Number);
      time = parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else {
      time = parseFloat(timeStr);
    }

    const bt = btCol !== -1 ? parseFloat(cols[btCol]) : NaN;
    const et = etCol !== -1 ? parseFloat(cols[etCol]) : undefined;

    if (!isNaN(time) && !isNaN(bt)) {
      rawPoints.push({ time, bt, et: !isNaN(et as number) ? et : undefined });
    }
  }

  return processRawRoastPoints(
    rawPoints.map(p => p.time),
    rawPoints.map(p => p.bt),
    rawPoints.map(p => p.et ?? p.bt),
    {},
    fileName,
    csvText
  );
}

/**
 * Normalizes raw time and temperature arrays into a full ParsedArtisanLog
 */
function processRawRoastPoints(
  timeArr: number[],
  btArr: number[],
  etArr: number[],
  eventsMap: {
    charge?: number;
    dry?: number;
    fc?: number;
    fce?: number;
    sc?: number;
    drop?: number;
  },
  fileName: string,
  rawSource?: string
): ParsedArtisanLog {
  const pointsCount = Math.min(timeArr.length, btArr.length);
  if (pointsCount === 0) {
    throw new Error('No valid temperature readings found in Artisan log');
  }

  // Pre-calculate Rate of Rise (RoR)
  const btData = [];
  const etData = [];
  for (let i = 0; i < pointsCount; i++) {
    btData.push({ time: timeArr[i], temp: btArr[i] });
    etData.push({ time: timeArr[i], temp: etArr[i] || btArr[i] });
  }

  const rorBT = calculateRoR(btData, 30);
  const rorET = calculateRoR(etData, 30);

  const dataPoints: RoastDataPoint[] = [];
  for (let i = 0; i < pointsCount; i++) {
    dataPoints.push({
      timeSec: Number(timeArr[i].toFixed(1)),
      beanTemp: Number(btArr[i].toFixed(1)),
      envTemp: etArr[i] !== undefined ? Number(etArr[i].toFixed(1)) : undefined,
      rorBT: rorBT[i],
      rorET: rorET[i]
    });
  }

  // Extract or detect events
  // 1. Charge
  const chargeTimeSec = eventsMap.charge !== undefined ? eventsMap.charge : timeArr[0];
  const chargeIdx = dataPoints.findIndex(p => p.timeSec >= chargeTimeSec);
  const chargeTemp = chargeIdx >= 0 ? dataPoints[chargeIdx].beanTemp : dataPoints[0].beanTemp;

  // 2. Turning Point (minimum BT in first 3 minutes after charge)
  let turningPointTemp = chargeTemp;
  let turningPointTimeSec = chargeTimeSec;
  const searchLimitTime = Math.min(chargeTimeSec + 180, timeArr[timeArr.length - 1]);
  for (let i = Math.max(0, chargeIdx); i < dataPoints.length; i++) {
    if (dataPoints[i].timeSec > searchLimitTime) break;
    if (dataPoints[i].beanTemp < turningPointTemp) {
      turningPointTemp = dataPoints[i].beanTemp;
      turningPointTimeSec = dataPoints[i].timeSec;
    }
  }

  // 3. Drop event
  const lastPoint = dataPoints[dataPoints.length - 1];
  const dropTimeSec = eventsMap.drop !== undefined ? eventsMap.drop : lastPoint.timeSec;
  const dropIdx = dataPoints.findIndex(p => p.timeSec >= dropTimeSec);
  const dropTemp = dropIdx >= 0 ? dataPoints[dropIdx].beanTemp : lastPoint.beanTemp;

  // 4. Dry End (~150°C / 300°F if not specified)
  let dryEndTimeSec = eventsMap.dry;
  let dryEndTemp: number | undefined;
  if (dryEndTimeSec === undefined) {
    const autoDry = dataPoints.find(p => p.timeSec > turningPointTimeSec && p.beanTemp >= 150);
    if (autoDry) {
      dryEndTimeSec = autoDry.timeSec;
      dryEndTemp = autoDry.beanTemp;
    }
  } else {
    const pt = dataPoints.find(p => p.timeSec >= (dryEndTimeSec as number));
    dryEndTemp = pt?.beanTemp;
  }

  // 5. First Crack Start (~195°C / 385°F if not specified)
  let firstCrackTimeSec = eventsMap.fc;
  let firstCrackTemp: number | undefined;
  if (firstCrackTimeSec === undefined) {
    const autoFc = dataPoints.find(p => p.timeSec > (dryEndTimeSec || turningPointTimeSec) && p.beanTemp >= 196);
    if (autoFc && autoFc.timeSec < dropTimeSec) {
      firstCrackTimeSec = autoFc.timeSec;
      firstCrackTemp = autoFc.beanTemp;
    }
  } else {
    const pt = dataPoints.find(p => p.timeSec >= (firstCrackTimeSec as number));
    firstCrackTemp = pt?.beanTemp;
  }

  // Calculate roast phases
  const totalRoastSec = Math.max(1, dropTimeSec - chargeTimeSec);
  const dryingTimeSec = dryEndTimeSec ? Math.max(0, dryEndTimeSec - chargeTimeSec) : 0;
  const dryingPercent = Number(((dryingTimeSec / totalRoastSec) * 100).toFixed(1));

  let maillardTimeSec = 0;
  if (dryEndTimeSec && firstCrackTimeSec && firstCrackTimeSec > dryEndTimeSec) {
    maillardTimeSec = firstCrackTimeSec - dryEndTimeSec;
  }
  const maillardPercent = Number(((maillardTimeSec / totalRoastSec) * 100).toFixed(1));

  let developmentTimeSec = 0;
  if (firstCrackTimeSec && dropTimeSec > firstCrackTimeSec) {
    developmentTimeSec = dropTimeSec - firstCrackTimeSec;
  }
  const developmentPercent = Number(((developmentTimeSec / totalRoastSec) * 100).toFixed(1)); // DTR%

  const events: ParsedArtisanLog['events'] = {
    charge: {
      timeSec: chargeTimeSec,
      temp: chargeTemp,
      type: 'CHARGE',
      label: 'Charge'
    },
    turningPoint: {
      timeSec: turningPointTimeSec,
      temp: turningPointTemp,
      type: 'TP',
      label: 'Turning Point'
    },
    drop: {
      timeSec: dropTimeSec,
      temp: dropTemp,
      type: 'DROP',
      label: 'Drop'
    }
  };

  if (dryEndTimeSec && dryEndTemp) {
    events.dryEnd = {
      timeSec: dryEndTimeSec,
      temp: dryEndTemp,
      type: 'DRY_END',
      label: 'Dry End'
    };
  }

  if (firstCrackTimeSec && firstCrackTemp) {
    events.firstCrackStart = {
      timeSec: firstCrackTimeSec,
      temp: firstCrackTemp,
      type: 'FC_START',
      label: 'First Crack'
    };
  }

  const maxRorBT = Math.max(...rorBT.filter(r => !isNaN(r)));
  const endRorBT = rorBT[rorBT.length - 1];

  return {
    fileName,
    durationSec: totalRoastSec,
    dataPoints,
    events,
    metrics: {
      chargeTemp,
      turningPointTemp,
      turningPointTimeSec,
      dryEndTimeSec,
      dryEndTemp,
      firstCrackTimeSec,
      firstCrackTemp,
      dropTimeSec,
      dropTemp,
      totalTimeSec: totalRoastSec,
      dryingTimeSec,
      dryingPercent,
      maillardTimeSec,
      maillardPercent,
      developmentTimeSec,
      developmentPercent,
      maxRorBT: isFinite(maxRorBT) ? maxRorBT : undefined,
      endRorBT: isFinite(endRorBT) ? endRorBT : undefined,
    },
    rawSource
  };
}

/**
 * Primary entry point: parses an Artisan file from text string
 * (supports .alog Python dict format, .json, and .csv).
 */
export function parseArtisanFile(fileContent: string, fileName: string): ParsedArtisanLog {
  const trimmed = fileContent.trim();

  // Try CSV first if it has commas/semicolons and line breaks without JSON braces
  if (!trimmed.startsWith('{') && (trimmed.includes(',') || trimmed.includes(';')) && trimmed.includes('\n')) {
    try {
      return parseArtisanCsv(trimmed, fileName);
    } catch {
      // fallback to dict parse
    }
  }

  // Parse JSON or Python dict format (.alog)
  const dict = parsePythonDict(trimmed);

  // Artisan native structure:
  // dict.timex = array of seconds
  // dict.temp1 = Environmental Temp (ET)
  // dict.temp2 = Bean Temp (BT)
  // dict.charge, dict.dry, dict.fc, dict.drop, etc.
  let timex: number[] = [];
  let temp1: number[] = [];
  let temp2: number[] = [];

  if (Array.isArray(dict.timex)) {
    timex = dict.timex.map(Number);
  } else if (Array.isArray(dict.time)) {
    timex = dict.time.map(Number);
  }

  // If time array is empty or relative indexes, construct sequence
  if (Array.isArray(dict.temp2)) {
    temp2 = dict.temp2.map(Number);
  }
  if (Array.isArray(dict.temp1)) {
    temp1 = dict.temp1.map(Number);
  }

  if (timex.length === 0 && temp2.length > 0) {
    const samplingRate = dict.samplingrate || dict.samplinginterval || 1;
    timex = temp2.map((_, i) => i * samplingRate);
  }

  if (temp2.length === 0 && temp1.length > 0) {
    temp2 = [...temp1];
  }

  // Artisan event markers can be indices or seconds
  const eventsMap: any = {};
  if (dict.charge !== undefined && dict.charge !== -1) {
    eventsMap.charge = typeof dict.charge === 'number' && dict.charge < timex.length ? timex[dict.charge] : Number(dict.charge);
  }
  if (dict.dry !== undefined && dict.dry !== -1) {
    eventsMap.dry = typeof dict.dry === 'number' && dict.dry < timex.length ? timex[dict.dry] : Number(dict.dry);
  }
  if (dict.fc !== undefined && dict.fc !== -1) {
    eventsMap.fc = typeof dict.fc === 'number' && dict.fc < timex.length ? timex[dict.fc] : Number(dict.fc);
  }
  if (dict.fcs !== undefined && dict.fcs !== -1) {
    eventsMap.fc = typeof dict.fcs === 'number' && dict.fcs < timex.length ? timex[dict.fcs] : Number(dict.fcs);
  }
  if (dict.drop !== undefined && dict.drop !== -1) {
    eventsMap.drop = typeof dict.drop === 'number' && dict.drop < timex.length ? timex[dict.drop] : Number(dict.drop);
  }

  return processRawRoastPoints(timex, temp2, temp1, eventsMap, fileName, fileContent);
}

/**
 * Creates a high-fidelity realistic sample Artisan roast log for instant testing and demo.
 */
export function createSampleArtisanLog(
  profileName: string = 'Ethiopia_Chelchele_Filter_01.alog',
  rating: 'Excellent' | 'Good' | 'Bad' = 'Excellent'
): ParsedArtisanLog {
  const points: { time: number; bt: number; et: number }[] = [];
  
  // Total roast: 600s (10 min)
  const totalSec = rating === 'Bad' ? 780 : 570; // 9:30 for light filter, 13:00 for baked/bad
  const chargeTemp = 205.0;
  const turningPointSec = 75;
  const turningPointTemp = 96.0;
  const dryEndSec = 270; // 4:30
  const dryEndTemp = 155.0;
  const fcSec = rating === 'Bad' ? 560 : 455; // 7:35
  const fcTemp = 196.0;
  const dropSec = totalSec;
  const dropTemp = rating === 'Bad' ? 222.0 : 208.5;

  for (let s = 0; s <= totalSec; s += 2) {
    let bt: number;
    let et: number;

    if (s <= turningPointSec) {
      // Drop from charge to turning point
      const progress = s / turningPointSec;
      bt = chargeTemp - (chargeTemp - turningPointTemp) * Math.sin(progress * (Math.PI / 2));
      et = 215 - progress * 40;
    } else if (s <= dryEndSec) {
      // Turning point to dry end
      const progress = (s - turningPointSec) / (dryEndSec - turningPointSec);
      bt = turningPointTemp + (dryEndTemp - turningPointTemp) * Math.pow(progress, 0.9);
      et = 175 + progress * 35;
    } else if (s <= fcSec) {
      // Maillard phase
      const progress = (s - dryEndSec) / (fcSec - dryEndSec);
      bt = dryEndTemp + (fcTemp - dryEndTemp) * Math.pow(progress, 0.85);
      et = 210 + progress * 15;
    } else {
      // Development phase
      const progress = (s - fcSec) / (dropSec - fcSec);
      if (rating === 'Bad') {
        // Flat/flick or baked plateau
        bt = fcTemp + (dropTemp - fcTemp) * Math.pow(progress, 0.4);
      } else {
        // Smooth steadily declining RoR
        bt = fcTemp + (dropTemp - fcTemp) * (1 - Math.exp(-progress * 1.8)) / (1 - Math.exp(-1.8));
      }
      et = 225 - progress * 10;
    }

    // Add tiny realistic sensor noise (+/- 0.15)
    const noise = (Math.sin(s * 0.4) + Math.cos(s * 0.7)) * 0.12;
    points.push({
      time: s,
      bt: Number((bt + noise).toFixed(1)),
      et: Number((et + noise * 0.8).toFixed(1))
    });
  }

  return processRawRoastPoints(
    points.map(p => p.time),
    points.map(p => p.bt),
    points.map(p => p.et),
    {
      charge: 0,
      dry: dryEndSec,
      fc: fcSec,
      drop: dropSec
    },
    profileName
  );
}
