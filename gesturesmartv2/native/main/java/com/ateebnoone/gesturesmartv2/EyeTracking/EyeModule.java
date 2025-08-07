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

public class EyeModule extends ReactContextBaseJavaModule {
    private static final String TAG = "EyeModule";
    private ReactApplicationContext reactContext;
    private static EyeModule instance;

    public static EyeModule getInstance() {
        return instance;
    }

    public EyeModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        instance = this;
        Log.i(TAG, "EyeModule initialized");
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
        return "EyeService";
    }

    @ReactMethod
    public void startService() {
        Log.i(TAG, "Starting eye service");
        try {
            Intent serviceIntent = new Intent(reactContext, EyeService.class);
            reactContext.startForegroundService(serviceIntent);
            Log.i(TAG, "Eye service start command sent");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start eye service: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @ReactMethod
    public void stopService() {
        Log.i(TAG, "Stopping eye service");
        try {
            Intent serviceIntent = new Intent(reactContext, EyeService.class);
            reactContext.stopService(serviceIntent);
            Log.i(TAG, "Eye service stop command sent");
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop eye service: " + e.getMessage());
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

    // This method will be called by the EyeService to send events
    public void sendEyeEvent(String eventType) {
        Log.i(TAG, "Sending eye event: " + eventType);

        if (reactContext != null && reactContext.hasActiveCatalystInstance()) {
            try {
                WritableMap params = Arguments.createMap();
                params.putString("event", eventType);
                params.putLong("timestamp", System.currentTimeMillis());

                reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit("onEyeEvent", params);

                Log.i(TAG, "Eye event sent successfully through module: " + eventType);
            } catch (Exception e) {
                Log.e(TAG, "Failed to send eye event through module: " + e.getMessage());
                e.printStackTrace();
                throw new RuntimeException("Failed to send eye event", e);
            }
        } else {
            String error = "Cannot send eye event - React context not available";
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