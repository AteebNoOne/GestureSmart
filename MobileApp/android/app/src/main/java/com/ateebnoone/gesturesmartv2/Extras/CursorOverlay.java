package com.ateebnoone.gesturesmartv2;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;

public class CursorOverlay {
    private static final String TAG = "CursorOverlay";
    private Context context;
    private WindowManager windowManager;
    private View cursorView;
    private WindowManager.LayoutParams layoutParams;
    private boolean isShowing = false;
    private float currentX;
    private float currentY;
    private DisplayMetrics displayMetrics;
    private Handler mainHandler;

    // Cursor appearance settings
    private static final int CURSOR_SIZE = 60; // Size of cursor in pixels
    private static final int CURSOR_COLOR = 0xFF00FF00; // Green color
    private static final int CURSOR_BORDER_COLOR = 0xFF000000; // Black border
    private static final int CURSOR_BORDER_WIDTH = 4;

    public CursorOverlay(Context context) {
        this.context = context;
        this.windowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
        this.mainHandler = new Handler(Looper.getMainLooper());

        // Get display metrics
        displayMetrics = new DisplayMetrics();
        windowManager.getDefaultDisplay().getMetrics(displayMetrics);

        // Initialize cursor at center of screen
        currentX = displayMetrics.widthPixels / 2f;
        currentY = displayMetrics.heightPixels / 2f;

        setupCursorView();
    }

    private void setupCursorView() {
        cursorView = new View(context) {
            @Override
            protected void onDraw(Canvas canvas) {
                super.onDraw(canvas);

                // Draw cursor circle with border
                Paint borderPaint = new Paint();
                borderPaint.setColor(CURSOR_BORDER_COLOR);
                borderPaint.setStyle(Paint.Style.FILL);
                borderPaint.setAntiAlias(true);

                Paint cursorPaint = new Paint();
                cursorPaint.setColor(CURSOR_COLOR);
                cursorPaint.setStyle(Paint.Style.FILL);
                cursorPaint.setAntiAlias(true);

                float centerX = getWidth() / 2f;
                float centerY = getHeight() / 2f;
                float radius = CURSOR_SIZE / 2f;

                // Draw border (slightly larger circle)
                canvas.drawCircle(centerX, centerY, radius, borderPaint);

                // Draw cursor (inner circle)
                canvas.drawCircle(centerX, centerY, radius - CURSOR_BORDER_WIDTH, cursorPaint);

                // Draw crosshair
                Paint crosshairPaint = new Paint();
                crosshairPaint.setColor(CURSOR_BORDER_COLOR);
                crosshairPaint.setStrokeWidth(3);
                crosshairPaint.setAntiAlias(true);

                // Horizontal line
                canvas.drawLine(centerX - radius / 2, centerY, centerX + radius / 2, centerY, crosshairPaint);
                // Vertical line
                canvas.drawLine(centerX, centerY - radius / 2, centerX, centerY + radius / 2, crosshairPaint);
            }
        };

        // Set up layout parameters for overlay window
        int layoutFlag;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            layoutFlag = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
        } else {
            layoutFlag = WindowManager.LayoutParams.TYPE_PHONE;
        }

        layoutParams = new WindowManager.LayoutParams(
                CURSOR_SIZE,
                CURSOR_SIZE,
                layoutFlag,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                        WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE |
                        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);

        layoutParams.gravity = Gravity.TOP | Gravity.LEFT;
        layoutParams.x = (int) (currentX - CURSOR_SIZE / 2);
        layoutParams.y = (int) (currentY - CURSOR_SIZE / 2);
    }

    public boolean show() {
        if (isShowing) {
            Log.w(TAG, "Cursor overlay is already showing");
            return true;
        }

        try {
            // Check for overlay permission
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (!Settings.canDrawOverlays(context)) {
                    Log.e(TAG, "Overlay permission not granted");
                    return false;
                }
            }

            Log.d(TAG, "Showing cursor overlay with size: " + CURSOR_SIZE +
                    ", Initial position: (" + layoutParams.x + ", " + layoutParams.y + ")" +
                    ", Screen size: " + displayMetrics.widthPixels + "x" + displayMetrics.heightPixels);

            windowManager.addView(cursorView, layoutParams);
            isShowing = true;
            Log.i(TAG, "Cursor overlay shown at position: (" + currentX + ", " + currentY + ")");
            return true;

        } catch (Exception e) {
            Log.e(TAG, "Failed to show cursor overlay: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }

    public void hide() {
        if (!isShowing) {
            Log.w(TAG, "Cursor overlay is not showing");
            return;
        }

        try {
            windowManager.removeView(cursorView);
            isShowing = false;
            Log.i(TAG, "Cursor overlay hidden");
        } catch (Exception e) {
            Log.e(TAG, "Failed to hide cursor overlay: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public void updatePosition(float normalizedX, float normalizedY) {
        // Ensure we're on the main thread for UI updates
        mainHandler.post(() -> {
            try {
                if (!isShowing) {
                    Log.w(TAG, "Cursor not showing, skipping position update");
                    return;
                }

                // Convert normalized coordinates (0.0 - 1.0) to screen pixels
                float screenX = normalizedX * displayMetrics.widthPixels;
                float screenY = normalizedY * displayMetrics.heightPixels;

                // Ensure cursor stays within screen bounds with margin
                float margin = CURSOR_SIZE / 2f;
                screenX = Math.max(margin, Math.min(screenX, displayMetrics.widthPixels - margin));
                screenY = Math.max(margin, Math.min(screenY, displayMetrics.heightPixels - margin));

                Log.d(TAG, String.format("Updating cursor - Input: (%.3f, %.3f), Screen: (%.1f, %.1f)",
                        normalizedX, normalizedY, screenX, screenY));

                // Store current position
                currentX = screenX;
                currentY = screenY;

                // Update layout parameters - position the cursor center at the coordinates
                int newX = (int) (screenX - CURSOR_SIZE / 2);
                int newY = (int) (screenY - CURSOR_SIZE / 2);

                // Only update if position actually changed
                if (layoutParams.x != newX || layoutParams.y != newY) {
                    layoutParams.x = newX;
                    layoutParams.y = newY;

                    try {
                        windowManager.updateViewLayout(cursorView, layoutParams);
                        Log.v(TAG, String.format("Position updated to layout(%d, %d)", layoutParams.x, layoutParams.y));
                    } catch (Exception e) {
                        Log.e(TAG, "Error updating view layout: " + e.getMessage());
                        // Try to recover by re-showing the cursor
                        if (isShowing) {
                            hide();
                            show();
                        }
                    }
                } else {
                    Log.v(TAG, "Position unchanged, skipping update");
                }

            } catch (Exception e) {
                Log.e(TAG, "Failed to update cursor position: " + e.getMessage());
                e.printStackTrace();
            }
        });
    }

    // Test method to move cursor in a pattern - useful for debugging
    public void testMovement() {
        mainHandler.post(() -> {
            Log.i(TAG, "Starting test movement");

            // Move to different corners to test
            updatePosition(0.1f, 0.1f); // Top-left

            mainHandler.postDelayed(() -> updatePosition(0.9f, 0.1f), 1000); // Top-right
            mainHandler.postDelayed(() -> updatePosition(0.9f, 0.9f), 2000); // Bottom-right
            mainHandler.postDelayed(() -> updatePosition(0.1f, 0.9f), 3000); // Bottom-left
            mainHandler.postDelayed(() -> updatePosition(0.5f, 0.5f), 4000); // Center
        });
    }

    public float[] getCurrentPosition() {
        return new float[] { currentX, currentY };
    }

    public boolean isShowing() {
        return isShowing;
    }

    // Cleanup method
    public void destroy() {
        if (isShowing) {
            hide();
        }
        if (mainHandler != null) {
            mainHandler.removeCallbacksAndMessages(null);
        }
    }
}