import React from 'react';
import { Flame, BookOpen, LineChart, Settings as SettingsIcon, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { GoogleDriveConfig } from '../types';

export type ActiveTab = 'logs' | 'analysis' | 'research' | 'settings';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  driveConfig: GoogleDriveConfig;
  onQuickSync?: () => void;
  isSyncing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  driveConfig,
  onQuickSync,
  isSyncing = false,
}) => {
  const navItems = [
    { id: 'logs' as ActiveTab, label: 'Roast Logs', icon: Flame },
    { id: 'analysis' as ActiveTab, label: 'Analysis', icon: LineChart },
    { id: 'research' as ActiveTab, label: 'Research', icon: BookOpen },
    { id: 'settings' as ActiveTab, label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full bg-[#0c0a09]/90 backdrop-blur-md border-b border-roast-border px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Branding */}
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onTabChange('logs')}>
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-950/40">
              <Flame className="w-5 h-5 text-stone-950 fill-stone-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-roast-text font-sans">
                  RoastCraft
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60 uppercase">
                  PWA
                </span>
              </div>
              <p className="text-[11px] text-roast-muted leading-none hidden sm:block">
                Specialty Coffee Roasting Log
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-roast-card p-1 rounded-xl border border-roast-border">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? 'bg-amber-600 text-stone-950 font-semibold shadow-md'
                      : 'text-roast-muted hover:text-roast-text hover:bg-stone-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Google Drive Status & Quick Sync */}
          <div className="flex items-center gap-2">
            {driveConfig.isConnected ? (
              <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-lg text-xs text-emerald-300">
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline font-mono text-[11px]">Drive Connected</span>
                {onQuickSync && (
                  <button
                    onClick={onQuickSync}
                    disabled={isSyncing}
                    title="Sync with Google Drive now"
                    className="p-1 hover:bg-emerald-800/50 rounded transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => onTabChange('settings')}
                className="flex items-center gap-1.5 bg-stone-900 border border-stone-800 px-2.5 py-1 rounded-lg text-xs text-stone-400 hover:text-stone-200 transition"
                title="Google Drive not connected. Click to open Settings."
              >
                <CloudOff className="w-3.5 h-3.5 text-stone-500" />
                <span className="hidden sm:inline text-[11px]">Drive Offline</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c0a09]/95 backdrop-blur-md border-t border-roast-border px-2 py-2 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-medium transition ${
                isActive
                  ? 'text-amber-500'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </>
  );
};

