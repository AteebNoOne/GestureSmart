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
    private CursorOverlay cursorOverlay;
    private boolean isCursorActive = false;

    public GestureActions(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
        this.cursorOverlay = new CursorOverlay(context);
        GestureModule.GestureActionsHolder.setInstance(this);
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
                        Intent cursorIntent = new Intent("com.ateebnoone.gesturesmart.CURSOR_MODE");
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
                Intent cursorIntent = new Intent("com.ateebnoone.gesturesmart.CURSOR_MODE");
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