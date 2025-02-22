import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, AppState, Platform } from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import { ExpoWebGLRenderingContext } from 'expo-gl';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';
import * as handdetection from '@tensorflow-models/hand-pose-detection';
import '@tensorflow/tfjs-react-native';
import { cameraWithTensors } from '@tensorflow/tfjs-react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { detectGesture, Gesture } from './src/utils/detectGesture';
import { handleSwipeLeft, handleSwipeRight, handleTap, handleWave } from './src/features/actions';
import * as Notifications from 'expo-notifications';
const BACKGROUND_TASK_NAME = 'GESTURE_DETECTION';
const NOTIFICATION_ID = 'gesture-service-notification';

const TensorCamera = cameraWithTensors(Camera);
const OUTPUT_TENSOR_WIDTH = 120;
const OUTPUT_TENSOR_HEIGHT = 160;
const PROCESS_INTERVAL = 10;
const CONFIDENCE_THRESHOLD = 0.8;

// Configure foreground notification
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Register background task with proper error handling
TaskManager.defineTask(BACKGROUND_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }

  try {
    // Keep the service alive
    await showForegroundNotification();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (e) {
    console.error('Background task execution error:', e);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

const showForegroundNotification = async () => {
  await Notifications.setNotificationChannelAsync('gesture-service', {
    name: 'Gesture Service',
    importance: Notifications.AndroidImportance.LOW,
    vibrationPattern: [0, 0, 0],
    lightColor: '#FF231F7C',
  });

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Gesture Service Active',
      body: 'Running in background mode',
      priority: 'low',
    },
    trigger: null,
    identifier: NOTIFICATION_ID,
  });
};

const GestureService: React.FC = () => {
  const appState = useRef(AppState.currentState);
  const cameraRef = useRef<Camera>();
  const processingRef = useRef<boolean>(false);
  const keepAwakeRef = useRef<boolean>(false);
  const modelRef = useRef<handpose.HandPose | null>(null);

  const [state, setState] = useState<{
    isRunning: boolean;
    isInitialized: boolean;
    status: 'initializing' | 'stopped' | 'running' | 'error';
  }>({
    isRunning: false,
    isInitialized: false,
    status: 'initializing',
  });

  // Initialize TensorFlow and permissions
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        // Request necessary permissions
        const [cameraPermission] = await Promise.all([
          Camera.requestCameraPermissionsAsync(),
          Platform.OS === 'android'
            ? Notifications.requestPermissionsAsync()
            : Promise.resolve({ status: 'granted' })
        ]);

        if (cameraPermission.status !== 'granted') {
          throw new Error('Camera permission required');
        }
        await tf.setBackend('rn-webgl');

        // Initialize TensorFlow and model
        await tf.ready();


        // Configure WebGL for better mobile performance
        tf.env().set('WEBGL_PACK', false); // Set to false for React Native
        tf.env().set('WEBGL_FORCE_F16_TEXTURES', false);


        // Configure WebGL for better mobile performance
        tf.env().set('WEBGL_PACK', true);
        tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
        tf.env().set('WEBGL_FLUSH_THRESHOLD', 1);
        // Load lite model with optimized settings
        modelRef.current = await handpose.load({
          maxContinuousChecks: 5, // Reduced from default
          detectionConfidence: 0.7, // Slightly reduced for better performance
          iouThreshold: 0.3, // Adjusted for mobile
          scoreThreshold: 0.75,
        });

        // Register background task
        await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK_NAME, {
          minimumInterval: 1, // 1 second
          stopOnTerminate: false,
          startOnBoot: true,
        });

        if (mounted) {
          setState(prev => ({
            ...prev,
            isInitialized: true,
            status: 'stopped'
          }));
        }
      } catch (error) {
        console.error('Initialization failed:', error);
        if (mounted) {
          setState(prev => ({
            ...prev,
            status: 'error',
          }));
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
      safeDeactivateKeepAwake();
    };
  }, []);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to foreground
        if (state.isRunning) {
          showForegroundNotification();
        }
      } else if (
        appState.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        // App has gone to background
        if (state.isRunning) {
          processingRef.current = true;
          showForegroundNotification();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [state.isRunning]);

  const safeActivateKeepAwake = async () => {
    if (!keepAwakeRef.current) {
      await activateKeepAwake();
      keepAwakeRef.current = true;
    }
  };

  const safeDeactivateKeepAwake = async () => {
    if (keepAwakeRef.current) {
      await deactivateKeepAwake();
      keepAwakeRef.current = false;
    }
  };

  const handleCameraStream = async (
    images: IterableIterator<tf.Tensor3D>,
    updatePreview: () => void,
    gl: ExpoWebGLRenderingContext
  ) => {
    const processFrame = async () => {
      if (!processingRef.current || !modelRef.current) return;

      try {
        const imageTensor = images.next().value;
        if (!imageTensor) return;

        const predictions = await modelRef.current.estimateHands(imageTensor);
        
        if (predictions.length > 0) {
          const result = detectGesture(predictions[0].landmarks);
          console.log("Pred", result)
          // if (result.confidence > CONFIDENCE_THRESHOLD) {

          //   handleGesture(result.gesture);
          // }
        }

        tf.dispose(imageTensor);

        // Continue processing frames
        if (processingRef.current) {
          requestAnimationFrame(processFrame);
        }
      } catch (error) {
        console.error('Frame processing error:', error);
        if (processingRef.current) {
          requestAnimationFrame(processFrame);
        }
      }
    };

    processFrame();
  };

  const handleGesture = (gesture: Gesture) => {
    switch (gesture) {
      case 'swipe_left':
        handleSwipeLeft();
        break;
      case 'swipe_right':
        handleSwipeRight();
        break;
      case 'tap':
        handleTap(0, 0);
        break;
      case 'wave':
        handleWave();
        break;
    }
  };

  const toggleService = async () => {
    try {
      if (!state.isRunning) {
        await showForegroundNotification();
        await safeActivateKeepAwake();
        processingRef.current = true;
      } else {
        await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
        await safeDeactivateKeepAwake();
        processingRef.current = false;
      }

      setState(prev => ({
        ...prev,
        isRunning: !prev.isRunning,
        status: !prev.isRunning ? 'running' : 'stopped'
      }));
    } catch (error) {
      console.error('Error toggling service:', error);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, state.isRunning ? styles.buttonStop : styles.buttonStart]}
        onPress={toggleService}
      >
        <Text style={styles.buttonText}>
          {state.isRunning ? 'Stop Gesture Service' : 'Start Gesture Service'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.status}>
        Status: {state.status.charAt(0).toUpperCase() + state.status.slice(1)}
      </Text>

      {state.isRunning && (
        <TensorCamera
          ref={cameraRef}
          style={styles.camera}
          type={CameraType.front}
          resizeWidth={OUTPUT_TENSOR_WIDTH}
          resizeHeight={OUTPUT_TENSOR_HEIGHT}
          resizeDepth={3}
          autorender={true}
          onReady={handleCameraStream}
          useCustomShadersToResize={false}
          cameraTextureWidth={1}
          cameraTextureHeight={1}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  button: {
    padding: 20,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  buttonStart: {
    backgroundColor: '#4CAF50',
  },
  buttonStop: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  status: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  camera: {
    width: 200,
    height: 200,
    opacity: 0,
  },
});

export default GestureService;