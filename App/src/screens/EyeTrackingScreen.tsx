import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  AppState,
  Animated,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import * as Speech from 'expo-speech';
import { Camera } from 'expo-camera';
import * as tf from '@tensorflow/tfjs';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { cameraWithTensors } from '@tensorflow/tfjs-react-native';
import * as Notifications from 'expo-notifications';
import { responsiveFontSize, responsiveHeight, responsiveWidth } from 'react-native-responsive-dimensions';
import { useTheme } from '../hooks/useTheme';
import { typography } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';

// Create a camera component that can be used with TensorFlow
const TensorCamera = cameraWithTensors(Camera);

interface EyeCommandConfig {
  [key: string]: {
    label: string;
    imagePath: any;
    action: () => void;
  };
}

const BACKGROUND_TASK_NAME = 'EYE_TRACKING';
const NOTIFICATION_ID = 'eye-tracking-service-notification';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Register background task
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
  await Notifications.setNotificationChannelAsync('eye-tracking-service', {
    name: 'Eye Tracking Service',
    importance: Notifications.AndroidImportance.LOW,
    vibrationPattern: [0, 0, 0],
    lightColor: '#FF231F7C',
  });

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Eye Tracking Service Active',
      body: 'Running in background mode',
      priority: 'low',
    },
    trigger: null,
    identifier: NOTIFICATION_ID,
  });
};

interface EyeTrackingScreenProps {
  navigation: NavigationProp<any>;
}

const EyeTrackingService: React.FC<EyeTrackingScreenProps> = ({ navigation }) => {
  const appState = useRef(AppState.currentState);
  const processingRef = useRef<boolean>(false);
  const keepAwakeRef = useRef<boolean>(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { colors } = useTheme();
  const cameraRef = useRef(null);

  const [currentCommand, setCurrentCommand] = useState<string>('none');
  const [isTracking, setIsTracking] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [model, setModel] = useState<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const [tensorflowReady, setTensorflowReady] = useState(false);
  const [lastBlink, setLastBlink] = useState(0);
  const [lastLeftGaze, setLastLeftGaze] = useState(0);
  const [lastRightGaze, setLastRightGaze] = useState(0);
  const [eyeState, setEyeState] = useState('neutral');

  const [state, setState] = useState<{
    isRunning: boolean;
    isInitialized: boolean;
    status: 'initializing' | 'stopped' | 'running' | 'error';
  }>({
    isRunning: false,
    isInitialized: false,
    status: 'initializing',
  });
  const isRunningRef = useRef(state.isRunning);

  const eyeCommandConfigs: EyeCommandConfig = {
    'blink': {
      label: 'Blink',
      imagePath: require('../assets/gestures/blink.jpg'),
      action: () => console.log('Blink detected')
    },
    'look left': {
      label: 'Look Left',
      imagePath: require('../assets/gestures/look_left.jpg'),
      action: () => console.log('Looking left')
    },
    'look right': {
      label: 'Look Right',
      imagePath: require('../assets/gestures/look_right.jpg'),
      action: () => console.log('Looking right')
    },
    'wink left': {
      label: 'Wink Left',
      imagePath: require('../assets/gestures/wink_left.jpg'),
      action: () => console.log('Wink left')
    },
    'wink right': {
      label: 'Wink Right',
      imagePath: require('../assets/gestures/wink_right.jpg'),
      action: () => console.log('Wink right')
    }
  };

  useEffect(() => {
    isRunningRef.current = state.isRunning;
  }, [state.isRunning]);

  // Initialize TensorFlow and face landmarks model
  useEffect(() => {
    const initializeTensorFlow = async () => {
      try {
        // Request camera permissions
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasCameraPermission(status === 'granted');

        if (status !== 'granted') {
          setState(prev => ({
            ...prev,
            status: 'error'
          }));
          return;
        }
        await tf.setBackend('rn-webgl');
        await tf.ready();
        // Initialize TensorFlow
        await tf.ready();
        setTensorflowReady(true);

        try {
          console.log('Loading face model...');
          // Change this in your initializeTensorFlow function
          const faceModel = await faceLandmarksDetection.createDetector(
            faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
            {
              runtime: 'mediapipe', // Change from 'tfjs' to 'mediapipe'
              solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
              maxFaces: 1,
              refineLandmarks: true
            }
          );
          console.log('Face model loaded successfully');
          setModel(faceModel);
        } catch (e) {
          console.error('Error loading face model:', e);

        }

        setState(prev => ({
          ...prev,
          isInitialized: true,
          status: 'stopped'
        }));
      } catch (e) {
        console.error('Error initializing TensorFlow:', e);
        setState(prev => ({
          ...prev,
          status: 'error'
        }));
      }
    };

    initializeTensorFlow();

    return () => {
      // Cleanup
      if (model) {
        model.dispose();
      }
    };
  }, []);

  // Handle camera tensor processing
  const handleCameraStream = (images: IterableIterator<tf.Tensor3D>) => {
    const loop = async () => {
      if (!isRunningRef.current || !model) {
        requestAnimationFrame(loop);
        return;
      }

      const image = images.next().value;
      if (!image) {
        requestAnimationFrame(loop);
        return;
      }

      try {
        // Get face predictions
        const predictions = await model.estimateFaces({
          input: image,
          flipHorizontal: true,
          predictIrises: true
        });

        // Process face landmarks if found
        if (predictions.length > 0) {
          setIsTracking(true);

          const face = predictions[0];
          const landmarks = face.keypoints;

          // Extract eye landmarks
          // Left eye points (typically around indices 130-159)
          const leftEyeTop = landmarks[159];
          const leftEyeBottom = landmarks[145];
          const leftEyeLeft = landmarks[133];
          const leftEyeRight = landmarks[173];

          // Right eye points (typically around indices 385-414)
          const rightEyeTop = landmarks[386];
          const rightEyeBottom = landmarks[374];
          const rightEyeLeft = landmarks[362];
          const rightEyeRight = landmarks[263];

          // Iris positions for gaze detection
          const leftIris = landmarks.find(point => point.name === 'leftEyeIris');
          const rightIris = landmarks.find(point => point.name === 'rightEyeIris');

          // Calculate eye aspect ratios for blink detection
          const leftEyeHeight = Math.abs(leftEyeTop.y - leftEyeBottom.y);
          const leftEyeWidth = Math.abs(leftEyeLeft.x - leftEyeRight.x);
          const leftEAR = leftEyeHeight / leftEyeWidth;

          const rightEyeHeight = Math.abs(rightEyeTop.y - rightEyeBottom.y);
          const rightEyeWidth = Math.abs(rightEyeLeft.x - rightEyeRight.x);
          const rightEAR = rightEyeHeight / rightEyeWidth;

          // Calculate relative iris positions for gaze detection
          const leftEyeCenterX = (leftEyeLeft.x + leftEyeRight.x) / 2;
          const leftIrisOffset = leftIris ? (leftIris.x - leftEyeCenterX) / leftEyeWidth : 0;

          const rightEyeCenterX = (rightEyeLeft.x + rightEyeRight.x) / 2;
          const rightIrisOffset = rightIris ? (rightIris.x - rightEyeCenterX) / rightEyeWidth : 0;

          const averageIrisOffset = (leftIrisOffset + rightIrisOffset) / 2;

          // Blink detection
          const now = Date.now();
          const blinkThreshold = 0.2;
          const gazeThreshold = 0.2;

          // Detect eye states
          if (leftEAR < blinkThreshold && rightEAR < blinkThreshold) {
            // Both eyes closed (blink)
            if (now - lastBlink > 1000) {  // Prevent multiple detections
              setLastBlink(now);
              handleEyeCommand('blink');
            }
          } else if (leftEAR < blinkThreshold && rightEAR >= blinkThreshold) {
            // Left eye closed (wink)
            handleEyeCommand('wink left');
          } else if (rightEAR < blinkThreshold && leftEAR >= blinkThreshold) {
            // Right eye closed (wink)
            handleEyeCommand('wink right');
          } else if (averageIrisOffset < -gazeThreshold) {
            // Looking left
            if (now - lastLeftGaze > 1000) {  // Prevent multiple detections
              setLastLeftGaze(now);
              handleEyeCommand('look left');
            }
          } else if (averageIrisOffset > gazeThreshold) {
            // Looking right
            if (now - lastRightGaze > 1000) {  // Prevent multiple detections
              setLastRightGaze(now);
              handleEyeCommand('look right');
            }
          } else {
            // Neutral gaze
            if (eyeState !== 'neutral') {
              setEyeState('neutral');
            }
          }
        } else {
          setIsTracking(false);
        }

        // Dispose tensor to avoid memory leaks
        tf.dispose(image);

      } catch (error) {
        console.error('Error processing tensor:', error);
        tf.dispose(image);
      }

      requestAnimationFrame(loop);
    };

    loop();
  };

  const handleEyeCommand = (command: string) => {
    setCurrentCommand(command);
    if (eyeCommandConfigs[command]) {
      eyeCommandConfigs[command].action();

      // Provide audio feedback
      Speech.speak(`${eyeCommandConfigs[command].label} detected`, {
        rate: 1.0,
        pitch: 1.0,
        language: 'en-US'
      });
    }
  };

  // Animation effect for command display
  useEffect(() => {
    if (currentCommand && currentCommand !== 'none') {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 500,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [currentCommand]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppState) => {
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

  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      paddingHorizontal: responsiveWidth(5),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: Platform.OS === 'ios' ? responsiveHeight(2) : responsiveHeight(4),
      marginBottom: responsiveHeight(3),
    },
    backButton: {
      padding: responsiveWidth(2),
      marginRight: responsiveWidth(2),
    },
    headerContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerText: {
      fontSize: responsiveFontSize(3.2),
      fontFamily: typography.fontFamily.bold,
      color: colors.text,
    },
    cameraContainer: {
      flex: 0.7,
      overflow: 'hidden',
      borderRadius: 20,
      marginBottom: responsiveHeight(2),
      backgroundColor: colors.background,
      display: state.isRunning ? 'flex' : 'none',
    },
    camera: {
      flex: 1,
      width: '100%',
    },
    commandContainer: {
      flex: state.isRunning ? 0.3 : 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    commandText: {
      fontSize: responsiveFontSize(2.5),
      fontFamily: typography.fontFamily.medium,
      color: colors.text,
      marginBottom: responsiveHeight(2),
    },
    commandImage: {
      width: responsiveWidth(30),
      height: responsiveWidth(30),
      resizeMode: 'contain',
    },
    button: {
      padding: 20,
      borderRadius: 10,
      width: '100%',
      alignItems: 'center',
      marginBottom: 20,
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
      marginVertical: 10,
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    trackingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    trackingDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#4CAF50',
      marginRight: 10,
    },
    trackingText: {
      fontSize: 16,
      color: colors.text,
    },
  });

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

  // TensorFlow camera configuration
  const textureDims = Platform.OS === 'ios' ?
    { height: 1920, width: 1080 } :
    { height: 1200, width: 1600 };

  const tensorDims = {
    height: 200,
    width: 152,
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={28}
              color={colors.text}
            />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerText}>Eye Tracking</Text>
          </View>
        </View>

        {state.isRunning && (
          <View style={styles.trackingIndicator}>
            <View style={[
              styles.trackingDot,
              { opacity: isTracking ? 1 : 0.3 }
            ]} />
            <Text style={styles.trackingText}>
              {isTracking ? 'Face detected' : 'Looking for face...'}
            </Text>
          </View>
        )}

        {state.isRunning && hasCameraPermission && tensorflowReady && (
          <View style={styles.cameraContainer}>
            <TensorCamera
              ref={cameraRef}
              style={styles.camera}
              type={"front"}
              tensor={handleCameraStream}
              cameraTextureHeight={textureDims.height}
              cameraTextureWidth={textureDims.width}
              resizeHeight={tensorDims.height}
              resizeWidth={tensorDims.width}
              resizeDepth={3}
              autorender={true}
              useCustomShadersToResize={false}
            />
          </View>
        )}

        <View style={styles.commandContainer}>
          <Text style={styles.commandText}>
            {!state.isRunning
              ? 'Eye tracking stopped'
              : eyeCommandConfigs[currentCommand]?.label || 'Use your eyes to control...'}
          </Text>

          {state.isRunning && (
            currentCommand !== 'none' && eyeCommandConfigs[currentCommand] ? (
              <Animated.View style={{ opacity: fadeAnim }}>
                <Image
                  source={eyeCommandConfigs[currentCommand].imagePath}
                  style={styles.commandImage}
                />
              </Animated.View>
            ) : (
              <ActivityIndicator size={60} color={colors.primary} />
            )
          )}
        </View>

        <TouchableOpacity
          style={[styles.button, state.isRunning ? styles.buttonStop : styles.buttonStart]}
          onPress={toggleService}
          disabled={!state.isInitialized}
        >
          <Text style={styles.buttonText}>
            {state.isRunning ? 'Stop Eye Tracking' : 'Start Eye Tracking'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.status}>
          Available commands: blink, look left, look right, wink left, wink right
        </Text>

        <Text style={styles.status}>
          Status: {state.status.charAt(0).toUpperCase() + state.status.slice(1)}
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default EyeTrackingService;