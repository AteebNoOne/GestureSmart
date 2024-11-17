package com.ateebnoone.gesturesmart;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.graphics.Path;
import android.graphics.Point;
import android.view.Display;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.os.Handler;
import android.os.Looper;

public class GestureAccessibilityService extends AccessibilityService {
    private static GestureAccessibilityService instance;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {}

    @Override
    public void onInterrupt() {}

    public static GestureAccessibilityService getInstance() {
        return instance;
    }

    public void performSwipeLeft() {
        WindowManager wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        Display display = wm.getDefaultDisplay();
        Point size = new Point();
        display.getSize(size);

        int width = size.x;
        int height = size.y;

        Path swipePath = new Path();
        swipePath.moveTo(width * 0.8f, height / 2);
        swipePath.lineTo(width * 0.2f, height / 2);

        GestureDescription.Builder gestureBuilder = new GestureDescription.Builder();
        gestureBuilder.addStroke(new GestureDescription.StrokeDescription(swipePath, 0, 500));

        dispatchGesture(gestureBuilder.build(), null, null);
    }

    public void performSwipeRight() {
        WindowManager wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        Display display = wm.getDefaultDisplay();
        Point size = new Point();
        display.getSize(size);

        int width = size.x;
        int height = size.y;

        Path swipePath = new Path();
        swipePath.moveTo(width * 0.2f, height / 2);
        swipePath.lineTo(width * 0.8f, height / 2);

        GestureDescription.Builder gestureBuilder = new GestureDescription.Builder();
        gestureBuilder.addStroke(new GestureDescription.StrokeDescription(swipePath, 0, 500));

        dispatchGesture(gestureBuilder.build(), null, null);
    }

    public void performTap(float x, float y) {
        Path tapPath = new Path();
        tapPath.moveTo(x, y);
        tapPath.lineTo(x, y);

        GestureDescription.Builder gestureBuilder = new GestureDescription.Builder();
        gestureBuilder.addStroke(new GestureDescription.StrokeDescription(tapPath, 0, 100));

        dispatchGesture(gestureBuilder.build(), null, null);
    }
}