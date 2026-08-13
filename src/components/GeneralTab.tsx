import React, { useState } from 'react';
import { PlannerState, RenovationJob, Wall, Zone, Opening } from '../types';
import { getWallMetrics, calculatePolygonArea, calculateZoneNetArea } from '../utils/geometry';
import { JobModal } from './JobModal';
import { PlannerCanvas } from './PlannerCanvas';
import { ISDE_MEASURES, getISDEConfig, calculateJobISDESubsidy } from '../utils/isde';
import {
  ClipboardList,
  Plus,
  Euro,
  Search,
  Trash2,
  Edit2,
  Ruler,
  Layers,
  DoorOpen,
  AppWindow,
  X,
  FileSpreadsheet,
  MousePointer,
  Check,
  Link as LinkIcon,
  Unlink,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Info,
  Building2,
  Hammer,
  Leaf,
  ShieldCheck,
  ExternalLink,
  AlertTriangle,
  TrendingDown,
} from 'lucide-react';

interface GeneralTabProps {
  state: PlannerState;
  setState: React.Dispatch<React.SetStateAction<PlannerState>>;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({ state, setState }) => {
  const [activeRightTab, setActiveRightTab] = useState<'inspector' | 'jobs' | 'isde' | 'items'>('inspector');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<RenovationJob | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [linkJobSelectId, setLinkJobSelectId] = useState<string>('');

  // Calculate individual job cost and quantity
  const calculateJobCost = (job: RenovationJob): { totalCost: number; quantity: number; unitLabel: string } => {
    if (job.costModel === 'fixed') {
      return { totalCost: job.fixedPrice, quantity: 1, unitLabel: 'vast' };
    }

    let quantity = 0;
    let unitLabel = '';

    if (job.costModel === 'per_m2') {
      unitLabel = 'm²';
      for (const itemId of job.assignedItemIds) {
        const wall = state.walls.find((w) => w.id === itemId);
        if (wall) {
          const metrics = getWallMetrics(wall, state.openings, state.scalePxPerMeter);
          quantity += metrics.netAreaM2;
        }
        const zone = state.zones.find((z) => z.id === itemId);
        if (zone) {
          quantity += calculateZoneNetArea(zone.points, state.walls, state.wallTypeThicknesses, state.scalePxPerMeter);
        }
      }
    } else if (job.costModel === 'per_m1') {
      unitLabel = 'm1';
      for (const itemId of job.assignedItemIds) {
        const wall = state.walls.find((w) => w.id === itemId);
        if (wall) {
          const metrics = getWallMetrics(wall, state.openings, state.scalePxPerMeter);
          quantity += metrics.lengthMeters;
        }
      }
    } else if (job.costModel === 'per_piece') {
      unitLabel = 'st.';
      quantity = job.assignedItemIds.length;
    }

    const totalCost = quantity * job.unitPrice;
    return { totalCost, quantity, unitLabel };
  };

  // Calculations for all jobs & ISDE subsidies
  const jobCalculations = state.jobs.map((job) => {
    const costInfo = calculateJobCost(job);
    const isdeConfig = getISDEConfig(job.category);
    return {
      job,
      ...costInfo,
      isdeConfig,
    };
  });

  // Determine active ISDE measures count for the 2+ measures doubling rule
  const validISDEMeasureCategories = new Set(
    jobCalculations
      .filter((item) => {
        if (!item.isdeConfig) return false;
        if (item.job.costModel === 'fixed') return true;
        return item.quantity >= item.isdeConfig.minQuantity;
      })
      .map((item) => item.job.category)
  );

  const totalActiveISDECount = validISDEMeasureCategories.size;
  const isDoubleRateActive = totalActiveISDECount >= 2;

  // Calculate total ISDE subsidy amount across all jobs
  let totalISDESubsidy = 0;
  const jobsWithISDE = jobCalculations.map((item) => {
    if (!item.isdeConfig) return { ...item, isdeSub: null };
    const isdeSub = calculateJobISDESubsidy(item.job.category, item.quantity, totalActiveISDECount);
    totalISDESubsidy += isdeSub.subsidyAmount;
    return { ...item, isdeSub };
  });

  // Grand total renovation costs (Bruto & Netto)
  const grandTotalCost = state.jobs.reduce((sum, job) => sum + calculateJobCost(job).totalCost, 0);
  const grandTotalNettoCost = Math.max(0, grandTotalCost - totalISDESubsidy);

  // Completed jobs count
  const completedJobsCount = state.jobs.filter((j) => j.status === 'done').length;

  // Selected Items Analysis
  const selectedWalls = state.walls.filter((w) => state.selectedItemIds.includes(w.id));
  const selectedZones = state.zones.filter((z) => state.selectedItemIds.includes(z.id));
  const selectedOpenings = state.openings.filter((o) => state.selectedItemIds.includes(o.id));

  // Cumulative metrics for selected items
  const selectedTotalNetAreaM2 =
    selectedWalls.reduce(
      (sum, w) => sum + getWallMetrics(w, state.openings, state.scalePxPerMeter).netAreaM2,
      0
    ) +
    selectedZones.reduce((sum, z) => sum + calculateZoneNetArea(z.points, state.walls, state.wallTypeThicknesses, state.scalePxPerMeter), 0) +
    selectedOpenings.reduce((sum, o) => sum + o.widthMeters * o.heightMeters, 0);

  const selectedTotalWallLengthM1 = selectedWalls.reduce(
    (sum, w) => sum + getWallMetrics(w, state.openings, state.scalePxPerMeter).lengthMeters,
    0
  );

  // Jobs assigned to any currently selected item
  const selectedItemJobs = state.jobs.filter((job) =>
    job.assignedItemIds.some((id) => state.selectedItemIds.includes(id))
  );

  // Handler: Save job from modal
  const handleSaveJob = (jobData: Omit<RenovationJob, 'id' | 'assignedItemIds'>) => {
    if (editingJob) {
      setState((prev) => ({
        ...prev,
        jobs: prev.jobs.map((j) => (j.id === editingJob.id ? { ...j, ...jobData } : j)),
      }));
    } else {
      const newJobCounter = state.jobCounter + 1;
      const newJob: RenovationJob = {
        ...jobData,
        id: `job_${newJobCounter}`,
        assignedItemIds: [...state.selectedItemIds], // Auto-assign selected items!
      };
      setState((prev) => ({
        ...prev,
        jobCounter: newJobCounter,
        jobs: [...prev.jobs, newJob],
      }));
    }
    setEditingJob(null);
  };

  // Handler: Delete job
  const handleDeleteJob = (jobId: string) => {
    setState((prev) => ({
      ...prev,
      jobs: prev.jobs.filter((j) => j.id !== jobId),
    }));
  };

  // Handler: Assign current selection to a job
  const handleAssignSelectionToJob = (jobId: string) => {
    if (!jobId || state.selectedItemIds.length === 0) return;
    setState((prev) => ({
      ...prev,
      jobs: prev.jobs.map((j) => {
        if (j.id === jobId) {
          const combined = Array.from(new Set([...j.assignedItemIds, ...state.selectedItemIds]));
          return { ...j, assignedItemIds: combined };
        }
        return j;
      }),
    }));
  };

  // Handler: Unassign single item from a job
  const handleUnassignItemFromJob = (jobId: string, itemId: string) => {
    setState((prev) => ({
      ...prev,
      jobs: prev.jobs.map((j) => {
        if (j.id === jobId) {
          return { ...j, assignedItemIds: j.assignedItemIds.filter((id) => id !== itemId) };
        }
        return j;
      }),
    }));
  };

  // Item list selection handler (supports Ctrl/Cmd click)
  const handleListItemClick = (e: React.MouseEvent, itemId: string) => {
    if (e.ctrlKey || e.metaKey) {
      setState((prev) => {
        const exists = prev.selectedItemIds.includes(itemId);
        return {
          ...prev,
          selectedItemIds: exists
            ? prev.selectedItemIds.filter((id) => id !== itemId)
            : [...prev.selectedItemIds, itemId],
        };
      });
    } else {
      setState((prev) => ({ ...prev, selectedItemIds: [itemId] }));
    }
    // Switch to inspector tab to view properties
    setActiveRightTab('inspector');
  };

  const filteredJobs = state.jobs.filter((j) => {
    if (statusFilter !== 'all' && j.status !== statusFilter) return false;
    if (
      searchQuery &&
      !j.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !j.category.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="w-full h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      <JobModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingJob(null);
        }}
        onSave={handleSaveJob}
        initialJob={editingJob}
        initialItemCount={state.selectedItemIds.length}
      />

      {/* TOP HEADER: SUMMARY METRICS BANNER */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 shrink-0 flex flex-wrap items-center justify-between gap-4 shadow-xl z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-100">{state.projectName}</h1>
              <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] px-2 py-0.5 rounded-md font-semibold">
                Algemeen & Klussen
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Inzage in kosten, m² maatvoeringen en automatische RVO ISDE subsidievergoedingen.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Metric 1: Bruto Costs */}
          <div className="bg-slate-950 border border-slate-800 px-3.5 py-1.5 rounded-xl flex items-center gap-2.5">
            <Euro className="w-4 h-4 text-amber-400" />
            <div>
              <div className="text-[10px] text-slate-400 font-medium">Bruto Kosten</div>
              <div className="text-sm font-bold text-amber-400">
                € {grandTotalCost.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Metric 2: ISDE Subsidy Payout */}
          <div
            onClick={() => setActiveRightTab('isde')}
            className="bg-emerald-950/60 border border-emerald-500/30 px-3.5 py-1.5 rounded-xl flex items-center gap-2.5 cursor-pointer hover:border-emerald-500/60 transition group"
            title="Klik om de ISDE Subsidiewijzer te bekijken"
          >
            <Leaf className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
            <div>
              <div className="text-[10px] text-emerald-300 font-medium flex items-center gap-1">
                <span>ISDE Subsidie</span>
                {isDoubleRateActive && (
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-extrabold px-1 rounded">
                    2x Tarief
                  </span>
                )}
              </div>
              <div className="text-sm font-black text-emerald-400">
                - € {totalISDESubsidy.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Metric 3: Netto Cost */}
          <div className="bg-slate-950 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl flex items-center gap-2.5">
            <TrendingDown className="w-4 h-4 text-teal-400" />
            <div>
              <div className="text-[10px] text-slate-400 font-medium">Netto Investering</div>
              <div className="text-sm font-black text-teal-300">
                € {grandTotalNettoCost.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Metric 4: Jobs Progress */}
          <div className="bg-slate-950 border border-slate-800 px-3.5 py-1.5 rounded-xl flex items-center gap-2.5 hidden xl:flex">
            <Hammer className="w-4 h-4 text-sky-400" />
            <div>
              <div className="text-[10px] text-slate-400 font-medium">Klussen</div>
              <div className="text-xs font-bold text-slate-200">
                {completedJobsCount} / {state.jobs.length} Klaar
              </div>
            </div>
          </div>

          {/* New Job Action Button */}
          <button
            onClick={() => {
              setEditingJob(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nieuwe Klus</span>
          </button>
        </div>
      </div>

      {/* MAIN VIEWPORT SPLIT */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* LEFT / CENTER: CENTRAL INTERACTIVE FLOOR PLAN CANVAS (7 COLS) */}
        <div className="lg:col-span-7 relative bg-slate-950 border-r border-slate-800 flex flex-col h-full overflow-hidden">
          {/* Canvas Floating Top Info Bar */}
          <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-3 pointer-events-none">
            <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 px-3.5 py-1.5 rounded-xl shadow-lg flex items-center gap-2 text-xs text-slate-300 pointer-events-auto">
              <MousePointer className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold text-amber-300">Inspectiemodus</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400 text-[11px]">
                Klik om een element te bekijken • <kbd className="bg-slate-950 border border-slate-700 px-1 rounded text-slate-200">Ctrl</kbd> + klik voor meervoudige selectie
              </span>
            </div>

            {/* Selection status badge & deselect button */}
            {state.selectedItemIds.length > 0 && (
              <div className="bg-amber-500 text-slate-950 px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-bold pointer-events-auto">
                <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                <span>{state.selectedItemIds.length} item(s) geselecteerd</span>
                <button
                  onClick={() => setState((prev) => ({ ...prev, selectedItemIds: [] }))}
                  className="ml-1 bg-slate-950/20 hover:bg-slate-950/40 text-slate-950 px-1.5 py-0.5 rounded transition text-[11px]"
                  title="Selectie wissen"
                >
                  Wissen
                </button>
              </div>
            )}
          </div>

          {/* Canvas Component Container */}
          <div className="flex-1 w-full h-full">
            <PlannerCanvas state={state} setState={setState} />
          </div>

          {/* Canvas Floating Controls Bottom Right */}
          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1.5 rounded-2xl shadow-xl">
            <button
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  view: { ...prev.view, zoom: Math.min(3, prev.view.zoom * 1.2) },
                }))
              }
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition"
              title="Inzoomen"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  view: { ...prev.view, zoom: Math.max(0.3, prev.view.zoom / 1.2) },
                }))
              }
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition"
              title="Uitzoomen"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  view: { pan: { x: 100, y: 100 }, zoom: 1 },
                }))
              }
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition"
              title="Reset weergave"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* RIGHT: TABBED INSPECTOR & MANAGEMENT PANEL (5 COLS) */}
        <div className="lg:col-span-5 bg-slate-900 flex flex-col h-full overflow-hidden">
          {/* Panel Tab Navigation Header */}
          <div className="flex items-center border-b border-slate-800 bg-slate-950/80 p-2 shrink-0">
            <button
              onClick={() => setActiveRightTab('inspector')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition ${
                activeRightTab === 'inspector'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Info className="w-4 h-4" />
              <span>Inspector</span>
              {state.selectedItemIds.length > 0 && (
                <span className="bg-slate-950 text-amber-300 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {state.selectedItemIds.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveRightTab('jobs')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition ${
                activeRightTab === 'jobs'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Klussen ({state.jobs.length})</span>
            </button>

            <button
              onClick={() => setActiveRightTab('isde')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition ${
                activeRightTab === 'isde'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              <Leaf className="w-3.5 h-3.5" />
              <span>ISDE Subsidie</span>
              {totalISDESubsidy > 0 && (
                <span className="bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[9px] px-1.5 py-0.2 rounded-full font-black">
                  €{Math.round(totalISDESubsidy)}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveRightTab('items')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition ${
                activeRightTab === 'items'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Plattegrond Items</span>
            </button>
          </div>

          {/* TAB CONTENT AREA */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* TAB 1: INSPECTOR */}
            {activeRightTab === 'inspector' && (
              <div className="space-y-4">
                {state.selectedItemIds.length === 0 ? (
                  /* EMPTY STATE WHEN NOTHING SELECTED */
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 text-center space-y-3 my-8">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                      <MousePointer className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-200">
                      {state.walls.length === 0 && state.zones.length === 0
                        ? 'Plattegrond is nog leeg'
                        : 'Geen Element Geselecteerd'}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                      {state.walls.length === 0 && state.zones.length === 0
                        ? 'Er staan nog geen muren of ruimtes op de plattegrond. Schakel naar Ontwerp om je eerste muren of een achtergrondgrondfoto toe te voegen.'
                        : "Klik op een muur, ruimte of deur op de plattegrond (of in de tab 'Plattegrond Items') om alle afmetingen, oppervlaktes en gekoppelde klussen te bekijken."}
                    </p>

                    {state.walls.length === 0 && state.zones.length === 0 ? (
                      <button
                        onClick={() => setState((prev) => ({ ...prev, activeTab: 'build' }))}
                        className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition"
                      >
                        <span>Start met Tekenen (Ontwerp)</span>
                      </button>
                    ) : (
                      <div className="pt-2 text-[11px] text-amber-400/80 bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-xl">
                        💡 Tip: Houd <kbd className="bg-slate-900 border border-slate-700 px-1 rounded text-slate-200">Ctrl</kbd> ingedrukt om meerdere ruimtes of wanden tegelijk te selecteren!
                      </div>
                    )}
                  </div>
                ) : state.selectedItemIds.length === 1 ? (
                  /* SINGLE ITEM INSPECTION */
                  (() => {
                    const selId = state.selectedItemIds[0];
                    const wall = state.walls.find((w) => w.id === selId);
                    const zone = state.zones.find((z) => z.id === selId);
                    const opening = state.openings.find((o) => o.id === selId);

                    if (wall) {
                      const metrics = getWallMetrics(wall, state.openings, state.scalePxPerMeter);
                      const wallOpenings = state.openings.filter((o) => o.wallId === wall.id);
                      const assignedJobs = state.jobs.filter((j) => j.assignedItemIds.includes(wall.id));

                      return (
                        <div className="space-y-4">
                          {/* Item Header */}
                          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
                                🧱
                              </div>
                              <div>
                                <h3 className="font-bold text-slate-100 text-sm">{wall.label}</h3>
                                <div className="text-xs text-slate-400">{wall.type}</div>
                              </div>
                            </div>

                            <button
                              onClick={() => setState((prev) => ({ ...prev, selectedItemIds: [] }))}
                              className="text-slate-500 hover:text-slate-300"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Wall Metrics Grid */}
                          <div className="grid grid-cols-2 gap-2.5">
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                              <div className="text-[10px] text-slate-400">Lengte</div>
                              <div className="text-base font-black text-amber-400">
                                {metrics.lengthMeters.toFixed(2).replace('.', ',')} m1
                              </div>
                            </div>

                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                              <div className="text-[10px] text-slate-400">Hoogte</div>
                              <div className="text-base font-black text-slate-200">
                                {wall.heightMeters.toFixed(2).replace('.', ',')} m1
                              </div>
                            </div>

                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                              <div className="text-[10px] text-slate-400">Bruto Oppervlakte</div>
                              <div className="text-sm font-bold text-slate-300">
                                {metrics.grossAreaM2.toFixed(2).replace('.', ',')} m²
                              </div>
                            </div>

                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                              <div className="text-[10px] text-slate-400">Netto Oppervlakte</div>
                              <div className="text-sm font-bold text-emerald-400">
                                {metrics.netAreaM2.toFixed(2).replace('.', ',')} m²
                              </div>
                              <div className="text-[9px] text-slate-500">Excl. ramen & deuren</div>
                            </div>
                          </div>

                          {/* Openings on this wall */}
                          {wallOpenings.length > 0 && (
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                              <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                <DoorOpen className="w-3.5 h-3.5 text-teal-400" />
                                <span>Ramen & Deuren in deze muur ({wallOpenings.length})</span>
                              </div>
                              <div className="space-y-1">
                                {wallOpenings.map((op) => (
                                  <div
                                    key={op.id}
                                    onClick={(e) => handleListItemClick(e, op.id)}
                                    className="flex items-center justify-between text-xs bg-slate-900 p-2 rounded-lg cursor-pointer hover:border-slate-700 border border-transparent"
                                  >
                                    <span className="font-semibold text-slate-200">{op.label}</span>
                                    <span className="text-slate-400">
                                      {op.widthMeters}m x {op.heightMeters}m
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Assigned Jobs list */}
                          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                                <Hammer className="w-3.5 h-3.5 text-amber-400" />
                                <span>Gekoppelde Klussen ({assignedJobs.length})</span>
                              </div>

                              <button
                                onClick={() => {
                                  setEditingJob(null);
                                  setIsModalOpen(true);
                                }}
                                className="text-[11px] font-bold text-amber-400 hover:underline flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Nieuwe Klus</span>
                              </button>
                            </div>

                            {assignedJobs.length === 0 ? (
                              <p className="text-xs text-slate-500 italic">
                                Geen klussen gekoppeld aan deze muur.
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {assignedJobs.map((job) => (
                                  <div
                                    key={job.id}
                                    className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-2.5 h-2.5 rounded-full"
                                        style={{ backgroundColor: job.color }}
                                      />
                                      <span className="font-semibold text-slate-200">{job.title}</span>
                                    </div>
                                    <button
                                      onClick={() => handleUnassignItemFromJob(job.id, wall.id)}
                                      className="p-1 text-slate-500 hover:text-rose-400"
                                      title="Ontkoppelen van klus"
                                    >
                                      <Unlink className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Assign to Existing Job Dropdown */}
                            {state.jobs.length > 0 && (
                              <div className="pt-2 border-t border-slate-800/80 flex gap-2">
                                <select
                                  value={linkJobSelectId}
                                  onChange={(e) => setLinkJobSelectId(e.target.value)}
                                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                                >
                                  <option value="">-- Koppel aan bestaande klus --</option>
                                  {state.jobs.map((j) => (
                                    <option key={j.id} value={j.id}>
                                      {j.title} ({j.category})
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => {
                                    handleAssignSelectionToJob(linkJobSelectId);
                                    setLinkJobSelectId('');
                                  }}
                                  disabled={!linkJobSelectId}
                                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-lg transition shrink-0"
                                >
                                  Koppelen
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (zone) {
                      const areaM2 = calculateZoneNetArea(zone.points, state.walls, state.wallTypeThicknesses, state.scalePxPerMeter);
                      const assignedJobs = state.jobs.filter((j) => j.assignedItemIds.includes(zone.id));

                      return (
                        <div className="space-y-4">
                          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-xl border border-white/20 flex items-center justify-center font-bold text-lg"
                                style={{ backgroundColor: zone.color }}
                              >
                                🏠
                              </div>
                              <div>
                                <h3 className="font-bold text-slate-100 text-sm">{zone.label}</h3>
                                <div className="text-xs text-slate-400">Ruimte / Zone</div>
                              </div>
                            </div>

                            <button
                              onClick={() => setState((prev) => ({ ...prev, selectedItemIds: [] }))}
                              className="text-slate-500 hover:text-slate-300"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center space-y-1">
                            <div className="text-xs font-semibold text-slate-400">Vloeroppervlakte</div>
                            <div className="text-3xl font-black text-sky-400">
                              {areaM2.toFixed(2).replace('.', ',')} m²
                            </div>
                          </div>

                          {/* Assigned Jobs list */}
                          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                                <Hammer className="w-3.5 h-3.5 text-amber-400" />
                                <span>Gekoppelde Klussen ({assignedJobs.length})</span>
                              </div>

                              <button
                                onClick={() => {
                                  setEditingJob(null);
                                  setIsModalOpen(true);
                                }}
                                className="text-[11px] font-bold text-amber-400 hover:underline flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Nieuwe Klus</span>
                              </button>
                            </div>

                            {assignedJobs.length === 0 ? (
                              <p className="text-xs text-slate-500 italic">
                                Geen klussen gekoppeld aan deze ruimte.
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {assignedJobs.map((job) => (
                                  <div
                                    key={job.id}
                                    className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-2.5 h-2.5 rounded-full"
                                        style={{ backgroundColor: job.color }}
                                      />
                                      <span className="font-semibold text-slate-200">{job.title}</span>
                                    </div>
                                    <button
                                      onClick={() => handleUnassignItemFromJob(job.id, zone.id)}
                                      className="p-1 text-slate-500 hover:text-rose-400"
                                      title="Ontkoppelen van klus"
                                    >
                                      <Unlink className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Assign to Existing Job */}
                            {state.jobs.length > 0 && (
                              <div className="pt-2 border-t border-slate-800/80 flex gap-2">
                                <select
                                  value={linkJobSelectId}
                                  onChange={(e) => setLinkJobSelectId(e.target.value)}
                                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                                >
                                  <option value="">-- Koppel aan bestaande klus --</option>
                                  {state.jobs.map((j) => (
                                    <option key={j.id} value={j.id}>
                                      {j.title} ({j.category})
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => {
                                    handleAssignSelectionToJob(linkJobSelectId);
                                    setLinkJobSelectId('');
                                  }}
                                  disabled={!linkJobSelectId}
                                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-lg transition shrink-0"
                                >
                                  Koppelen
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (opening) {
                      const parentWall = state.walls.find((w) => w.id === opening.wallId);
                      const areaM2 = opening.widthMeters * opening.heightMeters;
                      const assignedJobs = state.jobs.filter((j) => j.assignedItemIds.includes(opening.id));

                      return (
                        <div className="space-y-4">
                          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center font-bold">
                                {opening.type === 'Door' ? '🚪' : '🪟'}
                              </div>
                              <div>
                                <h3 className="font-bold text-slate-100 text-sm">{opening.label}</h3>
                                <div className="text-xs text-slate-400">
                                  {opening.type === 'Door' ? 'Deur' : 'Raam'}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => setState((prev) => ({ ...prev, selectedItemIds: [] }))}
                              className="text-slate-500 hover:text-slate-300"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                              <div className="text-[10px] text-slate-400">Breedte</div>
                              <div className="text-base font-black text-teal-300">
                                {opening.widthMeters.toFixed(2).replace('.', ',')} m1
                              </div>
                            </div>

                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                              <div className="text-[10px] text-slate-400">Hoogte</div>
                              <div className="text-base font-black text-slate-200">
                                {opening.heightMeters.toFixed(2).replace('.', ',')} m1
                              </div>
                            </div>

                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 col-span-2">
                              <div className="text-[10px] text-slate-400">Oppervlakte</div>
                              <div className="text-base font-bold text-slate-200">
                                {areaM2.toFixed(2).replace('.', ',')} m²
                              </div>
                              {parentWall && (
                                <div className="text-[10px] text-slate-500 mt-1">
                                  Behoort bij: <span className="text-slate-300 font-medium">{parentWall.label}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Assigned Jobs list */}
                          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                                <Hammer className="w-3.5 h-3.5 text-amber-400" />
                                <span>Gekoppelde Klussen ({assignedJobs.length})</span>
                              </div>

                              <button
                                onClick={() => {
                                  setEditingJob(null);
                                  setIsModalOpen(true);
                                }}
                                className="text-[11px] font-bold text-amber-400 hover:underline flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Nieuwe Klus</span>
                              </button>
                            </div>

                            {assignedJobs.length === 0 ? (
                              <p className="text-xs text-slate-500 italic">
                                Geen klussen gekoppeld aan dit item.
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {assignedJobs.map((job) => (
                                  <div
                                    key={job.id}
                                    className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-2.5 h-2.5 rounded-full"
                                        style={{ backgroundColor: job.color }}
                                      />
                                      <span className="font-semibold text-slate-200">{job.title}</span>
                                    </div>
                                    <button
                                      onClick={() => handleUnassignItemFromJob(job.id, opening.id)}
                                      className="p-1 text-slate-500 hover:text-rose-400"
                                      title="Ontkoppelen van klus"
                                    >
                                      <Unlink className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Assign to Existing Job */}
                            {state.jobs.length > 0 && (
                              <div className="pt-2 border-t border-slate-800/80 flex gap-2">
                                <select
                                  value={linkJobSelectId}
                                  onChange={(e) => setLinkJobSelectId(e.target.value)}
                                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                                >
                                  <option value="">-- Koppel aan bestaande klus --</option>
                                  {state.jobs.map((j) => (
                                    <option key={j.id} value={j.id}>
                                      {j.title} ({j.category})
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => {
                                    handleAssignSelectionToJob(linkJobSelectId);
                                    setLinkJobSelectId('');
                                  }}
                                  disabled={!linkJobSelectId}
                                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-lg transition shrink-0"
                                >
                                  Koppelen
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })()
                ) : (
                  /* MULTI-ITEM SELECTION INSPECTION (Ctrl+Click) */
                  <div className="space-y-4">
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold">
                          <Sparkles className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-100 text-sm">Meervoudige Selectie</h3>
                          <div className="text-xs text-amber-400 font-semibold">
                            {state.selectedItemIds.length} elementen geselecteerd
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setState((prev) => ({ ...prev, selectedItemIds: [] }))}
                        className="text-slate-500 hover:text-slate-300"
                        title="Selectie wissen"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Breakdown Chips */}
                    <div className="flex flex-wrap gap-2">
                      {selectedWalls.length > 0 && (
                        <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs px-2.5 py-1 rounded-lg font-semibold">
                          🧱 {selectedWalls.length} Muur{selectedWalls.length > 1 ? 'en' : ''}
                        </span>
                      )}
                      {selectedZones.length > 0 && (
                        <span className="bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs px-2.5 py-1 rounded-lg font-semibold">
                          🏠 {selectedZones.length} Ruimte{selectedZones.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {selectedOpenings.length > 0 && (
                        <span className="bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs px-2.5 py-1 rounded-lg font-semibold">
                          🚪 {selectedOpenings.length} Raam/Deur{selectedOpenings.length > 1 ? 'en' : ''}
                        </span>
                      )}
                    </div>

                    {/* Aggregate Cumulative Metrics */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-400">Totaal Oppervlakte</div>
                        <div className="text-lg font-black text-amber-400">
                          {selectedTotalNetAreaM2.toFixed(2).replace('.', ',')} m²
                        </div>
                        <div className="text-[9px] text-slate-500">Geselecteerde muren + ruimtes</div>
                      </div>

                      <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-400">Totaal Lengte Muren</div>
                        <div className="text-lg font-black text-slate-200">
                          {selectedTotalWallLengthM1.toFixed(2).replace('.', ',')} m1
                        </div>
                      </div>
                    </div>

                    {/* List of Selected Items */}
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                      <div className="text-xs font-bold text-slate-300">Geselecteerde Items List:</div>
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                        {selectedWalls.map((w) => (
                          <div
                            key={w.id}
                            className="flex items-center justify-between bg-slate-900 p-2 rounded-lg text-xs"
                          >
                            <span className="font-semibold text-slate-200">🧱 {w.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">
                                {getWallMetrics(w, state.openings, state.scalePxPerMeter).netAreaM2.toFixed(1)} m²
                              </span>
                              <button
                                onClick={() =>
                                  setState((prev) => ({
                                    ...prev,
                                    selectedItemIds: prev.selectedItemIds.filter((id) => id !== w.id),
                                  }))
                                }
                                className="text-slate-500 hover:text-slate-300"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {selectedZones.map((z) => (
                          <div
                            key={z.id}
                            className="flex items-center justify-between bg-slate-900 p-2 rounded-lg text-xs"
                          >
                            <span className="font-semibold text-slate-200">🏠 {z.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">
                                {calculateZoneNetArea(z.points, state.walls, state.wallTypeThicknesses, state.scalePxPerMeter).toFixed(1)} m²
                              </span>
                              <button
                                onClick={() =>
                                  setState((prev) => ({
                                    ...prev,
                                    selectedItemIds: prev.selectedItemIds.filter((id) => id !== z.id),
                                  }))
                                }
                                className="text-slate-500 hover:text-slate-300"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {selectedOpenings.map((o) => (
                          <div
                            key={o.id}
                            className="flex items-center justify-between bg-slate-900 p-2 rounded-lg text-xs"
                          >
                            <span className="font-semibold text-slate-200">
                              {o.type === 'Door' ? '🚪' : '🪟'} {o.label}
                            </span>
                            <button
                              onClick={() =>
                                setState((prev) => ({
                                  ...prev,
                                  selectedItemIds: prev.selectedItemIds.filter((id) => id !== o.id),
                                }))
                              }
                              className="text-slate-500 hover:text-slate-300"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Direct Actions for Multi-Selection */}
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
                      <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Hammer className="w-3.5 h-3.5 text-amber-400" />
                        <span>Klus Acties voor deze {state.selectedItemIds.length} Items</span>
                      </div>

                      <button
                        onClick={() => {
                          setEditingJob(null);
                          setIsModalOpen(true);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Nieuwe Klus Aanmaken voor Selectie ({state.selectedItemIds.length})</span>
                      </button>

                      {/* Attach Selection to Existing Job */}
                      {state.jobs.length > 0 && (
                        <div className="pt-2 border-t border-slate-800/80 flex gap-2">
                          <select
                            value={linkJobSelectId}
                            onChange={(e) => setLinkJobSelectId(e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                          >
                            <option value="">-- Koppel aan bestaande klus --</option>
                            {state.jobs.map((j) => (
                              <option key={j.id} value={j.id}>
                                {j.title} ({j.category})
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              handleAssignSelectionToJob(linkJobSelectId);
                              setLinkJobSelectId('');
                            }}
                            disabled={!linkJobSelectId}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-lg transition shrink-0"
                          >
                            Koppelen
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: KLUSSENBEHEER */}
            {activeRightTab === 'jobs' && (
              <div className="space-y-4">
                {/* Search & Filter Bar */}
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-2 rounded-2xl">
                  <div className="flex-1 flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                    <Search className="w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Zoek klus of categorie..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-transparent text-xs text-slate-200 outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
                    {(['all', 'todo', 'in_progress', 'done'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => setStatusFilter(st)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition ${
                          statusFilter === st
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {st === 'all' ? 'Alles' : st === 'todo' ? 'To Do' : st === 'in_progress' ? 'Mee Bezig' : 'Klaar'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Create New Job Button */}
                <button
                  onClick={() => {
                    setEditingJob(null);
                    setIsModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/30 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nieuwe Klus Toevoegen</span>
                </button>

                {/* Job Cards List */}
                <div className="space-y-3">
                  {filteredJobs.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      Geen klussen gevonden die aan je filter voldoen.
                    </div>
                  ) : (
                    filteredJobs.map((item) => {
                      const { job, totalCost, quantity, unitLabel, isdeSub, isdeConfig } = item;

                      return (
                        <div
                          key={job.id}
                          className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3 hover:border-slate-700 transition"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                              <div
                                className="w-3.5 h-3.5 rounded-full mt-1 shrink-0"
                                style={{ backgroundColor: job.color }}
                              />
                              <div>
                                <h4 className="font-bold text-xs text-slate-100">{job.title}</h4>
                                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                  <span className="font-medium text-slate-300">{job.category}</span>
                                  <span>•</span>
                                  <span>
                                    {job.costModel === 'fixed'
                                      ? 'Vaste prijs'
                                      : `€ ${job.unitPrice.toFixed(2)} / ${unitLabel}`}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-sm font-black text-amber-400">
                                € {totalCost.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                              </div>
                              {job.costModel !== 'fixed' && (
                                <div className="text-[10px] text-slate-400">
                                  {quantity.toFixed(2).replace('.', ',')} {unitLabel}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* ISDE Subsidy Card Badge */}
                          {isdeSub && isdeSub.isISDE && (
                            <div className="bg-emerald-950/50 border border-emerald-500/30 rounded-xl p-2.5 space-y-1">
                              <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                                <div className="flex items-center gap-1.5">
                                  <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>RVO ISDE Subsidie</span>
                                  {isdeSub.isDoubleRateActive && (
                                    <span className="bg-emerald-500/20 text-emerald-300 text-[9px] px-1.5 py-0.2 rounded font-black">
                                      2x Verdubbeld!
                                    </span>
                                  )}
                                </div>
                                <span className="text-emerald-400 font-black">
                                  - € {isdeSub.subsidyAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                                </span>
                              </div>

                              {!isdeSub.meetsMinimum && (
                                <div className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 p-1.5 rounded-lg flex items-center gap-1.5 mt-1">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                                  <span>
                                    Minimaal {isdeConfig?.minQuantity} {isdeSub.unit} nodig op tekening (nog{' '}
                                    {isdeSub.shortfall.toFixed(1)} {isdeSub.unit} extra te koppelen)
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Assigned Items Pills */}
                          {job.assignedItemIds.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {job.assignedItemIds.map((itemId) => {
                                const wall = state.walls.find((w) => w.id === itemId);
                                const zone = state.zones.find((z) => z.id === itemId);
                                const opening = state.openings.find((o) => o.id === itemId);
                                const label = wall?.label || zone?.label || opening?.label || itemId;

                                return (
                                  <span
                                    key={itemId}
                                    onClick={(e) => handleListItemClick(e, itemId)}
                                    className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-md border border-slate-800 font-medium cursor-pointer transition"
                                  >
                                    <span>{label}</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUnassignItemFromJob(job.id, itemId);
                                      }}
                                      className="text-slate-500 hover:text-rose-400 ml-0.5"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Action Footer */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                            <select
                              value={job.status}
                              onChange={(e) => {
                                const val = e.target.value as any;
                                setState((prev) => ({
                                  ...prev,
                                  jobs: prev.jobs.map((j) => (j.id === job.id ? { ...j, status: val } : j)),
                                }));
                              }}
                              className="bg-slate-900 text-slate-300 border border-slate-800 rounded-lg px-2 py-1 outline-none text-[11px]"
                            >
                              <option value="todo">To Do</option>
                              <option value="in_progress">Mee Bezig</option>
                              <option value="done">Afgerond</option>
                            </select>

                            <div className="flex items-center gap-1.5">
                              {state.selectedItemIds.length > 0 && (
                                <button
                                  onClick={() => handleAssignSelectionToJob(job.id)}
                                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[10px] rounded-lg border border-amber-500/40 transition flex items-center gap-1"
                                >
                                  <LinkIcon className="w-3 h-3" />
                                  <span>+ Selectie ({state.selectedItemIds.length})</span>
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  setEditingJob(job);
                                  setIsModalOpen(true);
                                }}
                                className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-900 rounded-lg transition"
                                title="Klus bewerken"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteJob(job.id)}
                                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition"
                                title="Klus verwijderen"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: ISDE SUBSIDIEWIJZER (OFFICIAL RVO REGELING) */}
            {activeRightTab === 'isde' && (
              <div className="space-y-4">
                {/* ISDE Verdubbelaar Rules Banner */}
                <div className="bg-emerald-950/80 border border-emerald-500/40 rounded-2xl p-4 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-emerald-200">ISDE Subsidie Verdubbelaar</h3>
                        <p className="text-[11px] text-emerald-300/80">RVO Regeling Woningeigenaren</p>
                      </div>
                    </div>

                    <a
                      href="https://www.rvo.nl/subsidies-financiering/isde/woningeigenaren/isolatiemaatregelen"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 hover:underline bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded-lg transition shrink-0"
                    >
                      <span>Officieel RVO</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Bij het uitvoeren van **2 of meer isolatiemaatregelen** (of 1 isolatiemaatregel gecombineerd met een warmtepomp, zonneboiler of warmtenet) **verdubbelt het m²-tarief voor isolatie automatisch!**
                  </p>

                  <div className="p-3 bg-slate-950/90 rounded-xl border border-emerald-500/20 flex items-center justify-between text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400">Gekoppelde ISDE Maatregelen</div>
                      <div className="font-bold text-slate-200 text-sm">
                        {totalActiveISDECount} maatregel(en) in project
                      </div>
                    </div>

                    {isDoubleRateActive ? (
                      <span className="bg-emerald-500 text-slate-950 font-black text-xs px-3 py-1 rounded-lg flex items-center gap-1 shadow-md">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>2x DUBBEL TARIEF ACTIEF</span>
                      </span>
                    ) : (
                      <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-3 py-1 rounded-lg font-bold">
                        1 Maatregel (Standaard tarief)
                      </span>
                    )}
                  </div>
                </div>

                {/* Subsidie Financial Breakdown */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Totale Bruto Kluskosten:</span>
                    <span className="font-bold text-amber-400">
                      € {grandTotalCost.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-300 font-semibold flex items-center gap-1">
                      <Leaf className="w-3.5 h-3.5 text-emerald-400" /> Totale ISDE Subsidie:
                    </span>
                    <span className="font-extrabold text-emerald-400">
                      - € {totalISDESubsidy.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-sm font-bold">
                    <span className="text-slate-200">Netto Eigen Investering:</span>
                    <span className="text-teal-300 font-black text-base">
                      € {grandTotalNettoCost.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* List of All ISDE Measures */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Alle ISDE Maatregelen & Eisen (2025/2026)
                  </h3>

                  {Object.values(ISDE_MEASURES).map((measure) => {
                    const activeJobItems = jobsWithISDE.filter((j) => j.job.category === measure.category);
                    const isLinked = activeJobItems.length > 0;
                    const totalQty = activeJobItems.reduce((sum, item) => sum + item.quantity, 0);
                    const calcSub = isLinked
                      ? calculateJobISDESubsidy(measure.category, totalQty, totalActiveISDECount)
                      : null;

                    return (
                      <div
                        key={measure.category}
                        className={`border rounded-2xl p-4 space-y-3 transition ${
                          isLinked
                            ? 'bg-slate-950 border-emerald-500/40 shadow-md'
                            : 'bg-slate-950/60 border-slate-800 opacity-90'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-100">{measure.shortLabel}</span>
                              {isLinked ? (
                                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/30">
                                  <Check className="w-3 h-3" /> In Project
                                </span>
                              ) : (
                                <span className="bg-slate-900 text-slate-500 text-[10px] px-2 py-0.5 rounded-full border border-slate-800">
                                  Niet in project
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{measure.description}</div>
                          </div>

                          <a
                            href={measure.rvoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-slate-400 hover:text-emerald-400 bg-slate-900 border border-slate-800 rounded-xl transition shrink-0"
                            title="Bekijk op RVO.nl"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>

                        {/* Rates & Requirements */}
                        <div className="space-y-2 text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800/80">
                              <div className="text-[10px] text-slate-400">Subsidietarief ({measure.unit})</div>
                              <div className="font-bold text-emerald-300 text-xs">
                                € {measure.singleRate.toFixed(2)}
                                {measure.singleRate !== measure.doubleRate && (
                                  <span className="text-emerald-400 ml-1">
                                    (€ {measure.doubleRate.toFixed(2)} bij 2+)
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800/80">
                              <div className="text-[10px] text-slate-400">Oppervlakte / Aantal</div>
                              <div className="font-bold text-slate-200 text-xs">
                                Min. {measure.minQuantity} {measure.unit}
                                {measure.maxQuantity ? ` • Max. ${measure.maxQuantity} ${measure.unit}` : ''}
                              </div>
                            </div>
                          </div>

                          <div className="bg-slate-900/90 px-3 py-2 rounded-xl border border-slate-800/80 flex items-start gap-2">
                            <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                Isolatiewaarde & Technische Eisen:
                              </div>
                              <div className="font-semibold text-slate-200 text-xs mt-0.5">
                                {measure.rdValueRequirement}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Current Status for this measure */}
                        {isLinked && calcSub && (
                          <div className="bg-emerald-950/60 border border-emerald-500/30 rounded-xl p-2.5 flex items-center justify-between text-xs">
                            <div>
                              <div className="text-[10px] text-emerald-300">Gekoppeld op tekening:</div>
                              <div className="font-bold text-slate-200">
                                {totalQty.toFixed(1)} {measure.unit}{' '}
                                {!calcSub.meetsMinimum && (
                                  <span className="text-amber-400 font-semibold text-[10px]">
                                    (Min. {measure.minQuantity} {measure.unit} nodig)
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-[10px] text-emerald-300 font-semibold">Subsidievergoeding</div>
                              <div className="font-black text-emerald-400 text-sm">
                                € {calcSub.subsidyAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Quick Add Button */}
                        {!isLinked && (
                          <button
                            onClick={() => {
                              setEditingJob(null);
                              setIsModalOpen(true);
                            }}
                            className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-emerald-300 hover:text-emerald-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Voeg {measure.shortLabel} Toe</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: PLATTEGROND ITEMS (INVENTORY) */}
            {activeRightTab === 'items' && (
              <div className="space-y-4">
                <div className="text-xs text-slate-400 leading-relaxed bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  💡 Klik op een item om het op het canvas te selecteren. Houd <kbd className="bg-slate-900 border border-slate-700 px-1 rounded text-slate-200">Ctrl</kbd> ingedrukt om meerdere items te kiezen.
                </div>

                {/* Category: Rooms / Zones */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center justify-between">
                    <span>Ruimtes ({state.zones.length})</span>
                  </h3>
                  <div className="space-y-1.5">
                    {state.zones.map((zone) => {
                      const areaM2 = calculateZoneNetArea(zone.points, state.walls, state.wallTypeThicknesses, state.scalePxPerMeter);
                      const isSelected = state.selectedItemIds.includes(zone.id);
                      const assignedJobsCount = state.jobs.filter((j) => j.assignedItemIds.includes(zone.id)).length;

                      return (
                        <div
                          key={zone.id}
                          onClick={(e) => handleListItemClick(e, zone.id)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-500/50 text-amber-200 font-bold'
                              : 'bg-slate-950 hover:border-slate-700 border-slate-800 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: zone.color }}
                            />
                            <span className="font-semibold">{zone.label}</span>
                            {assignedJobsCount > 0 && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold">
                                🔨 {assignedJobsCount}
                              </span>
                            )}
                          </div>
                          <span className="font-bold text-sky-400">{areaM2.toFixed(1)} m²</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Category: Walls */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center justify-between">
                    <span>Muren ({state.walls.length})</span>
                  </h3>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {state.walls.map((wall) => {
                      const metrics = getWallMetrics(wall, state.openings, state.scalePxPerMeter);
                      const isSelected = state.selectedItemIds.includes(wall.id);
                      const assignedJobsCount = state.jobs.filter((j) => j.assignedItemIds.includes(wall.id)).length;

                      return (
                        <div
                          key={wall.id}
                          onClick={(e) => handleListItemClick(e, wall.id)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-500/50 text-amber-200 font-bold'
                              : 'bg-slate-950 hover:border-slate-700 border-slate-800 text-slate-200'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{wall.label}</span>
                              {assignedJobsCount > 0 && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold">
                                  🔨 {assignedJobsCount}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">{wall.type}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-amber-400">
                              {metrics.lengthMeters.toFixed(2).replace('.', ',')} m1
                            </div>
                            <div className="text-[10px] text-emerald-400">
                              {metrics.netAreaM2.toFixed(2).replace('.', ',')} m² netto
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Category: Openings */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center justify-between">
                    <span>Ramen & Deuren ({state.openings.length})</span>
                  </h3>
                  <div className="space-y-1.5">
                    {state.openings.map((opening) => {
                      const isSelected = state.selectedItemIds.includes(opening.id);
                      const assignedJobsCount = state.jobs.filter((j) => j.assignedItemIds.includes(opening.id)).length;

                      return (
                        <div
                          key={opening.id}
                          onClick={(e) => handleListItemClick(e, opening.id)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-500/50 text-amber-200 font-bold'
                              : 'bg-slate-950 hover:border-slate-700 border-slate-800 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {opening.type === 'Door' ? (
                              <DoorOpen className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                            ) : (
                              <AppWindow className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                            )}
                            <span className="font-semibold">{opening.label}</span>
                            {assignedJobsCount > 0 && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold">
                                🔨 {assignedJobsCount}
                              </span>
                            )}
                          </div>
                          <span className="font-medium text-slate-400">
                            {opening.widthMeters}m x {opening.heightMeters}m
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
