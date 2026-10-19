import React, { useMemo, useState } from 'react';
import {
  AppSettings,
  RoastLog,
  RoastRating,
} from '../types';
import {
  LineChart,
  Filter,
  Search,
  Scale,
  Percent,
  Layers,
  Sparkles,
  Flame,
  Award
} from 'lucide-react';
import { RoastChart } from '../components/RoastChart';

interface AnalysisPageProps {
  logs: RoastLog[];
  settings: AppSettings;
}

const RATING_COLORS: Record<RoastRating, string> = {
  'Not tasted': '#64748b', // slate-500
  Excellent: '#10b981', // emerald
  'Very good': '#14b8a6', // teal
  Good: '#f59e0b', // amber
  OK: '#94a3b8', // slate
  Bad: '#f43f5e', // rose
};

export const AnalysisPage: React.FC<AnalysisPageProps> = ({ logs, settings }) => {
  // Filter States
  const [selectedBeanId, setSelectedBeanId] = useState<string>('ALL');
  const [selectedRoasterId, setSelectedRoasterId] = useState<string>('ALL');
  const [selectedRating, setSelectedRating] = useState<string>('ALL');
  const [keywordQuery, setKeywordQuery] = useState<string>('');

  // Curve Comparison Selection (IDs of logs to overlay)
  const [comparisonLogIds, setComparisonLogIds] = useState<string[]>([]);

  // Helpers
  const getRoasterName = (id: string) =>
    settings.roasters.find(r => r.id === id)?.name || 'Unknown Roaster';
  const getBeanName = (id: string) =>
    settings.greenBeans.find(b => b.id === id)?.name || 'Unknown Bean';

  // Apply Filters
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (selectedBeanId !== 'ALL' && log.beanId !== selectedBeanId) return false;
      if (selectedRoasterId !== 'ALL' && log.roasterId !== selectedRoasterId) return false;
      if (selectedRating !== 'ALL' && log.rating !== selectedRating) return false;
      if (keywordQuery.trim()) {
        const query = keywordQuery.toLowerCase();
        const matchesNotes = (log.tastingNotes || '').toLowerCase().includes(query);
        const matchesTags = log.flavorDescriptors?.some(t => t.toLowerCase().includes(query));
        if (!matchesNotes && !matchesTags) return false;
      }
      return true;
    });
  }, [logs, selectedBeanId, selectedRoasterId, selectedRating, keywordQuery]);

  // Aggregated Analytics
  const stats = useMemo(() => {
    const totalBatches = filteredLogs.length;
    const totalGreenKg = filteredLogs.reduce((acc, l) => acc + (l.greenWeightGrams || 0), 0) / 1000;
    const totalRoastedKg = filteredLogs.reduce((acc, l) => acc + (l.roastedWeightGrams || 0), 0) / 1000;

    // Rating Counts
    const ratingCounts: Record<RoastRating, number> = {
      'Not tasted': 0,
      Excellent: 0,
      'Very good': 0,
      Good: 0,
      OK: 0,
      Bad: 0,
    };

    let totalWeightLoss = 0;
    let weightLossCount = 0;
    let totalDTR = 0;
    let dtrCount = 0;

    filteredLogs.forEach(l => {
      ratingCounts[l.rating] = (ratingCounts[l.rating] || 0) + 1;
      if (l.weightLossPercent) {
        totalWeightLoss += l.weightLossPercent;
        weightLossCount++;
      }
      if (l.artisanLogParsed?.metrics?.developmentPercent) {
        totalDTR += l.artisanLogParsed.metrics.developmentPercent;
        dtrCount++;
      }
    });

    const avgWeightLoss = weightLossCount > 0 ? (totalWeightLoss / weightLossCount).toFixed(1) : 'N/A';
    const avgDTR = dtrCount > 0 ? (totalDTR / dtrCount).toFixed(1) : 'N/A';

    // Keyword Frequency from Tasting Notes & Flavor tags
    const keywordMap: Record<string, number> = {};
    filteredLogs.forEach(l => {
      // Tags
      l.flavorDescriptors?.forEach(t => {
        const clean = t.toLowerCase();
        keywordMap[clean] = (keywordMap[clean] || 0) + 1;
      });
      // Words in notes (> 3 chars, skip common stopwords)
      const words = l.tastingNotes
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/);
      const stopWords = new Set(['with', 'this', 'that', 'very', 'from', 'notes', 'roast', 'taste', 'good', 'some', 'than']);
      words.forEach(w => {
        if (w.length > 3 && !stopWords.has(w)) {
          keywordMap[w] = (keywordMap[w] || 0) + 1;
        }
      });
    });

    const topKeywords = Object.entries(keywordMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);

    return {
      totalBatches,
      totalGreenKg: totalGreenKg.toFixed(2),
      totalRoastedKg: totalRoastedKg.toFixed(2),
      ratingCounts,
      avgWeightLoss,
      avgDTR,
      topKeywords,
    };
  }, [filteredLogs]);

  // Curve Comparison Setup
  const toggleComparisonLog = (logId: string) => {
    if (comparisonLogIds.includes(logId)) {
      setComparisonLogIds(comparisonLogIds.filter(id => id !== logId));
    } else {
      if (comparisonLogIds.length >= 4) {
        alert('You can compare up to 4 curves simultaneously.');
        return;
      }
      setComparisonLogIds([...comparisonLogIds, logId]);
    }
  };

  const primaryComparisonLog = useMemo(() => {
    if (comparisonLogIds.length === 0) return null;
    return logs.find(l => l.id === comparisonLogIds[0])?.artisanLogParsed || null;
  }, [comparisonLogIds, logs]);

  const overlayComparisonLogs = useMemo(() => {
    if (comparisonLogIds.length <= 1) return [];
    const colors = ['#10b981', '#38bdf8', '#f59e0b', '#ec4899'];
    return comparisonLogIds.slice(1).map((id, index) => {
      const log = logs.find(l => l.id === id);
      return {
        label: `${getBeanName(log?.beanId || '')} (${log?.rating})`,
        log: log?.artisanLogParsed!,
        color: colors[index % colors.length],
      };
    }).filter(c => !!c.log);
  }, [comparisonLogIds, logs]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 pb-24 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-roast-text flex items-center gap-2">
          <LineChart className="w-6 h-6 text-amber-500" /> Roast Analysis & Profiling
        </h1>
        <p className="text-sm text-roast-muted mt-0.5">
          Filter and cross-reference your batches, evaluate sensory trends, and compare Artisan roast curves side-by-side
        </p>
      </div>

      {/* Filter Toolbar Card */}
      <div className="bg-roast-surface border border-roast-border rounded-xl p-4 shadow-xl space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-300">
          <Filter className="w-4 h-4 text-amber-500" /> Filter Criteria
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Green Bean Filter */}
          <div>
            <label className="block text-stone-400 mb-1">Green Bean</label>
            <select
              value={selectedBeanId}
              onChange={(e) => setSelectedBeanId(e.target.value)}
              className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text focus:border-amber-500 focus:outline-none"
            >
              <option value="ALL">All Green Beans</option>
              {settings.greenBeans.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.origin})
                </option>
              ))}
            </select>
          </div>

          {/* Roaster Filter */}
          <div>
            <label className="block text-stone-400 mb-1">Roaster Used</label>
            <select
              value={selectedRoasterId}
              onChange={(e) => setSelectedRoasterId(e.target.value)}
              className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text focus:border-amber-500 focus:outline-none"
            >
              <option value="ALL">All Roasters</option>
              {settings.roasters.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Classification Filter */}
          <div>
            <label className="block text-stone-400 mb-1">Classification Rating</label>
            <select
              value={selectedRating}
              onChange={(e) => setSelectedRating(e.target.value)}
              className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-roast-text focus:border-amber-500 focus:outline-none"
            >
              <option value="ALL">All Classifications</option>
              <option value="Not tasted">Not tasted</option>
              <option value="Excellent">Excellent</option>
              <option value="Very good">Very good</option>
              <option value="Good">Good</option>
              <option value="OK">OK</option>
              <option value="Bad">Bad</option>
            </select>
          </div>

          {/* Keyword Search in Notes */}
          <div>
            <label className="block text-stone-400 mb-1">Tasting Notes Keyword</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-500" />
              <input
                type="text"
                placeholder="e.g. jasmine, baked, citric..."
                value={keywordQuery}
                onChange={(e) => setKeywordQuery(e.target.value)}
                className="w-full bg-stone-900 border border-stone-800 rounded-lg pl-8 pr-3 py-2 text-roast-text focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Aggregate KPI Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-roast-surface border border-roast-border rounded-xl p-4 shadow-lg">
          <div className="text-stone-400 text-xs flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-500" /> Filtered Batches
          </div>
          <div className="text-2xl font-bold font-mono text-roast-text mt-2">
            {stats.totalBatches}
          </div>
          <span className="text-[11px] text-stone-500">out of {logs.length} total roasts</span>
        </div>

        <div className="bg-roast-surface border border-roast-border rounded-xl p-4 shadow-lg">
          <div className="text-stone-400 text-xs flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-emerald-500" /> Total Roasted
          </div>
          <div className="text-2xl font-bold font-mono text-roast-text mt-2">
            {stats.totalRoastedKg} <span className="text-sm font-sans font-normal text-stone-400">kg</span>
          </div>
          <span className="text-[11px] text-stone-500">{stats.totalGreenKg} kg green coffee</span>
        </div>

        <div className="bg-roast-surface border border-roast-border rounded-xl p-4 shadow-lg">
          <div className="text-stone-400 text-xs flex items-center gap-1.5">
            <Percent className="w-4 h-4 text-sky-500" /> Avg Weight Loss
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-2">
            {stats.avgWeightLoss}%
          </div>
          <span className="text-[11px] text-stone-500">Moisture & organic mass loss</span>
        </div>

        <div className="bg-roast-surface border border-roast-border rounded-xl p-4 shadow-lg">
          <div className="text-stone-400 text-xs flex items-center gap-1.5">
            <Award className="w-4 h-4 text-pink-500" /> Avg Development (DTR)
          </div>
          <div className="text-2xl font-bold font-mono text-pink-400 mt-2">
            {stats.avgDTR}%
          </div>
          <span className="text-[11px] text-stone-500">Target: 12-16% for filter</span>
        </div>
      </div>

      {/* Two Column Layout: Classification Breakdown & Tasting Keyword Cloud */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Classification Distribution */}
        <div className="bg-roast-surface border border-roast-border rounded-xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-semibold text-roast-text flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" /> Classification Rating Breakdown
          </h3>

          <div className="space-y-2.5">
            {(['Not tasted', 'Excellent', 'Very good', 'Good', 'OK', 'Bad'] as RoastRating[]).map((rating) => {
              const count = stats.ratingCounts[rating] || 0;
              const percent = stats.totalBatches > 0 ? (count / stats.totalBatches) * 100 : 0;
              const color = RATING_COLORS[rating];

              return (
                <div key={rating} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-stone-300 font-sans">{rating}</span>
                    <span className="text-stone-400">
                      {count} ({percent.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-stone-900 overflow-hidden border border-stone-800">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tasting Notes & Sensory Descriptor Cloud */}
        <div className="bg-roast-surface border border-roast-border rounded-xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-semibold text-roast-text flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" /> Sensory Keywords & Descriptors
          </h3>
          <p className="text-xs text-roast-muted">
            Most frequent tasting notes across the filtered batches:
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            {stats.topKeywords.length > 0 ? (
              stats.topKeywords.map(([word, freq], idx) => {
                const isSelected = keywordQuery.toLowerCase() === word.toLowerCase();
                return (
                  <button
                    key={idx}
                    onClick={() => setKeywordQuery(isSelected ? '' : word)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition border ${
                      isSelected
                        ? 'bg-amber-600 text-stone-950 font-bold border-amber-500'
                        : 'bg-stone-900 text-stone-300 border-stone-800 hover:border-amber-600/70 hover:text-amber-300'
                    }`}
                  >
                    <span>{word}</span>
                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-stone-800 text-stone-400">
                      {freq}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="text-xs text-stone-500 italic">No tasting keywords recorded in filtered set.</p>
            )}
          </div>
        </div>
      </div>

      {/* Side-by-side Roast Curve Comparison Section */}
      <div className="bg-roast-surface border border-roast-border rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-roast-border">
          <div>
            <h3 className="text-base font-bold text-roast-text flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-500" /> Side-by-Side Curve Overlay Comparison
            </h3>
            <p className="text-xs text-roast-muted mt-0.5">
              Select 2 or more roasts from below to overlay their Artisan curves and diagnose profile drift
            </p>
          </div>

          {comparisonLogIds.length > 0 && (
            <button
              onClick={() => setComparisonLogIds([])}
              className="text-xs text-stone-400 hover:text-rose-400 transition"
            >
              Clear Comparison ({comparisonLogIds.length})
            </button>
          )}
        </div>

        {/* Comparison Curve Chart */}
        {primaryComparisonLog ? (
          <div>
            <RoastChart
              parsedLog={primaryComparisonLog}
              comparisonLogs={overlayComparisonLogs}
              temperatureUnit={settings.temperatureUnit}
              title={`Roast Curve Comparison (${comparisonLogIds.length} profiles overlaid)`}
            />
          </div>
        ) : (
          <div className="bg-stone-900/50 border border-stone-800 rounded-lg p-6 text-center text-xs text-stone-400">
            Check the box next to any roasts below to overlay their curves on the comparison chart above.
          </div>
        )}

        {/* Filtered Roasts Selection Table */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-roast-border text-stone-400 font-mono">
                <th className="py-2.5 px-3">Compare</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Green Bean</th>
                <th className="py-2.5 px-3">Roaster</th>
                <th className="py-2.5 px-3">Rating</th>
                <th className="py-2.5 px-3">Weight Loss</th>
                <th className="py-2.5 px-3">DTR%</th>
                <th className="py-2.5 px-3">Tasting Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/80">
              {filteredLogs.map((log) => {
                const isChecked = comparisonLogIds.includes(log.id);
                const hasCurve = !!log.artisanLogParsed;

                return (
                  <tr
                    key={log.id}
                    className={`hover:bg-stone-900/60 transition ${
                      isChecked ? 'bg-amber-950/20' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={!hasCurve}
                        onChange={() => toggleComparisonLog(log.id)}
                        className="rounded border-stone-700 bg-stone-900 text-amber-500 focus:ring-0 cursor-pointer disabled:opacity-30"
                      />
                    </td>
                    <td className="py-2.5 px-3 font-mono text-stone-300">
                      {log.date
                        ? new Date(log.date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'No Date'}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-stone-200">
                      {getBeanName(log.beanId)}
                    </td>
                    <td className="py-2.5 px-3 text-stone-400">
                      {getRoasterName(log.roasterId)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          backgroundColor: `${RATING_COLORS[log.rating] || RATING_COLORS['Not tasted']}20`,
                          color: RATING_COLORS[log.rating] || RATING_COLORS['Not tasted'],
                        }}
                      >
                        {log.rating}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-amber-400">
                      {log.weightLossPercent ? `${log.weightLossPercent}%` : '-'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-stone-300">
                      {log.artisanLogParsed?.metrics?.developmentPercent
                        ? `${log.artisanLogParsed.metrics.developmentPercent}%`
                        : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-stone-400 max-w-xs truncate italic">
                      {log.tastingNotes || 'No notes'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
