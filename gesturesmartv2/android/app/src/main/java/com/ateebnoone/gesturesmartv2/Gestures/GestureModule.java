package com.ateebnoone.gesturesmartv2;

import android.content.Intent;
import android.os.Build;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.HashMap;
import java.util.Map;

public class GestureModule extends ReactContextBaseJavaModule implements LifecycleEventListener {
    private static final String TAG = "GestureModule";
    private final ReactApplicationContext reactContext;
    private boolean isServiceRunning = false;

    private static final String EVENT_NAME = "onGestureDetected";
    public static final String HAND_DETECTION_EVENT_NAME = "onHandDetection";

    public GestureModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
        reactContext.addLifecycleEventListener(this);
    }

    @Override
    public String getName() {
        return "GestureService";
    }

    // --- Lifecycle Cleanup ---
    @Override
    public void onHostDestroy() {
        Log.i(TAG, "React Host is being destroyed. Cleaning up gesture service.");
        try {
            stopGestureService(); // internally sets isServiceRunning = false
        } catch (Exception e) {
            Log.e(TAG, "Cleanup error: " + e.getMessage());
        }
    }

    @Override
    public void onHostResume() {
        // Optional: Handle resume logic if needed
    }

    @Override
    public void onHostPause() {
        // Optional: Handle pause logic if needed
    }

    // --- Service Control Methods ---

    @ReactMethod
    public void startService(Promise promise) {
        try {
            Intent serviceIntent = new Intent(reactContext, GestureService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(serviceIntent);
            } else {
                reactContext.startService(serviceIntent);
            }
            isServiceRunning = true;
            promise.resolve("Service started successfully");
            Log.i(TAG, "Gesture service started via React Native");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start service", e);
            promise.reject("ERROR", "Failed to start service: " + e.getMessage());
        }
    }

    @ReactMethod
    public void stopService(Promise promise) {
        try {
            stopGestureService();
            promise.resolve("Service stopped successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop service", e);
            promise.reject("ERROR", "Failed to stop service: " + e.getMessage());
        }
    }

    private void stopGestureService() {
        Intent serviceIntent = new Intent(reactContext, GestureService.class);
        reactContext.stopService(serviceIntent);
        isServiceRunning = false;
        Log.i(TAG, "Gesture service stopped");
    }

    @ReactMethod
    public void isServiceRunning(Promise promise) {
        promise.resolve(isServiceRunning);
    }

    // --- Gesture Event Emitters ---

    public void sendEvent(String gestureType) {
        try {
            if (!reactContext.hasActiveCatalystInstance()) {
                Log.w(TAG, "No active React context. Skipping gesture event.");
                return;
            }

            WritableMap params = Arguments.createMap();
            params.putString("gesture", gestureType);
            params.putDouble("timestamp", System.currentTimeMillis());

            if ("tap_at_cursor".equals(gestureType)) {
                GestureActions actions = getGestureActionsInstance();
                if (actions != null) {
                    actions.performTapAtCursor();
                    Log.i(TAG, "Performed tap at cursor");
                } else {
                    Log.w(TAG, "GestureActions instance not available for tap_at_cursor");
                }
            }

            reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit(EVENT_NAME, params);

            Log.d(TAG, "Gesture event sent: " + gestureType);
        } catch (Exception e) {
            Log.e(TAG, "Error sending gesture event: " + e.getMessage(), e);
        }
    }

    public void sendHandDetectionEvent(String status, int landmarkCount, float confidence) {
        try {
            if (!reactContext.hasActiveCatalystInstance()) {
                Log.w(TAG, "No active React context. Skipping hand detection event.");
                return;
            }

            WritableMap params = Arguments.createMap();
            params.putString("status", status);
            params.putInt("landmarkCount", landmarkCount);
            params.putDouble("confidence", confidence);
            params.putDouble("timestamp", System.currentTimeMillis());

            reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit(HAND_DETECTION_EVENT_NAME, params);

            Log.v(TAG, String.format("Hand detection event: %s (landmarks: %d, confidence: %.2f)",
                    status, landmarkCount, confidence));
        } catch (Exception e) {
            Log.e(TAG, "Error sending hand detection event: " + e.getMessage(), e);
        }
    }

    // --- GestureActions Accessor ---

    private GestureActions getGestureActionsInstance() {
        try {
            return GestureActionsHolder.getInstance();
        } catch (Exception e) {
            Log.e(TAG, "Failed to get GestureActions instance", e);
            return null;
        }
    }

    public static class GestureActionsHolder {
        private static GestureActions instance;

        public static void setInstance(GestureActions gestureActions) {
            instance = gestureActions;
        }

        public static GestureActions getInstance() {
            return instance;
        }
    }

    // --- Constants for JS ---

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("EVENT_NAME", EVENT_NAME);
        constants.put("HAND_DETECTION_EVENT_NAME", HAND_DETECTION_EVENT_NAME);
        return constants;
    }

    // Required by React Native event system
    @ReactMethod
    public void addListener(String eventName) {
    }

    @ReactMethod
    public void removeListeners(Integer count) {
    }
}
