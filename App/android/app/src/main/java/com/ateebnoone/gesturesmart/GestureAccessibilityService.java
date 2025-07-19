package com.ateebnoone.gesturesmart;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.os.Build;
import android.util.Log;
import android.view.Gravity;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.accessibilityservice.AccessibilityServiceInfo;

public class GestureAccessibilityService extends AccessibilityService {
    private static final String TAG = "GestureAccessibilityService";
    private BroadcastReceiver gestureReceiver;
    private WindowManager windowManager;
    private int screenWidth;
    private int screenHeight;

    @Override
    public void onCreate() {
        super.onCreate();
        windowManager = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        screenWidth = getResources().getDisplayMetrics().widthPixels;
        screenHeight = getResources().getDisplayMetrics().heightPixels;

        // Register broadcast receiver for gesture commands
        gestureReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if ("PERFORM_GESTURE".equals(intent.getAction())) {
                    String gesture = intent.getStringExtra("gesture");
                    if (gesture != null) {
                        performGesture(gesture);
                    }
                }
            }
        };

        IntentFilter filter = new IntentFilter("PERFORM_GESTURE");
        registerReceiver(gestureReceiver, filter);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (gestureReceiver != null) {
            unregisterReceiver(gestureReceiver);
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // Handle accessibility events if needed
    }

    @Override
    public void onInterrupt() {
        // Handle interruption if needed
    }

    @Override
    protected void onServiceConnected() {
        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPES_ALL_MASK;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.notificationTimeout = 100;
        info.flags = AccessibilityServiceInfo.FLAG_REQUEST_TOUCH_EXPLORATION_MODE;
        setServiceInfo(info);
    }

    private void performGesture(String gesture) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            Log.w(TAG, "Gestures not supported on this Android version");
            return;
        }

        Path path = new Path();
        GestureDescription.Builder builder = new GestureDescription.Builder();
        long duration = 100; // Default duration

        switch (gesture.toLowerCase()) {
            case "tap":
                path.moveTo(screenWidth / 2f, screenHeight / 2f);
                builder.addStroke(new GestureDescription.StrokeDescription(path, 0, duration));
                break;

            case "swipe_left":
                path.moveTo(screenWidth * 0.8f, screenHeight / 2f);
                path.lineTo(screenWidth * 0.2f, screenHeight / 2f);
                builder.addStroke(new GestureDescription.StrokeDescription(path, 0, duration));
                break;

            case "swipe_right":
                path.moveTo(screenWidth * 0.2f, screenHeight / 2f);
                path.lineTo(screenWidth * 0.8f, screenHeight / 2f);
                builder.addStroke(new GestureDescription.StrokeDescription(path, 0, duration));
                break;

            case "scroll_up":
                path.moveTo(screenWidth / 2f, screenHeight * 0.7f);
                path.lineTo(screenWidth / 2f, screenHeight * 0.3f);
                builder.addStroke(new GestureDescription.StrokeDescription(path, 0, duration));
                break;

            case "scroll_down":
                path.moveTo(screenWidth / 2f, screenHeight * 0.3f);
                path.lineTo(screenWidth / 2f, screenHeight * 0.7f);
                builder.addStroke(new GestureDescription.StrokeDescription(path, 0, duration));
                break;

            default:
                Log.w(TAG, "Unknown gesture: " + gesture);
                return;
        }

        GestureDescription gestureDescription = builder.build();
        boolean dispatched = dispatchGesture(gestureDescription, new GestureResultCallback() {
            @Override
            public void onCompleted(GestureDescription gestureDescription) {
                Log.d(TAG, "Gesture completed: " + gesture);
            }

            @Override
            public void onCancelled(GestureDescription gestureDescription) {
                Log.w(TAG, "Gesture cancelled: " + gesture);
            }
        }, null);

        if (!dispatched) {
            Log.e(TAG, "Failed to dispatch gesture: " + gesture);
        }
    }
}
