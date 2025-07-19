package com.ateebnoone.gesturesmart;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.Context;
import android.content.Intent;
import android.graphics.Path;
import android.os.Build;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.WindowManager;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class GestureActions extends ReactContextBaseJavaModule {
    private static final String TAG = "GestureActions";
    private final ReactApplicationContext reactContext;
    private static AccessibilityService staticAccessibilityService;

    public GestureActions(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @Override
    public String getName() {
        return "GestureActions";
    }

    @ReactMethod
    public void requestAccessibilityPermission(Promise promise) {
        try {
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to open accessibility settings: " + e.getMessage());
        }
    }

    @ReactMethod
    public void swipeLeft(Promise promise) {
        if (!checkAccessibilityPermission()) {
            promise.reject("ERROR", "Accessibility permission not granted");
            return;
        }

        AccessibilityService service = getAccessibilityService();
        if (service == null) {
            promise.reject("ERROR", "Accessibility service not available");
            return;
        }

        try {
            DisplayMetrics metrics = getDisplayMetrics();
            float screenWidth = metrics.widthPixels;
            float screenHeight = metrics.heightPixels;

            Path path = new Path();
            path.moveTo(screenWidth * 0.8f, screenHeight * 0.5f);
            path.lineTo(screenWidth * 0.2f, screenHeight * 0.5f);

            GestureDescription.Builder gestureBuilder = new GestureDescription.Builder();
            gestureBuilder.addStroke(new GestureDescription.StrokeDescription(path, 0, 500));

            service.dispatchGesture(gestureBuilder.build(), null, null);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to perform swipe left: " + e.getMessage());
        }
    }

    @ReactMethod
    public void swipeRight(Promise promise) {
        if (!checkAccessibilityPermission()) {
            promise.reject("ERROR", "Accessibility permission not granted");
            return;
        }

        AccessibilityService service = getAccessibilityService();
        if (service == null) {
            promise.reject("ERROR", "Accessibility service not available");
            return;
        }

        try {
            DisplayMetrics metrics = getDisplayMetrics();
            float screenWidth = metrics.widthPixels;
            float screenHeight = metrics.heightPixels;

            Path path = new Path();
            path.moveTo(screenWidth * 0.2f, screenHeight * 0.5f);
            path.lineTo(screenWidth * 0.8f, screenHeight * 0.5f);

            GestureDescription.Builder gestureBuilder = new GestureDescription.Builder();
            gestureBuilder.addStroke(new GestureDescription.StrokeDescription(path, 0, 500));

            service.dispatchGesture(gestureBuilder.build(), null, null);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to perform swipe right: " + e.getMessage());
        }
    }

    @ReactMethod
    public void tap(double x, double y, Promise promise) {
        if (!checkAccessibilityPermission()) {
            promise.reject("ERROR", "Accessibility permission not granted");
            return;
        }

        AccessibilityService service = getAccessibilityService();
        if (service == null) {
            promise.reject("ERROR", "Accessibility service not available");
            return;
        }

        try {
            Path path = new Path();
            path.moveTo((float) x, (float) y);

            GestureDescription.Builder gestureBuilder = new GestureDescription.Builder();
            gestureBuilder.addStroke(new GestureDescription.StrokeDescription(path, 0, 100));

            service.dispatchGesture(gestureBuilder.build(), null, null);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to perform tap: " + e.getMessage());
        }
    }

    @ReactMethod
    public void scrollUp(Promise promise) {
        if (!checkAccessibilityPermission()) {
            promise.reject("ERROR", "Accessibility permission not granted");
            return;
        }

        AccessibilityService service = getAccessibilityService();
        if (service == null) {
            promise.reject("ERROR", "Accessibility service not available");
            return;
        }

        try {
            DisplayMetrics metrics = getDisplayMetrics();
            float screenWidth = metrics.widthPixels;
            float screenHeight = metrics.heightPixels;

            // Start from middle-bottom of screen and move up
            Path path = new Path();
            path.moveTo(screenWidth * 0.5f, screenHeight * 0.7f);
            path.lineTo(screenWidth * 0.5f, screenHeight * 0.3f);

            GestureDescription.Builder gestureBuilder = new GestureDescription.Builder();
            // Duration of 300ms for a smooth scroll
            gestureBuilder.addStroke(new GestureDescription.StrokeDescription(path, 0, 300));

            service.dispatchGesture(gestureBuilder.build(), null, null);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to perform scroll up: " + e.getMessage());
        }
    }

    @ReactMethod
    public void scrollDown(Promise promise) {
        if (!checkAccessibilityPermission()) {
            promise.reject("ERROR", "Accessibility permission not granted");
            return;
        }

        AccessibilityService service = getAccessibilityService();
        if (service == null) {
            promise.reject("ERROR", "Accessibility service not available");
            return;
        }

        try {
            DisplayMetrics metrics = getDisplayMetrics();
            float screenWidth = metrics.widthPixels;
            float screenHeight = metrics.heightPixels;

            // Start from middle-top of screen and move down
            Path path = new Path();
            path.moveTo(screenWidth * 0.5f, screenHeight * 0.3f);
            path.lineTo(screenWidth * 0.5f, screenHeight * 0.7f);

            GestureDescription.Builder gestureBuilder = new GestureDescription.Builder();
            // Duration of 300ms for a smooth scroll
            gestureBuilder.addStroke(new GestureDescription.StrokeDescription(path, 0, 300));

            service.dispatchGesture(gestureBuilder.build(), null, null);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to perform scroll down: " + e.getMessage());
        }
    }

    private boolean checkAccessibilityPermission() {
        String service = reactContext.getPackageName() + "/com.ateebnoone.gesturesmart.GestureAccessibilityService";
        int enabled = Settings.Secure.getInt(reactContext.getContentResolver(), Settings.Secure.ACCESSIBILITY_ENABLED,
                0);
        if (enabled == 1) {
            String settingValue = Settings.Secure.getString(reactContext.getContentResolver(),
                    Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            if (settingValue != null) {
                return settingValue.contains(service);
            }
        }
        return false;
    }

    private DisplayMetrics getDisplayMetrics() {
        WindowManager windowManager = (WindowManager) reactContext.getSystemService(Context.WINDOW_SERVICE);
        DisplayMetrics metrics = new DisplayMetrics();
        windowManager.getDefaultDisplay().getMetrics(metrics);
        return metrics;
    }

    private AccessibilityService getAccessibilityService() {
        // First try the static reference
        if (staticAccessibilityService != null) {
            return staticAccessibilityService;
        }

        // Try to get from the singleton
        return GestureAccessibilityService.getInstance();
    }

    public static void setAccessibilityServiceInstance(AccessibilityService service) {
        staticAccessibilityService = service;
    }
}