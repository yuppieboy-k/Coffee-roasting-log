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
 * Normalizes raw time and temperature arrays into a full ParsedArtisanLog.
 * Aligns with Artisan Scope conventions:
 * - Time 0:00 is anchored at CHARGE (if charge is defined).
 * - Data points are trimmed to the roast window [CHARGE .. DROP + cooling buffer] so long preheats don't squash the curve.
 */
function processRawRoastPoints(
  rawTimeArr: number[],
  rawBtArr: number[],
  rawEtArr: number[],
  eventsMap: {
    charge?: number;
    tp?: number;
    dry?: number;
    fc?: number;
    fce?: number;
    sc?: number;
    drop?: number;
    chargeTemp?: number;
    tpTemp?: number;
    dryTemp?: number;
    fcTemp?: number;
    dropTemp?: number;
  },
  fileName: string,
  rawSource?: string,
  roastDate?: string
): ParsedArtisanLog {
  const rawPointsCount = Math.min(rawTimeArr.length, rawBtArr.length);
  if (rawPointsCount === 0) {
    throw new Error('No valid temperature readings found in Artisan log');
  }

  // Raw charge and drop in original timex coordinates
  const rawChargeTime = eventsMap.charge !== undefined ? eventsMap.charge : rawTimeArr[0];
  const rawDropTime = eventsMap.drop !== undefined ? eventsMap.drop : rawTimeArr[rawPointsCount - 1];

  // Determine slice bounds so long preheat or post-drop logs are cleanly focused on the roast
  let startIdx = 0;
  if (eventsMap.charge !== undefined) {
    const cIdx = rawTimeArr.findIndex(t => t >= rawChargeTime - 0.001);
    if (cIdx > 0) startIdx = cIdx;
  }

  let endIdx = rawPointsCount - 1;
  if (eventsMap.drop !== undefined) {
    // Include up to 15 seconds after DROP for visual context, or stop at DROP if preferred
    const dIdx = rawTimeArr.findIndex(t => t >= rawDropTime - 0.001);
    if (dIdx > startIdx) {
      endIdx = Math.min(rawPointsCount - 1, dIdx);
    }
  }

  // Build Charge-relative arrays (where CHARGE = 0.0s, matching Artisan's X-axis and computed times)
  const timeArr: number[] = [];
  const btArr: number[] = [];
  const etArr: number[] = [];

  for (let i = startIdx; i <= endIdx; i++) {
    timeArr.push(Math.max(0, rawTimeArr[i] - rawChargeTime));
    btArr.push(rawBtArr[i]);
    etArr.push(rawEtArr[i] !== undefined ? rawEtArr[i] : rawBtArr[i]);
  }

  const pointsCount = timeArr.length;

  // Pre-calculate Rate of Rise (RoR)
  const btData = [];
  const etData = [];
  for (let i = 0; i < pointsCount; i++) {
    btData.push({ time: timeArr[i], temp: btArr[i] });
    etData.push({ time: timeArr[i], temp: etArr[i] });
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

  // Helper to convert raw timex coordinate to Charge-relative timeSec
  const toRelSec = (rawSec: number | undefined): number | undefined => {
    if (rawSec === undefined || isNaN(rawSec)) return undefined;
    return Number(Math.max(0, rawSec - rawChargeTime).toFixed(1));
  };

  // 1. Charge (at 0.0s relative)
  const chargeTimeSec = 0;
  const chargeTemp = eventsMap.chargeTemp !== undefined
    ? Number(eventsMap.chargeTemp.toFixed(1))
    : dataPoints[0].beanTemp;

  // 2. Drop event
  const lastPoint = dataPoints[dataPoints.length - 1];
  const dropTimeSec = toRelSec(rawDropTime) ?? lastPoint.timeSec;
  const dropPt = dataPoints.find(p => p.timeSec >= dropTimeSec - 0.2) || lastPoint;
  const dropTemp = eventsMap.dropTemp !== undefined
    ? Number(eventsMap.dropTemp.toFixed(1))
    : dropPt.beanTemp;

  // 3. Turning Point (minimum BT in first 180s after charge)
  let turningPointTimeSec = toRelSec(eventsMap.tp);
  let turningPointTemp = eventsMap.tpTemp !== undefined ? Number(eventsMap.tpTemp.toFixed(1)) : undefined;

  if (turningPointTimeSec === undefined || turningPointTemp === undefined) {
    let minBt = chargeTemp;
    let minTime = 0;
    const searchLimitTime = Math.min(180, dropTimeSec);
    for (let i = 0; i < dataPoints.length; i++) {
      if (dataPoints[i].timeSec > searchLimitTime) break;
      if (dataPoints[i].beanTemp < minBt) {
        minBt = dataPoints[i].beanTemp;
        minTime = dataPoints[i].timeSec;
      }
    }
    if (turningPointTimeSec === undefined) turningPointTimeSec = minTime;
    if (turningPointTemp === undefined) turningPointTemp = minBt;
  }

  // 4. Dry End
  let dryEndTimeSec = toRelSec(eventsMap.dry);
  let dryEndTemp = eventsMap.dryTemp !== undefined ? Number(eventsMap.dryTemp.toFixed(1)) : undefined;
  if (dryEndTimeSec === undefined) {
    const autoDry = dataPoints.find(p => p.timeSec > turningPointTimeSec! && p.beanTemp >= 150);
    if (autoDry) {
      dryEndTimeSec = autoDry.timeSec;
      dryEndTemp = autoDry.beanTemp;
    }
  } else if (dryEndTemp === undefined) {
    const pt = dataPoints.find(p => p.timeSec >= dryEndTimeSec! - 0.2);
    dryEndTemp = pt?.beanTemp;
  }

  // 5. First Crack Start
  let firstCrackTimeSec = toRelSec(eventsMap.fc);
  let firstCrackTemp = eventsMap.fcTemp !== undefined ? Number(eventsMap.fcTemp.toFixed(1)) : undefined;
  if (firstCrackTimeSec === undefined) {
    // Only auto-detect if no explicit event marker was found in the file
    const autoFc = dataPoints.find(
      p => p.timeSec > (dryEndTimeSec || turningPointTimeSec || 60) && p.beanTemp >= 195
    );
    if (autoFc && autoFc.timeSec < dropTimeSec) {
      firstCrackTimeSec = autoFc.timeSec;
      firstCrackTemp = autoFc.beanTemp;
    }
  } else if (firstCrackTemp === undefined) {
    const pt = dataPoints.find(p => p.timeSec >= firstCrackTimeSec! - 0.2);
    firstCrackTemp = pt?.beanTemp;
  }

  // Calculate roast phases (relative to total roast duration from Charge to Drop)
  const totalRoastSec = Number(Math.max(1, dropTimeSec - chargeTimeSec).toFixed(1));
  const dryingTimeSec = dryEndTimeSec !== undefined ? Number(Math.max(0, dryEndTimeSec - chargeTimeSec).toFixed(1)) : 0;
  const dryingPercent = Number(((dryingTimeSec / totalRoastSec) * 100).toFixed(1));

  let maillardTimeSec = 0;
  if (dryEndTimeSec !== undefined && firstCrackTimeSec !== undefined && firstCrackTimeSec > dryEndTimeSec) {
    maillardTimeSec = Number((firstCrackTimeSec - dryEndTimeSec).toFixed(1));
  }
  const maillardPercent = Number(((maillardTimeSec / totalRoastSec) * 100).toFixed(1));

  let developmentTimeSec = 0;
  if (firstCrackTimeSec !== undefined && dropTimeSec > firstCrackTimeSec) {
    developmentTimeSec = Number((dropTimeSec - firstCrackTimeSec).toFixed(1));
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

  if (dryEndTimeSec !== undefined && dryEndTemp !== undefined) {
    events.dryEnd = {
      timeSec: dryEndTimeSec,
      temp: dryEndTemp,
      type: 'DRY_END',
      label: 'Dry End'
    };
  }

  if (firstCrackTimeSec !== undefined && firstCrackTemp !== undefined) {
    events.firstCrackStart = {
      timeSec: firstCrackTimeSec,
      temp: firstCrackTemp,
      type: 'FC_START',
      label: 'First Crack'
    };
  }

  const validRors = rorBT.slice(2).filter(r => !isNaN(r) && isFinite(r));
  const maxRorBT = validRors.length > 0 ? Math.max(...validRors) : undefined;
  const endRorBT = rorBT[rorBT.length - 1];

  return {
    fileName,
    roastDate,
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
      maxRorBT: maxRorBT !== undefined && isFinite(maxRorBT) ? maxRorBT : undefined,
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
  // dict.timeindex = [CHARGE, DRY, FCs, FCe, SCs, SCe, DROP, COOL] (indices into timex)
  // dict.computed = { FCs_time, FCs_BT, DRY_time, DROP_time, TP_time, ... } (seconds relative to CHARGE)
  let timex: number[] = [];
  let temp1: number[] = [];
  let temp2: number[] = [];

  if (Array.isArray(dict.timex)) {
    timex = dict.timex.map(Number);
  } else if (Array.isArray(dict.time)) {
    timex = dict.time.map(Number);
  }

  if (Array.isArray(dict.temp2)) {
    temp2 = dict.temp2.map(Number);
  }
  if (Array.isArray(dict.temp1)) {
    temp1 = dict.temp1.map(Number);
  }

  // Sanitize Artisan's -1.0 (or <= 0) sensor dropout sentinel values via linear interpolation
  const sanitizeTempArray = (arr: number[]): number[] => {
    const cleaned = [...arr];
    for (let i = 0; i < cleaned.length; i++) {
      if (isNaN(cleaned[i]) || cleaned[i] <= 0) {
        // Find previous valid
        let prevVal: number | undefined;
        let prevIdx = i - 1;
        while (prevIdx >= 0) {
          if (!isNaN(cleaned[prevIdx]) && cleaned[prevIdx] > 0) {
            prevVal = cleaned[prevIdx];
            break;
          }
          prevIdx--;
        }
        // Find next valid
        let nextVal: number | undefined;
        let nextIdx = i + 1;
        while (nextIdx < cleaned.length) {
          if (!isNaN(cleaned[nextIdx]) && cleaned[nextIdx] > 0) {
            nextVal = cleaned[nextIdx];
            break;
          }
          nextIdx++;
        }
        if (prevVal !== undefined && nextVal !== undefined) {
          const ratio = (i - prevIdx) / (nextIdx - prevIdx);
          cleaned[i] = Number((prevVal + (nextVal - prevVal) * ratio).toFixed(2));
        } else if (prevVal !== undefined) {
          cleaned[i] = prevVal;
        } else if (nextVal !== undefined) {
          cleaned[i] = nextVal;
        } else {
          cleaned[i] = 20;
        }
      }
    }
    return cleaned;
  };

  if (temp2.length > 0) temp2 = sanitizeTempArray(temp2);
  if (temp1.length > 0) temp1 = sanitizeTempArray(temp1);

  if (timex.length === 0 && temp2.length > 0) {
    const samplingRate = dict.samplingrate || dict.samplinginterval || 1;
    timex = temp2.map((_, i) => i * samplingRate);
  }

  if (temp2.length === 0 && temp1.length > 0) {
    temp2 = [...temp1];
  }

  const eventsMap: {
    charge?: number;
    tp?: number;
    dry?: number;
    fc?: number;
    fce?: number;
    sc?: number;
    drop?: number;
    chargeTemp?: number;
    tpTemp?: number;
    dryTemp?: number;
    fcTemp?: number;
    dropTemp?: number;
  } = {};

  // 1. Primary Artisan native format: timeindex = [CHARGE, DRY, FCs, FCe, SCs, SCe, DROP, COOL]
  // Note: charge index is -1 if not set (>= 0 is valid); other slots are 0 if not set (> 0 is valid).
  if (Array.isArray(dict.timeindex) && dict.timeindex.length >= 7 && timex.length > 0) {
    const ti = dict.timeindex.map(Number);
    if (ti[0] >= 0 && ti[0] < timex.length) {
      eventsMap.charge = timex[ti[0]];
      if (temp2[ti[0]] > 0) eventsMap.chargeTemp = temp2[ti[0]];
    }
    if (ti[1] > 0 && ti[1] < timex.length) {
      eventsMap.dry = timex[ti[1]];
      if (temp2[ti[1]] > 0) eventsMap.dryTemp = temp2[ti[1]];
    }
    if (ti[2] > 0 && ti[2] < timex.length) {
      eventsMap.fc = timex[ti[2]];
      if (temp2[ti[2]] > 0) eventsMap.fcTemp = temp2[ti[2]];
    }
    if (ti[3] > 0 && ti[3] < timex.length) {
      eventsMap.fce = timex[ti[3]];
    }
    if (ti[4] > 0 && ti[4] < timex.length) {
      eventsMap.sc = timex[ti[4]];
    }
    if (ti[6] > 0 && ti[6] < timex.length) {
      eventsMap.drop = timex[ti[6]];
      if (temp2[ti[6]] > 0) eventsMap.dropTemp = temp2[ti[6]];
    }
  }

  // 2. Fallback / supplement from Artisan's `computed` dictionary
  // Note: `computed` times in Artisan are always relative to CHARGE!
  if (dict.computed && typeof dict.computed === 'object') {
    const comp = dict.computed;
    const baseCharge = eventsMap.charge ?? (timex.length > 0 ? timex[0] : 0);

    if (eventsMap.chargeTemp === undefined && typeof comp.CHARGE_BT === 'number') {
      eventsMap.chargeTemp = comp.CHARGE_BT;
    }
    if (typeof comp.TP_time === 'number' && comp.TP_time > 0) {
      eventsMap.tp = baseCharge + comp.TP_time;
    }
    if (typeof comp.TP_BT === 'number' && comp.TP_BT > 0) {
      eventsMap.tpTemp = comp.TP_BT;
    }
    if (eventsMap.dry === undefined && typeof comp.DRY_time === 'number' && comp.DRY_time > 0) {
      eventsMap.dry = baseCharge + comp.DRY_time;
    }
    if (eventsMap.dryTemp === undefined && typeof comp.DRY_BT === 'number' && comp.DRY_BT > 0) {
      eventsMap.dryTemp = comp.DRY_BT;
    }
    if (eventsMap.fc === undefined && typeof comp.FCs_time === 'number' && comp.FCs_time > 0) {
      eventsMap.fc = baseCharge + comp.FCs_time;
    }
    if (eventsMap.fcTemp === undefined && typeof comp.FCs_BT === 'number' && comp.FCs_BT > 0) {
      eventsMap.fcTemp = comp.FCs_BT;
    }
    if (eventsMap.drop === undefined && typeof comp.DROP_time === 'number' && comp.DROP_time > 0) {
      eventsMap.drop = baseCharge + comp.DROP_time;
    }
    if (eventsMap.dropTemp === undefined && typeof comp.DROP_BT === 'number' && comp.DROP_BT > 0) {
      eventsMap.dropTemp = comp.DROP_BT;
    }
  }

  // 3. Fallback to flat dictionary keys (for custom JSON exports or older formats)
  const getFlatEventTime = (...keys: string[]): number | undefined => {
    for (const key of keys) {
      const val = dict[key];
      if (val !== undefined && val !== null && val !== -1 && val !== '') {
        const num = Number(val);
        if (!isNaN(num) && num >= 0) {
          if (Number.isInteger(num) && num < timex.length && timex.length > 0) {
            return timex[num];
          }
          return num;
        }
      }
    }
    return undefined;
  };

  if (eventsMap.charge === undefined) {
    eventsMap.charge = getFlatEventTime('charge', 'CHARGE', 'chargetime', 'charge_time');
  }
  if (eventsMap.dry === undefined) {
    eventsMap.dry = getFlatEventTime('dry', 'DRY', 'dryend', 'dry_end', 'drytime', 'dry_time');
  }
  if (eventsMap.fc === undefined) {
    eventsMap.fc = getFlatEventTime(
      'fc', 'FC', 'fcs', 'FCS', 'firstcrack', 'first_crack', 'firstcrackstart',
      'fc_time', 'fcs_time', 'fcstart'
    );
  }
  if (eventsMap.fce === undefined) {
    eventsMap.fce = getFlatEventTime('fce', 'FCE', 'firstcrackend', 'first_crack_end', 'fce_time');
  }
  if (eventsMap.sc === undefined) {
    eventsMap.sc = getFlatEventTime('sc', 'SC', 'scs', 'SCS', 'secondcrack', 'second_crack', 'sc_time');
  }
  if (eventsMap.drop === undefined) {
    eventsMap.drop = getFlatEventTime('drop', 'DROP', 'droptime', 'drop_time', 'cool', 'dump');
  }

  // Extract roast date if present in .alog (e.g. roastisodate: '2026-10-12', roasttime: '17:25:34')
  let roastDate: string | undefined;
  if (dict.roastisodate) {
    roastDate = dict.roasttime
      ? `${dict.roastisodate}T${String(dict.roasttime).slice(0, 5)}`
      : String(dict.roastisodate);
  }

  let greenWeightGrams: number | undefined;
  let roastedWeightGrams: number | undefined;
  if (Array.isArray(dict.weight) && dict.weight.length >= 2) {
    const wIn = Number(dict.weight[0]);
    const wOut = Number(dict.weight[1]);
    const unit = String(dict.weight[2] || 'g').toLowerCase();
    const factor = unit === 'kg' ? 1000 : unit === 'lb' ? 453.592 : 1;
    if (!isNaN(wIn) && wIn > 0) greenWeightGrams = Math.round(wIn * factor);
    if (!isNaN(wOut) && wOut > 0) roastedWeightGrams = Math.round(wOut * factor);
  }

  const parsed = processRawRoastPoints(timex, temp2, temp1, eventsMap, fileName, fileContent, roastDate);
  if (greenWeightGrams !== undefined) parsed.greenWeightGrams = greenWeightGrams;
  if (roastedWeightGrams !== undefined) parsed.roastedWeightGrams = roastedWeightGrams;
  return parsed;
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
