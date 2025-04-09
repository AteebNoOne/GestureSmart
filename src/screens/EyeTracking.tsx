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
import * as FaceDetector from 'expo-face-detector';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { responsiveFontSize, responsiveHeight, responsiveWidth } from 'react-native-responsive-dimensions';
import { useTheme } from '../hooks/useTheme';
import { typography } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';

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

const EyeTracking: React.FC<EyeTrackingScreenProps> = ({ navigation }) => {
  const appState = useRef(AppState.currentState);
  const processingRef = useRef<boolean>(false);
  const keepAwakeRef = useRef<boolean>(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { colors } = useTheme();
  const cameraRef = useRef(null);

  const [currentCommand, setCurrentCommand] = useState<string>('none');
  const [isTracking, setIsTracking] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [lastBlink, setLastBlink] = useState(0);
  const [lastLeftGaze, setLastLeftGaze] = useState(0);
  const [lastRightGaze, setLastRightGaze] = useState(0);
  const [eyeState, setEyeState] = useState('neutral');
  
  // Track previous face data for motion detection
  const prevFaceRef = useRef<any>(null);

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

  // Initialize camera and request permissions
  useEffect(() => {
    const initializeCamera = async () => {
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

        setState(prev => ({
          ...prev,
          isInitialized: true,
          status: 'stopped'
        }));
      } catch (e) {
        console.error('Error initializing camera:', e);
        setState(prev => ({
          ...prev,
          status: 'error'
        }));
      }
    };

    initializeCamera();
  }, []);

  // Handle face detection
  const handleFacesDetected = ({ faces }: { faces: any }) => {
    if (!isRunningRef.current) return;
    
    if (faces.length > 0) {
      setIsTracking(true);
      const face = faces[0];
      
      // Get current face data
      const leftEyeOpen = face.leftEyeOpenProbability || 0;
      const rightEyeOpen = face.rightEyeOpenProbability || 0;
      const yawAngle = face.yawAngle || 0; // Head rotation left/right
      
      // Get timestamp for throttling detections
      const now = Date.now();
      
      // Process eye commands based on face data
      const blinkThreshold = 0.2;
      
      // Both eyes closed (blink detection)
      if (leftEyeOpen < blinkThreshold && rightEyeOpen < blinkThreshold) {
        if (now - lastBlink > 1000) {  // Prevent multiple detections
          setLastBlink(now);
          handleEyeCommand('blink');
        }
      } 
      // Left eye closed (left wink)
      else if (leftEyeOpen < blinkThreshold && rightEyeOpen >= blinkThreshold) {
        handleEyeCommand('wink left');
      } 
      // Right eye closed (right wink)
      else if (rightEyeOpen < blinkThreshold && leftEyeOpen >= blinkThreshold) {
        handleEyeCommand('wink right');
      } 
      // Looking left (based on head yaw angle)
      else if (yawAngle < -15) {
        if (now - lastLeftGaze > 1000) {  // Prevent multiple detections
          setLastLeftGaze(now);
          handleEyeCommand('look left');
        }
      } 
      // Looking right (based on head yaw angle)
      else if (yawAngle > 15) {
        if (now - lastRightGaze > 1000) {  // Prevent multiple detections
          setLastRightGaze(now);
          handleEyeCommand('look right');
        }
      } 
      // Neutral position
      else {
        if (eyeState !== 'neutral') {
          setEyeState('neutral');
        }
      }
      
      // Store current face data for next comparison
      prevFaceRef.current = face;
    } else {
      setIsTracking(false);
    }
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

        {state.isRunning && hasCameraPermission && (
          <View style={styles.cameraContainer}>
            <Camera
              ref={cameraRef}
              style={styles.camera}
              type={"front"}
              onFacesDetected={handleFacesDetected}
              faceDetectorSettings={{
                mode: FaceDetector.FaceDetectorMode.accurate,
                detectLandmarks: FaceDetector.FaceDetectorLandmarks.all,
                runClassifications: FaceDetector.FaceDetectorClassifications.all,
                minDetectionInterval: 100,
                tracking: true,
              }}
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

export default EyeTracking;