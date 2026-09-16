import { FurnitureType } from '../types';

export interface FurniturePreset {
  label: string;
  widthCm: number;
  lengthCm: number;
}

export interface FurnitureDefinition {
  type: FurnitureType;
  name: string;
  category: 'Slapen & Wonen' | 'Sanitair';
  defaultWidthMeters: number; // e.g. 1.80
  defaultLengthMeters: number; // e.g. 2.10
  minWidthMeters: number;
  maxWidthMeters: number;
  minLengthMeters: number;
  maxLengthMeters: number;
  description: string;
  presets: FurniturePreset[];
}

export const FURNITURE_DEFINITIONS: Record<FurnitureType, FurnitureDefinition> = {
  bed: {
    type: 'bed',
    name: 'Bed',
    category: 'Slapen & Wonen',
    defaultWidthMeters: 1.80,
    defaultLengthMeters: 2.10,
    minWidthMeters: 0.70,
    maxWidthMeters: 2.60,
    minLengthMeters: 1.50,
    maxLengthMeters: 2.50,
    description: 'Tweepersoons- of eenpersoonsbed met hoofdbord en kussens',
    presets: [
      { label: '1-persoons (90×200 cm)', widthCm: 90, lengthCm: 200 },
      { label: 'Twijfelaar (140×200 cm)', widthCm: 140, lengthCm: 200 },
      { label: 'Queen (160×200 cm)', widthCm: 160, lengthCm: 200 },
      { label: 'King (180×200 cm)', widthCm: 180, lengthCm: 200 },
      { label: 'Standaard (180×210 cm)', widthCm: 180, lengthCm: 210 },
      { label: 'Extra lang (200×220 cm)', widthCm: 200, lengthCm: 220 },
    ],
  },
  shower: {
    type: 'shower',
    name: 'Inloopdouche',
    category: 'Sanitair',
    defaultWidthMeters: 0.90,
    defaultLengthMeters: 1.20,
    minWidthMeters: 0.70,
    maxWidthMeters: 2.00,
    minLengthMeters: 0.70,
    maxLengthMeters: 2.50,
    description: 'Inloopdouche met glazen wand, regendouche en drain',
    presets: [
      { label: 'Compact (90×90 cm)', widthCm: 90, lengthCm: 90 },
      { label: 'Standaard (90×120 cm)', widthCm: 90, lengthCm: 120 },
      { label: 'Ruim (100×120 cm)', widthCm: 100, lengthCm: 120 },
      { label: 'Luxe (100×140 cm)', widthCm: 100, lengthCm: 140 },
      { label: 'Lang (90×160 cm)', widthCm: 90, lengthCm: 160 },
    ],
  },
  toilet: {
    type: 'toilet',
    name: 'WC',
    category: 'Sanitair',
    defaultWidthMeters: 0.40,
    defaultLengthMeters: 0.55,
    minWidthMeters: 0.35,
    maxWidthMeters: 0.60,
    minLengthMeters: 0.45,
    maxLengthMeters: 0.80,
    description: 'Wandcloset / hangtoilet met inbouwreservoir en bedieningsplaat',
    presets: [
      { label: 'Compact (36×48 cm)', widthCm: 36, lengthCm: 48 },
      { label: 'Standaard (40×55 cm)', widthCm: 40, lengthCm: 55 },
      { label: 'Comfort (40×60 cm)', widthCm: 40, lengthCm: 60 },
      { label: 'Inclusief ombouw (50×70 cm)', widthCm: 50, lengthCm: 70 },
    ],
  },
  bath: {
    type: 'bath',
    name: 'Bad',
    category: 'Sanitair',
    defaultWidthMeters: 0.80,
    defaultLengthMeters: 1.80,
    minWidthMeters: 0.65,
    maxWidthMeters: 1.40,
    minLengthMeters: 1.20,
    maxLengthMeters: 2.20,
    description: 'Inbouw- of vrijstaand ligbad met kraan en overloop',
    presets: [
      { label: 'Compact (70×160 cm)', widthCm: 70, lengthCm: 160 },
      { label: 'Standaard (75×170 cm)', widthCm: 75, lengthCm: 170 },
      { label: 'Ruim (80×180 cm)', widthCm: 80, lengthCm: 180 },
      { label: 'Groot (90×190 cm)', widthCm: 90, lengthCm: 190 },
      { label: 'Vrijstaand ovaal (85×180 cm)', widthCm: 85, lengthCm: 180 },
    ],
  },
  sink: {
    type: 'sink',
    name: 'Wasbak',
    category: 'Sanitair',
    defaultWidthMeters: 0.80,
    defaultLengthMeters: 0.50,
    minWidthMeters: 0.30,
    maxWidthMeters: 2.20,
    minLengthMeters: 0.20,
    maxLengthMeters: 0.75,
    description: 'Wastafelmeubel of waskom met mengkraan en afvoer',
    presets: [
      { label: 'Toiletfontein (40×25 cm)', widthCm: 40, lengthCm: 25 },
      { label: 'Compact (60×45 cm)', widthCm: 60, lengthCm: 45 },
      { label: 'Standaard (80×50 cm)', widthCm: 80, lengthCm: 50 },
      { label: 'Breed (100×50 cm)', widthCm: 100, lengthCm: 50 },
      { label: 'Dubbele wasbak (120×50 cm)', widthCm: 120, lengthCm: 50 },
      { label: 'Luxe dubbel (140×50 cm)', widthCm: 140, lengthCm: 50 },
    ],
  },
  desk: {
    type: 'desk',
    name: 'Bureau',
    category: 'Slapen & Wonen',
    defaultWidthMeters: 1.60,
    defaultLengthMeters: 0.80,
    minWidthMeters: 0.80,
    maxWidthMeters: 2.80,
    minLengthMeters: 0.50,
    maxLengthMeters: 1.20,
    description: 'Werkplek / bureau met bureaustoel en laptop/scherm zone',
    presets: [
      { label: 'Compact (120×60 cm)', widthCm: 120, lengthCm: 60 },
      { label: 'Standaard (140×70 cm)', widthCm: 140, lengthCm: 70 },
      { label: 'Ruim (160×80 cm)', widthCm: 160, lengthCm: 80 },
      { label: 'Groot (180×80 cm)', widthCm: 180, lengthCm: 80 },
      { label: 'Directie (200×90 cm)', widthCm: 200, lengthCm: 90 },
    ],
  },
};

export const FURNITURE_TYPES_LIST: FurnitureType[] = [
  'bed',
  'shower',
  'toilet',
  'bath',
  'sink',
  'desk',
];
