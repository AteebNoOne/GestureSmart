// android/app/src/main/java/com/ateebnoone/gesturesmart/BootReceiver.java
package com.ateebnoone.gesturesmartv2;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

// import com.ateebnoone.gesturesmart.VoiceBackgroundService;

public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        Log.d(TAG, "Boot receiver triggered with action: " + action);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
                "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
                "com.htc.intent.action.QUICKBOOT_POWERON".equals(action)) {

            // Check if gesture detection was running before shutdown
            SharedPreferences gesturePrefs = context.getSharedPreferences("GestureDetection", Context.MODE_PRIVATE);
            boolean gestureWasRunning = gesturePrefs.getBoolean("service_running", false);

            if (gestureWasRunning) {
                Intent gestureServiceIntent = new Intent(context, GestureService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(gestureServiceIntent);
                } else {
                    context.startService(gestureServiceIntent);
                }
                Log.d(TAG, "Restarted Gesture Service after boot");
            }
        }
    }
}