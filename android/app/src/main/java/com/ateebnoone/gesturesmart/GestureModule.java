package com.ateebnoone.gesturesmart;

import android.app.Activity;
import android.content.Intent;
import android.provider.Settings;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import android.os.Handler;
import android.os.Looper;

public class GestureModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public GestureModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "GestureModule";
    }

    @ReactMethod
    public void requestAccessibilityPermission(Promise promise) {
        Activity currentActivity = getCurrentActivity();
        if (currentActivity != null) {
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            currentActivity.startActivity(intent);
            promise.resolve(true);
        } else {
            promise.reject("ACTIVITY_NULL", "Current activity is null");
        }
    }

    @ReactMethod
    public void swipeLeft(Promise promise) {
        mainHandler.post(() -> {
            GestureAccessibilityService service = GestureAccessibilityService.getInstance();
            if (service != null) {
                service.performSwipeLeft();
                promise.resolve(true);
            } else {
                promise.reject("SERVICE_NOT_RUNNING", "Accessibility service is not running");
            }
        });
    }

    @ReactMethod
    public void swipeRight(Promise promise) {
        mainHandler.post(() -> {
            GestureAccessibilityService service = GestureAccessibilityService.getInstance();
            if (service != null) {
                service.performSwipeRight();
                promise.resolve(true);
            } else {
                promise.reject("SERVICE_NOT_RUNNING", "Accessibility service is not running");
            }
        });
    }

    @ReactMethod
    public void tap(double x, double y, Promise promise) {
        mainHandler.post(() -> {
            GestureAccessibilityService service = GestureAccessibilityService.getInstance();
            if (service != null) {
                service.performTap((float)x, (float)y);
                promise.resolve(true);
            } else {
                promise.reject("SERVICE_NOT_RUNNING", "Accessibility service is not running");
            }
        });
    }
}