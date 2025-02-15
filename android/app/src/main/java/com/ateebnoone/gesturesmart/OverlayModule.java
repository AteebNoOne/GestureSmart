// Create this file: android/app/src/main/java/com/yourapp/OverlayModule.java

package com.ateebnoone.gesturesmart;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

public class OverlayModule extends ReactContextBaseJavaModule {
    private static final int OVERLAY_PERMISSION_CODE = 1234;
    private final ReactApplicationContext reactContext;

    public OverlayModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "OverlayModule";
    }

    @ReactMethod
    public void checkOverlayPermission(Promise promise) {
        if (Settings.canDrawOverlays(reactContext)) {
            promise.resolve(true);
        } else {
            promise.resolve(false);
        }
    }

    @ReactMethod
    public void requestOverlayPermission(Promise promise) {
        Intent intent = new Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + reactContext.getPackageName())
        );
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        reactContext.startActivity(intent);
        promise.resolve(null);
    }

    @ReactMethod
    public void startOverlayService() {
        Intent intent = new Intent(reactContext, OverlayService.class);
        reactContext.startService(intent);
    }

    @ReactMethod
    public void stopOverlayService() {
        Intent intent = new Intent(reactContext, OverlayService.class);
        reactContext.stopService(intent);
    }
}