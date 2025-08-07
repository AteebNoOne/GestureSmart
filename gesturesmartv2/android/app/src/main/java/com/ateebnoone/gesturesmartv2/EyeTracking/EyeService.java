package com.ateebnoone.gesturesmartv2;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraDevice;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CaptureRequest;
import android.hardware.camera2.params.StreamConfigurationMap;
import android.media.Image;
import android.media.ImageReader;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.util.Log;
import android.util.Size;
import android.view.Surface;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageFormat;
import android.graphics.Matrix;
import android.graphics.Rect;
import android.graphics.YuvImage;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.google.mediapipe.framework.image.BitmapImageBuilder;
import com.google.mediapipe.framework.image.MPImage;
import com.google.mediapipe.tasks.vision.core.RunningMode;
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker;
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult;
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker.FaceLandmarkerOptions;
import com.google.mediapipe.tasks.components.containers.NormalizedLandmark;
import com.google.mediapipe.tasks.core.BaseOptions;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.List;
import java.util.Arrays;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import android.graphics.SurfaceTexture;
import java.util.ArrayList;

public class EnhancedFaceService extends Service {
    private static final String TAG = "EnhancedFaceService";
    private static final String CHANNEL_ID = "FaceServiceChannel";
    private static final int NOTIFICATION_ID = 2;

    // Performance tiers for dynamic configuration
    private enum PerformanceTier {
        LOW, MEDIUM, HIGH
    }

    // Dynamic device configuration
    private static class DeviceConfig {
        final Size imageSize;
        final long processDelay;
        final int consecutiveFrames;
        final long eventCooldown;
        final float minFaceDetectionConfidence;
        final float minTrackingConfidence;

        DeviceConfig(Size imageSize, long processDelay, int consecutiveFrames,
                     long eventCooldown, float minFaceDetectionConfidence, float minTrackingConfidence) {
            this.imageSize = imageSize;
            this.processDelay = processDelay;
            this.consecutiveFrames = consecutiveFrames;
            this.eventCooldown = eventCooldown;
            this.minFaceDetectionConfidence = minFaceDetectionConfidence;
            this.minTrackingConfidence = minTrackingConfidence;
        }
    }

    // UPDATED THRESHOLDS - More sensitive for better detection
    private static final float EYE_BLINK_THRESHOLD = 0.18f;          // Lower = more sensitive
    private static final float EYE_OPEN_THRESHOLD = 0.23f;           // Eye open threshold
    private static final float WINK_ASYMMETRY_THRESHOLD = 0.12f;     // Wink detection
    private static final float MOUTH_OPEN_THRESHOLD = 0.035f;        // Mouth open detection
    private static final float MOUTH_SMILE_THRESHOLD = 0.02f;        // Smile detection
    private static final float EYEBROW_RAISE_THRESHOLD = 0.015f;     // Eyebrow raise detection

    // MediaPipe 468-point face landmark indices (CORRECTED)
    // Left eye landmarks (using correct MediaPipe indices)
    private static final int[] LEFT_EYE_LANDMARKS = {362, 385, 387, 263, 373, 380};
    // Right eye landmarks 
    private static final int[] RIGHT_EYE_LANDMARKS = {33, 160, 158, 133, 153, 144};
    
    // Mouth landmarks for mouth open detection
    private static final int[] MOUTH_LANDMARKS = {
        13, 14, 15, 16, 17, 18, // Upper lip
        0, 11, 12, 13, 14, 15,  // Lower lip
        78, 81, 13, 82, 312, 308 // Mouth corners and center
    };
    
    // More specific mouth detection points
    private static final int MOUTH_TOP = 13;        // Top of upper lip
    private static final int MOUTH_BOTTOM = 14;     // Bottom of lower lip  
    private static final int MOUTH_LEFT = 78;       // Left mouth corner
    private static final int MOUTH_RIGHT = 308;     // Right mouth corner
    
    // Eyebrow landmarks for eyebrow raise detection
    private static final int[] LEFT_EYEBROW_LANDMARKS = {70, 63, 105, 66, 107};
    private static final int[] RIGHT_EYEBROW_LANDMARKS = {296, 334, 293, 300, 276};
    
    // Face gesture states
    private enum EyeState {
        EYES_OPEN, EYES_CLOSED, BLINK, LEFT_WINK, RIGHT_WINK, UNKNOWN
    }

    private enum MouthState {
        CLOSED, OPEN, SMILE, UNKNOWN
    }
    
    private enum EyebrowState {
        NORMAL, RAISED, UNKNOWN
    }

    // Dynamic configuration
    private DeviceConfig deviceConfig;
    private PerformanceTier performanceTier;

    // MediaPipe components
    private FaceLandmarker faceLandmarker;

    // Camera components
    private CameraDevice cameraDevice;
    private CameraCaptureSession cameraCaptureSession;
    private ImageReader imageReader;
    private Handler backgroundHandler;
    private HandlerThread backgroundThread;
    private boolean isProcessing = false;
    private ReactApplicationContext reactContext;
    private long lastEventTime = 0;
    private PowerManager.WakeLock wakeLock;
    private long lastProcessTime = 0;
    private boolean isServiceRunning = false;

    // State tracking
    private EyeState currentEyeState = EyeState.UNKNOWN;
    private EyeState previousEyeState = EyeState.UNKNOWN;
    private MouthState currentMouthState = MouthState.UNKNOWN;
    private MouthState previousMouthState = MouthState.UNKNOWN;
    private EyebrowState currentEyebrowState = EyebrowState.UNKNOWN;

    // Frame counting for gesture validation
    private int eyesOpenFrameCount = 0;
    private int eyesClosedFrameCount = 0;
    private int blinkFrameCount = 0;
    private int leftWinkFrameCount = 0;
    private int rightWinkFrameCount = 0;
    private int mouthOpenFrameCount = 0;
    private int mouthClosedFrameCount = 0;
    private int smileFrameCount = 0;
    private int eyebrowRaisedFrameCount = 0;

    // Performance monitoring
    private long[] processingTimes = new long[10];
    private int processingTimeIndex = 0;

    // Event queue and handlers
    private ConcurrentLinkedQueue<WritableMap> eventQueue = new ConcurrentLinkedQueue<>();
    private Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean isReceiverRegistered = false;

    // EAR calculation history for smoothing
    private float[] leftEyeEarHistory = new float[3];   // Shorter history for faster response
    private float[] rightEyeEarHistory = new float[3];
    private float[] mouthHistory = new float[3];
    private int earHistoryIndex = 0;

    // Blink detection state machine
    private boolean blinkInProgress = false;
    private long blinkStartTime = 0;
    private static final long MAX_BLINK_DURATION = 500; // 500ms max for valid blink

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "Enhanced Face Service onCreate - Eye, Mouth, and Eyebrow Detection");

        detectDevicePerformance();
        initializeDeviceConfig();
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, createNotification());
        registerBroadcastReceiver();
        getReactContext();
        initializeMediaPipe();
        startBackgroundThread();

        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "FaceService::WakeLock");
        wakeLock.acquire();

        isServiceRunning = true;
        initializeHistories();

        Log.i(TAG, "Enhanced Face Service initialized for " + performanceTier + " tier device");
    }

    private void detectDevicePerformance() {
        try {
            android.app.ActivityManager actManager = (android.app.ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
            android.app.ActivityManager.MemoryInfo memInfo = new android.app.ActivityManager.MemoryInfo();
            actManager.getMemoryInfo(memInfo);
            long totalMemory = memInfo.totalMem;

            if (totalMemory > 4L * 1024 * 1024 * 1024) { // > 4GB
                performanceTier = PerformanceTier.HIGH;
            } else if (totalMemory > 2L * 1024 * 1024 * 1024) { // > 2GB
                performanceTier = PerformanceTier.MEDIUM;
            } else {
                performanceTier = PerformanceTier.LOW;
            }
        } catch (Exception e) {
            performanceTier = PerformanceTier.MEDIUM;
        }
    }

    private void initializeDeviceConfig() {
        switch (performanceTier) {
            case HIGH:
                deviceConfig = new DeviceConfig(new Size(640, 480), 50, 2, 300, 0.3f, 0.3f);
                break;
            case MEDIUM:
                deviceConfig = new DeviceConfig(new Size(480, 360), 75, 3, 400, 0.4f, 0.4f);
                break;
            case LOW:
                deviceConfig = new DeviceConfig(new Size(320, 240), 100, 4, 500, 0.5f, 0.5f);
                break;
        }
    }

    private void initializeHistories() {
        Arrays.fill(leftEyeEarHistory, 0.25f);
        Arrays.fill(rightEyeEarHistory, 0.25f);
        Arrays.fill(mouthHistory, 0.02f);
    }

    private ReactContext getReactContext() {
        if (reactContext != null && reactContext.hasActiveReactInstance()) {
            return reactContext;
        }

        try {
            EyeModule module = EyeModule.getInstance();
            if (module != null) {
                ReactContext context = module.getContext();
                if (context != null && context.hasActiveReactInstance()) {
                    reactContext = (ReactApplicationContext) context;
                    Log.i(TAG, "React context obtained successfully");
                    return reactContext;
                }
            }
            return null;
        } catch (Exception e) {
            Log.e(TAG, "Failed to get React context: " + e.getMessage());
            return null;
        }
    }

    private void registerBroadcastReceiver() {
        if (isReceiverRegistered) return;
        IntentFilter filter = new IntentFilter("REACT_CONTEXT_AVAILABLE");
        LocalBroadcastManager.getInstance(this).registerReceiver(reactContextReceiver, filter);
        isReceiverRegistered = true;
    }

    private BroadcastReceiver reactContextReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            flushEventQueue();
        }
    };

    private void initializeMediaPipe() {
        try {
            BaseOptions baseOptions = BaseOptions.builder()
                    .setModelAssetPath("face_landmarker.task")
                    .build();

            FaceLandmarkerOptions options = FaceLandmarkerOptions.builder()
                    .setBaseOptions(baseOptions)
                    .setRunningMode(RunningMode.LIVE_STREAM)
                    .setNumFaces(1)
                    .setMinFaceDetectionConfidence(deviceConfig.minFaceDetectionConfidence)
                    .setMinFacePresenceConfidence(0.3f)
                    .setMinTrackingConfidence(deviceConfig.minTrackingConfidence)
                    .setOutputFaceBlendshapes(false)
                    .setResultListener(this::handleFaceLandmarkerResult)
                    .build();

            faceLandmarker = FaceLandmarker.createFromOptions(this, options);
            Log.i(TAG, "MediaPipe FaceLandmarker initialized successfully");
        } catch (Exception e) {
            Log.e(TAG, "MediaPipe initialization failed", e);
        }
    }

    private void handleFaceLandmarkerResult(FaceLandmarkerResult result, MPImage input) {
        if (result == null || result.faceLandmarks().isEmpty() || !isServiceRunning) {
            if (input != null) input.close();
            resetAllCounters();
            return;
        }

        try {
            List<NormalizedLandmark> landmarks = result.faceLandmarks().get(0);
            if (landmarks.size() < 400) { // Ensure we have enough landmarks
                if (input != null) input.close();
                return;
            }

            long currentTime = System.currentTimeMillis();

            // Calculate features with improved sensitivity
            float leftEAR = calculateEAR(landmarks, LEFT_EYE_LANDMARKS);
            float rightEAR = calculateEAR(landmarks, RIGHT_EYE_LANDMARKS);
            float mouthRatio = calculateMouthOpenness(landmarks);
            float smileRatio = calculateSmileRatio(landmarks);
            boolean eyebrowsRaised = detectEyebrowRaise(landmarks);

            // Apply smoothing
            leftEAR = smoothValue(leftEAR, leftEyeEarHistory);
            rightEAR = smoothValue(rightEAR, rightEyeEarHistory);
            mouthRatio = smoothValue(mouthRatio, mouthHistory);

            // Debug logging
            if (currentTime % 1000 < 50) { // Log every second
                Log.d(TAG, String.format("EAR: L=%.3f R=%.3f, Mouth=%.3f, Smile=%.3f", 
                    leftEAR, rightEAR, mouthRatio, smileRatio));
            }

            // Detect gestures
            detectEyeStates(leftEAR, rightEAR, currentTime);
            detectMouthStates(mouthRatio, smileRatio, currentTime);
            if (eyebrowsRaised) detectEyebrowStates(currentTime);

        } catch (Exception e) {
            Log.e(TAG, "Error processing face landmarks", e);
        } finally {
            if (input != null) input.close();
        }
    }

    /**
     * FIXED EAR calculation with correct landmark indices
     */
    private float calculateEAR(List<NormalizedLandmark> landmarks, int[] eyeIndices) {
        try {
            // Ensure we have enough landmarks
            for (int index : eyeIndices) {
                if (index >= landmarks.size()) {
                    Log.w(TAG, "Landmark index " + index + " out of bounds");
                    return 0.25f;
                }
            }

            NormalizedLandmark p1 = landmarks.get(eyeIndices[0]);
            NormalizedLandmark p2 = landmarks.get(eyeIndices[1]);
            NormalizedLandmark p3 = landmarks.get(eyeIndices[2]);
            NormalizedLandmark p4 = landmarks.get(eyeIndices[3]);
            NormalizedLandmark p5 = landmarks.get(eyeIndices[4]);
            NormalizedLandmark p6 = landmarks.get(eyeIndices[5]);

            // Calculate vertical distances
            double dist1 = euclideanDistance(p2, p6);
            double dist2 = euclideanDistance(p3, p5);
            double horizontalDist = euclideanDistance(p1, p4);

            if (horizontalDist == 0) return 0.25f;
            
            float ear = (float) ((dist1 + dist2) / (2.0 * horizontalDist));
            
            // Clamp to reasonable range
            return Math.max(0.0f, Math.min(1.0f, ear));

        } catch (Exception e) {
            Log.e(TAG, "Error calculating EAR", e);
            return 0.25f;
        }
    }

    private float calculateMouthOpenness(List<NormalizedLandmark> landmarks) {
        try {
            if (MOUTH_TOP >= landmarks.size() || MOUTH_BOTTOM >= landmarks.size()) {
                return 0.02f;
            }
            
            NormalizedLandmark top = landmarks.get(MOUTH_TOP);
            NormalizedLandmark bottom = landmarks.get(MOUTH_BOTTOM);
            NormalizedLandmark left = landmarks.get(MOUTH_LEFT);
            NormalizedLandmark right = landmarks.get(MOUTH_RIGHT);

            double verticalDist = euclideanDistance(top, bottom);
            double horizontalDist = euclideanDistance(left, right);

            if (horizontalDist == 0) return 0.02f;
            
            // Mouth aspect ratio (similar to EAR but for mouth)
            return (float) (verticalDist / horizontalDist);

        } catch (Exception e) {
            Log.e(TAG, "Error calculating mouth openness", e);
            return 0.02f;
        }
    }

    private float calculateSmileRatio(List<NormalizedLandmark> landmarks) {
        try {
            if (MOUTH_LEFT >= landmarks.size() || MOUTH_RIGHT >= landmarks.size()) {
                return 0.0f;
            }
            
            NormalizedLandmark leftCorner = landmarks.get(MOUTH_LEFT);
            NormalizedLandmark rightCorner = landmarks.get(MOUTH_RIGHT);
            NormalizedLandmark center = landmarks.get(MOUTH_TOP);

            // Calculate if mouth corners are higher than center (smile)
            float leftHeight = center.y() - leftCorner.y();
            float rightHeight = center.y() - rightCorner.y();
            
            return (leftHeight + rightHeight) / 2.0f;

        } catch (Exception e) {
            return 0.0f;
        }
    }

    private boolean detectEyebrowRaise(List<NormalizedLandmark> landmarks) {
        try {
            // Simple eyebrow raise detection based on eyebrow height relative to eye
            if (LEFT_EYEBROW_LANDMARKS[0] >= landmarks.size()) return false;
            
            float leftEyebrowY = landmarks.get(LEFT_EYEBROW_LANDMARKS[0]).y();
            float leftEyeY = landmarks.get(LEFT_EYE_LANDMARKS[0]).y();
            
            return (leftEyeY - leftEyebrowY) > EYEBROW_RAISE_THRESHOLD;
            
        } catch (Exception e) {
            return false;
        }
    }

    private double euclideanDistance(NormalizedLandmark p1, NormalizedLandmark p2) {
        double dx = p1.x() - p2.x();
        double dy = p1.y() - p2.y();
        return Math.sqrt(dx * dx + dy * dy);
    }

    private float smoothValue(float currentValue, float[] history) {
        history[earHistoryIndex % history.length] = currentValue;
        
        float sum = 0;
        for (float value : history) {
            sum += value;
        }
        
        if (earHistoryIndex % history.length == history.length - 1) {
            earHistoryIndex++;
        }
        
        return sum / history.length;
    }

    private void detectEyeStates(float leftEAR, float rightEAR, long currentTime) {
        float avgEAR = (leftEAR + rightEAR) / 2.0f;
        float earDifference = Math.abs(leftEAR - rightEAR);

        // Improved blink detection with state machine
        if (!blinkInProgress && currentEyeState == EyeState.EYES_OPEN && avgEAR < EYE_BLINK_THRESHOLD) {
            // Start of blink
            blinkInProgress = true;
            blinkStartTime = currentTime;
            currentEyeState = EyeState.EYES_CLOSED;
            eyesClosedFrameCount = 1;
            Log.d(TAG, "Blink started, EAR: " + avgEAR);
        } 
        else if (blinkInProgress && avgEAR > EYE_OPEN_THRESHOLD) {
            // End of blink
            long blinkDuration = currentTime - blinkStartTime;
            if (blinkDuration < MAX_BLINK_DURATION && eyesClosedFrameCount >= 2) {
                sendFaceEvent("blink", currentTime);
                Log.d(TAG, "Blink detected! Duration: " + blinkDuration + "ms");
            }
            blinkInProgress = false;
            currentEyeState = EyeState.EYES_OPEN;
            resetEyeCounters();
        }
        else if (blinkInProgress) {
            eyesClosedFrameCount++;
            // Check for blink timeout
            if (currentTime - blinkStartTime > MAX_BLINK_DURATION) {
                blinkInProgress = false;
                currentEyeState = EyeState.EYES_CLOSED;
                sendFaceEvent("eyes_closed", currentTime);
            }
        }
        
        // Wink detection
        if (!blinkInProgress && earDifference > WINK_ASYMMETRY_THRESHOLD) {
            if (leftEAR < EYE_BLINK_THRESHOLD && rightEAR > EYE_OPEN_THRESHOLD) {
                leftWinkFrameCount++;
                if (leftWinkFrameCount >= deviceConfig.consecutiveFrames) {
                    sendFaceEvent("wink_left", currentTime);
                    resetEyeCounters();
                }
            } else if (rightEAR < EYE_BLINK_THRESHOLD && leftEAR > EYE_OPEN_THRESHOLD) {
                rightWinkFrameCount++;
                if (rightWinkFrameCount >= deviceConfig.consecutiveFrames) {
                    sendFaceEvent("wink_right", currentTime);
                    resetEyeCounters();
                }
            }
        } else {
            leftWinkFrameCount = 0;
            rightWinkFrameCount = 0;
        }
        
        // Eyes open detection
        if (!blinkInProgress && avgEAR > EYE_OPEN_THRESHOLD && currentEyeState != EyeState.EYES_OPEN) {
            eyesOpenFrameCount++;
            if (eyesOpenFrameCount >= deviceConfig.consecutiveFrames) {
                sendFaceEvent("eyes_open", currentTime);
                currentEyeState = EyeState.EYES_OPEN;
            }
        } else if (avgEAR <= EYE_OPEN_THRESHOLD) {
            eyesOpenFrameCount = 0;
        }

        previousEyeState = currentEyeState;
    }

    private void detectMouthStates(float mouthRatio, float smileRatio, long currentTime) {
        // Mouth open detection
        if (mouthRatio > MOUTH_OPEN_THRESHOLD) {
            mouthOpenFrameCount++;
            mouthClosedFrameCount = 0;
            if (mouthOpenFrameCount >= deviceConfig.consecutiveFrames && 
                currentMouthState != MouthState.OPEN) {
                sendFaceEvent("mouth_open", currentTime);
                currentMouthState = MouthState.OPEN;
            }
        } else {
            mouthClosedFrameCount++;
            mouthOpenFrameCount = 0;
            if (mouthClosedFrameCount >= deviceConfig.consecutiveFrames && 
                currentMouthState != MouthState.CLOSED) {
                sendFaceEvent("mouth_closed", currentTime);
                currentMouthState = MouthState.CLOSED;
            }
        }

        // Smile detection
        if (smileRatio > MOUTH_SMILE_THRESHOLD) {
            smileFrameCount++;
            if (smileFrameCount >= deviceConfig.consecutiveFrames) {
                sendFaceEvent("smile", currentTime);
                smileFrameCount = 0; // Reset to avoid spam
            }
        } else {
            smileFrameCount = 0;
        }
    }

    private void detectEyebrowStates(long currentTime) {
        eyebrowRaisedFrameCount++;
        if (eyebrowRaisedFrameCount >= deviceConfig.consecutiveFrames && 
            currentEyebrowState != EyebrowState.RAISED) {
            sendFaceEvent("eyebrow_raise", currentTime);
            currentEyebrowState = EyebrowState.RAISED;
        }
    }

    private void resetEyeCounters() {
        eyesOpenFrameCount = 0;
        eyesClosedFrameCount = 0;
        blinkFrameCount = 0;
        leftWinkFrameCount = 0;
        rightWinkFrameCount = 0;
    }

    private void resetMouthCounters() {
        mouthOpenFrameCount = 0;
        mouthClosedFrameCount = 0;
        smileFrameCount = 0;
    }

    private void resetAllCounters() {
        resetEyeCounters();
        resetMouthCounters();
        eyebrowRaisedFrameCount = 0;
    }

    private void sendFaceEvent(String eventType, long currentTime) {
        if (currentTime - lastEventTime < deviceConfig.eventCooldown) {
            return;
        }
        
        lastEventTime = currentTime;
        
        WritableMap params = Arguments.createMap();
        params.putString("event", eventType);
        params.putLong("timestamp", currentTime);
        
        ReactContext context = getReactContext();
        if (context != null && context.hasActiveReactInstance()) {
            sendEventToJS(params, context);
        } else {
            eventQueue.offer(params);
            if (backgroundHandler != null) {
                backgroundHandler.postDelayed(this::flushEventQueue, 500);
            }
        }
        
        Log.i(TAG, "Face event detected: " + eventType);
    }

    private void sendEventToJS(WritableMap params, ReactContext context) {
        try {
            EyeModule module = EyeModule.getInstance();
            if (module != null) {
                module.sendEyeEvent(params.getString("event"));
                Log.d(TAG, "Successfully sent event: " + params.getString("event"));
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to send event: " + e.getMessage());
            eventQueue.offer(params);
        }
    }

    private void flushEventQueue() {
        if (!isServiceRunning) {
            eventQueue.clear();
            return;
        }

        ReactContext context = getReactContext();
        if (context != null && context.hasActiveReactInstance()) {
            mainHandler.post(() -> {
                try {
                    int processedEvents = 0;
                    while (!eventQueue.isEmpty() && processedEvents < 3) {
                        WritableMap event = eventQueue.poll();
                        if (event != null) {
                            sendEventToJS(event, context);
                            processedEvents++;
                        }
                    }
                    
                    if (!eventQueue.isEmpty()) {
                        backgroundHandler.postDelayed(this::flushEventQueue, 300);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error flushing event queue", e);
                }
            });
        } else {
            backgroundHandler.postDelayed(this::flushEventQueue, 1000);
        }
    }

    private void startBackgroundThread() {
        backgroundThread = new HandlerThread("FaceCameraBackground", Thread.NORM_PRIORITY);
        backgroundThread.start();
        backgroundHandler = new Handler(backgroundThread.getLooper());
        Log.i(TAG, "Background thread started");
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Enhanced Face Gesture Detection",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Eye, mouth, and eyebrow gesture detection");
            channel.setShowBadge(false);
            channel.enableLights(false);
            channel.enableVibration(false);
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }

    private Notification createNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent, 
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
        );

        return new Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Enhanced Face Gesture Detection Active")
            .setContentText("Detecting eyes, mouth, eyebrows (" + performanceTier + ")")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build();
    }

    // Camera Management
    private final CameraDevice.StateCallback stateCallback = new CameraDevice.StateCallback() {
        @Override
        public void onOpened(@NonNull CameraDevice camera) {
            Log.i(TAG, "Camera opened successfully");
            cameraDevice = camera;
            createCameraPreviewSession();
        }

        @Override
        public void onDisconnected(@NonNull CameraDevice camera) {
            Log.w(TAG, "Camera disconnected");
            camera.close();
            cameraDevice = null;
            if (isServiceRunning) {
                scheduleCameraRestart();
            }
        }

        @Override
        public void onError(@NonNull CameraDevice camera, int error) {
            Log.e(TAG, "Camera error: " + error);
            camera.close();
            cameraDevice = null;
            if (isServiceRunning) {
                scheduleCameraRestart();
            }
        }
    };

    private void scheduleCameraRestart() {
        if (backgroundHandler != null && isServiceRunning) {
            backgroundHandler.postDelayed(() -> {
                if (isServiceRunning) {
                    Log.i(TAG, "Restarting camera after error");
                    stopCamera();
                    startCamera();
                }
            }, 3000);
        }
    }

    private Size getOptimalCameraSize() {
        try {
            CameraManager manager = (CameraManager) getSystemService(CAMERA_SERVICE);
            String[] cameraIds = manager.getCameraIdList();

            for (String cameraId : cameraIds) {
                CameraCharacteristics characteristics = manager.getCameraCharacteristics(cameraId);
                Integer facing = characteristics.get(CameraCharacteristics.LENS_FACING);

                if (facing != null && facing == CameraCharacteristics.LENS_FACING_FRONT) {
                    StreamConfigurationMap map = characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
                    if (map != null) {
                        Size[] outputSizes = map.getOutputSizes(ImageFormat.YUV_420_888);
                        return findBestSize(outputSizes, deviceConfig.imageSize);
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting optimal camera size", e);
        }
        return deviceConfig.imageSize;
    }

    private Size findBestSize(Size[] sizes, Size target) {
        if (sizes == null || sizes.length == 0) return target;

        Size bestSize = sizes[0];
        long bestDiff = Long.MAX_VALUE;
        long targetPixels = (long) target.getWidth() * target.getHeight();

        for (Size size : sizes) {
            long sizePixels = (long) size.getWidth() * size.getHeight();
            long diff = Math.abs(targetPixels - sizePixels);

            if (sizePixels <= targetPixels * 1.5 && diff < bestDiff) {
                bestSize = size;
                bestDiff = diff;
            }
        }

        Log.i(TAG, "Selected camera size: " + bestSize.getWidth() + "x" + bestSize.getHeight());
        return bestSize;
    }

    private Bitmap convertYuvToBitmap(Image image) {
        ByteArrayOutputStream out = null;
        try {
            Image.Plane[] planes = image.getPlanes();
            ByteBuffer yBuffer = planes[0].getBuffer();
            ByteBuffer uBuffer = planes[1].getBuffer();
            ByteBuffer vBuffer = planes[2].getBuffer();

            int ySize = yBuffer.remaining();
            int uSize = uBuffer.remaining();
            int vSize = vBuffer.remaining();

            byte[] nv21 = new byte[ySize + uSize + vSize];
            yBuffer.get(nv21, 0, ySize);
            vBuffer.get(nv21, ySize, vSize);
            uBuffer.get(nv21, ySize + vSize, uSize);

            YuvImage yuvImage = new YuvImage(nv21, ImageFormat.NV21, 
                image.getWidth(), image.getHeight(), null);
            out = new ByteArrayOutputStream();
            yuvImage.compressToJpeg(new Rect(0, 0, yuvImage.getWidth(), yuvImage.getHeight()), 
                80, out);
            
            byte[] imageBytes = out.toByteArray();
            Bitmap bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.length);

            if (bitmap != null) {
                Matrix matrix = new Matrix();
                matrix.postRotate(270);
                matrix.postScale(-1, 1);
                return Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
            }

            return bitmap;
        } catch (Exception e) {
            Log.e(TAG, "Error converting YUV to Bitmap", e);
            return null;
        } finally {
            if (out != null) {
                try {
                    out.close();
                } catch (Exception e) {
                    Log.e(TAG, "Error closing output stream", e);
                }
            }
        }
    }

    private void createCameraPreviewSession() {
        try {
            Size optimalSize = getOptimalCameraSize();
            imageReader = ImageReader.newInstance(
                optimalSize.getWidth(), 
                optimalSize.getHeight(),
                ImageFormat.YUV_420_888, 
                2
            );

            imageReader.setOnImageAvailableListener(reader -> {
                if (!isProcessing || !isServiceRunning) {
                    return;
                }

                long currentTime = System.currentTimeMillis();
                if (currentTime - lastProcessTime < deviceConfig.processDelay) {
                    Image image = reader.acquireLatestImage();
                    if (image != null) image.close();
                    return;
                }
                lastProcessTime = currentTime;

                Image image = null;
                try {
                    image = reader.acquireLatestImage();
                    if (image != null && faceLandmarker != null) {
                        Bitmap bitmap = convertYuvToBitmap(image);
                        if (bitmap != null) {
                            MPImage mpImage = new BitmapImageBuilder(bitmap).build();
                            long frameTime = SystemClock.uptimeMillis();
                            
                            faceLandmarker.detectAsync(mpImage, frameTime);
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error processing camera image", e);
                } finally {
                    if (image != null) {
                        image.close();
                    }
                }
            }, backgroundHandler);

            SurfaceTexture texture = new SurfaceTexture(0);
            texture.setDefaultBufferSize(optimalSize.getWidth(), optimalSize.getHeight());
            Surface previewSurface = new Surface(texture);

            final CaptureRequest.Builder builder = cameraDevice.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW);
            builder.addTarget(previewSurface);
            builder.addTarget(imageReader.getSurface());

            cameraDevice.createCaptureSession(
                Arrays.asList(previewSurface, imageReader.getSurface()),
                new CameraCaptureSession.StateCallback() {
                    @Override
                    public void onConfigured(@NonNull CameraCaptureSession session) {
                        Log.i(TAG, "Camera capture session configured");
                        if (cameraDevice == null) return;

                        cameraCaptureSession = session;
                        try {
                            builder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO);
                            builder.set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON);
                            builder.set(CaptureRequest.CONTROL_AWB_MODE, CaptureRequest.CONTROL_AWB_MODE_AUTO);
                            builder.set(CaptureRequest.STATISTICS_FACE_DETECT_MODE, 
                                CaptureRequest.STATISTICS_FACE_DETECT_MODE_SIMPLE);

                            CaptureRequest request = builder.build();
                            cameraCaptureSession.setRepeatingRequest(request, null, backgroundHandler);

                            isProcessing = true;
                            Log.i(TAG, "Enhanced face gesture detection started");
                        } catch (CameraAccessException e) {
                            Log.e(TAG, "Failed to start camera preview", e);
                        }
                    }

                    @Override
                    public void onConfigureFailed(@NonNull CameraCaptureSession session) {
                        Log.e(TAG, "Camera capture session configuration failed");
                    }
                },
                backgroundHandler
            );
        } catch (CameraAccessException e) {
            Log.e(TAG, "Failed to create camera preview session", e);
        }
    }

    private void startCamera() {
        if (!isServiceRunning) {
            Log.w(TAG, "Service not running, cannot start camera");
            return;
        }

        CameraManager manager = (CameraManager) getSystemService(CAMERA_SERVICE);
        try {
            String[] cameraIds = manager.getCameraIdList();
            String frontCameraId = null;

            for (String cameraId : cameraIds) {
                CameraCharacteristics characteristics = manager.getCameraCharacteristics(cameraId);
                Integer facing = characteristics.get(CameraCharacteristics.LENS_FACING);
                if (facing != null && facing == CameraCharacteristics.LENS_FACING_FRONT) {
                    frontCameraId = cameraId;
                    break;
                }
            }

            if (frontCameraId != null) {
                Log.i(TAG, "Opening front camera: " + frontCameraId);
                manager.openCamera(frontCameraId, stateCallback, backgroundHandler);
            } else {
                Log.e(TAG, "No front camera found");
            }
        } catch (CameraAccessException | SecurityException e) {
            Log.e(TAG, "Failed to open camera", e);
        }
    }

    private void stopCamera() {
        isProcessing = false;

        if (cameraCaptureSession != null) {
            try {
                cameraCaptureSession.stopRepeating();
                cameraCaptureSession.close();
            } catch (Exception e) {
                Log.e(TAG, "Error stopping camera session", e);
            }
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

        Log.i(TAG, "Camera stopped");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "onStartCommand - Enhanced face gesture detection starting");

        if (!isServiceRunning) {
            Log.i(TAG, "Reinitializing service components");
            isServiceRunning = true;
            
            if (faceLandmarker == null) {
                initializeMediaPipe();
            }
            if (backgroundHandler == null) {
                startBackgroundThread();
            }
        }

        startCamera();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        Log.i(TAG, "Enhanced Face Service onDestroy - Cleaning up resources");
        isServiceRunning = false;
        isProcessing = false;

        if (isReceiverRegistered) {
            try {
                LocalBroadcastManager.getInstance(this).unregisterReceiver(reactContextReceiver);
            } catch (Exception e) {
                Log.e(TAG, "Error unregistering receiver", e);
            }
        }

        stopCamera();

        if (faceLandmarker != null) {
            faceLandmarker.close();
            faceLandmarker = null;
        }

        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }

        if (backgroundThread != null) {
            backgroundThread.quitSafely();
            try {
                backgroundThread.join(1000);
            } catch (InterruptedException e) {
                Log.w(TAG, "Background thread interrupted during shutdown");
            }
            backgroundThread = null;
            backgroundHandler = null;
        }

        eventQueue.clear();

        Log.i(TAG, "Enhanced Face Service destroyed successfully");
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}