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
import { NavigationProp, useNavigation } from "@react-navigation/native";
import * as Notifications from "expo-notifications";

// Types
interface GestureConfig {
    label: string;
    imagePath: ImageRequireSource;
}

interface GestureConfigs {
    [key: string]: GestureConfig;
}

interface AppLocalState {
    isRunning: boolean;
    isInitialized: boolean;
    isBackgroundActive: boolean;
    status: "initializing" | "stopped" | "running" | "background" | "error" | "camera_lost" | "permission_denied";
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
        shouldShowBanner: false,
        shouldShowList: false,
    }),
});

const GestureServiceNative: React.FC = () => {
    // Refs
    const navigation = useNavigation<NavigationProp<any>>();
    const appState = useRef<AppStateStatus>(AppState.currentState);
    const lastAdjustmentTime = useRef<number>(0);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const isMountedRef = useRef<boolean>(true);
    const gestureSubscriptionRef = useRef<{
        gesture?: EmitterSubscription;
        handDetection?: EmitterSubscription;
        serviceStatus?: EmitterSubscription;
    } | null>(null);

    const cameraHealthCheckInterval = useRef<NodeJS.Timeout | null>(null);
    const serviceRestartAttempts = useRef<number>(0);
    const maxRestartAttempts = 3;
    const permissionCheckInterval = useRef<NodeJS.Timeout | null>(null);

    const [handDetectionStatus, setHandDetectionStatus] = useState({
        status: 'no_hands',
        landmarkCount: 0,
        confidence: 0,
        lastUpdate: 0,
        isActive: false
    });

    // Enhanced state management
    const [currentGesture, setCurrentGesture] = useState<string>("none");
    const [backgroundPermissionGranted, setBackgroundPermissionGranted] = useState<boolean>(false);
    const [cameraPermissionDenied, setCameraPermissionDenied] = useState<boolean>(false);
    const [notificationPermissionGranted, setNotificationPermissionGranted] = useState<boolean>(false);
    const [batteryOptimizationDisabled, setBatteryOptimizationDisabled] = useState<boolean>(false);
    const [foregroundServicePermissionGranted, setForegroundServicePermissionGranted] = useState<boolean>(false);

    const [state, setState] = useState<AppLocalState>({
        isRunning: false,
        isInitialized: false,
        isBackgroundActive: false,
        status: "initializing",
    });

    const { colors } = useTheme();

    // Enhanced gesture configurations
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
    const safeSetState = useCallback((updater: (prev: AppLocalState) => AppLocalState) => {
        if (isMountedRef.current) {
            setState(updater);
        }
    }, []);

    // Enhanced Android 14+ permission system
    const requestAndroidPermissions = useCallback(async () => {
        try {
            if (Platform.OS === 'android') {
                console.log('Requesting Android permissions for API level:', Platform.Version);

                // Base permissions for all Android versions
                let permissions = [
                    'android.permission.CAMERA',
                    'android.permission.WAKE_LOCK',
                ];

                // Android 9+ (API 28+) permissions
                if (Platform.Version >= 28) {
                    permissions.push('android.permission.FOREGROUND_SERVICE');
                }

                // Android 14+ (API 34+) specific permissions
                if (Platform.Version >= 34) {
                    permissions.push(
                        'android.permission.FOREGROUND_SERVICE_CAMERA',
                        'android.permission.POST_NOTIFICATIONS'
                    );
                }

                console.log('Requesting permissions:', permissions);
                const results = await PermissionsAndroid.requestMultiple(permissions);
                console.log("Permission results:", results);

                // Check individual permissions
                const cameraGranted = results['android.permission.CAMERA'] === PermissionsAndroid.RESULTS.GRANTED;
                const foregroundServiceGranted = Platform.Version >= 28 ?
                    results['android.permission.FOREGROUND_SERVICE'] === PermissionsAndroid.RESULTS.GRANTED : true;
                const foregroundServiceCameraGranted = Platform.Version >= 34 ?
                    results['android.permission.FOREGROUND_SERVICE_CAMERA'] === PermissionsAndroid.RESULTS.GRANTED : true;
                const notificationGranted = Platform.Version >= 34 ?
                    results['android.permission.POST_NOTIFICATIONS'] === PermissionsAndroid.RESULTS.GRANTED : true;

                // Update individual permission states
                setCameraPermissionDenied(!cameraGranted);
                setForegroundServicePermissionGranted(foregroundServiceGranted && foregroundServiceCameraGranted);
                setNotificationPermissionGranted(notificationGranted);

                const allCriticalGranted = cameraGranted && foregroundServiceGranted && foregroundServiceCameraGranted;
                setBackgroundPermissionGranted(allCriticalGranted);

                if (allCriticalGranted) {
                    console.log('All critical permissions granted');
                    // Request additional permissions
                    await requestNotificationPermission();
                    await requestBatteryOptimizationExemption();
                } else {
                    console.log('Some critical permissions denied');
                    Alert.alert(
                        'Permissions Required',
                        Platform.Version >= 34
                            ? 'Android 14+ requires camera and foreground service permissions for background gesture detection. Please enable them in Settings.'
                            : 'Camera and foreground service permissions are required for gesture detection.',
                        [
                            { text: 'Open Settings', onPress: () => Linking.openSettings() },
                            { text: 'Retry', onPress: requestAndroidPermissions },
                            { text: 'Cancel', style: 'cancel' }
                        ]
                    );
                }
            } else {
                // iOS path
                try {
                    await requestNotificationPermission();
                    setBackgroundPermissionGranted(true);
                    setCameraPermissionDenied(false);
                    setNotificationPermissionGranted(true);
                } catch (error) {
                    console.error('iOS notification permission failed:', error);
                    setBackgroundPermissionGranted(false);
                    setCameraPermissionDenied(false);
                    setNotificationPermissionGranted(false);
                }
            }
        } catch (error) {
            console.error('Permission request failed:', error);
            // Set safe defaults
            setBackgroundPermissionGranted(false);
            setCameraPermissionDenied(true);
            setForegroundServicePermissionGranted(false);
            setNotificationPermissionGranted(false);
        }
    }, []);

    // Enhanced battery optimization handling for Android 14+
    const requestBatteryOptimizationExemption = useCallback(async (): Promise<void> => {
        try {
            if (Platform.OS === 'android') {
                console.log('Checking battery optimization status...');

                if (BatteryOptimization) {
                    const isOptimized = await BatteryOptimization.checkBatteryOptimization();
                    setBatteryOptimizationDisabled(!isOptimized);

                    if (isOptimized) {
                        console.log('Battery optimization is enabled, requesting exemption...');

                        Alert.alert(
                            'Battery Optimization',
                            'For reliable background operation, please disable battery optimization for this app.',
                            [
                                {
                                    text: 'Disable Optimization',
                                    onPress: async () => {
                                        try {
                                            await BatteryOptimization.requestIgnoreBatteryOptimization();
                                            // Also try to open auto-start settings
                                            if (BatteryOptimization.openAutoStartSettings) {
                                                await BatteryOptimization.openAutoStartSettings();
                                            }
                                        } catch (error) {
                                            console.error('Error requesting battery optimization exemption:', error);
                                        }
                                    }
                                },
                                { text: 'Skip', style: 'cancel' }
                            ]
                        );
                    } else {
                        console.log('Battery optimization already disabled');
                    }
                } else {
                    console.log('BatteryOptimization module not available');
                    setBatteryOptimizationDisabled(true); // Assume it's fine
                }
            }
        } catch (error) {
            console.log('Battery optimization check failed:', error);
            setBatteryOptimizationDisabled(true); // Assume it's fine
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

            const granted = status === 'granted';
            setNotificationPermissionGranted(granted);

            if (!granted) {
                console.log('Notification permission denied');
                if (Platform.Version >= 34) {
                    Alert.alert(
                        'Notification Permission Required',
                        'Android 14+ requires notification permission for foreground services.',
                        [{ text: 'OK' }]
                    );
                }
            } else {
                console.log('Notification permission granted');
            }
        } catch (error) {
            console.error('Notification permission request failed:', error);
            setNotificationPermissionGranted(false);
        }
    }, []);

    // Enhanced camera health monitoring
    const startCameraHealthCheck = useCallback(() => {
        if (cameraHealthCheckInterval.current) {
            clearInterval(cameraHealthCheckInterval.current);
        }

        cameraHealthCheckInterval.current = setInterval(() => {
            const timeSinceLastUpdate = Date.now() - handDetectionStatus.lastUpdate;

            // More aggressive monitoring for Android 14+
            const timeoutThreshold = Platform.Version >= 34 ? 4000 : 5000;

            if (state.isRunning && timeSinceLastUpdate > timeoutThreshold && handDetectionStatus.lastUpdate > 0) {
                console.warn(`Camera feed lost for ${timeSinceLastUpdate}ms - attempting restart`);
                safeSetState(prev => ({ ...prev, status: "camera_lost" }));
                handleCameraLoss();
            }
        }, 2000); // Check every 2 seconds for Android 14+
    }, [handDetectionStatus.lastUpdate, state.isRunning, safeSetState]);

    // Enhanced camera loss handling
    const handleCameraLoss = useCallback(async () => {
        if (serviceRestartAttempts.current >= maxRestartAttempts) {
            console.error('Max restart attempts reached');
            safeSetState(prev => ({ ...prev, status: "error" }));
            Alert.alert(
                'Camera Service Failed',
                'Unable to maintain camera connection. This might be due to Android 14+ restrictions. Try restarting the app.',
                [
                    {
                        text: 'Restart App', onPress: () => {
                            // Could implement app restart here
                        }
                    },
                    { text: 'OK' }
                ]
            );
            return;
        }

        serviceRestartAttempts.current++;
        console.log(`Attempting service restart ${serviceRestartAttempts.current}/${maxRestartAttempts}`);

        try {
            // Stop service
            if (GestureServiceModule && GestureServiceModule.stopService) {
                await GestureServiceModule.stopService();
            }

            // Wait longer for Android 14+
            const waitTime = Platform.Version >= 34 ? 3000 : 2000;
            await new Promise(resolve => setTimeout(resolve, waitTime));

            // Restart service
            if (GestureServiceModule && GestureServiceModule.startService) {
                await GestureServiceModule.startService();
                safeSetState(prev => ({ ...prev, status: "running" }));
                console.log('Service restarted successfully');

                // Reset attempts counter on successful restart
                setTimeout(() => {
                    serviceRestartAttempts.current = 0;
                }, 30000);
            }
        } catch (error) {
            console.error('Service restart failed:', error);
            safeSetState(prev => ({ ...prev, status: "error" }));
        }
    }, [safeSetState]);

    // Enhanced permission monitoring for Android 14+
    const startPermissionMonitoring = useCallback(() => {
        if (Platform.OS === 'android' && Platform.Version >= 34) {
            if (permissionCheckInterval.current) {
                clearInterval(permissionCheckInterval.current);
            }

            permissionCheckInterval.current = setInterval(async () => {
                try {
                    // Check if permissions are still granted
                    const cameraPermission = await PermissionsAndroid.check('android.permission.CAMERA');
                    const foregroundServicePermission = await PermissionsAndroid.check('android.permission.FOREGROUND_SERVICE_CAMERA');

                    if (!cameraPermission || !foregroundServicePermission) {
                        console.warn('Permissions revoked during runtime');
                        safeSetState(prev => ({ ...prev, status: "permission_denied" }));
                        setCameraPermissionDenied(!cameraPermission);
                        setForegroundServicePermissionGranted(foregroundServicePermission);
                    }
                } catch (error) {
                    console.error('Error checking permissions:', error);
                }
            }, 10000); // Check every 10 seconds
        }
    }, [safeSetState]);

    useEffect(() => {
        isMountedRef.current = true;

        const initialize = async () => {
            try {
                console.log('Starting initialization for Android API:', Platform.Version);

                // Always set initialized to true first
                safeSetState((prev) => ({
                    ...prev,
                    isInitialized: true,
                    status: "stopped",
                }));

                // Request permissions
                try {
                    await requestAndroidPermissions();
                    console.log('Permissions request completed');
                } catch (permError) {
                    console.error('Permission request failed:', permError);
                    safeSetState(prev => ({ ...prev, status: "permission_denied" }));
                }

                // Set up event listeners for Android
                if (Platform.OS === 'android' && GestureServiceModule) {
                    try {
                        const eventEmitter = new NativeEventEmitter(GestureServiceModule);

                        // Gesture events
                        const gestureSubscription = eventEmitter.addListener(
                            GestureServiceModule.EVENT_NAME || 'GestureEvent',
                            (data) => {
                                console.log('Gesture event received:', data);
                                setCurrentGesture(data.gesture);
                                handleGesture(data.gesture);
                            }
                        );

                        // Hand detection events
                        const handDetectionSubscription = eventEmitter.addListener(
                            GestureServiceModule.HAND_DETECTION_EVENT_NAME || 'HandDetectionEvent',
                            (data) => {
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

                        // Service status events
                        const serviceStatusSubscription = eventEmitter.addListener(
                            'GestureServiceStatus',
                            (data) => {
                                console.log('Service status event:', data);
                                if (data.status === 'camera_error' || data.status === 'service_killed') {
                                    handleCameraLoss();
                                }
                            }
                        );

                        gestureSubscriptionRef.current = {
                            gesture: gestureSubscription,
                            handDetection: handDetectionSubscription,
                            serviceStatus: serviceStatusSubscription
                        };

                        console.log('Event listeners set up successfully');
                    } catch (eventError) {
                        console.error('Failed to set up event listeners:', eventError);
                    }
                }

                // Start permission monitoring for Android 14+
                startPermissionMonitoring();

                console.log('Initialization completed successfully');

            } catch (error) {
                console.error("Critical initialization failed:", error);
                safeSetState((prev) => ({
                    ...prev,
                    isInitialized: true,
                    status: "error"
                }));
            }
        };

        initialize();

        return () => {
            isMountedRef.current = false;
            if (cameraHealthCheckInterval.current) {
                clearInterval(cameraHealthCheckInterval.current);
            }
            if (permissionCheckInterval.current) {
                clearInterval(permissionCheckInterval.current);
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
    }, [requestAndroidPermissions, safeSetState, startPermissionMonitoring]);

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

    // Enhanced app state handling for Android 14+
    useEffect(() => {
        const handleAppStateChange = async (nextAppState: AppStateStatus): Promise<void> => {
            console.log('App state changed:', appState.current, '->', nextAppState);

            if (state.isRunning) {
                if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
                    // App going to background
                    console.log('App going to background - enabling enhanced monitoring');
                    safeSetState(prev => ({
                        ...prev,
                        isBackgroundActive: true,
                        status: "background"
                    }));
                    startCameraHealthCheck();
                } else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                    // App coming to foreground
                    console.log('App coming to foreground');
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

                    // Re-check permissions on foreground return for Android 14+
                    if (Platform.OS === 'android' && Platform.Version >= 34) {
                        setTimeout(async () => {
                            try {
                                const cameraPermission = await PermissionsAndroid.check('android.permission.CAMERA');
                                const foregroundServicePermission = await PermissionsAndroid.check('android.permission.FOREGROUND_SERVICE_CAMERA');

                                if (!cameraPermission || !foregroundServicePermission) {
                                    console.warn('Permissions lost while in background');
                                    setCameraPermissionDenied(!cameraPermission);
                                    setForegroundServicePermissionGranted(foregroundServicePermission);
                                    safeSetState(prev => ({ ...prev, status: "permission_denied" }));
                                }
                            } catch (error) {
                                console.error('Error checking permissions on foreground:', error);
                            }
                        }, 1000);
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

    // Enhanced service toggle with comprehensive Android 14+ support
    const toggleService = useCallback(async (): Promise<void> => {
        try {
            // Pre-flight checks for Android 14+
            if (Platform.OS === 'android' && Platform.Version >= 34) {
                if (!backgroundPermissionGranted || !foregroundServicePermissionGranted || !notificationPermissionGranted) {
                    Alert.alert(
                        'Android 14+ Permissions Required',
                        'All permissions must be granted for background gesture detection:\n\n• Camera permission\n• Foreground service permission\n• Notification permission',
                        [
                            { text: 'Grant Permissions', onPress: requestAndroidPermissions },
                            { text: 'Open Settings', onPress: () => Linking.openSettings() },
                            { text: 'Cancel', style: 'cancel' },
                        ]
                    );
                    return;
                }

                // Check battery optimization
                if (BatteryOptimization && !batteryOptimizationDisabled) {
                    Alert.alert(
                        'Battery Optimization',
                        'For reliable operation on Android 14+, please disable battery optimization.',
                        [
                            {
                                text: 'Disable Now',
                                onPress: async () => {
                                    try {
                                        await BatteryOptimization.requestIgnoreBatteryOptimization();
                                        if (BatteryOptimization.openAutoStartSettings) {
                                            await BatteryOptimization.openAutoStartSettings();
                                        }
                                    } catch (error) {
                                        console.error('Error requesting battery optimization exemption:', error);
                                    }
                                }
                            },
                            { text: 'Skip', style: 'cancel' },
                        ]
                    );
                }
            } else {
                // Legacy Android versions
                if (!backgroundPermissionGranted || cameraPermissionDenied) {
                    Alert.alert(
                        'Permissions Required',
                        'Camera permission is required for gesture detection.',
                        [
                            { text: 'Grant Permissions', onPress: requestAndroidPermissions },
                            { text: 'Open Settings', onPress: () => Linking.openSettings() },
                            { text: 'Cancel', style: 'cancel' },
                        ]
                    );
                    return;
                }
            }

            if (!state.isRunning) {
                // Start native service
                try {
                    // Reset restart attempts
                    serviceRestartAttempts.current = 0;

                    if (!GestureServiceModule || !GestureServiceModule.startService) {
                        throw new Error('GestureServiceModule not available');
                    }

                    console.log('Starting gesture service...');
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

                    console.log('Gesture service started successfully');
                } catch (error) {
                    console.error('Failed to start native service:', error);
                    Alert.alert(
                        'Service Start Failed',
                        Platform.Version >= 34
                            ? 'Unable to start gesture service. Please check Android 14+ permissions and try restarting the app.'
                            : 'Unable to start gesture service. Please check permissions.',
                        [{ text: 'OK' }]
                    );
                    return;
                }
            } else {
                // Stop native service
                try {
                    console.log('Stopping gesture service...');

                    // Clear health monitoring
                    if (cameraHealthCheckInterval.current) {
                        clearInterval(cameraHealthCheckInterval.current);
                        cameraHealthCheckInterval.current = null;
                    }

                    // Make sure cursor is closed before stopping service
                    const GestureActions = NativeModules.GestureActions;
                    try {
                        if (GestureActions && GestureActions.getCursorStatus) {
                            const isActive = await GestureActions.getCursorStatus();
                            if (isActive && GestureActions.cursor) {
                                await GestureActions.cursor();
                            }
                        }
                    } catch (e) {
                        console.error('Error checking cursor status:', e);
                    }

                    if (GestureServiceModule && GestureServiceModule.stopService) {
                        await GestureServiceModule.stopService();
                    }

                    safeSetState((prev) => ({
                        ...prev,
                        isRunning: false,
                        status: "stopped",
                        isBackgroundActive: false,
                    }));

                    console.log('Gesture service stopped successfully');
                } catch (error) {
                    console.error('Failed to stop service:', error);
                    return;
                }
            }
        } catch (error) {
            console.error("Service toggle failed:", error);
            safeSetState(prev => ({ ...prev, status: "error" }));
        }
    }, [
        backgroundPermissionGranted,
        foregroundServicePermissionGranted,
        notificationPermissionGranted,
        batteryOptimizationDisabled,
        cameraPermissionDenied,
        requestAndroidPermissions,
        state.isRunning,
        safeSetState,
        startCameraHealthCheck,
    ]);

    // Enhanced status helpers
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
            case "permission_denied":
                return "Permissions Required";
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
            case "permission_denied":
                return "#E91E63";
            case "error":
                return "#f44336";
            default:
                return "#666";
        }
    }, [state.status]);

    const getPermissionStatusText = useCallback((): string => {
        if (Platform.OS !== 'android') return "iOS permissions handled automatically";

        const issues = [];
        if (cameraPermissionDenied) issues.push("Camera");
        if (!foregroundServicePermissionGranted && Platform.Version >= 34) issues.push("Foreground Service");
        if (!notificationPermissionGranted && Platform.Version >= 34) issues.push("Notifications");
        if (!batteryOptimizationDisabled && Platform.Version >= 34) issues.push("Battery Optimization");

        if (issues.length === 0) {
            return Platform.Version >= 34 ? "✅ All Android 14+ permissions granted" : "✅ All permissions granted";
        }

        return `❌ Missing: ${issues.join(", ")}`;
    }, [cameraPermissionDenied, foregroundServicePermissionGranted, notificationPermissionGranted, batteryOptimizationDisabled]);

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
        buttonDisabled: {
            backgroundColor: "#ccc",
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
            padding: 15,
            backgroundColor: Platform.Version >= 34 ? "#ffcdd2" : "#fff3e0",
            borderRadius: 10,
            marginVertical: 10,
        },
        permissionText: {
            fontSize: 14,
            color: "#333",
            textAlign: "center",
            marginBottom: 10,
        },
        permissionStatus: {
            fontSize: 12,
            color: "#666",
            textAlign: "center",
            fontFamily: "monospace",
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
        permissionButton: {
            padding: 8,
            backgroundColor: "#2196F3",
            borderRadius: 5,
            marginTop: 10,
        },
        permissionButtonText: {
            color: "white",
            fontSize: 12,
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
                <MaterialCommunityIcons name={iconName as any} size={20} color={iconColor} />
                <Text style={[styles.handDetectionText, textStyle]}>
                    {getHandDetectionStatusText()}
                </Text>
            </View>
        );
    };

    const renderPermissionStatus = () => {
        const hasPermissionIssues = cameraPermissionDenied ||
            (Platform.Version >= 34 && (!foregroundServicePermissionGranted || !notificationPermissionGranted));

        if (!hasPermissionIssues && backgroundPermissionGranted) {
            return null;
        }

        return (
            <View style={styles.permissionContainer}>
                <Text style={styles.permissionText}>
                    {Platform.Version >= 34
                        ? "Android 14+ requires enhanced permissions for background gesture detection"
                        : "Permissions required for gesture detection"
                    }
                </Text>
                <Text style={styles.permissionStatus}>
                    {getPermissionStatusText()}
                </Text>
                <TouchableOpacity style={styles.permissionButton} onPress={requestAndroidPermissions}>
                    <Text style={styles.permissionButtonText}>
                        Request Permissions
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderDebugInfo = () => {
        if (!state.isRunning && state.status !== "error" && state.status !== "camera_lost") return null;

        return (
            <View style={styles.debugInfo}>
                <Text style={styles.debugText}>
                    Debug Info:{'\n'}
                    • Android API: {Platform.Version}{'\n'}
                    • Service Status: {state.status}{'\n'}
                    • Hand Status: {handDetectionStatus.status}{'\n'}
                    • Landmarks: {handDetectionStatus.landmarkCount}{'\n'}
                    • Confidence: {Math.round(handDetectionStatus.confidence * 100)}%{'\n'}
                    • Last Update: {handDetectionStatus.lastUpdate > 0 ?
                        `${Date.now() - handDetectionStatus.lastUpdate}ms ago` : 'Never'}{'\n'}
                    • Current Gesture: {currentGesture}{'\n'}
                    • Restart Attempts: {serviceRestartAttempts.current}/{maxRestartAttempts}{'\n'}
                    • Camera Permission: {cameraPermissionDenied ? 'DENIED' : 'GRANTED'}{'\n'}
                    • Foreground Service: {foregroundServicePermissionGranted ? 'GRANTED' : 'DENIED'}{'\n'}
                    • Notifications: {notificationPermissionGranted ? 'GRANTED' : 'DENIED'}{'\n'}
                    • Battery Optimized: {batteryOptimizationDisabled ? 'DISABLED' : 'ENABLED'}
                </Text>

                {(state.status === "camera_lost" || state.status === "error") && (
                    <TouchableOpacity style={styles.restartButton} onPress={handleCameraLoss}>
                        <Text style={styles.restartButtonText}>Manual Restart</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const isServiceDisabled = !state.isInitialized ||
        state.status === "initializing" ||
        (Platform.Version >= 34 && (!backgroundPermissionGranted || !foregroundServicePermissionGranted || !notificationPermissionGranted));

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
                            Android 14+ Detected: Enhanced permissions and battery optimization exemption required for stable background operation
                        </Text>
                    </View>
                )}

                {renderPermissionStatus()}

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
                                : state.status === "permission_denied"
                                    ? "Permissions required - please grant all permissions"
                                    : state.isBackgroundActive
                                        ? "Background mode: Native service handling gestures"
                                        : gestureConfigs[currentGesture]?.label || "Waiting for gesture..."}
                    </Text>

                    {state.isRunning &&
                        !state.isBackgroundActive &&
                        currentGesture !== "none" &&
                        gestureConfigs[currentGesture] &&
                        state.status !== "camera_lost" &&
                        state.status !== "permission_denied" && (
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
                        state.status !== "camera_lost" &&
                        state.status !== "permission_denied" && (
                            <ActivityIndicator size="large" color={colors.primary} />
                        )}

                    {(state.status === "camera_lost" || state.status === "permission_denied") && (
                        <MaterialCommunityIcons
                            name={state.status === "camera_lost" ? "camera-off" : "shield-alert"}
                            size={60}
                            color={state.status === "camera_lost" ? "#FF5722" : "#E91E63"}
                        />
                    )}
                </View>

                <TouchableOpacity
                    style={[
                        styles.button,
                        state.isRunning ? styles.buttonStop : styles.buttonStart,
                        isServiceDisabled ? styles.buttonDisabled : {}
                    ]}
                    onPress={toggleService}
                    disabled={isServiceDisabled}
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