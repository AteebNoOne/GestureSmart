package com.ateebnoone.gesturesmartv2;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

public class ServiceRestartReceiver extends BroadcastReceiver {
    private static final String TAG = "ServiceRestartReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if ("com.ateebnoone.gesturesmartv2.RESTART_SERVICE".equals(intent.getAction())) {
            Log.i(TAG, "Received service restart request");

            Intent serviceIntent = new Intent(context, GestureService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }

            Log.i(TAG, "GestureService restart initiated");
        }
    }
}