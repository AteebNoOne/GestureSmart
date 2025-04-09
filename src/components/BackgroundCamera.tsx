import React, { useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { Camera, CameraCapturedPicture } from 'expo-camera';
import * as BackgroundTasks from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';

const BACKGROUND_TASK_NAME = 'BACKGROUND_CAMERA';
const PREVIEW_SIZE = 200; // Minimal but visible size to comply with App Store

// Register background task
TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
  try {
    // Background processing will trigger captures
    return BackgroundTasks.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background task error:', error);
    return BackgroundTasks.BackgroundFetchResult.Failed;
  }
});

interface BackgroundCameraProps {
  onCapture?: (data: string) => void;
  enabled: boolean;
  captureInterval?: number; // Time in milliseconds between captures
}

const BackgroundCamera: React.FC<BackgroundCameraProps> = ({ 
  onCapture, 
  enabled,
  captureInterval = 1000 // Default to 1 second
}) => {
  const cameraRef = useRef<Camera>(null);
  const appState = useRef(AppState.currentState);
  const captureTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const startCapturing = () => {
    if (!isCapturing && enabled) {
      setIsCapturing(true);
      scheduleCaptureTimer();
    }
  };

  const stopCapturing = () => {
    setIsCapturing(false);
    if (captureTimerRef.current) {
      clearTimeout(captureTimerRef.current);
      captureTimerRef.current = null;
    }
  };

  const scheduleCaptureTimer = () => {
    if (captureTimerRef.current) {
      clearTimeout(captureTimerRef.current);
    }

    captureTimerRef.current = setTimeout(async () => {
      await captureImage();
      if (isCapturing) {
        scheduleCaptureTimer();
      }
    }, captureInterval);
  };

  const captureImage = async () => {
    if (!cameraRef.current || !enabled || !isCapturing) return;

    try {
      const photo: CameraCapturedPicture = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: true,
        exif: false,
      });

      if (onCapture && photo.base64) {
        onCapture(photo.base64);
      }
    } catch (error) {
      console.error('Capture error:', error);
    }
  };
  
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        // Request permissions
        const { status } = await Camera.requestCameraPermissionsAsync();
        if (isMounted) {
          setHasPermission(status === 'granted');
        }

        // Register background task
        await BackgroundTasks.registerTaskAsync(BACKGROUND_TASK_NAME, {
          minimumInterval: 1,
          stopOnTerminate: false,
          startOnBoot: true,
        });

        // Configure foreground notification for Android
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('background-camera', {
            name: 'Background Camera',
            importance: Notifications.AndroidImportance.LOW,
            vibrationPattern: [0, 0, 0],
            lightColor: '#FF231F7C',
          });
        }
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };

    initialize();

    // Handle app state changes
    const subscription = AppState.addEventListener('change', (nextAppState:AppState) => {
      const currentState = appState.current;
      appState.current = nextAppState;

      if (
        currentState.match(/inactive|background/) &&
        nextAppState === 'active' &&
        enabled
      ) {
        resumeCamera();
      } else if (
        currentState === 'active' &&
        nextAppState.match(/inactive|background/) &&
        enabled
      ) {
        handleBackgroundMode();
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
      stopCapturing();
    };
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      startCapturing();
    } else {
      stopCapturing();
    }
  }, [enabled]);

  const resumeCamera = async () => {
    if (!cameraRef.current || !enabled) return;
    
    try {
      await cameraRef.current.resumePreview();
      startCapturing();
    } catch (error) {
      console.error('Resume camera error:', error);
    }
  };

  const handleBackgroundMode = async () => {
    if (!cameraRef.current || !enabled) return;

    try {
      if (Platform.OS === 'android') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Camera Active',
            body: 'Camera is running in background mode',
            priority: 'low',
          },
          trigger: null,
        });
      }
    } catch (error) {
      console.error('Background mode error:', error);
    }
  };

  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 0,
      right: 0,
    },
    preview: {
      width: PREVIEW_SIZE,
      height: PREVIEW_SIZE,
    },
  });

  if (hasPermission === null || !enabled) {
    return null;
  }

  if (hasPermission === false) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={styles.preview}
        type={"front"}
      />
    </View>
  );
};

export default BackgroundCamera;