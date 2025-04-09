import { Hand } from '@tensorflow-models/hand-pose-detection';

export type Gesture =
  | 'tap'
  | 'follow_cursor'
  | 'close_cursor'
  | 'volume_up'
  | 'volume_down'
  | 'scroll_up'
  | 'scroll_down'
  | 'swipe_left'
  | 'swipe_right'
  | 'return'
  | 'none';

export interface GestureResult {
  gesture: Gesture;
  confidence: number;
}

interface Keypoint {
  x: number;
  y: number;
  z?: number;
  score?: number;
}

const THRESHOLDS = {
  FINGER_CURVED: 60,
  FINGER_EXTENDED: 140,
  THUMB_EXTENDED: 120,
  GESTURE_COOLDOWN: 300,  // Reduced cooldown time
  SCROLL_DISTANCE: 0.15,
  SWIPE_THRESHOLD: 30,    // Lowered swipe threshold
};

// Track previous hand position for swipe detection
let prevPalmPosition: { x: number, y: number } | null = null;
let lastGestureTime = 0;
let lastHandDirection = { x: 0, y: 0 };
let lastGesture: Gesture = 'none';
let swipeStartPosition: { x: number, y: number } | null = null;

const calculateAngle = (p1: Keypoint, p2: Keypoint, p3: Keypoint): number => {
  const radians =
    Math.atan2(p3.y - p2.y, p3.x - p2.x) -
    Math.atan2(p1.y - p2.y, p1.x - p2.x);
  let angle = Math.abs((radians * 180) / Math.PI);
  return angle > 180 ? 360 - angle : angle;
};

const isFingerExtended = (
  keypoints: Keypoint[],
  mcp: number,
  pip: number,
  tip: number
): boolean => calculateAngle(keypoints[mcp], keypoints[pip], keypoints[tip]) > THRESHOLDS.FINGER_EXTENDED;

const isFingerCurved = (
  keypoints: Keypoint[],
  mcp: number,
  pip: number,
  tip: number
): boolean => calculateAngle(keypoints[mcp], keypoints[pip], keypoints[tip]) < THRESHOLDS.FINGER_CURVED;

const isThumbExtended = (keypoints: Keypoint[]): boolean => {
  // Check thumb angle (CMC-MCP-TIP)
  const angle = calculateAngle(keypoints[1], keypoints[2], keypoints[4]);
  return angle > THRESHOLDS.THUMB_EXTENDED;
};

const getFingerDirection = (keypoints: Keypoint[], fingerTip: number, fingerBase: number): 'up' | 'down' => {
  return keypoints[fingerTip].y > keypoints[fingerBase].y ? 'down' : 'up';
};

// Calculate palm center position
const getPalmPosition = (keypoints: Keypoint[]): { x: number, y: number } => {
  // Use wrist and base of fingers to calculate palm center
  const wrist = keypoints[0];
  const indexBase = keypoints[5];
  const pinkyBase = keypoints[17];
  
  return {
    x: (wrist.x + indexBase.x + pinkyBase.x) / 3,
    y: (wrist.y + indexBase.y + pinkyBase.y) / 3,
  };
};

// Check if all fingers are pointing downward
const areAllFingersDown = (keypoints: Keypoint[]): boolean => {
  return keypoints[8].y > keypoints[5].y && 
         keypoints[12].y > keypoints[9].y &&
         keypoints[16].y > keypoints[13].y &&
         keypoints[20].y > keypoints[17].y;
};

export const detectGesture = (hands: Hand[]): GestureResult => {
  if (!hands.length || hands[0].score < 0.8) {
    prevPalmPosition = null;
    swipeStartPosition = null;
    return { gesture: 'none', confidence: 0 };
  }

  const { keypoints, score } = hands[0];
  const currentTime = Date.now();
  
  // Calculate current palm position
  const palmPosition = getPalmPosition(keypoints);
  
  // Get finger states
  const [isIndex, isMiddle, isRing, isPinky] = [
    isFingerExtended(keypoints, 5, 6, 8),
    isFingerExtended(keypoints, 9, 10, 12),
    isFingerExtended(keypoints, 13, 14, 16),
    isFingerExtended(keypoints, 17, 18, 20),
  ];
  const isThumb = isThumbExtended(keypoints);

  // Detect open hand position (for swipes and scrolls)
  const isOpenHand = isIndex && isMiddle && isRing && isPinky;
  
  // Handle swipe detection
  let swipeGesture: Gesture = 'none';
  
  if (prevPalmPosition && isOpenHand) {
    const deltaX = palmPosition.x - prevPalmPosition.x;
    const deltaY = palmPosition.y - prevPalmPosition.y;
    
    // Store hand movement direction
    lastHandDirection = { x: deltaX, y: deltaY };
    
    // Initialize swipe start position if needed
    if (!swipeStartPosition && Math.abs(deltaX) > 5) {
      swipeStartPosition = { ...prevPalmPosition };
    }
    
    // Check if we have a start position and sufficient movement
    if (swipeStartPosition) {
      const totalDeltaX = palmPosition.x - swipeStartPosition.x;
      
      // Check if hand moved enough for a swipe
      if (Math.abs(totalDeltaX) > THRESHOLDS.SWIPE_THRESHOLD && 
          Math.abs(totalDeltaX) > Math.abs(deltaY) * 1.5) {
        swipeGesture = totalDeltaX < 0 ? 'swipe_left' : 'swipe_right';
        // Reset swipe start position after detecting a swipe
        swipeStartPosition = null;
      }
    }
  } else {
    // Reset swipe tracking if hand is not open
    swipeStartPosition = null;
  }
  
  // Update previous position
  prevPalmPosition = palmPosition;
  
  // Special case for continuing a swipe gesture to avoid cooldown interruption
  if ((lastGesture === 'swipe_left' || lastGesture === 'swipe_right') && 
      swipeGesture !== 'none' && 
      currentTime - lastGestureTime < THRESHOLDS.GESTURE_COOLDOWN * 2) {
    lastGesture = swipeGesture;
    lastGestureTime = currentTime;
    return { gesture: swipeGesture, confidence: score };
  }
  
  // If we're in cooldown period and not detecting a special case, return the last gesture
  if (currentTime - lastGestureTime < THRESHOLDS.GESTURE_COOLDOWN) {
    return { gesture: lastGesture, confidence: score };
  }

  // Improved scroll detection
  const isScrollingDown = isOpenHand && areAllFingersDown(keypoints);
  const isScrollingUp = !isIndex && !isMiddle && !isRing && !isPinky && !isThumb;

  // Gesture conditions in priority order
  // Note: Swipes take precedence over other gestures
  const gestures: { condition: boolean; gesture: Gesture }[] = [
    {
      condition: swipeGesture === 'swipe_left',
      gesture: 'swipe_left'
    },
    {
      condition: swipeGesture === 'swipe_right',
      gesture: 'swipe_right'
    },
    { 
      condition: isScrollingDown,
      gesture: 'scroll_down' 
    },
    { 
      condition: isScrollingUp,
      gesture: 'scroll_up' 
    },
    { 
      condition: isThumb && !isIndex && !isMiddle && !isRing && !isPinky,
      gesture: 'return' 
    },
    { 
      condition: isIndex && !isMiddle && !isRing && !isPinky && !isThumb,
      gesture: 'tap' 
    },
    { 
      condition: isIndex && isMiddle && !isRing && !isPinky,
      gesture: 'follow_cursor' 
    },
    { 
      condition: isIndex && isMiddle && isRing && !isPinky,
      gesture: 'close_cursor' 
    },
    { 
      condition: isIndex && keypoints[4].y < keypoints[8].y,
      gesture: 'volume_up' 
    },
    { 
      condition: isIndex && keypoints[4].y > keypoints[8].y,
      gesture: 'volume_down' 
    },
  ];

  for (const { condition, gesture } of gestures) {
    if (condition) {
      lastGestureTime = currentTime;
      lastGesture = gesture;
      return { gesture, confidence: score };
    }
  }

  lastGesture = 'none';
  return { gesture: 'none', confidence: score };
};