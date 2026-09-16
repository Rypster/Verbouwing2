export type Point = {
  x: number;
  y: number;
};

export type WallType = 'Binnenmuur' | 'Buitengevel' | 'Scheidingswand';

export type OpeningType = 'Door' | 'Window';

export interface Opening {
  id: string;
  wallId: string;
  type: OpeningType;
  label: string;
  offsetRatio: number; // 0 to 1 along wall segment
  widthMeters: number;
  heightMeters: number;
  flipSide: boolean;
  flipHand: boolean;
  isLocked?: boolean;
  jobs: string[];
}

export interface Wall {
  id: string;
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: WallType;
  thicknessPx: number;
  heightMeters: number;
  openings: string[]; // opening IDs
  jobs: string[];     // job IDs
  color?: string;
  notes?: string;
}

export interface Zone {
  id: string;
  label: string;
  points: Point[];
  color: string;
  opacity: number;
  jobs: string[];
  notes?: string;
  /** Label position offset from polygon centroid (world px) */
  labelOffset?: Point;
}

export interface BackgroundImage {
  id: string;
  label: string;
  url: string;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  locked: boolean;
  width?: number;
  height?: number;
  naturalWidth?: number;
  naturalHeight?: number;
}

export type JobCategory =
  | '🍃 ISDE Dak- of zolderisolatie'
  | '🍃 ISDE Gevelisolatie'
  | '🍃 ISDE Spouwmuurisolatie'
  | '🍃 ISDE Vloer- of bodemisolatie'
  | '🍃 ISDE HR++ / Triple Glas & Deuren'
  | '🍃 ISDE (Hybride) Warmtepomp'
  | '🍃 ISDE Zonneboiler'
  | '🍃 ISDE Warmtenetaansluiting'
  | '🍃 ISDE Ventilatiesysteem'
  | '🍃 ISDE Elektrische Kookvoorziening'
  | '🔨 Stucen & Afwerking'
  | '🎨 Schilderwerk'
  | '⚡ Elektra & Verlichting'
  | '🚰 Loodgieter & Sanitair'
  | '🧹 Sloop- & Voorbereidingswerk'
  | '🧱 Metsel- & Tegelwerk'
  | '🪵 Timmerwerk & Afwerking'
  | '📦 Vloer leggen & Afwerking'
  | '🛠️ Diversen'
  | string;

export type CostModel = 'fixed' | 'per_m2' | 'per_m1' | 'per_piece';

export type JobStatus = 'todo' | 'in_progress' | 'done';

export interface RenovationJob {
  id: string;
  title: string;
  category: JobCategory;
  color: string;
  costModel: CostModel;
  unitPrice: number;   // Price for m2, m1, or piece
  fixedPrice: number;  // Fixed total cost
  assignedItemIds: string[];
  status: JobStatus;
  notes?: string;
}

export type ToolMode =
  | 'select'
  | 'wall'
  | 'split_wall'
  | 'zone'
  | 'cut_zone'
  | 'door'
  | 'window'
  | 'bed'
  | 'furniture'
  | 'bg_move'
  | 'eraser'
  | 'calibrate';

export type FurnitureType = 'bed' | 'shower' | 'toilet' | 'bath' | 'sink' | 'desk';

export interface FurnitureItem {
  id: string;
  type: FurnitureType;
  label: string;
  x: number; // world x (center)
  y: number; // world y (center)
  rotation: number; // degrees (0, 90, 180, 270)
  widthMeters: number; // in meters (e.g. 1.80)
  lengthMeters: number; // in meters (e.g. 2.10)
  isLocked?: boolean;
  color?: string;
  notes?: string;
}

export type ActiveTab = 'build' | 'general' | '3d';

export interface PlannerState {
  projectId: string;
  projectName: string;
  scalePxPerMeter: number; // default 50px = 1m
  view: {
    pan: Point;
    zoom: number;
  };
  wallCounter: number;
  zoneCounter: number;
  bgCounter: number;
  openingCounter: number;
  jobCounter: number;
  furnitureCounter: number;
  walls: Wall[];
  zones: Zone[];
  openings: Opening[];
  backgrounds: BackgroundImage[];
  jobs: RenovationJob[];
  furniture: FurnitureItem[];
  selectedItemIds: string[];
  activeTool: ToolMode;
  activeFurnitureType?: FurnitureType;
  activeTab: ActiveTab;
  wallTypeToDraw: WallType;
  wallTypeThicknesses: Record<WallType, number>;
  gridVisible: boolean;
  orthoSnap: boolean;
  magneticSnap: boolean;
  snapDarknessThreshold: number; // 0-255 (brightness cutoff)
  snapSearchRadius: number; // search distance in canvas pixels
}
