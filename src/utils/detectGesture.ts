import { Hand } from '@tensorflow-models/hand-pose-detection';

export type Gesture = 'tap' | 'follow_cursor' | 'close_cursor' | 'volume_up' | 'volume_down' | 'swipe_left' | 'swipe_right' | 'scroll_up' | 'scroll_down' | 'none';

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

// Simplified thresholds for more reliable detection
const FINGER_CURVED_THRESHOLD = 60;    // More lenient curve detection
const FINGER_EXTENDED_THRESHOLD = 140;  // More lenient extension detection
const GESTURE_COOLDOWN = 500;          // Reduced cooldown for faster response
const SWIPE_THRESHOLD = 100;          // Minimum distance for swipe detection
const SWIPE_TIME_WINDOW = 500;        // Maximum time window for swipe detection in ms

// Track hand movement
let lastHandPosition: { x: number; y: number; timestamp: number } | null = null;
let lastGestureTime = 0;

// Simplified angle calculation
const calculateAngle = (p1: Keypoint, p2: Keypoint, p3: Keypoint): number => {
  const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
  let angle = Math.abs((radians * 180) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
};

// Simplified finger state checks
const isFingerExtended = (keypoints: Keypoint[], mcpIndex: number, pipIndex: number, tipIndex: number): boolean => {
  const angle = calculateAngle(keypoints[mcpIndex], keypoints[pipIndex], keypoints[tipIndex]);
  return angle > FINGER_EXTENDED_THRESHOLD;
};

const isFingerCurved = (keypoints: Keypoint[], mcpIndex: number, pipIndex: number, tipIndex: number): boolean => {
  const angle = calculateAngle(keypoints[mcpIndex], keypoints[pipIndex], keypoints[tipIndex]);
  return angle < FINGER_CURVED_THRESHOLD;
};


// Calculate hand center position
const getHandCenter = (keypoints: Keypoint[]): { x: number; y: number } => {
  const sum = keypoints.reduce((acc, point) => ({
    x: acc.x + point.x,
    y: acc.y + point.y
  }), { x: 0, y: 0 });
  
  return {
    x: sum.x / keypoints.length,
    y: sum.y / keypoints.length
  };
};

// Detect swipe movement
const detectSwipe = (currentPosition: { x: number; y: number }, currentTime: number): Gesture => {
  if (!lastHandPosition) {
    lastHandPosition = { ...currentPosition, timestamp: currentTime };
    return 'none';
  }

  // Check if the movement is within the time window
  if (currentTime - lastHandPosition.timestamp > SWIPE_TIME_WINDOW) {
    lastHandPosition = { ...currentPosition, timestamp: currentTime };
    return 'none';
  }

  const deltaX = currentPosition.x - lastHandPosition.x;
  const deltaTime = currentTime - lastHandPosition.timestamp;
  const velocity = Math.abs(deltaX) / deltaTime;

  // Update last position
  lastHandPosition = { ...currentPosition, timestamp: currentTime };

  // Check if movement exceeds threshold and has sufficient velocity
  if (Math.abs(deltaX) > SWIPE_THRESHOLD && velocity > 0.5) {
    return deltaX > 0 ? 'swipe_right' : 'swipe_left';
  }

  return 'none';
};

export const detectGesture = (hands: Hand[]): GestureResult => {
  if (!hands || hands.length === 0 || hands[0].score < 0.8) {
    return { gesture: 'none', confidence: 0 };
  }

  const hand = hands[0];
  const keypoints = hand.keypoints;
  const currentTime = Date.now();

  // Skip gesture detection during cooldown
  if (currentTime - lastGestureTime < GESTURE_COOLDOWN) {
    return { gesture: 'none', confidence: hand.score };
  }

  // Check finger states
  const isIndexExtended = isFingerExtended(keypoints, 5, 6, 8);
  const isMiddleExtended = isFingerExtended(keypoints, 9, 10, 12);
  const isRingExtended = isFingerExtended(keypoints, 13, 14, 16);
  const isPinkyExtended = isFingerExtended(keypoints, 17, 18, 20);

  // Detect gestures based on simplified patterns:

  // Get current hand position
  const handCenter = getHandCenter(keypoints);


  // Check for swipe gestures when fingers are extended
  if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
    const swipeGesture = detectSwipe(handCenter, currentTime);
    if (swipeGesture !== 'none') {
      lastGestureTime = currentTime;
      return { gesture: swipeGesture, confidence: hand.score };
    }
  }

  // 1. Tap: Only index finger extended
  if (isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
    lastGestureTime = currentTime;
    return { gesture: 'tap', confidence: hand.score };
  }

  // 2. Follow Cursor: Index and middle fingers extended (peace sign)
  if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) {
    lastGestureTime = currentTime;
    return { gesture: 'follow_cursor', confidence: hand.score };
  }

    // 2. Follow Cursor: Index and middle fingers extended (peace sign)
    if (isIndexExtended && isMiddleExtended && isRingExtended && !isPinkyExtended) {
      lastGestureTime = currentTime;
      return { gesture: 'close_cursor', confidence: hand.score };
    }

  // 3. Volume Controls: Thumb + Index forms L shape
  // Volume Up: L shape pointing up
  if (isIndexExtended && keypoints[4].y < keypoints[8].y) {
    lastGestureTime = currentTime;
    return { gesture: 'volume_up', confidence: hand.score };
  }
  
  // Volume Down: L shape pointing down
  if (isIndexExtended && keypoints[4].y > keypoints[8].y) {
    lastGestureTime = currentTime;
    return { gesture: 'volume_down', confidence: hand.score };
  }

  // 4. Swipe Detection: All fingers extended, check hand orientation
  if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
    // Swipe Left: Palm facing left
    if (keypoints[0].x > keypoints[5].x) {
      lastGestureTime = currentTime;
      return { gesture: 'swipe_left', confidence: hand.score };
    }
    // Swipe Right: Palm facing right
    if (keypoints[0].x < keypoints[5].x) {
      lastGestureTime = currentTime;
      return { gesture: 'swipe_right', confidence: hand.score };
    }
  }

  // 5. Scroll Controls: Based on closed/open fist
  // Scroll Up: Closed fist (all fingers curved)
  if (!isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
    lastGestureTime = currentTime;
    return { gesture: 'scroll_up', confidence: hand.score };
  }
  
  // Scroll Down: Open palm facing down
  if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended && 
      keypoints[8].y > keypoints[5].y) {
    lastGestureTime = currentTime;
    return { gesture: 'scroll_down', confidence: hand.score };
  }

  return { gesture: 'none', confidence: hand.score };
};