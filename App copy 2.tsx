import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, AppState, Platform, Dimensions } from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import { ExpoWebGLRenderingContext } from 'expo-gl';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import * as tf from '@tensorflow/tfjs';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import '@tensorflow/tfjs-react-native';
import { cameraWithTensors } from '@tensorflow/tfjs-react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { detectGesture, Gesture } from './utils/detectGesture';
import { handleSwipeLeft, handleSwipeRight, handleTap } from './features/actions';
import * as Notifications from 'expo-notifications';
import BackgroundCameraService from './src/services/BackgroundCameraService';
import RNOverlayWindow from 'react-native-overlay-window';

const BACKGROUND_TASK_NAME = 'GESTURE_DETECTION';
const NOTIFICATION_ID = 'gesture-service-notification';

const TensorCamera = cameraWithTensors(Camera);
const OUTPUT_TENSOR_WIDTH = 120;
const OUTPUT_TENSOR_HEIGHT = 160;
const WINDOW_WIDTH = 150;
const WINDOW_HEIGHT = 200;

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
    importance: Notifications.AndroidImportance.HIGH,
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
  const [overlayPermission, setOverlayPermission] = useState(false);
  const [position, setPosition] = useState({
    x: Dimensions.get('window').width - WINDOW_WIDTH - 20,
    y: 100
  });
  const appState = useRef(AppState.currentState);
  const cameraRef = useRef<Camera>();
  const processingRef = useRef<boolean>(false);
  const keepAwakeRef = useRef<boolean>(false);
  const detectorRef = useRef<handPoseDetection.HandDetector | null>(null);

  const [state, setState] = useState<{
    isRunning: boolean;
    isInitialized: boolean;
    status: 'initializing' | 'stopped' | 'running' | 'error';
  }>({
    isRunning: false,
    isInitialized: false,
    status: 'initializing',
  });

  useEffect(() => {
    const setupOverlay = async () => {
      if (Platform.OS === 'android') {
        const hasPermission = await RNOverlayWindow.checkOverlayPermission();
        if (!hasPermission) {
          await RNOverlayWindow.requestOverlayPermission();
        }
        setOverlayPermission(true);
      }
    };

    setupOverlay();
  }, []);


  const showOverlayWindow = async () => {
    if (Platform.OS === 'android' && overlayPermission) {
      await RNOverlayWindow.showOverlay({
        height: WINDOW_HEIGHT,
        width: WINDOW_WIDTH,
        x: position.x,
        y: position.y,
        draggable: true,
        content: (
          <View style={styles.overlayContainer}>
            <TensorCamera
              ref={cameraRef}
              style={styles.overlayCamera}
              type={CameraType.front}
              resizeWidth={OUTPUT_TENSOR_WIDTH}
              resizeHeight={OUTPUT_TENSOR_HEIGHT}
              resizeDepth={3}
              autorender={true}
              onReady={handleCameraStream}
              useCustomShadersToResize={false}
            />
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => RNOverlayWindow.hideOverlay()}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>
        )
      });
    }
  };


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

        // Initialize TensorFlow
        await tf.ready();
        await tf.setBackend('rn-webgl');

        // Configure WebGL for better mobile performance
        tf.env().set('WEBGL_PACK', false);
        tf.env().set('WEBGL_FORCE_F16_TEXTURES', false);
        tf.env().set('WEBGL_FLUSH_THRESHOLD', 1);

        // Initialize hand pose detector with TF.js runtime
        const model = handPoseDetection.SupportedModels.MediaPipeHands;
        const detectorConfig: handPoseDetection.MediaPipeHandsTfjsModelConfig = {
          runtime: 'tfjs',
          modelType: 'lite',
          maxHands: 1,
        };

        detectorRef.current = await handPoseDetection.createDetector(
          model,
          detectorConfig
        );

        // Register background task
        await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK_NAME, {
          minimumInterval: 1,
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
        if (state.isRunning) {
          showForegroundNotification();
        }
      } else if (
        appState.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
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
      if (!processingRef.current || !detectorRef.current) return;

      try {
        const imageTensor = images.next().value;
        if (!imageTensor) return;

        const hands = await detectorRef.current.estimateHands(imageTensor);
        // console.log("Hands?",hands);
        
        if (hands.length > 0) {
          const gestureResult = detectGesture(hands);
          console.log("Gesture:: ",gestureResult)
          // if (gestureResult.gesture !== 'none') {
          //   handleGesture(gestureResult.gesture);
          // }
        }

        tf.dispose(imageTensor);

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
      case 'follow_cursor':
        handleSwipeLeft();
        break;
      case 'close_cursor':
        handleSwipeRight();
        break;
      case 'tap':
        handleTap(0, 0);
        break;

    }
  };

   const toggleService = async () => {
    try {
      if (!state.isRunning) {
        await showOverlayWindow();
        processingRef.current = true;
        await safeActivateKeepAwake();
      } else {
        if (Platform.OS === 'android') {
          await RNOverlayWindow.hideOverlay();
        }
        processingRef.current = false;
        await safeDeactivateKeepAwake();
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
    width: 1,
    height: 1,
    opacity: 0,
  },
  overlayContainer: {
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    backgroundColor: 'black',
    borderRadius: 10,
    overflow: 'hidden',
  },
  overlayCamera: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 24,
    height: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  }
});

export default GestureService;