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

// Local write happens immediately (cheap, synchronous). The remote sync to
// /api/projects is debounced so that fast interactive edits (dragging a
// wall, resizing, typing) don't each open a fresh DB round-trip — only the
// state after a short pause of inactivity gets pushed to Neon.
const SYNC_DEBOUNCE_MS = 800;
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRemoteSync(id: string, name: string, data: unknown) {
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, data }),
    }).catch(() => {
      // Ignore API background sync error (silent local fallback)
    });
  }, SYNC_DEBOUNCE_MS);
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
    scheduleRemoteSync(state.projectId, state.projectName, toSave);
  } catch (err) {
    console.error('Failed to save state:', err);
  }
}

// Flush any pending debounced sync immediately — call this on page unload
// (e.g. window.addEventListener('beforeunload', flushPendingSync)) so a
// change made right before closing the tab isn't lost to the debounce delay.
export function flushPendingSync(state: PlannerState) {
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = null;
  }
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
  const payload = JSON.stringify({ id: state.projectId, name: state.projectName, data: toSave });
  // sendBeacon survives page unload, unlike a normal fetch
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/projects', new Blob([payload], { type: 'application/json' }));
  } else {
    fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
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

export type ProjectSummary = {
  id: string;
  name: string;
  updated_at: string;
};

export type ListProjectsResult =
  | { ok: true; projects: ProjectSummary[] }
  | { ok: false };

export async function listProjects(): Promise<ListProjectsResult> {
  try {
    const res = await fetch('/api/projects');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.projects)) {
        return { ok: true, projects: json.projects };
      }
    }
  } catch {
    // fall through to failure result below
  }
  return { ok: false };
}

export async function createNewProject(name = 'Nieuw Project'): Promise<PlannerState | null> {
  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.project?.data) {
        return {
          ...INITIAL_STATE,
          ...json.project.data,
          projectId: json.project.id,
          projectName: json.project.name || name,
          activeTab: 'general',
          selectedItemIds: [],
        };
      }
    }
  } catch {
    // silent
  }
  return null;
}

export async function deleteProject(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/projects?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function openProject(id: string): Promise<PlannerState | null> {
  try {
    const res = await fetch(`/api/projects?id=${encodeURIComponent(id)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.project?.data) {
        return {
          ...INITIAL_STATE,
          ...json.project.data,
          projectId: json.project.id || id,
          projectName: json.project.name || json.project.data.projectName || 'Mijn Verbouwing',
          activeTab: 'general',
          selectedItemIds: [],
        };
      }
    }
  } catch {
    // silent
  }
  return null;
}