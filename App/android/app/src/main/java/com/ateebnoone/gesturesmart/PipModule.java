package com.ateebnoone.gesturesmart;

import android.app.Activity;
import android.app.PictureInPictureParams;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Rational;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class PipModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;
    private static final String EVENT_PIP_CHANGE = "onPipModeChanged";

    public PipModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "PipModule";
    }

    @ReactMethod
    public void enterPipMode(Promise promise) {
        Activity currentActivity = getCurrentActivity();
        if (currentActivity == null) {
            promise.reject("ERROR", "Activity is null");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            PackageManager packageManager = currentActivity.getPackageManager();
            if (!packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)) {
                promise.reject("ERROR", "PiP not supported");
                return;
            }

            try {
                // Set fixed aspect ratio for PiP window
                Rational aspectRatio = new Rational(16, 9);
                PictureInPictureParams.Builder params = new PictureInPictureParams.Builder();
                params.setAspectRatio(aspectRatio);

                // Enable auto-enter for Android 12+
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    params.setAutoEnterEnabled(true);
                }

                // Enter PiP mode with custom params
                boolean success = currentActivity.enterPictureInPictureMode(params.build());
                
                if (success) {
                    // Send event to JS
                    sendEvent("true");
                    promise.resolve(true);
                } else {
                    promise.reject("ERROR", "Failed to enter PiP mode");
                }
            } catch (Exception e) {
                promise.reject("ERROR", e.getMessage());
            }
        } else {
            promise.reject("ERROR", "PiP not supported on this Android version");
        }
    }

    private void sendEvent(String pipState) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(EVENT_PIP_CHANGE, pipState);
        }
    }
}