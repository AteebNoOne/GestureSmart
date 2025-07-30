// android/app/src/main/java/com/ateebnoone/gesturesmart/BootReceiver.java
package com.ateebnoone.gesturesmart;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

// import com.ateebnoone.gesturesmart.voicesservices.VoiceBackgroundService;
import com.ateebnoone.gesturesmart.VoiceBackgroundService;

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

            // Check if voice service was running before shutdown
            SharedPreferences voicePrefs = context.getSharedPreferences("VoiceServicePrefs", Context.MODE_PRIVATE);
            boolean voiceWasRunning = voicePrefs.getBoolean("service_running", false);

            if (voiceWasRunning) {
                Intent voiceServiceIntent = new Intent(context, VoiceBackgroundService.class);
                voiceServiceIntent.setAction(VoiceBackgroundService.ACTION_START_SERVICE);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(voiceServiceIntent);
                } else {
                    context.startService(voiceServiceIntent);
                }
                Log.d(TAG, "Restarted Voice Service after boot");
            }
        }
    }
}