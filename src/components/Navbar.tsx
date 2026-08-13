import React, { useRef } from 'react';
import { PlannerState, ActiveTab } from '../types';
import {
  Ruler,
  Download,
  Upload,
  LayoutGrid,
  ClipboardList,
  Database,
  FileSpreadsheet,
  Trash2,
  HelpCircle,
} from 'lucide-react';

interface NavbarProps {
  state: PlannerState;
  setState: React.Dispatch<React.SetStateAction<PlannerState>>;
  onExport: () => void;
  onImport: (file: File) => void;
  onResetToDemo: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  state,
  setState,
  onExport,
  onImport,
  onResetToDemo,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({ ...prev, projectName: e.target.value }));
  };

  const handleTabChange = (tab: ActiveTab) => {
    setState((prev) => ({ ...prev, activeTab: tab }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImport(e.target.files[0]);
    }
  };

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 text-slate-100 px-4 flex items-center justify-between z-30 select-none shadow-md">
      {/* Brand & Project Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold">
          <Ruler className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={state.projectName}
              onChange={handleNameChange}
              className="bg-transparent text-base font-semibold text-slate-100 hover:bg-slate-800/60 focus:bg-slate-800 px-2 py-0.5 rounded border border-transparent focus:border-amber-500/50 outline-none transition"
              title="Klik om projectnaam te wijzigen"
            />
          </div>
          <div className="text-xs text-slate-400 px-2 flex items-center gap-2">
            <span>Verbouw Planner</span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Lokale Opslag + Neon DB Ready
            </span>
          </div>
        </div>
      </div>

      {/* Main Mode Tabs */}
      <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => handleTabChange('general')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            state.activeTab === 'general'
              ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Algemeen & Klussen</span>
          {state.jobs.length > 0 && (
            <span className="ml-1 bg-slate-800 text-amber-400 text-xs px-2 py-0.5 rounded-full font-bold border border-amber-500/20">
              {state.jobs.length}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('build')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            state.activeTab === 'build'
              ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>Ontwerp (Build)</span>
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 hover:text-white transition border border-slate-700/60"
          title="Importeer een opgeslagen JSON project"
        >
          <Upload className="w-3.5 h-3.5 text-slate-400" />
          <span>Import</span>
        </button>

        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 hover:text-white transition border border-slate-700/60"
          title="Exporteer project naar JSON bestand"
        >
          <Download className="w-3.5 h-3.5 text-amber-400" />
          <span>Export JSON</span>
        </button>

        <button
          onClick={onResetToDemo}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 transition border border-slate-800 hover:border-rose-800/50"
          title="Herstel demoproject"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>
    </header>
  );
};
