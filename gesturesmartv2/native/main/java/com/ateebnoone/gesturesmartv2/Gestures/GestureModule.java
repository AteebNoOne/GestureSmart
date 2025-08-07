package com.ateebnoone.gesturesmartv2;

import android.content.Intent;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.facebook.react.bridge.ReactContext;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class GestureModule extends ReactContextBaseJavaModule {
    private static final String TAG = "GestureModule";
    private ReactApplicationContext reactContext;
    private static GestureModule instance;

    // Inner class to hold GestureActions instance
    public static class GestureActionsHolder {
        private static GestureActions instance;

        public static void setInstance(GestureActions actions) {
            instance = actions;
        }

        public static GestureActions getInstance() {
            return instance;
        }
    }

    public static GestureModule getInstance() {
        return instance;
    }

    public GestureModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        instance = this;
        Log.i(TAG, "GestureModule initialized");
    }

    @Override
    public void initialize() {
        super.initialize();
        notifyContextAvailable();
    }

    private void notifyContextAvailable() {
        Intent intent = new Intent("REACT_CONTEXT_AVAILABLE");
        LocalBroadcastManager.getInstance(getReactApplicationContext()).sendBroadcast(intent);
    }

    @NonNull
    @Override
    public String getName() {
        return "GestureService";
    }

    @ReactMethod
    public void startService() {
        Log.i(TAG, "Starting gesture service");
        try {
            Intent serviceIntent = new Intent(reactContext, GestureService.class);
            reactContext.startForegroundService(serviceIntent);
            Log.i(TAG, "Gesture service start command sent");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start gesture service: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @ReactMethod
    public void stopService() {
        Log.i(TAG, "Stopping gesture service");
        try {
            Intent serviceIntent = new Intent(reactContext, GestureService.class);
            reactContext.stopService(serviceIntent);
            Log.i(TAG, "Gesture service stop command sent");
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop gesture service: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @ReactMethod
    public void addListener(String eventName) {
        // Required for RN built in Event Emitter Calls.
        Log.d(TAG, "Added listener for: " + eventName);
    }

    @ReactMethod
    public void removeListeners(Integer count) {
        // Required for RN built in Event Emitter Calls.
        Log.d(TAG, "Removed " + count + " listeners");
    }

    // This method will be called by the GestureService to send events
    public void sendGestureEvent(String eventType) {
        Log.i(TAG, "Sending gesture event: " + eventType);

        if (reactContext != null && reactContext.hasActiveCatalystInstance()) {
            try {
                WritableMap params = Arguments.createMap();
                params.putString("event", eventType);
                params.putLong("timestamp", System.currentTimeMillis());

                reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit("onGestureEvent", params);

                Log.i(TAG, "Gesture event sent successfully through module: " + eventType);
            } catch (Exception e) {
                Log.e(TAG, "Failed to send gesture event through module: " + e.getMessage());
                e.printStackTrace();
                throw new RuntimeException("Failed to send gesture event", e);
            }
        } else {
            String error = "Cannot send gesture event - React context not available";
            Log.e(TAG, error);
            throw new RuntimeException(error);
        }
    }

    public boolean isReactContextReady() {
        return reactContext != null && reactContext.hasActiveCatalystInstance();
    }

    public ReactContext getContext() {
        return reactContext;
    }
}