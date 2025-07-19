// android/app/src/main/java/com/yourapp/BootReceiver.java
package com.ateebnoone.gesturesmart;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            // Check if gesture detection was running before shutdown
            SharedPreferences prefs = context.getSharedPreferences("GestureDetection", Context.MODE_PRIVATE);
            boolean wasRunning = prefs.getBoolean("service_running", false);
            
            if (wasRunning) {
                Intent serviceIntent = new Intent(context, GestureDetectionService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            }
        }
    }
}