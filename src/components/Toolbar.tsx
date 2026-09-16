import React, { useRef, useState } from 'react';
import { PlannerState, ToolMode, WallType } from '../types';
import {
  MousePointer,
  Square,
  DoorOpen,
  AppWindow,
  Scissors,
  Split,
  Image as ImageIcon,
  Eraser,
  Grid,
  Magnet,
  Compass,
  RotateCcw,
  Plus,
  Minus,
  Maximize2,
  Sliders,
  BedDouble,
  ShowerHead,
  Bath,
  Laptop,
  CircleDot,
  Droplets,
  Armchair,
  ChevronRight,
  X,
  Box,
} from 'lucide-react';
import { FURNITURE_DEFINITIONS, FURNITURE_TYPES_LIST } from '../utils/furniture';
import { FurnitureType } from '../types';

interface ToolbarProps {
  state: PlannerState;
  setState: React.Dispatch<React.SetStateAction<PlannerState>>;
  onUploadBackground: (file: File) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ state, setState, onUploadBackground }) => {
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const [showSnapSettings, setShowSnapSettings] = useState(false);
  const [showFurnitureMenu, setShowFurnitureMenu] = useState(false);

  const setTool = (tool: ToolMode) => {
    setState((prev) => ({
      ...prev,
      activeTool: tool,
      selectedItemIds: tool === 'select' ? prev.selectedItemIds : [],
    }));
  };

  const setWallType = (type: WallType) => {
    setState((prev) => ({
      ...prev,
      wallTypeToDraw: type,
      activeTool: 'wall',
    }));
  };

  const toggleGrid = () => {
    setState((prev) => ({ ...prev, gridVisible: !prev.gridVisible }));
  };

  const toggleOrtho = () => {
    setState((prev) => ({ ...prev, orthoSnap: !prev.orthoSnap }));
  };

  const toggleMagnetic = () => {
    setState((prev) => ({ ...prev, magneticSnap: !prev.magneticSnap }));
  };

  const handleZoom = (delta: number) => {
    setState((prev) => {
      const newZoom = Math.min(2.5, Math.max(0.4, prev.view.zoom + delta));
      return {
        ...prev,
        view: { ...prev.view, zoom: Math.round(newZoom * 100) / 100 },
      };
    });
  };

  const resetView = () => {
    setState((prev) => ({
      ...prev,
      view: { pan: { x: 80, y: 60 }, zoom: 1 },
    }));
  };

  const handleBgFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadBackground(e.target.files[0]);
    }
  };

  return (
    <aside className="absolute top-20 left-4 z-20 flex flex-col gap-3 select-none">
      {/* Primary Drawing Tools */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-1.5 shadow-xl flex flex-col gap-1 w-14 items-center">
        {/* Select */}
        <button
          onClick={() => setTool('select')}
          className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center transition ${
            state.activeTool === 'select'
              ? 'bg-amber-500 text-slate-950 font-bold shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Selecteren & Verplaatsen (S)"
        >
          <MousePointer className="w-5 h-5" />
          <span className="text-[9px] font-medium leading-none mt-0.5">Select</span>
        </button>

        {/* Wall */}
        <button
          onClick={() => setTool('wall')}
          className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center transition relative ${
            state.activeTool === 'wall'
              ? 'bg-amber-500 text-slate-950 font-bold shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Muur Tekenen (M)"
        >
          <div className="w-5 h-1.5 bg-current rounded-sm" />
          <span className="text-[9px] font-medium leading-none mt-1">Muur</span>
        </button>

        {/* Zone / Room */}
        <button
          onClick={() => setTool('zone')}
          className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center transition ${
            state.activeTool === 'zone'
              ? 'bg-amber-500 text-slate-950 font-bold shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Ruimte / Zone Tekenen (R)"
        >
          <Square className="w-5 h-5" />
          <span className="text-[9px] font-medium leading-none mt-0.5">Ruimte</span>
        </button>

        {/* Split Wall */}
        <button
          onClick={() => setTool('split_wall')}
          className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center transition ${
            state.activeTool === 'split_wall'
              ? 'bg-amber-500 text-slate-950 font-bold shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Muur Splitsen (Knip een muur in tweeën op klikpunt of haakse snap)"
        >
          <Split className="w-5 h-5" />
          <span className="text-[8px] font-medium leading-none mt-0.5">Splits Muur</span>
        </button>

        {/* Split / Cut Zone */}
        <button
          onClick={() => setTool('cut_zone')}
          className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center transition ${
            state.activeTool === 'cut_zone'
              ? 'bg-amber-500 text-slate-950 font-bold shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Ruimte / Zone Splitsen (Trek een snijlijn door een vloerzone)"
        >
          <Scissors className="w-5 h-5" />
          <span className="text-[8px] font-medium leading-none mt-0.5">Splits Zone</span>
        </button>

        <div className="w-8 h-[1px] bg-slate-800 my-0.5" />

        {/* Door */}
        <button
          onClick={() => setTool('door')}
          className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center transition ${
            state.activeTool === 'door'
              ? 'bg-amber-500 text-slate-950 font-bold shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Deur Plaatsen"
        >
          <DoorOpen className="w-5 h-5" />
          <span className="text-[9px] font-medium leading-none mt-0.5">Deur</span>
        </button>

        {/* Window */}
        <button
          onClick={() => setTool('window')}
          className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center transition ${
            state.activeTool === 'window'
              ? 'bg-amber-500 text-slate-950 font-bold shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Raam Plaatsen"
        >
          <AppWindow className="w-5 h-5" />
          <span className="text-[9px] font-medium leading-none mt-0.5">Raam</span>
        </button>

        {/* Meubels & Sanitair Selector (Bed, Inloopdouche, WC, Bad, Wasbak, Bureau) */}
        <div className="relative">
          <button
            onClick={() => {
              if (state.activeTool === 'furniture' || state.activeTool === 'bed') {
                setShowFurnitureMenu((prev) => !prev);
              } else {
                setShowFurnitureMenu(true);
                setState((prev) => ({
                  ...prev,
                  activeTool: 'furniture',
                  activeFurnitureType: prev.activeFurnitureType || 'bed',
                }));
              }
            }}
            className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center transition relative ${
              state.activeTool === 'furniture' || state.activeTool === 'bed'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Meubels & Sanitair Plaatsen (Bed, Inloopdouche, WC, Bad, Wasbak, Bureau)"
          >
            {(() => {
              const fType = state.activeFurnitureType || 'bed';
              if (fType === 'shower') return <ShowerHead className="w-5 h-5" />;
              if (fType === 'toilet') return <CircleDot className="w-5 h-5" />;
              if (fType === 'bath') return <Bath className="w-5 h-5" />;
              if (fType === 'sink') return <Droplets className="w-5 h-5" />;
              if (fType === 'desk') return <Laptop className="w-5 h-5" />;
              return <BedDouble className="w-5 h-5" />;
            })()}
            <span className="text-[9px] font-medium leading-none mt-0.5">Meubels</span>
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full border border-slate-900" />
          </button>

          {/* Flyout Menu for Furniture selection */}
          {showFurnitureMenu && (
            <div
              className="fixed left-20 top-24 z-50 w-72 bg-slate-900/98 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl p-3 select-none animate-in fade-in slide-in-from-left-2 duration-150"
              style={{ boxShadow: '0 20px 40px -15px rgba(0,0,0,0.8)' }}
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <Armchair className="w-4 h-4" />
                  <span>Meubels & Sanitair</span>
                </div>
                <button
                  onClick={() => setShowFurnitureMenu(false)}
                  className="text-slate-500 hover:text-slate-300 p-0.5 rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-[11px] text-slate-400 mb-2.5">
                Kies een object om op de plattegrond te plaatsen. De maten kunnen direct worden aangepast:
              </p>

              <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-0.5">
                {FURNITURE_TYPES_LIST.map((type) => {
                  const def = FURNITURE_DEFINITIONS[type];
                  const isActive =
                    (state.activeTool === 'furniture' || state.activeTool === 'bed') &&
                    (state.activeFurnitureType || 'bed') === type;

                  return (
                    <button
                      key={type}
                      onClick={() => {
                        setState((prev) => ({
                          ...prev,
                          activeTool: 'furniture',
                          activeFurnitureType: type,
                        }));
                        setShowFurnitureMenu(false);
                      }}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition border ${
                        isActive
                          ? 'bg-amber-500/15 border-amber-500/60 text-amber-200'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 text-slate-300'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                          isActive
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                            : 'bg-slate-900 border-slate-700/60 text-slate-400'
                        }`}
                      >
                        {type === 'bed' && <BedDouble className="w-4 h-4" />}
                        {type === 'shower' && <ShowerHead className="w-4 h-4" />}
                        {type === 'toilet' && <CircleDot className="w-4 h-4" />}
                        {type === 'bath' && <Bath className="w-4 h-4" />}
                        {type === 'sink' && <Droplets className="w-4 h-4" />}
                        {type === 'desk' && <Laptop className="w-4 h-4" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold truncate text-slate-100">{def.name}</span>
                          <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0 ml-1">
                            {Math.round(def.defaultWidthMeters * 100)} × {Math.round(def.defaultLengthMeters * 100)} cm
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{def.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="w-8 h-[1px] bg-slate-800 my-0.5" />

        {/* Background Image Upload / Position */}
        <input
          type="file"
          ref={bgFileInputRef}
          onChange={handleBgFileSelect}
          accept="image/*"
          className="hidden"
        />
        <button
          onClick={() => {
            if (state.backgrounds.length === 0) {
              bgFileInputRef.current?.click();
            } else {
              setTool('bg_move');
            }
          }}
          className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center transition ${
            state.activeTool === 'bg_move'
              ? 'bg-amber-500 text-slate-950 font-bold shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Achtergrond Plattegrond Uploaden of Verplaatsen"
        >
          <ImageIcon className="w-5 h-5" />
          <span className="text-[9px] font-medium leading-none mt-0.5">Plattegrond</span>
        </button>

        {/* Eraser */}
        <button
          onClick={() => setTool('eraser')}
          className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center transition ${
            state.activeTool === 'eraser'
              ? 'bg-rose-500 text-white font-bold shadow'
              : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'
          }`}
          title="Verwijderen (Klik op element om te wissselen)"
        >
          <Eraser className="w-5 h-5" />
          <span className="text-[9px] font-medium leading-none mt-0.5">Wissen</span>
        </button>
      </div>

      {/* Wall Type Submenu when Wall Tool is active */}
      {state.activeTool === 'wall' && (
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-2.5 shadow-xl flex flex-col gap-2 w-52">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 px-1">
            Type & Dikte van Muur:
          </span>
          {(['Binnenmuur', 'Buitengevel', 'Scheidingswand'] as WallType[]).map((type) => (
            <div key={type} className="flex items-center justify-between gap-1">
              <button
                onClick={() => setWallType(type)}
                className={`flex-1 text-left px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                  state.wallTypeToDraw === type
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {type}
              </button>
              <div className="flex items-center gap-1 bg-slate-950 px-1.5 py-1 rounded-lg border border-slate-800">
                <input
                  type="number"
                  min="2"
                  max="100"
                  value={state.wallTypeThicknesses[type] || 12}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value));
                    setState((prev) => ({
                      ...prev,
                      wallTypeThicknesses: {
                        ...prev.wallTypeThicknesses,
                        [type]: val,
                      },
                      walls: prev.walls.map((w) =>
                        w.type === type ? { ...w, thicknessPx: val } : w
                      ),
                    }));
                  }}
                  className="w-9 text-center text-xs font-bold text-amber-400 bg-transparent outline-none"
                  title="Muurdikte in pixels"
                />
                <span className="text-[10px] text-slate-500 font-mono">px</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawing Toggles & View Controls */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-1.5 shadow-xl flex flex-col gap-1 w-14 items-center">
        {/* Ortho Snap */}
        <button
          onClick={toggleOrtho}
          className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center transition ${
            state.orthoSnap
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
          }`}
          title="Orthogonaal Vergrendelen (Haaks 90°)"
        >
          <Compass className="w-5 h-5" />
          <span className="text-[8px] font-medium leading-none mt-0.5">Haaks</span>
        </button>

        {/* Magnetic Snap Button & Settings */}
        <div className="relative flex flex-col items-center">
          <div className="flex items-center gap-0.5">
            <button
              onClick={toggleMagnetic}
              className={`w-9 h-11 rounded-l-xl flex flex-col items-center justify-center transition ${
                state.magneticSnap
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
              title="Magneet Snapping In/Uitschakelen"
            >
              <Magnet className="w-4 h-4" />
              <span className="text-[8px] font-medium leading-none mt-0.5">Snap</span>
            </button>
            <button
              onClick={() => setShowSnapSettings(!showSnapSettings)}
              className={`w-4 h-11 rounded-r-xl flex items-center justify-center transition border-y border-r ${
                showSnapSettings || state.magneticSnap
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800 border-slate-800'
              }`}
              title="Snap Gevoeligheid & Bereik Instellen"
            >
              <Sliders className="w-3 h-3" />
            </button>
          </div>

          {/* Snap Settings Popout Menu */}
          {showSnapSettings && (
            <div className="absolute left-14 top-0 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-3 shadow-2xl z-50 w-60 text-slate-200">
              <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Magnet className="w-3.5 h-3.5" /> Magneet Snap Instellingen
                </span>
                <button
                  onClick={() => setShowSnapSettings(false)}
                  className="text-slate-400 hover:text-slate-200 text-xs px-1"
                >
                  ✕
                </button>
              </div>

              {/* Threshold Slider */}
              <div className="mb-3">
                <div className="flex justify-between items-center text-[11px] mb-1">
                  <span className="text-slate-300 font-medium">Lijn Donkerheid:</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {state.snapDarknessThreshold ?? 140}
                  </span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="220"
                  step="5"
                  value={state.snapDarknessThreshold ?? 140}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setState((prev) => ({ ...prev, snapDarknessThreshold: val }));
                  }}
                  className="w-full accent-amber-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                  <span>Enkel diep zwart (40)</span>
                  <span>Ook lichtgrijs (220)</span>
                </div>
              </div>

              {/* Radius Slider */}
              <div>
                <div className="flex justify-between items-center text-[11px] mb-1">
                  <span className="text-slate-300 font-medium">Zoekbereik (Bereik):</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {state.snapSearchRadius ?? 60}px
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="150"
                  step="5"
                  value={state.snapSearchRadius ?? 60}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setState((prev) => ({ ...prev, snapSearchRadius: val }));
                  }}
                  className="w-full accent-amber-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                  <span>Dichtbij (20px)</span>
                  <span>Ver weg (150px)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Grid Toggle */}
        <button
          onClick={toggleGrid}
          className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center transition ${
            state.gridVisible
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
          }`}
          title="Raster Toon/Verberg"
        >
          <Grid className="w-5 h-5" />
          <span className="text-[8px] font-medium leading-none mt-0.5">Raster</span>
        </button>

        {/* Quick 3D View Button */}
        <button
          onClick={() => setState((prev) => ({ ...prev, activeTab: '3d' }))}
          className="w-11 h-11 rounded-xl flex flex-col items-center justify-center transition bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm"
          title="Schakel direct naar 3D Weergave"
        >
          <Box className="w-5 h-5 text-amber-400" />
          <span className="text-[8px] font-bold leading-none mt-0.5">3D View</span>
        </button>

        <div className="w-8 h-[1px] bg-slate-800 my-0.5" />

        {/* Zoom In */}
        <button
          onClick={() => handleZoom(0.1)}
          className="w-11 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          title="Inzoomen"
        >
          <Plus className="w-4 h-4" />
        </button>

        <span className="text-[9px] font-mono text-slate-400 font-bold">
          {Math.round(state.view.zoom * 100)}%
        </span>

        {/* Zoom Out */}
        <button
          onClick={() => handleZoom(-0.1)}
          className="w-11 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          title="Uitzoomen"
        >
          <Minus className="w-4 h-4" />
        </button>

        {/* Reset View */}
        <button
          onClick={resetView}
          className="w-11 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-amber-400 hover:bg-slate-800 transition"
          title="Herstel Weergave & Zoom"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
