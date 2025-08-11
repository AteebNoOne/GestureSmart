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
import android.hardware.camera2.CameraDevice;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CaptureRequest;

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

// MediaPipe imports
import com.google.mediapipe.framework.image.BitmapImageBuilder;
import com.google.mediapipe.framework.image.MPImage;
import com.google.mediapipe.tasks.core.BaseOptions;
import com.google.mediapipe.tasks.vision.core.RunningMode;
import com.google.mediapipe.tasks.vision.gesturerecognizer.GestureRecognizer;
import com.google.mediapipe.tasks.vision.gesturerecognizer.GestureRecognizer.GestureRecognizerOptions;
import com.google.mediapipe.tasks.vision.gesturerecognizer.GestureRecognizerResult;

// MediaPipe Hand Landmarker
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker;
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker.HandLandmarkerOptions;
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarkerResult;
import com.google.mediapipe.tasks.core.BaseOptions;
import com.google.mediapipe.tasks.components.containers.Category;
import com.google.mediapipe.tasks.components.containers.NormalizedLandmark;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import java.nio.ByteBuffer;

import java.util.Arrays;
import java.util.List;
import java.util.ArrayList;

public class GestureService extends Service {
    private static final String TAG = "GestureService";
    private static final String CHANNEL_ID = "GestureServiceChannel";
    private static final int NOTIFICATION_ID = 2;

    // Gesture tracking thresholds
    private static final float GESTURE_CONFIDENCE_THRESHOLD = 0.7f;
    private static final float LANDMARK_CONFIDENCE_THRESHOLD = 0.6f;
    private static final long EVENT_COOLDOWN = 400;
    private static final float FINGER_BEND_THRESHOLD = 0.03f;

    private CameraDevice cameraDevice;
    private CameraCaptureSession cameraCaptureSession;
    private ImageReader imageReader;
    private Handler backgroundHandler;
    private HandlerThread backgroundThread;
    private GestureRecognizer gestureRecognizer;
    private HandLandmarker handLandmarker;
    private boolean isProcessing = false;
    private ReactApplicationContext reactContext;
    private static final long PROCESS_DELAY = 120; // Optimized delay
    private long lastEventTime = 0;
    private PowerManager.WakeLock wakeLock;
    private long lastProcessTime = 0;
    private boolean isServiceRunning = false;

    // Track last detected gesture to avoid duplicates
    private String lastDetectedGesture = "";
    private long lastGestureTime = 0;

    private ConcurrentLinkedQueue<WritableMap> eventQueue = new ConcurrentLinkedQueue<>();
    private Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean isReceiverRegistered = false;

    // Enhanced gesture list - combining MediaPipe predefined + custom
    // landmark-based
    private static final String[] MEDIAPIPE_GESTURES = {
            "Open_Palm", "Closed_Fist", "Thumb_Up", "Thumb_Down", "Pointing_Up",
            "Victory", "ILoveYou", "Call_Me", "Rock", "OK"
    };

    // Custom gestures we'll detect from landmarks
    private static final String[] CUSTOM_GESTURES = {
            "One_Finger", "Two_Fingers", "Three_Fingers", "Four_Fingers",
            "Pinky_Up", "Index_Pinky", "Middle_Finger", "Index_Middle",
            "Gun_Gesture", "Shaka", "Finger_Heart", "L_Shape"
    };

    // Hand landmark indices (MediaPipe hand landmarks)
    private static final int THUMB_TIP = 4;
    private static final int THUMB_IP = 3;
    private static final int THUMB_MCP = 2;
    private static final int INDEX_TIP = 8;
    private static final int INDEX_PIP = 6;
    private static final int INDEX_MCP = 5;
    private static final int MIDDLE_TIP = 12;
    private static final int MIDDLE_PIP = 10;
    private static final int MIDDLE_MCP = 9;
    private static final int RING_TIP = 16;
    private static final int RING_PIP = 14;
    private static final int RING_MCP = 13;
    private static final int PINKY_TIP = 20;
    private static final int PINKY_PIP = 18;
    private static final int PINKY_MCP = 17;
    private static final int WRIST = 0;

    private ReactContext getReactContext() {
        if (reactContext != null && reactContext.hasActiveReactInstance()) {
            return reactContext;
        }

        try {
            GestureModule module = GestureModule.getInstance();
            if (module != null) {
                ReactContext context = module.getContext();
                if (context != null && context.hasActiveReactInstance()) {
                    reactContext = (ReactApplicationContext) context;
                    Log.i(TAG, "React context obtained successfully from GestureModule");
                    return reactContext;
                } else {
                    Log.w(TAG, "React context from GestureModule is null or inactive");
                }
            } else {
                Log.w(TAG, "GestureModule instance not available");
            }
            return null;
        } catch (Exception e) {
            Log.e(TAG, "Failed to get React context: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "GestureService onCreate");

        createNotificationChannel();
        startForeground(NOTIFICATION_ID, createNotification());
        registerBroadcastReceiver();
        getReactContext();

        initializeGestureComponents();
        startBackgroundThread();

        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "GestureService::WakeLock");
        wakeLock.acquire();

        isServiceRunning = true;
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

    private void initializeGestureComponents() {
        try {
            // Initialize MediaPipe Gesture Recognizer for predefined gestures
            BaseOptions gestureBaseOptions = BaseOptions.builder()
                    .setModelAssetPath("gesture_recognizer.task")
                    .build();

            GestureRecognizerOptions gestureOptions = GestureRecognizerOptions.builder()
                    .setBaseOptions(gestureBaseOptions)
                    .setRunningMode(RunningMode.LIVE_STREAM)
                    .setResultListener(this::processGestureResult)
                    .setErrorListener((RuntimeException e) -> {
                        Log.e(TAG, "MediaPipe Gesture Recognizer error: " + e.getMessage());
                    })
                    .setMinHandDetectionConfidence(0.6f)
                    .setMinHandPresenceConfidence(0.6f)
                    .setMinTrackingConfidence(0.6f)
                    .setNumHands(1)
                    .build();

            gestureRecognizer = GestureRecognizer.createFromOptions(this, gestureOptions);
            Log.i(TAG, "MediaPipe Gesture Recognizer initialized");

            // Initialize MediaPipe Hand Landmarker for custom gesture detection
            BaseOptions handBaseOptions = BaseOptions.builder()
                    .setModelAssetPath("hand_landmarker.task")
                    .build();

            HandLandmarkerOptions handOptions = HandLandmarkerOptions.builder()
                    .setBaseOptions(handBaseOptions)
                    .setRunningMode(RunningMode.LIVE_STREAM)
                    .setResultListener((HandLandmarkerResult result, MPImage image) -> {
                        processHandLandmarks(result, image);
                    })
                    .setErrorListener((RuntimeException e) -> {
                        Log.e(TAG, "MediaPipe Hand Landmarker error: " + e.getMessage());
                    })
                    .setNumHands(1)
                    .setMinHandDetectionConfidence(0.6f)
                    .setMinHandPresenceConfidence(0.6f)
                    .setMinTrackingConfidence(0.6f)
                    .build();

            handLandmarker = HandLandmarker.createFromOptions(this, handOptions);
            Log.i(TAG, "MediaPipe Hand Landmarker initialized");

        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize MediaPipe components: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void processGestureResult(GestureRecognizerResult result, MPImage image) {
        try {
            if (result.gestures().isEmpty())
                return;

            long currentTime = System.currentTimeMillis();
            if (currentTime - lastEventTime < EVENT_COOLDOWN)
                return;

            var gestureCategory = result.gestures().get(0).get(0);
            String gestureName = gestureCategory.categoryName();
            float confidence = gestureCategory.score();

            if (confidence >= GESTURE_CONFIDENCE_THRESHOLD &&
                    Arrays.asList(MEDIAPIPE_GESTURES).contains(gestureName)) {

                if (!gestureName.equals(lastDetectedGesture) ||
                        currentTime - lastGestureTime > EVENT_COOLDOWN * 2) {

                    sendGestureEvent(gestureName, confidence);
                    lastDetectedGesture = gestureName;
                    lastGestureTime = currentTime;
                    lastEventTime = currentTime;

                    Log.i(TAG, String.format("MediaPipe gesture: %s (%.3f)", gestureName, confidence));
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error processing gesture result: " + e.getMessage());
        }
    }

    private void processHandLandmarks(HandLandmarkerResult result, MPImage image) {
        try {
            if (result.landmarks().isEmpty())
                return;

            long currentTime = System.currentTimeMillis();
            if (currentTime - lastEventTime < EVENT_COOLDOWN)
                return;

            List<NormalizedLandmark> landmarks = result.landmarks().get(0);
            String customGesture = detectCustomGesture(landmarks);

            if (customGesture != null) {
                if (!customGesture.equals(lastDetectedGesture) ||
                        currentTime - lastGestureTime > EVENT_COOLDOWN * 2) {

                    sendGestureEvent(customGesture, 0.85f); // High confidence for custom gestures
                    lastDetectedGesture = customGesture;
                    lastGestureTime = currentTime;
                    lastEventTime = currentTime;

                    Log.i(TAG, String.format("Custom gesture: %s", customGesture));
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error processing hand landmarks: " + e.getMessage());
        }
    }

    private String detectCustomGesture(List<NormalizedLandmark> landmarks) {
        if (landmarks.size() < 21)
            return null;

        // Get finger states (extended or bent)
        boolean[] fingersUp = getFingerStates(landmarks);
        int extendedCount = 0;
        for (boolean up : fingersUp) {
            if (up)
                extendedCount++;
        }

        // Detect specific patterns
        // Counting gestures (1-4 fingers)
        if (fingersUp[1] && !fingersUp[0] && !fingersUp[2] && !fingersUp[3] && !fingersUp[4]) {
            return "One_Finger"; // Index only
        }
        if (fingersUp[1] && fingersUp[2] && !fingersUp[0] && !fingersUp[3] && !fingersUp[4]) {
            return "Two_Fingers"; // Index + Middle
        }
        if (fingersUp[1] && fingersUp[2] && fingersUp[3] && !fingersUp[0] && !fingersUp[4]) {
            return "Three_Fingers"; // Index + Middle + Ring
        }
        if (fingersUp[1] && fingersUp[2] && fingersUp[3] && fingersUp[4] && !fingersUp[0]) {
            return "Four_Fingers"; // All except thumb
        }

        // Special gestures
        if (fingersUp[4] && !fingersUp[0] && !fingersUp[1] && !fingersUp[2] && !fingersUp[3]) {
            return "Pinky_Up"; // Only pinky
        }
        if (fingersUp[1] && fingersUp[4] && !fingersUp[0] && !fingersUp[2] && !fingersUp[3]) {
            return "Index_Pinky"; // Index + Pinky (rock gesture variation)
        }
        if (!fingersUp[0] && !fingersUp[1] && fingersUp[2] && !fingersUp[3] && !fingersUp[4]) {
            return "Middle_Finger"; // Only middle finger
        }
        if (fingersUp[1] && fingersUp[2] && !fingersUp[0] && !fingersUp[3] && !fingersUp[4]) {
            return "Index_Middle"; // Peace sign variation
        }

        // Gun gesture (thumb up, index extended, others bent)
        if (fingersUp[0] && fingersUp[1] && !fingersUp[2] && !fingersUp[3] && !fingersUp[4]) {
            return "Gun_Gesture";
        }

        // Shaka (thumb + pinky)
        if (fingersUp[0] && fingersUp[4] && !fingersUp[1] && !fingersUp[2] && !fingersUp[3]) {
            return "Shaka";
        }

        // L-Shape (thumb + index at 90 degrees)
        if (fingersUp[0] && fingersUp[1] && !fingersUp[2] && !fingersUp[3] && !fingersUp[4]) {
            if (isLShapeGesture(landmarks)) {
                return "L_Shape";
            }
        }

        // Finger heart (thumb + index tips touching)
        if (fingersUp[0] && fingersUp[1] && isFingerHeart(landmarks)) {
            return "Finger_Heart";
        }

        return null; // No custom gesture detected
    }

    private boolean[] getFingerStates(List<NormalizedLandmark> landmarks) {
        boolean[] fingersUp = new boolean[5];

        // Thumb (different logic due to orientation)
        fingersUp[0] = landmarks.get(THUMB_TIP).x() > landmarks.get(THUMB_IP).x();

        // Other fingers (tip above PIP joint)
        fingersUp[1] = landmarks.get(INDEX_TIP).y() < landmarks.get(INDEX_PIP).y();
        fingersUp[2] = landmarks.get(MIDDLE_TIP).y() < landmarks.get(MIDDLE_PIP).y();
        fingersUp[3] = landmarks.get(RING_TIP).y() < landmarks.get(RING_PIP).y();
        fingersUp[4] = landmarks.get(PINKY_TIP).y() < landmarks.get(PINKY_PIP).y();

        return fingersUp;
    }

    private boolean isLShapeGesture(List<NormalizedLandmark> landmarks) {
        // Check if thumb and index form roughly 90-degree angle
        NormalizedLandmark thumbTip = landmarks.get(THUMB_TIP);
        NormalizedLandmark indexTip = landmarks.get(INDEX_TIP);
        NormalizedLandmark wrist = landmarks.get(WRIST);

        // Simple angle approximation
        double thumbAngle = Math.atan2(thumbTip.y() - wrist.y(), thumbTip.x() - wrist.x());
        double indexAngle = Math.atan2(indexTip.y() - wrist.y(), indexTip.x() - wrist.x());
        double angleDiff = Math.abs(thumbAngle - indexAngle);

        return angleDiff > Math.PI / 3 && angleDiff < 2 * Math.PI / 3; // Roughly 60-120 degrees
    }

    private boolean isFingerHeart(List<NormalizedLandmark> landmarks) {
        NormalizedLandmark thumbTip = landmarks.get(THUMB_TIP);
        NormalizedLandmark indexTip = landmarks.get(INDEX_TIP);

        // Check if thumb and index tips are close together
        double distance = Math.sqrt(
                Math.pow(thumbTip.x() - indexTip.x(), 2) +
                        Math.pow(thumbTip.y() - indexTip.y(), 2));

        return distance < 0.05; // Tips are close together
    }

    private void sendGestureEvent(String gestureName, float confidence) {
        WritableMap params = Arguments.createMap();
        params.putString("gesture", gestureName);
        params.putDouble("confidence", confidence);
        params.putLong("timestamp", System.currentTimeMillis());

        ReactContext context = getReactContext();
        if (context != null && context.hasActiveReactInstance()) {
            sendEventToJS(params, context);
        } else {
            Log.d(TAG, "Queueing gesture event: " + gestureName);
            eventQueue.offer(params);
            if (backgroundHandler != null) {
                backgroundHandler.postDelayed(this::flushEventQueue, 500);
            }
        }
    }

    private void sendEventToJS(WritableMap params, ReactContext context) {
        try {
            GestureModule module = GestureModule.getInstance();
            if (module != null) {
                module.sendGestureEvent(params.getString("gesture"));
                Log.d(TAG, "Successfully emitted gesture event: " + params.getString("gesture"));
            } else {
                Log.e(TAG, "GestureModule instance is null");
                eventQueue.offer(params);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to send gesture event: " + e.getMessage());
            eventQueue.offer(params);
        }
    }

    private static final int MAX_RETRY_ATTEMPTS = 20;
    private int retryAttempts = 0;

    private void flushEventQueue() {
        if (!isServiceRunning) {
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
                    if (!eventQueue.isEmpty()) {
                        backgroundHandler.postDelayed(this::flushEventQueue, 500);
                    }
                }
            });
        } else {
            retryAttempts++;
            if (retryAttempts < MAX_RETRY_ATTEMPTS) {
                backgroundHandler.postDelayed(this::flushEventQueue, 500);
            } else {
                eventQueue.clear();
                retryAttempts = 0;
            }
        }
    }

    private void startBackgroundThread() {
        backgroundThread = new HandlerThread("GestureCameraBackground");
        backgroundThread.start();
        backgroundHandler = new Handler(backgroundThread.getLooper());
        Log.i(TAG, "Background thread started");
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Enhanced Gesture Service",
                    NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Enhanced gesture tracking with 20+ gestures");
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }

    private Notification createNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE);

        return new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("Enhanced Gesture Recognition")
                .setContentText("Detecting 20+ hand gestures")
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
            yuvImage.compressToJpeg(new Rect(0, 0, yuvImage.getWidth(), yuvImage.getHeight()), 80, out);
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
            imageReader = ImageReader.newInstance(320, 240, ImageFormat.YUV_420_888, 2);

            imageReader.setOnImageAvailableListener(reader -> {
                if (!isProcessing || !isServiceRunning)
                    return;

                long currentTime = System.currentTimeMillis();
                if (currentTime - lastProcessTime < PROCESS_DELAY)
                    return;
                lastProcessTime = currentTime;

                Image image = null;
                try {
                    image = reader.acquireLatestImage();
                    if (image != null) {
                        Bitmap bitmap = convertYuvToBitmap(image);
                        if (bitmap != null) {
                            MPImage mpImage = new BitmapImageBuilder(bitmap).build();
                            long timestampMicros = System.currentTimeMillis() * 1000L;

                            // Send to both recognizers
                            if (gestureRecognizer != null) {
                                gestureRecognizer.recognizeAsync(mpImage, timestampMicros);
                            }
                            if (handLandmarker != null) {
                                handLandmarker.detectAsync(mpImage, timestampMicros);
                            }
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
            texture.setDefaultBufferSize(320, 240);
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
                                        CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE);
                                builder.set(CaptureRequest.CONTROL_AE_MODE,
                                        CaptureRequest.CONTROL_AE_MODE_ON);

                                CaptureRequest request = builder.build();
                                cameraCaptureSession.setRepeatingRequest(request, null, backgroundHandler);

                                isProcessing = true;
                                Log.i(TAG, "Enhanced gesture processing enabled - 20+ gestures available");
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
        if (!isServiceRunning)
            return;

        CameraManager manager = (CameraManager) getSystemService(CAMERA_SERVICE);
        try {
            String[] cameraIds = manager.getCameraIdList();
            String frontCameraId = null;

            for (String cameraId : cameraIds) {
                android.hardware.camera2.CameraCharacteristics characteristics = manager
                        .getCameraCharacteristics(cameraId);
                Integer facing = characteristics.get(android.hardware.camera2.CameraCharacteristics.LENS_FACING);
                if (facing != null && facing == android.hardware.camera2.CameraCharacteristics.LENS_FACING_FRONT) {
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
        Log.i(TAG, "onStartCommand called");
        startCamera();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        Log.i(TAG, "Enhanced GestureService onDestroy");
        isServiceRunning = false;
        isProcessing = false;

        if (isReceiverRegistered) {
            LocalBroadcastManager.getInstance(this).unregisterReceiver(reactContextReceiver);
        }

        stopCamera();

        if (gestureRecognizer != null) {
            gestureRecognizer.close();
            gestureRecognizer = null;
        }

        if (handLandmarker != null) {
            handLandmarker.close();
            handLandmarker = null;
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