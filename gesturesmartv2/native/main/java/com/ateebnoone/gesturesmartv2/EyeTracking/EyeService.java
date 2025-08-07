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

import android.util.Log;
import android.util.Size;

import android.view.Surface;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageFormat;
import android.graphics.Matrix;
import android.graphics.Rect;
import android.graphics.SurfaceTexture;
import android.graphics.YuvImage;

import androidx.annotation.NonNull;

import com.facebook.react.ReactApplication;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.concurrent.ConcurrentLinkedQueue;
import android.os.Handler;
import android.os.Looper;

// ML Kit imports - Face Detection only
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.face.Face;
import com.google.mlkit.vision.face.FaceDetection;
import com.google.mlkit.vision.face.FaceDetector;
import com.google.mlkit.vision.face.FaceDetectorOptions;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

public class EyeService extends Service {
    private static final String TAG = "EyeService";
    private static final String CHANNEL_ID = "EyeServiceChannel";
    private static final int NOTIFICATION_ID = 2;

    // Device performance tiers
    private enum PerformanceTier {
        LOW, MEDIUM, HIGH, FLAGSHIP
    }

    // Dynamic configuration based on device performance
    private static class DeviceConfig {
        final Size imageSize;
        final long processDelay;
        final int consecutiveFrames;
        final long eventCooldown;
        final int performanceMode;
        final float minFaceSize;

        DeviceConfig(Size imageSize, long processDelay, int consecutiveFrames,
                long eventCooldown, int performanceMode, float minFaceSize) {
            this.imageSize = imageSize;
            this.processDelay = processDelay;
            this.consecutiveFrames = consecutiveFrames;
            this.eventCooldown = eventCooldown;
            this.performanceMode = performanceMode;
            this.minFaceSize = minFaceSize;
        }
    }

    // Eye detection thresholds
    private static final float EYE_CLOSED_THRESHOLD = 0.2f;
    private static final float HEAD_YAW_THRESHOLD = 15.0f;
    private static final float HEAD_PITCH_THRESHOLD = 15.0f;

    // Dynamic configuration
    private DeviceConfig deviceConfig;
    private PerformanceTier performanceTier;

    private CameraDevice cameraDevice;
    private CameraCaptureSession cameraCaptureSession;
    private ImageReader imageReader;
    private Handler backgroundHandler;
    private HandlerThread backgroundThread;
    private FaceDetector faceDetector;
    private boolean isProcessing = false;
    private ReactApplicationContext reactContext;
    private long lastEventTime = 0;
    private PowerManager.WakeLock wakeLock;
    private long lastProcessTime = 0;
    private boolean isServiceRunning = false;
    private final Executor mlkitExecutor = Executors.newSingleThreadExecutor();

    // Frame tracking
    private int blinkFrameCount = 0;
    private int leftWinkFrameCount = 0;
    private int rightWinkFrameCount = 0;
    private int lookLeftFrameCount = 0;
    private int lookRightFrameCount = 0;
    private int lookUpFrameCount = 0;
    private int lookDownFrameCount = 0;
    private int noneFrameCount = 0;
    private String lastGazeDirection = "";

    // Performance monitoring
    private long[] processingTimes = new long[10];
    private int processingTimeIndex = 0;
    private long lastPerformanceCheck = 0;
    private static final long PERFORMANCE_CHECK_INTERVAL = 10000; // 10 seconds

    private ConcurrentLinkedQueue<WritableMap> eventQueue = new ConcurrentLinkedQueue<>();
    private Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean isReceiverRegistered = false;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "EyeService onCreate");

        // Detect device performance and configure accordingly
        detectDevicePerformance();
        initializeDeviceConfig();

        createNotificationChannel();
        startForeground(NOTIFICATION_ID, createNotification());
        registerBroadcastReceiver();
        getReactContext();

        initializeMLKit();
        startBackgroundThread();

        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "EyeService::WakeLock");
        wakeLock.acquire();

        isServiceRunning = true;

        Log.i(TAG, "Device configured for " + performanceTier + " performance tier");
        Log.i(TAG, "Image size: " + deviceConfig.imageSize.getWidth() + "x" + deviceConfig.imageSize.getHeight());
    }

    private void detectDevicePerformance() {
        try {
            // Get device info
            String deviceModel = Build.MODEL.toLowerCase();
            String deviceBrand = Build.MANUFACTURER.toLowerCase();
            int sdkVersion = Build.VERSION.SDK_INT;

            // Get available RAM
            android.app.ActivityManager actManager = (android.app.ActivityManager) getSystemService(
                    Context.ACTIVITY_SERVICE);
            android.app.ActivityManager.MemoryInfo memInfo = new android.app.ActivityManager.MemoryInfo();
            actManager.getMemoryInfo(memInfo);
            long availableMemory = memInfo.totalMem;

            Log.i(TAG, "Device: " + deviceBrand + " " + deviceModel);
            Log.i(TAG, "SDK: " + sdkVersion + ", Total Memory: " + (availableMemory / 1024 / 1024) + "MB");

            // Determine performance tier
            if (isHighEndDevice(deviceModel, deviceBrand, availableMemory, sdkVersion)) {
                performanceTier = PerformanceTier.HIGH;
            } else if (isMediumEndDevice(deviceModel, deviceBrand, availableMemory, sdkVersion)) {
                performanceTier = PerformanceTier.MEDIUM;
            } else if (isBasicDevice(deviceModel, deviceBrand, availableMemory, sdkVersion)) {
                performanceTier = PerformanceTier.LOW;
            } else {
                // Default fallback based on memory only
                if (availableMemory > 4L * 1024 * 1024 * 1024) {
                    performanceTier = PerformanceTier.HIGH;
                } else if (availableMemory > 2L * 1024 * 1024 * 1024) {
                    performanceTier = PerformanceTier.MEDIUM;
                } else {
                    performanceTier = PerformanceTier.LOW;
                }
            }

            Log.i(TAG, "Detected performance tier: " + performanceTier);

        } catch (Exception e) {
            Log.e(TAG, "Error detecting device performance, defaulting to MEDIUM", e);
            performanceTier = PerformanceTier.MEDIUM;
        }
    }

    private boolean isHighEndDevice(String model, String brand, long maxMemory, int sdkVersion) {
        return (brand.contains("google") && (model.contains("pixel 6") || model.contains("pixel 7") ||
                model.contains("pixel 8") || model.contains("pixel 4a") || model.contains("pixel 5"))) ||
                (brand.contains("samsung") && (model.contains("galaxy s") || model.contains("galaxy note"))) ||
                (brand.contains("oneplus") && sdkVersion >= 30) ||
                (brand.contains("sony") && model.contains("xperia 1")) ||
                (maxMemory > 6L * 1024 * 1024 * 1024); // >6GB RAM
    }

    private boolean isMediumEndDevice(String model, String brand, long maxMemory, int sdkVersion) {
        return (brand.contains("vivo") && (model.contains("y") || model.contains("v21") || model.contains("v20"))) ||
                (brand.contains("oppo")
                        && (model.contains("a") || model.contains("reno 4") || model.contains("reno 5")))
                ||
                (brand.contains("samsung") && (model.contains("galaxy a") || model.contains("galaxy m"))) ||
                (brand.contains("xiaomi") && (model.contains("redmi note") || model.contains("mi 10t"))) ||
                (maxMemory > 2L * 1024 * 1024 * 1024 && maxMemory <= 4L * 1024 * 1024 * 1024); // 2-4GB RAM
    }

    private boolean isBasicDevice(String model, String brand, long maxMemory, int sdkVersion) {
        return maxMemory > 2L * 1024 * 1024 * 1024 && maxMemory <= 3L * 1024 * 1024 * 1024; // 2-3GB RAM
    }

    private void initializeDeviceConfig() {
        switch (performanceTier) {
            case FLAGSHIP:
                deviceConfig = new DeviceConfig(
                        new Size(800, 600), // High resolution
                        50, // Fast processing
                        2, // Quick response
                        300, // Short cooldown
                        FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE,
                        0.2f // Smaller min face size
                );
                break;

            case HIGH:
                deviceConfig = new DeviceConfig(
                        new Size(640, 480), // Good resolution
                        75, // Good processing speed
                        3, // Balanced response
                        400, // Moderate cooldown
                        FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE,
                        0.25f);
                break;

            case MEDIUM:
                deviceConfig = new DeviceConfig(
                        new Size(480, 360), // Lower resolution for better performance
                        150, // Slower processing for stability
                        4, // More frames for accuracy
                        600, // Longer cooldown
                        FaceDetectorOptions.PERFORMANCE_MODE_FAST,
                        0.35f // Larger min face size
                );
                break;

            case LOW:
                deviceConfig = new DeviceConfig(
                        new Size(320, 240), // Low resolution
                        200, // Slower processing
                        5, // More frames needed
                        750, // Long cooldown
                        FaceDetectorOptions.PERFORMANCE_MODE_FAST,
                        0.4f);
                break;
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
                    StreamConfigurationMap map = characteristics
                            .get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
                    if (map != null) {
                        Size[] outputSizes = map.getOutputSizes(ImageFormat.YUV_420_888);
                        Size targetSize = deviceConfig.imageSize;
                        Size bestSize = findClosestSize(outputSizes, targetSize);

                        Log.i(TAG, "Optimal camera size: " + bestSize.getWidth() + "x" + bestSize.getHeight());
                        return bestSize;
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting optimal camera size", e);
        }

        return deviceConfig.imageSize;
    }

    private Size findClosestSize(Size[] sizes, Size target) {
        if (sizes == null || sizes.length == 0)
            return target;

        Size bestSize = sizes[0];
        long bestDiff = Long.MAX_VALUE;

        for (Size size : sizes) {
            long targetPixels = (long) target.getWidth() * target.getHeight();
            long sizePixels = (long) size.getWidth() * size.getHeight();
            long diff = Math.abs(targetPixels - sizePixels);

            if (sizePixels <= targetPixels * 2 && diff < bestDiff) {
                bestSize = size;
                bestDiff = diff;
            }
        }

        return bestSize;
    }

    private void monitorPerformance() {
        long currentTime = System.currentTimeMillis();

        if (currentTime - lastPerformanceCheck > PERFORMANCE_CHECK_INTERVAL) {
            long totalTime = 0;
            int validTimes = 0;

            for (long time : processingTimes) {
                if (time > 0) {
                    totalTime += time;
                    validTimes++;
                }
            }

            if (validTimes > 0) {
                long avgTime = totalTime / validTimes;
                Log.d(TAG, "Average processing time: " + avgTime + "ms");

                if (avgTime > 200 && performanceTier != PerformanceTier.LOW) {
                    Log.w(TAG, "Performance degradation detected, reducing quality");
                    adaptToPerformance();
                }
            }

            lastPerformanceCheck = currentTime;
        }
    }

    private void adaptToPerformance() {
        if (deviceConfig.processDelay < 250) {
            DeviceConfig newConfig = new DeviceConfig(
                    deviceConfig.imageSize,
                    deviceConfig.processDelay + 25,
                    deviceConfig.consecutiveFrames + 1,
                    deviceConfig.eventCooldown + 100,
                    FaceDetectorOptions.PERFORMANCE_MODE_FAST,
                    deviceConfig.minFaceSize + 0.05f);
            deviceConfig = newConfig;
            Log.i(TAG, "Adapted configuration for better performance");
        }
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
                    Log.i(TAG, "React context obtained successfully from EyeModule");
                    return reactContext;
                } else {
                    Log.w(TAG, "React context from EyeModule is null or inactive");
                }
            } else {
                Log.w(TAG, "EyeModule instance not available");
            }
            return null;
        } catch (Exception e) {
            Log.e(TAG, "Failed to get React context: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }

    private void registerBroadcastReceiver() {
        if (isReceiverRegistered)
            return;

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

    private void initializeMLKit() {
        try {
            FaceDetectorOptions options = new FaceDetectorOptions.Builder()
                    .setPerformanceMode(deviceConfig.performanceMode)
                    .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE)
                    .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL) // Enable eye open probability
                    .setContourMode(FaceDetectorOptions.CONTOUR_MODE_NONE)
                    .setMinFaceSize(deviceConfig.minFaceSize)
                    .enableTracking()
                    .build();

            faceDetector = FaceDetection.getClient(options);

            Log.i(TAG, "ML Kit Face Detector initialized with " +
                    (deviceConfig.performanceMode == FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE ? "ACCURATE"
                            : "FAST")
                    + " mode");
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize ML Kit: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void processFaceDetection(InputImage image) {
        if (!isProcessing || !isServiceRunning)
            return;

        long startTime = System.currentTimeMillis();

        faceDetector.process(image)
                .addOnSuccessListener(mlkitExecutor, faces -> {
                    if (!faces.isEmpty()) {
                        detectEyeAndGazeEvents(faces.get(0));
                    } else {
                        resetFrameCounters();
                    }

                    // Record processing time
                    long processingTime = System.currentTimeMillis() - startTime;
                    processingTimes[processingTimeIndex] = processingTime;
                    processingTimeIndex = (processingTimeIndex + 1) % processingTimes.length;

                    monitorPerformance();
                })
                .addOnFailureListener(e -> Log.e(TAG, "Face detection failed: " + e.getMessage()));
    }

    private void resetFrameCounters() {
        blinkFrameCount = 0;
        leftWinkFrameCount = 0;
        rightWinkFrameCount = 0;
        lookLeftFrameCount = 0;
        lookRightFrameCount = 0;
        lookUpFrameCount = 0;
        lookDownFrameCount = 0;
        noneFrameCount = 0;
    }

    private void detectEyeAndGazeEvents(Face face) {
        try {
            long currentTime = System.currentTimeMillis();
            if (currentTime - lastEventTime < deviceConfig.eventCooldown)
                return;

            // Get eye open probabilities
            float leftEyeOpenProb = face.getLeftEyeOpenProbability() != null ? face.getLeftEyeOpenProbability() : 1.0f;
            float rightEyeOpenProb = face.getRightEyeOpenProbability() != null ? face.getRightEyeOpenProbability()
                    : 1.0f;

            // Get head pose angles
            float headYaw = face.getHeadEulerAngleY(); // Left/Right rotation
            float headPitch = face.getHeadEulerAngleX(); // Up/Down rotation

            Log.v(TAG, String.format("Eye probabilities - Left: %.3f, Right: %.3f, Yaw: %.1f°, Pitch: %.1f°",
                    leftEyeOpenProb, rightEyeOpenProb, headYaw, headPitch));

            // Detect eye events
            detectBlinkAndWinks(leftEyeOpenProb, rightEyeOpenProb, currentTime);

            // Detect gaze direction
            detectGazeDirection(headYaw, headPitch, currentTime);

        } catch (Exception e) {
            Log.e(TAG, "Error in eye event detection", e);
        }
    }

    private void detectBlinkAndWinks(float leftEyeOpenProb, float rightEyeOpenProb, long currentTime) {
        // Blink: Both eyes closed
        if (leftEyeOpenProb < EYE_CLOSED_THRESHOLD && rightEyeOpenProb < EYE_CLOSED_THRESHOLD) {
            blinkFrameCount++;
            leftWinkFrameCount = 0;
            rightWinkFrameCount = 0;

            if (blinkFrameCount >= deviceConfig.consecutiveFrames) {
                sendEyeEvent("blink", currentTime);
                resetFrameCounters();
            }
        }
        // Left wink: Left eye closed, right eye open
        else if (leftEyeOpenProb < EYE_CLOSED_THRESHOLD && rightEyeOpenProb >= EYE_CLOSED_THRESHOLD) {
            leftWinkFrameCount++;
            blinkFrameCount = 0;
            rightWinkFrameCount = 0;

            if (leftWinkFrameCount >= deviceConfig.consecutiveFrames) {
                sendEyeEvent("wink_left", currentTime);
                resetFrameCounters();
            }
        }
        // Right wink: Right eye closed, left eye open
        else if (rightEyeOpenProb < EYE_CLOSED_THRESHOLD && leftEyeOpenProb >= EYE_CLOSED_THRESHOLD) {
            rightWinkFrameCount++;
            blinkFrameCount = 0;
            leftWinkFrameCount = 0;

            if (rightWinkFrameCount >= deviceConfig.consecutiveFrames) {
                sendEyeEvent("wink_right", currentTime);
                resetFrameCounters();
            }
        }
        // Reset counters if no eye event detected
        else {
            if (blinkFrameCount > 0)
                blinkFrameCount--;
            if (leftWinkFrameCount > 0)
                leftWinkFrameCount--;
            if (rightWinkFrameCount > 0)
                rightWinkFrameCount--;
        }
    }

    private void detectGazeDirection(float headYaw, float headPitch, long currentTime) {
        String currentGazeDirection = "";

        // Determine primary gaze direction based on head pose
        if (Math.abs(headYaw) > Math.abs(headPitch)) {
            // Horizontal movement is dominant
            if (headYaw > HEAD_YAW_THRESHOLD) {
                currentGazeDirection = "look_left"; // Head turned left means looking left
            } else if (headYaw < -HEAD_YAW_THRESHOLD) {
                currentGazeDirection = "look_right"; // Head turned right means looking right
            }
        } else {
            // Vertical movement is dominant
            if (headPitch > HEAD_PITCH_THRESHOLD) {
                currentGazeDirection = "look_down"; // Head tilted down means looking down
            } else if (headPitch < -HEAD_PITCH_THRESHOLD) {
                currentGazeDirection = "look_up"; // Head tilted up means looking up
            }
        }

        // If no significant movement, consider it as "none" (looking at camera)
        if (currentGazeDirection.isEmpty() &&
                Math.abs(headYaw) < HEAD_YAW_THRESHOLD / 2 &&
                Math.abs(headPitch) < HEAD_PITCH_THRESHOLD / 2) {
            currentGazeDirection = "none";
        }

        // Process gaze direction with frame counting
        if (currentGazeDirection.equals(lastGazeDirection) && !currentGazeDirection.isEmpty()) {
            incrementGazeFrameCount(currentGazeDirection);

            int requiredFrames = getRequiredFramesForGaze(currentGazeDirection);
            if (getGazeFrameCount(currentGazeDirection) >= requiredFrames) {
                sendEyeEvent(currentGazeDirection, currentTime);
                resetGazeFrameCounters();
            }
        } else {
            lastGazeDirection = currentGazeDirection;
            resetGazeFrameCounters();
        }
    }

    private void incrementGazeFrameCount(String direction) {
        switch (direction) {
            case "look_left":
                lookLeftFrameCount++;
                break;
            case "look_right":
                lookRightFrameCount++;
                break;
            case "look_up":
                lookUpFrameCount++;
                break;
            case "look_down":
                lookDownFrameCount++;
                break;
            case "none":
                noneFrameCount++;
                break;
        }
    }

    private int getGazeFrameCount(String direction) {
        switch (direction) {
            case "look_left":
                return lookLeftFrameCount;
            case "look_right":
                return lookRightFrameCount;
            case "look_up":
                return lookUpFrameCount;
            case "look_down":
                return lookDownFrameCount;
            case "none":
                return noneFrameCount;
            default:
                return 0;
        }
    }

    private int getRequiredFramesForGaze(String direction) {
        // "none" requires more frames for stability
        return direction.equals("none") ? deviceConfig.consecutiveFrames + 2 : deviceConfig.consecutiveFrames;
    }

    private void resetGazeFrameCounters() {
        lookLeftFrameCount = 0;
        lookRightFrameCount = 0;
        lookUpFrameCount = 0;
        lookDownFrameCount = 0;
        noneFrameCount = 0;
    }

    private void sendEyeEvent(String eventType, long currentTime) {
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
            Log.d(TAG, "Queueing event: " + eventType);
            eventQueue.offer(params);
            if (backgroundHandler != null) {
                backgroundHandler.postDelayed(this::flushEventQueue, 500);
            }
        }
    }

    private void sendEventToJS(WritableMap params, ReactContext context) {
        try {
            EyeModule module = EyeModule.getInstance();
            if (module != null) {
                module.sendEyeEvent(params.getString("event"));
                Log.d(TAG, "Successfully emitted event through EyeModule: " + params.getString("event"));
            } else {
                Log.e(TAG, "EyeModule instance is null");
                eventQueue.offer(params);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to send eye event: " + e.getMessage());
            e.printStackTrace();
            eventQueue.offer(params);
        }
    }

    private static final int MAX_RETRY_ATTEMPTS = 20;
    private int retryAttempts = 0;

    private void flushEventQueue() {
        if (!isServiceRunning) {
            Log.w(TAG, "Service not running, clearing event queue");
            eventQueue.clear();
            return;
        }

        ReactContext context = getReactContext();
        if (context != null && context.hasActiveReactInstance()) {
            retryAttempts = 0;
            mainHandler.post(() -> {
                try {
                    int processedEvents = 0;
                    while (!eventQueue.isEmpty() && processedEvents < 10) {
                        WritableMap event = eventQueue.poll();
                        if (event != null) {
                            sendEventToJS(event, context);
                            processedEvents++;
                        }
                    }

                    if (!eventQueue.isEmpty()) {
                        backgroundHandler.postDelayed(this::flushEventQueue, 100);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error flushing event queue: " + e.getMessage());
                    e.printStackTrace();
                    if (!eventQueue.isEmpty()) {
                        backgroundHandler.postDelayed(this::flushEventQueue, 500);
                    }
                }
            });
        } else {
            retryAttempts++;
            if (retryAttempts < MAX_RETRY_ATTEMPTS) {
                Log.d(TAG, "React context not ready, retry attempt " + retryAttempts + "/" + MAX_RETRY_ATTEMPTS);
                backgroundHandler.postDelayed(this::flushEventQueue, 500);
            } else {
                Log.w(TAG, "Max retry attempts reached, clearing event queue");
                eventQueue.clear();
                retryAttempts = 0;
            }
        }
    }

    private void startBackgroundThread() {
        backgroundThread = new HandlerThread("EyeCameraBackground");
        backgroundThread.start();
        backgroundHandler = new Handler(backgroundThread.getLooper());
        Log.i(TAG, "Background thread started");
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Eye Service",
                    NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Eye tracking service");
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }

    private Notification createNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE);

        return new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("Eye Tracking Active")
                .setContentText("Processing eye movements in background (" + performanceTier + ")")
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
            Log.w(TAG, "Camera disconnected - attempting restart");
            camera.close();
            cameraDevice = null;
            if (isServiceRunning) {
                scheduleCameraRestart();
            }
        }

        @Override
        public void onError(@NonNull CameraDevice camera, int error) {
            Log.e(TAG, "Camera Error: " + error);
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
                    Log.i(TAG, "Attempting camera restart...");
                    stopCamera();
                    startCamera();
                }
            }, 2000);
        }
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

            YuvImage yuvImage = new YuvImage(nv21, ImageFormat.NV21, image.getWidth(), image.getHeight(), null);
            out = new ByteArrayOutputStream();
            yuvImage.compressToJpeg(new Rect(0, 0, yuvImage.getWidth(), yuvImage.getHeight()), 90, out);
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
            Log.e(TAG, "Error converting YUV to Bitmap: " + e.getMessage());
            return null;
        } finally {
            if (out != null) {
                try {
                    out.close();
                } catch (IOException e) {
                    Log.e(TAG, "Error closing stream", e);
                }
            }
        }
    }

    private void createCameraPreviewSession() {
        try {
            Size optimalSize = getOptimalCameraSize();
            imageReader = ImageReader.newInstance(optimalSize.getWidth(), optimalSize.getHeight(),
                    ImageFormat.YUV_420_888, 2);

            imageReader.setOnImageAvailableListener(reader -> {
                if (!isProcessing || !isServiceRunning) {
                    return;
                }

                long currentTime = System.currentTimeMillis();
                if (currentTime - lastProcessTime < deviceConfig.processDelay) {
                    Image image = reader.acquireLatestImage();
                    if (image != null)
                        image.close();
                    return;
                }
                lastProcessTime = currentTime;

                Image image = null;
                try {
                    image = reader.acquireLatestImage();
                    if (image != null && faceDetector != null) {
                        Log.v(TAG, "Processing frame: " + image.getWidth() + "x" + image.getHeight());

                        Bitmap bitmap = convertYuvToBitmap(image);
                        if (bitmap != null) {
                            InputImage inputImage = InputImage.fromBitmap(bitmap, 0);
                            processFaceDetection(inputImage);
                            Log.v(TAG, "Processing image with ML Kit: " + bitmap.getWidth() + "x" + bitmap.getHeight());
                        } else {
                            Log.w(TAG, "Failed to convert image to bitmap");
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error processing image: " + e.getMessage());
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
                            if (cameraDevice == null)
                                return;

                            cameraCaptureSession = session;
                            try {
                                builder.set(CaptureRequest.CONTROL_AF_MODE,
                                        CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO);
                                builder.set(CaptureRequest.CONTROL_AE_MODE,
                                        CaptureRequest.CONTROL_AE_MODE_ON);
                                builder.set(CaptureRequest.CONTROL_AWB_MODE,
                                        CaptureRequest.CONTROL_AWB_MODE_AUTO);

                                CaptureRequest request = builder.build();
                                cameraCaptureSession.setRepeatingRequest(request, null, backgroundHandler);

                                isProcessing = true;
                                Log.i(TAG, "Camera preview started successfully - processing enabled");
                            } catch (CameraAccessException e) {
                                Log.e(TAG, "Failed to start camera preview", e);
                            }
                        }

                        @Override
                        public void onConfigureFailed(@NonNull CameraCaptureSession session) {
                            Log.e(TAG, "Failed to configure camera session");
                        }
                    },
                    backgroundHandler);
        } catch (CameraAccessException e) {
            Log.e(TAG, "Failed to create camera preview session", e);
        }
    }

    private void startCamera() {
        if (!isServiceRunning) {
            Log.w(TAG, "Service not running, skipping camera start");
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

            String selectedCameraId = frontCameraId != null ? frontCameraId : cameraIds[0];
            Log.i(TAG, "Opening camera: " + selectedCameraId + " (Front camera: "
                    + (frontCameraId != null ? "YES" : "NO") + ")");

            manager.openCamera(selectedCameraId, stateCallback, backgroundHandler);
        } catch (CameraAccessException | SecurityException e) {
            Log.e(TAG, "Failed to open camera", e);
        }
    }

    private void stopCamera() {
        isProcessing = false;

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

        Log.i(TAG, "Camera stopped");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "onStartCommand called with flags: " + flags + ", startId: " + startId);

        if (!isServiceRunning) {
            Log.w(TAG, "Service was not running, reinitializing...");
            isServiceRunning = true;

            if (faceDetector == null) {
                initializeMLKit();
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
        Log.i(TAG, "EyeService onDestroy");
        isServiceRunning = false;
        isProcessing = false;

        if (isReceiverRegistered) {
            LocalBroadcastManager.getInstance(this).unregisterReceiver(reactContextReceiver);
        }

        stopCamera();

        if (faceDetector != null) {
            faceDetector.close();
            faceDetector = null;
        }

        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }

        if (backgroundThread != null) {
            backgroundThread.quitSafely();
            backgroundThread = null;
        }

        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}