import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { PlannerState, Point, Wall, Zone, Opening, WallType } from '../types';
import {
  dist,
  applyOrthoAndSnap,
  getWallClearSpan,
  calculateZoneNetArea,
  getPolygonCentroid,
  pointInPoly,
  splitPolygonWithLine,
  mergeAndSplitWalls,
  findWallSplitSnapPoint,
  splitWallAtPoint,
  distToSegment,
  snapToWallOuterEdges,
  snapToOuterWallEdges,
  detectEnclosedRooms,
  calculateCalibrationClearSpan,
} from '../utils/geometry';
import { Ruler, Check, X, Scissors, Split } from 'lucide-react';

interface PlannerCanvasProps {
  state: PlannerState;
  setState: React.Dispatch<React.SetStateAction<PlannerState>>;
}

export const PlannerCanvas: React.FC<PlannerCanvasProps> = ({ state, setState }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Cache enclosed rooms — only recompute when wall set changes (not every mousemove)
const cachedRooms = useMemo(
  () => detectEnclosedRooms(state.walls, state.wallTypeThicknesses),
  [state.walls, state.wallTypeThicknesses]
);

  // Drawing Temporary States
  const [wallChainPoints, setWallChainPoints] = useState<Point[]>([]);
  const [zonePoints, setZonePoints] = useState<Point[]>([]);
  const [cutPoints, setCutPoints] = useState<Point[]>([]);
  const [hoveredRoomPolygon, setHoveredRoomPolygon] = useState<Point[] | null>(null);
  const [calibratePoints, setCalibratePoints] = useState<Point[]>([]);
  const [calibrateInnerPoints, setCalibrateInnerPoints] = useState<{ p1: Point; p2: Point } | null>(null);
  const [showCalibrateModal, setShowCalibrateModal] = useState(false);
  const [calibrateMeasuredPx, setCalibrateMeasuredPx] = useState(0);
  const [calibrateInputMeters, setCalibrateInputMeters] = useState('5.00');
  const [pendingTJunctionSplit, setPendingTJunctionSplit] = useState<{
    hitWall: Wall;
    splitPoint: Point;
  } | null>(null);
  const [mouseWorld, setMouseWorld] = useState<Point>({ x: 0, y: 0 });
  const [rawMouseWorld, setRawMouseWorld] = useState<Point>({ x: 0, y: 0 });
  const [snapIndicator, setSnapIndicator] = useState<{
    point: Point;
    snapType?: string;
    label?: string;
  } | null>(null);

  const handleConfirmTJunctionSplit = () => {
    if (!pendingTJunctionSplit) return;
    const { hitWall, splitPoint } = pendingTJunctionSplit;
    const wallToSplit = state.walls.find((w) => w.id === hitWall.id);
    if (wallToSplit) {
      const res = splitWallAtPoint(
        wallToSplit,
        splitPoint,
        state.walls,
        state.openings,
        state.wallCounter
      );
      setState((prev) => ({
        ...prev,
        walls: res.walls,
        openings: res.openings,
        wallCounter: res.newWallCounter,
      }));
    }
    setPendingTJunctionSplit(null);
  };

  const handleCancelTJunctionSplit = () => {
    setPendingTJunctionSplit(null);
  };

  // Pan / Drag State
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });

  // Convert Screen Coordinates to Canvas World Coordinates
  const getScreenToWorld = useCallback(
    (screenX: number, screenY: number): Point => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const rawX = screenX - rect.left;
      const rawY = screenY - rect.top;

      const worldX = (rawX - state.view.pan.x) / state.view.zoom;
      const worldY = (rawY - state.view.pan.y) / state.view.zoom;

      return { x: worldX, y: worldY };
    },
    [state.view.pan, state.view.zoom]
  );

  // Convert Canvas World Coordinates to Screen Coordinates
  const getWorldToScreen = useCallback(
    (worldX: number, worldY: number): Point => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const screenX = rect.left + worldX * state.view.zoom + state.view.pan.x;
      const screenY = rect.top + worldY * state.view.zoom + state.view.pan.y;
      return { x: screenX, y: screenY };
    },
    [state.view.pan, state.view.zoom]
  );

  // Mouse Move Handler
  const handleMouseMove = (e: React.MouseEvent) => {
    if (pendingTJunctionSplit) return; // Lock drawing while question is open
    const rawWorld = getScreenToWorld(e.clientX, e.clientY);

    // Pan Canvas
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setState((prev) => ({
        ...prev,
        view: {
          ...prev.view,
          pan: { x: prev.view.pan.x + dx, y: prev.view.pan.y + dy },
        },
      }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // Block item modifications in General tab
    if (state.activeTab === 'general' && draggedItemId) {
      setDraggedItemId(null);
      return;
    }

    // Dragging Selected Background
    if (draggedItemId && state.activeTool === 'bg_move') {
      const newX = rawWorld.x - dragOffset.x;
      const newY = rawWorld.y - dragOffset.y;
      setState((prev) => ({
        ...prev,
        backgrounds: prev.backgrounds.map((bg) =>
          bg.id === draggedItemId ? { ...bg, x: newX, y: newY } : bg
        ),
      }));
      return;
    }

    // Dragging a zone label (offset from centroid)
    if (draggedItemId && draggedItemId.startsWith('zone_label_') && state.activeTool === 'select') {
      const zoneId = draggedItemId.slice('zone_label_'.length);
      const zone = state.zones.find((z) => z.id === zoneId);
      if (zone) {
        const c = getPolygonCentroid(zone.points);
        setState((prev) => ({
          ...prev,
          zones: prev.zones.map((z) =>
            z.id === zoneId
              ? { ...z, labelOffset: { x: rawWorld.x - c.x, y: rawWorld.y - c.y } }
              : z
          ),
        }));
      }
      return;
    }

    // Dragging Selected Door or Window along walls
    if (draggedItemId && state.activeTool === 'select') {
      const draggedOpening = state.openings.find((o) => o.id === draggedItemId);
      if (draggedOpening) {
        if (!draggedOpening.isLocked) {
          let closestWall: Wall | null = null;
          let minDistance = 60; // search distance in pixels
          let bestRatio = 0.5;

          for (const w of state.walls) {
            const v = { x: w.x1, y: w.y1 };
            const m = { x: w.x2, y: w.y2 };
            const res = distToSegment(rawWorld, v, m);
            if (res.distance < minDistance) {
              minDistance = res.distance;
              closestWall = w;
              bestRatio = Math.max(0.05, Math.min(0.95, res.ratio));
            }
          }

          if (closestWall) {
            const wallChanged = draggedOpening.wallId !== closestWall.id;
            setState((prev) => ({
              ...prev,
              openings: prev.openings.map((o) =>
                o.id === draggedItemId
                  ? { ...o, wallId: closestWall!.id, offsetRatio: bestRatio }
                  : o
              ),
              walls: wallChanged
                ? prev.walls.map((w) => {
                    if (w.id === draggedOpening.wallId) {
                      return { ...w, openings: w.openings.filter((id) => id !== draggedItemId) };
                    }
                    if (w.id === closestWall!.id) {
                      return { ...w, openings: [...w.openings, draggedItemId] };
                    }
                    return w;
                  })
                : prev.walls,
            }));
          }
        }
        return;
      }
    }

    // In select mode, disable snapping indicator
    setRawMouseWorld(rawWorld);
    if (state.activeTool === 'select') {
      setMouseWorld(rawWorld);
      setSnapIndicator(null);
      setHoveredRoomPolygon(null);
      return;
    }

    // Split wall tool hover detection
    if (state.activeTool === 'split_wall') {
      setHoveredRoomPolygon(null);
      const splitSnap = findWallSplitSnapPoint(rawWorld, state.walls, 30);
      if (splitSnap) {
        setMouseWorld(splitSnap.splitPoint);
        const label =
          splitSnap.snapType === 'perpendicular'
            ? `HAAKS SPLITSEN (${splitSnap.perpWallLabel || 'Muur'})`
            : `MUUR SPLITSEN (${splitSnap.wall.label})`;
        setSnapIndicator({
          point: splitSnap.splitPoint,
          snapType: splitSnap.snapType === 'perpendicular' ? 'corner' : 'midpoint',
          label,
        });
      } else {
        setMouseWorld(rawWorld);
        setSnapIndicator(null);
      }
      return;
    }

// Auto-room detection on hover when activeTool === 'zone' (uses cached rooms)
if (state.activeTool === 'zone') {
  if (zonePoints.length === 0) {
    let smallest: Point[] | null = null;
    let smallestArea = Infinity;

    for (const room of cachedRooms) {
      if (!pointInPoly(rawWorld, room)) continue;

      // Netto vloeroppervlak via binnenranden (zelfde dikte-logica als vrije span)
      const roomArea = calculateZoneNetArea(room, state.walls, state.wallTypeThicknesses, state.scalePxPerMeter);

      if (roomArea < smallestArea) {
        smallestArea = roomArea;
        smallest = room;
      }
    }
    setHoveredRoomPolygon(smallest);
  } else {
    setHoveredRoomPolygon(null);
  }
} else {
  setHoveredRoomPolygon(null);
}

    // If calibration modal is open, freeze mouse preview
    if (state.activeTool === 'calibrate' && calibratePoints.length === 2) {
      return;
    }

    // Apply Snapping for drawing tools
    let prevPt: Point | null = null;
    if (state.activeTool === 'wall' && wallChainPoints.length > 0) {
      prevPt = wallChainPoints[wallChainPoints.length - 1];
    } else if (state.activeTool === 'zone' && zonePoints.length > 0) {
      prevPt = zonePoints[zonePoints.length - 1];
    } else if (state.activeTool === 'cut_zone' && cutPoints.length === 1) {
      prevPt = cutPoints[0];
    } else if (state.activeTool === 'calibrate' && calibratePoints.length === 1) {
      prevPt = calibratePoints[0];
    }

    const snapResult = applyOrthoAndSnap(
      rawWorld,
      prevPt,
      state.walls,
      state.orthoSnap,
      state.magneticSnap,
      20,
      state.backgrounds,
      state.snapDarknessThreshold ?? 50,
      state.snapSearchRadius ?? 25,
      state.activeTool === 'wall'
        ? state.wallTypeToDraw
        : state.activeTool === 'calibrate'
        ? ('calibrate' as any)
        : state.activeTool === 'cut_zone'
        ? ('cut_zone' as any)
        : undefined,
      state.activeTool === 'door' || state.activeTool === 'window',
      state.wallTypeThicknesses,
      state.scalePxPerMeter
    );

    let targetPt = snapResult.point;

    // Apply ortho constraint for cut_zone line if active
    if (state.activeTool === 'cut_zone' && cutPoints.length === 1 && state.orthoSnap) {
      const p1 = cutPoints[0];
      const dx = Math.abs(rawWorld.x - p1.x);
      const dy = Math.abs(rawWorld.y - p1.y);
      if (dx > dy) {
        targetPt = { x: snapResult.point.x, y: p1.y };
      } else {
        targetPt = { x: p1.x, y: snapResult.point.y };
      }
    }

    setMouseWorld(targetPt);
    if (snapResult.snapped) {
      setSnapIndicator({ point: targetPt, snapType: snapResult.snapType, label: snapResult.label });
    } else {
      setSnapIndicator(null);
    }
  };

  // Click Handler on Canvas
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    if (pendingTJunctionSplit) return; // Prevent clicks while split prompt is open
    const pt = mouseWorld;

    // IN GENERAL TAB: strictly allow item selection only (NO drawing, deleting, repositioning, or splitting)
    if (state.activeTab === 'general') {
      // Check clicked opening
      for (const o of state.openings) {
        const parentWall = state.walls.find((w) => w.id === o.wallId);
        if (parentWall) {
          const w1 = { x: parentWall.x1, y: parentWall.y1 };
          const w2 = { x: parentWall.x2, y: parentWall.y2 };
          const opPos = {
            x: w1.x + o.offsetRatio * (w2.x - w1.x),
            y: w1.y + o.offsetRatio * (w2.y - w1.y),
          };
          if (dist(pt, opPos) < 20) {
            setState((prev) => ({
              ...prev,
              selectedItemIds: e.ctrlKey || e.metaKey
                ? prev.selectedItemIds.includes(o.id)
                  ? prev.selectedItemIds.filter((id) => id !== o.id)
                  : [...prev.selectedItemIds, o.id]
                : [o.id],
            }));
            return;
          }
        }
      }

      // Check clicked wall
      let closestWall: Wall | null = null;
      let minWallDist = 18;
      for (const w of state.walls) {
        const res = distToSegment(pt, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
        if (res.distance < minWallDist) {
          minWallDist = res.distance;
          closestWall = w;
        }
      }
      if (closestWall) {
        setState((prev) => ({
          ...prev,
          selectedItemIds: e.ctrlKey || e.metaKey
            ? prev.selectedItemIds.includes(closestWall!.id)
              ? prev.selectedItemIds.filter((id) => id !== closestWall!.id)
              : [...prev.selectedItemIds, closestWall!.id]
            : [closestWall!.id],
        }));
        return;
      }

      // Check clicked zone
      const clickedZone = [...state.zones].reverse().find((z) => pointInPoly(pt, z.points));
      if (clickedZone) {
        setState((prev) => ({
          ...prev,
          selectedItemIds: e.ctrlKey || e.metaKey
            ? prev.selectedItemIds.includes(clickedZone.id)
              ? prev.selectedItemIds.filter((id) => id !== clickedZone.id)
              : [...prev.selectedItemIds, clickedZone.id]
            : [clickedZone.id],
        }));
      } else {
        setState((prev) => ({ ...prev, selectedItemIds: [] }));
      }
      return;
    }

    // --- TOOL: SELECT ---
    if (state.activeTool === 'select') {
      // Check if clicked on room / zone
      const clickedZone = [...state.zones].reverse().find((z) => pointInPoly(pt, z.points));
      if (clickedZone) {
        setState((prev) => ({ ...prev, selectedItemIds: [clickedZone.id] }));
      } else {
        setState((prev) => ({ ...prev, selectedItemIds: [] }));
      }
      return;
    }

    // --- TOOL: CALIBRATE SCALE VIA LINE (VRIJE SPAN) ---
    if (state.activeTool === 'calibrate') {
      if (calibratePoints.length === 0) {
        setCalibratePoints([pt]);
        setCalibrateInnerPoints(null);
      } else if (calibratePoints.length === 1) {
        const p1 = calibratePoints[0];
        const p2 = pt;

        const res = calculateCalibrationClearSpan(p1, p2, state.walls, state.wallTypeThicknesses);
        if (!res.valid) {
          setCalibratePoints([]);
          setCalibrateInnerPoints(null);
          alert('Geen geldige vrije span (binnenmaat tussen muren) gevonden op deze lijn. Trek de kalibratielijn a.u.b. opnieuw tussen twee muren.');
        } else {
          setCalibratePoints([p1, p2]);
          setCalibrateInnerPoints({ p1: res.innerP1, p2: res.innerP2 });
          setCalibrateMeasuredPx(res.clearSpanPx);
          setCalibrateInputMeters('');
          setShowCalibrateModal(true);
        }
      }
      return;
    }

    // --- TOOL: WALL (DRAW MUUR) ---
    if (state.activeTool === 'wall') {
      if (wallChainPoints.length === 0) {
        setWallChainPoints([pt]);
      } else {
        const p1 = wallChainPoints[wallChainPoints.length - 1];
        const p2 = pt;

        // Prevent zero-length wall
        if (dist(p1, p2) > 5) {
          const thicknessPx = state.wallTypeThicknesses[state.wallTypeToDraw] || 12;

          // Merge collinear (incl. end-to-end), reattach openings
          const mergeRes = mergeAndSplitWalls(
            { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, type: state.wallTypeToDraw, thicknessPx },
            state.walls,
            state.wallCounter,
            state.openings
          );

          // Check if p1 or p2 lands on an existing wall segment to form a T-junction
          let hitTJunction: { hitWall: Wall; splitPoint: Point } | null = null;
          for (const w of state.walls) {
            const w1 = { x: w.x1, y: w.y1 };
            const w2 = { x: w.x2, y: w.y2 };
            for (const ep of [p1, p2]) {
              if (dist(ep, w1) < 6 || dist(ep, w2) < 6) continue; // ignore existing endpoints/corners
              const res = distToSegment(ep, w1, w2);
              if (res.distance < 10 && res.ratio > 0.03 && res.ratio < 0.97) {
                hitTJunction = { hitWall: w, splitPoint: res.projection };
                break;
              }
            }
            if (hitTJunction) break;
          }

          setState((prev) => ({
            ...prev,
            wallCounter: mergeRes.newWallCounter,
            walls: mergeRes.walls,
            openings: mergeRes.openings,
          }));

          // Continue wall chain from current endpoint
          setWallChainPoints([mergeRes.newChainEndpoint]);

          if (hitTJunction) {
            setPendingTJunctionSplit(hitTJunction);
          }
        }
      }
      return;
    }

// --- TOOL: ZONE (DRAW ROOM / AUTO-PLACE ENCLOSED ROOM) ---
if (state.activeTool === 'zone') {
  // 1. Automatisch ingesloten ruimte plaatsen bij hover op een gedetecteerde kamer
  if (hoveredRoomPolygon && zonePoints.length === 0) {
    const newZoneCounter = state.zoneCounter + 1;
    const colorPresets = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6'];
    const chosenColor = colorPresets[(newZoneCounter - 1) % colorPresets.length];

    const newZone: Zone = {
      id: `zone_${newZoneCounter}`,
      label: `Ruimte ${newZoneCounter}`,
      points: [...hoveredRoomPolygon],
      color: chosenColor,
      opacity: 0.45,
      jobs: [],
    };

    setState((prev) => ({
      ...prev,
      zoneCounter: newZoneCounter,
      zones: [...prev.zones, newZone],
      selectedItemIds: [newZone.id],
    }));

    setHoveredRoomPolygon(null);
    return;
  }

  // 2. Handmatig punten plaatsen
  if (zonePoints.length >= 3) {
    const startPt = zonePoints[0];
    // Sluit polygoon als er nabij het startpunt wordt geklikt
    if (dist(pt, startPt) < 22) {
      const newZoneCounter = state.zoneCounter + 1;
      const colorPresets = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6'];
      const chosenColor = colorPresets[(newZoneCounter - 1) % colorPresets.length];

      const newZone: Zone = {
        id: `zone_${newZoneCounter}`,
        label: `Ruimte ${newZoneCounter}`,
        points: [...zonePoints],
        color: chosenColor,
        opacity: 0.45,
        jobs: [],
      };

      setState((prev) => ({
        ...prev,
        zoneCounter: newZoneCounter,
        zones: [...prev.zones, newZone],
        selectedItemIds: [newZone.id],
      }));

      setZonePoints([]);
      return;
    }
  }

  setZonePoints((prev) => [...prev, pt]);
  return;
}

    // --- TOOL: CUT / SPLIT ZONE (zones only; start/end snap to walls) ---
    if (state.activeTool === 'cut_zone') {
      const getProcessedCutPoint = (raw: Point, startPoint?: Point): Point => {
        let best = raw;
        let bestD = 25;
        for (const w of state.walls) {
          for (const e of [
            { x: w.x1, y: w.y1 },
            { x: w.x2, y: w.y2 },
          ]) {
            const d = dist(raw, e);
            if (d < bestD) {
              bestD = d;
              best = e;
            }
          }
        }
        for (const w of state.walls) {
          const res = distToSegment(raw, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
          if (res.distance < bestD) {
            bestD = res.distance;
            best = res.projection;
          }
        }

        if (startPoint && state.orthoSnap) {
          const dx = Math.abs(best.x - startPoint.x);
          const dy = Math.abs(best.y - startPoint.y);
          if (dx > dy) {
            return { x: best.x, y: startPoint.y };
          } else {
            return { x: startPoint.x, y: best.y };
          }
        }

        return best;
      };

      if (cutPoints.length === 0) {
        setCutPoints([getProcessedCutPoint(pt)]);
      } else {
        const p1 = cutPoints[0];
        const p2 = getProcessedCutPoint(pt, p1);

        if (dist(p1, p2) > 5) {
          // Split EVERY zone the cut line crosses
          let newZones: typeof state.zones = [];
          let updatedZoneCounter = state.zoneCounter;
          let splitOccurred = false;

          for (const zone of state.zones) {
            const splitResult = splitPolygonWithLine(zone.points, p1, p2);
            if (splitResult) {
              splitOccurred = true;
              updatedZoneCounter++;
              newZones.push({
                ...zone,
                id: `zone_${updatedZoneCounter}`,
                label: `${zone.label} A`,
                points: splitResult[0],
                labelOffset: undefined,
              });
              updatedZoneCounter++;
              newZones.push({
                ...zone,
                id: `zone_${updatedZoneCounter}`,
                label: `${zone.label} B`,
                points: splitResult[1],
                labelOffset: undefined,
              });
            } else {
              newZones.push(zone);
            }
          }

          if (splitOccurred) {
            setState((prev) => ({
              ...prev,
              zones: newZones,
              zoneCounter: updatedZoneCounter,
            }));
          }
        }

        setCutPoints([]);
      }
      return;
    }

    // --- TOOL: SPLIT WALL ---
    if (state.activeTool === 'split_wall') {
      const splitSnap = findWallSplitSnapPoint(pt, state.walls, 35);
      if (splitSnap) {
        const res = splitWallAtPoint(
          splitSnap.wall,
          splitSnap.splitPoint,
          state.walls,
          state.openings,
          state.wallCounter
        );
        setState((prev) => ({
          ...prev,
          walls: res.walls,
          openings: res.openings,
          wallCounter: res.newWallCounter,
        }));
      }
      return;
    }

    // --- TOOL: DOOR OR WINDOW ---
    if (state.activeTool === 'door' || state.activeTool === 'window') {
      // Find closest wall
      let closestWall: Wall | null = null;
      let minDistance = 25; // max click distance in pixels
      let bestRatio = 0.5;

      for (const w of state.walls) {
        const v = { x: w.x1, y: w.y1 };
        const m = { x: w.x2, y: w.y2 };
        const res = distToSegment(pt, v, m);
        if (res.distance < minDistance) {
          minDistance = res.distance;
          closestWall = w;
          bestRatio = Math.max(0.1, Math.min(0.9, res.ratio));
        }
      }

      if (closestWall) {
        const newOpeningCounter = state.openingCounter + 1;
        const openingType = state.activeTool === 'door' ? 'Door' : 'Window';
        const newOpeningId = `opening_${newOpeningCounter}`;

        const newOpening: Opening = {
          id: newOpeningId,
          wallId: closestWall.id,
          type: openingType,
          label: openingType === 'Door' ? `Deur ${newOpeningCounter}` : `Raam ${newOpeningCounter}`,
          offsetRatio: bestRatio,
          widthMeters: openingType === 'Door' ? 0.9 : 1.2,
          heightMeters: openingType === 'Door' ? 2.1 : 1.4,
          flipSide: false,
          flipHand: false,
          jobs: [],
        };

        setState((prev) => ({
          ...prev,
          openingCounter: newOpeningCounter,
          openings: [...prev.openings, newOpening],
          walls: prev.walls.map((w) =>
            w.id === closestWall!.id ? { ...w, openings: [...w.openings, newOpeningId] } : w
          ),
          selectedItemIds: [newOpeningId],
        }));
      }
    }
  };

  // Double Click Handler to end wall drawing chain
  const handleDoubleClick = () => {
    if (state.activeTool === 'wall') {
      setWallChainPoints([]);
    }
  };

  // Keydown Handler (Escape, Delete, Keyboard Shortcuts)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        if (calibratePoints.length > 0) {
          setCalibratePoints([]);
        } else if (wallChainPoints.length > 0) {
          setWallChainPoints([]);
        } else if (zonePoints.length > 0) {
          setZonePoints([]);
        } else if (cutPoints.length > 0) {
          setCutPoints([]);
        } else {
          setState((prev) => ({ ...prev, activeTool: 'select' }));
        }
      }

      if (e.key === 'Enter') {
        setWallChainPoints([]);
        setZonePoints([]);
        setCutPoints([]);
        setCalibratePoints([]);
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.activeTab === 'general') return; // In General tab, item deletion is disabled

        if (state.selectedItemIds.length > 0) {
          const selectedId = state.selectedItemIds[0];
          setState((prev) => ({
            ...prev,
            walls: prev.walls.filter((w) => w.id !== selectedId),
            zones: prev.zones.filter((z) => z.id !== selectedId),
            openings: prev.openings.filter((o) => o.id !== selectedId),
            selectedItemIds: [],
          }));
        }
      }

      // Quick Key Shortcuts
      if (e.key === 's' || e.key === 'S') setState((p) => ({ ...p, activeTool: 'select' }));
      if (e.key === 'm' || e.key === 'M') setState((p) => ({ ...p, activeTool: 'wall' }));
      if (e.key === 'r' || e.key === 'R') setState((p) => ({ ...p, activeTool: 'zone' }));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedItemIds, setState, wallChainPoints.length, zonePoints.length, cutPoints.length, calibratePoints.length]);

  // Reset calibratePoints when active tool changes
  useEffect(() => {
    if (state.activeTool !== 'calibrate') {
      setCalibratePoints([]);
      setCalibrateInnerPoints(null);
    }
  }, [state.activeTool]);

  // Mouse Down for Pan (Right Click e.button === 2, Middle button, or Shift+Left)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2 || e.button === 1 || e.shiftKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedItemId(null);
  };

  // Mouse Wheel for Zooming — zoom toward cursor position
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setState((prev) => {
      const oldZoom = prev.view.zoom;
      const newZoom = Math.min(2.5, Math.max(0.4, oldZoom * zoomFactor));
      const rounded = Math.round(newZoom * 100) / 100;
      // Keep the world point under the cursor fixed
      const worldX = (mouseX - prev.view.pan.x) / oldZoom;
      const worldY = (mouseY - prev.view.pan.y) / oldZoom;
      const newPan = {
        x: mouseX - worldX * rounded,
        y: mouseY - worldY * rounded,
      };
      return {
        ...prev,
        view: { zoom: rounded, pan: newPan },
      };
    });
  };

  // Helper function to handle item click for erasure or selection
  const handleItemClick = (e: React.MouseEvent, itemId: string) => {
    if (state.activeTool === 'eraser') {
      e.stopPropagation();
      setState((prev) => ({
        ...prev,
        walls: prev.walls.filter((w) => w.id !== itemId),
        zones: prev.zones.filter((z) => z.id !== itemId),
        openings: prev.openings.filter((o) => o.id !== itemId),
        selectedItemIds: prev.selectedItemIds.filter((id) => id !== itemId),
      }));
    } else if (state.activeTool === 'select' || state.activeTab === 'general') {
      e.stopPropagation();
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
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onClick={handleCanvasClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative w-full h-full bg-slate-950 overflow-hidden cursor-${
        isPanning ? 'grabbing' : state.activeTool === 'select' ? 'default' : 'crosshair'
      }`}
    >
      <svg className="w-full h-full pointer-events-auto">
        <defs>
          {/* Scaled 1-meter Grid Pattern */}
          <pattern
            id="grid-pattern"
            width={state.scalePxPerMeter * state.view.zoom}
            height={state.scalePxPerMeter * state.view.zoom}
            patternUnits="userSpaceOnUse"
            x={state.view.pan.x % (state.scalePxPerMeter * state.view.zoom)}
            y={state.view.pan.y % (state.scalePxPerMeter * state.view.zoom)}
          >
            <path
              d={`M ${state.scalePxPerMeter * state.view.zoom} 0 L 0 0 0 ${
                state.scalePxPerMeter * state.view.zoom
              }`}
              fill="none"
              stroke="#1e293b"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        {/* Grid Background Layer */}
        {state.gridVisible && (
          <rect width="100%" height="100%" fill="url(#grid-pattern)" />
        )}

        {/* Main Transformed Group for World Space Coordinates */}
        <g
          transform={`translate(${state.view.pan.x}, ${state.view.pan.y}) scale(${state.view.zoom})`}
        >
          {/* 1. Background Floor Plan Images */}
          {state.backgrounds.map((bg) => (
            <g
              key={bg.id}
              transform={`translate(${bg.x}, ${bg.y}) scale(${bg.scale})`}
              opacity={bg.opacity ?? 0.9}
            >
              <image
                href={bg.url}
                width={bg.width || 800}
                height={bg.height || 600}
                preserveAspectRatio="xMidYMid meet"
              />
            </g>
          ))}

{/* 2. Zones / Rooms Polygons */}
{state.zones.map((zone) => {
  const isSelected = state.selectedItemIds.includes(zone.id);
  const areaM2 = calculateZoneNetArea(zone.points, state.walls, state.wallTypeThicknesses, state.scalePxPerMeter);
  const centroid = getPolygonCentroid(zone.points);
  const labelOx = zone.labelOffset?.x ?? 0;
  const labelOy = zone.labelOffset?.y ?? 0;
  const pointsString = zone.points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <g key={zone.id}>
      {/* Ruimte Vlak */}
      <polygon
        points={pointsString}
        fill={zone.color}
        fillOpacity={zone.opacity}
        stroke={isSelected ? '#f59e0b' : zone.color}
        strokeWidth={isSelected ? '2.5' : '1'}
        strokeDasharray={isSelected ? '6,3' : 'none'}
        onClick={(e) => handleItemClick(e, zone.id)}
        className="cursor-pointer hover:fill-opacity-60 transition-all duration-150"
      />

      {/* Verplaatsbaar Ruimtelabel Badge */}
      <g
        transform={`translate(${centroid.x + labelOx}, ${centroid.y + labelOy})`}
        onMouseDown={(e) => {
          if (e.button !== 0 || state.activeTool !== 'select') return;
          e.stopPropagation();
          setDraggedItemId(`zone_label_${zone.id}`);
          setState((prev) => ({ ...prev, selectedItemIds: [zone.id] }));
        }}
        className={
          state.activeTool === 'select'
            ? 'cursor-grab active:cursor-grabbing'
            : 'pointer-events-none'
        }
      >
        <rect
          x="-45"
          y="-14"
          width="90"
          height="28"
          rx="8"
          fill="#020617"
          fillOpacity="0.85"
          stroke={isSelected ? '#f59e0b' : '#334155'}
          strokeWidth="1.5"
          className="shadow-md"
        />
        <text
          x="0"
          y="-2"
          textAnchor="middle"
          fill="#f8fafc"
          fontSize="9.5"
          fontWeight="700"
        >
          {zone.label}
        </text>
        <text
          x="0"
          y="9"
          textAnchor="middle"
          fill="#38bdf8"
          fontSize="8.5"
          fontWeight="600"
        >
          {areaM2} m²
        </text>
      </g>
      {/* Job Badge for Zone */}
      {(() => {
        const zoneJobs = state.jobs.filter((j) => j.assignedItemIds.includes(zone.id));
        if (zoneJobs.length === 0) return null;
        return (
          <g transform={`translate(${centroid.x + labelOx}, ${centroid.y + labelOy + 20})`} className="pointer-events-none">
            <rect x="-26" y="-8" width="52" height="16" rx="8" fill="#020617" fillOpacity="0.95" stroke="#f59e0b" strokeWidth="1.2" />
            <text x="0" y="3.5" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="bold">
              🔨 {zoneJobs.length} klus{zoneJobs.length > 1 ? 'sen' : ''}
            </text>
          </g>
        );
      })()}
    </g>
  );
})}

          {/* 3. Walls (Sorted by hierarchy: Scheidingswand -> Binnenmuur -> Buitengevel on top) */}
          {(() => {
            const wallPriority: Record<string, number> = {
              'Scheidingswand': 1,
              'Binnenmuur': 2,
              'Buitengevel': 3,
            };
            const sortedWalls = [...state.walls].sort((a, b) => {
              const pA = wallPriority[a.type] || 2;
              const pB = wallPriority[b.type] || 2;
              return pA - pB;
            });

            return sortedWalls.map((wall) => {
              const isSelected = state.selectedItemIds.includes(wall.id);
              const wallAngle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1);

              // Wall rendering style based on type
              let strokeColor = '#64748b'; // default
              if (wall.type === 'Buitengevel') strokeColor = '#cbd5e1';
              if (wall.type === 'Scheidingswand') strokeColor = '#94a3b8';

              const thicknessPx = wall.thicknessPx || 12;
              const isSelectOrEraser =
                state.activeTool === 'select' ||
                state.activeTool === 'eraser' ||
                state.activeTab === 'general';
              const showHandles = wall.type === 'Buitengevel' || isSelected;

              return (
                <g
                  key={wall.id}
                  className={isSelectOrEraser ? 'pointer-events-auto' : 'pointer-events-none'}
                >
                  {/* Wide invisible hit area for effortless clicking/selection */}
                  <line
                    x1={wall.x1}
                    y1={wall.y1}
                    x2={wall.x2}
                    y2={wall.y2}
                    stroke="transparent"
                    strokeWidth={Math.max(28, thicknessPx + 20)}
                    strokeLinecap="round"
                    onClick={isSelectOrEraser ? (e) => handleItemClick(e, wall.id) : undefined}
                    className={isSelectOrEraser ? 'cursor-pointer' : 'pointer-events-none'}
                  />

                  {/* Main Wall Line */}
                  <line
                    x1={wall.x1}
                    y1={wall.y1}
                    x2={wall.x2}
                    y2={wall.y2}
                    stroke={isSelected ? '#f59e0b' : strokeColor}
                    strokeWidth={Math.max(6, thicknessPx)}
                    strokeLinecap="square"
                    onClick={isSelectOrEraser ? (e) => handleItemClick(e, wall.id) : undefined}
                    className={
                      isSelectOrEraser
                        ? 'cursor-pointer hover:stroke-amber-400 transition'
                        : 'pointer-events-none'
                    }
                  />

                  {/* Dimension text drawn ON the wall stroke (clear span / vrije span) */}
                  {(() => {
                    const span = getWallClearSpan(
                      wall,
                      state.walls,
                      state.wallTypeThicknesses,
                      state.scalePxPerMeter
                    );
                    const spanPx = dist(span.p0, span.p1);
                    if (spanPx < 28) return null;
                    const mx = (span.p0.x + span.p1.x) / 2;
                    const my = (span.p0.y + span.p1.y) / 2;
                    const label = `${span.lengthMeters.toFixed(2).replace('.', ',')} m`;
                    // Keep text upright: flip 180° when wall runs right-to-left
                    let textDeg = (wallAngle * 180) / Math.PI;
                    if (textDeg > 90 || textDeg < -90) textDeg += 180;
                    return (
                      <g transform={`translate(${mx}, ${my}) rotate(${textDeg})`}>
                        <text
                          x="0"
                          y="3.5"
                          textAnchor="middle"
                          fill={isSelected ? '#0f172a' : '#f8fafc'}
                          fontSize="9"
                          fontWeight="bold"
                          style={{ pointerEvents: 'none', userSelect: 'none' }}
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })()}

                  {/* Wall Endpoints Handles */}
                  {showHandles && (
                    <>
                      <circle cx={wall.x1} cy={wall.y1} r="3" fill="#cbd5e1" />
                      <circle cx={wall.x2} cy={wall.y2} r="3" fill="#cbd5e1" />
                    </>
                  )}

                  {/* Wall Job Badge */}
                  {(() => {
                    const wallJobs = state.jobs.filter((j) => j.assignedItemIds.includes(wall.id));
                    if (wallJobs.length === 0) return null;
                    const mx = (wall.x1 + wall.x2) / 2;
                    const my = (wall.y1 + wall.y2) / 2;
                    return (
                      <g transform={`translate(${mx}, ${my - 14})`} className="pointer-events-none">
                        <rect x="-18" y="-7" width="36" height="14" rx="7" fill="#020617" fillOpacity="0.95" stroke="#f59e0b" strokeWidth="1" />
                        <text x="0" y="3" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="bold">
                          🔨 {wallJobs.length}
                        </text>
                      </g>
                    );
                  })()}
                </g>
              );
            });
          })()}

          {/* Clear-span measure line when a wall is selected (debug + verify) */}
          {(() => {
            const selId = state.selectedItemIds[0];
            if (!selId) return null;
            const selWall = state.walls.find((w) => w.id === selId);
            if (!selWall) return null;
            const span = getWallClearSpan(
              selWall,
              state.walls,
              state.wallTypeThicknesses,
              state.scalePxPerMeter
            );
            const ang = Math.atan2(span.p1.y - span.p0.y, span.p1.x - span.p0.x);
            const nx = -Math.sin(ang);
            const ny = Math.cos(ang);
            const tick = 6;
            return (
              <g className="pointer-events-none">
                <line
                  x1={span.p0.x}
                  y1={span.p0.y}
                  x2={span.p1.x}
                  y2={span.p1.y}
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeDasharray="5,3"
                />
                <line
                  x1={span.p0.x - nx * tick}
                  y1={span.p0.y - ny * tick}
                  x2={span.p0.x + nx * tick}
                  y2={span.p0.y + ny * tick}
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                />
                <line
                  x1={span.p1.x - nx * tick}
                  y1={span.p1.y - ny * tick}
                  x2={span.p1.x + nx * tick}
                  y2={span.p1.y + ny * tick}
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                />
                <circle cx={span.p0.x} cy={span.p0.y} r="3.5" fill="#f59e0b" />
                <circle cx={span.p1.x} cy={span.p1.y} r="3.5" fill="#f59e0b" />
              </g>
            );
          })()}

          {/* 4. Openings (Doors & Windows) */}
          {state.openings.map((opening) => {
            const wall = state.walls.find((w) => w.id === opening.wallId);
            if (!wall) return null;

            const isSelected = state.selectedItemIds.includes(opening.id);

            // Compute position on wall
            const posX = wall.x1 + (wall.x2 - wall.x1) * opening.offsetRatio;
            const posY = wall.y1 + (wall.y2 - wall.y1) * opening.offsetRatio;
            const wallAngle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1);
            const widthPx = opening.widthMeters * state.scalePxPerMeter;

            return (
              <g
                key={opening.id}
                transform={`translate(${posX}, ${posY}) rotate(${(wallAngle * 180) / Math.PI})`}
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  if (state.activeTool !== 'select') return;
                  if (opening.isLocked) return;
                  e.stopPropagation();
                  setDraggedItemId(opening.id);
                  setState((prev) => ({ ...prev, selectedItemIds: [opening.id] }));
                }}
                onClick={(e) => handleItemClick(e, opening.id)}
                className={
                  state.activeTool === 'select'
                    ? opening.isLocked
                      ? 'cursor-default'
                      : 'cursor-grab active:cursor-grabbing'
                    : 'cursor-pointer'
                }
              >
                {/* Wall cutout representation */}
                <rect
                  x={-widthPx / 2}
                  y="-8"
                  width={widthPx}
                  height="16"
                  fill="#0f172a"
                  stroke={isSelected ? '#f59e0b' : '#0284c7'}
                  strokeWidth="2"
                  rx="2"
                />

                {opening.type === 'Door' ? (
                  // Door swing arc with flipSide (inside/outside) and flipHand (hinge side left/right)
                  <g>
                    {(() => {
                      const hingeX = opening.flipHand ? widthPx / 2 : -widthPx / 2;
                      const swingX = opening.flipHand ? -widthPx / 2 : widthPx / 2;
                      const yDir = opening.flipSide ? widthPx : -widthPx;
                      const sweep = (opening.flipSide ? 0 : 1) ^ (opening.flipHand ? 1 : 0);

                      return (
                        <>
                          <line
                            x1={hingeX}
                            y1="0"
                            x2={hingeX}
                            y2={yDir}
                            stroke="#38bdf8"
                            strokeWidth="2"
                          />
                          <path
                            d={`M ${hingeX} ${yDir} A ${widthPx} ${widthPx} 0 0 ${sweep} ${swingX} 0`}
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="1.5"
                            strokeDasharray="3,3"
                          />
                        </>
                      );
                    })()}
                  </g>
                ) : (
                  // Window glass lines
                  <g>
                    <line
                      x1={-widthPx / 2}
                      y1="-2"
                      x2={widthPx / 2}
                      y2="-2"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                    />
                    <line
                      x1={-widthPx / 2}
                      y1="2"
                      x2={widthPx / 2}
                      y2="2"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                    />
                  </g>
                )}

                {/* Opening Job Badge */}
                {(() => {
                  const openingJobs = state.jobs.filter((j) => j.assignedItemIds.includes(opening.id));
                  if (openingJobs.length === 0) return null;
                  return (
                    <g transform="translate(0, -18)" className="pointer-events-none">
                      <rect x="-14" y="-7" width="28" height="14" rx="7" fill="#020617" fillOpacity="0.95" stroke="#38bdf8" strokeWidth="1" />
                      <text x="0" y="3" textAnchor="middle" fill="#38bdf8" fontSize="7.5" fontWeight="bold">
                        🔨 {openingJobs.length}
                      </text>
                    </g>
                  );
                })()}

                {/* Label inside opening; counter-rotate 180° when wall is right-to-left */}
                {widthPx > 18 && (
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    fill="#7dd3fc"
                    fontSize={Math.min(9, Math.max(6, widthPx / 8))}
                    fontWeight="bold"
                    transform={Math.cos(wallAngle) < 0 ? 'rotate(180)' : undefined}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {widthPx > 40
                      ? `${opening.type === 'Door' ? 'D' : 'R'} ${opening.widthMeters}m`
                      : `${opening.widthMeters}`}
                  </text>
                )}
              </g>
            );
          })}

          {/* 5. Real-time Drawing Previews */}
          {/* Wall drawing preview line */}
          {state.activeTool === 'wall' && wallChainPoints.length > 0 && (
            <g>
              <line
                x1={wallChainPoints[wallChainPoints.length - 1].x}
                y1={wallChainPoints[wallChainPoints.length - 1].y}
                x2={mouseWorld.x}
                y2={mouseWorld.y}
                stroke="#f59e0b"
                strokeWidth="4"
                strokeDasharray="6,4"
              />
              <text
                x={(wallChainPoints[wallChainPoints.length - 1].x + mouseWorld.x) / 2}
                y={(wallChainPoints[wallChainPoints.length - 1].y + mouseWorld.y) / 2 - 10}
                fill="#fbbf24"
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
              >
                {(
                  dist(wallChainPoints[wallChainPoints.length - 1], mouseWorld) /
                  state.scalePxPerMeter
                )
                  .toFixed(2)
                  .replace('.', ',')}{' '}
                m
              </text>
            </g>
          )}

          {/* Zone drawing preview lines */}
          {state.activeTool === 'zone' && zonePoints.length > 0 && (
            <g>
              <polyline
                points={zonePoints.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
              />
              <line
                x1={zonePoints[zonePoints.length - 1].x}
                y1={zonePoints[zonePoints.length - 1].y}
                x2={mouseWorld.x}
                y2={mouseWorld.y}
                stroke="#38bdf8"
                strokeWidth="2"
                strokeDasharray="4,4"
              />
            </g>
          )}

          {/* Split / Cut Zone preview line */}
          {state.activeTool === 'cut_zone' && cutPoints.length > 0 && (() => {
            let target = mouseWorld;
            let bestD = 25;
            for (const w of state.walls) {
              for (const e of [
                { x: w.x1, y: w.y1 },
                { x: w.x2, y: w.y2 },
              ]) {
                const d = dist(mouseWorld, e);
                if (d < bestD) {
                  bestD = d;
                  target = e;
                }
              }
            }
            for (const w of state.walls) {
              const res = distToSegment(mouseWorld, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
              if (res.distance < bestD) {
                bestD = res.distance;
                target = res.projection;
              }
            }
            if (state.orthoSnap) {
              const dx = Math.abs(target.x - cutPoints[0].x);
              const dy = Math.abs(target.y - cutPoints[0].y);
              target = dx > dy ? { x: target.x, y: cutPoints[0].y } : { x: cutPoints[0].x, y: target.y };
            }

            return (
              <g className="pointer-events-none">
                <line
                  x1={cutPoints[0].x}
                  y1={cutPoints[0].y}
                  x2={target.x}
                  y2={target.y}
                  stroke="#f43f5e"
                  strokeWidth="2.5"
                  strokeDasharray="5,4"
                />
                <circle cx={cutPoints[0].x} cy={cutPoints[0].y} r="5" fill="#f43f5e" stroke="#ffffff" strokeWidth="1.5" />
                <circle cx={target.x} cy={target.y} r="5" fill="#f43f5e" stroke="#ffffff" strokeWidth="1.5" />
                <g transform={`translate(${(cutPoints[0].x + target.x) / 2}, ${(cutPoints[0].y + target.y) / 2 - 14})`}>
                  <rect x="-45" y="-12" width="90" height="24" rx="6" fill="#020617" fillOpacity="0.95" stroke="#f43f5e" strokeWidth="1.5" />
                  <text x="0" y="3" textAnchor="middle" fill="#fb7185" fontSize="11" fontWeight="bold">
                    ✂ Snijlijn
                  </text>
                </g>
              </g>
            );
          })()}

{/* Hovered Auto-Detected Room Preview */}
{state.activeTool === 'zone' && hoveredRoomPolygon && (
  <g className="pointer-events-none">
    {(() => {
      const centroid = getPolygonCentroid(hoveredRoomPolygon);
	const areaM2 = calculateZoneNetArea(hoveredRoomPolygon, state.walls, state.wallTypeThicknesses, state.scalePxPerMeter);
      const pointsStr = hoveredRoomPolygon.map((p) => `${p.x},${p.y}`).join(' ');

      return (
        <>
          {/* Oplichtende kamer contour */}
          <polygon
            points={pointsStr}
            fill="rgba(16, 185, 129, 0.22)"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeDasharray="5,3"
          />

          {/* Zwevende interactieve badge */}
          <g transform={`translate(${centroid.x}, ${centroid.y})`}>
            <rect
              x="-85"
              y="-16"
              width="170"
              height="32"
              rx="10"
              fill="#020617"
              fillOpacity="0.9"
              stroke="#10b981"
              strokeWidth="1.5"
            />
            <text
              x="0"
              y="4"
              textAnchor="middle"
              fill="#34d399"
              fontSize="11"
              fontWeight="700"
            >
              Klik voor Ruimte ({areaM2} m²)
            </text>
          </g>
        </>
      );
    })()}
  </g>
)}

          {/* Calibration preview line */}
          {state.activeTool === 'calibrate' && calibratePoints.length >= 1 && (
            (() => {
              const p1 = calibratePoints[0];
              const p2 = calibratePoints.length === 2 ? calibratePoints[1] : mouseWorld;
              const pxLen = dist(p1, p2);

              const ip1 = calibrateInnerPoints ? calibrateInnerPoints.p1 : p1;
              const ip2 = calibrateInnerPoints ? calibrateInnerPoints.p2 : p2;
              const spanPx = calibrateInnerPoints ? dist(ip1, ip2) : pxLen;

              // Compute perpendicular vector for inner face ticks
              const lSpan = dist(ip1, ip2) || 1;
              const ux = (ip2.x - ip1.x) / lSpan;
              const uy = (ip2.y - ip1.y) / lSpan;
              const nx = -uy * 10;
              const ny = ux * 10;

              return (
                <g className="pointer-events-none">
                  {/* Subtle centerline connection line */}
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    strokeDasharray="4,4"
                  />
                  <circle cx={p1.x} cy={p1.y} r="4" fill="#94a3b8" />
                  <circle cx={p2.x} cy={p2.y} r="4" fill="#94a3b8" />

                  {/* Highlighted Vrije Span (Binnenmaat) line */}
                  {calibrateInnerPoints && (
                    <>
                      <line
                        x1={ip1.x}
                        y1={ip1.y}
                        x2={ip2.x}
                        y2={ip2.y}
                        stroke="#10b981"
                        strokeWidth="4"
                      />
                      {/* End tick bars at inner wall faces */}
                      <line
                        x1={ip1.x - nx}
                        y1={ip1.y - ny}
                        x2={ip1.x + nx}
                        y2={ip1.y + ny}
                        stroke="#10b981"
                        strokeWidth="3"
                      />
                      <line
                        x1={ip2.x - nx}
                        y1={ip2.y - ny}
                        x2={ip2.x + nx}
                        y2={ip2.y + ny}
                        stroke="#10b981"
                        strokeWidth="3"
                      />
                      <circle cx={ip1.x} cy={ip1.y} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                      <circle cx={ip2.x} cy={ip2.y} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                    </>
                  )}

                  <g transform={`translate(${(ip1.x + ip2.x) / 2}, ${(ip1.y + ip2.y) / 2 - 18})`}>
                    <rect x="-85" y="-16" width="170" height="30" rx="8" fill="#020617" fillOpacity="0.95" stroke={calibrateInnerPoints ? "#10b981" : "#f59e0b"} strokeWidth="1.5" />
                    <text x="0" y="-2" textAnchor="middle" fill={calibrateInnerPoints ? "#34d399" : "#fbbf24"} fontSize="11" fontWeight="bold">
                      VRIJE SPAN: {Math.round(spanPx)} px
                    </text>
                    <text x="0" y="9" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="semibold">
                      (Binnenmaat tussen muren)
                    </text>
                  </g>
                </g>
              );
            })()
          )}

          {/* Visible Magnetic Snap Detection Box Overlay */}
          {state.activeTool === 'wall' && wallChainPoints.length > 0 && state.magneticSnap && (
            (() => {
              const prevPt = wallChainPoints[wallChainPoints.length - 1];
              const dx = Math.abs(rawMouseWorld.x - prevPt.x);
              const dy = Math.abs(rawMouseWorld.y - prevPt.y);
              const isHorizontal = dx >= dy;
              const searchRadius = state.snapSearchRadius ?? 25;
              const boxThickness = 8;
              const boxLength = searchRadius * 2;

              const isHaakse = snapIndicator?.label === 'HAAKSE-MUUR';

              if (isHorizontal) {
                const boxX = rawMouseWorld.x - boxLength / 2;
                const boxY = rawMouseWorld.y - boxThickness / 2;
                return (
                  <g className="pointer-events-none">
                    <rect
                      x={boxX}
                      y={boxY}
                      width={boxLength}
                      height={boxThickness}
                      rx={3}
                      fill={isHaakse ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.18)'}
                      stroke={isHaakse ? '#10b981' : '#f59e0b'}
                      strokeWidth="1.5"
                      strokeDasharray="4,2"
                    />
                    <line
                      x1={rawMouseWorld.x}
                      y1={rawMouseWorld.y - 12}
                      x2={rawMouseWorld.x}
                      y2={rawMouseWorld.y + 12}
                      stroke={isHaakse ? '#10b981' : '#f59e0b'}
                      strokeWidth="1.5"
                    />
                  </g>
                );
              } else {
                const boxX = rawMouseWorld.x - boxThickness / 2;
                const boxY = rawMouseWorld.y - boxLength / 2;
                return (
                  <g className="pointer-events-none">
                    <rect
                      x={boxX}
                      y={boxY}
                      width={boxThickness}
                      height={boxLength}
                      rx={3}
                      fill={isHaakse ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.18)'}
                      stroke={isHaakse ? '#10b981' : '#f59e0b'}
                      strokeWidth="1.5"
                      strokeDasharray="4,2"
                    />
                    <line
                      x1={rawMouseWorld.x - 12}
                      y1={rawMouseWorld.y}
                      x2={rawMouseWorld.x + 12}
                      y2={rawMouseWorld.y}
                      stroke={isHaakse ? '#10b981' : '#f59e0b'}
                      strokeWidth="1.5"
                    />
                  </g>
                );
              }
            })()
          )}

          {/* Magnetic Snap Target Indicator */}
          {snapIndicator && state.activeTool !== 'select' && (
            <g transform={`translate(${snapIndicator.point.x}, ${snapIndicator.point.y})`} className="pointer-events-none">
              <circle
                r="14"
                fill="none"
                stroke={
                  snapIndicator.snapType === 'image_line'
                    ? '#10b981'
                    : snapIndicator.snapType === 'midpoint'
                    ? '#34d399'
                    : snapIndicator.snapType === 'perpendicular'
                    ? '#f59e0b'
                    : '#38bdf8'
                }
                strokeWidth="2"
                strokeDasharray="3,2"
                className="animate-spin"
              />
              <circle
                r="8"
                fill={
                  snapIndicator.snapType === 'image_line'
                    ? 'rgba(16, 185, 129, 0.35)'
                    : snapIndicator.snapType === 'midpoint'
                    ? 'rgba(52, 211, 153, 0.3)'
                    : snapIndicator.snapType === 'perpendicular'
                    ? 'rgba(245, 158, 11, 0.3)'
                    : 'rgba(56, 189, 248, 0.3)'
                }
                stroke={
                  snapIndicator.snapType === 'image_line'
                    ? '#10b981'
                    : snapIndicator.snapType === 'midpoint'
                    ? '#34d399'
                    : snapIndicator.snapType === 'perpendicular'
                    ? '#f59e0b'
                    : '#38bdf8'
                }
                strokeWidth="1.5"
              />
              <line
                x1="-12"
                y1="0"
                x2="12"
                y2="0"
                stroke={snapIndicator.snapType === 'image_line' ? '#10b981' : '#38bdf8'}
                strokeWidth="2"
              />
              <line
                x1="0"
                y1="-12"
                x2="0"
                y2="12"
                stroke={snapIndicator.snapType === 'image_line' ? '#10b981' : '#38bdf8'}
                strokeWidth="2"
              />
              <rect
                x="16"
                y="-12"
                width={Math.max(84, (snapIndicator.label || '').length * 7 + 16)}
                height="22"
                rx="6"
                fill="#020617"
                fillOpacity="0.95"
                stroke={snapIndicator.snapType === 'image_line' ? '#10b981' : '#38bdf8'}
                strokeWidth="1.5"
              />
              <text
                x={16 + Math.max(84, (snapIndicator.label || '').length * 7 + 16) / 2}
                y="3"
                fill={snapIndicator.snapType === 'image_line' ? '#34d399' : '#38bdf8'}
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
              >
                {snapIndicator.label || 'SNAP'}
              </text>
            </g>
          )}
        </g>
      </svg>

      {/* Top Banner Helpers for Active Tools */}
      {state.activeTool === 'split_wall' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900/95 backdrop-blur-md border border-amber-500/50 px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-3 text-xs text-amber-200 select-none">
          <span className="font-bold text-amber-400">✂ Muur Splitsen</span>
          <span>
            Beweeg over een muur en klik om hem te splitsen. Snapt automatisch haaks op kruisende/haakse muren!
          </span>
        </div>
      )}
      {state.activeTool === 'cut_zone' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900/95 backdrop-blur-md border border-rose-500/50 px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-3 text-xs text-rose-200 select-none">
          <Scissors className="w-4 h-4 text-rose-400" />
          <span>
            {cutPoints.length === 0
              ? 'Klik op een muur of hoek om de snijlijn te beginnen.'
              : 'Klik op de tegenoverliggende muur om de zone te splitsen (muren blijven heel).'}
          </span>
          {cutPoints.length > 0 && (
            <button
              onClick={() => setCutPoints([])}
              className="ml-2 text-[11px] bg-rose-950/80 hover:bg-rose-900 text-rose-300 px-2 py-0.5 rounded-md border border-rose-800 transition"
            >
              Annuleren
            </button>
          )}
        </div>
      )}
      {state.activeTool === 'calibrate' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900/95 backdrop-blur-md border border-amber-500/50 px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-3 text-xs text-amber-200 select-none">
          <Ruler className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>
            {calibratePoints.length === 0
              ? 'Kalibratie: Klik op de buitenrand/start van een bekende afstand op de muren.'
              : 'Klik op het eindpunt van de afstand om de schaal te berekenen.'}
          </span>
          <button
            onClick={() => {
              setCalibratePoints([]);
              setState((prev) => ({ ...prev, activeTool: 'select' }));
            }}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {state.activeTool === 'zone' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900/95 backdrop-blur-md border border-emerald-500/50 px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-3 text-xs text-emerald-200 select-none">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span>
            {hoveredRoomPolygon
              ? 'Klik om deze ingesloten ruimte automatisch vast te leggen!'
              : 'Beweeg over een ingesloten ruimte (muren) of klik punten om handmatig te tekenen.'}
          </span>
        </div>
      )}

      {state.activeTool === 'cut_zone' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900/95 backdrop-blur-md border border-rose-500/50 px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-3 text-xs text-rose-200 select-none">
          <span className="font-bold text-rose-400">✂ Ruimte Splitsen</span>
          <span>
            {cutPoints.length === 0
              ? 'Klik op het startpunt van de kniplijn.'
              : state.orthoSnap
              ? 'Klik op het eindpunt (Haaks / Ortho vergrendeld).'
              : 'Klik op het eindpunt van de kniplijn.'}
          </span>
        </div>
      )}

      {/* Modal Dialog for Scale Calibration (Floating card without background darkening) */}
      {showCalibrateModal && (
        <div className="absolute top-16 right-8 z-50 select-none shadow-2xl pointer-events-auto">
          <div className="bg-slate-900/95 backdrop-blur-md border border-amber-500/50 rounded-2xl p-5 max-w-sm w-80 shadow-2xl space-y-3.5 text-slate-100">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Ruler className="w-4 h-4 text-amber-400" />
                <span>Schaal Kalibreren</span>
              </h3>
              <button
                onClick={() => {
                  setShowCalibrateModal(false);
                  setCalibratePoints([]);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Gemeten <strong className="text-emerald-400 font-bold">Vrije Span (binnenmaat tussen muren)</strong>: <strong className="text-amber-300">{Math.round(calibrateMeasuredPx)} pixels</strong>.
              Vul de bekende vrije maat tussen de muren in (zie plattegrond):
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Afstand op plattegrond (meters):
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={calibrateInputMeters}
                  onChange={(e) => setCalibrateInputMeters(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none font-bold"
                  placeholder="bijv. 5.00"
                  autoFocus
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">
                  meter
                </span>
              </div>
            </div>

            {parseFloat(calibrateInputMeters) > 0 && (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300">
                Nieuwe schaal: {Math.round((calibrateMeasuredPx / parseFloat(calibrateInputMeters)) * 10) / 10} px/m.
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  setShowCalibrateModal(false);
                  setCalibratePoints([]);
                  setCalibrateInnerPoints(null);
                }}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition"
              >
                Annuleren
              </button>
              <button
                onClick={() => {
                  const m = parseFloat(calibrateInputMeters);
                  if (m > 0) {
                    const newScale = calibrateMeasuredPx / m;
                    setState((prev) => ({
                      ...prev,
                      scalePxPerMeter: Math.round(newScale * 10) / 10,
                      activeTool: 'select',
                    }));
                  }
                  setShowCalibrateModal(false);
                  setCalibratePoints([]);
                  setCalibrateInnerPoints(null);
                }}
                disabled={!parseFloat(calibrateInputMeters)}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-bold text-slate-950 transition shadow"
              >
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog for T-Junction Wall Split Confirmation */}
      {pendingTJunctionSplit && (() => {
        const screenPt = getWorldToScreen(
          pendingTJunctionSplit.splitPoint.x,
          pendingTJunctionSplit.splitPoint.y
        );
        const left = Math.max(16, Math.min(window.innerWidth - 340, screenPt.x + 20));
        const top = Math.max(16, Math.min(window.innerHeight - 220, screenPt.y - 40));

        return (
          <div
            className="fixed z-50 select-none shadow-2xl pointer-events-auto"
            style={{ left: `${left}px`, top: `${top}px` }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900/95 backdrop-blur-md border border-amber-500/60 rounded-2xl p-5 max-w-sm w-80 shadow-2xl space-y-3.5 text-slate-100 ring-2 ring-amber-500/30 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
                <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <Split className="w-4 h-4 text-amber-400" />
                  <span>T-splitsing gedetecteerd</span>
                </h3>
                <button
                  onClick={handleCancelTJunctionSplit}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                De nieuwe muur sluit aan op <strong className="text-amber-300">{pendingTJunctionSplit.hitWall.label}</strong>.
                <br />
                Wil je deze bestaande muur op de T-splitsing opsplitsen in 2 afzonderlijke muren?
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleCancelTJunctionSplit}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition"
                >
                  Nee, behoud 1 muur
                </button>
                <button
                  onClick={handleConfirmTJunctionSplit}
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 rounded-xl text-xs font-bold text-slate-950 transition shadow"
                >
                  Ja, splits muur
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
