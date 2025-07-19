package com.ateebnoone.gesturesmart;

import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Log;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class GestureModule extends ReactContextBaseJavaModule {
    
    private static final String TAG = "GestureModule";
    private final ReactApplicationContext reactContext;
    
    public GestureModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }
    
    @NonNull
    @Override
    public String getName() {
        return "GestureModule";
    }
    
    @ReactMethod
    public void checkAccessibilityPermission(Promise promise) {
        try {
            boolean isEnabled = isAccessibilityServiceEnabled();
            promise.resolve(isEnabled);
        } catch (Exception e) {
            Log.e(TAG, "Error checking accessibility permission", e);
            promise.reject("PERMISSION_CHECK_ERROR", e.getMessage());
        }
    }
    
    @ReactMethod
    public void openAccessibilitySettings(Promise promise) {
        try {
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Error opening accessibility settings", e);
            promise.reject("SETTINGS_ERROR", e.getMessage());
        }
    }
    
    @ReactMethod
    public void sendGesture(String gesture) {
        try {
            Intent intent = new Intent("PERFORM_GESTURE");
            intent.putExtra("gesture", gesture);
            reactContext.sendBroadcast(intent);
            Log.d(TAG, "Sent gesture: " + gesture);
        } catch (Exception e) {
            Log.e(TAG, "Error sending gesture", e);
        }
    }
    
    @ReactMethod
    public void startGestureService() {
        try {
            Intent intent = new Intent("START_GESTURE_SERVICE");
            reactContext.sendBroadcast(intent);
            Log.d(TAG, "Started gesture service");
        } catch (Exception e) {
            Log.e(TAG, "Error starting gesture service", e);
        }
    }
    
    @ReactMethod
    public void stopGestureService() {
        try {
            Intent intent = new Intent("STOP_GESTURE_SERVICE");
            reactContext.sendBroadcast(intent);
            Log.d(TAG, "Stopped gesture service");
        } catch (Exception e) {
            Log.e(TAG, "Error stopping gesture service", e);
        }
    }
    
    private boolean isAccessibilityServiceEnabled() {
        int accessibilityEnabled = 0;
        final String service = reactContext.getPackageName() + "/" + GestureAccessibilityService.class.getCanonicalName();
        
        try {
            accessibilityEnabled = Settings.Secure.getInt(
                reactContext.getContentResolver(),
                Settings.Secure.ACCESSIBILITY_ENABLED
            );
        } catch (Settings.SettingNotFoundException e) {
            Log.e(TAG, "Error finding accessibility setting: " + e.getMessage());
        }
        
        TextUtils.SimpleStringSplitter mStringColonSplitter = new TextUtils.SimpleStringSplitter(':');
        
        if (accessibilityEnabled == 1) {
            String settingValue = Settings.Secure.getString(
                reactContext.getContentResolver(),
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            );
            
            if (settingValue != null) {
                mStringColonSplitter.setString(settingValue);
                while (mStringColonSplitter.hasNext()) {
                    String accessibilityService = mStringColonSplitter.next();
                    if (accessibilityService.equalsIgnoreCase(service)) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
}