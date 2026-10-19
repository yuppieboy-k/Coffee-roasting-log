import React, { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Line } from 'react-chartjs-2';
import { ParsedArtisanLog } from '../types';
import { Flame, Clock, Thermometer, Activity, Eye, EyeOff } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin
);

interface RoastChartProps {
  parsedLog: ParsedArtisanLog;
  temperatureUnit?: 'C' | 'F';
  height?: number;
  showPhases?: boolean;
  title?: string;
  comparisonLogs?: { label: string; log: ParsedArtisanLog; color: string }[];
}

export const RoastChart: React.FC<RoastChartProps> = ({
  parsedLog,
  temperatureUnit = 'C',
  height = 420,
  showPhases = true,
  title,
  comparisonLogs = []
}) => {
  const [showBT, setShowBT] = useState(true);
  const [showET, setShowET] = useState(true);
  const [showRoRBT, setShowRoRBT] = useState(true);
  const [showRoRET, setShowRoRET] = useState(false);

  // Conversion helper
  const convertTemp = (celsius: number | undefined) => {
    if (celsius === undefined || isNaN(celsius)) return undefined;
    if (temperatureUnit === 'F') {
      return Number(((celsius * 9) / 5 + 32).toFixed(1));
    }
    return celsius;
  };

  const convertRor = (rorC: number | undefined) => {
    if (rorC === undefined || isNaN(rorC)) return undefined;
    if (temperatureUnit === 'F') {
      return Number((rorC * 1.8).toFixed(1));
    }
    return rorC;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Prepare chart data
  const { chartData, chartOptions } = useMemo(() => {
    const labels = parsedLog.dataPoints.map(p => formatTime(p.timeSec));

    const datasets: any[] = [];

    // Main Log Bean Temp (BT)
    if (showBT) {
      datasets.push({
        label: `Bean Temp (BT) °${temperatureUnit}`,
        data: parsedLog.dataPoints.map(p => convertTemp(p.beanTemp)),
        borderColor: '#ea580c', // copper/amber
        backgroundColor: 'rgba(234, 88, 12, 0.05)',
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHitRadius: 10,
        tension: 0.15,
        yAxisID: 'yTemp',
      });
    }

    // Main Log Environment Temp (ET)
    if (showET) {
      datasets.push({
        label: `Env Temp (ET) °${temperatureUnit}`,
        data: parsedLog.dataPoints.map(p => convertTemp(p.envTemp)),
        borderColor: '#0284c7', // cool sky blue
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.15,
        borderDash: [4, 4],
        yAxisID: 'yTemp',
      });
    }

    // Main Log RoR BT
    if (showRoRBT) {
      datasets.push({
        label: `RoR BT °${temperatureUnit}/min`,
        data: parsedLog.dataPoints.map(p => convertRor(p.rorBT)),
        borderColor: '#d946ef', // vibrant magenta
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.25,
        yAxisID: 'yRoR',
      });
    }

    // Main Log RoR ET
    if (showRoRET) {
      datasets.push({
        label: `RoR ET °${temperatureUnit}/min`,
        data: parsedLog.dataPoints.map(p => convertRor(p.rorET)),
        borderColor: '#94a3b8',
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.25,
        yAxisID: 'yRoR',
      });
    }

    // Comparison logs overlay (if provided)
    comparisonLogs.forEach((comp, idx) => {
      datasets.push({
        label: `${comp.label} BT`,
        data: comp.log.dataPoints.map(p => convertTemp(p.beanTemp)),
        borderColor: comp.color || (idx === 0 ? '#10b981' : '#a855f7'),
        borderWidth: 2,
        borderDash: [5, 3],
        pointRadius: 0,
        yAxisID: 'yTemp',
      });
    });

    // Annotations for Artisan Events (CHARGE, DRY, FC, DROP)
    const annotations: any = {};
    const events = parsedLog.events;

    const addEventLine = (
      id: string,
      timeSec: number | undefined,
      label: string,
      color: string
    ) => {
      if (timeSec === undefined || parsedLog.dataPoints.length === 0) return;
      const timeStr = formatTime(timeSec);
      let index = parsedLog.dataPoints.findIndex(p => p.timeSec >= timeSec - 0.2);
      if (index === -1 && timeSec >= parsedLog.dataPoints[parsedLog.dataPoints.length - 1].timeSec - 5) {
        index = parsedLog.dataPoints.length - 1;
      }
      if (index === -1) return;

      annotations[id] = {
        type: 'line',
        xMin: index,
        xMax: index,
        borderColor: color,
        borderWidth: 1.5,
        borderDash: [3, 3],
        label: {
          display: true,
          content: `${label} (${timeStr})`,
          position: 'start',
          backgroundColor: 'rgba(28, 25, 23, 0.85)',
          color: '#f5f5f4',
          font: { size: 10, weight: 'bold' },
          padding: 3,
          borderRadius: 4,
        },
      };
    };

    if (events.charge) {
      addEventLine('charge', events.charge.timeSec, 'CHARGE', '#f59e0b');
    }
    if (events.dryEnd) {
      addEventLine('dryEnd', events.dryEnd.timeSec, 'DRY END', '#eab308');
    }
    if (events.firstCrackStart) {
      addEventLine('fcStart', events.firstCrackStart.timeSec, 'FC START', '#ec4899');
    }
    if (events.drop) {
      addEventLine('drop', events.drop.timeSec, 'DROP', '#ef4444');
    }

    const options: ChartOptions<'line'> = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: 'rgba(12, 10, 9, 0.95)',
          titleColor: '#f5f5f4',
          bodyColor: '#e7e5e4',
          borderColor: '#44403c',
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          callbacks: {
            title: (tooltipItems) => `Roast Time: ${tooltipItems[0].label}`,
          },
        },
        annotation: {
          annotations,
        },
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(68, 64, 60, 0.25)',
          },
          ticks: {
            color: '#a8a29e',
            maxTicksLimit: 12,
            font: { size: 11 },
          },
        },
        yTemp: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: `Temperature (°${temperatureUnit})`,
            color: '#ea580c',
            font: { size: 12, weight: 'bold' },
          },
          grid: {
            color: 'rgba(68, 64, 60, 0.25)',
          },
          ticks: {
            color: '#a8a29e',
            font: { size: 11 },
          },
        },
        yRoR: {
          type: 'linear',
          display: showRoRBT || showRoRET,
          position: 'right',
          title: {
            display: true,
            text: `RoR (°${temperatureUnit}/min)`,
            color: '#d946ef',
            font: { size: 12, weight: 'bold' },
          },
          grid: {
            drawOnChartArea: false, // only grid lines from yTemp
          },
          ticks: {
            color: '#c084fc',
            font: { size: 11 },
          },
          min: -2,
          max: temperatureUnit === 'F' ? 65 : 35,
        },
      },
    };

    return {
      chartData: { labels, datasets },
      chartOptions: options,
    };
  }, [parsedLog, showBT, showET, showRoRBT, showRoRET, temperatureUnit, comparisonLogs]);

  const { metrics } = parsedLog;

  return (
    <div className="bg-roast-surface border border-roast-border rounded-xl p-4 shadow-xl">
      {/* Header & Metric Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-roast-border">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-roast-copper" />
          <h3 className="text-base font-semibold text-roast-text">
            {title || parsedLog.fileName || 'Artisan Roast Profile'}
          </h3>
          <span className="text-xs px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
            {formatTime(metrics.totalTimeSec)} total
          </span>
        </div>

        {/* Visibility Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBT(!showBT)}
            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${
              showBT
                ? 'bg-orange-950/70 text-orange-300 border border-orange-700/60'
                : 'bg-stone-800/50 text-stone-500 border border-stone-800 hover:text-stone-300'
            }`}
          >
            {showBT ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            BT ({metrics.dropTemp ? `${convertTemp(metrics.dropTemp)}°` : ''})
          </button>

          <button
            onClick={() => setShowET(!showET)}
            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${
              showET
                ? 'bg-sky-950/70 text-sky-300 border border-sky-700/60'
                : 'bg-stone-800/50 text-stone-500 border border-stone-800 hover:text-stone-300'
            }`}
          >
            {showET ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            ET
          </button>

          <button
            onClick={() => setShowRoRBT(!showRoRBT)}
            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${
              showRoRBT
                ? 'bg-fuchsia-950/70 text-fuchsia-300 border border-fuchsia-700/60'
                : 'bg-stone-800/50 text-stone-500 border border-stone-800 hover:text-stone-300'
            }`}
          >
            {showRoRBT ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            RoR BT
          </button>

          <button
            onClick={() => setShowRoRET(!showRoRET)}
            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${
              showRoRET
                ? 'bg-stone-800 text-stone-200 border border-stone-600'
                : 'bg-stone-800/50 text-stone-500 border border-stone-800 hover:text-stone-300'
            }`}
          >
            {showRoRET ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            RoR ET
          </button>
        </div>
      </div>

      {/* Roast Phase Visual Bar */}
      {showPhases && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-roast-muted mb-1.5 font-mono">
            <span>Drying Phase: {metrics.dryingPercent}% ({formatTime(metrics.dryingTimeSec)})</span>
            <span>Maillard: {metrics.maillardPercent}% ({formatTime(metrics.maillardTimeSec)})</span>
            <span className="text-amber-400 font-semibold">
              DTR (Dev): {metrics.developmentPercent}% ({formatTime(metrics.developmentTimeSec)})
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-stone-900 overflow-hidden flex border border-stone-800">
            <div
              className="h-full bg-emerald-600/80 transition-all"
              style={{ width: `${metrics.dryingPercent}%` }}
              title={`Drying: ${metrics.dryingPercent}%`}
            />
            <div
              className="h-full bg-amber-600/80 transition-all"
              style={{ width: `${metrics.maillardPercent}%` }}
              title={`Maillard: ${metrics.maillardPercent}%`}
            />
            <div
              className="h-full bg-rose-600/80 transition-all"
              style={{ width: `${metrics.developmentPercent}%` }}
              title={`Development (DTR): ${metrics.developmentPercent}%`}
            />
          </div>
        </div>
      )}

      {/* Interactive Chart Canvas */}
      {parsedLog.dataPoints.length > 0 ? (
        <div style={{ height: `${height}px` }} className="relative w-full">
          <Line data={chartData} options={chartOptions} />
        </div>
      ) : (
        <div className="py-8 px-4 bg-stone-900/50 border border-stone-800/80 rounded-lg text-center text-xs text-stone-400">
          Key Artisan roast milestones loaded from Google Sheets. Connect Google Drive or attach the <code className="text-amber-400">.alog</code> file to view the full second-by-second temperature &amp; RoR curve.
        </div>
      )}

      {/* Milestone Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4 pt-3 border-t border-roast-border text-xs">
        <div className="bg-stone-900/60 p-2 rounded border border-stone-800">
          <div className="text-stone-400 flex items-center gap-1">
            <Thermometer className="w-3 h-3 text-amber-500" /> Charge
          </div>
          <div className="font-mono font-semibold text-roast-text mt-0.5">
            {metrics.chargeTemp ? `${convertTemp(metrics.chargeTemp)}°${temperatureUnit}` : 'N/A'}
          </div>
        </div>

        <div className="bg-stone-900/60 p-2 rounded border border-stone-800">
          <div className="text-stone-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-yellow-500" /> Turning Point
          </div>
          <div className="font-mono font-semibold text-roast-text mt-0.5">
            {metrics.turningPointTimeSec !== undefined
              ? `${formatTime(metrics.turningPointTimeSec)}${metrics.turningPointTemp ? ` (${convertTemp(metrics.turningPointTemp)}°)` : ''}`
              : 'N/A'}
          </div>
        </div>

        <div className="bg-stone-900/60 p-2 rounded border border-stone-800">
          <div className="text-stone-400 flex items-center gap-1">
            <Activity className="w-3 h-3 text-emerald-500" /> Dry End
          </div>
          <div className="font-mono font-semibold text-roast-text mt-0.5">
            {metrics.dryEndTimeSec !== undefined
              ? `${formatTime(metrics.dryEndTimeSec)}${metrics.dryEndTemp ? ` (${convertTemp(metrics.dryEndTemp)}°)` : ''}`
              : 'N/A'}
          </div>
        </div>

        <div className="bg-stone-900/80 p-2 rounded border border-pink-900/50">
          <div className="text-pink-300 flex items-center gap-1 font-medium">
            <Flame className="w-3 h-3 text-pink-500" /> First Crack
          </div>
          <div className="font-mono font-bold text-pink-200 mt-0.5">
            {metrics.firstCrackTimeSec !== undefined
              ? `${formatTime(metrics.firstCrackTimeSec)}${metrics.firstCrackTemp ? ` (${convertTemp(metrics.firstCrackTemp)}°)` : ''}`
              : 'Not recorded'}
          </div>
        </div>

        <div className="bg-stone-900/80 p-2 rounded border border-amber-900/50 col-span-2 sm:col-span-1">
          <div className="text-amber-300 flex items-center gap-1 font-medium">
            <Flame className="w-3 h-3 text-amber-500" /> DTR &amp; Drop
          </div>
          <div className="font-mono font-bold text-amber-400 mt-0.5">
            {metrics.developmentPercent}% ({formatTime(metrics.dropTimeSec)}{metrics.dropTemp ? ` @ ${convertTemp(metrics.dropTemp)}°` : ''})
          </div>
        </div>
      </div>
    </div>
  );
};
