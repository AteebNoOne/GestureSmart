package com.ateebnoone.gesturesmart;

import android.content.Intent;
import android.os.Build;
import android.util.Log;
import java.util.Map;
import java.util.HashMap;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class GestureModule extends ReactContextBaseJavaModule {
    private static final String TAG = "GestureModule";
    private final ReactApplicationContext reactContext;
    private boolean isServiceRunning = false;
    private static final String EVENT_NAME = "onGestureDetected";
    public static final String HAND_DETECTION_EVENT_NAME = "onHandDetection";

    public GestureModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @Override
    public void initialize() {
        super.initialize();
    }

    @Override
    public void onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy();
    }

    @ReactMethod
    public void addListener(String eventName) {
        // Keep: Required for RN built in Event Emitter
    }

    @ReactMethod
    public void removeListeners(Integer count) {
        // Keep: Required for RN built in Event Emitter
    }

    @Override
    public String getName() {
        return "GestureService";
    }

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

            promise.reject("ERROR", "Failed to start service: " + e.getMessage());
        }
    }

    @ReactMethod
    public void stopService(Promise promise) {
        try {
            Intent serviceIntent = new Intent(reactContext, GestureService.class);
            reactContext.stopService(serviceIntent);
            isServiceRunning = false;
            promise.resolve("Service stopped successfully");
            Log.i(TAG, "Gesture service stopped via React Native");
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to stop service: " + e.getMessage());
        }
    }

    @ReactMethod
    public void isServiceRunning(Promise promise) {
        promise.resolve(isServiceRunning);
    }

    public void sendEvent(String gestureType) {
        try {
            if (reactContext.hasActiveCatalystInstance()) {
                WritableMap params = Arguments.createMap();
                params.putString("gesture", gestureType);
                params.putDouble("timestamp", System.currentTimeMillis());

                if ("tap_at_cursor".equals(gestureType)) {
                    // Get GestureActions instance and perform tap
                    GestureActions gestureActions = getGestureActionsInstance();
                    if (gestureActions != null) {
                        gestureActions.performTapAtCursor();
                        Log.i(TAG, "Executed tap at cursor");
                    } else {
                        Log.e(TAG, "GestureActions instance not available for tap at cursor");
                    }
                }

                reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit(EVENT_NAME, params);

                Log.d(TAG, "Sent gesture event: " + gestureType);
            } else {
                Log.w(TAG, "No active React context, cannot send gesture event");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error sending gesture event: " + e.getMessage());
        }
    }

    // Add method to get GestureActions instance
    private GestureActions getGestureActionsInstance() {
        try {
            // You might need to store a static reference to GestureActions
            // or get it through the React Native bridge
            return GestureActionsHolder.getInstance();
        } catch (Exception e) {
            Log.e(TAG, "Error getting GestureActions instance: " + e.getMessage());
            return null;
        }
    }

    public void sendHandDetectionEvent(String status, int landmarkCount, float confidence) {
        try {
            if (reactContext.hasActiveCatalystInstance()) {
                WritableMap params = Arguments.createMap();
                params.putString("status", status);
                params.putInt("landmarkCount", landmarkCount);
                params.putDouble("confidence", confidence);
                params.putDouble("timestamp", System.currentTimeMillis());

                reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit(HAND_DETECTION_EVENT_NAME, params);

                Log.v(TAG, String.format("Sent hand detection event: %s (landmarks: %d, confidence: %.2f)",
                        status, landmarkCount, confidence));
            } else {
                Log.w(TAG, "No active React context, cannot send hand detection event");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error sending hand detection event: " + e.getMessage());
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

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("EVENT_NAME", EVENT_NAME);
        constants.put("HAND_DETECTION_EVENT_NAME", HAND_DETECTION_EVENT_NAME);
        return constants;
    }
}
