const SAMPLE_WIDTH = 160;
const SAMPLE_HEIGHT = 120;
const CELL_SIZE = 4;
const STABLE_FRAMES_REQUIRED = 3;
const SEARCH_INTERVAL_MS = 420;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toHsl(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { hue: 0, saturation: 0, lightness };
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue;

  switch (max) {
    case r:
      hue = ((g - b) / delta) + (g < b ? 6 : 0);
      break;
    case g:
      hue = ((b - r) / delta) + 2;
      break;
    default:
      hue = ((r - g) / delta) + 4;
      break;
  }

  return {
    hue: hue * 60,
    saturation,
    lightness,
  };
}

function isLikelyRimPixel(red, green, blue, alpha) {
  if (alpha < 120) return false;
  const { hue, saturation, lightness } = toHsl(red, green, blue);
  return hue >= 10 && hue <= 52 && saturation >= 0.32 && lightness >= 0.16 && lightness <= 0.8;
}

function buildActiveGrid(data, width, height) {
  const gridWidth = Math.ceil(width / CELL_SIZE);
  const gridHeight = Math.ceil(height / CELL_SIZE);
  const grid = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(0));

  for (let y = 0; y < height; y += 1) {
    if (y > height * 0.82) continue;
    for (let x = 0; x < width; x += 1) {
      const index = ((y * width) + x) * 4;
      if (!isLikelyRimPixel(data[index], data[index + 1], data[index + 2], data[index + 3])) {
        continue;
      }

      grid[Math.floor(y / CELL_SIZE)][Math.floor(x / CELL_SIZE)] += 1;
    }
  }

  return grid;
}

function extractComponents(grid) {
  const height = grid.length;
  const width = grid[0]?.length || 0;
  const visited = Array.from({ length: height }, () => Array(width).fill(false));
  const components = [];

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      if (visited[row][col] || grid[row][col] < 2) continue;

      const queue = [[row, col]];
      visited[row][col] = true;
      let minRow = row;
      let maxRow = row;
      let minCol = col;
      let maxCol = col;
      let activeCells = 0;
      let weight = 0;

      while (queue.length) {
        const [currentRow, currentCol] = queue.shift();
        activeCells += 1;
        weight += grid[currentRow][currentCol];
        minRow = Math.min(minRow, currentRow);
        maxRow = Math.max(maxRow, currentRow);
        minCol = Math.min(minCol, currentCol);
        maxCol = Math.max(maxCol, currentCol);

        for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
          for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
            if (rowOffset === 0 && colOffset === 0) continue;
            const nextRow = currentRow + rowOffset;
            const nextCol = currentCol + colOffset;
            if (nextRow < 0 || nextRow >= height || nextCol < 0 || nextCol >= width) continue;
            if (visited[nextRow][nextCol] || grid[nextRow][nextCol] < 2) continue;
            visited[nextRow][nextCol] = true;
            queue.push([nextRow, nextCol]);
          }
        }
      }

      components.push({ minRow, maxRow, minCol, maxCol, activeCells, weight });
    }
  }

  return components;
}

function scoreComponent(component, sampleWidth, sampleHeight) {
  const x = component.minCol * CELL_SIZE;
  const y = component.minRow * CELL_SIZE;
  const width = ((component.maxCol - component.minCol) + 1) * CELL_SIZE;
  const height = ((component.maxRow - component.minRow) + 1) * CELL_SIZE;
  const centerX = x + (width / 2);
  const centerY = y + (height / 2);
  const widthRatio = width / sampleWidth;
  const heightRatio = height / sampleHeight;
  const aspect = width / Math.max(1, height);
  const yBias = 1 - clamp(centerY / (sampleHeight * 0.82), 0, 1);

  if (component.activeCells < 8) return null;
  if (widthRatio < 0.06 || widthRatio > 0.45) return null;
  if (heightRatio < 0.015 || heightRatio > 0.18) return null;
  if (aspect < 1.1 || aspect > 5.5) return null;

  const widthScore = 1 - clamp(Math.abs(widthRatio - 0.16) / 0.16, 0, 1);
  const heightScore = 1 - clamp(Math.abs(heightRatio - 0.05) / 0.07, 0, 1);
  const aspectScore = 1 - clamp(Math.abs(aspect - 2.3) / 2.6, 0, 1);
  const density = component.weight / Math.max(1, component.activeCells * (CELL_SIZE * CELL_SIZE));
  const densityScore = clamp(density / 4.5, 0, 1);
  const weightedScore = (widthScore * 0.28) + (heightScore * 0.18) + (aspectScore * 0.28) + (yBias * 0.16) + (densityScore * 0.1);

  return {
    x,
    y,
    width,
    height,
    centerX,
    centerY,
    aspect,
    weightedScore,
  };
}

function normalizeCandidate(candidate, sourceWidth, sourceHeight) {
  const scaleX = sourceWidth / SAMPLE_WIDTH;
  const scaleY = sourceHeight / SAMPLE_HEIGHT;
  const sourceWidthPx = candidate.width * scaleX;
  const sourceHeightPx = candidate.height * scaleY;
  const radius = clamp(
    Math.max(sourceWidthPx * 0.42, sourceHeightPx * 1.8),
    sourceWidthPx * 0.24,
    sourceWidthPx * 0.58,
  );

  return {
    rimCenter: {
      x: candidate.centerX * scaleX,
      y: candidate.centerY * scaleY,
    },
    rimRadius: radius,
    videoWidth: sourceWidth,
    videoHeight: sourceHeight,
    confidence: Number(candidate.weightedScore.toFixed(2)),
    bbox: {
      x: candidate.x * scaleX,
      y: candidate.y * scaleY,
      width: sourceWidthPx,
      height: sourceHeightPx,
    },
  };
}

function getStableCandidate(history) {
  if (history.length < STABLE_FRAMES_REQUIRED) return null;
  const recent = history.slice(-STABLE_FRAMES_REQUIRED);
  const averageX = recent.reduce((sum, item) => sum + item.rimCenter.x, 0) / recent.length;
  const averageY = recent.reduce((sum, item) => sum + item.rimCenter.y, 0) / recent.length;
  const averageRadius = recent.reduce((sum, item) => sum + item.rimRadius, 0) / recent.length;
  const averageConfidence = recent.reduce((sum, item) => sum + item.confidence, 0) / recent.length;
  const stable = recent.every((item) => (
    Math.abs(item.rimCenter.x - averageX) <= averageRadius * 0.65 &&
    Math.abs(item.rimCenter.y - averageY) <= averageRadius * 0.45 &&
    Math.abs(item.rimRadius - averageRadius) <= averageRadius * 0.35
  ));

  if (!stable || averageConfidence < 0.48) return null;

  const latest = recent[recent.length - 1];
  return {
    ...latest,
    rimCenter: { x: averageX, y: averageY },
    rimRadius: averageRadius,
    confidence: Number(averageConfidence.toFixed(2)),
  };
}

export function createRimDetector() {
  let sampleCanvas = null;
  let lastRunAt = 0;
  let history = [];

  return {
    reset() {
      lastRunAt = 0;
      history = [];
    },

    detect(videoElement) {
      if (!videoElement || typeof document === "undefined") {
        return null;
      }

      const now = Date.now();
      if (now - lastRunAt < SEARCH_INTERVAL_MS) {
        return null;
      }
      lastRunAt = now;

      const sourceWidth = videoElement.videoWidth;
      const sourceHeight = videoElement.videoHeight;
      if (!sourceWidth || !sourceHeight) {
        return null;
      }

      if (!sampleCanvas) {
        sampleCanvas = document.createElement("canvas");
      }

      sampleCanvas.width = SAMPLE_WIDTH;
      sampleCanvas.height = SAMPLE_HEIGHT;
      const context = sampleCanvas.getContext("2d", { willReadFrequently: true });
      if (!context) return null;

      context.clearRect(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      context.drawImage(videoElement, 0, 0, sourceWidth, sourceHeight, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      const image = context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      const grid = buildActiveGrid(image.data, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      const components = extractComponents(grid)
        .map((component) => scoreComponent(component, SAMPLE_WIDTH, SAMPLE_HEIGHT))
        .filter(Boolean)
        .sort((left, right) => right.weightedScore - left.weightedScore);

      if (!components.length) {
        history = [];
        return {
          calibration: null,
          status: "searching",
          confidence: 0,
          candidateCount: 0,
        };
      }

      const candidate = normalizeCandidate(components[0], sourceWidth, sourceHeight);
      history.push(candidate);
      if (history.length > 6) history.shift();

      const stableCandidate = getStableCandidate(history);
      if (!stableCandidate) {
        return {
          calibration: null,
          status: "searching",
          confidence: candidate.confidence,
          candidateCount: components.length,
          preview: candidate,
        };
      }

      return {
        calibration: {
          rimCenter: stableCandidate.rimCenter,
          rimRadius: stableCandidate.rimRadius,
          videoWidth: sourceWidth,
          videoHeight: sourceHeight,
        },
        status: "locked",
        confidence: stableCandidate.confidence,
        candidateCount: components.length,
        preview: stableCandidate,
      };
    },
  };
}