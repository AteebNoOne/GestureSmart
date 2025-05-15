import React, { useEffect, useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  AppState,
  Platform,
  Animated,
  SafeAreaView,
  ActivityIndicator,
  Image,
  NativeModules,
  Dimensions,
} from "react-native";
import { Camera, CameraType } from "expo-camera";
import { ExpoWebGLRenderingContext } from "expo-gl";
import { activateKeepAwake, deactivateKeepAwake } from "expo-keep-awake";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-react-native";
import * as handPoseDetection from "@tensorflow-models/hand-pose-detection";
import { cameraWithTensors } from "@tensorflow/tfjs-react-native";
import {
  handleSwipeLeft,
  handleSwipeRight,
  handleTap,
} from "../features/actions";
import { detectGesture, Gesture } from "../utils/detectGesture";
import {
  responsiveFontSize,
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useTheme } from "../hooks/useTheme";
import { typography } from "../constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NavigationProp } from "@react-navigation/native";
import SystemSetting from "react-native-system-setting";

const { PipModule } = NativeModules;
const TensorCamera = cameraWithTensors(Camera);

// Constants
const OUTPUT_TENSOR_WIDTH = 120;
const OUTPUT_TENSOR_HEIGHT = 160;
const VOLUME_ADJUSTMENT_THROTTLE = 500;
const CAMERA_PREVIEW_SIZE = 1;

interface GestureConfig {
  [key: string]: {
    label: string;
    imagePath: any;
  };
}

interface GestureScreenProps {
  navigation: NavigationProp<any>;
}

const GestureService: React.FC<GestureScreenProps> = ({ navigation }) => {
  // Refs
  const appState = useRef(AppState.currentState);
  const cameraRef = useRef<Camera>();
  const processingRef = useRef<boolean>(false);
  const keepAwakeRef = useRef<boolean>(false);
  const detectorRef = useRef<handPoseDetection.HandDetector | null>(null);
  const lastAdjustmentTime = useRef(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // State
  const [isPipMode, setIsPipMode] = useState(false);
  const [volume, setVolume] = useState(0);
  const [currentGesture, setCurrentGesture] = useState<string>("none");
  const [state, setState] = useState({
    isRunning: false,
    isInitialized: false,
    status: "initializing" as "initializing" | "stopped" | "running" | "error",
  });

  const { colors } = useTheme();

  // Gesture configurations
  const gestureConfigs: GestureConfig = {
    return: {
      label: "Return",
      imagePath: require("../assets/gestures/return.png"),
    },
    follow_cursor: {
      label: "Follow Cursor",
      imagePath: require("../assets/gestures/follow_cursor.png"),
    },
    close_cursor: {
      label: "Close Cursor",
      imagePath: require("../assets/gestures/close_cursor.png"),
    },
    tap: {
      label: "Tap",
      imagePath: require("../assets/gestures/tap.png"),
    },
    volume_up: {
      label: "Volume Up",
      imagePath: require("../assets/gestures/volume_up.png"),
    },
    volume_down: {
      label: "Volume Down",
      imagePath: require("../assets/gestures/volume_down.png"),
    },
    swipe_left: {
      label: "Swipe Left",
      imagePath: require("../assets/gestures/swipe_left.png"),
    },
    swipe_right: {
      label: "Swipe Right",
      imagePath: require("../assets/gestures/swipe_right.png"),
    },
    scroll_up: {
      label: "Scroll Up",
      imagePath: require("../assets/gestures/scroll_up.png"),
    },
    scroll_down: {
      label: "Scroll Down",
      imagePath: require("../assets/gestures/scroll_down.png"),
    },
  };

  // Initialize TensorFlow and handle permissions
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        const { status } = await Camera.requestCameraPermissionsAsync();
        if (status !== "granted") throw new Error("Camera permission required");

        await tf.ready();
        await tf.setBackend("rn-webgl");

        // Optimize for mobile
        tf.env().set("WEBGL_PACK", false);
        tf.env().set("WEBGL_FORCE_F16_TEXTURES", false);
        tf.env().set("WEBGL_FLUSH_THRESHOLD", 1);

        // Add this before tf.ready()
        tf.env().set("WEBGL_CPU_FORWARD", false);
        tf.env().set("WEBGL_EXP_CONV", true);
        tf.env().set("WEBGL_USE_SHAPES_UNIFORMS", true);

        const model = handPoseDetection.SupportedModels.MediaPipeHands;
        const detectorConfig = {
          runtime: "tfjs" as const,
          modelType: "lite" as const,
          maxHands: 1,
        };

        detectorRef.current = await handPoseDetection.createDetector(
          model,
          detectorConfig
        );

        if (mounted) {
          setState((prev) => ({
            ...prev,
            isInitialized: true,
            status: "stopped",
          }));
        }
      } catch (error) {
        console.error("Initialization failed:", error);
        if (mounted) {
          setState((prev) => ({ ...prev, status: "error" }));
        }
      }
    };

    initialize();
    return () => {
      mounted = false;
      safeDeactivateKeepAwake();
    };
  }, []);

  // Handle PiP state changes
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppState) => {
        if (appState.current === "active" && nextAppState === "background") {
          if (isPipMode && state.isRunning) {
            processingRef.current = true;
          } else {
            processingRef.current = false;
          }
        } else if (nextAppState === "active") {
          if (state.isRunning) {
            processingRef.current = true;
          }
        }
        appState.current = nextAppState;
      }
    );

    return () => {
      subscription.remove();
    };
  }, [isPipMode, state.isRunning]);

  // Initialize volume
  useEffect(() => {
    SystemSetting.getVolume().then(setVolume);
  }, []);

  // Gesture animation effect
  useEffect(() => {
    if (currentGesture && currentGesture !== "none") {
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
        }),
      ]).start();
    }
  }, [currentGesture, fadeAnim]);

  const adjustVolume = async () => {
    const now = Date.now();
    if (now - lastAdjustmentTime.current < VOLUME_ADJUSTMENT_THROTTLE) return;

    lastAdjustmentTime.current = now;
    try {
      const newVolume = Math.min(1, volume + 0.05);
      if (newVolume !== volume) {
        await SystemSetting.setVolume(newVolume, {
          type: "music",
          playSound: false,
          showUI: true,
        });
        setVolume(newVolume);
      }
    } catch (error) {
      console.error("Volume adjustment failed:", error);
    }
  };

  const handleCameraStream = async (images: IterableIterator<tf.Tensor3D>) => {
    const processFrame = async () => {
      if (!processingRef.current || !detectorRef.current) return;

      try {
        tf.disposeVariables();
        tf.engine().startScope();

        const imageTensor = images.next().value;
        if (!imageTensor) return;

        const hands = await detectorRef.current.estimateHands(imageTensor);

        if (hands.length > 0) {
          const gestureResult = detectGesture(hands);
          console.log("Detected gesture:", gestureResult.gesture);

          setCurrentGesture(gestureResult.gesture);

          // if (gestureResult.gesture === 'follow_cursor') {
          //   await adjustVolume();
          // }

          // handleGesture(gestureResult.gesture);
        }

        tf.dispose(imageTensor);

        if (processingRef.current) {
          requestAnimationFrame(processFrame);
        }
      } catch (error) {
        console.error("Frame processing error:", error);
        if (processingRef.current) {
          requestAnimationFrame(processFrame);
        }
      } finally {
        tf.engine().endScope();
      }
    };

    if (processingRef.current) {
      setTimeout(() => requestAnimationFrame(processFrame), 50); // Reduce CPU load
    }
  };

  const handleGesture = (gesture: Gesture) => {
    switch (gesture) {
      case "follow_cursor":
        handleSwipeLeft();
        break;
      case "close_cursor":
        handleSwipeRight();
        break;
      case "tap":
        handleTap(0, 0);
        break;
    }
  };

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
        await safeActivateKeepAwake();
        processingRef.current = true;
      } else {
        await safeDeactivateKeepAwake();
        processingRef.current = false;
      }

      setState((prev) => ({
        ...prev,
        isRunning: !prev.isRunning,
        status: !prev.isRunning ? "running" : "stopped",
      }));
    } catch (error) {
      console.error("Service toggle failed:", error);
    }
  };

  const enterPipMode = async () => {
    if (Platform.OS === "android") {
      try {
        await PipModule.enterPipMode();
        setIsPipMode(true);
      } catch (error) {
        console.error("PiP mode failed:", error);
      }
    }
  };

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
      flexDirection: "row",
      alignItems: "center",
      paddingTop:
        Platform.OS === "ios" ? responsiveHeight(2) : responsiveHeight(4),
      marginBottom: responsiveHeight(3),
    },
    backButton: {
      padding: responsiveWidth(2),
      marginRight: responsiveWidth(2),
    },
    headerContent: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerText: {
      fontSize: responsiveFontSize(3.2),
      fontFamily: typography.fontFamily.bold,
      color: colors.text,
    },
    gestureContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    gestureText: {
      fontSize: responsiveFontSize(2.5),
      fontFamily: typography.fontFamily.medium,
      color: colors.text,
      marginBottom: responsiveHeight(2),
    },
    gestureImage: {
      width: responsiveWidth(50),
      height: responsiveWidth(50),
      resizeMode: "contain",
    },
    button: {
      padding: 20,
      borderRadius: 10,
      width: "100%",
      alignItems: "center",
    },
    buttonStart: {
      backgroundColor: "#4CAF50",
    },
    buttonStop: {
      backgroundColor: "#f44336",
    },
    buttonText: {
      color: "white",
      fontSize: 18,
      fontWeight: "bold",
    },
    pipButton: {
      backgroundColor: colors.primary,
      padding: responsiveWidth(4),
      borderRadius: 10,
      marginLeft: 10,
    },
    status: {
      marginVertical: 20,
      fontSize: 16,
      color: "#666",
      textAlign: "center",
    },
    camera: {
      width: CAMERA_PREVIEW_SIZE,
      height: CAMERA_PREVIEW_SIZE,
      opacity: 0,
    },
    pipCamera: {
      width: Dimensions.get("window").width,
      height: Dimensions.get("window").height,
      opacity: 1,
    },
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {!isPipMode && (
          <>
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={28}
                  color={colors.text}
                />
              </TouchableOpacity>
              <View style={styles.headerContent}>
                <Text style={styles.headerText}>Gesture Detection</Text>
              </View>
            </View>

            <View style={styles.gestureContainer}>
              <Text style={styles.gestureText}>
                {!state.isRunning
                  ? gestureConfigs[currentGesture]?.label
                  : "Waiting for gesture..."}
              </Text>

              {state.isRunning &&
                currentGesture !== "none" &&
                gestureConfigs[currentGesture] && (
                  <Animated.View style={{ opacity: fadeAnim }}>
                    <Image
                      source={gestureConfigs[currentGesture].imagePath}
                      style={styles.gestureImage}
                    />
                  </Animated.View>
                )}

              {state.isRunning &&
                (!currentGesture || currentGesture === "none") && (
                  <ActivityIndicator size={100} color={colors.primary} />
                )}
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <TouchableOpacity
                style={[
                  styles.button,
                  state.isRunning ? styles.buttonStop : styles.buttonStart,
                  { flex: 1 },
                ]}
                onPress={toggleService}
                disabled={
                  !state.isInitialized || state.status === "initializing"
                }
              >
                <Text style={styles.buttonText}>
                  {state.isRunning
                    ? "Stop Gesture Service"
                    : "Start Gesture Service"}
                </Text>
              </TouchableOpacity>

              {Platform.OS === "android" && state.isRunning && (
                <TouchableOpacity
                  style={[styles.pipButton, { flex: 0.3 }]}
                  onPress={enterPipMode}
                >
                  <Text style={styles.buttonText}>PiP</Text>
                </TouchableOpacity>
              )}
            </View>

            {!isPipMode && (
              <Text style={styles.status}>
                Status:{" "}
                {state.status.charAt(0).toUpperCase() + state.status.slice(1)}
              </Text>
            )}
          </>
        )}

        {/* Camera component that works in both normal and PiP modes */}
        {state.isRunning && (
          <TensorCamera
            ref={cameraRef}
            style={isPipMode ? styles.pipCamera : styles.camera}
            type={CameraType.front}
            resizeWidth={OUTPUT_TENSOR_WIDTH}
            resizeHeight={OUTPUT_TENSOR_HEIGHT}
            resizeDepth={3}
            autorender={true}
            onReady={handleCameraStream}
            useCustomShadersToResize={false}
            // Ensure camera texture dimensions match the tensor dimensions
            cameraTextureWidth={OUTPUT_TENSOR_WIDTH}
            cameraTextureHeight={OUTPUT_TENSOR_HEIGHT}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default GestureService;
