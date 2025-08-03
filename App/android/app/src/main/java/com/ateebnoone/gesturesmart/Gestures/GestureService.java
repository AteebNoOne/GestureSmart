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
import android.content.pm.ServiceInfo;
import android.graphics.ImageFormat;
import android.graphics.SurfaceTexture;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
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
import android.util.Log;
import android.view.Surface;
import android.os.Handler;
import android.os.HandlerThread;
import androidx.annotation.NonNull;
import android.os.PowerManager;
import android.app.ActivityManager;
import android.os.Process;
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
import java.io.IOException;
import android.os.Build;

import android.Manifest;
import android.content.pm.PackageManager;
import androidx.core.content.ContextCompat;
import android.hardware.camera2.CameraCharacteristics;

public class GestureService extends Service {
    private static final String TAG = "GestureService";
    private static final String CHANNEL_ID = "GestureServiceChannel";
    private static final int NOTIFICATION_ID = 1;

    // Add wake lock to prevent deep sleep
    private PowerManager.WakeLock wakeLock;
    private final Handler recoveryHandler = new Handler();
    private static final int RECOVERY_DELAY_MS = 3000; // Reduced delay
    private boolean isCameraLost = false;
    private int restartCount = 0;
    private static final int MAX_RESTART_ATTEMPTS = 5;

    // Improved gesture detection thresholds for easier detection
    private static final float FINGER_EXTENDED_THRESHOLD = 0.05f;
    private static final float FINGER_CURVED_THRESHOLD = 0.08f;
    private static final float THUMB_EXTENDED_THRESHOLD = 0.05f;
    private static final long GESTURE_COOLDOWN = 1500;
    private static final float SWIPE_THRESHOLD = 0.08f;
    private static final float SWIPE_MIN_DISTANCE = 0.06f;
    private static final float VERTICAL_MOVEMENT_THRESHOLD = 0.05f;
    private static final int GESTURE_STABILITY_FRAMES = 2;

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
    private static final long PROCESS_DELAY = 300;
    private final Handler processHandler = new Handler();
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

    // Service restart mechanism
    private final Handler serviceMonitorHandler = new Handler();
    private static final long SERVICE_MONITOR_INTERVAL = 30000; // 30 seconds
    private final Runnable serviceMonitorRunnable = new Runnable() {
        @Override
        public void run() {
            Log.d(TAG, "Service monitor: Service is alive");
            // Keep the service in high priority
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    startForeground(NOTIFICATION_ID, createNotification("Gesture Detection Active"));
                } catch (Exception e) {
                    Log.e(TAG, "Error updating foreground notification: " + e.getMessage());
                }
            }
            serviceMonitorHandler.postDelayed(this, SERVICE_MONITOR_INTERVAL);
        }
    };

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
                    resetGestureTracking();
                    if (gestureActions != null) {
                        try {
                            gestureActions.updateCursorPosition(0.5f, 0.5f);
                            Log.i(TAG, "Cursor initialized at center position");
                        } catch (Exception e) {
                            Log.e(TAG, "Error showing cursor: " + e.getMessage());
                        }
                    }
                } else {
                    if (gestureActions != null) {
                        try {
                            gestureActions.updateCursorPosition(-1f, -1f);
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
            // Acquire wake lock to prevent deep sleep
            PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,
                    "GestureService::WakeLock");
            if (!wakeLock.isHeld()) {
                wakeLock.acquire();
                Log.i(TAG, "Wake lock acquired");
            }

            createNotificationChannel();
            Log.i(TAG, "Notification channel created");

            // Start foreground with specific service type for Android 14+
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(NOTIFICATION_ID, createNotification("Initializing..."),
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA);
            } else {
                startForeground(NOTIFICATION_ID, createNotification("Initializing..."));
            }
            Log.i(TAG, "Service started in foreground with camera type");

            // Set process priority to prevent killing
            try {
                Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_DISPLAY);
                Log.i(TAG, "Process priority set to urgent display");
            } catch (Exception e) {
                Log.w(TAG, "Could not set process priority: " + e.getMessage());
            }

            IntentFilter filter = new IntentFilter("com.ateebnoone.gesturesmart.CURSOR_MODE");
            registerReceiver(cursorModeReceiver, filter);
            Log.i(TAG, "Cursor mode broadcast receiver registered");

            ReactApplication application = (ReactApplication) getApplication();
            ReactNativeHost reactNativeHost = application.getReactNativeHost();
            ReactContext reactContext = reactNativeHost.getReactInstanceManager().getCurrentReactContext();
            if (reactContext != null) {
                gestureModule = new GestureModule((ReactApplicationContext) reactContext);
                gestureActions = new GestureActions((ReactApplicationContext) reactContext);
                Log.i(TAG, "GestureModule and GestureActions initialized");
            } else {
                Log.e(TAG, "ReactContext is null, could not initialize GestureModule and GestureActions");
            }

            initializeMediaPipe();
            Log.i(TAG, "MediaPipe initialized");

            startBackgroundThread();
            Log.i(TAG, "Background thread started");

            // Start service monitor
            serviceMonitorHandler.post(serviceMonitorRunnable);
            Log.i(TAG, "Service monitor started");

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
                .setMinDetectionConfidence(0.7f)
                .setMinTrackingConfidence(0.7f)
                .build();

        hands = new Hands(this, options);
        hands.setErrorListener((message, e) -> Log.e(TAG, "MediaPipe Hands error: " + message));

        hands.setResultListener(result -> {
            if (result != null && !result.multiHandLandmarks().isEmpty()) {
                detectAndEmitGesture(result);
            } else {
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
            NormalizedLandmark indexTip = landmarks.getLandmarkList().get(8);
            float normalizedX = indexTip.getX();
            float normalizedY = 1.0f - indexTip.getY();

            if (prevPalmPosition != null) {
                float smoothingFactor = 0.7f;
                normalizedX = prevPalmPosition.x * smoothingFactor + normalizedX * (1 - smoothingFactor);
                normalizedY = prevPalmPosition.y * smoothingFactor + normalizedY * (1 - smoothingFactor);
            }

            prevPalmPosition = new PointF(normalizedX, normalizedY);

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
            return;
        }

        try {
            List<NormalizedLandmarkList> multiHandLandmarks = result.multiHandLandmarks();
            handsDetected = !multiHandLandmarks.isEmpty();
            lastHandDetectionTime = System.currentTimeMillis();

            if (multiHandLandmarks.isEmpty()) {
                handLandmarkCount = 0;
                handConfidence = 0.0f;
                resetGestureTracking();

                if (gestureModule != null) {
                    processHandler.post(() -> gestureModule.sendHandDetectionEvent("no_hands", 0, 0.0f));
                }
                return;
            }

            NormalizedLandmarkList landmarks = multiHandLandmarks.get(0);
            handLandmarkCount = landmarks.getLandmarkList().size();
            handConfidence = handLandmarkCount >= 21 ? 0.9f : 0.5f;

            if (gestureModule != null) {
                processHandler.post(
                        () -> gestureModule.sendHandDetectionEvent("hand_detected", handLandmarkCount, handConfidence));
            }

            if (isCursorMode) {
                if (gestureActions != null) {
                    NormalizedLandmark indexTip = landmarks.getLandmarkList().get(8);
                    float normalizedX = indexTip.getX();
                    float normalizedY = 1.0f - indexTip.getY();

                    if (prevPalmPosition != null) {
                        float smoothingFactor = 0.5f;
                        normalizedX = prevPalmPosition.x * smoothingFactor + normalizedX * (1 - smoothingFactor);
                        normalizedY = prevPalmPosition.y * smoothingFactor + normalizedY * (1 - smoothingFactor);
                    }

                    prevPalmPosition = new PointF(normalizedX, normalizedY);
                    gestureActions.updateCursorPosition(normalizedX, normalizedY);
                }

                String cursorModeGesture = detectCursorModeGestures(landmarks);
                if (cursorModeGesture != null && !cursorModeGesture.equals("none")) {
                    if (gestureModule != null) {
                        processHandler.post(() -> gestureModule.sendEvent(cursorModeGesture));
                    }
                }
                return;
            }

            String detectedGesture = classifyGesture(landmarks);

            if (detectedGesture != null && !detectedGesture.equals("none")) {
                if (gestureModule != null) {
                    processHandler.post(() -> gestureModule.sendEvent(detectedGesture));
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
            boolean isIndex = isFingerExtended(points, 5, 8);
            boolean isMiddle = isFingerExtended(points, 9, 12);
            boolean isRing = isFingerExtended(points, 13, 16);
            boolean isPinky = isFingerExtended(points, 17, 20);
            boolean isThumb = isThumbExtended(points);

            int extendedFingers = (isIndex ? 1 : 0) + (isMiddle ? 1 : 0) + (isRing ? 1 : 0) + (isPinky ? 1 : 0)
                    + (isThumb ? 1 : 0);

            if (extendedFingers == 0) {
                return confirmCursorGesture("tap_at_cursor", currentTime);
            }
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
        if (currentTime - lastGestureTime < 800) {
            return "none";
        }

        if (gesture.equals("none")) {
            candidateGesture = "none";
            gestureConfirmationCount = 0;
            return "none";
        }

        if (gesture.equals("tap_at_cursor")) {
            if (gesture.equals(candidateGesture)) {
                gestureConfirmationCount++;
            } else {
                candidateGesture = gesture;
                gestureConfirmationCount = 1;
            }
            if (gestureConfirmationCount >= 2) {
                lastGestureTime = currentTime;
                lastGesture = gesture;
                gestureConfirmationCount = 0;
                candidateGesture = "none";
                return gesture;
            }
            return "none";
        }

        lastGestureTime = currentTime;
        lastGesture = gesture;
        return gesture;
    }

    private String classifyGesture(NormalizedLandmarkList landmarks) {
        if (landmarks.getLandmarkList().size() < 21) {
            return "none";
        }
        try {
            List<NormalizedLandmark> points = landmarks.getLandmarkList();
            long currentTime = System.currentTimeMillis();
            boolean isIndex = isFingerExtended(points, 5, 8);
            boolean isMiddle = isFingerExtended(points, 9, 12);
            boolean isRing = isFingerExtended(points, 13, 16);
            boolean isPinky = isFingerExtended(points, 17, 20);
            boolean isThumb = isThumbExtended(points);
            int extendedFingers = (isIndex ? 1 : 0) + (isMiddle ? 1 : 0) + (isRing ? 1 : 0) + (isPinky ? 1 : 0)
                    + (isThumb ? 1 : 0);

            String staticGesture = detectStaticGestures(isIndex, isMiddle, isRing, isPinky, isThumb, extendedFingers);
            return confirmGesture(staticGesture, currentTime);
        } catch (Exception e) {
            Log.e(TAG, "Error in gesture classification: " + e.getMessage());
            return "none";
        }
    }

    private String detectStaticGestures(boolean isIndex, boolean isMiddle, boolean isRing, boolean isPinky,
            boolean isThumb, int extendedFingers) {
        if (extendedFingers == 0)
            return "scroll_up";
        if (isIndex && !isMiddle && !isRing && !isPinky && !isThumb)
            return "tap";
        if (isThumb && !isIndex && !isMiddle && !isRing && !isPinky)
            return "return";
        if (isIndex && isMiddle && !isRing && !isPinky)
            return "swipe_right";
        if (isIndex && isMiddle && isRing && !isPinky)
            return "swipe_left";
        if (isPinky && !isIndex && !isMiddle && !isRing && !isThumb)
            return "cursor";
        if (extendedFingers >= 4)
            return "scroll_down";
        return "none";
    }

    private String confirmGesture(String gesture, long currentTime) {
        if (currentTime - lastGestureTime < GESTURE_COOLDOWN) {
            return lastGesture;
        }

        if (gesture.equals("none")) {
            candidateGesture = "none";
            gestureConfirmationCount = 0;
            return "none";
        }

        if (gesture.equals(candidateGesture)) {
            gestureConfirmationCount++;
        } else {
            candidateGesture = gesture;
            gestureConfirmationCount = 1;
        }

        if (gesture.startsWith("swipe_") || gesture.startsWith("scroll_") || gesture.equals("cursor")) {
            lastGestureTime = currentTime;
            lastGesture = gesture;
            return gesture;
        }

        if (gestureConfirmationCount >= GESTURE_STABILITY_FRAMES) {
            lastGestureTime = currentTime;
            lastGesture = gesture;
            return gesture;
        }
        return lastGesture;
    }

    private PointF calculatePalmPosition(List<NormalizedLandmark> points) {
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
        return (points.get(mcp).getY() - points.get(tip).getY()) > FINGER_EXTENDED_THRESHOLD;
    }

    private boolean isThumbExtended(List<NormalizedLandmark> points) {
        float thumbTipX = points.get(4).getX();
        float thumbMcpX = points.get(2).getX();
        float wristX = points.get(0).getX();
        float thumbDistance = Math.abs(thumbTipX - wristX);
        float mcpDistance = Math.abs(thumbMcpX - wristX);
        return thumbDistance > mcpDistance + THUMB_EXTENDED_THRESHOLD;
    }

    private Bitmap convertYuvToBitmap(Image image) {
        ByteArrayOutputStream out = null;
        try {
            Image.Plane[] planes = image.getPlanes();
            ByteBuffer yBuffer = planes[0].getBuffer();
            ByteBuffer vuBuffer = planes[2].getBuffer();
            int ySize = yBuffer.remaining();
            int vuSize = vuBuffer.remaining();
            byte[] nv21 = new byte[ySize + vuSize];
            yBuffer.get(nv21, 0, ySize);
            vuBuffer.get(nv21, ySize, vuSize);

            YuvImage yuvImage = new YuvImage(nv21, ImageFormat.NV21, image.getWidth(), image.getHeight(), null);
            out = new ByteArrayOutputStream();
            yuvImage.compressToJpeg(new Rect(0, 0, yuvImage.getWidth(), yuvImage.getHeight()), 50, out);
            byte[] imageBytes = out.toByteArray();
            Bitmap bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.length);

            Matrix matrix = new Matrix();
            matrix.postRotate(270);
            matrix.postScale(-1, 1);
            return Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
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

    private void startBackgroundThread() {
        backgroundThread = new HandlerThread("CameraBackground");
        backgroundThread.setPriority(Thread.MAX_PRIORITY);
        backgroundThread.start();
        backgroundHandler = new Handler(backgroundThread.getLooper());
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Gesture Service Channel", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Gesture detection service");
            channel.setShowBadge(false);
            channel.setSound(null, null);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    private Notification createNotification(String text) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder builder = new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("GestureSmart Service")
                .setContentText(text)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(Notification.PRIORITY_HIGH)
                .setCategory(Notification.CATEGORY_SERVICE);

        return builder.build();
    }

    private final CameraDevice.StateCallback stateCallback = new CameraDevice.StateCallback() {
        @Override
        public void onOpened(@NonNull CameraDevice camera) {
            Log.i(TAG, "Camera opened successfully");
            isCameraLost = false;
            restartCount = 0;
            cameraDevice = camera;
            updateNotification("Gesture Detection Active");
            createCameraPreviewSession();
        }

        @Override
        public void onDisconnected(@NonNull CameraDevice camera) {
            Log.w(TAG, "Camera disconnected. Attempting to recover...");
            camera.close();
            cameraDevice = null;
            handleCameraLoss();
        }

        @Override
        public void onError(@NonNull CameraDevice camera, int error) {
            Log.e(TAG, "Camera Error: " + error + ". Attempting to recover...");
            camera.close();
            cameraDevice = null;

            if (error == CameraDevice.StateCallback.ERROR_CAMERA_DEVICE) {
                Log.e(TAG, "Fatal camera error, restarting service");
                restartService();
                return;
            }

            if (error == CameraDevice.StateCallback.ERROR_CAMERA_DISABLED ||
                    error == CameraDevice.StateCallback.ERROR_CAMERA_IN_USE) {
                Log.e(TAG, "Camera unavailable. Will retry...");
                updateNotification("Camera unavailable - retrying...");
                handleCameraLoss();
                return;
            }

            handleCameraLoss();
        }
    };

    private void restartService() {
        Log.i(TAG, "Restarting service due to fatal error");
        stopSelf();

        // Schedule restart
        recoveryHandler.postDelayed(() -> {
            Intent serviceIntent = new Intent(this, GestureService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
        }, 2000);
    }

    private void updateNotification(String text) {
        try {
            Notification notification = createNotification(text);
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            manager.notify(NOTIFICATION_ID, notification);
        } catch (Exception e) {
            Log.e(TAG, "Error updating notification: " + e.getMessage());
        }
    }

    private void handleCameraLoss() {
        if (isCameraLost || restartCount >= MAX_RESTART_ATTEMPTS) {
            Log.e(TAG, "Max restart attempts reached or already handling camera loss");
            return;
        }

        isCameraLost = true;
        restartCount++;
        stopCamera();
        updateNotification("Camera lost. Retrying... (" + restartCount + "/" + MAX_RESTART_ATTEMPTS + ")");

        long delay = Math.min(RECOVERY_DELAY_MS * restartCount, 15000); // Max 15 seconds
        recoveryHandler.postDelayed(() -> {
            if (restartCount < MAX_RESTART_ATTEMPTS) {
                startCamera();
            } else {
                Log.e(TAG, "Giving up camera recovery after " + MAX_RESTART_ATTEMPTS + " attempts");
                updateNotification("Camera recovery failed - check permissions");
            }
        }, delay);
    }

    private void createCameraPreviewSession() {
        try {
            imageReader = ImageReader.newInstance(640, 480, ImageFormat.YUV_420_888, 2);
            imageReader.setOnImageAvailableListener(reader -> {
                long currentTime = System.currentTimeMillis();
                if (currentTime - lastProcessTime < PROCESS_DELAY || !isProcessing) {
                    try (Image image = reader.acquireLatestImage()) {
                        // just acquire and close to keep the queue flowing
                    } catch (Exception e) {
                        // ignore
                    }
                    return;
                }
                lastProcessTime = currentTime;

                Image image = null;
                try {
                    image = reader.acquireLatestImage();
                    if (image != null && hands != null) {
                        Bitmap bitmap = convertYuvToBitmap(image);
                        if (bitmap != null) {
                            long timestampMicros = System.currentTimeMillis() * 1000L;
                            hands.send(bitmap, timestampMicros);
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
            texture.setDefaultBufferSize(640, 480);
            Surface previewSurface = new Surface(texture);

            final CaptureRequest.Builder builder = cameraDevice.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW);
            builder.addTarget(previewSurface);
            builder.addTarget(imageReader.getSurface());

            cameraDevice.createCaptureSession(
                    Arrays.asList(previewSurface, imageReader.getSurface()),
                    new CameraCaptureSession.StateCallback() {
                        @Override
                        public void onConfigured(@NonNull CameraCaptureSession session) {
                            if (cameraDevice == null)
                                return;
                            cameraCaptureSession = session;
                            try {
                                builder.set(CaptureRequest.CONTROL_AF_MODE,
                                        CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE);
                                cameraCaptureSession.setRepeatingRequest(builder.build(), null, backgroundHandler);
                                Log.i(TAG, "Camera preview started successfully");
                            } catch (CameraAccessException e) {
                                Log.e(TAG, "Failed to start camera preview", e);
                            }
                        }

                        @Override
                        public void onConfigureFailed(@NonNull CameraCaptureSession session) {
                            Log.e(TAG, "Failed to configure camera session");
                        }
                    }, null);
        } catch (CameraAccessException e) {
            Log.e(TAG, "Failed to create camera preview session", e);
        }
    }

    private void startCamera() {
        recoveryHandler.removeCallbacksAndMessages(null);
        isCameraLost = false;

        Log.i(TAG, "Attempting to start camera...");
        updateNotification("Connecting to camera...");

        CameraManager manager = (CameraManager) getSystemService(CAMERA_SERVICE);
        try {
            // Check permissions more thoroughly for Android 14+
            if (ContextCompat.checkSelfPermission(this,
                    Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                Log.e(TAG, "Camera permission not granted");
                updateNotification("Camera permission denied");
                return;
            }

            String frontCameraId = null;
            for (String cameraId : manager.getCameraIdList()) {
                CameraCharacteristics characteristics = manager.getCameraCharacteristics(cameraId);
                Integer facing = characteristics.get(CameraCharacteristics.LENS_FACING);
                if (facing != null && facing == CameraCharacteristics.LENS_FACING_FRONT) {
                    frontCameraId = cameraId;
                    break;
                }
            }

            if (frontCameraId == null) {
                Log.e(TAG, "No front-facing camera found.");
                updateNotification("No front camera found.");
                return;
            }
            manager.openCamera(frontCameraId, stateCallback, backgroundHandler);
        } catch (CameraAccessException | SecurityException e) {
            Log.e(TAG, "Failed to open camera", e);
            handleCameraLoss();
        }
    }

    private void stopCamera() {
        try {
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
        } catch (Exception e) {
            Log.e(TAG, "Error closing camera resources: " + e.getMessage());
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "========= GestureService onStartCommand =========");

        // Ensure we're still in foreground
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                startForeground(NOTIFICATION_ID, createNotification("Starting camera..."),
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA);
            } catch (Exception e) {
                Log.e(TAG, "Error starting foreground with camera type: " + e.getMessage());
                startForeground(NOTIFICATION_ID, createNotification("Starting camera..."));
            }
        } else {
            startForeground(NOTIFICATION_ID, createNotification("Starting camera..."));
        }

        startCamera();
        isProcessing = true;
        Log.i(TAG, "Processing enabled");

        // Return START_STICKY to ensure service restarts if killed
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        Log.i(TAG, "========= GestureService onDestroy =========");

        // Stop all handlers
        recoveryHandler.removeCallbacksAndMessages(null);
        serviceMonitorHandler.removeCallbacksAndMessages(null);
        processHandler.removeCallbacksAndMessages(null);
        cursorUpdateHandler.removeCallbacksAndMessages(null);

        isProcessing = false;
        stopCamera();

        if (cameraDevice != null) {
            cameraDevice.close();
            cameraDevice = null;
        }

        if (gestureActions != null && isCursorMode) {
            try {
                gestureActions.updateCursorPosition(-1, -1);
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

        try {
            unregisterReceiver(cursorModeReceiver);
        } catch (Exception e) {
            Log.e(TAG, "Error unregistering receiver: " + e.getMessage());
        }

        // Release wake lock
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            Log.i(TAG, "Wake lock released");
        }

        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // Override onTaskRemoved to restart service if task is removed
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Log.i(TAG, "Task removed, restarting service");
        Intent restartServiceIntent = new Intent(getApplicationContext(), this.getClass());
        restartServiceIntent.setPackage(getPackageName());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getApplicationContext().startForegroundService(restartServiceIntent);
        } else {
            getApplicationContext().startService(restartServiceIntent);
        }
        super.onTaskRemoved(rootIntent);
    }

    // Handle low memory situations
    @Override
    public void onLowMemory() {
        Log.w(TAG, "Low memory warning received");
        super.onLowMemory();
    }

    @Override
    public void onTrimMemory(int level) {
        Log.w(TAG, "Memory trim requested, level: " + level);
        if (level >= TRIM_MEMORY_RUNNING_CRITICAL) {
            Log.w(TAG, "Critical memory situation, reducing processing");
            // Could reduce processing frequency here if needed
        }
        super.onTrimMemory(level);
    }
}