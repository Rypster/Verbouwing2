import React, { useRef, useState, useEffect } from 'react';
import { PlannerState, ActiveTab } from '../types';
import {
  Ruler,
  Download,
  Upload,
  LayoutGrid,
  ClipboardList,
  Trash2,
  FolderOpen,
  Plus,
  X,
  AlertCircle,
  RotateCw,
  Check,
} from 'lucide-react';
import { listProjects, createNewProject, deleteProject, openProject, ProjectSummary } from '../utils/storage';

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
  const newProjectInputRef = useRef<HTMLInputElement>(null);

  const [showProjects, setShowProjects] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Per-action state instead of one global `loading` flag, so clicking
  // "open" on one project and "delete" on another can't race each other.
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null); // project id, or 'new'
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inline "new project" form instead of window.prompt()
  const [creatingNew, setCreatingNew] = useState(false);
  const [newProjectName, setNewProjectName] = useState('Nieuw Project');

  // Inline delete confirmation instead of window.confirm() — first click
  // arms it, second click (or Enter) actually deletes.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadProjects = async () => {
    setLoading(true);
    setLoadError(false);
    const result = await listProjects();
    if (result.ok) {
      setProjects(result.projects);
    } else {
      setLoadError(true);
      setProjects([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (showProjects) {
      loadProjects();
    } else {
      // reset transient UI when the modal closes
      setCreatingNew(false);
      setConfirmDeleteId(null);
      setErrorMsg(null);
    }
  }, [showProjects]);

  useEffect(() => {
    if (creatingNew) {
      newProjectInputRef.current?.focus();
      newProjectInputRef.current?.select();
    }
  }, [creatingNew]);

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

  const openCreateForm = () => {
    setErrorMsg(null);
    setConfirmDeleteId(null);
    setNewProjectName('Nieuw Project');
    setCreatingNew(true);
  };

  const confirmCreateProject = async () => {
    const name = newProjectName.trim() || 'Nieuw Project';
    setActionLoadingId('new');
    setErrorMsg(null);
    const newState = await createNewProject(name);
    setActionLoadingId(null);

    if (newState) {
      setState(newState);
      setShowProjects(false);
    } else {
      setErrorMsg('Kon nieuw project niet aanmaken. Probeer het opnieuw.');
    }
  };

  const handleOpenProject = async (id: string) => {
    if (id === state.projectId) {
      setShowProjects(false);
      return;
    }

    setActionLoadingId(id);
    setErrorMsg(null);
    const opened = await openProject(id);
    setActionLoadingId(null);

    if (opened) {
      setState(opened);
      setShowProjects(false);
    } else {
      setErrorMsg('Kon project niet openen. Probeer het opnieuw.');
    }
  };

  const requestDeleteProject = (id: string) => {
    setErrorMsg(null);
    setConfirmDeleteId(id);
  };

  const cancelDeleteProject = () => setConfirmDeleteId(null);

  const confirmDeleteProject = async (id: string) => {
    setActionLoadingId(id);
    setErrorMsg(null);
    const ok = await deleteProject(id);
    setConfirmDeleteId(null);

    if (ok) {
      // Als we het huidige project verwijderen → nieuw leeg project starten
      if (id === state.projectId) {
        const newState = await createNewProject('Nieuw Project');
        if (newState) setState(newState);
      }
      await loadProjects();
    } else {
      setErrorMsg('Verwijderen mislukt. Probeer het opnieuw.');
    }
    setActionLoadingId(null);
  };

  return (
    <>
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
                Neon DB
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
          <button
            onClick={() => setShowProjects(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 transition border border-amber-500/30"
            title="Projecten beheren"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Projecten</span>
          </button>

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

      {/* Projecten Modal */}
      {showProjects && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-slate-100">Projecten</h2>
              <button
                onClick={() => setShowProjects(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              {errorMsg && (
                <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="flex-1">{errorMsg}</span>
                  <button
                    onClick={() => setErrorMsg(null)}
                    className="text-rose-400 hover:text-rose-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {creatingNew ? (
                <div className="flex items-center gap-2 mb-4">
                  <input
                    ref={newProjectInputRef}
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmCreateProject();
                      if (e.key === 'Escape') setCreatingNew(false);
                    }}
                    placeholder="Naam voor het nieuwe project"
                    className="flex-1 bg-slate-800 border border-slate-700 focus:border-amber-500/50 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none"
                  />
                  <button
                    onClick={confirmCreateProject}
                    disabled={actionLoadingId === 'new'}
                    className="p-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition disabled:opacity-50"
                    title="Aanmaken"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCreatingNew(false)}
                    disabled={actionLoadingId === 'new'}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
                    title="Annuleren"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={openCreateForm}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mb-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold transition"
                >
                  <Plus className="w-4 h-4" />
                  Nieuw project
                </button>
              )}

              {loading ? (
                <div className="text-center py-8 text-slate-400 text-sm">Laden...</div>
              ) : loadError ? (
                <div className="flex flex-col items-center gap-3 py-8 text-slate-400 text-sm">
                  <span>Kon projecten niet laden.</span>
                  <button
                    onClick={loadProjects}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition border border-slate-700"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Opnieuw proberen
                  </button>
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Nog geen projecten. Maak er een aan!
                </div>
              ) : (
                <ul className="space-y-2 max-h-72 overflow-y-auto">
                  {projects.map((p) => {
                    const isBusy = actionLoadingId === p.id;
                    const isConfirmingDelete = confirmDeleteId === p.id;
                    return (
                      <li
                        key={p.id}
                        className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition ${
                          isConfirmingDelete
                            ? 'bg-rose-950/30 border-rose-800/50'
                            : p.id === state.projectId
                            ? 'bg-amber-500/10 border-amber-500/40'
                            : 'bg-slate-800/50 border-slate-700/60 hover:border-slate-600'
                        }`}
                      >
                        {isConfirmingDelete ? (
                          <>
                            <span className="flex-1 text-sm text-rose-200 truncate">
                              "{p.name}" verwijderen?
                            </span>
                            <button
                              onClick={() => confirmDeleteProject(p.id)}
                              disabled={isBusy}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition disabled:opacity-50"
                            >
                              {isBusy ? '...' : 'Verwijder'}
                            </button>
                            <button
                              onClick={cancelDeleteProject}
                              disabled={isBusy}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
                              title="Annuleren"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleOpenProject(p.id)}
                              disabled={isBusy}
                              className="flex-1 text-left min-w-0 disabled:opacity-50"
                            >
                              <div className="font-medium text-slate-100 truncate">
                                {isBusy ? 'Bezig...' : p.name}
                              </div>
                              <div className="text-xs text-slate-500">
                                {new Date(p.updated_at).toLocaleString('nl-NL')}
                                {p.id === state.projectId && (
                                  <span className="ml-2 text-amber-400">• huidig</span>
                                )}
                              </div>
                            </button>
                            <button
                              onClick={() => requestDeleteProject(p.id)}
                              disabled={isBusy}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition disabled:opacity-50"
                              title="Verwijderen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};