import { PlannerState, RenovationJob, Wall, Zone, Opening } from '../types';

const STORAGE_KEY = 'verbouw_planner_project_v1';

export const DEFAULT_JOBS: RenovationJob[] = [];
export const INITIAL_WALLS: Wall[] = [];
export const INITIAL_OPENINGS: Opening[] = [];
export const INITIAL_ZONES: Zone[] = [];

export const INITIAL_STATE: PlannerState = {
  projectId: 'proj_' + Math.random().toString(36).substr(2, 9),
  projectName: 'Mijn Verbouwing',
  scalePxPerMeter: 50, // 50 pixels = 1 meter
  view: {
    pan: { x: 80, y: 60 },
    zoom: 1,
  },
  wallCounter: 0,
  zoneCounter: 0,
  bgCounter: 0,
  openingCounter: 0,
  jobCounter: 0,
  walls: [],
  zones: [],
  openings: [],
  backgrounds: [],
  jobs: [],
  selectedItemIds: [],
  activeTool: 'select',
  activeTab: 'general',
  wallTypeToDraw: 'Binnenmuur',
  wallTypeThicknesses: {
    Binnenmuur: 10,
    Buitengevel: 18,
    Scheidingswand: 8,
  },
  gridVisible: true,
  orthoSnap: true,
  magneticSnap: true,
  snapDarknessThreshold: 50,
  snapSearchRadius: 25,
};

export function loadSavedState(): PlannerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...INITIAL_STATE,
        ...parsed,
        activeTab: 'general', // Always open 'general' tab first when launching app
        walls: parsed.walls || [],
        zones: parsed.zones || [],
        openings: parsed.openings || [],
        jobs: parsed.jobs || [],
        backgrounds: parsed.backgrounds || [],
        wallTypeThicknesses: {
          ...INITIAL_STATE.wallTypeThicknesses,
          ...(parsed.wallTypeThicknesses || {}),
        },
        selectedItemIds: [],
      };
    }
  } catch (err) {
    console.error('Failed to load local saved state:', err);
  }
  return {
    ...INITIAL_STATE,
    activeTab: 'general',
  };
}

export function saveStateToStorage(state: PlannerState) {
  try {
    const toSave = {
      projectId: state.projectId,
      projectName: state.projectName,
      scalePxPerMeter: state.scalePxPerMeter,
      wallCounter: state.wallCounter,
      zoneCounter: state.zoneCounter,
      bgCounter: state.bgCounter,
      openingCounter: state.openingCounter,
      jobCounter: state.jobCounter,
      walls: state.walls,
      zones: state.zones,
      openings: state.openings,
      backgrounds: state.backgrounds,
      jobs: state.jobs,
      view: state.view,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));

    // Also attempt background sync to API route if possible
    fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: state.projectId,
        name: state.projectName,
        data: toSave,
      }),
    }).catch(() => {
      // Ignore API background sync error (silent local fallback)
    });
  } catch (err) {
    console.error('Failed to save state:', err);
  }
}

export async function fetchRemoteState(projectId: string): Promise<Partial<PlannerState> | null> {
  try {
    const res = await fetch(`/api/projects?id=${encodeURIComponent(projectId)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.project?.data) {
        return json.project.data;
      }
    }
  } catch {
    // Silent ignore if backend unavailable
  }
  return null;
}

export function exportProjectToJson(state: PlannerState) {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `${state.projectName.toLowerCase().replace(/\s+/g, '_')}_verbouwplan.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
