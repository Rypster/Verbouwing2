import React, { useState, useEffect } from 'react';
import { PlannerState, BackgroundImage } from './types';
import { loadSavedState, saveStateToStorage, INITIAL_STATE, exportProjectToJson, fetchRemoteState } from './utils/storage';
import { Navbar } from './components/Navbar';
import { Toolbar } from './components/Toolbar';
import { PlannerCanvas } from './components/PlannerCanvas';
import { InspectorPanel } from './components/InspectorPanel';
import { GeneralTab } from './components/GeneralTab';

export default function App() {
  const [state, setState] = useState<PlannerState>(() => loadSavedState());

  // Check remote Neon DB on mount for latest saved data
  useEffect(() => {
    let active = true;
    fetchRemoteState(state.projectId).then((remoteData) => {
      if (active && remoteData) {
        setState((prev) => ({
          ...prev,
          ...remoteData,
        }));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Debounced auto-save state to local storage and backend API
  useEffect(() => {
    const timer = setTimeout(() => {
      saveStateToStorage(state);
    }, 400);

    return () => clearTimeout(timer);
  }, [state]);

  // Handle uploading blueprint background image
  const handleUploadBackground = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const dataUrl = e.target.result as string;
        const img = new Image();
        img.onload = () => {
          const naturalW = img.naturalWidth || 800;
          const naturalH = img.naturalHeight || 600;
          const width = 800;
          const height = Math.round(width * (naturalH / naturalW));

          const newBgCounter = state.bgCounter + 1;
          const newBg: BackgroundImage = {
            id: `bg_${newBgCounter}`,
            label: `Plattegrond ${newBgCounter}`,
            url: dataUrl,
            x: 100,
            y: 100,
            scale: 1,
            opacity: 0.9, // Default bright floorplan opacity
            locked: false,
            width,
            height,
            naturalWidth: naturalW,
            naturalHeight: naturalH,
          };

          setState((prev) => ({
            ...prev,
            bgCounter: newBgCounter,
            backgrounds: [...prev.backgrounds, newBg],
            activeTool: 'bg_move',
          }));
        };
        img.src = dataUrl;
      }
    };
    reader.readAsDataURL(file);
  };

  // Export JSON
  const handleExport = () => {
    exportProjectToJson(state);
  };

  // Import JSON
  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (e.target?.result) {
          const parsed = JSON.parse(e.target.result as string);
          setState({
            ...INITIAL_STATE,
            ...parsed,
          });
        }
      } catch (err) {
        alert('Ongeldig JSON bestand');
      }
    };
    reader.readAsText(file);
  };

  // Reset to Demo (Direct reset without blocking confirm dialog)
  const handleResetToDemo = () => {
    setState(INITIAL_STATE);
  };

  return (
    <div className="w-screen h-screen bg-slate-950 flex flex-col overflow-hidden font-sans select-none text-slate-100">
      {/* Top Navbar */}
      <Navbar
        state={state}
        setState={setState}
        onExport={handleExport}
        onImport={handleImport}
        onResetToDemo={handleResetToDemo}
      />

      {/* Main View Area */}
      {state.activeTab === 'build' ? (
        <main className="relative flex-1 w-full h-[calc(100vh-4rem)] overflow-hidden">
          {/* Drawing Tools Toolbar */}
          <Toolbar
            state={state}
            setState={setState}
            onUploadBackground={handleUploadBackground}
          />

          {/* Interactive Canvas */}
          <PlannerCanvas state={state} setState={setState} />

          {/* Contextual Properties Inspector */}
          <InspectorPanel state={state} setState={setState} />
        </main>
      ) : (
        <main className="flex-1 w-full h-[calc(100vh-4rem)] overflow-hidden">
          <GeneralTab state={state} setState={setState} />
        </main>
      )}
    </div>
  );
}
