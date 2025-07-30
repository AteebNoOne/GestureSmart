package com.ateebnoone.gesturesmart;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.ImageFormat;
import android.graphics.SurfaceTexture;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageFormat;
import android.graphics.Matrix;
import android.graphics.Rect;
import android.graphics.YuvImage;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CameraDevice;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CaptureRequest;
import android.media.Image;
import android.media.ImageReader;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import android.view.Surface;
import android.os.Handler;
import android.os.HandlerThread;
import androidx.annotation.NonNull;

import com.facebook.react.ReactApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.Promise;
import com.google.mediapipe.solutions.hands.HandsResult;
import com.google.mediapipe.solutions.hands.HandsOptions;
import com.google.mediapipe.solutions.hands.Hands;
import com.google.mediapipe.formats.proto.LandmarkProto.NormalizedLandmark;
import com.google.mediapipe.formats.proto.LandmarkProto.NormalizedLandmarkList;

import java.util.List;
import java.util.Arrays;
import java.nio.ByteBuffer;
import java.io.ByteArrayOutputStream;

public class GestureService extends Service {
    private static final String TAG = "GestureService";
    private static final String CHANNEL_ID = "GestureServiceChannel";
    private static final int NOTIFICATION_ID = 1;

    // Improved gesture detection thresholds for easier detection
    private static final float FINGER_EXTENDED_THRESHOLD = 0.05f; // More lenient for extension
    private static final float FINGER_CURVED_THRESHOLD = 0.08f; // More lenient for curving
    private static final float THUMB_EXTENDED_THRESHOLD = 0.05f; // Easier thumb detection
    private static final long GESTURE_COOLDOWN = 1500; // Reduced cooldown for responsiveness
    private static final float SWIPE_THRESHOLD = 0.08f; // Lower threshold for easier swipes
    private static final float SWIPE_MIN_DISTANCE = 0.06f; // Minimum distance for swipe
    private static final float VERTICAL_MOVEMENT_THRESHOLD = 0.05f; // For scroll detection
    private static final int GESTURE_STABILITY_FRAMES = 2; // Frames to confirm gesture

    // Cursor mode variables
    private boolean isCursorMode = false;
    private GestureActions gestureActions;
    private final Handler cursorUpdateHandler = new Handler();

    private CameraDevice cameraDevice;
    private CameraCaptureSession cameraCaptureSession;
    private ImageReader imageReader;
    private Handler backgroundHandler;
    private HandlerThread backgroundThread;
    private Hands hands;
    private boolean isProcessing = false;
    private GestureModule gestureModule;
    private static final long PROCESS_DELAY = 300; // Faster processing
    private final Handler processHandler = new Handler(Looper.getMainLooper());
    private long lastProcessTime = 0;

    // Enhanced gesture tracking variables
    private PointF prevPalmPosition = null;
    private long lastGestureTime = 0;
    private String lastGesture = "none";
    private PointF swipeStartPosition = null;
    private int gestureConfirmationCount = 0;
    private String candidateGesture = "none";

    private boolean handsDetected = false;
    private int handLandmarkCount = 0;
    private long lastHandDetectionTime = 0;
    private float handConfidence = 0.0f;

    // Simple Point class for tracking positions
    private static class PointF {
        float x, y;

        PointF(float x, float y) {
            this.x = x;
            this.y = y;
        }
    }

    // Broadcast receiver for cursor mode changes
    private final BroadcastReceiver cursorModeReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if ("com.ateebnoone.gesturesmart.CURSOR_MODE".equals(intent.getAction())) {
                boolean active = intent.getBooleanExtra("active", false);
                isCursorMode = active;
                Log.i(TAG, "Cursor mode changed to: " + (active ? "ACTIVE" : "INACTIVE"));

                if (active) {
                    // Reset gesture tracking when entering cursor mode
                    resetGestureTracking();
                    // Ensure cursor is showing
                    if (gestureActions != null) {
                        try {
                            // Initialize cursor at center of screen
                            gestureActions.updateCursorPosition(0.5f, 0.5f);
                            Log.i(TAG, "Cursor initialized at center position");
                        } catch (Exception e) {
                            Log.e(TAG, "Error showing cursor: " + e.getMessage());
                        }
                    }
                } else {
                    // Hide cursor when exiting cursor mode
                    if (gestureActions != null) {
                        try {
                            gestureActions.updateCursorPosition(-1f, -1f); // Signal to hide cursor
                            Log.i(TAG, "Cursor hidden");
                        } catch (Exception e) {
                            Log.e(TAG, "Error hiding cursor: " + e.getMessage());
                        }
                    }
                }
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "========= GestureService onCreate started =========");
        try {
            createNotificationChannel();
            Log.i(TAG, "Notification channel created");

            startForeground(NOTIFICATION_ID, createNotification());
            Log.i(TAG, "Service started in foreground");

            // Register broadcast receiver for cursor mode
            IntentFilter filter = new IntentFilter("com.ateebnoone.gesturesmart.CURSOR_MODE");
            registerReceiver(cursorModeReceiver, filter);
            Log.i(TAG, "Cursor mode broadcast receiver registered");

            // Get GestureModule instance
            ReactApplication application = (ReactApplication) getApplication();
            ReactNativeHost reactNativeHost = application.getReactNativeHost();
            ReactContext reactContext = reactNativeHost.getReactInstanceManager().getCurrentReactContext();
            if (reactContext != null) {
                gestureModule = new GestureModule((ReactApplicationContext) reactContext);
                // Initialize GestureActions for cursor control
                gestureActions = new GestureActions((ReactApplicationContext) reactContext);
                Log.i(TAG, "GestureModule and GestureActions initialized");
            } else {
                Log.e(TAG, "ReactContext is null, could not initialize GestureModule and GestureActions");
            }

            initializeMediaPipe();
            Log.i(TAG, "MediaPipe initialized");

            startBackgroundThread();
            Log.i(TAG, "Background thread started");

            Log.i(TAG, "========= GestureService successfully initialized =========");
        } catch (Exception e) {
            Log.e(TAG, "Error initializing GestureService: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void initializeMediaPipe() {
        HandsOptions options = HandsOptions.builder()
                .setStaticImageMode(false)
                .setMaxNumHands(1)
                .setRunOnGpu(true)
                .setModelComplexity(1)
                .setMinDetectionConfidence(0.7f) // Slightly lower for better detection
                .setMinTrackingConfidence(0.7f)
                .build();

        hands = new Hands(this, options);
        hands.setErrorListener((message, e) -> Log.e(TAG, "MediaPipe Hands error: " + message));

        hands.setResultListener(result -> {
            if (result != null && !result.multiHandLandmarks().isEmpty()) {
                detectAndEmitGesture(result);
            } else {
                // Reset tracking when no hands detected
                resetGestureTracking();
                Log.v(TAG, "No hands detected in current frame");
            }
        });
    }

    private void resetGestureTracking() {
        prevPalmPosition = null;
        swipeStartPosition = null;
        gestureConfirmationCount = 0;
        candidateGesture = "none";
    }

    private void updateCursorPosition(NormalizedLandmarkList landmarks) {
        try {
            // Use index finger tip (landmark 8) for cursor control
            NormalizedLandmark indexTip = landmarks.getLandmarkList().get(8);

            // MediaPipe coordinates are normalized (0.0 - 1.0)
            // X coordinate is fine as-is
            // Y coordinate needs to be flipped since MediaPipe uses different origin
            float normalizedX = indexTip.getX();
            float normalizedY = 1.0f - indexTip.getY(); // Flip Y coordinate

            // Add smoothing to reduce jitter
            if (prevPalmPosition != null) {
                float smoothingFactor = 0.7f; // Adjust for smoothness vs responsiveness
                normalizedX = prevPalmPosition.x * smoothingFactor + normalizedX * (1 - smoothingFactor);
                normalizedY = prevPalmPosition.y * smoothingFactor + normalizedY * (1 - smoothingFactor);
            }

            // Store for next frame smoothing
            prevPalmPosition = new PointF(normalizedX, normalizedY);

            // Update cursor position through GestureActions
            if (gestureActions != null) {
                gestureActions.updateCursorPosition(normalizedX, normalizedY);
                Log.v(TAG, String.format("Cursor position updated: (%.3f, %.3f)", normalizedX, normalizedY));
            }
        } catch (Exception e) {
            Log.e(TAG, "Error updating cursor position: " + e.getMessage());
        }
    }

    private void detectAndEmitGesture(HandsResult result) {
        if (!isProcessing) {
            Log.d(TAG, "Processing is disabled, skipping gesture detection");
            return;
        }

        try {
            List<NormalizedLandmarkList> multiHandLandmarks = result.multiHandLandmarks();

            // Update hand detection status
            handsDetected = !multiHandLandmarks.isEmpty();
            lastHandDetectionTime = System.currentTimeMillis();

            if (multiHandLandmarks.isEmpty()) {
                Log.v(TAG, "No hands detected in frame");
                handLandmarkCount = 0;
                handConfidence = 0.0f;

                resetGestureTracking();

                if (gestureModule != null) {
                    processHandler.post(() -> {
                        gestureModule.sendHandDetectionEvent("no_hands", 0, 0.0f);
                    });
                }
                return;
            }

            // Get the first hand landmarks
            NormalizedLandmarkList landmarks = multiHandLandmarks.get(0);
            handLandmarkCount = landmarks.getLandmarkList().size();
            handConfidence = handLandmarkCount >= 21 ? 0.9f : 0.5f;

            // Send hand detection status
            if (gestureModule != null) {
                processHandler.post(() -> {
                    gestureModule.sendHandDetectionEvent("hand_detected", handLandmarkCount, handConfidence);
                });
            }

            // Handle cursor mode - ALWAYS update cursor position AND detect tap gestures
            if (isCursorMode) {
                // Update cursor position for EVERY frame when in cursor mode
                if (gestureActions != null) {
                    NormalizedLandmark indexTip = landmarks.getLandmarkList().get(8);
                    float normalizedX = indexTip.getX();
                    float normalizedY = 1.0f - indexTip.getY(); // Flip Y coordinate

                    // Add smoothing to reduce jitter
                    if (prevPalmPosition != null) {
                        float smoothingFactor = 0.5f; // Reduced for more responsive movement
                        normalizedX = prevPalmPosition.x * smoothingFactor + normalizedX * (1 - smoothingFactor);
                        normalizedY = prevPalmPosition.y * smoothingFactor + normalizedY * (1 - smoothingFactor);
                    }

                    // Store current position for next frame
                    prevPalmPosition = new PointF(normalizedX, normalizedY);

                    // Update cursor position
                    gestureActions.updateCursorPosition(normalizedX, normalizedY);
                    Log.v(TAG, String.format("Updating cursor position: (%.3f, %.3f)", normalizedX, normalizedY));
                }

                // In cursor mode, only detect tap gestures and cursor toggle
                String cursorModeGesture = detectCursorModeGestures(landmarks);
                if (cursorModeGesture != null && !cursorModeGesture.equals("none")) {
                    Log.i(TAG, "Cursor mode gesture detected: " + cursorModeGesture);
                    if (gestureModule != null) {
                        processHandler.post(() -> {
                            Log.i(TAG, "Emitting cursor mode gesture: " + cursorModeGesture);
                            gestureModule.sendEvent(cursorModeGesture);
                        });
                    }
                }
                return; // Don't process regular gestures in cursor mode
            }

            // Regular gesture detection (when not in cursor mode)
            String detectedGesture = classifyGesture(landmarks);

            if (detectedGesture != null && !detectedGesture.equals("none")) {
                Log.i(TAG, "Detected gesture: " + detectedGesture);
                if (gestureModule != null) {
                    processHandler.post(() -> {
                        Log.i(TAG, "Emitting gesture event: " + detectedGesture);
                        gestureModule.sendEvent(detectedGesture);
                    });
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error detecting gesture: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private String detectCursorModeGestures(NormalizedLandmarkList landmarks) {
        if (landmarks.getLandmarkList().size() < 21) {
            return "none";
        }

        try {
            List<NormalizedLandmark> points = landmarks.getLandmarkList();
            long currentTime = System.currentTimeMillis();

            // Get finger states
            boolean isIndex = isFingerExtended(points, 5, 8); // Index finger
            boolean isMiddle = isFingerExtended(points, 9, 12); // Middle finger
            boolean isRing = isFingerExtended(points, 13, 16); // Ring finger
            boolean isPinky = isFingerExtended(points, 17, 20); // Pinky finger
            boolean isThumb = isThumbExtended(points);

            // Count extended fingers
            int extendedFingers = 0;
            if (isIndex)
                extendedFingers++;
            if (isMiddle)
                extendedFingers++;
            if (isRing)
                extendedFingers++;
            if (isPinky)
                extendedFingers++;
            if (isThumb)
                extendedFingers++;

            Log.v(TAG,
                    String.format(
                            "Cursor mode - Finger states - Index:%s, Middle:%s, Ring:%s, Pinky:%s, Thumb:%s (Total:%d)",
                            isIndex, isMiddle, isRing, isPinky, isThumb, extendedFingers));

            // Cursor mode gestures:

            // 1. Fist (closed hand) - tap at cursor
            if (extendedFingers == 0) {
                return confirmCursorGesture("tap_at_cursor", currentTime);
            }

            // 2. Pinky only - toggle cursor (close cursor)
            if (isPinky && !isIndex && !isMiddle && !isRing && !isThumb) {
                return confirmCursorGesture("cursor", currentTime);
            }

            return "none";

        } catch (Exception e) {
            Log.e(TAG, "Error in cursor mode gesture detection: " + e.getMessage());
            return "none";
        }
    }

    private String confirmCursorGesture(String gesture, long currentTime) {
        // Shorter cooldown for cursor gestures to be more responsive
        if (currentTime - lastGestureTime < 800) {
            return "none";
        }

        if (gesture.equals("none")) {
            candidateGesture = "none";
            gestureConfirmationCount = 0;
            return "none";
        }

        // For tap gesture, require confirmation to avoid accidental taps
        if (gesture.equals("tap_at_cursor")) {
            if (gesture.equals(candidateGesture)) {
                gestureConfirmationCount++;
            } else {
                candidateGesture = gesture;
                gestureConfirmationCount = 1;
            }

            if (gestureConfirmationCount >= 2) { // Require 2 frames of confirmation
                lastGestureTime = currentTime;
                lastGesture = gesture;
                gestureConfirmationCount = 0;
                candidateGesture = "none";
                Log.i(TAG, "🎯 CURSOR TAP CONFIRMED");
                return gesture;
            }
            return "none";
        }

        // For other cursor gestures, confirm immediately
        lastGestureTime = currentTime;
        lastGesture = gesture;
        Log.i(TAG, "🎯 CURSOR GESTURE CONFIRMED: " + gesture);
        return gesture;
    }

    private String classifyGesture(NormalizedLandmarkList landmarks) {
        if (landmarks.getLandmarkList().size() < 21) {
            Log.w(TAG, "Insufficient landmarks for gesture classification: " + landmarks.getLandmarkList().size());
            return "none";
        }

        try {
            List<NormalizedLandmark> points = landmarks.getLandmarkList();
            long currentTime = System.currentTimeMillis();

            // Calculate palm position (more stable calculation)
            PointF palmPosition = calculatePalmPosition(points);

            // Get finger states with improved detection
            boolean isIndex = isFingerExtended(points, 5, 8); // Index finger
            boolean isMiddle = isFingerExtended(points, 9, 12); // Middle finger
            boolean isRing = isFingerExtended(points, 13, 16); // Ring finger
            boolean isPinky = isFingerExtended(points, 17, 20); // Pinky finger
            boolean isThumb = isThumbExtended(points);

            // Count extended fingers
            int extendedFingers = 0;
            if (isIndex)
                extendedFingers++;
            if (isMiddle)
                extendedFingers++;
            if (isRing)
                extendedFingers++;
            if (isPinky)
                extendedFingers++;
            if (isThumb)
                extendedFingers++;

            Log.v(TAG, String.format("Finger states - Index:%s, Middle:%s, Ring:%s, Pinky:%s, Thumb:%s (Total:%d)",
                    isIndex, isMiddle, isRing, isPinky, isThumb, extendedFingers));

            // Static gesture detection with priority order
            String staticGesture = detectStaticGestures(isIndex, isMiddle, isRing, isPinky, isThumb, extendedFingers);

            return confirmGesture(staticGesture, currentTime);

        } catch (Exception e) {
            Log.e(TAG, "Error in gesture classification: " + e.getMessage());
            return "none";
        }
    }

    private String detectStaticGestures(boolean isIndex, boolean isMiddle, boolean isRing, boolean isPinky,
            boolean isThumb, int extendedFingers) {
        // Clear gesture priorities for easy detection

        // Fist (closed hand) - scroll up (most sensitive)
        if (extendedFingers == 0) {
            return "scroll_up";
        }

        // Index finger only - tap
        if (isIndex && !isMiddle && !isRing && !isPinky && !isThumb) {
            return "tap";
        }

        // Thumb only - return/back
        if (isThumb && !isIndex && !isMiddle && !isRing && !isPinky) {
            return "return";
        }

        // Index + Middle (peace sign) - follow cursor
        if (isIndex && isMiddle && !isRing && !isPinky) {
            return "swipe_right";
        }

        // Index + Middle + Ring (three fingers) - close cursor
        if (isIndex && isMiddle && isRing && !isPinky) {
            return "swipe_left";
        }

        // NEW GESTURE 2: Pinky only (Little finger) - close_cursor
        // Unique and easy to detect since pinky is rarely extended alone
        if (isPinky && !isIndex && !isMiddle && !isRing && !isThumb) {
            return "cursor";
        }

        // Open hand (4-5 fingers) - scroll down
        if (extendedFingers >= 4) {
            return "scroll_down";
        }

        return "none";
    }

    private String confirmGesture(String gesture, long currentTime) {
        // Cooldown check
        if (currentTime - lastGestureTime < GESTURE_COOLDOWN) {
            return lastGesture;
        }

        if (gesture.equals("none")) {
            candidateGesture = "none";
            gestureConfirmationCount = 0;
            return "none";
        }

        // Gesture stability confirmation
        if (gesture.equals(candidateGesture)) {
            gestureConfirmationCount++;
        } else {
            candidateGesture = gesture;
            gestureConfirmationCount = 1;
        }

        // For movement gestures, confirm immediately
        if (gesture.startsWith("swipe_") || gesture.startsWith("scroll_")) {
            lastGestureTime = currentTime;
            lastGesture = gesture;
            Log.i(TAG, "🎯 MOVEMENT GESTURE DETECTED: " + gesture);
            return gesture;
        }

        // For cursor-related gestures, require immediate confirmation
        if (gesture.equals("cursor")) {
            lastGestureTime = currentTime;
            lastGesture = gesture;
            Log.i(TAG, "🎯 CURSOR GESTURE DETECTED");
            return gesture;
        }

        // For static gestures, require confirmation
        if (gestureConfirmationCount >= GESTURE_STABILITY_FRAMES) {
            lastGestureTime = currentTime;
            lastGesture = gesture;
            Log.i(TAG, "🎯 STATIC GESTURE CONFIRMED: " + gesture);
            return gesture;
        }

        return lastGesture;
    }

    private PointF calculatePalmPosition(List<NormalizedLandmark> points) {
        // Use multiple points for more stable palm center calculation
        NormalizedLandmark wrist = points.get(0);
        NormalizedLandmark indexMcp = points.get(5);
        NormalizedLandmark middleMcp = points.get(9);
        NormalizedLandmark ringMcp = points.get(13);
        NormalizedLandmark pinkyMcp = points.get(17);

        float x = (wrist.getX() + indexMcp.getX() + middleMcp.getX() + ringMcp.getX() + pinkyMcp.getX()) / 5;
        float y = (wrist.getY() + indexMcp.getY() + middleMcp.getY() + ringMcp.getY() + pinkyMcp.getY()) / 5;

        return new PointF(x, y);
    }

    private boolean isFingerExtended(List<NormalizedLandmark> points, int mcp, int tip) {
        // Simplified finger extension check
        float tipY = points.get(tip).getY();
        float mcpY = points.get(mcp).getY();

        // For easier detection, consider finger extended if tip is above MCP
        return (mcpY - tipY) > FINGER_EXTENDED_THRESHOLD;
    }

    private boolean isThumbExtended(List<NormalizedLandmark> points) {
        // Thumb extension based on X-axis movement (thumb moves sideways)
        float thumbTipX = points.get(4).getX();
        float thumbMcpX = points.get(2).getX();
        float wristX = points.get(0).getX();

        // Check if thumb tip is significantly away from wrist
        float thumbDistance = Math.abs(thumbTipX - wristX);
        float mcpDistance = Math.abs(thumbMcpX - wristX);

        return thumbDistance > mcpDistance + THUMB_EXTENDED_THRESHOLD;
    }

    public String getHandDetectionInfo() {
        long timeSinceLastDetection = System.currentTimeMillis() - lastHandDetectionTime;
        return String.format("Hands: %s, Landmarks: %d, Confidence: %.2f, Last seen: %dms ago",
                handsDetected ? "YES" : "NO", handLandmarkCount, handConfidence, timeSinceLastDetection);
    }

    // Convert YUV_420_888 Image to Bitmap
    private Bitmap convertYuvToBitmap(Image image) {
        try {
            Image.Plane[] planes = image.getPlanes();
            ByteBuffer yBuffer = planes[0].getBuffer(); // Y
            ByteBuffer vuBuffer = planes[2].getBuffer(); // VU

            int ySize = yBuffer.remaining();
            int vuSize = vuBuffer.remaining();

            byte[] nv21 = new byte[ySize + vuSize];

            yBuffer.get(nv21, 0, ySize);
            vuBuffer.get(nv21, ySize, vuSize);

            YuvImage yuvImage = new YuvImage(nv21, ImageFormat.NV21, image.getWidth(), image.getHeight(), null);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            yuvImage.compressToJpeg(new Rect(0, 0, yuvImage.getWidth(), yuvImage.getHeight()), 50, out);
            byte[] imageBytes = out.toByteArray();

            Bitmap bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.length);

            // Rotate and flip bitmap for front camera
            Matrix matrix = new Matrix();
            matrix.postRotate(270); // Rotate for orientation
            matrix.postScale(-1, 1); // Flip horizontally for front camera mirror effect
            return Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);

        } catch (Exception e) {
            Log.e(TAG, "Error converting YUV to Bitmap: " + e.getMessage());
            return null;
        }
    }

    private void startBackgroundThread() {
        backgroundThread = new HandlerThread("CameraBackground");
        backgroundThread.start();
        backgroundHandler = new Handler(backgroundThread.getLooper());
    }

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Gesture Service Channel",
                NotificationManager.IMPORTANCE_LOW);
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(channel);
    }

    private Notification createNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                notificationIntent,
                PendingIntent.FLAG_IMMUTABLE);

        return new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("Gesture Detection Active")
                .setContentText("Processing gestures in background")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .build();
    }

    private final CameraDevice.StateCallback stateCallback = new CameraDevice.StateCallback() {
        @Override
        public void onOpened(@NonNull CameraDevice camera) {
            Log.i(TAG, "Camera opened successfully");
            cameraDevice = camera;
            createCameraPreviewSession();
        }

        @Override
        public void onDisconnected(@NonNull CameraDevice camera) {
            Log.i(TAG, "Camera disconnected");
            camera.close();
            cameraDevice = null;
        }

        @Override
        public void onError(@NonNull CameraDevice camera, int error) {
            Log.e(TAG, "Camera Error: " + error);
            camera.close();
            cameraDevice = null;
        }
    };

    private void createCameraPreviewSession() {
        try {
            // Create ImageReader for processing frames
            imageReader = ImageReader.newInstance(640, 480, ImageFormat.YUV_420_888, 2);

            imageReader.setOnImageAvailableListener(reader -> {
                long currentTime = System.currentTimeMillis();
                if (currentTime - lastProcessTime < PROCESS_DELAY) {
                    return; // Skip frame to reduce processing load
                }
                lastProcessTime = currentTime;

                Image image = null;
                try {
                    image = reader.acquireLatestImage();
                    if (image != null && hands != null && isProcessing) {
                        Log.v(TAG, "Processing frame: " + image.getWidth() + "x" + image.getHeight());

                        // Convert YUV to Bitmap
                        Bitmap bitmap = convertYuvToBitmap(image);
                        if (bitmap != null) {
                            // MediaPipe requires timestamp when not in static image mode
                            long timestampMicros = System.currentTimeMillis() * 1000L;
                            hands.send(bitmap, timestampMicros);
                            Log.v(TAG, "Sent bitmap to MediaPipe: " + bitmap.getWidth() + "x" + bitmap.getHeight()
                                    + " with timestamp: " + timestampMicros);
                        } else {
                            Log.w(TAG, "Failed to convert image to bitmap");
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error processing image: " + e.getMessage());
                    e.printStackTrace();
                } finally {
                    if (image != null) {
                        image.close();
                    }
                }
            }, backgroundHandler);

            // Create dummy surface for preview (required for camera session)
            SurfaceTexture texture = new SurfaceTexture(0);
            texture.setDefaultBufferSize(640, 480);
            Surface previewSurface = new Surface(texture);

            // Create capture session with both preview surface and ImageReader surface
            final CaptureRequest.Builder builder = cameraDevice.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW);
            builder.addTarget(previewSurface);
            builder.addTarget(imageReader.getSurface());

            cameraDevice.createCaptureSession(
                    Arrays.asList(previewSurface, imageReader.getSurface()),
                    new CameraCaptureSession.StateCallback() {
                        @Override
                        public void onConfigured(@NonNull CameraCaptureSession session) {
                            Log.i(TAG, "Camera capture session configured");
                            if (cameraDevice == null)
                                return;

                            cameraCaptureSession = session;
                            try {
                                builder.set(CaptureRequest.CONTROL_AF_MODE,
                                        CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE);
                                builder.set(CaptureRequest.CONTROL_AE_MODE,
                                        CaptureRequest.CONTROL_AE_MODE_ON_AUTO_FLASH);

                                CaptureRequest request = builder.build();
                                cameraCaptureSession.setRepeatingRequest(request,
                                        null, backgroundHandler);

                                Log.i(TAG, "Camera preview started successfully");
                            } catch (CameraAccessException e) {
                                Log.e(TAG, "Failed to start camera preview", e);
                            }
                        }

                        @Override
                        public void onConfigureFailed(@NonNull CameraCaptureSession session) {
                            Log.e(TAG, "Failed to configure camera session");
                        }
                    },
                    null);
        } catch (CameraAccessException e) {
            Log.e(TAG, "Failed to create camera preview session", e);
        }
    }

    private void startCamera() {
        CameraManager manager = (CameraManager) getSystemService(CAMERA_SERVICE);
        try {
            String[] cameraIds = manager.getCameraIdList();
            String frontCameraId = null;

            // Find the front-facing camera
            for (String cameraId : cameraIds) {
                android.hardware.camera2.CameraCharacteristics characteristics = manager
                        .getCameraCharacteristics(cameraId);
                Integer facing = characteristics.get(android.hardware.camera2.CameraCharacteristics.LENS_FACING);
                if (facing != null && facing == android.hardware.camera2.CameraCharacteristics.LENS_FACING_FRONT) {
                    frontCameraId = cameraId;
                    break;
                }
            }

            // Use front camera if found, otherwise use first available camera
            String selectedCameraId = frontCameraId != null ? frontCameraId : cameraIds[0];
            Log.i(TAG, "Opening camera: " + selectedCameraId + " (Front camera: "
                    + (frontCameraId != null ? "YES" : "NO") + ")");

            manager.openCamera(selectedCameraId, stateCallback, backgroundHandler);
        } catch (CameraAccessException | SecurityException e) {
            Log.e(TAG, "Failed to open camera", e);
        }
    }

    private void stopCamera() {
        if (cameraCaptureSession != null) {
            cameraCaptureSession.close();
            cameraCaptureSession = null;
        }
        if (cameraDevice != null) {
            cameraDevice.close();
            cameraDevice = null;
        }
        if (imageReader != null) {
            imageReader.close();
            imageReader = null;
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "========= GestureService onStartCommand =========");
        try {
            startCamera();
            Log.i(TAG, "Camera started");
            isProcessing = true;
            Log.i(TAG, "Processing enabled");
            return START_STICKY;
        } catch (Exception e) {
            Log.e(TAG, "Error in onStartCommand: " + e.getMessage());
            e.printStackTrace();
            return START_STICKY;
        }
    }

    @Override
    public void onDestroy() {
        isProcessing = false;
        stopCamera();

        // Ensure cursor is closed when service is destroyed
        if (gestureActions != null && isCursorMode) {
            try {
                // Try to close cursor directly through GestureActions
                gestureActions.updateCursorPosition(-1, -1); // Signal to hide cursor
                isCursorMode = false;
                Log.i(TAG, "Cursor mode disabled on service destroy");
            } catch (Exception e) {
                Log.e(TAG, "Error closing cursor on service destroy: " + e.getMessage());
            }
        }

        if (backgroundThread != null) {
            backgroundThread.quitSafely();
            try {
                backgroundThread.join();
                backgroundThread = null;
                backgroundHandler = null;
            } catch (InterruptedException e) {
                Log.e(TAG, "Failed to stop background thread", e);
            }
        }
        if (hands != null) {
            hands.close();
        }

        // Unregister broadcast receiver
        try {
            unregisterReceiver(cursorModeReceiver);
        } catch (Exception e) {
            Log.e(TAG, "Error unregistering cursor mode receiver: " + e.getMessage());
        }

        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}