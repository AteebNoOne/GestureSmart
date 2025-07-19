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

    private CameraDevice cameraDevice;
    private CameraCaptureSession cameraCaptureSession;
    private ImageReader imageReader;
    private Handler backgroundHandler;
    private HandlerThread backgroundThread;
    private Hands hands;
    private boolean isProcessing = false;
    private GestureModule gestureModule;
    private static final long PROCESS_DELAY = 200; // Increased delay to reduce processing load
    private final Handler processHandler = new Handler(Looper.getMainLooper());
    private long lastProcessTime = 0;

    private boolean handsDetected = false;
    private int handLandmarkCount = 0;
    private long lastHandDetectionTime = 0;
    private float handConfidence = 0.0f;

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
                .setMinDetectionConfidence(0.5f)
                .setMinTrackingConfidence(0.5f)
                .build();

        hands = new Hands(this, options);
        hands.setErrorListener((message, e) -> Log.e(TAG, "MediaPipe Hands error: " + message));

        // Set result listener for hand detection
        hands.setResultListener(result -> {
            if (result != null && !result.multiHandLandmarks().isEmpty()) {
                detectAndEmitGesture(result);
            } else {
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

                // Send hand detection status to React Native
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

            // Calculate confidence (you can get this from MediaPipe if available)
            // For now, we'll use a simple heuristic based on landmark count
            handConfidence = handLandmarkCount >= 21 ? 0.9f : 0.5f;

            Log.d(TAG, String.format("Hand detected - Landmarks: %d, Confidence: %.2f",
                    handLandmarkCount, handConfidence));

            // Send hand detection status to React Native
            if (gestureModule != null) {
                processHandler.post(() -> {
                    gestureModule.sendHandDetectionEvent("hand_detected", handLandmarkCount, handConfidence);
                });
            }

            String detectedGesture = classifyGesture(landmarks);

            if (detectedGesture != null) {
                Log.i(TAG, "Detected gesture: " + detectedGesture);
                // Emit gesture through GestureModule
                if (gestureModule != null) {
                    processHandler.post(() -> {
                        Log.i(TAG, "Emitting gesture event: " + detectedGesture);
                        gestureModule.sendEvent(detectedGesture);
                    });
                } else {
                    Log.e(TAG, "GestureModule is null, cannot emit event");
                }
            } else {
                Log.v(TAG, "No recognizable gesture detected");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error detecting gesture: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public String getHandDetectionInfo() {
        long timeSinceLastDetection = System.currentTimeMillis() - lastHandDetectionTime;
        return String.format("Hands: %s, Landmarks: %d, Confidence: %.2f, Last seen: %dms ago",
                handsDetected ? "YES" : "NO", handLandmarkCount, handConfidence, timeSinceLastDetection);
    }

    private String classifyGesture(NormalizedLandmarkList landmarks) {
        if (landmarks.getLandmarkList().size() < 21) {
            Log.w(TAG, "Insufficient landmarks for gesture classification: " + landmarks.getLandmarkList().size());
            return null;
        }

        try {
            // Get key points for gesture recognition
            NormalizedLandmark thumb = landmarks.getLandmark(4);
            NormalizedLandmark index = landmarks.getLandmark(8);
            NormalizedLandmark middle = landmarks.getLandmark(12);
            NormalizedLandmark ring = landmarks.getLandmark(16);
            NormalizedLandmark pinky = landmarks.getLandmark(20);
            NormalizedLandmark wrist = landmarks.getLandmark(0);

            // Calculate vertical positions relative to wrist
            float thumbHeight = thumb.getY() - wrist.getY();
            float indexHeight = index.getY() - wrist.getY();
            float middleHeight = middle.getY() - wrist.getY();
            float ringHeight = ring.getY() - wrist.getY();
            float pinkyHeight = pinky.getY() - wrist.getY();

            Log.d(TAG,
                    String.format(
                            "✋ HAND DETECTED - Finger positions - Index: %.3f, Middle: %.3f, Thumb: %.3f, Ring: %.3f, Pinky: %.3f",
                            indexHeight, middleHeight, thumbHeight, ringHeight, pinkyHeight));

            // Detect volume up gesture (index finger up, others down)
            if (indexHeight < -0.15f && thumbHeight > 0 && middleHeight > 0 && ringHeight > 0 && pinkyHeight > 0) {
                Log.i(TAG, "🔊 GESTURE DETECTED: Volume Up");
                return "volume_up";
            }

            // Detect volume down gesture (index and middle fingers up, others down)
            if (indexHeight < -0.15f && middleHeight < -0.15f && thumbHeight > 0 && ringHeight > 0 && pinkyHeight > 0) {
                Log.i(TAG, "🔉 GESTURE DETECTED: Volume Down");
                return "volume_down";
            }

            // Detect tap gesture (closed fist)
            if (indexHeight > 0 && middleHeight > 0 && ringHeight > 0 && pinkyHeight > 0 && thumbHeight > -0.1f) {
                Log.i(TAG, "👊 GESTURE DETECTED: Tap (Closed Fist)");
                return "tap";
            }

            // Detect peace/victory sign (index and middle up, others down)
            if (indexHeight < -0.15f && middleHeight < -0.15f && thumbHeight > -0.05f && ringHeight > 0
                    && pinkyHeight > 0) {
                Log.i(TAG, "✌️ GESTURE DETECTED: Peace/Victory");
                return "peace";
            }

            // Detect thumbs up
            if (thumbHeight < -0.15f && indexHeight > 0 && middleHeight > 0 && ringHeight > 0 && pinkyHeight > 0) {
                Log.i(TAG, "👍 GESTURE DETECTED: Thumbs Up");
                return "thumbs_up";
            }

            Log.d(TAG, "❌ No matching gesture pattern found");
            return null;

        } catch (Exception e) {
            Log.e(TAG, "Error in gesture classification: " + e.getMessage());
            return null;
        }
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
                            // CRITICAL FIX: MediaPipe requires timestamp when not in static image mode
                            long timestampMicros = System.currentTimeMillis() * 1000L; // Convert to microseconds
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