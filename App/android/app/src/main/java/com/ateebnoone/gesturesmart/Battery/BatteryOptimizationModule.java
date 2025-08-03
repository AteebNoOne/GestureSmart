package com.ateebnoone.gesturesmart;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class BatteryOptimizationModule extends ReactContextBaseJavaModule {
    private static final String TAG = "BatteryOptimizationModule";
    private final ReactApplicationContext reactContext;

    public BatteryOptimizationModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @Override
    public String getName() {
        return "BatteryOptimization";
    }

    @ReactMethod
    public void checkBatteryOptimization(Promise promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager powerManager = (PowerManager) reactContext.getSystemService(Context.POWER_SERVICE);
                String packageName = reactContext.getPackageName();
                boolean isIgnoring = powerManager.isIgnoringBatteryOptimizations(packageName);
                promise.resolve(isIgnoring);
            } else {
                promise.resolve(true); // No battery optimization on older versions
            }
        } catch (Exception e) {
            Log.e(TAG, "Error checking battery optimization: " + e.getMessage());
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void requestIgnoreBatteryOptimization(Promise promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager powerManager = (PowerManager) reactContext.getSystemService(Context.POWER_SERVICE);
                String packageName = reactContext.getPackageName();

                if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + packageName));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    reactContext.startActivity(intent);
                    promise.resolve("Battery optimization dialog opened");
                } else {
                    promise.resolve("Already ignoring battery optimization");
                }
            } else {
                promise.resolve("Not needed on this Android version");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error requesting battery optimization exemption: " + e.getMessage());
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void openAutoStartSettings(Promise promise) {
        try {
            // Try to open auto-start settings for different manufacturers
            Intent intent = null;
            String manufacturer = Build.MANUFACTURER.toLowerCase();

            switch (manufacturer) {
                case "xiaomi":
                    intent = new Intent("miui.intent.action.OP_AUTO_START");
                    intent.addCategory(Intent.CATEGORY_DEFAULT);
                    break;
                case "huawei":
                case "honor":
                    intent = new Intent("huawei.intent.action.HSM_BOOTAPP_MANAGER");
                    break;
                case "oppo":
                    intent = new Intent("com.oppo.safe");
                    intent.setClassName("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity");
                    break;
                case "vivo":
                    intent = new Intent("com.iqoo.secure");
                    intent.setClassName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity");
                    break;
                case "oneplus":
                    intent = new Intent("com.oneplus.security");
                    intent.setClassName("com.oneplus.security",
                            "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity");
                    break;
                default:
                    // Fallback to general app settings
                    intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    intent.setData(Uri.parse("package:" + reactContext.getPackageName()));
                    break;
            }

            if (intent != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                reactContext.startActivity(intent);
                promise.resolve("Auto-start settings opened for " + manufacturer);
            } else {
                promise.reject("ERROR", "Could not open auto-start settings for " + manufacturer);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error opening auto-start settings: " + e.getMessage());
            try {
                // Fallback to app settings
                Intent fallbackIntent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallbackIntent.setData(Uri.parse("package:" + reactContext.getPackageName()));
                fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                reactContext.startActivity(fallbackIntent);
                promise.resolve("Opened app settings as fallback");
            } catch (Exception fallbackError) {
                promise.reject("ERROR", "Could not open any settings: " + fallbackError.getMessage());
            }
        }
    }

    @ReactMethod
    public void openNotificationSettings(Promise promise) {
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, reactContext.getPackageName());
            } else {
                intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + reactContext.getPackageName()));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(intent);
            promise.resolve("Notification settings opened");
        } catch (Exception e) {
            Log.e(TAG, "Error opening notification settings: " + e.getMessage());
            promise.reject("ERROR", e.getMessage());
        }
    }
}