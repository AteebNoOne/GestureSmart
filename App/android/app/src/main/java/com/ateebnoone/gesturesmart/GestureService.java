package com.ateebnoone.gesturesmart;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
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

    // Gesture detection thresholds (matching TypeScript logic)
    private static final float FINGER_CURVED_THRESHOLD = 0.15f;
    private static final float FINGER_EXTENDED_THRESHOLD = -0.15f;
    private static final float THUMB_EXTENDED_THRESHOLD = -0.15f;
    private static final long GESTURE_COOLDOWN = 300; // ms
    private static final float SWIPE_THRESHOLD = 30.0f;
    private static final float SCROLL_DISTANCE = 0.15f;

    private CameraDevice cameraDevice;
    private CameraCaptureSession cameraCaptureSession;
    private ImageReader imageReader;
    private Handler backgroundHandler;
    private HandlerThread backgroundThread;
    private Hands hands;
    private boolean isProcessing = false;
    private GestureModule gestureModule;
    private static final long PROCESS_DELAY = 200;
    private final Handler processHandler = new Handler(Looper.getMainLooper());
    private long lastProcessTime = 0;

    // Gesture tracking variables
    private PointF prevPalmPosition = null;
    private long lastGestureTime = 0;
    private PointF lastHandDirection = new PointF(0, 0);
    private String lastGesture = "none";
    private PointF swipeStartPosition = null;

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

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "========= GestureService onCreate started =========");
        try {
            createNotificationChannel();
            Log.i(TAG, "Notification channel created");

            startForeground(NOTIFICATION_ID, createNotification());
            Log.i(TAG, "Service started in foreground");

            // Get GestureModule instance
            ReactApplication application = (ReactApplication) getApplication();
            ReactNativeHost reactNativeHost = application.getReactNativeHost();
            ReactContext reactContext = reactNativeHost.getReactInstanceManager().getCurrentReactContext();
            if (reactContext != null) {
                gestureModule = new GestureModule((ReactApplicationContext) reactContext);
                Log.i(TAG, "GestureModule initialized");
            } else {
                Log.e(TAG, "ReactContext is null, could not initialize GestureModule");
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
                .setMinDetectionConfidence(0.8f) // Increased to match TypeScript
                .setMinTrackingConfidence(0.8f)
                .build();

        hands = new Hands(this, options);
        hands.setErrorListener((message, e) -> Log.e(TAG, "MediaPipe Hands error: " + message));

        hands.setResultListener(result -> {
            if (result != null && !result.multiHandLandmarks().isEmpty()) {
                detectAndEmitGesture(result);
            } else {
                // Reset tracking when no hands detected
                prevPalmPosition = null;
                swipeStartPosition = null;
                Log.v(TAG, "No hands detected in current frame");
            }
        });
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

                // Reset tracking
                prevPalmPosition = null;
                swipeStartPosition = null;

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

    private String classifyGesture(NormalizedLandmarkList landmarks) {
        if (landmarks.getLandmarkList().size() < 21) {
            Log.w(TAG, "Insufficient landmarks for gesture classification: " + landmarks.getLandmarkList().size());
            return "none";
        }

        try {
            List<NormalizedLandmark> points = landmarks.getLandmarkList();
            long currentTime = System.currentTimeMillis();

            // Calculate palm position (wrist + finger bases average)
            PointF palmPosition = calculatePalmPosition(points);

            // Get finger states
            boolean isIndex = isFingerExtended(points, 5, 6, 8);
            boolean isMiddle = isFingerExtended(points, 9, 10, 12);
            boolean isRing = isFingerExtended(points, 13, 14, 16);
            boolean isPinky = isFingerExtended(points, 17, 18, 20);
            boolean isThumb = isThumbExtended(points);

            // Check for open hand (all fingers extended)
            boolean isOpenHand = isIndex && isMiddle && isRing && isPinky;

            // Handle swipe detection
            String swipeGesture = detectSwipe(palmPosition, isOpenHand);

            // Special case for continuing a swipe gesture
            if ((lastGesture.equals("swipe_left") || lastGesture.equals("swipe_right")) &&
                    !swipeGesture.equals("none") &&
                    currentTime - lastGestureTime < GESTURE_COOLDOWN * 2) {
                lastGesture = swipeGesture;
                lastGestureTime = currentTime;
                return swipeGesture;
            }

            // Cooldown check
            if (currentTime - lastGestureTime < GESTURE_COOLDOWN) {
                return lastGesture;
            }

            // Detect scroll gestures
            boolean isScrollingDown = isOpenHand && areAllFingersDown(points);
            boolean isScrollingUp = !isIndex && !isMiddle && !isRing && !isPinky && !isThumb;

            // Gesture detection in priority order (matching TypeScript)
            String detectedGesture = "none";

            if (!swipeGesture.equals("none")) {
                detectedGesture = swipeGesture;
            } else if (isScrollingDown) {
                detectedGesture = "scroll_down";
            } else if (isScrollingUp) {
                detectedGesture = "scroll_up";
            } else if (isThumb && !isIndex && !isMiddle && !isRing && !isPinky) {
                detectedGesture = "return";
            } else if (isIndex && !isMiddle && !isRing && !isPinky && !isThumb) {
                detectedGesture = "tap";
            } else if (isIndex && isMiddle && !isRing && !isPinky) {
                detectedGesture = "follow_cursor";
            } else if (isIndex && isMiddle && isRing && !isPinky) {
                detectedGesture = "close_cursor";
            } else if (isIndex && points.get(4).getY() < points.get(8).getY()) {
                detectedGesture = "volume_up";
            } else if (isIndex && points.get(4).getY() > points.get(8).getY()) {
                detectedGesture = "volume_down";
            }

            if (!detectedGesture.equals("none")) {
                lastGestureTime = currentTime;
                lastGesture = detectedGesture;
                Log.i(TAG, "🎯 GESTURE DETECTED: " + detectedGesture);
                return detectedGesture;
            }

            lastGesture = "none";
            return "none";

        } catch (Exception e) {
            Log.e(TAG, "Error in gesture classification: " + e.getMessage());
            return "none";
        }
    }

    private PointF calculatePalmPosition(List<NormalizedLandmark> points) {
        // Use wrist and base of fingers to calculate palm center
        NormalizedLandmark wrist = points.get(0);
        NormalizedLandmark indexBase = points.get(5);
        NormalizedLandmark pinkyBase = points.get(17);

        float x = (wrist.getX() + indexBase.getX() + pinkyBase.getX()) / 3;
        float y = (wrist.getY() + indexBase.getY() + pinkyBase.getY()) / 3;

        return new PointF(x, y);
    }

    private boolean isFingerExtended(List<NormalizedLandmark> points, int mcp, int pip, int tip) {
        // Check if finger tip is significantly above the base (extended)
        float tipY = points.get(tip).getY();
        float baseY = points.get(mcp).getY();
        return (tipY - baseY) < FINGER_EXTENDED_THRESHOLD;
    }

    private boolean isThumbExtended(List<NormalizedLandmark> points) {
        // Check thumb extension based on distance from palm
        float thumbTipY = points.get(4).getY();
        float thumbBaseY = points.get(2).getY();
        return (thumbTipY - thumbBaseY) < THUMB_EXTENDED_THRESHOLD;
    }

    private boolean areAllFingersDown(List<NormalizedLandmark> points) {
        // Check if all finger tips are below their bases (pointing down)
        return points.get(8).getY() > points.get(5).getY() && // Index
                points.get(12).getY() > points.get(9).getY() && // Middle
                points.get(16).getY() > points.get(13).getY() && // Ring
                points.get(20).getY() > points.get(17).getY(); // Pinky
    }

    private String detectSwipe(PointF palmPosition, boolean isOpenHand) {
        String swipeGesture = "none";

        if (prevPalmPosition != null && isOpenHand) {
            float deltaX = palmPosition.x - prevPalmPosition.x;
            float deltaY = palmPosition.y - prevPalmPosition.y;

            // Store hand movement direction
            lastHandDirection.x = deltaX;
            lastHandDirection.y = deltaY;

            // Initialize swipe start position if significant horizontal movement
            if (swipeStartPosition == null && Math.abs(deltaX) > 0.005f) {
                swipeStartPosition = new PointF(prevPalmPosition.x, prevPalmPosition.y);
            }

            // Check for swipe completion
            if (swipeStartPosition != null) {
                float totalDeltaX = palmPosition.x - swipeStartPosition.x;
                float totalDeltaY = Math.abs(palmPosition.y - swipeStartPosition.y);

                // Convert to screen coordinates approximation for threshold comparison
                float screenDeltaX = Math.abs(totalDeltaX * 1000); // Rough conversion

                // Check if movement is primarily horizontal and exceeds threshold
                if (screenDeltaX > SWIPE_THRESHOLD &&
                        Math.abs(totalDeltaX) > totalDeltaY * 1.5) {
                    swipeGesture = totalDeltaX < 0 ? "swipe_left" : "swipe_right";
                    swipeStartPosition = null; // Reset after detection
                }
            }
        } else if (!isOpenHand) {
            // Reset swipe tracking if hand is not open
            swipeStartPosition = null;
        }

        // Update previous position
        prevPalmPosition = new PointF(palmPosition.x, palmPosition.y);

        return swipeGesture;
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
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}