package com.ateebnoone.gesturesmartv2;

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

import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Handler;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class GestureActions extends ReactContextBaseJavaModule {
    private static final String TAG = "GestureActions";
    private final ReactApplicationContext reactContext;
    private static AccessibilityService staticAccessibilityService;
    private CursorOverlay cursorOverlay;
    private boolean isCursorActive = false;
    private Map<String, String> appCache; // Cache for app names → package names

    public GestureActions(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
        this.cursorOverlay = new CursorOverlay(context);
        this.appCache = new HashMap<>();
        initializeAppCache();
        GestureModule.GestureActionsHolder.setInstance(this);
    }

    private void initializeAppCache() {
        PackageManager pm = reactContext.getPackageManager();
        List<ApplicationInfo> apps = pm.getInstalledApplications(0);

        for (ApplicationInfo appInfo : apps) {
            String label = pm.getApplicationLabel(appInfo).toString();
            String normalizedLabel = label.toLowerCase(Locale.ENGLISH).trim();
            appCache.put(normalizedLabel, appInfo.packageName);

            // Add common aliases
            if (normalizedLabel.contains("youtube")) {
                appCache.put("yt", appInfo.packageName);
            }
            if (normalizedLabel.contains("facebook")) {
                appCache.put("fb", appInfo.packageName);
            }
        }
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
    public void cursor(Promise promise) {
        try {
            if (!checkAccessibilityPermission()) {
                promise.reject("ERROR", "Accessibility permission not granted");
                return;
            }

            if (!isCursorActive) {
                // Initialize cursor at center of screen
                if (cursorOverlay != null) {
                    // Open cursor
                    boolean success = cursorOverlay.show();
                    if (success) {
                        isCursorActive = true;
                        // Initialize at center
                        cursorOverlay.updatePosition(0.5f, 0.5f);

                        // Notify GestureService to switch to cursor mode
                        Intent cursorIntent = new Intent("com.ateebnoone.gesturesmartv2.CURSOR_MODE");
                        cursorIntent.putExtra("active", true);
                        reactContext.sendBroadcast(cursorIntent);

                        Log.i(TAG, "Cursor opened successfully and initialized at center");
                        promise.resolve("cursor_opened");
                    } else {
                        promise.reject("ERROR", "Failed to show cursor overlay");
                    }
                } else {
                    promise.reject("ERROR", "Cursor overlay not initialized");
                }
            } else {
                // Close cursor
                if (cursorOverlay != null) {
                    cursorOverlay.hide();
                }
                isCursorActive = false;

                // Notify GestureService to switch back to normal mode
                Intent cursorIntent = new Intent("com.ateebnoone.gesturesmartv2.CURSOR_MODE");
                cursorIntent.putExtra("active", false);
                reactContext.sendBroadcast(cursorIntent);

                Log.i(TAG, "Cursor closed successfully");
                promise.resolve("cursor_closed");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error toggling cursor: " + e.getMessage());
            promise.reject("ERROR", "Failed to toggle cursor: " + e.getMessage());
        }
    }

    @ReactMethod
    public void getCursorStatus(Promise promise) {
        try {
            promise.resolve(isCursorActive);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to get cursor status: " + e.getMessage());
        }
    }

    // Update cursor position from GestureService
    public void updateCursorPosition(float normalizedX, float normalizedY) {
        try {
            Log.d(TAG, String.format("updateCursorPosition called with: (%.3f, %.3f), isCursorActive: %b",
                    normalizedX, normalizedY, isCursorActive));

            if (cursorOverlay == null) {
                Log.w(TAG, "CursorOverlay is null, cannot update position");
                return;
            }

            if (normalizedX < 0 || normalizedY < 0) {
                // Special case: negative coordinates mean hide the cursor
                Log.d(TAG, "Negative coordinates received, hiding cursor");
                if (isCursorActive) {
                    cursorOverlay.hide();
                    isCursorActive = false;
                }
                return;
            }

            // Validate normalized coordinates
            if (normalizedX > 1.0f || normalizedY > 1.0f) {
                Log.w(TAG, String.format("Invalid normalized coordinates: (%.3f, %.3f). Should be 0.0-1.0",
                        normalizedX, normalizedY));
                // Clamp to valid range
                normalizedX = Math.max(0.0f, Math.min(1.0f, normalizedX));
                normalizedY = Math.max(0.0f, Math.min(1.0f, normalizedY));
            }

            // Make sure cursor is showing if it should be active
            if (isCursorActive && !cursorOverlay.isShowing()) {
                Log.d(TAG, "Cursor should be active but not showing, attempting to show");
                boolean showResult = cursorOverlay.show();
                Log.d(TAG, "Show cursor result: " + showResult);
            }

            // Update cursor overlay position
            if (isCursorActive) {
                Log.v(TAG, String.format("Updating cursor position to normalized: (%.3f, %.3f)",
                        normalizedX, normalizedY));
                cursorOverlay.updatePosition(normalizedX, normalizedY);
            } else {
                Log.d(TAG, "Cursor not active, skipping position update");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error updating cursor position: " + e.getMessage());
            e.printStackTrace();
        }
    }

    // Test method to check if cursor movement works
    @ReactMethod
    public void testCursorMovement(Promise promise) {
        if (!isCursorActive) {
            promise.reject("ERROR", "Cursor is not active");
            return;
        }

        try {
            Log.i(TAG, "Starting cursor movement test");

            // Test movement to different positions
            updateCursorPosition(0.1f, 0.1f); // Top-left

            // Use handler to delay subsequent movements
            android.os.Handler handler = new android.os.Handler(android.os.Looper.getMainLooper());
            handler.postDelayed(() -> updateCursorPosition(0.9f, 0.1f), 500); // Top-right
            handler.postDelayed(() -> updateCursorPosition(0.9f, 0.9f), 1000); // Bottom-right
            handler.postDelayed(() -> updateCursorPosition(0.1f, 0.9f), 1500); // Bottom-left
            handler.postDelayed(() -> updateCursorPosition(0.5f, 0.5f), 2000); // Center

            promise.resolve("Test movement started");
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to test cursor movement: " + e.getMessage());
        }
    }

    // Perform tap at cursor position
    @ReactMethod
    public void tapAtCursor(Promise promise) {
        if (!isCursorActive) {
            promise.reject("ERROR", "Cursor is not active");
            return;
        }

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
            // Get cursor position
            float[] position = cursorOverlay.getCurrentPosition();

            Path path = new Path();
            path.moveTo(position[0], position[1]);

            GestureDescription.Builder gestureBuilder = new GestureDescription.Builder();
            gestureBuilder.addStroke(new GestureDescription.StrokeDescription(path, 0, 100));

            service.dispatchGesture(gestureBuilder.build(), null, null);
            Log.i(TAG, "Tapped at cursor position: (" + position[0] + ", " + position[1] + ")");
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to tap at cursor: " + e.getMessage());
            promise.reject("ERROR", "Failed to tap at cursor: " + e.getMessage());
        }
    }

    // Add this method to handle tap at cursor from gesture detection
    public void performTapAtCursor() {
        if (!isCursorActive) {
            Log.w(TAG, "Cannot tap - cursor is not active");
            return;
        }

        if (!checkAccessibilityPermission()) {
            Log.e(TAG, "Cannot tap - accessibility permission not granted");
            return;
        }

        AccessibilityService service = getAccessibilityService();
        if (service == null) {
            Log.e(TAG, "Cannot tap - accessibility service not available");
            return;
        }

        try {
            // Get cursor position
            float[] position = cursorOverlay.getCurrentPosition();

            Path path = new Path();
            path.moveTo(position[0], position[1]);

            GestureDescription.Builder gestureBuilder = new GestureDescription.Builder();
            gestureBuilder.addStroke(new GestureDescription.StrokeDescription(path, 0, 100));

            service.dispatchGesture(gestureBuilder.build(), null, null);
            Log.i(TAG, "Performed tap at cursor position: (" + position[0] + ", " + position[1] + ")");
        } catch (Exception e) {
            Log.e(TAG, "Failed to perform tap at cursor: " + e.getMessage());
        }
    }

    @ReactMethod
    public void swipeLeft(Promise promise) {
        if (isCursorActive) {
            promise.reject("ERROR", "Cannot perform swipe while cursor is active");
            return;
        }

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
        if (isCursorActive) {
            promise.reject("ERROR", "Cannot perform swipe while cursor is active");
            return;
        }

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
        if (isCursorActive) {
            promise.reject("ERROR", "Cannot perform tap while cursor is active. Use tapAtCursor instead.");
            return;
        }

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
        if (isCursorActive) {
            promise.reject("ERROR", "Cannot perform scroll while cursor is active");
            return;
        }

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

            // Use exact center coordinates
            float centerX = screenWidth / 2f;
            float centerY = screenHeight / 2f;

            // Start from center-bottom and move to center-top
            Path path = new Path();
            path.moveTo(centerX, centerY + (screenHeight * 0.2f)); // Start below center
            path.lineTo(centerX, centerY - (screenHeight * 0.2f)); // End above center

            GestureDescription.Builder gestureBuilder = new GestureDescription.Builder();
            gestureBuilder.addStroke(new GestureDescription.StrokeDescription(path, 0, 300));

            service.dispatchGesture(gestureBuilder.build(), null, null);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to perform scroll up: " + e.getMessage());
        }
    }

    @ReactMethod
    public void scrollDown(Promise promise) {
        if (isCursorActive) {
            promise.reject("ERROR", "Cannot perform scroll while cursor is active");
            return;
        }

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

            // Use exact center coordinates
            float centerX = screenWidth / 2f;
            float centerY = screenHeight / 2f;

            // Start from center-top and move to center-bottom
            Path path = new Path();
            path.moveTo(centerX, centerY - (screenHeight * 0.2f)); // Start above center
            path.lineTo(centerX, centerY + (screenHeight * 0.2f)); // End below center

            GestureDescription.Builder gestureBuilder = new GestureDescription.Builder();
            gestureBuilder.addStroke(new GestureDescription.StrokeDescription(path, 0, 300));

            service.dispatchGesture(gestureBuilder.build(), null, null);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to perform scroll down: " + e.getMessage());
        }
    }

    @ReactMethod
    public void goBack(Promise promise) {
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
            // Perform global back action
            boolean success = service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK);

            if (success) {
                promise.resolve(true);
            } else {
                promise.reject("ERROR", "Failed to perform back action");
            }
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to perform back action: " + e.getMessage());
        }
    }

    @ReactMethod
    public void goHome(Promise promise) {
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
            // Perform global home action
            boolean success = service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_HOME);

            if (success) {
                promise.resolve(true);
            } else {
                promise.reject("ERROR", "Failed to perform home action");
            }
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to perform home action: " + e.getMessage());
        }
    }

    @ReactMethod
    public void showRecentApps(Promise promise) {
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
            // Perform global recents action
            boolean success = service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_RECENTS);

            if (success) {
                promise.resolve(true);
            } else {
                promise.reject("ERROR", "Failed to show recent apps");
            }
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to show recent apps: " + e.getMessage());
        }
    }

    // Add these variables to your class (at the top with other instance variables)
    private Handler scrollHandler;
    private Runnable scrollRunnable;
    private boolean isContinuousScrolling = false;
    private String currentScrollDirection = ""; // "up" or "down"

    // Continuous scroll up method
    @ReactMethod
    public void continuousScrollUp(Promise promise) {
        if (isCursorActive) {
            promise.reject("ERROR", "Cannot perform scroll while cursor is active");
            return;
        }

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
            // Stop any existing continuous scrolling
            stopScrolling(null);

            isContinuousScrolling = true;
            currentScrollDirection = "up";

            if (scrollHandler == null) {
                scrollHandler = new Handler(android.os.Looper.getMainLooper());
            }

            DisplayMetrics metrics = getDisplayMetrics();
            final float screenWidth = metrics.widthPixels;
            final float screenHeight = metrics.heightPixels;
            final float centerX = screenWidth / 2f;
            final float centerY = screenHeight / 2f;

            scrollRunnable = new Runnable() {
                @Override
                public void run() {
                    if (!isContinuousScrolling || !currentScrollDirection.equals("up")) {
                        return;
                    }

                    try {
                        // Create scroll up gesture
                        Path path = new Path();
                        path.moveTo(centerX, centerY + (screenHeight * 0.15f)); // Start below center
                        path.lineTo(centerX, centerY - (screenHeight * 0.15f)); // End above center

                        GestureDescription.Builder gestureBuilder = new GestureDescription.Builder();
                        gestureBuilder.addStroke(new GestureDescription.StrokeDescription(path, 0, 200));

                        service.dispatchGesture(gestureBuilder.build(), null, null);

                        // Schedule next scroll after a short delay
                        if (isContinuousScrolling && scrollHandler != null) {
                            scrollHandler.postDelayed(this, 300); // Repeat every 300ms
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error in continuous scroll up: " + e.getMessage());
                        isContinuousScrolling = false;
                    }
                }
            };

            // Start the continuous scrolling
            scrollHandler.post(scrollRunnable);
            promise.resolve("Continuous scroll up started");
            Log.i(TAG, "Continuous scroll up started");

        } catch (Exception e) {
            promise.reject("ERROR", "Failed to start continuous scroll up: " + e.getMessage());
        }
    }

    // Continuous scroll down method
    @ReactMethod
    public void continuousScrollDown(Promise promise) {
        if (isCursorActive) {
            promise.reject("ERROR", "Cannot perform scroll while cursor is active");
            return;
        }

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
            // Stop any existing continuous scrolling
            stopScrolling(null);

            isContinuousScrolling = true;
            currentScrollDirection = "down";

            if (scrollHandler == null) {
                scrollHandler = new Handler(android.os.Looper.getMainLooper());
            }

            DisplayMetrics metrics = getDisplayMetrics();
            final float screenWidth = metrics.widthPixels;
            final float screenHeight = metrics.heightPixels;
            final float centerX = screenWidth / 2f;
            final float centerY = screenHeight / 2f;

            scrollRunnable = new Runnable() {
                @Override
                public void run() {
                    if (!isContinuousScrolling || !currentScrollDirection.equals("down")) {
                        return;
                    }

                    try {
                        // Create scroll down gesture
                        Path path = new Path();
                        path.moveTo(centerX, centerY - (screenHeight * 0.15f)); // Start above center
                        path.lineTo(centerX, centerY + (screenHeight * 0.15f)); // End below center

                        GestureDescription.Builder gestureBuilder = new GestureDescription.Builder();
                        gestureBuilder.addStroke(new GestureDescription.StrokeDescription(path, 0, 200));

                        service.dispatchGesture(gestureBuilder.build(), null, null);

                        // Schedule next scroll after a short delay
                        if (isContinuousScrolling && scrollHandler != null) {
                            scrollHandler.postDelayed(this, 300); // Repeat every 300ms
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error in continuous scroll down: " + e.getMessage());
                        isContinuousScrolling = false;
                    }
                }
            };

            // Start the continuous scrolling
            scrollHandler.post(scrollRunnable);
            promise.resolve("Continuous scroll down started");
            Log.i(TAG, "Continuous scroll down started");

        } catch (Exception e) {
            promise.reject("ERROR", "Failed to start continuous scroll down: " + e.getMessage());
        }
    }

    // Stop scrolling method
    @ReactMethod
    public void stopScrolling(Promise promise) {
        try {
            if (isContinuousScrolling) {
                isContinuousScrolling = false;
                currentScrollDirection = "";

                if (scrollHandler != null && scrollRunnable != null) {
                    scrollHandler.removeCallbacks(scrollRunnable);
                    scrollRunnable = null;
                }

                Log.i(TAG, "Continuous scrolling stopped");

                if (promise != null) {
                    promise.resolve("Scrolling stopped");
                }
            } else {
                Log.i(TAG, "No continuous scrolling to stop");

                if (promise != null) {
                    promise.resolve("No scrolling was active");
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error stopping scrolling: " + e.getMessage());
            if (promise != null) {
                promise.reject("ERROR", "Failed to stop scrolling: " + e.getMessage());
            }
        }
    }

    // Helper method to check if continuous scrolling is active
    @ReactMethod
    public void isScrolling(Promise promise) {
        try {
            Map<String, Object> result = new HashMap<>();
            result.put("isScrolling", isContinuousScrolling);
            result.put("direction", currentScrollDirection);
            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to get scrolling status: " + e.getMessage());
        }
    }

    // Improved openApp method with better search logic
    @ReactMethod
    public void openApp(String appName, Promise promise) {
        try {
            String normalizedInput = appName.toLowerCase(Locale.ENGLISH).trim();
            PackageManager pm = reactContext.getPackageManager();

            Log.i(TAG, "Searching for app: " + appName + " (normalized: " + normalizedInput + ")");

            // 1. First try known package names for common apps
            String packageName = getKnownPackageName(normalizedInput);
            if (packageName != null) {
                Log.i(TAG, "Found known package: " + packageName);
                launchApp(packageName, appName, promise);
                return;
            }

            // 2. Check cache for exact match
            if (appCache.containsKey(normalizedInput)) {
                Log.i(TAG, "Found exact match in cache: " + normalizedInput);
                launchApp(appCache.get(normalizedInput), appName, promise);
                return;
            }

            // 3. Check for partial matches in cache
            for (String cachedName : appCache.keySet()) {
                if (cachedName.contains(normalizedInput) || normalizedInput.contains(cachedName)) {
                    Log.i(TAG, "Found partial match in cache: " + cachedName);
                    launchApp(appCache.get(cachedName), appName, promise);
                    return;
                }
            }

            // 4. Refresh cache and try again (in case apps were installed after
            // initialization)
            Log.i(TAG, "Refreshing app cache and searching again...");
            refreshAppCache();

            // 5. Try cache searches again after refresh
            if (appCache.containsKey(normalizedInput)) {
                Log.i(TAG, "Found exact match after cache refresh: " + normalizedInput);
                launchApp(appCache.get(normalizedInput), appName, promise);
                return;
            }

            for (String cachedName : appCache.keySet()) {
                if (cachedName.contains(normalizedInput) || normalizedInput.contains(cachedName)) {
                    Log.i(TAG, "Found partial match after cache refresh: " + cachedName);
                    launchApp(appCache.get(cachedName), appName, promise);
                    return;
                }
            }

            // 6. Final fallback: Live system search with multiple criteria
            Log.i(TAG, "Performing live system search...");
            Intent intent = new Intent(Intent.ACTION_MAIN);
            intent.addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> resolveInfos = pm.queryIntentActivities(intent, 0);

            // First pass: exact matches
            for (ResolveInfo resolveInfo : resolveInfos) {
                String label = resolveInfo.loadLabel(pm).toString().toLowerCase(Locale.ENGLISH);
                String packageNameLower = resolveInfo.activityInfo.packageName.toLowerCase(Locale.ENGLISH);

                if (label.equals(normalizedInput) || packageNameLower.contains(normalizedInput)) {
                    Log.i(TAG, "Found exact match in live search: " + label + " ("
                            + resolveInfo.activityInfo.packageName + ")");
                    launchApp(resolveInfo.activityInfo.packageName, appName, promise);
                    return;
                }
            }

            // Second pass: partial matches
            for (ResolveInfo resolveInfo : resolveInfos) {
                String label = resolveInfo.loadLabel(pm).toString().toLowerCase(Locale.ENGLISH);
                String packageNameLower = resolveInfo.activityInfo.packageName.toLowerCase(Locale.ENGLISH);

                if (label.contains(normalizedInput) || normalizedInput.contains(label) ||
                        packageNameLower.contains(normalizedInput)) {
                    Log.i(TAG, "Found partial match in live search: " + label + " ("
                            + resolveInfo.activityInfo.packageName + ")");
                    launchApp(resolveInfo.activityInfo.packageName, appName, promise);
                    return;
                }
            }

            // 7. Log available apps for debugging
            Log.w(TAG, "App not found. Available apps in cache:");
            for (String cachedName : appCache.keySet()) {
                Log.w(TAG, "  - " + cachedName + " -> " + appCache.get(cachedName));
            }

            promise.reject("APP_NOT_FOUND", "Can't find app \"" + appName + "\". Try using exact app name.");

        } catch (Exception e) {
            Log.e(TAG, "Error opening app: " + e.getMessage(), e);
            promise.reject("ERROR", "Failed to open app: " + e.getMessage());
        }
    }

    // Method to get known package names for popular apps
    private String getKnownPackageName(String normalizedAppName) {
        Map<String, String> knownApps = new HashMap<>();

        // Popular apps with their exact package names
        knownApps.put("youtube", "com.google.android.youtube");
        knownApps.put("gmail", "com.google.android.gm");
        knownApps.put("chrome", "com.android.chrome");
        knownApps.put("maps", "com.google.android.apps.maps");
        knownApps.put("google maps", "com.google.android.apps.maps");
        knownApps.put("whatsapp", "com.whatsapp");
        knownApps.put("facebook", "com.facebook.katana");
        knownApps.put("instagram", "com.instagram.android");
        knownApps.put("twitter", "com.twitter.android");
        knownApps.put("x", "com.twitter.android");
        knownApps.put("spotify", "com.spotify.music");
        knownApps.put("netflix", "com.netflix.mediaclient");
        knownApps.put("amazon", "com.amazon.mShop.android.shopping");
        knownApps.put("uber", "com.ubercab");
        knownApps.put("tiktok", "com.zhiliaoapp.musically");
        knownApps.put("telegram", "org.telegram.messenger");
        knownApps.put("snapchat", "com.snapchat.android");
        knownApps.put("discord", "com.discord");
        knownApps.put("zoom", "us.zoom.videomeetings");
        knownApps.put("microsoft teams", "com.microsoft.teams");
        knownApps.put("teams", "com.microsoft.teams");
        knownApps.put("skype", "com.skype.raider");
        knownApps.put("pinterest", "com.pinterest");
        knownApps.put("linkedin", "com.linkedin.android");
        knownApps.put("reddit", "com.reddit.frontpage");
        knownApps.put("calculator", "com.google.android.calculator");
        knownApps.put("calendar", "com.google.android.calendar");
        knownApps.put("camera", "com.google.android.GoogleCamera");
        knownApps.put("photos", "com.google.android.apps.photos");
        knownApps.put("play store", "com.android.vending");
        knownApps.put("playstore", "com.android.vending");
        knownApps.put("settings", "com.android.settings");

        return knownApps.get(normalizedAppName);
    }

    // Method to refresh the app cache
    private void refreshAppCache() {
        try {
            Log.i(TAG, "Refreshing app cache...");
            appCache.clear();

            PackageManager pm = reactContext.getPackageManager();
            Intent intent = new Intent(Intent.ACTION_MAIN);
            intent.addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> resolveInfos = pm.queryIntentActivities(intent, 0);

            for (ResolveInfo resolveInfo : resolveInfos) {
                try {
                    String label = resolveInfo.loadLabel(pm).toString().toLowerCase(Locale.ENGLISH).trim();
                    String packageName = resolveInfo.activityInfo.packageName;
                    appCache.put(label, packageName);

                    // Also add package name as a key for direct package searches
                    String packageNameLower = packageName.toLowerCase(Locale.ENGLISH);
                    if (!appCache.containsKey(packageNameLower)) {
                        appCache.put(packageNameLower, packageName);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Error processing app: " + e.getMessage());
                }
            }

            Log.i(TAG, "App cache refreshed with " + appCache.size() + " entries");
        } catch (Exception e) {
            Log.e(TAG, "Failed to refresh app cache: " + e.getMessage());
        }
    }

    // Method to list all available apps (for debugging)
    @ReactMethod
    public void listAvailableApps(Promise promise) {
        try {
            refreshAppCache();

            Map<String, String> result = new HashMap<>();
            for (Map.Entry<String, String> entry : appCache.entrySet()) {
                result.put(entry.getKey(), entry.getValue());
            }

            promise.resolve(result);
            Log.i(TAG, "Listed " + result.size() + " available apps");
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to list apps: " + e.getMessage());
        }
    }

    // Method to search for apps by partial name (for debugging)
    @ReactMethod
    public void searchApps(String searchTerm, Promise promise) {
        try {
            String normalizedSearch = searchTerm.toLowerCase(Locale.ENGLISH).trim();
            Map<String, String> matches = new HashMap<>();

            refreshAppCache();

            for (Map.Entry<String, String> entry : appCache.entrySet()) {
                if (entry.getKey().contains(normalizedSearch)) {
                    matches.put(entry.getKey(), entry.getValue());
                }
            }

            promise.resolve(matches);
            Log.i(TAG, "Found " + matches.size() + " matches for: " + searchTerm);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to search apps: " + e.getMessage());
        }
    }

    private void launchApp(String packageName, String appName, Promise promise) {
        try {
            PackageManager pm = reactContext.getPackageManager();
            Intent intent = pm.getLaunchIntentForPackage(packageName);
            if (intent != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                reactContext.startActivity(intent);
                promise.resolve("Opened app: " + appName);
            } else {
                promise.reject("NO_LAUNCHER", "App has no launcher activity");
            }
        } catch (Exception e) {
            promise.reject("LAUNCH_ERROR", "Failed to launch app: " + e.getMessage());
        }
    }

    private boolean checkAccessibilityPermission() {
        String service = reactContext.getPackageName() + "/com.ateebnoone.gesturesmartv2.GestureAccessibilityService";
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

    // Getter for cursor active state (for gesture service)
    public boolean isCursorActive() {
        return isCursorActive;
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