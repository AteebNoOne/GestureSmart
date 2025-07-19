// android/app/src/main/java/com/yourapp/GestureServiceModule.java
package com.ateebnoone.gesturesmart;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

public class GestureServiceModule extends ReactContextBaseJavaModule {
    private ReactApplicationContext reactContext;

    public GestureServiceModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "GestureService";
    }

    @ReactMethod
    public void startService(Promise promise) {
        try {
            Intent serviceIntent = new Intent(reactContext, GestureDetectionService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(serviceIntent);
            } else {
                reactContext.startService(serviceIntent);
            }
            
            // Save state
            SharedPreferences prefs = reactContext.getSharedPreferences("GestureDetection", Context.MODE_PRIVATE);
            prefs.edit().putBoolean("service_running", true).apply();
            
            promise.resolve("Service started");
        } catch (Exception e) {
            promise.reject("SERVICE_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void stopService(Promise promise) {
        try {
            Intent serviceIntent = new Intent(reactContext, GestureDetectionService.class);
            reactContext.stopService(serviceIntent);
            
            // Save state
            SharedPreferences prefs = reactContext.getSharedPreferences("GestureDetection", Context.MODE_PRIVATE);
            prefs.edit().putBoolean("service_running", false).apply();
            
            promise.resolve("Service stopped");
        } catch (Exception e) {
            promise.reject("SERVICE_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void isServiceRunning(Promise promise) {
        SharedPreferences prefs = reactContext.getSharedPreferences("GestureDetection", Context.MODE_PRIVATE);
        boolean isRunning = prefs.getBoolean("service_running", false);
        promise.resolve(isRunning);
    }
}