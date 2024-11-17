export type Gesture = "swipe_left" | "swipe_right" | "tap" | "wave" | "none";

export interface GestureDetectionResult {
  gesture: Gesture;
  confidence: number;
}

// State management for temporal gestures
const state = {
  previousPalmPosition: null as number[] | null,
  movementHistory: [] as Array<{ x: number, y: number, timestamp: number }>,
  lastUpdateTime: Date.now()
};

// Normalize coordinates to 0-1 range
const normalizeCoordinates = (landmarks: number[][]): number[][] => {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  // Find bounds
  landmarks.forEach(point => {
    minX = Math.min(minX, point[0]);
    maxX = Math.max(maxX, point[0]);
    minY = Math.min(minY, point[1]);
    maxY = Math.max(maxY, point[1]);
  });

  // Normalize to 0-1 range
  return landmarks.map(point => [
    (point[0] - minX) / (maxX - minX || 1),
    (point[1] - minY) / (maxY - minY || 1),
    point[2]
  ]);
};

// Calculate finger extension using relative positions
const isFingerExtended = (base: number[], tip: number[]): boolean => {
  const distance = Math.sqrt(
    Math.pow(tip[0] - base[0], 2) +
    Math.pow(tip[1] - base[1], 2)
  );
  // Use a relative threshold based on hand size
  return distance > 0.1; // Normalized threshold
};

const calculateHandMovement = (currentPalm: number[]) => {
  const currentTime = Date.now();

  if (!state.previousPalmPosition) {
    state.previousPalmPosition = currentPalm;
    state.lastUpdateTime = currentTime;
    return { direction: "none", speed: 0, isWaving: false };
  }

  const deltaX = currentPalm[0] - state.previousPalmPosition[0];
  const deltaY = currentPalm[1] - state.previousPalmPosition[1];
  const deltaTime = (currentTime - state.lastUpdateTime) / 1000;

  if (deltaTime === 0) return { direction: "none", speed: 0, isWaving: false };

  const speed = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / deltaTime;

  // Add to movement history
  state.movementHistory.push({
    x: currentPalm[0],
    y: currentPalm[1],
    timestamp: currentTime
  });

  // Keep only last 500ms of movement
  state.movementHistory = state.movementHistory.filter(
    entry => currentTime - entry.timestamp < 500
  );

  // Detect primary movement direction
  const direction =
    Math.abs(deltaX) > Math.abs(deltaY)
      ? (Math.abs(deltaX) > 0.01 ? (deltaX > 0 ? "right" : "left") : "none")
      : (Math.abs(deltaY) > 0.01 ? (deltaY > 0 ? "down" : "up") : "none");

  state.previousPalmPosition = currentPalm;
  state.lastUpdateTime = currentTime;

  return {
    direction,
    speed,
    isWaving: detectWaving(state.movementHistory)
  };
};

const detectWaving = (history: Array<{ x: number, y: number, timestamp: number }>): boolean => {
  if (history.length < 4) return false;

  let directionChanges = 0;
  let previousDeltaX = history[1].x - history[0].x;

  for (let i = 2; i < history.length; i++) {
    const currentDeltaX = history[i].x - history[i - 1].x;
    if (Math.abs(currentDeltaX) > 0.01 && // Threshold for movement
      Math.sign(currentDeltaX) !== Math.sign(previousDeltaX)) {
      directionChanges++;
    }
    previousDeltaX = currentDeltaX;
  }

  return directionChanges >= 2;
};

export const detectGesture = (landmarks: number[][]): GestureDetectionResult => {
  if (!landmarks || landmarks.length !== 21) {
    return { gesture: "none", confidence: 0 };
  }

  // Normalize coordinates
  const normalizedLandmarks = normalizeCoordinates(landmarks);

  // Extract key points
  const palm = normalizedLandmarks[0];
  const indexTip = normalizedLandmarks[8];
  const middleTip = normalizedLandmarks[12];
  const ringTip = normalizedLandmarks[16];
  const pinkyTip = normalizedLandmarks[20];

  // Check finger extensions
  const indexExtended = isFingerExtended(normalizedLandmarks[5], indexTip);
  const middleExtended = isFingerExtended(normalizedLandmarks[9], middleTip);
  const ringExtended = isFingerExtended(normalizedLandmarks[13], ringTip);
  const pinkyExtended = isFingerExtended(normalizedLandmarks[17], pinkyTip);

  const handMovement = calculateHandMovement(palm);

  // Detect gestures
  if (handMovement.direction === "left" && handMovement.speed > 0.5) {
    if (indexExtended && middleExtended) {
      return { gesture: "swipe_left", confidence: Math.min(handMovement.speed / 2, 1) };
    }
  }

  if (handMovement.direction === "right" && handMovement.speed > 0.5) {
    if (indexExtended && middleExtended) {
      return { gesture: "swipe_right", confidence: Math.min(handMovement.speed / 2, 1) };
    }
  }

  if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return { gesture: "tap", confidence: 0.9 };
  }

  if (handMovement.isWaving && indexExtended && middleExtended && ringExtended && pinkyExtended) {
    return { gesture: "wave", confidence: 0.85 };
  }

  return { gesture: "none", confidence: 0 };
};