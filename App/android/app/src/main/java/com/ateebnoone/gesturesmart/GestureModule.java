package com.ateebnoone.gesturesmart;

import android.content.Intent;
import android.os.Build;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class GestureModule extends ReactContextBaseJavaModule {
    private static final String TAG = "GestureModule";
    private final ReactApplicationContext reactContext;
    private boolean isServiceRunning = false;
    private static final String EVENT_NAME = "onGestureDetected";

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
            promise.resolve(null);
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
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to stop service: " + e.getMessage());
        }
    }

    @ReactMethod
    public void isServiceRunning(Promise promise) {
        promise.resolve(isServiceRunning);
    }

    public void sendEvent(String gesture) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(EVENT_NAME, gesture);
        }
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("EVENT_NAME", EVENT_NAME);
        return constants;
    }
}
