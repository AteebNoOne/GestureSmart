import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  Platform,
  Animated,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Camera, CameraType } from 'expo-camera';
import { ExpoWebGLRenderingContext } from 'expo-gl';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import { cameraWithTensors } from '@tensorflow/tfjs-react-native';
import { typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import {
  responsiveHeight,
  responsiveWidth,
  responsiveFontSize,
} from 'react-native-responsive-dimensions';
import { detectGesture } from '../utils/detectGesture';
import { BottomNavigation } from '../components/BottomNavigation';
import { NavigationProp } from '@react-navigation/native';

const TensorCamera = cameraWithTensors(Camera);

// Constants
const OUTPUT_TENSOR_WIDTH = 240;
const OUTPUT_TENSOR_HEIGHT = 320;
const DETECTION_DELAY = 500;
const CONFIDENCE_THRESHOLD = 0.8;
const CONSECUTIVE_DETECTIONS_REQUIRED = 3;

interface GestureScreenProps {
  navigation: NavigationProp<any>;
}

interface GestureConfig {
  [key: string]: {
    label: string;
    imagePath: any;
  };
}

const GestureScreen: React.FC<GestureScreenProps> = ({ navigation }) => {
  const { theme, colors } = useTheme();
  const [activeRoute] = useState('detection');
  const [isServiceEnabled, setIsServiceEnabled] = useState(false);
  const [isTfReady, setIsTfReady] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const cameraRef = useRef<Camera>(null);
  const detectorRef = useRef<handPoseDetection.HandDetector | null>(null);
  const [currentGesture, setCurrentGesture] = useState<string>('none');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const lastDetectionTime = useRef<number>(0);
  const consecutiveDetections = useRef<{ gesture: string; count: number }>({
    gesture: '',
    count: 0
  });
  const isProcessingFrame = useRef<boolean>(false);

  const gestureConfigs: GestureConfig = {
    follow_cursor: {
      label: 'Follow Cursor',
      imagePath: require('../assets/gestures/follow_cursor.png')
    },
    close_cursor: {
      label: 'Close Cursor',
      imagePath: require('../assets/gestures/close_cursor.png')
    },
    tap: {
      label: 'Tap',
      imagePath: require('../assets/gestures/tap.png')
    },
    volume_up: {
      label: 'Volume Up',
      imagePath: require('../assets/gestures/volume_up.png')
    },
    volume_down: {
      label: 'Volume Down',
      imagePath: require('../assets/gestures/volume_down.png')
    },
    swipe_left: {
      label: 'Swipe Left',
      imagePath: require('../assets/gestures/swipe_left.png')
    },
    swipe_right: {
      label: 'Swipe Right',
      imagePath: require('../assets/gestures/swipe_right.png')
    },
    scroll_up: {
      label: 'Scroll Up',
      imagePath: require('../assets/gestures/scroll_up.png')
    },
    scroll_down: {
      label: 'Scroll Down',
      imagePath: require('../assets/gestures/scroll_down.png')
    }
  };

  const updateGestureWithDebounce = useCallback((newGesture: string, confidence: number) => {
    const now = Date.now();

    // Reset cooldown timer if gesture changes
    if (consecutiveDetections.current.gesture !== newGesture) {
      lastDetectionTime.current = now;
    }

    if (confidence < CONFIDENCE_THRESHOLD) {
      consecutiveDetections.current = { gesture: '', count: 0 };
      return;
    }

    if (consecutiveDetections.current.gesture === newGesture) {
      consecutiveDetections.current.count += 1;
    } else {
      consecutiveDetections.current = { gesture: newGesture, count: 1 };
    }

    if (consecutiveDetections.current.count >= CONSECUTIVE_DETECTIONS_REQUIRED) {
      setCurrentGesture(newGesture);
      lastDetectionTime.current = now;
      consecutiveDetections.current = { gesture: '', count: 0 };
    }
  }, []);

  useEffect(() => {

    return () => {
      // Cleanup
      if (detectorRef.current) {
        detectorRef.current.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (currentGesture && currentGesture !== 'none') {
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
  }, [currentGesture]);

  useEffect(() => {
    if (isServiceEnabled) {
      startGestureDetection();
    } else {
      stopGestureDetection();
    }
  }, [isServiceEnabled]);

  const startGestureDetection = async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        console.error('Camera permission not granted');
        setIsServiceEnabled(false);
        return;
      }
    } catch (error) {
      console.error('Error starting gesture detection:', error);
      setIsServiceEnabled(false);
    }
  };

  const stopGestureDetection = () => {
    setCurrentGesture('none');
    consecutiveDetections.current = { gesture: '', count: 0 };
    lastDetectionTime.current = 0;
  };

  // Initialize TensorFlow and request permissions
  useEffect(() => {
    const setup = async () => {
      try {
        // Request camera permissions
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');

        // Initialize TensorFlow
        await tf.ready();
        await tf.setBackend('rn-webgl');

        // Initialize detector
        const model = handPoseDetection.SupportedModels.MediaPipeHands;
        const detectorConfig: handPoseDetection.MediaPipeHandsTfjsModelConfig = {
          runtime: 'tfjs',
          modelType: 'lite',
          maxHands: 1,
        };
        detectorRef.current = await handPoseDetection.createDetector(model, detectorConfig);

        setIsTfReady(true);
        console.log('TensorFlow initialized successfully');
      } catch (error) {
        console.error('Setup failed:', error);
        setIsTfReady(false);
      }
    };

    setup();
  }, []);

  const handleCameraStream = useCallback(async (
    images: IterableIterator<tf.Tensor3D>,
    updatePreview: () => void,
    gl: ExpoWebGLRenderingContext
  ) => {
    const processFrame = async () => {
      if (!isServiceEnabled || isProcessingFrame.current || !detectorRef.current) {
        requestAnimationFrame(processFrame);
        return;
      }

      isProcessingFrame.current = true;

      try {
        const imageTensor = images.next().value;

        if (imageTensor) {
          const now = Date.now();
          if (now - lastDetectionTime.current >= DETECTION_DELAY) {
            const hands = await detectorRef.current.estimateHands(imageTensor);

            if (hands && hands.length > 0) {
              const result = detectGesture(hands);
              
              console.log("Res", result);
              if (result.confidence >= CONFIDENCE_THRESHOLD) {
                if (consecutiveDetections.current.gesture === result.gesture) {
                  consecutiveDetections.current.count++;
                } else {
                  consecutiveDetections.current = { gesture: result.gesture, count: 1 };
                }

                if (consecutiveDetections.current.count >= CONSECUTIVE_DETECTIONS_REQUIRED) {
                  setCurrentGesture(result.gesture);
                  animateGesture();
                  consecutiveDetections.current = { gesture: '', count: 0 };
                }
              }
            }

            lastDetectionTime.current = now;
          }

          tf.dispose(imageTensor);
        }
      } catch (error) {
        console.error('Frame processing error:', error);
      } finally {
        isProcessingFrame.current = false;
        requestAnimationFrame(processFrame);
      }
    };

    processFrame();
  }, [isServiceEnabled]);

  const animateGesture = useCallback(() => {
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
  }, [fadeAnim]);

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
    serviceSwitch: {
      transform: [{ scale: 0.8 }],
    },
    camera: {
      width: 1,
      height: 1,
      opacity: 0,
    },
    gestureContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gestureText: {
      fontSize: responsiveFontSize(2.5),
      fontFamily: typography.fontFamily.medium,
      color: colors.text,
      marginBottom: responsiveHeight(2),
    },
    gestureImage: {
      width: responsiveWidth(30),
      height: responsiveWidth(30),
      resizeMode: 'contain',
    },
    decorationCircle: {
      position: 'absolute',
      borderRadius: responsiveWidth(100),
      width: responsiveWidth(150),
      height: responsiveWidth(150),
      zIndex: -1,
    },
    themeDecorationTop: {
      top: -responsiveHeight(15),
      left: -responsiveWidth(25),
      backgroundColor: theme === 'light' ? 'rgba(3, 4, 94, 0.03)' :
        theme === 'dark' ? 'rgba(255, 195, 0, 0.05)' :
          'rgba(5, 9, 130, 0.08)',
    },
    themeDecorationBottom: {
      bottom: -responsiveHeight(15),
      right: -responsiveWidth(25),
      backgroundColor: theme === 'light' ? 'rgba(3, 4, 94, 0.02)' :
        theme === 'dark' ? 'rgba(255, 219, 77, 0.03)' :
          'rgba(123, 223, 255, 0.04)',
    }
  });

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text>Camera permission not granted</Text>
      </View>
    );
  }

  if (!isTfReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text>Initializing TensorFlow...</Text>
      </View>
    );
  }




  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
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
            <Text style={styles.headerText}>Gesture Detection</Text>
            <Switch
              style={styles.serviceSwitch}
              value={isServiceEnabled}
              onValueChange={setIsServiceEnabled}
              trackColor={{ false: colors.textSecondary, true: colors.primary }}
              thumbColor={colors.background}
            />
          </View>
        </View>

        {/* Gesture Display */}
        <View style={styles.gestureContainer}>
          <Text style={styles.gestureText}>
            {!isServiceEnabled
              ? 'Service is disabled'
              : currentGesture !== 'none'
                ? gestureConfigs[currentGesture]?.label
                : 'Waiting for gesture...'}
          </Text>

          {isServiceEnabled && (
            currentGesture !== 'none' && gestureConfigs[currentGesture] ? (
              <Animated.View style={{ opacity: fadeAnim }}>
                <Image
                  source={gestureConfigs[currentGesture].imagePath}
                  style={styles.gestureImage}
                />
              </Animated.View>
            ) : (
              <ActivityIndicator size={100} color={colors.primary} />
            )
          )}
        </View>

        {/* Camera */}
        {isServiceEnabled && (
          <TensorCamera
            ref={cameraRef}
            style={styles.camera}
            type={CameraType.front}
            resizeWidth={OUTPUT_TENSOR_WIDTH}
            resizeHeight={OUTPUT_TENSOR_HEIGHT}
            resizeDepth={3}
            autorender={true}
            onReady={handleCameraStream}
            useCustomShadersToResize={true}
          />
        )}
      </View>

      <BottomNavigation
        activeRoute={activeRoute}
        onRouteChange={() => { }}
      />
    </SafeAreaView>
  );
};

export default GestureScreen;