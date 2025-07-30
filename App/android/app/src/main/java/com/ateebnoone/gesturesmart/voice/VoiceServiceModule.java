package com.ateebnoone.gesturesmart;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.util.HashMap;
import java.util.Map;

import javax.annotation.Nonnull;
import javax.annotation.Nullable;

public class VoiceServiceModule extends ReactContextBaseJavaModule {

    private static final String TAG = "VoiceServiceModule";
    public static final String EVENT_NAME = "VoiceCommandDetected";
    public static final String STATUS_EVENT_NAME = "VoiceServiceStatus";

    private ReactApplicationContext reactContext;
    private boolean isServiceRunning = false;

    public VoiceServiceModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;

        // Set the React context for the background service
        VoiceBackgroundService.setReactContext(reactContext);

        Log.d(TAG, "VoiceServiceModule initialized");
    }

    @Nonnull
    @Override
    public String getName() {
        return "VoiceService";
    }

    @Nullable
    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("EVENT_NAME", EVENT_NAME);
        constants.put("STATUS_EVENT_NAME", STATUS_EVENT_NAME);
        return constants;
    }

    @ReactMethod
    public void startService(Promise promise) {
        try {
            Log.d(TAG, "Starting voice service...");

            if (!checkPermissions()) {
                promise.reject("PERMISSION_DENIED", "Audio recording permission not granted");
                return;
            }

            if (isServiceRunning) {
                promise.resolve("Service already running");
                return;
            }

            Intent serviceIntent = new Intent(reactContext, VoiceBackgroundService.class);
            serviceIntent.setAction(VoiceBackgroundService.ACTION_START_SERVICE);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(serviceIntent);
            } else {
                reactContext.startService(serviceIntent);
            }

            isServiceRunning = true;
            promise.resolve("Service started successfully");

        } catch (Exception e) {
            Log.e(TAG, "Failed to start service", e);
            promise.reject("START_FAILED", "Failed to start service: " + e.getMessage());
        }
    }

    @ReactMethod
    public void stopService(Promise promise) {
        try {
            Log.d(TAG, "Stopping voice service...");

            Intent serviceIntent = new Intent(reactContext, VoiceBackgroundService.class);
            serviceIntent.setAction(VoiceBackgroundService.ACTION_STOP_SERVICE);
            reactContext.stopService(serviceIntent);

            isServiceRunning = false;
            promise.resolve("Service stopped successfully");

        } catch (Exception e) {
            Log.e(TAG, "Failed to stop service", e);
            promise.reject("STOP_FAILED", "Failed to stop service: " + e.getMessage());
        }
    }

    @ReactMethod
    public void isServiceRunning(Promise promise) {
        promise.resolve(isServiceRunning);
    }

    @ReactMethod
    public void checkPermissions(Promise promise) {
        boolean hasPermission = ActivityCompat.checkSelfPermission(reactContext,
                Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
        promise.resolve(hasPermission);
    }

    private boolean checkPermissions() {
        return ActivityCompat.checkSelfPermission(reactContext,
                Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy();
        Log.d(TAG, "VoiceServiceModule destroyed");
        isServiceRunning = false;
    }
}