package com.ateebnoone.gesturesmart;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import android.Manifest;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class VoiceBackgroundService extends Service {

    private static final String TAG = "VoiceBackgroundService";
    private static final String CHANNEL_ID = "VoiceServiceChannel";
    private static final int NOTIFICATION_ID = 1001;

    public static final String ACTION_START_SERVICE = "START_VOICE_SERVICE";
    public static final String ACTION_STOP_SERVICE = "STOP_VOICE_SERVICE";

    private static ReactApplicationContext reactContext;
    private AudioRecord audioRecord;
    private Thread recordingThread;
    private boolean isRecording = false;
    private boolean serviceRunning = false;

    // Audio configuration
    private static final int SAMPLE_RATE = 16000;
    private static final int CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO;
    private static final int AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT;
    private int bufferSize;

    public static void setReactContext(ReactApplicationContext context) {
        reactContext = context;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "VoiceBackgroundService created");
        createNotificationChannel();
        initializeAudioRecord();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP_SERVICE.equals(intent.getAction())) {
            stopRecording();
            stopSelf();
            return START_NOT_STICKY;
        }

        Log.d(TAG, "VoiceBackgroundService starting");

        if (!checkPermissions()) {
            Log.e(TAG, "Missing audio permission, stopping service");
            sendStatusEvent("permission_error", "Missing audio recording permission");
            stopSelf();
            return START_NOT_STICKY;
        }

        startForeground(NOTIFICATION_ID, createNotification());
        serviceRunning = true;
        startRecording();

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "VoiceBackgroundService destroyed");
        serviceRunning = false;
        stopRecording();
        sendStatusEvent("stopped", "Background service stopped");
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Voice Command Service",
                    NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Background voice command detection");
            channel.setSound(null, null);
            channel.enableVibration(false);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification createNotification() {
        Intent notificationIntent;
        try {
            notificationIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (notificationIntent == null) {
                notificationIntent = new Intent();
            }
        } catch (Exception e) {
            notificationIntent = new Intent();
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                        : PendingIntent.FLAG_UPDATE_CURRENT);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Voice Commands Active")
                .setContentText("Listening for voice commands in background")
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setSilent(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private boolean checkPermissions() {
        return ActivityCompat.checkSelfPermission(this,
                Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    private void initializeAudioRecord() {
        try {
            bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT);
            if (bufferSize == AudioRecord.ERROR || bufferSize == AudioRecord.ERROR_BAD_VALUE) {
                Log.e(TAG, "Invalid buffer size");
                return;
            }

            // Ensure we have permission before creating AudioRecord
            if (!checkPermissions()) {
                Log.e(TAG, "No audio permission for AudioRecord initialization");
                return;
            }

            audioRecord = new AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    SAMPLE_RATE,
                    CHANNEL_CONFIG,
                    AUDIO_FORMAT,
                    bufferSize * 2);

            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord initialization failed");
                audioRecord = null;
            } else {
                Log.d(TAG, "AudioRecord initialized successfully");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize AudioRecord", e);
            audioRecord = null;
        }
    }

    private void startRecording() {
        if (audioRecord == null || isRecording) {
            return;
        }

        try {
            audioRecord.startRecording();
            isRecording = true;
            sendStatusEvent("recording", "Background recording started");

            recordingThread = new Thread(() -> {
                android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_AUDIO);
                recordAudio();
            });
            recordingThread.start();

            Log.d(TAG, "Background recording started");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start recording", e);
            sendStatusEvent("error", "Failed to start recording: " + e.getMessage());
        }
    }

    private void stopRecording() {
        isRecording = false;

        if (recordingThread != null) {
            try {
                recordingThread.join(1000);
            } catch (InterruptedException e) {
                Log.w(TAG, "Interrupted while waiting for recording thread to finish");
            }
            recordingThread = null;
        }

        if (audioRecord != null) {
            try {
                if (audioRecord.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                    audioRecord.stop();
                }
                audioRecord.release();
            } catch (Exception e) {
                Log.e(TAG, "Error stopping AudioRecord", e);
            } finally {
                audioRecord = null;
            }
        }

        Log.d(TAG, "Background recording stopped");
    }

    private void recordAudio() {
        byte[] audioBuffer = new byte[bufferSize];

        while (isRecording && serviceRunning) {
            try {
                if (audioRecord == null) {
                    break;
                }

                int bytesRead = audioRecord.read(audioBuffer, 0, bufferSize);

                if (bytesRead > 0) {
                    // Process audio data here
                    processAudioData(audioBuffer, bytesRead);
                } else if (bytesRead < 0) {
                    Log.e(TAG, "Error reading audio data: " + bytesRead);
                    break;
                }
            } catch (Exception e) {
                Log.e(TAG, "Error in recording loop", e);
                break;
            }
        }
    }

    private void processAudioData(byte[] audioData, int length) {
        // Basic audio level detection
        long sum = 0;
        for (int i = 0; i < length; i += 2) {
            short sample = (short) ((audioData[i + 1] << 8) | (audioData[i] & 0xFF));
            sum += Math.abs(sample);
        }

        double average = (double) sum / (length / 2);

        // Simple voice activity detection threshold
        if (average > 1000) { // Adjust threshold as needed
            sendAudioEvent("voice_detected", average);
        }
    }

    private void sendAudioEvent(String event, double level) {
        if (reactContext == null) {
            return;
        }

        try {
            WritableMap params = Arguments.createMap();
            params.putString("event", event);
            params.putDouble("level", level);
            params.putDouble("timestamp", System.currentTimeMillis());

            reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit(VoiceServiceModule.EVENT_NAME, params);

        } catch (Exception e) {
            Log.e(TAG, "Failed to send audio event", e);
        }
    }

    private void sendStatusEvent(String status, String message) {
        if (reactContext == null) {
            return;
        }

        try {
            WritableMap params = Arguments.createMap();
            params.putString("status", status);
            params.putString("message", message);
            params.putBoolean("isRecording", isRecording);
            params.putDouble("timestamp", System.currentTimeMillis());

            reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit(VoiceServiceModule.STATUS_EVENT_NAME, params);

        } catch (Exception e) {
            Log.e(TAG, "Failed to send status event", e);
        }
    }
}