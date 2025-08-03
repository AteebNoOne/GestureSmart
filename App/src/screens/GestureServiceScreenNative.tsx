import React, { useEffect, useState, useRef, useCallback } from "react";
import {
    NativeEventEmitter,
    EmitterSubscription,
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
    NativeModules,
    PermissionsAndroid,
    Alert,
    Linking,
    ImageRequireSource,
} from "react-native";
import {
    handleCursor,
    handleReturn,
    handleScrollDown,
    handleScrollUp,
    handleSwipeLeft,
    handleSwipeRight,
    handleTap,
} from "../features/actions";
import {
    responsiveFontSize,
    responsiveHeight,
    responsiveWidth,
} from "react-native-responsive-dimensions";
import { useTheme } from "../hooks/useTheme";
import { typography } from "../constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NavigationProp } from "@react-navigation/native";
import * as Notifications from "expo-notifications";

// Types
interface GestureConfig {
    label: string;
    imagePath: ImageRequireSource;
}

interface GestureConfigs {
    [key: string]: GestureConfig;
}

interface GestureScreenProps {
    navigation: NavigationProp<any>;
}

interface AppState {
    isRunning: boolean;
    isInitialized: boolean;
    isBackgroundActive: boolean;
    status: "initializing" | "stopped" | "running" | "background" | "error" | "camera_lost";
}

// Native module interface
const GestureServiceModule = NativeModules.GestureService;
const { BatteryOptimization } = NativeModules;

// Configure notifications for background mode
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
    }),
});

const GestureServiceNative: React.FC<GestureScreenProps> = ({ navigation }) => {
    // Refs
    const appState = useRef<AppStateStatus>(AppState.currentState);
    const lastAdjustmentTime = useRef<number>(0);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const isMountedRef = useRef<boolean>(true);
    const gestureSubscriptionRef = useRef<EmitterSubscription | null>(null);
    const cameraHealthCheckInterval = useRef<NodeJS.Timeout | null>(null);
    const serviceRestartAttempts = useRef<number>(0);
    const maxRestartAttempts = 3;

    const [handDetectionStatus, setHandDetectionStatus] = useState({
        status: 'no_hands',
        landmarkCount: 0,
        confidence: 0,
        lastUpdate: 0,
        isActive: false
    });

    // State
    const [currentGesture, setCurrentGesture] = useState<string>("none");
    const [backgroundPermissionGranted, setBackgroundPermissionGranted] = useState<boolean>(false);
    const [cameraPermissionDenied, setCameraPermissionDenied] = useState<boolean>(false);
    const [state, setState] = useState<AppState>({
        isRunning: false,
        isInitialized: false,
        isBackgroundActive: false,
        status: "initializing",
    });

    const { colors } = useTheme();

    // Gesture configurations
    const gestureConfigs: GestureConfigs = {
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

    // Safe state update helper
    const safeSetState = useCallback((updater: (prev: AppState) => AppState) => {
        if (isMountedRef.current) {
            setState(updater);
        }
    }, []);

    const requestAndroidPermissions = useCallback(async (): Promise<void> => {
        try {
            if (Platform.OS === 'android') {
                const permissions: string[] = [
                    'android.permission.CAMERA',
                    'android.permission.WAKE_LOCK',
                ];



                // Android 14 specific permissions
                if (Platform.Version >= 28) {
                    permissions.push('android.permission.FOREGROUND_SERVICE');
                }

                if (Platform.Version >= 34) { // Android 14
                    permissions.push(
                        'android.permission.FOREGROUND_SERVICE_CAMERA',
                        'android.permission.POST_NOTIFICATIONS'
                    );
                }

                // Request permissions with rationale for Android 14
                const results = await PermissionsAndroid.requestMultiple(permissions);
                const allGranted = Object.values(results).every(
                    result => result === PermissionsAndroid.RESULTS.GRANTED
                );
                console.log("all granted", allGranted)

                if (allGranted) {
                    await requestNotificationPermission();
                    await requestBatteryOptimizationExemption();
                    setBackgroundPermissionGranted(true);
                    setCameraPermissionDenied(false);
                } else {
                    const cameraPermission = results['android.permission.CAMERA'];
                    if (cameraPermission === PermissionsAndroid.RESULTS.DENIED ||
                        cameraPermission === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
                        setCameraPermissionDenied(true);
                    }

                    Alert.alert(
                        'Permissions Required',
                        'Android 14 requires all permissions for background gesture detection. Please enable them in Settings.',
                        [
                            { text: 'Open Settings', onPress: () => Linking.openSettings() },
                            { text: 'Cancel', style: 'cancel' }
                        ]
                    );
                }
            } else {
                await requestNotificationPermission();
                setBackgroundPermissionGranted(true);
            }
        } catch (error) {
            console.error('Permission request failed:', error);
        }
    }, []);

    // Request battery optimization exemption for Android 14
    const requestBatteryOptimizationExemption = useCallback(async (): Promise<void> => {
        try {
            if (Platform.OS === 'android' && Platform.Version >= 34) {
                // Check if we can request battery optimization exemption
                const { PowerManager } = NativeModules;
                if (PowerManager && PowerManager.requestIgnoreBatteryOptimizations) {
                    await PowerManager.requestIgnoreBatteryOptimizations();
                }
            }
        } catch (error) {
            console.log('Battery optimization exemption not available:', error);
        }
    }, []);

    // Enhanced notification permission request
    const requestNotificationPermission = useCallback(async (): Promise<void> => {
        try {
            const { status } = await Notifications.requestPermissionsAsync({
                ios: {
                    allowAlert: true,
                    allowBadge: true,
                    allowSound: false,
                },
                android: {
                    allowAlert: true,
                    allowBadge: true,
                    allowSound: false,
                },
            });

            if (status !== 'granted') {
                Alert.alert(
                    'Notification Permission',
                    'Notifications help monitor gesture service status in background mode.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.error('Notification permission request failed:', error);
        }
    }, []);

    // Camera health monitoring for Android 14
    const startCameraHealthCheck = useCallback(() => {
        if (cameraHealthCheckInterval.current) {
            clearInterval(cameraHealthCheckInterval.current);
        }

        cameraHealthCheckInterval.current = setInterval(() => {
            const timeSinceLastUpdate = Date.now() - handDetectionStatus.lastUpdate;

            // If no camera updates for 5 seconds while service is running
            if (state.isRunning && timeSinceLastUpdate > 5000 && handDetectionStatus.lastUpdate > 0) {
                console.warn('Camera feed appears to be lost - attempting restart');
                safeSetState(prev => ({ ...prev, status: "camera_lost" }));
                handleCameraLoss();
            }
        }, 3000); // Check every 3 seconds
    }, [handDetectionStatus.lastUpdate, state.isRunning, safeSetState]);

    // Handle camera loss and attempt recovery
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
            // Stop service
            await GestureServiceModule.stopService();

            // Wait a moment
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Restart service
            await GestureServiceModule.startService();

            safeSetState(prev => ({ ...prev, status: "running" }));
            console.log('Service restarted successfully');

            // Reset attempts counter on successful restart
            setTimeout(() => {
                serviceRestartAttempts.current = 0;
            }, 30000); // Reset after 30 seconds of stable operation

        } catch (error) {
            console.error('Service restart failed:', error);
            safeSetState(prev => ({ ...prev, status: "error" }));
        }
    }, [safeSetState]);

    // Initialize gesture service
    useEffect(() => {
        isMountedRef.current = true;

        const initialize = async () => {
            try {
                await requestAndroidPermissions();
                safeSetState((prev) => ({
                    ...prev,
                    isInitialized: true,
                    status: "stopped",
                }));

                // Set up gesture event listener
                if (Platform.OS === 'android') {
                    const eventEmitter = new NativeEventEmitter(GestureServiceModule);

                    // Gesture events
                    const gestureSubscription = eventEmitter.addListener(
                        GestureServiceModule.EVENT_NAME,
                        (data: { gesture: React.SetStateAction<string>; }) => {
                            console.log('Gesture event received:', data);
                            setCurrentGesture(data.gesture);
                            handleGesture(data.gesture);
                        }
                    );

                    // Enhanced hand detection events
                    const handDetectionSubscription = eventEmitter.addListener(
                        GestureServiceModule.HAND_DETECTION_EVENT_NAME,
                        (data: { status: string; landmarkCount: any; confidence: any; }) => {
                            console.log('Hand detection event:', data);
                            setHandDetectionStatus({
                                status: data.status,
                                landmarkCount: data.landmarkCount,
                                confidence: data.confidence,
                                lastUpdate: Date.now(),
                                isActive: data.status === 'hand_detected'
                            });

                            // Reset camera loss status if we're getting updates
                            if (state.status === "camera_lost") {
                                safeSetState(prev => ({
                                    ...prev,
                                    status: prev.isBackgroundActive ? "background" : "running"
                                }));
                            }
                        }
                    );

                    // Service status events for Android 14
                    const serviceStatusSubscription = eventEmitter.addListener(
                        'GestureServiceStatus',
                        (data: { status: string; }) => {
                            console.log('Service status event:', data);
                            if (data.status === 'camera_error' || data.status === 'service_killed') {
                                handleCameraLoss();
                            }
                        }
                    );

                    // Store subscriptions for cleanup
                    gestureSubscriptionRef.current = {
                        gesture: gestureSubscription,
                        handDetection: handDetectionSubscription,
                        serviceStatus: serviceStatusSubscription
                    };
                }
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
            if (gestureSubscriptionRef.current) {
                Object.values(gestureSubscriptionRef.current).forEach(subscription => {
                    if (subscription && typeof subscription.remove === 'function') {
                        subscription.remove();
                    }
                });
                gestureSubscriptionRef.current = null;
            }
        };
    }, [requestAndroidPermissions, safeSetState, handleCameraLoss, state.status]);

    const getHandDetectionStatusText = useCallback(() => {
        const timeSinceUpdate = Date.now() - handDetectionStatus.lastUpdate;

        if (timeSinceUpdate > 10000) {
            return "⚠️ Camera feed lost - attempting recovery";
        }

        if (timeSinceUpdate > 2000) {
            return "📷 Camera feed unstable";
        }

        switch (handDetectionStatus.status) {
            case 'hand_detected':
                return `✋ Hand detected (${handDetectionStatus.landmarkCount} landmarks, ${Math.round(handDetectionStatus.confidence * 100)}% confidence)`;
            case 'no_hands':
                return "👀 Camera active, no hands detected";
            default:
                return "Camera initializing...";
        }
    }, [handDetectionStatus]);

    // Enhanced app state handling for Android 14
    useEffect(() => {
        const handleAppStateChange = async (nextAppState: AppStateStatus): Promise<void> => {
            console.log('App state changed:', appState.current, '->', nextAppState);

            if (state.isRunning) {
                if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
                    // App going to background
                    safeSetState(prev => ({
                        ...prev,
                        isBackgroundActive: true,
                        status: "background"
                    }));
                    startCameraHealthCheck();
                } else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                    // App coming to foreground
                    safeSetState(prev => ({
                        ...prev,
                        isBackgroundActive: false,
                        status: "running"
                    }));

                    // Clear health check when in foreground
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
    }, [safeSetState, state.isRunning, startCameraHealthCheck]);

    // Gesture animation
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

    // Gesture handler
    const handleGesture = useCallback(async (gesture: string): Promise<void> => {
        console.log(`Gesture detected: ${gesture} (${state.isBackgroundActive ? 'background' : 'foreground'} mode)`);

        try {
            // Handle gesture in any mode
            switch (gesture) {
                case "cursor":
                    await handleCursor();
                    break;
                case "scroll_up":
                    await handleScrollUp();
                    break;
                case "scroll_down":
                    await handleScrollDown();
                    break;
                case "swipe_left":
                    await handleSwipeLeft();
                    break;
                case "swipe_right":
                    await handleSwipeRight();
                    break;
                case "tap":
                    await handleTap(0, 0);
                    break;
                case "return":
                    await handleReturn();
                    break;
                default:
                    break;
            }
        } catch (error) {
            console.error('Error handling gesture:', error);
        }
    }, [state.isBackgroundActive]);

    // Enhanced service toggle with Android 14 considerations
    const toggleService = useCallback(async (): Promise<void> => {
        const isIgnoring = await BatteryOptimization.checkBatteryOptimization();
        if (!isIgnoring) {
            // Request to disable battery optimization
            await BatteryOptimization.requestIgnoreBatteryOptimization();
            // Also open auto-start settings for manufacturer-specific settings
            await BatteryOptimization.openAutoStartSettings();
        }
        try {
            if (!backgroundPermissionGranted || cameraPermissionDenied) {
                Alert.alert(
                    'Permissions Required',
                    Platform.Version >= 34
                        ? 'Android 14 requires camera and foreground service permissions for background gesture detection.'
                        : 'Please grant all required permissions for background gesture detection.',
                    [
                        { text: 'Grant Permissions', onPress: requestAndroidPermissions },
                        { text: 'Open Settings', onPress: () => Linking.openSettings() },
                        { text: 'Cancel', style: 'cancel' },
                    ]
                );
                return;
            }

            if (!state.isRunning) {
                // Reset restart attempts
                serviceRestartAttempts.current = 0;

                // Start native service
                try {
                    await GestureServiceModule.startService();
                    safeSetState((prev) => ({
                        ...prev,
                        isRunning: true,
                        status: "running",
                    }));

                    // Start health monitoring if in background
                    if (AppState.currentState !== 'active') {
                        startCameraHealthCheck();
                    }
                } catch (error) {
                    console.error('Failed to start native service:', error);
                    Alert.alert(
                        'Service Start Failed',
                        Platform.Version >= 34
                            ? 'Unable to start gesture service. Please check Android 14 foreground service permissions.'
                            : 'Unable to start gesture service. Please check permissions.',
                        [{ text: 'OK' }]
                    );
                    return;
                }
            } else {
                // Stop native service
                try {
                    // Clear health monitoring
                    if (cameraHealthCheckInterval.current) {
                        clearInterval(cameraHealthCheckInterval.current);
                        cameraHealthCheckInterval.current = null;
                    }

                    // Make sure cursor is closed before stopping service
                    const GestureActions = NativeModules.GestureActions;
                    try {
                        await GestureActions.getCursorStatus().then(async (isActive: boolean) => {
                            if (isActive) {
                                await GestureActions.cursor();
                            }
                        });
                    } catch (e) {
                        console.error('Error checking cursor status:', e);
                    }

                    await GestureServiceModule.stopService();
                    safeSetState((prev) => ({
                        ...prev,
                        isRunning: false,
                        status: "stopped",
                        isBackgroundActive: false,
                    }));
                } catch (error) {
                    console.error('Failed to stop service:', error);
                    return;
                }
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
            paddingTop: Platform.OS === "ios" ? responsiveHeight(2) : responsiveHeight(4),
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
            textAlign: "center",
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
            backgroundColor: Platform.Version >= 34 ? "#ffcdd2" : "#ffeb3b",
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
        handDetectionContainer: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginVertical: 10,
            padding: 15,
            borderRadius: 8,
            borderWidth: 2,
        },
        handDetectedStyle: {
            backgroundColor: "#E8F5E8",
            borderColor: "#4CAF50",
        },
        noHandsStyle: {
            backgroundColor: "#FFF3E0",
            borderColor: "#FF9800",
        },
        noFeedStyle: {
            backgroundColor: "#FFEBEE",
            borderColor: "#F44336",
        },
        cameraLostStyle: {
            backgroundColor: "#FFF3E0",
            borderColor: "#FF5722",
        },
        handDetectionText: {
            fontSize: 14,
            fontWeight: "600",
            textAlign: "center",
            marginLeft: 8,
        },
        handDetectedText: {
            color: "#2E7D32",
        },
        noHandsText: {
            color: "#F57C00",
        },
        noFeedText: {
            color: "#C62828",
        },
        cameraLostText: {
            color: "#E65100",
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

    const renderHandDetectionStatus = () => {
        const timeSinceUpdate = Date.now() - handDetectionStatus.lastUpdate;
        const isStale = timeSinceUpdate > 2000;
        const isCameraLost = timeSinceUpdate > 5000 && state.isRunning;

        let containerStyle, textStyle, iconName, iconColor;

        if (isCameraLost) {
            containerStyle = styles.cameraLostStyle;
            textStyle = styles.cameraLostText;
            iconName = "camera-off";
            iconColor = "#E65100";
        } else if (isStale) {
            containerStyle = styles.noFeedStyle;
            textStyle = styles.noFeedText;
            iconName = "camera-off";
            iconColor = "#C62828";
        } else if (handDetectionStatus.isActive) {
            containerStyle = styles.handDetectedStyle;
            textStyle = styles.handDetectedText;
            iconName = "hand-okay";
            iconColor = "#2E7D32";
        } else {
            containerStyle = styles.noHandsStyle;
            textStyle = styles.noHandsText;
            iconName = "eye";
            iconColor = "#F57C00";
        }

        return (
            <View style={[styles.handDetectionContainer, containerStyle]}>
                <MaterialCommunityIcons name={iconName} size={20} color={iconColor} />
                <Text style={[styles.handDetectionText, textStyle]}>
                    {getHandDetectionStatusText()}
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
                    • Service: {state.status}{'\n'}
                    • Hand Status: {handDetectionStatus.status}{'\n'}
                    • Landmarks: {handDetectionStatus.landmarkCount}{'\n'}
                    • Confidence: {Math.round(handDetectionStatus.confidence * 100)}%{'\n'}
                    • Last Update: {handDetectionStatus.lastUpdate > 0 ?
                        `${Date.now() - handDetectionStatus.lastUpdate}ms ago` : 'Never'}{'\n'}
                    • Current Gesture: {currentGesture}{'\n'}
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

                {Platform.Version >= 34 && (
                    <View style={styles.android14Warning}>
                        <Text style={styles.android14WarningText}>
                            Android 14 Detected: Enhanced permissions and battery optimization exemption required for stable background operation
                        </Text>
                    </View>
                )}

                {(!backgroundPermissionGranted || cameraPermissionDenied) && (
                    <View style={styles.permissionContainer}>
                        <Text style={styles.permissionText}>
                            {Platform.Version >= 34
                                ? "Android 14 requires camera, foreground service, and notification permissions for background gesture detection"
                                : "Background permissions required for gesture detection when app is not active"
                            }
                        </Text>
                    </View>
                )}

                {state.isRunning && renderHandDetectionStatus()}

                {state.isBackgroundActive && (
                    <View style={styles.backgroundIndicator}>
                        <MaterialCommunityIcons name="circle" size={12} color="white" />
                        <Text style={styles.backgroundIndicatorText}>
                            Background mode active - Native service running
                        </Text>
                    </View>
                )}

                {renderDebugInfo()}

                <View style={styles.gestureContainer}>
                    <Text style={styles.gestureText}>
                        {!state.isRunning
                            ? "Service stopped"
                            : state.status === "camera_lost"
                                ? "Camera connection lost - attempting recovery..."
                                : state.isBackgroundActive
                                    ? "Background mode: Native service handling gestures"
                                    : gestureConfigs[currentGesture]?.label || "Waiting for gesture..."}
                    </Text>

                    {state.isRunning &&
                        !state.isBackgroundActive &&
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
                        !state.isBackgroundActive &&
                        (!currentGesture || currentGesture === "none") &&
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
                        {state.isRunning ? "Stop Gesture Service" : "Start Gesture Service"}
                    </Text>
                </TouchableOpacity>

                <Text style={[styles.status, { color: getStatusColor() }]}>
                    Status: {getStatusText()}
                </Text>
            </View>
        </SafeAreaView>
    );
};

export default GestureServiceNative;