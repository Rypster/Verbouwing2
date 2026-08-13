import { Point, Wall, Zone, Opening, WallType, BackgroundImage } from '../types';
import { snapToFloorplanBlackLines } from './imageSnap';

// Basic geometry and math helpers

export function dist(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.hypot(dx, dy);
}

export function distToSegment(p: Point, v: Point, w: Point): { distance: number; projection: Point; ratio: number } {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (l2 === 0) return { distance: dist(p, v), projection: v, ratio: 0 };
  
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  
  const projection = {
    x: v.x + t * (w.x - v.x),
    y: v.y + t * (w.y - v.y),
  };
  
  return {
    distance: dist(p, projection),
    projection,
    ratio: t,
  };
}

export function lineSegmentIntersection(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): Point | null {
  const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  if (denom === 0) return null; // Parallel

  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
  const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    return {
      x: p1.x + ua * (p2.x - p1.x),
      y: p1.y + ua * (p2.y - p1.y),
    };
  }
  return null;
}

export function lineIntersectionInfinite(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  if (Math.abs(denom) < 1e-6) return null;

  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
  return {
    x: p1.x + ua * (p2.x - p1.x),
    y: p1.y + ua * (p2.y - p1.y),
  };
}

export function calculatePolygonArea(
  points: Point[],
  scalePxPerMeter: number = 50
): number {
  if (!points || points.length < 3) return 0;
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  area = Math.abs(area) / 2;
  const areaM2 = area / (scalePxPerMeter * scalePxPerMeter);
  return Math.round(areaM2 * 100) / 100;
}

export function getPolygonCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  if (points.length === 2) {
    return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  }

  let cx = 0;
  let cy = 0;
  let signedArea = 0;

  for (let i = 0; i < points.length; i++) {
    const x0 = points[i].x;
    const y0 = points[i].y;
    const i1 = (i + 1) % points.length;
    const x1 = points[i1].x;
    const y1 = points[i1].y;
    const a = x0 * y1 - x1 * y0;
    signedArea += a;
    cx += (x0 + x1) * a;
    cy += (y0 + y1) * a;
  }

  signedArea *= 0.5;
  if (Math.abs(signedArea) < 1e-5) {
    let sumX = 0;
    let sumY = 0;
    for (const p of points) {
      sumX += p.x;
      sumY += p.y;
    }
    return { x: sumX / points.length, y: sumY / points.length };
  }

  cx /= 6 * signedArea;
  cy /= 6 * signedArea;
  return { x: cx, y: cy };
}

export function pointInPoly(p: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function weldContourPoints(points: Point[], weldDistPx: number = 15): Point[] {
  if (points.length < 3) return points;
  const cleaned: Point[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const last = cleaned[cleaned.length - 1];
    if (Math.hypot(points[i].x - last.x, points[i].y - last.y) >= weldDistPx) {
      cleaned.push(points[i]);
    }
  }

  if (cleaned.length > 2) {
    const first = cleaned[0];
    const last = cleaned[cleaned.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < weldDistPx) {
      cleaned.pop();
    }
  }
  return cleaned;
}

export function cleanCornerSpikes(points: Point[], minDistancePx: number = 15): Point[] {
  if (!points || points.length < 3) return points;

  const cleaned: Point[] = [];
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const current = points[i];
    const next = points[(i + 1) % n];
    const d = Math.hypot(next.x - current.x, next.y - current.y);

    if (d < minDistancePx) {
      cleaned.push({
        x: (current.x + next.x) / 2,
        y: (current.y + next.y) / 2,
      });
      i++; 
    } else {
      cleaned.push(current);
    }
  }

  return cleaned;
}

// Wall faces and snapping logic

export function getOuterWallFaces(
  wall: Wall,
  wallThicknesses: Record<WallType, number>,
  _scalePxPerMeter: number
): { line1: { p1: Point; p2: Point }; line2: { p1: Point; p2: Point } } {
  const thicknessPx = wall.thicknessPx || wallThicknesses[wall.type] || 12;
  const halfThick = thicknessPx / 2;

  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const len = Math.hypot(dx, dy);

  if (len < 1e-4) {
    const p = { x: wall.x1, y: wall.y1 };
    return { line1: { p1: p, p2: p }, line2: { p1: p, p2: p } };
  }

  const nx = -dy / len;
  const ny = dx / len;

  return {
    line1: {
      p1: { x: wall.x1 + nx * halfThick, y: wall.y1 + ny * halfThick },
      p2: { x: wall.x2 + nx * halfThick, y: wall.y2 + ny * halfThick },
    },
    line2: {
      p1: { x: wall.x1 - nx * halfThick, y: wall.y1 - ny * halfThick },
      p2: { x: wall.x2 - nx * halfThick, y: wall.y2 - ny * halfThick },
    },
  };
}

export function snapToOuterWallEdges(
  p: Point,
  _walls: Wall[],
  _wallThicknesses: Record<WallType, number>,
  _scalePxPerMeter: number,
  _snapRadiusPx = 25
): { snapped: boolean; point: Point } {
  // Deprecated: outer face snapping removed in favor of strict centerline snapping
  return { snapped: false, point: p };
}

export function snapToWallOuterEdges(
  p: Point,
  _walls: Wall[],
  _scalePxPerMeter: number,
  _wallThicknesses: Record<WallType, number>,
  _maxDistancePx = 25
): { point: Point; snapped: boolean; label?: string } {
  // Deprecated: outer face snapping removed in favor of strict centerline snapping
  return { point: p, snapped: false };
}

export function applyOrthoAndSnap(
  current: Point,
  prev: Point | null,
  walls: Wall[],
  orthoSnap: boolean,
  magneticSnap: boolean,
  snapRadiusPx = 20,
  backgrounds: BackgroundImage[] = [],
  snapDarknessThreshold = 50,
  snapSearchRadius = 25,
  drawingWallType?: WallType,
  isOpeningPlacement?: boolean,
  wallThicknesses: Record<WallType, number> = { Buitengevel: 18, Binnenmuur: 10, Scheidingswand: 8 },
  scalePxPerMeter = 50
): { point: Point; snapped: boolean; snapType?: 'endpoint' | 'midpoint' | 'perpendicular' | 'edge' | 'ortho' | 'image_line'; label?: string } {
  let p = { ...current };
  let isHoriz = false;

  if (orthoSnap && prev) {
    const dx = Math.abs(p.x - prev.x);
    const dy = Math.abs(p.y - prev.y);
    if (dx > dy) {
      p.y = prev.y;
      isHoriz = true;
    } else {
      p.x = prev.x;
      isHoriz = false;
    }
  }

  if (!magneticSnap) {
    return { point: p, snapped: false };
  }

  if (isOpeningPlacement) {
    let bestDist = snapRadiusPx + 15;
    let edgePoint: Point | null = null;
    for (const w of walls) {
      const v = { x: w.x1, y: w.y1 };
      const m = { x: w.x2, y: w.y2 };
      const res = distToSegment(p, v, m);
      if (res.distance < bestDist) {
        bestDist = res.distance;
        edgePoint = res.projection;
      }
    }
    if (edgePoint) {
      return { point: edgePoint, snapped: true, snapType: 'edge', label: 'MUUR' };
    }
    return { point: p, snapped: false };
  }

  if (orthoSnap && prev) {
    const rayTol = snapRadiusPx + 18;
    let bestFaceDist = rayTol;
    let bestFacePoint: Point | null = null;
    let bestFaceLabel: string | undefined = undefined;
    let bestCornerDist = rayTol;
    let bestCornerPoint: Point | null = null;

    const rayStart = isHoriz ? { x: prev.x - 3000, y: prev.y } : { x: prev.x, y: prev.y - 3000 };
    const rayEnd = isHoriz ? { x: prev.x + 3000, y: prev.y } : { x: prev.x, y: prev.y + 3000 };

    for (const w of walls) {
      const w1 = { x: w.x1, y: w.y1 };
      const w2 = { x: w.x2, y: w.y2 };
      const lenW = dist(w1, w2);
      if (lenW < 1e-4) continue;

      const EXT = 3000;
      const ux = (w2.x - w1.x) / lenW;
      const uy = (w2.y - w1.y) / lenW;
      const cand = {
        p1: { x: w1.x - ux * EXT, y: w1.y - uy * EXT },
        p2: { x: w2.x + ux * EXT, y: w2.y + uy * EXT },
        label: 'HAAKS OP MUUR',
      };

      const inter = lineSegmentIntersection(cand.p1, cand.p2, rayStart, rayEnd);
      if (inter) {
        const along = (inter.x - w1.x) * ux + (inter.y - w1.y) * uy;
        if (along >= -8 && along <= lenW + 8) {
          const d = dist(p, inter);
          if (d < bestFaceDist) {
            bestFaceDist = d;
            bestFacePoint = inter;
            bestFaceLabel = 'HAAKS OP MUUR';
          }
        }
      }

      for (const ep of [w1, w2]) {
        if (isHoriz) {
          if (Math.abs(ep.y - prev.y) < 14) {
            const projEp = { x: ep.x, y: prev.y };
            const d = dist(p, projEp);
            if (d < bestCornerDist) {
              bestCornerDist = d;
              bestCornerPoint = projEp;
            }
          }
        } else {
          if (Math.abs(ep.x - prev.x) < 14) {
            const projEp = { x: prev.x, y: ep.y };
            const d = dist(p, projEp);
            if (d < bestCornerDist) {
              bestCornerDist = d;
              bestCornerPoint = projEp;
            }
          }
        }
      }
    }

    if (bestFacePoint) {
      return { point: bestFacePoint, snapped: true, snapType: 'ortho', label: bestFaceLabel || 'HAAKS' };
    }
    if (bestCornerPoint) {
      return { point: bestCornerPoint, snapped: true, snapType: 'ortho', label: 'HAAKS HOEK' };
    }

    if (backgrounds.length > 0) {
      const imgSnap = snapToFloorplanBlackLines(current, prev, backgrounds, snapDarknessThreshold, snapSearchRadius);
      if (imgSnap && imgSnap.snapped) {
        const orthoImgPoint = isHoriz ? { x: imgSnap.point.x, y: prev.y } : { x: prev.x, y: imgSnap.point.y };
        return { point: orthoImgPoint, snapped: true, snapType: 'image_line', label: imgSnap.label };
      }
    }

    return { point: p, snapped: false };
  }

  let bestDist = snapRadiusPx;
  let snappedPoint: Point | null = null;
  let snapType: 'endpoint' | 'midpoint' | 'perpendicular' | 'edge' | 'ortho' | 'image_line' | undefined = undefined;
  let label: string | undefined = undefined;

  for (const w of walls) {
    const p1 = { x: w.x1, y: w.y1 };
    const p2 = { x: w.x2, y: w.y2 };

    if (dist(p, p1) < bestDist) {
      bestDist = dist(p, p1);
      snappedPoint = p1;
      snapType = 'endpoint';
      label = 'HOEK';
    }

    if (dist(p, p2) < bestDist) {
      bestDist = dist(p, p2);
      snappedPoint = p2;
      snapType = 'endpoint';
      label = 'HOEK';
    }
  }

  if (snappedPoint) {
    return { point: snappedPoint, snapped: true, snapType, label };
  }

  if (drawingWallType !== ('cut_zone' as any)) {
    for (const w of walls) {
      const mid = { x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2 };
      if (dist(p, mid) < snapRadiusPx + 4) {
        return { point: mid, snapped: true, snapType: 'midpoint', label: 'MIDDEN' };
      }
    }
  }

  if (prev) {
    for (const w of walls) {
      const projRes = distToSegment(prev, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
      if (projRes.ratio >= 0.02 && projRes.ratio <= 0.98) {
        if (dist(p, projRes.projection) < snapRadiusPx + 6) {
          return { point: projRes.projection, snapped: true, snapType: 'perpendicular', label: 'HAAKS' };
        }
      }
    }
  }

  for (const w of walls) {
    const res = distToSegment(p, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
    if (res.distance < snapRadiusPx) {
      return { point: res.projection, snapped: true, snapType: 'edge', label: 'MUUR' };
    }
  }

  if (backgrounds.length > 0) {
    const imgSnap = snapToFloorplanBlackLines(current, prev, backgrounds, snapDarknessThreshold, snapSearchRadius);
    if (imgSnap && imgSnap.snapped) {
      return { point: imgSnap.point, snapped: true, snapType: 'image_line', label: imgSnap.label };
    }
  }

  return { point: p, snapped: false };
}

// Wall metrics and clear span

export function getWallMetrics(
  wall: Wall,
  openings: Opening[],
  scalePxPerMeter: number,
  allWalls?: Wall[],
  wallThicknesses?: Record<WallType, number>
) {
  let lengthMeters: number;
  if (allWalls && wallThicknesses) {
    lengthMeters = getWallClearSpan(wall, allWalls, wallThicknesses, scalePxPerMeter).lengthMeters;
  } else {
    const wallPixelLen = dist({ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 });
    lengthMeters = wallPixelLen / scalePxPerMeter;
  }

  const grossAreaM2 = lengthMeters * wall.heightMeters;
  const wallOpenings = openings.filter((o) => wall.openings.includes(o.id));
  const openingsAreaM2 = wallOpenings.reduce((sum, o) => sum + o.widthMeters * o.heightMeters, 0);
  const netAreaM2 = Math.max(0, grossAreaM2 - openingsAreaM2);

  return { lengthMeters, grossAreaM2, openingsAreaM2, netAreaM2 };
}

export function getWallClearSpan(
  wall: Wall,
  allWalls: Wall[],
  wallThicknesses: Record<WallType, number>,
  scalePxPerMeter: number
): { lengthMeters: number; p0: Point; p1: Point; usedCorners: boolean } {
  const e0 = { x: wall.x1, y: wall.y1 };
  const e1 = { x: wall.x2, y: wall.y2 };
  const L = dist(e0, e1);
  if (L < 1e-4) {
    return { lengthMeters: 0, p0: e0, p1: e1, usedCorners: false };
  }

  const ux = (e1.x - e0.x) / L;
  const uy = (e1.y - e0.y) / L;
  const projectT = (p: Point) => (p.x - e0.x) * ux + (p.y - e0.y) * uy;

  const findConnectors = (end: Point): Wall[] => {
    const found: Wall[] = [];
    for (const c of allWalls) {
      if (c.id === wall.id) continue;
      const halfC = (c.thicknessPx || wallThicknesses[c.type] || 12) / 2;
      const tol = Math.max(14, halfC + 10);
      const d1 = dist(end, { x: c.x1, y: c.y1 });
      const d2 = dist(end, { x: c.x2, y: c.y2 });
      const seg = distToSegment(end, { x: c.x1, y: c.y1 }, { x: c.x2, y: c.y2 });
      if (d1 < tol || d2 < tol || seg.distance < tol) {
        found.push(c);
      }
    }
    return found;
  };

  const boundT = (end: Point, side: 'start' | 'end'): { t: number; found: boolean } => {
    const connectors = findConnectors(end);
    if (connectors.length === 0) {
      return { t: side === 'start' ? 0 : L, found: false };
    }

    const endTol = Math.max(14, (wall.thicknessPx || 12) / 2 + 8);
    type Ranked = { c: Wall; isT: boolean };
    const ranked: Ranked[] = [];

    for (const c of connectors) {
      const lenC = dist({ x: c.x1, y: c.y1 }, { x: c.x2, y: c.y2 }) || 1;
      const cux = (c.x2 - c.x1) / lenC;
      const cuy = (c.y2 - c.y1) / lenC;
      if (Math.abs(ux * cux + uy * cuy) > 0.85) continue; 

      const d1 = dist(end, { x: c.x1, y: c.y1 });
      const d2 = dist(end, { x: c.x2, y: c.y2 });
      const endsHere = d1 < endTol || d2 < endTol;
      const isT = endsHere && c.type !== wall.type;

      ranked.push({ c, isT });
    }

    if (ranked.length === 0) {
      return { t: side === 'start' ? 0 : L, found: false };
    }

    const hasT = ranked.some((r) => r.isT);
    const pool = hasT ? ranked.filter((r) => r.isT) : ranked;
    let bestT: number | null = null;

    for (const { c } of pool) {
      const faces = getOuterWallFaces(c, wallThicknesses, scalePxPerMeter);
      for (const face of [faces.line1, faces.line2]) {
        const samples: Point[] = [face.p1, face.p2, distToSegment(end, face.p1, face.p2).projection];
        for (const s of samples) {
          const t = projectT(s);
          if (side === 'start') {
            if (t >= -2 && t <= L * 0.65) {
              if (bestT === null || t > bestT) bestT = t;
            }
          } else {
            if (t <= L + 2 && t >= L * 0.35) {
              if (bestT === null || t < bestT) bestT = t;
            }
          }
        }
      }
    }

    if (bestT === null) return { t: side === 'start' ? 0 : L, found: false };
    return { t: Math.max(0, Math.min(L, bestT)), found: true };
  };

  const b0 = boundT(e0, 'start');
  const b1 = boundT(e1, 'end');

  let t0 = b0.t;
  let t1 = b1.t;
  if (t1 < t0) {
    t0 = 0;
    t1 = L;
  }

  const p0 = { x: e0.x + ux * t0, y: e0.y + uy * t0 };
  const p1 = { x: e0.x + ux * t1, y: e0.y + uy * t1 };

  return {
    lengthMeters: (t1 - t0) / scalePxPerMeter,
    p0,
    p1,
    usedCorners: b0.found || b1.found,
  };
}

// Berekent de vrije span (binnenmaat tussen muren) langs een kalibratielijn.
export function calculateCalibrationClearSpan(
  p1: Point,
  p2: Point,
  walls: Wall[],
  wallThicknesses: Record<string, number>
): {
  valid: boolean;
  clearSpanPx: number;
  innerP1: Point;
  innerP2: Point;
  errorMessage?: string;
} {
  const L = dist(p1, p2);
  if (L < 5) {
    return { valid: false, clearSpanPx: 0, innerP1: p1, innerP2: p2, errorMessage: 'De getrokken lijn is te kort.' };
  }

  const ux = (p2.x - p1.x) / L;
  const uy = (p2.y - p1.y) / L;

  // Zoek dichtstbijzijnde muur rondom einden van de lijn
  const findWallNear = (pt: Point) => {
    let bestW: Wall | null = null;
    let bestD = 35; // snap-drempel
    for (const w of walls) {
      const res = distToSegment(pt, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
      if (res.distance < bestD) {
        bestD = res.distance;
        bestW = w;
      }
    }
    return bestW;
  };

  const w1 = findWallNear(p1);
  const w2 = findWallNear(p2);

  let tStart = 0;
  let tEnd = 1;

  // Van p1 kant: verschuif van hartlijn naar binnenkant van w1
  if (w1) {
    const t1 = (w1.thicknessPx || (wallThicknesses && wallThicknesses[w1.type]) || 12) / 2;
    const w1dx = w1.x2 - w1.x1;
    const w1dy = w1.y2 - w1.y1;
    const w1len = Math.hypot(w1dx, w1dy) || 1;
    const w1ux = w1dx / w1len;
    const w1uy = w1dy / w1len;
    const sinAngle = Math.abs(ux * w1uy - uy * w1ux);
    const offsetPx = sinAngle > 0.15 ? t1 / sinAngle : t1;
    tStart = Math.max(tStart, offsetPx / L);
  }

  // Van p2 kant: verschuif van hartlijn naar binnenkant van w2
  if (w2) {
    const t2 = (w2.thicknessPx || (wallThicknesses && wallThicknesses[w2.type]) || 12) / 2;
    const w2dx = w2.x2 - w2.x1;
    const w2dy = w2.y2 - w2.y1;
    const w2len = Math.hypot(w2dx, w2dy) || 1;
    const w2ux = w2dx / w2len;
    const w2uy = w2dy / w2len;
    const sinAngle = Math.abs(ux * w2uy - uy * w2ux);
    const offsetPx = sinAngle > 0.15 ? t2 / sinAngle : t2;
    tEnd = Math.min(tEnd, 1 - offsetPx / L);
  }

  // Controleer ook snijpunten met muren/buitenranden langs het segment p1 -> p2
  for (const w of walls) {
    const faces = getOuterWallFaces(w, wallThicknesses as Record<WallType, number>, 1);
    for (const face of [faces.line1, faces.line2]) {
      const inter = lineSegmentIntersection(p1, p2, face.p1, face.p2);
      if (inter) {
        const t = ((inter.x - p1.x) * ux + (inter.y - p1.y) * uy) / L;
        if (t > 0 && t < 0.45) {
          if (t > tStart) tStart = t;
        } else if (t > 0.55 && t < 1) {
          if (t < tEnd) tEnd = t;
        }
      }
    }
  }

  const clearSpanPx = (tEnd - tStart) * L;

  // Als er noch een muur bij p1 noch bij p2 gevonden is én geen snijpunten
  if (!w1 && !w2 && tStart === 0 && tEnd === 1) {
    return {
      valid: false,
      clearSpanPx: 0,
      innerP1: p1,
      innerP2: p2,
      errorMessage: 'Geen muren gevonden op de gekozen kalibratielijn.',
    };
  }

  if (clearSpanPx <= 10 || tStart >= tEnd) {
    return {
      valid: false,
      clearSpanPx: 0,
      innerP1: p1,
      innerP2: p2,
      errorMessage: 'Kan geen geldige vrije span (binnenmaat) tussen de muren vinden.',
    };
  }

  const innerP1 = { x: p1.x + ux * (tStart * L), y: p1.y + uy * (tStart * L) };
  const innerP2 = { x: p1.x + ux * (tEnd * L), y: p1.y + uy * (tEnd * L) };

  return {
    valid: true,
    clearSpanPx,
    innerP1,
    innerP2,
  };
}

export function splitPolygonWithLine(polygon: Point[], cutStart: Point, cutEnd: Point): [Point[], Point[]] | null {
  if (!polygon || polygon.length < 3) return null;

  const dx = cutEnd.x - cutStart.x;
  const dy = cutEnd.y - cutStart.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return null;

  // Richtingsvector en normaalvector van de snijlijn
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;

  // Berekent de getekende afstand van een punt tot de oneindige snijlijn (cutStart -> cutEnd)
  const distToLine = (p: Point): number => {
    return (p.x - cutStart.x) * nx + (p.y - cutStart.y) * ny;
  };

  const EPS = 0.5; // Tolerantie in pixels voor punten op de lijn
  const n = polygon.length;
  const polyLeft: Point[] = [];
  const polyRight: Point[] = [];

  for (let i = 0; i < n; i++) {
    const pCurr = polygon[i];
    const pNext = polygon[(i + 1) % n];

    const dCurr = distToLine(pCurr);
    const dNext = distToLine(pNext);

    // Voeg het huidige punt toe aan links, rechts of beide (als het op de lijn ligt)
    if (dCurr >= -EPS) {
      polyLeft.push(pCurr);
    }
    if (dCurr <= EPS) {
      polyRight.push(pCurr);
    }

    // Controleer of de zijde (pCurr -> pNext) de lijn strikt kruist
    if ((dCurr > EPS && dNext < -EPS) || (dCurr < -EPS && dNext > EPS)) {
      const t = dCurr / (dCurr - dNext);
      const interPoint: Point = {
        x: pCurr.x + t * (pNext.x - pCurr.x),
        y: pCurr.y + t * (pNext.y - pCurr.y),
      };
      polyLeft.push(interPoint);
      polyRight.push(interPoint);
    }
  }

  // Verwijder opeenvolgende of overlappende dubbele punten
  const cleanPoly = (pts: Point[]): Point[] => {
    if (pts.length < 3) return [];
    const out: Point[] = [];
    for (const p of pts) {
      if (out.length === 0 || dist(out[out.length - 1], p) > 0.5) {
        out.push(p);
      }
    }
    if (out.length >= 2 && dist(out[0], out[out.length - 1]) < 0.5) {
      out.pop();
    }
    return out;
  };

  const cleanLeft = cleanPoly(polyLeft);
  const cleanRight = cleanPoly(polyRight);

  // Controleer of beide polygonen geldig zijn en een netto oppervlakte hebben
  const areaLeft = calculatePolygonArea(cleanLeft, 50);
  const areaRight = calculatePolygonArea(cleanRight, 50);

  if (cleanLeft.length >= 3 && cleanRight.length >= 3 && areaLeft > 0.05 && areaRight > 0.05) {
    return [cleanLeft, cleanRight];
  }

  return null;
}

// Room detection and zone net area

function closeSmallGaps(src: Uint8Array, cols: number, rows: number, r: number): Uint8Array {
  if (r <= 0) return src;

  const dilate = (input: Uint8Array): Uint8Array => {
    const out = new Uint8Array(cols * rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let hit = false;
        for (let dy = -r; dy <= r && !hit; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= rows) continue;
          for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx;
            if (nx >= 0 && nx < cols && input[ny * cols + nx]) {
              hit = true;
              break;
            }
          }
        }
        if (hit) out[y * cols + x] = 1;
      }
    }
    return out;
  };

  const erode = (input: Uint8Array): Uint8Array => {
    const out = new Uint8Array(cols * rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let solid = true;
        for (let dy = -r; dy <= r && solid; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= rows) { solid = false; break; }
          for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= cols || !input[ny * cols + nx]) {
              solid = false;
              break;
            }
          }
        }
        if (solid) out[y * cols + x] = 1;
      }
    }
    return out;
  };

  return erode(dilate(src));
}

function extractRoomContourFromCells(
  grid: Uint8Array,
  cols: number,
  rows: number,
  roomCells: Set<number>,
  minX: number,
  minY: number,
  CELL_SIZE: number,
  roomMark = 3
): Point[] | null {
  if (roomCells.size < 4) return null;

  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];

  const isRoom = (gx: number, gy: number): boolean => {
    if (gx < 0 || gx >= cols || gy < 0 || gy >= rows) return false;
    return grid[gy * cols + gx] === roomMark;
  };

  let startGX = -1;
  let startGY = -1;
  let startDir = 0;

  outer: for (const idx of roomCells) {
    const gx = idx % cols;
    const gy = Math.floor(idx / cols);
    for (let d = 0; d < 4; d++) {
      if (!isRoom(gx + DX[d], gy + DY[d])) {
        startGX = gx;
        startGY = gy;
        startDir = (d + 3) % 4;
        break outer;
      }
    }
  }
  if (startGX < 0) return null;

  const verts: Point[] = [];
  let gx = startGX;
  let gy = startGY;
  let dir = startDir;
  const maxSteps = roomCells.size * 6 + 64;
  let steps = 0;

  const seen = new Set<string>();

  do {
    const k = `${gx},${gy},${dir}`;
    if (seen.has(k)) break;
    seen.add(k);

    let cx: number, cy: number;
    switch (dir) {
      case 0: cx = gx + 1; cy = gy; break;
      case 1: cx = gx + 1; cy = gy + 1; break;
      case 2: cx = gx; cy = gy + 1; break;
      default: cx = gx; cy = gy; break;
    }

    verts.push({ x: minX + cx * CELL_SIZE, y: minY + cy * CELL_SIZE });

    let moved = false;
    for (const turn of [1, 0, 3, 2]) {
      const nd = (dir + turn) % 4;
      const nx = gx + DX[nd];
      const ny = gy + DY[nd];
      if (isRoom(nx, ny)) {
        gx = nx;
        gy = ny;
        dir = nd;
        moved = true;
        break;
      }
    }
    if (!moved) break;
    steps++;
  } while ((gx !== startGX || gy !== startGY || dir !== startDir) && steps < maxSteps);

  if (verts.length < 3) return null;

  const cleaned = weldContourPoints(verts, 3);
  if (cleaned.length < 3) return null;

  const finalPts: Point[] = [];
  const n = cleaned.length;

  for (let i = 0; i < n; i++) {
    const prev = cleaned[(i - 1 + n) % n];
    const curr = cleaned[i];
    const next = cleaned[(i + 1) % n];

    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;

    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);

    if (len1 < 1 || len2 < 1) continue;

    const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
    if (dot > 0.999) continue;

    finalPts.push(curr);
  }

  return finalPts.length >= 3 ? finalPts : null;
}


// Converteert grid-contour naar een schone polygoon op muurhartlijnen.
export function cleanRoomPolygonToCenterlines(
  contour: Point[],
  walls: Wall[]
): Point[] {
  if (!contour || contour.length < 3 || walls.length < 3) return contour || [];

  const n = contour.length;
  const matched: Wall[] = [];
  const used = new Set<string>();

  for (let i = 0; i < n; i++) {
    const pA = contour[i];
    const pB = contour[(i + 1) % n];
    const edgeLen = dist(pA, pB);
    if (edgeLen < 2) continue;

    const edgeUx = (pB.x - pA.x) / edgeLen;
    const edgeUy = (pB.y - pA.y) / edgeLen;
    const mid = { x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 };

    let best: Wall | null = null;
    let bestScore = 60;

    for (const w of walls) {
      if (used.has(w.id)) continue;
      const w1 = { x: w.x1, y: w.y1 };
      const w2 = { x: w.x2, y: w.y2 };
      const wLen = dist(w1, w2);
      if (wLen < 1e-4) continue;

      const wUx = (w2.x - w1.x) / wLen;
      const wUy = (w2.y - w1.y) / wLen;
      if (Math.abs(edgeUx * wUx + edgeUy * wUy) < 0.65) continue;

      const lineDist =
        Math.abs((w2.y - w1.y) * mid.x - (w2.x - w1.x) * mid.y + w2.x * w1.y - w2.y * w1.x) / wLen;

      const midRes = distToSegment(mid, w1, w2);
      if (midRes.distance > 80) continue;

      const score = lineDist + midRes.distance * 0.25;
      if (score < bestScore) {
        bestScore = score;
        best = w;
      }
    }

    if (best) {
      used.add(best.id);
      matched.push(best);
    }
  }

  if (matched.length < 3) {
    return cleanCornerSpikes(weldContourPoints(contour, 12), 12);
  }

  const corners: Point[] = [];
  const m = matched.length;
  for (let i = 0; i < m; i++) {
    const a = matched[(i - 1 + m) % m];
    const b = matched[i];
    const inter = lineIntersectionInfinite(
      { x: a.x1, y: a.y1 },
      { x: a.x2, y: a.y2 },
      { x: b.x1, y: b.y1 },
      { x: b.x2, y: b.y2 }
    );
    if (inter && Number.isFinite(inter.x) && Number.isFinite(inter.y)) {
      let near = false;
      for (const p of contour) {
        if (dist(inter, p) < 120) {
          near = true;
          break;
        }
      }
      if (near) corners.push(inter);
      else corners.push({ x: b.x1, y: b.y1 });
    } else {
      corners.push({ x: b.x1, y: b.y1 });
    }
  }

  const cleaned = weldContourPoints(corners, 6);
  if (cleaned.length < 3) {
    return cleanCornerSpikes(weldContourPoints(contour, 12), 12);
  }
  return cleaned;
}

export function detectEnclosedRooms(
  walls: Wall[],
  wallTypeThicknesses?: Record<string, number>
): Point[][] {
  if (walls.length < 3) return [];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const w of walls) {
    const thickness = w.thicknessPx || (wallTypeThicknesses && wallTypeThicknesses[w.type]) || 12;
    const margin = thickness / 2 + 4;
    minX = Math.min(minX, w.x1 - margin, w.x2 - margin);
    minY = Math.min(minY, w.y1 - margin, w.y2 - margin);
    maxX = Math.max(maxX, w.x1 + margin, w.x2 + margin);
    maxY = Math.max(maxY, w.y1 + margin, w.y2 + margin);
  }

  const MARGIN = 80;
  minX -= MARGIN; minY -= MARGIN;
  maxX += MARGIN; maxY += MARGIN;

  let CELL_SIZE = 1;
  const MAX_TOTAL_CELLS = 25_000_000;

  let cols = Math.ceil((maxX - minX) / CELL_SIZE);
  let rows = Math.ceil((maxY - minY) / CELL_SIZE);

  while (cols * rows > MAX_TOTAL_CELLS) {
    CELL_SIZE *= 2;
    cols = Math.ceil((maxX - minX) / CELL_SIZE);
    rows = Math.ceil((maxY - minY) / CELL_SIZE);
  }

  if (cols <= 0 || rows <= 0) return [];

  const grid = new Uint8Array(cols * rows);

  const toGridX = (x: number) => Math.floor((x - minX) / CELL_SIZE);
  const toGridY = (y: number) => Math.floor((y - minY) / CELL_SIZE);

  for (const w of walls) {
    const thickness = w.thicknessPx || (wallTypeThicknesses && wallTypeThicknesses[w.type]) || 12;
    const halfThick = thickness / 2;

    const dx = w.x2 - w.x1;
    const dy = w.y2 - w.y1;
    const len = Math.hypot(dx, dy);
    if (len < 1e-4) continue;

    const nx = (-dy / len) * halfThick;
    const ny = (dx / len) * halfThick;
    const capExtend = halfThick;
    const ux = (dx / len) * capExtend;
    const uy = (dy / len) * capExtend;

    const p1 = { x: w.x1 - ux + nx, y: w.y1 - uy + ny };
    const p2 = { x: w.x2 + ux + nx, y: w.y2 + uy + ny };
    const p3 = { x: w.x2 + ux - nx, y: w.y2 + uy - ny };
    const p4 = { x: w.x1 - ux - nx, y: w.y1 - uy - ny };

    const minGX = Math.max(0, toGridX(Math.min(p1.x, p2.x, p3.x, p4.x)));
    const maxGX = Math.min(cols - 1, toGridX(Math.max(p1.x, p2.x, p3.x, p4.x)));
    const minGY = Math.max(0, toGridY(Math.min(p1.y, p2.y, p3.y, p4.y)));
    const maxGY = Math.min(rows - 1, toGridY(Math.max(p1.y, p2.y, p3.y, p4.y)));

    const wallPoly = [p1, p2, p3, p4];

    for (let gy = minGY; gy <= maxGY; gy++) {
      for (let gx = minGX; gx <= maxGX; gx++) {
        const worldPt = { x: minX + (gx + 0.5) * CELL_SIZE, y: minY + (gy + 0.5) * CELL_SIZE };
        if (pointInPoly(worldPt, wallPoly)) {
          grid[gy * cols + gx] = 1;
        }
      }
    }
  }

  const CLOSE_RADIUS = Math.max(1, Math.ceil(2 / CELL_SIZE));
  const closedGrid = closeSmallGaps(grid, cols, rows, CLOSE_RADIUS);
  grid.set(closedGrid);

  const queue: number[] = [];
  const markExterior = (idx: number) => {
    if (grid[idx] === 0) {
      grid[idx] = 2;
      queue.push(idx);
    }
  };

  for (let x = 0; x < cols; x++) {
    markExterior(x);
    markExterior((rows - 1) * cols + x);
  }
  for (let y = 0; y < rows; y++) {
    markExterior(y * cols);
    markExterior(y * cols + (cols - 1));
  }

  while (queue.length > 0) {
    const idx = queue.pop()!;
    const cx = idx % cols;
    const cy = Math.floor(idx / cols);

    for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
        const nIdx = ny * cols + nx;
        if (grid[nIdx] === 0) {
          grid[nIdx] = 2;
          queue.push(nIdx);
        }
      }
    }
  }

  const roomPolygons: Point[][] = [];
  const MIN_ROOM_AREA_PX2 = 640;
  const MIN_CELLS = Math.max(4, Math.round(MIN_ROOM_AREA_PX2 / (CELL_SIZE * CELL_SIZE)));

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const startIdx = y * cols + x;
      if (grid[startIdx] !== 0) continue;

      const roomCells = new Set<number>();
      const roomQueue = [startIdx];
      grid[startIdx] = 3;

      while (roomQueue.length > 0) {
        const curr = roomQueue.pop()!;
        roomCells.add(curr);
        const rcx = curr % cols;
        const rcy = Math.floor(curr / cols);

        for (const [nx, ny] of [[rcx + 1, rcy], [rcx - 1, rcy], [rcx, rcy + 1], [rcx, rcy - 1]]) {
          if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
            const nIdx = ny * cols + nx;
            if (grid[nIdx] === 0) {
              grid[nIdx] = 3;
              roomQueue.push(nIdx);
            }
          }
        }
      }

      if (roomCells.size < MIN_CELLS) continue;

      const contour = extractRoomContourFromCells(grid, cols, rows, roomCells, minX, minY, CELL_SIZE, 3);
      if (contour && contour.length >= 3) {
        const cleaned = cleanRoomPolygonToCenterlines(contour, walls);
        if (cleaned.length >= 3) roomPolygons.push(cleaned);
      }
    }
  }

  return roomPolygons;
}

export function findEnclosedRoomAtPoint(
  p: Point,
  walls: Wall[],
  wallTypeThicknesses?: Record<string, number>
): Point[] | null {
  const rooms = detectEnclosedRooms(walls, wallTypeThicknesses);
  let smallestRoom: Point[] | null = null;
  let smallestArea = Infinity;

  for (const room of rooms) {
    if (pointInPoly(p, room)) {
      let area = 0;
      for (let i = 0; i < room.length; i++) {
        const j = (i + 1) % room.length;
        area += room[i].x * room[j].y - room[j].x * room[i].y;
      }
      area = Math.abs(area) / 2;
      if (area < smallestArea) {
        smallestArea = area;
        smallestRoom = room;
      }
    }
  }

  return smallestRoom;
}

// Berekent de netto vloercontour van een zone op basis van muurbinnenranden.
export function getZoneInnerPolygon(
  zonePoints: Point[],
  walls: Wall[],
  wallThicknesses: Record<string, number>,
  scalePxPerMeter: number = 50
): Point[] {
  if (!zonePoints || zonePoints.length < 3) return zonePoints || [];

  const centroid = getPolygonCentroid(zonePoints);
  const n = zonePoints.length;
  type Line = { p1: Point; p2: Point };
  const inwardLines: Line[] = [];

  for (let i = 0; i < n; i++) {
    const pA = zonePoints[i];
    const pB = zonePoints[(i + 1) % n];
    const edgeLen = dist(pA, pB);

    if (edgeLen < 1e-4) {
      inwardLines.push({ p1: pA, p2: pB });
      continue;
    }

    const edgeUx = (pB.x - pA.x) / edgeLen;
    const edgeUy = (pB.y - pA.y) / edgeLen;
    const mid = { x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 };

    let bestWall: Wall | null = null;
    let bestScore = 80;

    for (const w of walls) {
      const w1 = { x: w.x1, y: w.y1 };
      const w2 = { x: w.x2, y: w.y2 };
      const wLen = dist(w1, w2);
      if (wLen < 1e-4) continue;

      const wUx = (w2.x - w1.x) / wLen;
      const wUy = (w2.y - w1.y) / wLen;
      if (Math.abs(edgeUx * wUx + edgeUy * wUy) < 0.7) continue;

      const lineDist =
        Math.abs((w2.y - w1.y) * mid.x - (w2.x - w1.x) * mid.y + w2.x * w1.y - w2.y * w1.x) / wLen;

      const edgeProjA = pA.x * wUx + pA.y * wUy;
      const edgeProjB = pB.x * wUx + pB.y * wUy;
      const eMin = Math.min(edgeProjA, edgeProjB);
      const eMax = Math.max(edgeProjA, edgeProjB);
      const wProj1 = w1.x * wUx + w1.y * wUy;
      const wProj2 = w2.x * wUx + w2.y * wUy;
      const wMin = Math.min(wProj1, wProj2);
      const wMax = Math.max(wProj1, wProj2);
      if (eMax < wMin - 40 || eMin > wMax + 40) continue;

      if (lineDist < bestScore) {
        bestScore = lineDist;
        bestWall = w;
      }
    }

    if (bestWall) {
      const faces = getOuterWallFaces(
        bestWall,
        wallThicknesses as Record<WallType, number>,
        scalePxPerMeter
      );
      // Binnenrand = face dichter bij zone-centroid
      const d1 = distToSegment(centroid, faces.line1.p1, faces.line1.p2).distance;
      const d2 = distToSegment(centroid, faces.line2.p1, faces.line2.p2).distance;
      inwardLines.push(d1 <= d2 ? faces.line1 : faces.line2);
    } else {
      // Fallback: zone-rand zelf iets naar binnen
      let nx = -edgeUy;
      let ny = edgeUx;
      const toC = { x: centroid.x - mid.x, y: centroid.y - mid.y };
      if (nx * toC.x + ny * toC.y < 0) {
        nx = -nx;
        ny = -ny;
      }
      const ht = 5;
      inwardLines.push({
        p1: { x: pA.x + nx * ht, y: pA.y + ny * ht },
        p2: { x: pB.x + nx * ht, y: pB.y + ny * ht },
      });
    }
  }

  if (inwardLines.length < 3) return zonePoints;

  const innerVerts: Point[] = [];
  for (let i = 0; i < inwardLines.length; i++) {
    const prev = inwardLines[(i - 1 + inwardLines.length) % inwardLines.length];
    const curr = inwardLines[i];
    const inter = lineIntersectionInfinite(prev.p1, prev.p2, curr.p1, curr.p2);
    const ref = zonePoints[i % n];

    if (inter && Number.isFinite(inter.x) && Number.isFinite(inter.y) && dist(inter, ref) < 500) {
      innerVerts.push(inter);
    } else {
      innerVerts.push(curr.p1);
    }
  }

  const cleaned = weldContourPoints(innerVerts, 8);
  return cleaned.length >= 3 ? cleaned : zonePoints;
}


// Berekent het netto zone-oppervlakte (m²) via de binnenrand-polygoon.
export function calculateZoneNetArea(
  zonePoints: Point[],
  walls: Wall[],
  wallThicknesses: Record<string, number>,
  scalePxPerMeter: number
): number {
  const innerPoly = getZoneInnerPolygon(zonePoints, walls, wallThicknesses, scalePxPerMeter);
  return calculatePolygonArea(innerPoly, scalePxPerMeter);
}

// Berekent de vrije spannen van muren langs de zone-contour.
export function getZoneWallClearSpans(
  zonePoints: Point[],
  walls: Wall[],
  wallThicknesses: Record<string, number>,
  scalePxPerMeter: number
): { wall: Wall; lengthMeters: number; p0: Point; p1: Point; usedCorners: boolean }[] {
  if (!zonePoints || zonePoints.length < 3) return [];

  const n = zonePoints.length;
  const result: { wall: Wall; lengthMeters: number; p0: Point; p1: Point; usedCorners: boolean }[] = [];
  const usedWallIds = new Set<string>();

  for (let i = 0; i < n; i++) {
    const pA = zonePoints[i];
    const pB = zonePoints[(i + 1) % n];
    const edgeLen = dist(pA, pB);
    if (edgeLen < 1e-4) continue;

    const edgeUx = (pB.x - pA.x) / edgeLen;
    const edgeUy = (pB.y - pA.y) / edgeLen;
    const mid = { x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 };

    let bestWall: Wall | null = null;
    let bestScore = 80;

    for (const w of walls) {
      if (usedWallIds.has(w.id)) continue;
      const w1 = { x: w.x1, y: w.y1 };
      const w2 = { x: w.x2, y: w.y2 };
      const wLen = dist(w1, w2);
      if (wLen < 1e-4) continue;

      const wUx = (w2.x - w1.x) / wLen;
      const wUy = (w2.y - w1.y) / wLen;
      if (Math.abs(edgeUx * wUx + edgeUy * wUy) < 0.7) continue;

      const lineDist =
        Math.abs((w2.y - w1.y) * mid.x - (w2.x - w1.x) * mid.y + w2.x * w1.y - w2.y * w1.x) / wLen;

      const edgeProjA = pA.x * wUx + pA.y * wUy;
      const edgeProjB = pB.x * wUx + pB.y * wUy;
      const eMin = Math.min(edgeProjA, edgeProjB);
      const eMax = Math.max(edgeProjA, edgeProjB);
      const wProj1 = w1.x * wUx + w1.y * wUy;
      const wProj2 = w2.x * wUx + w2.y * wUy;
      const wMin = Math.min(wProj1, wProj2);
      const wMax = Math.max(wProj1, wProj2);
      if (eMax < wMin - 40 || eMin > wMax + 40) continue;

      if (lineDist < bestScore) {
        bestScore = lineDist;
        bestWall = w;
      }
    }

    if (!bestWall) continue;
    usedWallIds.add(bestWall.id);

    const span = getWallClearSpan(
      bestWall,
      walls,
      wallThicknesses as Record<WallType, number>,
      scalePxPerMeter
    );
    result.push({
      wall: bestWall,
      lengthMeters: span.lengthMeters,
      p0: span.p0,
      p1: span.p1,
      usedCorners: span.usedCorners,
    });
  }

  return result;
}

// Wall editing and splitting tools

export function mergeAndSplitWalls(
  newWall: { x1: number; y1: number; x2: number; y2: number; type: WallType; thicknessPx: number },
  existingWalls: Wall[],
  wallCounter: number,
  existingOpenings: Opening[] = [],
  _isOuterFaceSnap = false
): { walls: Wall[]; openings: Opening[]; newChainEndpoint: Point; newWallCounter: number } {
  let updatedCounter = wallCounter;
  let wallsList = [...existingWalls];

  const p1 = { x: newWall.x1, y: newWall.y1 };
  const p2 = { x: newWall.x2, y: newWall.y2 };

  const lenNew = dist(p1, p2);
  if (lenNew < 3) {
    return {
      walls: wallsList,
      openings: existingOpenings,
      newChainEndpoint: p2,
      newWallCounter: updatedCounter,
    };
  }

  const dxN = (p2.x - p1.x) / lenNew;
  const dyN = (p2.y - p1.y) / lenNew;

  let mergedWithExisting = false;
  let chainEndpoint = p2;
  const lateralTol = Math.max(8, (newWall.thicknessPx || 12) * 0.6);
  const gapTol = 12;

  for (let i = 0; i < wallsList.length; i++) {
    const w = wallsList[i];
    if (w.type !== newWall.type) continue;

    const w1 = { x: w.x1, y: w.y1 };
    const w2 = { x: w.x2, y: w.y2 };
    const lenW = dist(w1, w2);
    if (lenW < 1e-4) continue;

    const dxW = (w2.x - w1.x) / lenW;
    const dyW = (w2.y - w1.y) / lenW;

    if (Math.abs(dxN * dxW + dyN * dyW) > 0.98) {
      const lat1 = Math.abs((p1.x - w1.x) * -dyW + (p1.y - w1.y) * dxW);
      const lat2 = Math.abs((p2.x - w1.x) * -dyW + (p2.y - w1.y) * dxW);

      if (lat1 < lateralTol && lat2 < lateralTol) {
        const projP1 = (p1.x - w1.x) * dxW + (p1.y - w1.y) * dyW;
        const projP2 = (p2.x - w1.x) * dxW + (p2.y - w1.y) * dyW;

        const minW = 0;
        const maxW = lenW;
        const minP = Math.min(projP1, projP2);
        const maxP = Math.max(projP1, projP2);

        if (minP <= maxW + gapTol && maxP >= minW - gapTol) {
          mergedWithExisting = true;

          const combinedMin = Math.min(minW, minP);
          const combinedMax = Math.max(maxW, maxP);

          const newW1 = { x: w1.x + dxW * combinedMin, y: w1.y + dyW * combinedMin };
          const newW2 = { x: w1.x + dxW * combinedMax, y: w1.y + dyW * combinedMax };

          if (projP2 > maxW) {
            chainEndpoint = newW2;
          } else if (projP2 < minW) {
            chainEndpoint = newW1;
          } else {
            chainEndpoint = { x: w1.x + dxW * projP2, y: w1.y + dyW * projP2 };
          }

          wallsList[i] = {
            ...w,
            x1: newW1.x,
            y1: newW1.y,
            x2: newW2.x,
            y2: newW2.y,
            thicknessPx: Math.max(w.thicknessPx, newWall.thicknessPx),
          };

          break;
        }
      }
    }
  }

  if (!mergedWithExisting) {
    updatedCounter++;
    wallsList.push({
      id: `wall_${updatedCounter}`,
      label: `Muur ${updatedCounter}`,
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
      type: newWall.type,
      thicknessPx: newWall.thicknessPx,
      heightMeters: 2.6,
      openings: [],
      jobs: [],
    });
  }

  return {
    walls: wallsList,
    openings: existingOpenings,
    newChainEndpoint: chainEndpoint,
    newWallCounter: updatedCounter,
  };
}

export interface WallSplitSnapResult {
  wall: Wall;
  splitPoint: Point;
  snapType: 'perpendicular' | 'direct';
  perpWallLabel?: string;
}

export function findWallSplitSnapPoint(
  mousePt: Point,
  walls: Wall[],
  maxSnapDist = 25
): WallSplitSnapResult | null {
  if (walls.length === 0) return null;

  let bestWall: Wall | null = null;
  let bestDist = Infinity;
  let bestProj: Point = mousePt;

  for (const w of walls) {
    const res = distToSegment(mousePt, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
    if (res.distance < bestDist) {
      bestDist = res.distance;
      bestWall = w;
      bestProj = res.projection;
    }
  }

  if (!bestWall || bestDist > 40) return null;

  const w1 = { x: bestWall.x1, y: bestWall.y1 };
  const w2 = { x: bestWall.x2, y: bestWall.y2 };
  const lenMain = dist(w1, w2);
  if (lenMain < 1) return null;

  const dxMain = (w2.x - w1.x) / lenMain;
  const dyMain = (w2.y - w1.y) / lenMain;

  let bestPerpSnap: Point | null = null;
  let bestPerpDist = maxSnapDist;
  let perpWallLabel: string | undefined = undefined;

  for (const other of walls) {
    if (other.id === bestWall.id) continue;

    const o1 = { x: other.x1, y: other.y1 };
    const o2 = { x: other.x2, y: other.y2 };
    const lenOther = dist(o1, o2);
    if (lenOther < 1) continue;

    const dxOther = (o2.x - o1.x) / lenOther;
    const dyOther = (o2.y - o1.y) / lenOther;

    if (Math.abs(dxMain * dxOther + dyMain * dyOther) < 0.2) {
      const inter = lineIntersectionInfinite(w1, w2, o1, o2);
      if (inter) {
        const resOnMain = distToSegment(inter, w1, w2);
        if (resOnMain.ratio >= 0.01 && resOnMain.ratio <= 0.99) {
          const dToMouse = dist(mousePt, inter);
          if (dToMouse < bestPerpDist) {
            bestPerpDist = dToMouse;
            bestPerpSnap = inter;
            perpWallLabel = other.label;
          }
        }
      }
    }
  }

  if (bestPerpSnap) {
    return {
      wall: bestWall,
      splitPoint: bestPerpSnap,
      snapType: 'perpendicular',
      perpWallLabel,
    };
  }

  return {
    wall: bestWall,
    splitPoint: bestProj,
    snapType: 'direct',
  };
}

export function splitWallAtPoint(
  wall: Wall,
  splitPoint: Point,
  walls: Wall[],
  openings: Opening[],
  wallCounter: number
): { walls: Wall[]; openings: Opening[]; newWallCounter: number } {
  const w1 = { x: wall.x1, y: wall.y1 };
  const w2 = { x: wall.x2, y: wall.y2 };
  if (dist(w1, w2) < 10) {
    return { walls, openings, newWallCounter: wallCounter };
  }

  const res = distToSegment(splitPoint, w1, w2);
  if (res.ratio <= 0.02 || res.ratio >= 0.98) {
    return { walls, openings, newWallCounter: wallCounter };
  }

  const c1 = wallCounter + 1;
  const c2 = wallCounter + 2;

  const sub1: Wall = {
    ...wall,
    id: `wall_${c1}`,
    label: `${wall.label} (a)`,
    x1: wall.x1,
    y1: wall.y1,
    x2: splitPoint.x,
    y2: splitPoint.y,
    openings: [],
  };

  const sub2: Wall = {
    ...wall,
    id: `wall_${c2}`,
    label: `${wall.label} (b)`,
    x1: splitPoint.x,
    y1: splitPoint.y,
    x2: wall.x2,
    y2: wall.y2,
    openings: [],
  };

  const updatedOpenings: Opening[] = [];
  const sub1Openings: string[] = [];
  const sub2Openings: string[] = [];

  for (const op of openings) {
    if (op.wallId === wall.id) {
      const opWorld = {
        x: wall.x1 + (wall.x2 - wall.x1) * op.offsetRatio,
        y: wall.y1 + (wall.y2 - wall.y1) * op.offsetRatio,
      };

      const res1 = distToSegment(opWorld, { x: sub1.x1, y: sub1.y1 }, { x: sub1.x2, y: sub1.y2 });
      const res2 = distToSegment(opWorld, { x: sub2.x1, y: sub2.y1 }, { x: sub2.x2, y: sub2.y2 });

      if (res1.distance <= res2.distance) {
        updatedOpenings.push({
          ...op,
          wallId: sub1.id,
          offsetRatio: Math.max(0.05, Math.min(0.95, res1.ratio)),
        });
        sub1Openings.push(op.id);
      } else {
        updatedOpenings.push({
          ...op,
          wallId: sub2.id,
          offsetRatio: Math.max(0.05, Math.min(0.95, res2.ratio)),
        });
        sub2Openings.push(op.id);
      }
    } else {
      updatedOpenings.push(op);
    }
  }

  sub1.openings = sub1Openings;
  sub2.openings = sub2Openings;

  const newWallsList: Wall[] = [];
  for (const w of walls) {
    if (w.id === wall.id) {
      newWallsList.push(sub1, sub2);
    } else {
      newWallsList.push(w);
    }
  }

  return {
    walls: newWallsList,
    openings: updatedOpenings,
    newWallCounter: c2,
  };
}

export function splitIntersectedWalls(
  newWall: { x1: number; y1: number; x2: number; y2: number },
  existingWalls: Wall[],
  wallCounter: number
): { wallsToAdd: Wall[]; wallsToRemoveIds: string[]; newWallCounter: number } {
  let updatedCounter = wallCounter;
  const wallsToAdd: Wall[] = [];
  const wallsToRemoveIds: string[] = [];

  const p1 = { x: newWall.x1, y: newWall.y1 };
  const p2 = { x: newWall.x2, y: newWall.y2 };

  for (const wall of existingWalls) {
    const w1 = { x: wall.x1, y: wall.y1 };
    const w2 = { x: wall.x2, y: wall.y2 };

    const res1 = distToSegment(p1, w1, w2);
    const res2 = distToSegment(p2, w1, w2);

    const isT1 = res1.distance < 4 && res1.ratio > 0.05 && res1.ratio < 0.95;
    const isT2 = res2.distance < 4 && res2.ratio > 0.05 && res2.ratio < 0.95;

    if (isT1 || isT2) {
      const splitPt = isT1 ? res1.projection : res2.projection;
      wallsToRemoveIds.push(wall.id);

      updatedCounter++;
      wallsToAdd.push({
        ...wall,
        id: `wall_${updatedCounter}`,
        label: `Muur ${updatedCounter}`,
        x1: wall.x1,
        y1: wall.y1,
        x2: splitPt.x,
        y2: splitPt.y,
      });

      updatedCounter++;
      wallsToAdd.push({
        ...wall,
        id: `wall_${updatedCounter}`,
        label: `Muur ${updatedCounter}`,
        x1: splitPt.x,
        y1: splitPt.y,
        x2: wall.x2,
        y2: wall.y2,
      });
    }
  }

  return { wallsToAdd, wallsToRemoveIds, newWallCounter: updatedCounter };
}