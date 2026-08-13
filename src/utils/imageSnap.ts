import { Point, BackgroundImage } from '../types';

interface CachedImageCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

const canvasCache = new Map<string, CachedImageCanvas>();

export function getOrCacheImageCanvas(bg: BackgroundImage): CachedImageCanvas | null {
  if (canvasCache.has(bg.id)) {
    return canvasCache.get(bg.id)!;
  }

  if (!bg.url) return null;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = bg.url;

  if (img.complete && img.naturalWidth > 0) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);

    const cached: CachedImageCanvas = {
      canvas,
      ctx,
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
    canvasCache.set(bg.id, cached);
    return cached;
  } else {
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        canvasCache.set(bg.id, {
          canvas,
          ctx,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      }
    };
    return null;
  }
}

export interface SnapResult {
  point: Point;
  snapped: boolean;
  snapType: 'image_line';
  label: string;
}

// Snaps cursor to floorplan lines in uploaded background image.
export function snapToFloorplanBlackLines(
  cursor: Point,
  prevPoint: Point | null,
  backgrounds: BackgroundImage[],
  darknessThreshold = 50, // 0-255 brightness cutoff
  searchRadiusPx = 25 // search radius in canvas pixels
): SnapResult | null {
  for (const bg of backgrounds) {
    const cached = getOrCacheImageCanvas(bg);
    if (!cached) continue;

    const bgWidth = bg.width || 800;
    const bgHeight = bg.height || 600;

    // Bounds checking
    const worldWidth = bgWidth * bg.scale;
    const worldHeight = bgHeight * bg.scale;

    if (
      cursor.x < bg.x - 50 ||
      cursor.x > bg.x + worldWidth + 50 ||
      cursor.y < bg.y - 50 ||
      cursor.y > bg.y + worldHeight + 50
    ) {
      continue;
    }

    // Convert World coordinates to Image Pixel coordinates
    const scaleX = cached.width / bgWidth;
    const scaleY = cached.height / bgHeight;

    const cursorImgX = ((cursor.x - bg.x) / bg.scale) * scaleX;
    const cursorImgY = ((cursor.y - bg.y) / bg.scale) * scaleY;

    // Fixed 8px detection width in image space (or scaled)
    const boxThicknessImg = Math.max(6, Math.round(8 * scaleX));
    // Length of detection box in image space
    const boxLengthImg = Math.max(16, Math.round((searchRadiusPx || 60) * scaleX));

    if (!prevPoint) {
      // ==================== FIRST CLICK / STANDALONE HOVER ====================
      const px = Math.round(cursorImgX);
      const py = Math.round(cursorImgY);

      if (px < 0 || px >= cached.width || py < 0 || py >= cached.height) continue;

      const patchR = Math.max(20, boxLengthImg);
      const minX = Math.max(0, px - patchR);
      const maxX = Math.min(cached.width - 1, px + patchR);
      const minY = Math.max(0, py - patchR);
      const maxY = Math.min(cached.height - 1, py + patchR);

      const patchW = maxX - minX + 1;
      const patchH = maxY - minY + 1;

      if (patchW <= 0 || patchH <= 0) continue;

      try {
        const imgData = cached.ctx.getImageData(minX, minY, patchW, patchH);
        const data = imgData.data;

        const isDark = (x: number, y: number) => {
          const lx = Math.round(x - minX);
          const ly = Math.round(y - minY);
          if (lx < 0 || lx >= patchW || ly < 0 || ly >= patchH) return false;
          const idx = (ly * patchW + lx) * 4;
          if (data[idx + 3] < 80) return false;
          return (data[idx] + data[idx + 1] + data[idx + 2]) / 3 < darknessThreshold;
        };

        if (isDark(px, py)) {
          // Find X center
          let left = px;
          while (left > minX && isDark(left - 1, py)) left--;
          let right = px;
          while (right < maxX && isDark(right + 1, py)) right++;
          const centerX = (left + right) / 2;

          // Find Y center
          let top = py;
          while (top > minY && isDark(px, top - 1)) top--;
          let bot = py;
          while (bot < maxY && isDark(px, bot + 1)) bot++;
          const centerY = (top + bot) / 2;

          const worldX = bg.x + (centerX / scaleX) * bg.scale;
          const worldY = bg.y + (centerY / scaleY) * bg.scale;

          return {
            point: { x: worldX, y: worldY },
            snapped: true,
            snapType: 'image_line',
            label: 'MUUR-MIDDEN',
          };
        }
      } catch (e) {
        // Fallthrough
      }
      continue;
    }

    // ==================== DRAWING A WALL FROM PREVPOINT ====================
    const prevImgX = ((prevPoint.x - bg.x) / bg.scale) * scaleX;
    const prevImgY = ((prevPoint.y - bg.y) / bg.scale) * scaleY;

    const dx = Math.abs(cursor.x - prevPoint.x);
    const dy = Math.abs(cursor.y - prevPoint.y);

    const isHorizontalDrawing = dx >= dy;

    // Define search patch around actual mouse cursor position
    const pad = 100;
    const centerBoxImgX = Math.round(cursorImgX);
    const centerBoxImgY = Math.round(cursorImgY);

    const minX = Math.max(0, centerBoxImgX - boxLengthImg - pad);
    const maxX = Math.min(cached.width - 1, centerBoxImgX + boxLengthImg + pad);
    const minY = Math.max(0, centerBoxImgY - boxLengthImg - pad);
    const maxY = Math.min(cached.height - 1, centerBoxImgY + boxLengthImg + pad);

    const patchW = maxX - minX + 1;
    const patchH = maxY - minY + 1;

    if (patchW <= 0 || patchH <= 0) continue;

    try {
      const imgData = cached.ctx.getImageData(minX, minY, patchW, patchH);
      const data = imgData.data;

      const isDark = (imgX: number, imgY: number) => {
        const lx = Math.round(imgX - minX);
        const ly = Math.round(imgY - minY);
        if (lx < 0 || lx >= patchW || ly < 0 || ly >= patchH) return false;
        const idx = (ly * patchW + lx) * 4;
        if (data[idx + 3] < 80) return false;
        return (data[idx] + data[idx + 1] + data[idx + 2]) / 3 < darknessThreshold;
      };

      if (isHorizontalDrawing) {
        // HORIZONTAL DRAWING
        // Detection box is HORIZONTAL: height = boxThicknessImg (8px), length = boxLengthImg
        const boxMinX = Math.max(minX, centerBoxImgX - Math.floor(boxLengthImg / 2));
        const boxMaxX = Math.min(maxX, centerBoxImgX + Math.floor(boxLengthImg / 2));
        const boxMinY = Math.max(minY, centerBoxImgY - Math.floor(boxThicknessImg / 2));
        const boxMaxY = Math.min(maxY, centerBoxImgY + Math.floor(boxThicknessImg / 2));

        let perpCenterX: number | null = null;
        let minDist = Infinity;

        // Scan columns X inside the detection box for a vertical black wall
        for (let x = boxMinX; x <= boxMaxX; x++) {
          let darkPixelsInCol = 0;
          for (let y = boxMinY; y <= boxMaxY; y++) {
            if (isDark(x, y)) darkPixelsInCol++;
          }

          if (darkPixelsInCol >= 2) {
            // Vertical wall found in column X! Find left & right boundary across the wall at mouse Y
            let left = x;
            while (left > minX && isDark(left - 1, centerBoxImgY)) left--;

            let right = x;
            while (right < maxX && isDark(right + 1, centerBoxImgY)) right++;

            const wallThickness = right - left + 1;
            if (wallThickness >= 3 && wallThickness <= 90) {
              const candidateX = (left + right) / 2;
              const distToCursor = Math.abs(candidateX - cursorImgX);
              if (distToCursor < minDist) {
                minDist = distToCursor;
                perpCenterX = candidateX;
              }
            }
          }
        }

        if (perpCenterX !== null) {
          const worldX = bg.x + (perpCenterX / scaleX) * bg.scale;
          return {
            point: { x: worldX, y: prevPoint.y }, // STRICTLY STRAIGHT!
            snapped: true,
            snapType: 'image_line',
            label: 'HAAKSE-MUUR',
          };
        }

        // Check if current position is over a horizontal black line
        if (isDark(centerBoxImgX, centerBoxImgY)) {
          return {
            point: { x: cursor.x, y: prevPoint.y },
            snapped: true,
            snapType: 'image_line',
            label: 'MUUR-MIDDEN',
          };
        }
      } else {
        // VERTICAL DRAWING
        // Detection box is VERTICAL: width = boxThicknessImg (8px), length = boxLengthImg
        const boxMinX = Math.max(minX, centerBoxImgX - Math.floor(boxThicknessImg / 2));
        const boxMaxX = Math.min(maxX, centerBoxImgX + Math.floor(boxThicknessImg / 2));
        const boxMinY = Math.max(minY, centerBoxImgY - Math.floor(boxLengthImg / 2));
        const boxMaxY = Math.min(maxY, centerBoxImgY + Math.floor(boxLengthImg / 2));

        let perpCenterY: number | null = null;
        let minDist = Infinity;

        // Scan rows Y inside the detection box for a horizontal black wall
        for (let y = boxMinY; y <= boxMaxY; y++) {
          let darkPixelsInRow = 0;
          for (let x = boxMinX; x <= boxMaxX; x++) {
            if (isDark(x, y)) darkPixelsInRow++;
          }

          if (darkPixelsInRow >= 2) {
            // Horizontal wall found in row Y! Find top & bottom boundary across the wall
            let top = y;
            while (top > minY && isDark(centerBoxImgX, top - 1)) top--;

            let bot = y;
            while (bot < maxY && isDark(centerBoxImgX, bot + 1)) bot--;

            const wallThickness = bot - top + 1;
            if (wallThickness >= 3 && wallThickness <= 90) {
              const candidateY = (top + bot) / 2;
              const distToCursor = Math.abs(candidateY - cursorImgY);
              if (distToCursor < minDist) {
                minDist = distToCursor;
                perpCenterY = candidateY;
              }
            }
          }
        }

        if (perpCenterY !== null) {
          const worldY = bg.y + (perpCenterY / scaleY) * bg.scale;
          return {
            point: { x: prevPoint.x, y: worldY }, // STRICTLY STRAIGHT!
            snapped: true,
            snapType: 'image_line',
            label: 'HAAKSE-MUUR',
          };
        }

        // Check if current position is over a vertical black line
        if (isDark(centerBoxImgX, centerBoxImgY)) {
          return {
            point: { x: prevPoint.x, y: cursor.y },
            snapped: true,
            snapType: 'image_line',
            label: 'MUUR-MIDDEN',
          };
        }
      }
    } catch (e) {
      console.warn('Image pixel snap reading failed', e);
    }
  }

  return null;
}
