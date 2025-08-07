import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  AppState,
  AppStateStatus,
  Platform,
  Animated,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Alert,
  ImageRequireSource,
  BackHandler,
} from "react-native";
import { EyeService, EyeEvent } from "../utils/eyeTrackingService"; // Updated import
import {
  responsiveFontSize,
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useTheme } from "../hooks/useTheme";
import { typography } from "../constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NavigationProp } from "@react-navigation/native";
import { handlegoHome, handleReturn, handleScrollDown, handleScrollUp, handleSwipeLeft, handleSwipeRight } from "../features/actions";
import { requestTrackingPermissions, showTrackingPermissionAlert } from "../utils/permissions";
import { HeaderNavigation } from "../components/HeaderBackNavigation";

// Types
interface EyeEventConfig {
  label: string;
  imagePath: ImageRequireSource;
}

interface EyeEventConfigs {
  [key: string]: EyeEventConfig;
}

interface EyeTrackingScreenProps {
  navigation: NavigationProp<any>;
}

interface AppLocalState {
  isRunning: boolean;
  isInitialized: boolean;
  isBackgroundActive: boolean;
  status: "initializing" | "stopped" | "running" | "background" | "error" | "camera_lost";
}

const EyeTracking: React.FC<EyeTrackingScreenProps> = ({ navigation }) => {
  // Refs
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isMountedRef = useRef<boolean>(true);
  const cameraHealthCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const serviceRestartAttempts = useRef<number>(0);
  const maxRestartAttempts = 3;
  const lastEventTime = useRef<number>(0);

  // State
  const [currentEvent, setCurrentEvent] = useState<string>("none");
  const [backgroundPermissionGranted, setBackgroundPermissionGranted] = useState<boolean>(false);
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState<boolean>(false);
  const [state, setState] = useState<AppLocalState>({
    isRunning: false,
    isInitialized: false,
    isBackgroundActive: false,
    status: "initializing",
  });

  const { colors } = useTheme();

  // Event configurations
  const eventConfigs: EyeEventConfigs = {
    blink: {
      label: "Blink",
      imagePath: require("../assets/eyetracking/blink.jpg"),
    },
    look_left: {
      label: "Look Left",
      imagePath: require("../assets/eyetracking/look_left.jpg"),
    },
    look_right: {
      label: "Look Right",
      imagePath: require("../assets/eyetracking/look_right.jpg"),
    },
    look_up: {
      label: "Look Up",
      imagePath: require("../assets/eyetracking/lookup.jpg"),
    },
    look_down: {
      label: "Look Down",
      imagePath: require("../assets/eyetracking/lookdown.jpeg"),
    },
    wink_left: {
      label: "Wink Left",
      imagePath: require("../assets/eyetracking/wink_left.jpg"),
    },
    wink_right: {
      label: "Wink Right",
      imagePath: require("../assets/eyetracking/wink_right.jpg"),
    },
  };

  // Safe state update helper
  const safeSetState = useCallback((updater: (prev: AppLocalState) => AppLocalState) => {
    if (isMountedRef.current) {
      setState(updater);
    }
  }, []);

  // Stop service function
  const stopService = useCallback(async (): Promise<void> => {
    try {
      console.log('Stopping eye tracking service...');
      if (cameraHealthCheckInterval.current) {
        clearInterval(cameraHealthCheckInterval.current);
        cameraHealthCheckInterval.current = null;
      }

      await EyeService.stopService();
      safeSetState((prev) => ({
        ...prev,
        isRunning: false,
        status: "stopped",
        isBackgroundActive: false,
      }));
      setCurrentEvent("none");

      console.log('Eye tracking service stopped successfully');
    } catch (error) {
      console.error('Failed to stop service:', error);
    }
  }, [safeSetState]);

  // Back handler
  const handleBackPress = useCallback((): boolean => {
    if (state.isRunning) {
      Alert.alert(
        "Eye Tracking Active",
        "Eye tracking service is currently running. Are you sure you want to go back? This will stop the service.",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => {
              console.log("Back navigation cancelled - service continues running");
            },
          },
          {
            text: "Yes, Stop & Go Back",
            style: "destructive",
            onPress: async () => {
              console.log("Stopping service and navigating back");
              await stopService();
              navigation.goBack();
            },
          },
        ],
        { cancelable: false }
      );
      return true; // Prevent default back behavior
    }
    return false; // Allow default back behavior when service is not running
  }, [state.isRunning, stopService, navigation]);

  // BackHandler effect
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress
    );

    return () => backHandler.remove();
  }, [handleBackPress]);

  // Focus effect to handle navigation back button
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!state.isRunning) {
        // If service is not running, allow normal navigation
        return;
      }

      // Prevent default behavior of leaving the screen
      e.preventDefault();

      // Show confirmation dialog
      Alert.alert(
        'Eye Tracking Active',
        'Eye tracking service is currently running. Are you sure you want to go back? This will stop the service.',
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => {
              console.log("Navigation cancelled - service continues running");
            },
          },
          {
            text: "Yes, Stop & Go Back",
            style: "destructive",
            onPress: async () => {
              console.log("Stopping service and navigating back");
              await stopService();
              // Re-dispatch the action after stopping the service
              navigation.dispatch(e.data.action);
            },
          },
        ],
        { cancelable: false }
      );
    });

    return unsubscribe;
  }, [navigation, state.isRunning, stopService]);

  // Android 14 permission request
  const requestAndroidPermissions = useCallback(async (): Promise<void> => {
    const handlers = {
      setBackgroundPermissionGranted,
      setCameraPermissionDenied
    };
    await requestTrackingPermissions(handlers, 'eye tracking');
  }, []);

  // Camera health monitoring
  const startCameraHealthCheck = useCallback(() => {
    if (cameraHealthCheckInterval.current) {
      clearInterval(cameraHealthCheckInterval.current);
    }

    cameraHealthCheckInterval.current = setInterval(() => {
      const timeSinceLastEvent = Date.now() - lastEventTime.current;

      if (state.isRunning && timeSinceLastEvent > 10000 && lastEventTime.current > 0) {
        console.warn('Camera feed appears to be lost - attempting restart');
        safeSetState(prev => ({ ...prev, status: "camera_lost" }));
        handleCameraLoss();
      }
    }, 5000);
  }, [state.isRunning, safeSetState]);

  // Handle camera loss
  const handleCameraLoss = useCallback(async () => {
    if (serviceRestartAttempts.current >= maxRestartAttempts) {
      console.error('Max restart attempts reached');
      Alert.alert(
        'Camera Service Failed',
        'Unable to maintain camera connection. Please restart the service manually.',
        [{ text: 'OK' }]
      );
      return;
    }

    serviceRestartAttempts.current++;
    console.log(`Attempting service restart ${serviceRestartAttempts.current}/${maxRestartAttempts}`);

    try {
      await EyeService.stopService();
      await new Promise(resolve => setTimeout(resolve, 3000));
      await EyeService.startService();
      safeSetState(prev => ({ ...prev, status: "running" }));
      console.log('Service restarted successfully');

      setTimeout(() => {
        serviceRestartAttempts.current = 0;
      }, 30000);
    } catch (error) {
      console.error('Service restart failed:', error);
      safeSetState(prev => ({ ...prev, status: "error" }));
    }
  }, [safeSetState]);

  const handleGesture = useCallback(async (gesture: string): Promise<void> => {
    console.log(`Gesture detected: ${gesture} (${state.isBackgroundActive ? 'background' : 'foreground'} mode)`);

    try {
      // Handle gesture in any mode
      switch (gesture) {
        case "blink":
          await handleScrollUp()
          break;
        case "look_left":
          await handleSwipeLeft();
          break;
        case "look_right":
          await handleSwipeRight();
          break;
        case "look_up":
          await handleScrollUp();
          break;
        case "look_down":
          await handleScrollDown();
          break;
        case "wink_left":
          await handlegoHome()
          break;
        case "wink_right":
          await handleReturn();
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error handling gesture:', error);
    }
  }, [state.isBackgroundActive]);

  // Initialize eye tracking service
  useEffect(() => {
    isMountedRef.current = true;

    const initialize = async () => {
      try {
        console.log('Initializing eye tracking service...');

        // Check if service is available
        if (!EyeService.isAvailable()) {
          console.error('EyeService is not available');
          safeSetState(prev => ({ ...prev, status: "error" }));
          return;
        }

        await requestAndroidPermissions();

        // Set up event listener
        const subscription = EyeService.addListener((event: EyeEvent) => {
          console.log('Eye event received in component:', event);
          handleGesture(event.event);
          lastEventTime.current = Date.now();
          setCurrentEvent(event.event);
        });

        safeSetState((prev) => ({
          ...prev,
          isInitialized: true,
          status: "stopped",
        }));

        console.log('Eye tracking service initialized successfully');

        return () => {
          console.log('Cleaning up eye tracking service...');
          subscription.remove();
        };
      } catch (error) {
        console.error("Initialization failed:", error);
        safeSetState((prev) => ({ ...prev, status: "error" }));
      }
    };

    initialize();

    return () => {
      isMountedRef.current = false;
      if (cameraHealthCheckInterval.current) {
        clearInterval(cameraHealthCheckInterval.current);
      }
      EyeService.removeListener();
    };
  }, [requestAndroidPermissions, safeSetState]);

  // App state handling
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus): Promise<void> => {
      console.log('App state changed:', appState.current, '->', nextAppState);

      // Fix: Include handleGesture in the ensureListenerActive callback
      EyeService.ensureListenerActive((event: EyeEvent) => {
        console.log('Eye event received via ensureListenerActive:', event);
        handleGesture(event.event);  // Add this missing call
        lastEventTime.current = Date.now();
        setCurrentEvent(event.event);
      });

      if (state.isRunning) {
        if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
          safeSetState(prev => ({
            ...prev,
            isBackgroundActive: true,
            status: "background"
          }));
          startCameraHealthCheck();
        } else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
          safeSetState(prev => ({
            ...prev,
            isBackgroundActive: false,
            status: "running"
          }));

          if (cameraHealthCheckInterval.current) {
            clearInterval(cameraHealthCheckInterval.current);
            cameraHealthCheckInterval.current = null;
          }
        }
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [safeSetState, state.isRunning, startCameraHealthCheck, handleGesture]);

  // Event animation
  useEffect(() => {
    if (currentEvent && currentEvent !== "none") {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 700,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [currentEvent, fadeAnim]);

  // Toggle service
  const toggleService = useCallback(async (): Promise<void> => {
    try {
      if (!backgroundPermissionGranted || cameraPermissionDenied) {
        showTrackingPermissionAlert(requestAndroidPermissions, 'eye tracking');
        return;
      }

      if (!EyeService.isAvailable()) {
        Alert.alert(
          'Service Unavailable',
          'Eye tracking service is not available. Please ensure the native module is properly configured.',
          [{ text: 'OK' }]
        );
        return;
      }

      if (!state.isRunning) {
        serviceRestartAttempts.current = 0;
        try {
          console.log('Starting eye tracking service...');
          await EyeService.startService();
          safeSetState((prev) => ({
            ...prev,
            isRunning: true,
            status: "running",
          }));

          if (AppState.currentState !== 'active') {
            startCameraHealthCheck();
          }

          console.log('Eye tracking service started successfully');
        } catch (error) {
          console.error('Failed to start eye service:', error);
          Alert.alert(
            'Service Start Failed',
            Platform.Version && Number(Platform.Version) >= 34
              ? 'Unable to start eye tracking service. Please check Android 14 foreground service permissions.'
              : 'Unable to start eye tracking service. Please check permissions.',
            [{ text: 'OK' }]
          );
        }
      } else {
        await stopService();
      }
    } catch (error) {
      console.error("Service toggle failed:", error);
    }
  }, [
    backgroundPermissionGranted,
    cameraPermissionDenied,
    requestAndroidPermissions,
    state.isRunning,
    safeSetState,
    startCameraHealthCheck,
    stopService,
  ]);

  // Status helpers
  const getStatusText = useCallback((): string => {
    switch (state.status) {
      case "background":
        return "Background Mode Active";
      case "running":
        return "Running";
      case "stopped":
        return "Stopped";
      case "initializing":
        return "Initializing";
      case "camera_lost":
        return "Camera Lost - Recovering";
      case "error":
        return "Error";
      default:
        return "Unknown";
    }
  }, [state.status]);

  const getStatusColor = useCallback((): string => {
    switch (state.status) {
      case "background":
        return "#FF9800";
      case "running":
        return "#4CAF50";
      case "stopped":
        return "#666";
      case "initializing":
        return "#2196F3";
      case "camera_lost":
        return "#FF5722";
      case "error":
        return "#f44336";
      default:
        return "#666";
    }
  }, [state.status]);

  // Get camera status text
  const getCameraStatusText = useCallback(() => {
    const timeSinceLastEvent = Date.now() - lastEventTime.current;

    if (timeSinceLastEvent > 10000 && state.isRunning) {
      return "⚠️ Camera feed lost - attempting recovery";
    }

    if (timeSinceLastEvent > 5000 && state.isRunning) {
      return "📷 Camera feed unstable";
    }

    if (state.isRunning) {
      return "👁️ Eye tracking active";
    }

    return "Eye tracking not active";
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
    eventContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    eventText: {
      fontSize: responsiveFontSize(2.5),
      fontFamily: typography.fontFamily.medium,
      color: colors.text,
      marginBottom: responsiveHeight(2),
      textAlign: "center",
    },
    eventImage: {
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
    status: {
      marginVertical: 20,
      fontSize: 16,
      textAlign: "center",
      fontWeight: "bold",
    },
    backgroundIndicator: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginVertical: 10,
      padding: 10,
      backgroundColor: "#FF9800",
      borderRadius: 5,
    },
    backgroundIndicatorText: {
      color: "white",
      fontSize: 14,
      fontWeight: "bold",
      marginLeft: 5,
    },
    permissionContainer: {
      padding: 20,
      backgroundColor: Platform.Version && Number(Platform.Version) >= 34 ? "#ffcdd2" : "#ffeb3b",
      borderRadius: 10,
      marginVertical: 10,
    },
    permissionText: {
      fontSize: 14,
      color: "#333",
      textAlign: "center",
    },
    android14Warning: {
      padding: 15,
      backgroundColor: "#ff5722",
      borderRadius: 8,
      marginVertical: 10,
    },
    android14WarningText: {
      fontSize: 13,
      color: "white",
      textAlign: "center",
      fontWeight: "600",
    },
    cameraStatusContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginVertical: 10,
      padding: 15,
      borderRadius: 8,
      borderWidth: 2,
    },
    cameraActiveStyle: {
      backgroundColor: "#E8F5E8",
      borderColor: "#4CAF50",
    },
    cameraUnstableStyle: {
      backgroundColor: "#FFF3E0",
      borderColor: "#FF9800",
    },
    cameraLostStyle: {
      backgroundColor: "#FFEBEE",
      borderColor: "#F44336",
    },
    cameraStatusText: {
      fontSize: 14,
      fontWeight: "600",
      textAlign: "center",
      marginLeft: 8,
    },
    cameraActiveText: {
      color: "#2E7D32",
    },
    cameraUnstableText: {
      color: "#F57C00",
    },
    cameraLostText: {
      color: "#C62828",
    },
    debugInfo: {
      backgroundColor: "#f0f0f0",
      padding: 10,
      borderRadius: 5,
      marginVertical: 10,
    },
    debugText: {
      fontSize: 12,
      fontFamily: "monospace",
      color: "#333",
    },
    restartButton: {
      padding: 10,
      backgroundColor: "#FF5722",
      borderRadius: 5,
      marginVertical: 5,
    },
    restartButtonText: {
      color: "white",
      fontSize: 14,
      fontWeight: "bold",
      textAlign: "center",
    },
  });

  const renderCameraStatus = () => {
    const timeSinceLastEvent = Date.now() - lastEventTime.current;
    const isUnstable = timeSinceLastEvent > 5000 && state.isRunning;
    const isLost = timeSinceLastEvent > 10000 && state.isRunning;

    let containerStyle, textStyle, iconName, iconColor;

    if (isLost) {
      containerStyle = styles.cameraLostStyle;
      textStyle = styles.cameraLostText;
      iconName = "camera-off";
      iconColor = "#C62828";
    } else if (isUnstable) {
      containerStyle = styles.cameraUnstableStyle;
      textStyle = styles.cameraUnstableText;
      iconName = "camera-wireless";
      iconColor = "#F57C00";
    } else {
      containerStyle = styles.cameraActiveStyle;
      textStyle = styles.cameraActiveText;
      iconName = "camera";
      iconColor = "#2E7D32";
    }

    return (
      <View style={[styles.cameraStatusContainer, containerStyle]}>
        <MaterialCommunityIcons name={iconName as any} size={20} color={iconColor} />
        <Text style={[styles.cameraStatusText, textStyle]}>
          {getCameraStatusText()}
        </Text>
      </View>
    );
  };

  const renderDebugInfo = () => {
    if (!state.isRunning) return null;

    return (
      <View style={styles.debugInfo}>
        <Text style={styles.debugText}>
          Debug Info:{'\n'}
          • Android Version: {Platform.Version}{'\n'}
          • Service Available: {EyeService.isAvailable() ? 'YES' : 'NO'}{'\n'}
          • Service Status: {state.status}{'\n'}
          • Last Event: {currentEvent}{'\n'}
          • Time Since Last Event: {lastEventTime.current > 0 ?
            `${Date.now() - lastEventTime.current}ms ago` : 'Never'}{'\n'}
          • Restart Attempts: {serviceRestartAttempts.current}/{maxRestartAttempts}
        </Text>

        {state.status === "camera_lost" && (
          <TouchableOpacity style={styles.restartButton} onPress={handleCameraLoss}>
            <Text style={styles.restartButtonText}>Manual Restart</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <HeaderNavigation title="Eye Tracking" />

        {Platform.Version && Number(Platform.Version) >= 34 && (
          <View style={styles.android14Warning}>
            <Text style={styles.android14WarningText}>
              Android 14 Detected: Enhanced permissions required for background eye tracking
            </Text>
          </View>
        )}

        {(!backgroundPermissionGranted || cameraPermissionDenied) && (
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>
              {Platform.Version && Number(Platform.Version) >= 34
                ? "Android 14 requires camera, foreground service, and notification permissions for background eye tracking"
                : "Background permissions required for eye tracking when app is not active"
              }
            </Text>
          </View>
        )}

        {state.isRunning && renderCameraStatus()}

        {state.isBackgroundActive && (
          <View style={styles.backgroundIndicator}>
            <MaterialCommunityIcons name="circle" size={12} color="white" />
            <Text style={styles.backgroundIndicatorText}>
              Background mode active - Native service running
            </Text>
          </View>
        )}

        {renderDebugInfo()}

        <View style={styles.eventContainer}>
          <Text style={styles.eventText}>
            {!state.isRunning
              ? "Service stopped"
              : state.status === "camera_lost"
                ? "Camera connection lost - attempting recovery..."
                : state.isBackgroundActive
                  ? "Background mode: Native service tracking eyes"
                  : eventConfigs[currentEvent]?.label || "Waiting for eye event..."}
          </Text>

          {state.isRunning &&
            !state.isBackgroundActive &&
            currentEvent !== "none" &&
            eventConfigs[currentEvent] && (
              <Animated.View style={{ opacity: fadeAnim }}>
                <Image
                  source={eventConfigs[currentEvent].imagePath}
                  style={styles.eventImage}
                />
              </Animated.View>
            )}

          {state.isRunning &&
            !state.isBackgroundActive &&
            (!currentEvent || currentEvent === "none") &&
            state.status !== "camera_lost" && (
              <ActivityIndicator size="large" color={colors.primary} />
            )}

          {state.status === "camera_lost" && (
            <MaterialCommunityIcons name="camera-off" size={60} color="#FF5722" />
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            state.isRunning ? styles.buttonStop : styles.buttonStart,
          ]}
          onPress={toggleService}
          disabled={!state.isInitialized || state.status === "initializing"}
        >
          <Text style={styles.buttonText}>
            {state.isRunning ? "Stop Eye Tracking" : "Start Eye Tracking"}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.status, { color: getStatusColor() }]}>
          Status: {getStatusText()}
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default EyeTracking;