import React, { useMemo, useState } from 'react';
import { AppSettings } from '../types';
import {
  BookOpen,
  Coffee,
  Mountain,
  Flame,
  Thermometer,
  Clock,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  CheckCircle,
  Plus
} from 'lucide-react';
import { generateBeanResearchReport } from '../services/coffeeKnowledgeBase';

interface ResearchPageProps {
  settings: AppSettings;
  selectedBeanIdFromNav?: string | null;
  onNavigateToNewRoastWithBean?: (beanId: string) => void;
}

export const ResearchPage: React.FC<ResearchPageProps> = ({
  settings,
  selectedBeanIdFromNav,
  onNavigateToNewRoastWithBean,
}) => {
  const [selectedBeanId, setSelectedBeanId] = useState<string>(
    selectedBeanIdFromNav || settings.greenBeans[0]?.id || ''
  );

  // Live AI Research state
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiCustomNotes, setAiCustomNotes] = useState<string | null>(null);

  const selectedBean = useMemo(() => {
    return settings.greenBeans.find(b => b.id === selectedBeanId) || settings.greenBeans[0];
  }, [settings.greenBeans, selectedBeanId]);

  const report = useMemo(() => {
    if (!selectedBean) return null;
    return generateBeanResearchReport(selectedBean);
  }, [selectedBean]);

  // Optional Gemini live research
  const handleLiveAiResearch = async () => {
    if (!selectedBean) return;
    if (!settings.geminiApiKey) {
      alert('Please configure a Google Gemini API Key in Settings to enable live AI research.');
      return;
    }

    setIsAiSearching(true);
    setAiCustomNotes(null);

    try {
      const prompt = `Provide a concise specialty coffee roaster research summary for the green coffee:
Bean: ${selectedBean.name}
Origin: ${selectedBean.origin}, Region: ${selectedBean.region || 'N/A'}, Farm: ${selectedBean.farmOrStation || 'N/A'}
Variety: ${selectedBean.variety || 'N/A'}, Process: ${selectedBean.process}, Altitude: ${selectedBean.altitude || 'N/A'} MASL.

Include:
1. Terroir and microclimate impact
2. Density and moisture roasting considerations
3. Recommended charge temperature, RoR slope, and development time ratio (DTR%)
4. Cup profile and recommended brew methods.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${settings.geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      if (!res.ok) {
        throw new Error(`API error: ${res.statusText}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      setAiCustomNotes(text || 'No response generated.');
    } catch (err: any) {
      alert(`AI research error: ${err.message}`);
    } finally {
      setIsAiSearching(false);
    }
  };

  const isFahrenheit = settings.temperatureUnit === 'F';

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-24 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-roast-text flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-amber-500" /> Green Bean Research & Roast Advisor
        </h1>
        <p className="text-sm text-roast-muted mt-0.5">
          Select any green coffee from your inventory to explore altitude, density characteristics, flavor profiles, and suggested roasting strategies
        </p>
      </div>

      {/* Bean Selector Dropdown & Quick Selector Pills */}
      <div className="bg-roast-surface border border-roast-border rounded-xl p-4 shadow-xl space-y-3">
        <label className="block text-xs font-semibold text-stone-300">
          Select Green Bean from Settings Inventory:
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedBean?.id || ''}
            onChange={(e) => {
              setSelectedBeanId(e.target.value);
              setAiCustomNotes(null);
            }}
            className="flex-1 min-w-[260px] bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-xs text-roast-text font-medium focus:border-amber-500 focus:outline-none"
          >
            {settings.greenBeans.map(b => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.origin} • {b.process} • {b.altitude ? `${b.altitude}m` : 'Unspecified'})
              </option>
            ))}
          </select>

          {onNavigateToNewRoastWithBean && selectedBean && (
            <button
              onClick={() => onNavigateToNewRoastWithBean(selectedBean.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs transition shadow-md"
            >
              <Plus className="w-4 h-4" /> Start Roast with this Bean
            </button>
          )}
        </div>

        {/* Quick Selection Pills */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {settings.greenBeans.map(b => (
            <button
              key={b.id}
              onClick={() => {
                setSelectedBeanId(b.id);
                setAiCustomNotes(null);
              }}
              className={`text-xs px-2.5 py-1 rounded-lg transition ${
                selectedBean?.id === b.id
                  ? 'bg-amber-600 text-stone-950 font-bold'
                  : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      {report && selectedBean ? (
        <div className="space-y-6">
          {/* Top Bean Overview Card */}
          <div className="bg-roast-surface border border-roast-border rounded-xl p-6 shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60 font-mono">
                    {selectedBean.process} Process
                  </span>
                  <span className="text-xs font-mono text-stone-400">
                    🌍 {selectedBean.origin} {selectedBean.region ? `• ${selectedBean.region}` : ''}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-roast-text mt-2">
                  {selectedBean.name}
                </h2>
                {selectedBean.farmOrStation && (
                  <p className="text-xs text-stone-400 mt-0.5">
                    Estate / Washing Station: <span className="text-stone-200">{selectedBean.farmOrStation}</span>
                  </p>
                )}
              </div>

              {/* Live Gemini Deep Dive trigger */}
              <div>
                <button
                  onClick={handleLiveAiResearch}
                  disabled={isAiSearching}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-800 hover:border-amber-600/70 text-xs text-stone-300 hover:text-amber-400 transition disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  {isAiSearching ? 'Researching Live...' : 'AI Producer Deep Dive'}
                </button>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-roast-border text-xs">
              <div className="bg-stone-900/80 p-3 rounded-lg border border-stone-800">
                <span className="text-stone-500 flex items-center gap-1 text-[11px]">
                  <Mountain className="w-3.5 h-3.5 text-amber-500" /> Altitude
                </span>
                <span className="font-mono font-semibold text-stone-200 mt-1 block">
                  {selectedBean.altitude ? `${selectedBean.altitude} MASL` : 'Unspecified'}
                </span>
              </div>

              <div className="bg-stone-900/80 p-3 rounded-lg border border-stone-800">
                <span className="text-stone-500 flex items-center gap-1 text-[11px]">
                  <Coffee className="w-3.5 h-3.5 text-emerald-500" /> Varietal
                </span>
                <span className="font-mono font-semibold text-stone-200 mt-1 block">
                  {selectedBean.variety || 'Heirloom / Field Blend'}
                </span>
              </div>

              <div className="bg-stone-900/80 p-3 rounded-lg border border-stone-800">
                <span className="text-stone-500 flex items-center gap-1 text-[11px]">
                  <Flame className="w-3.5 h-3.5 text-pink-500" /> Density Est.
                </span>
                <span className="font-mono font-semibold text-stone-200 mt-1 block">
                  {selectedBean.densityGramsPerLiter ? `${selectedBean.densityGramsPerLiter} g/L` : 'High (SHG)'}
                </span>
              </div>

              <div className="bg-stone-900/80 p-3 rounded-lg border border-stone-800">
                <span className="text-stone-500 flex items-center gap-1 text-[11px]">
                  <CheckCircle className="w-3.5 h-3.5 text-sky-500" /> Moisture
                </span>
                <span className="font-mono font-semibold text-stone-200 mt-1 block">
                  {selectedBean.moisturePercent ? `${selectedBean.moisturePercent}%` : '10.5 - 11.5%'}
                </span>
              </div>
            </div>
          </div>

          {/* Altitude & Density Analysis Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-roast-surface border border-roast-border rounded-xl p-5 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-roast-text flex items-center gap-2">
                <Mountain className="w-4 h-4 text-amber-500" /> Altitude & Density Impact
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-stone-400 block font-semibold">Classification:</span>
                  <span className="text-amber-400 font-mono font-semibold text-sm">
                    {report.altitudeAnalysis.classification}
                  </span>
                </div>

                <div className="bg-stone-900/80 p-3 rounded-lg border border-stone-800 space-y-2">
                  <div>
                    <span className="text-stone-400 font-semibold block">Cellular Density:</span>
                    <p className="text-stone-300 mt-0.5 leading-relaxed">
                      {report.altitudeAnalysis.densityImpact}
                    </p>
                  </div>
                  <div>
                    <span className="text-stone-400 font-semibold block">Acidity Potential:</span>
                    <p className="text-stone-300 mt-0.5 leading-relaxed">
                      {report.altitudeAnalysis.acidityPotential}
                    </p>
                  </div>
                  <div>
                    <span className="text-stone-400 font-semibold block">Thermal Tolerance:</span>
                    <p className="text-stone-300 mt-0.5 leading-relaxed">
                      {report.altitudeAnalysis.thermalTolerance}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Flavor Profile & Process Nuances */}
            <div className="bg-roast-surface border border-roast-border rounded-xl p-5 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-roast-text flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" /> Sensory Profile & Processing Nuances
              </h3>

              {/* Flavor Tags */}
              <div>
                <span className="text-stone-400 text-xs font-semibold block mb-2">
                  Expected Cupping Notes:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {report.flavorDescriptors.map((f, i) => (
                    <span
                      key={i}
                      className="text-xs px-2.5 py-1 rounded-full bg-amber-950/70 text-amber-300 border border-amber-800/60 font-medium"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Processing Method Behavior */}
              <div className="bg-stone-900/80 p-3 rounded-lg border border-stone-800 text-xs">
                <span className="text-stone-400 font-semibold block">
                  Processing Method Nuance ({selectedBean.process}):
                </span>
                <p className="text-stone-300 mt-1 leading-relaxed">
                  {report.processingNuances}
                </p>
              </div>

              {/* Regional Heritage */}
              {report.originInfo && (
                <p className="text-xs text-stone-400 italic">
                  <strong>Regional Character:</strong> {report.originInfo.roastingCharacteristics}
                </p>
              )}
            </div>
          </div>

          {/* Actionable Suggested Roast Profile Roadmap */}
          <div className="bg-roast-surface border border-roast-border rounded-xl p-6 shadow-xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-roast-border">
              <div>
                <h3 className="text-base font-bold text-roast-text flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-500" /> Suggested Roast Profile Roadmap
                </h3>
                <p className="text-xs text-roast-muted mt-0.5">
                  Calculated targets tailored for this bean's altitude, density, and processing method
                </p>
              </div>

              {onNavigateToNewRoastWithBean && (
                <button
                  onClick={() => onNavigateToNewRoastWithBean(selectedBean.id)}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs transition"
                >
                  Apply to New Roast Log
                </button>
              )}
            </div>

            {/* Target Temperature & Timing Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-stone-900/90 p-3 rounded-lg border border-stone-800">
                <span className="text-stone-500 flex items-center gap-1 text-[11px]">
                  <Thermometer className="w-3.5 h-3.5 text-amber-500" /> Suggested Charge
                </span>
                <span className="font-mono font-bold text-amber-400 text-base mt-1 block">
                  {isFahrenheit
                    ? `${report.suggestedProfile.chargeTempF}°F`
                    : `${report.suggestedProfile.chargeTempC}°C`}
                </span>
                <span className="text-[10px] text-stone-500">Based on bean density</span>
              </div>

              <div className="bg-stone-900/90 p-3 rounded-lg border border-stone-800">
                <span className="text-stone-500 flex items-center gap-1 text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-yellow-500" /> Turning Point Target
                </span>
                <span className="font-mono font-bold text-yellow-400 text-base mt-1 block">
                  {report.suggestedProfile.turningPointTargetSec}
                </span>
                <span className="text-[10px] text-stone-500">Thermal equilibrium</span>
              </div>

              <div className="bg-stone-900/90 p-3 rounded-lg border border-stone-800">
                <span className="text-stone-500 flex items-center gap-1 text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-pink-500" /> Target DTR%
                </span>
                <span className="font-mono font-bold text-pink-400 text-base mt-1 block">
                  {report.suggestedProfile.developmentPhaseRatioTarget}
                </span>
                <span className="text-[10px] text-stone-500">Development Time Ratio</span>
              </div>

              <div className="bg-stone-900/90 p-3 rounded-lg border border-stone-800">
                <span className="text-stone-500 flex items-center gap-1 text-[11px]">
                  <Flame className="w-3.5 h-3.5 text-rose-500" /> Suggested Drop Temp
                </span>
                <span className="font-mono font-bold text-rose-400 text-base mt-1 block">
                  {isFahrenheit
                    ? `${report.suggestedProfile.targetDropTempF}°F`
                    : `${report.suggestedProfile.targetDropTempC}°C`}
                </span>
                <span className="text-[10px] text-stone-500">Light / City filter</span>
              </div>
            </div>

            {/* Strategy & Airflow Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-stone-900/70 p-4 rounded-xl border border-stone-800 space-y-1.5">
                <span className="font-semibold text-stone-200 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-amber-500" /> Heat Application Strategy:
                </span>
                <p className="text-stone-400 leading-relaxed">
                  {report.suggestedProfile.heatApplicationStrategy}
                </p>
              </div>

              <div className="bg-stone-900/70 p-4 rounded-xl border border-stone-800 space-y-1.5">
                <span className="font-semibold text-stone-200 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-sky-500" /> Airflow Management Strategy:
                </span>
                <p className="text-stone-400 leading-relaxed">
                  {report.suggestedProfile.airFlowStrategy}
                </p>
              </div>
            </div>

            {/* Watch-outs */}
            <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-4 text-xs space-y-2">
              <span className="font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Critical Roasting Watch-outs
              </span>
              <ul className="list-disc list-inside space-y-1 text-stone-300">
                {report.suggestedProfile.watchOuts.map((w, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Live AI Research Output (if requested) */}
          {aiCustomNotes && (
            <div className="bg-roast-surface border border-roast-border rounded-xl p-6 shadow-xl space-y-3">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" /> Live AI Research Findings
              </h3>
              <div className="text-xs text-stone-300 leading-relaxed whitespace-pre-wrap font-sans bg-stone-900/80 p-4 rounded-lg border border-stone-800">
                {aiCustomNotes}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-roast-surface border border-roast-border rounded-xl p-12 text-center text-roast-muted shadow-lg">
          <Coffee className="w-10 h-10 text-stone-600 mx-auto mb-3" />
          <p className="text-base font-semibold text-stone-300">No Green Beans in Inventory</p>
          <p className="text-xs text-stone-500 mt-1">
            Navigate to Settings to add green coffee beans to your inventory.
          </p>
        </div>
      )}
    </div>
  );
};
