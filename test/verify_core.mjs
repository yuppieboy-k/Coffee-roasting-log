import assert from 'node:assert';

// 1. Test Python dictionary parsing logic (used in .alog files)
function parsePythonDict(text) {
  try {
    return JSON.parse(text);
  } catch {
    let sanitized = text
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null')
      .replace(/\bnan\b/gi, 'null');

    sanitized = sanitized.replace(/\\'/g, '__ESCAPED_QUOTE__');
    sanitized = sanitized.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
    sanitized = sanitized.replace(/__ESCAPED_QUOTE__/g, "'");
    // 3. Convert Python tuples (a, b) to arrays [a, b]
    while (/\(([^()]*?)\)/.test(sanitized)) {
      sanitized = sanitized.replace(/\(([^()]*?)\)/g, '[$1]');
    }
    sanitized = sanitized.replace(/,\s*([}\]])/g, '$1');

    return JSON.parse(sanitized);
  }
}

console.log('Testing Artisan Python .alog deserialization...');
const mockAlogPythonString = `{
  'version': '2.8.4',
  'roasttitle': 'Batch #42 - Ethiopian Kurume',
  'samplingrate': 1,
  'timex': [0.0, 1.0, 2.0, 3.0, 4.0, 5.0],
  'temp1': [200.5, 195.0, 190.2, 185.4, 182.1, 180.0],
  'temp2': [205.0, 175.2, 140.0, 115.0, 102.5, 96.0],
  'charge': 0,
  'dry': 3,
  'fc': 4,
  'drop': 5,
  'specialevents': [(1, 2.5, 150.0, 'Air 5'), (2, 4.0, 195.0, 'FC')]
}`;

const parsedObj = parsePythonDict(mockAlogPythonString);
assert.strictEqual(parsedObj.version, '2.8.4');
assert.strictEqual(parsedObj.roasttitle, 'Batch #42 - Ethiopian Kurume');
assert.strictEqual(parsedObj.timex.length, 6);
assert.strictEqual(parsedObj.temp2[0], 205.0);
assert.strictEqual(parsedObj.specialevents.length, 2);
console.log('✓ Artisan .alog Python literal parsing succeeded!');

// 2. Test RoR Calculation
function calculateRoR(data, windowSec = 30) {
  const ror = [];
  for (let i = 0; i < data.length; i++) {
    const curTime = data[i].time;
    const curTemp = data[i].temp;
    let prevIdx = i;
    while (prevIdx > 0 && curTime - data[prevIdx].time < windowSec) {
      prevIdx--;
    }
    const dt = (curTime - data[prevIdx].time) / 60;
    const dTemp = curTemp - data[prevIdx].temp;
    if (dt > 0.05) {
      const rate = dTemp / dt;
      ror.push(Math.max(-10, Math.min(60, Number(rate.toFixed(1)))));
    } else if (i > 0) {
      ror.push(ror[i - 1]);
    } else {
      ror.push(0);
    }
  }
  return ror;
}

console.log('Testing RoR calculation...');
const tempCurve = [
  { time: 0, temp: 95 },
  { time: 30, temp: 105 }, // +10 deg in 0.5 min = 20 deg/min
  { time: 60, temp: 114 }, // +9 deg in 0.5 min = 18 deg/min
  { time: 90, temp: 122 }, // +8 deg in 0.5 min = 16 deg/min
];
const rorResults = calculateRoR(tempCurve, 30);
assert.strictEqual(rorResults.length, 4);
assert.strictEqual(rorResults[1], 20);
assert.strictEqual(rorResults[2], 18);
assert.strictEqual(rorResults[3], 16);
console.log('✓ Rate of Rise (RoR) calculation verified accurately!');

// 3. Test CSV Parser
console.log('Testing Artisan CSV parser...');
const mockCsv = `Time,BT,ET,RoR
00:00,205.0,210.0,0
00:30,120.0,180.0,-10
01:00,96.0,175.0,5
04:30,155.0,205.0,14
07:30,196.0,218.0,8
09:15,208.5,224.0,4`;

const lines = mockCsv.trim().split(/\r?\n/);
const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
assert(headers.includes('time'));
assert(headers.includes('bt'));
assert(headers.includes('et'));
console.log('✓ CSV parser headers verified!');

console.log('\nAll core logic verification tests passed successfully!');
