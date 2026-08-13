import React from 'react';
import { PlannerState, Wall, Zone, Opening, WallType } from '../types';
import { getWallMetrics, calculatePolygonArea, calculateZoneNetArea } from '../utils/geometry';
import {
  X,
  Trash2,
  Ruler,
  Layers,
  DoorOpen,
  AppWindow,
  RotateCw,
  Sliders,
  FileText,
  Plus,
  Check,
  Lock,
  Unlock,
} from 'lucide-react';

interface InspectorPanelProps {
  state: PlannerState;
  setState: React.Dispatch<React.SetStateAction<PlannerState>>;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({ state, setState }) => {
  const selectedId = state.selectedItemIds[0];

  const selectedWall = state.walls.find((w) => w.id === selectedId);
  const selectedZone = state.zones.find((z) => z.id === selectedId);
  const selectedOpening = state.openings.find((o) => o.id === selectedId);

  const closePanel = () => {
    setState((prev) => ({ ...prev, selectedItemIds: [] }));
  };

  const deleteItem = (id: string) => {
    setState((prev) => ({
      ...prev,
      walls: prev.walls.filter((w) => w.id !== id),
      zones: prev.zones.filter((z) => z.id !== id),
      openings: prev.openings.filter((o) => o.id !== id),
      selectedItemIds: [],
    }));
  };

  // Toggle Job Assignment to Selected Item
  const toggleJobAssign = (jobId: string, itemId: string) => {
    setState((prev) => ({
      ...prev,
      jobs: prev.jobs.map((job) => {
        if (job.id === jobId) {
          const isAssigned = job.assignedItemIds.includes(itemId);
          return {
            ...job,
            assignedItemIds: isAssigned
              ? job.assignedItemIds.filter((id) => id !== itemId)
              : [...job.assignedItemIds, itemId],
          };
        }
        return job;
      }),
    }));
  };

  if (!selectedId || (!selectedWall && !selectedZone && !selectedOpening)) {
    // Show Overall Project Stats when nothing is selected
    const totalWallMeters = state.walls.reduce((sum, w) => {
      const metrics = getWallMetrics(w, state.openings, state.scalePxPerMeter, state.walls, state.wallTypeThicknesses);
      return sum + metrics.lengthMeters;
    }, 0);

    const totalFloorAreaM2 = state.zones.reduce((sum, z) => {
      return sum + calculateZoneNetArea(z.points, state.walls, state.wallTypeThicknesses, state.scalePxPerMeter);
    }, 0);

    return (
      <aside className="absolute top-20 right-4 z-20 w-80 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-2xl text-slate-200 select-none">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <Sliders className="w-4 h-4" />
            <span>Project Overzicht</span>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex justify-between items-center">
            <div className="text-xs text-slate-400">Totale Muren Lengte</div>
            <div className="text-sm font-bold text-slate-100">
              {totalWallMeters.toFixed(2).replace('.', ',')} m
            </div>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex justify-between items-center">
            <div className="text-xs text-slate-400">Totaal Vloeroppervlak</div>
            <div className="text-sm font-bold text-sky-400">
              {totalFloorAreaM2.toFixed(2).replace('.', ',')} m²
            </div>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex justify-between items-center">
            <div className="text-xs text-slate-400">Aantal Muren / Ruimtes</div>
            <div className="text-xs font-semibold text-slate-300">
              {state.walls.length} Muren • {state.zones.length} Ruimtes
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-400 block">
                Schaal Calibratie:
              </label>
              <span className="text-[11px] font-semibold text-amber-400">
                {state.scalePxPerMeter} px = 1,00 m
              </span>
            </div>

            <button
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  activeTool: 'calibrate',
                }))
              }
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition border ${
                state.activeTool === 'calibrate'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-lg'
                  : 'bg-slate-950/80 hover:bg-slate-800 text-amber-300 border-amber-500/30'
              }`}
            >
              <Ruler className="w-4 h-4" />
              <span>Automatische Kalibratie (Via Lijn)</span>
            </button>

            <input
              type="range"
              min="20"
              max="100"
              value={state.scalePxPerMeter}
              onChange={(e) =>
                setState((prev) => ({ ...prev, scalePxPerMeter: Number(e.target.value) }))
              }
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Background Images Controls */}
          {state.backgrounds.length > 0 && (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <label className="text-xs font-semibold text-amber-400 block">
                Plattegrond Afbeeldingen ({state.backgrounds.length}):
              </label>
              {state.backgrounds.map((bg) => (
                <div key={bg.id} className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-semibold text-slate-200">
                    <span>{bg.label}</span>
                    <button
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          backgrounds: prev.backgrounds.filter((b) => b.id !== bg.id),
                        }))
                      }
                      className="text-rose-400 hover:text-rose-300 text-[11px]"
                    >
                      Verwijder
                    </button>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Helderheid / Opacity</span>
                      <span>{Math.round((bg.opacity ?? 0.9) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={bg.opacity ?? 0.9}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setState((prev) => ({
                          ...prev,
                          backgrounds: prev.backgrounds.map((b) =>
                            b.id === bg.id ? { ...b, opacity: val } : b
                          ),
                        }));
                      }}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="absolute top-20 right-4 z-20 w-80 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-2xl text-slate-200 select-none max-h-[85vh] overflow-y-auto">
      {/* 1. WALL INSPECTOR */}
      {selectedWall && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <Ruler className="w-4 h-4" />
              <span>Eigenschappen Muur</span>
            </div>
            <button onClick={closePanel} className="text-slate-500 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Muur Naam</label>
            <input
              type="text"
              value={selectedWall.label}
              onChange={(e) => {
                const val = e.target.value;
                setState((prev) => ({
                  ...prev,
                  walls: prev.walls.map((w) => (w.id === selectedWall.id ? { ...w, label: val } : w)),
                }));
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-amber-500"
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Muur Type</label>
            <select
              value={selectedWall.type}
              onChange={(e) => {
                const val = e.target.value as WallType;
                setState((prev) => ({
                  ...prev,
                  walls: prev.walls.map((w) => (w.id === selectedWall.id ? { ...w, type: val } : w)),
                }));
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-amber-500"
            >
              <option value="Binnenmuur">Binnenmuur</option>
              <option value="Buitengevel">Buitengevel</option>
              <option value="Scheidingswand">Scheidingswand</option>
            </select>
          </div>

          {/* Dimensions */}
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Hoogte (m)</label>
            <input
              type="number"
              step="0.1"
              value={selectedWall.heightMeters}
              onChange={(e) => {
                const val = Number(e.target.value);
                setState((prev) => ({
                  ...prev,
                  walls: prev.walls.map((w) =>
                    w.id === selectedWall.id ? { ...w, heightMeters: val } : w
                  ),
                }));
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-amber-500"
            />
          </div>

          {/* Wall Metrics Summary */}
          {(() => {
            const metrics = getWallMetrics(selectedWall, state.openings, state.scalePxPerMeter, state.walls, state.wallTypeThicknesses);
            return (
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Lengte:</span>
                  <span className="font-bold text-amber-400">
                    {metrics.lengthMeters.toFixed(2).replace('.', ',')} m
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Bruto Oppervlakte:</span>
                  <span className="font-medium text-slate-200">
                    {metrics.grossAreaM2.toFixed(2).replace('.', ',')} m²
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Opening Aftrek:</span>
                  <span className="font-medium text-rose-400">
                    -{metrics.openingsAreaM2.toFixed(2).replace('.', ',')} m²
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-800">
                  <span className="font-semibold text-slate-300">Netto Oppervlakte:</span>
                  <span className="font-bold text-emerald-400">
                    {metrics.netAreaM2.toFixed(2).replace('.', ',')} m²
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Assigned Renovation Jobs */}
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Gekoppelde Klussen
            </label>
            <div className="space-y-1">
              {state.jobs.map((job) => {
                const isAssigned = job.assignedItemIds.includes(selectedWall.id);
                return (
                  <button
                    key={job.id}
                    onClick={() => toggleJobAssign(job.id, selectedWall.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition border ${
                      isAssigned
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/40 font-semibold'
                        : 'bg-slate-950/40 text-slate-400 border-slate-800/80 hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: job.color }}
                      />
                      <span>{job.title}</span>
                    </span>
                    {isAssigned && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => deleteItem(selectedWall.id)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold transition border border-rose-800/40"
          >
            <Trash2 className="w-4 h-4" />
            <span>Verwijder Muur</span>
          </button>
        </div>
      )}

      {/* 2. ZONE / ROOM INSPECTOR */}
      {selectedZone && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
              <Layers className="w-4 h-4" />
              <span>Eigenschappen Ruimte</span>
            </div>
            <button onClick={closePanel} className="text-slate-500 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Ruimte Naam</label>
            <input
              type="text"
              value={selectedZone.label}
              onChange={(e) => {
                const val = e.target.value;
                setState((prev) => ({
                  ...prev,
                  zones: prev.zones.map((z) => (z.id === selectedZone.id ? { ...z, label: val } : z)),
                }));
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
            />
          </div>

          {/* Color Presets */}
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Kleur Accent</label>
            <div className="flex gap-2">
              {['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6'].map((col) => (
                <button
                  key={col}
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      zones: prev.zones.map((z) =>
                        z.id === selectedZone.id ? { ...z, color: col } : z
                      ),
                    }))
                  }
                  className={`w-7 h-7 rounded-full border-2 transition ${
                    selectedZone.color === col ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </div>

          {/* Calculated Floor Area */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex justify-between items-center">
            <span className="text-xs text-slate-400">Vloeroppervlakte:</span>
            <span className="text-sm font-bold text-sky-400">
              {calculateZoneNetArea(selectedZone.points, state.walls, state.wallTypeThicknesses, state.scalePxPerMeter).toFixed(2).replace('.', ',')} m²
            </span>
          </div>

          {/* Assigned Renovation Jobs */}
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Gekoppelde Klussen (Vloeren / Plafond / Elektra)
            </label>
            <div className="space-y-1">
              {state.jobs.map((job) => {
                const isAssigned = job.assignedItemIds.includes(selectedZone.id);
                return (
                  <button
                    key={job.id}
                    onClick={() => toggleJobAssign(job.id, selectedZone.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition border ${
                      isAssigned
                        ? 'bg-sky-500/10 text-sky-300 border-sky-500/40 font-semibold'
                        : 'bg-slate-950/40 text-slate-400 border-slate-800/80 hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: job.color }}
                      />
                      <span>{job.title}</span>
                    </span>
                    {isAssigned && <Check className="w-3.5 h-3.5 text-sky-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => deleteItem(selectedZone.id)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold transition border border-rose-800/40"
          >
            <Trash2 className="w-4 h-4" />
            <span>Verwijder Ruimte</span>
          </button>
        </div>
      )}

      {/* 3. OPENING (DOOR / WINDOW) INSPECTOR */}
      {selectedOpening && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
              {selectedOpening.type === 'Door' ? (
                <DoorOpen className="w-4 h-4" />
              ) : (
                <AppWindow className="w-4 h-4" />
              )}
              <span>Eigenschappen {selectedOpening.type === 'Door' ? 'Deur' : 'Raam'}</span>
            </div>
            <button onClick={closePanel} className="text-slate-500 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Naam</label>
            <input
              type="text"
              value={selectedOpening.label}
              onChange={(e) => {
                const val = e.target.value;
                setState((prev) => ({
                  ...prev,
                  openings: prev.openings.map((o) =>
                    o.id === selectedOpening.id ? { ...o, label: val } : o
                  ),
                }));
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Breedte (m)</label>
              <input
                type="number"
                step="0.05"
                value={selectedOpening.widthMeters}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setState((prev) => ({
                    ...prev,
                    openings: prev.openings.map((o) =>
                      o.id === selectedOpening.id ? { ...o, widthMeters: val } : o
                    ),
                  }));
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Hoogte (m)</label>
              <input
                type="number"
                step="0.05"
                value={selectedOpening.heightMeters}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setState((prev) => ({
                    ...prev,
                    openings: prev.openings.map((o) =>
                      o.id === selectedOpening.id ? { ...o, heightMeters: val } : o
                    ),
                  }));
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Lock Position Button */}
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Positie Vergrendeling:
            </label>
            <button
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  openings: prev.openings.map((o) =>
                    o.id === selectedOpening.id ? { ...o, isLocked: !o.isLocked } : o
                  ),
                }))
              }
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition border ${
                selectedOpening.isLocked
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/40'
                  : 'bg-slate-950/40 text-slate-400 border-slate-800/80 hover:bg-slate-800'
              }`}
            >
              {selectedOpening.isLocked ? (
                <>
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>Positie Vergrendeld (Vast)</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4 text-slate-400" />
                  <span>Positie Ontgrendeld (Sleepbaar)</span>
                </>
              )}
            </button>
          </div>

          {/* Swing / Hand Flips for Doors */}
          {selectedOpening.type === 'Door' && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    openings: prev.openings.map((o) =>
                      o.id === selectedOpening.id ? { ...o, flipSide: !o.flipSide } : o
                    ),
                  }))
                }
                className="py-1.5 bg-slate-950 hover:bg-slate-800 rounded-xl border border-slate-800 text-xs font-medium text-slate-300 transition"
              >
                Draai Binnen/Buiten
              </button>
              <button
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    openings: prev.openings.map((o) =>
                      o.id === selectedOpening.id ? { ...o, flipHand: !o.flipHand } : o
                    ),
                  }))
                }
                className="py-1.5 bg-slate-950 hover:bg-slate-800 rounded-xl border border-slate-800 text-xs font-medium text-slate-300 transition"
              >
                Spiegelen (Scharnier)
              </button>
            </div>
          )}

          <button
            onClick={() => deleteItem(selectedOpening.id)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold transition border border-rose-800/40"
          >
            <Trash2 className="w-4 h-4" />
            <span>Verwijder Element</span>
          </button>
        </div>
      )}
    </aside>
  );
};
