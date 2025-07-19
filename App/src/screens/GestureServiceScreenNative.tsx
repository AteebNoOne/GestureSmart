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
import SystemSetting from "react-native-system-setting";
import * as Notifications from "expo-notifications";

const VOLUME_ADJUSTMENT_THROTTLE = 500;

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
    status: "initializing" | "stopped" | "running" | "background" | "error";
}

// Native module interface
const GestureServiceModule = NativeModules.GestureService;

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

    // State
    const [volume, setVolume] = useState<number>(0);
    const [currentGesture, setCurrentGesture] = useState<string>("none");
    const [backgroundPermissionGranted, setBackgroundPermissionGranted] = useState<boolean>(false);
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

    // Safe state update helper
    const safeSetState = useCallback((updater: (prev: AppState) => AppState) => {
        if (isMountedRef.current) {
            setState(updater);
        }
    }, []);

    // Request comprehensive Android permissions
    const requestAndroidPermissions = useCallback(async (): Promise<void> => {
        try {
            if (Platform.OS === 'android') {
                const permissions: string[] = [
                    'android.permission.CAMERA',
                    'android.permission.WAKE_LOCK',
                    'android.permission.RECORD_AUDIO',
                    'android.permission.MODIFY_AUDIO_SETTINGS',
                ];

                // Add version-specific permissions
                if (Platform.Version >= 28) {
                    permissions.push('android.permission.FOREGROUND_SERVICE');
                }

                if (Platform.Version >= 34) {
                    permissions.push('android.permission.FOREGROUND_SERVICE_CAMERA');
                }

                const results = await PermissionsAndroid.requestMultiple(permissions);
                const allGranted = Object.values(results).every(
                    result => result === PermissionsAndroid.RESULTS.GRANTED
                );

                if (allGranted) {
                    await requestNotificationPermission();
                    await requestOverlayPermission();
                    await requestBatteryOptimizationDisable();
                    setBackgroundPermissionGranted(true);
                } else {
                    Alert.alert(
                        'Permissions Required',
                        'Background gesture detection requires all permissions to function properly.',
                        [{ text: 'OK' }]
                    );
                }
            } else {
                // iOS permissions
                await requestNotificationPermission();
                setBackgroundPermissionGranted(true);
            }
        } catch (error) {
            console.error('Permission request failed:', error);
        }
    }, []);

    // Request notification permission
    const requestNotificationPermission = useCallback(async (): Promise<void> => {
        try {
            const { status } = await Notifications.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Notification Permission',
                    'Notifications are needed to show background activity status.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.error('Notification permission request failed:', error);
        }
    }, []);

    // Handle overlay permission
    const requestOverlayPermission = useCallback(async (): Promise<void> => {
        try {
            if (Platform.OS === 'android') {
                const granted = await PermissionsAndroid.check(
                    'android.permission.SYSTEM_ALERT_WINDOW'
                );

                if (!granted) {
                    Alert.alert(
                        'Overlay Permission Required',
                        'This app needs permission to display over other apps for gesture detection.',
                        [
                            {
                                text: 'Grant Permission',
                                onPress: () => Linking.openSettings(),
                            },
                            { text: 'Cancel', style: 'cancel' },
                        ]
                    );
                }
            }
        } catch (error) {
            console.error('Overlay permission request failed:', error);
        }
    }, []);

    // Request battery optimization disable
    const requestBatteryOptimizationDisable = useCallback(async (): Promise<void> => {
        try {
            if (Platform.OS === 'android' && Platform.Version >= 23) {
                Alert.alert(
                    'Battery Optimization',
                    'To ensure background gesture detection works properly, please disable battery optimization for this app.',
                    [
                        {
                            text: 'Settings',
                            onPress: () => Linking.openSettings(),
                        },
                        { text: 'Later', style: 'cancel' },
                    ]
                );
            }
        } catch (error) {
            console.error('Battery optimization request failed:', error);
        }
    }, []);

    // Initialize gesture service
    useEffect(() => {
        isMountedRef.current = true;

        const initialize = async (): Promise<void> => {
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
                    const subscription = eventEmitter.addListener(
                        GestureServiceModule.EVENT_NAME,
                        (gesture: string) => {
                            setCurrentGesture(gesture);
                            handleGesture(gesture);
                        }
                    );

                    // Store the subscription for cleanup
                    gestureSubscriptionRef.current = subscription;
                }
            } catch (error) {
                console.error("Initialization failed:", error);
                safeSetState((prev) => ({ ...prev, status: "error" }));
            }
        };

        initialize();

        return () => {
            isMountedRef.current = false;
            if (gestureSubscriptionRef.current) {
                gestureSubscriptionRef.current.remove();
                gestureSubscriptionRef.current = null;
            }
        };
    }, [requestAndroidPermissions, safeSetState]);

    // Enhanced app state handling
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
                } else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                    // App coming to foreground
                    safeSetState(prev => ({
                        ...prev,
                        isBackgroundActive: false,
                        status: "running"
                    }));
                }
            }

            appState.current = nextAppState;
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription?.remove();
        };
    }, [safeSetState, state.isRunning]);

    // Initialize volume
    useEffect(() => {
        SystemSetting.getVolume()
            .then(setVolume)
            .catch(console.error);
    }, []);

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

    // Volume adjustment
    const adjustVolume = useCallback(async (direction: 'up' | 'down' = 'up'): Promise<void> => {
        const now = Date.now();
        if (now - lastAdjustmentTime.current < VOLUME_ADJUSTMENT_THROTTLE) return;

        lastAdjustmentTime.current = now;
        try {
            const adjustment = direction === 'up' ? 0.05 : -0.05;
            const newVolume = Math.max(0, Math.min(1, volume + adjustment));

            if (newVolume !== volume) {
                await SystemSetting.setVolume(newVolume, {
                    type: "music",
                    playSound: false,
                    showUI: !state.isBackgroundActive,
                });
                setVolume(newVolume);
            }
        } catch (error) {
            console.error("Volume adjustment failed:", error);
        }
    }, [volume, state.isBackgroundActive]);

    // Gesture handler
    const handleGesture = useCallback(async (gesture: string): Promise<void> => {
        console.log(`Gesture detected: ${gesture} (${state.isBackgroundActive ? 'background' : 'foreground'} mode)`);

        try {
            // Handle gesture in any mode
            switch (gesture) {
                case "follow_cursor":
                    await handleSwipeLeft();
                    break;
                case "close_cursor":
                    await handleSwipeRight();
                    break;
                case "tap":
                    await handleTap(0, 0);
                    break;
                case "volume_up":
                    await adjustVolume('up');
                    break;
                case "volume_down":
                    await adjustVolume('down');
                    break;
                default:
                    break;
            }
        } catch (error) {
            console.error('Error handling gesture:', error);
        }
    }, [adjustVolume, state.isBackgroundActive]);

    // Service toggle
    const toggleService = useCallback(async (): Promise<void> => {
        try {
            if (!backgroundPermissionGranted) {
                Alert.alert(
                    'Permissions Required',
                    'Please grant all required permissions for background gesture detection.',
                    [
                        { text: 'Grant Permissions', onPress: requestAndroidPermissions },
                        { text: 'Cancel', style: 'cancel' },
                    ]
                );
                return;
            }

            if (!state.isRunning) {
                // Start native service
                try {
                    await GestureServiceModule.startService();
                    safeSetState((prev) => ({
                        ...prev,
                        isRunning: true,
                        status: "running",
                    }));
                } catch (error) {
                    console.error('Failed to start native service:', error);
                    return;
                }
            } else {
                // Stop native service
                try {
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
        requestAndroidPermissions,
        state.isRunning,
        safeSetState,
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
            backgroundColor: "#ffeb3b",
            borderRadius: 10,
            marginVertical: 10,
        },
        permissionText: {
            fontSize: 14,
            color: "#333",
            textAlign: "center",
        },
        volumeIndicator: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginVertical: 10,
            padding: 10,
            backgroundColor: colors.primary,
            borderRadius: 5,
        },
        volumeText: {
            color: "white",
            fontSize: 14,
            fontWeight: "bold",
            marginLeft: 5,
        },
    });

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

                {!backgroundPermissionGranted && (
                    <View style={styles.permissionContainer}>
                        <Text style={styles.permissionText}>
                            Background permissions required for gesture detection when app is not active
                        </Text>
                    </View>
                )}

                {state.isBackgroundActive && (
                    <View style={styles.backgroundIndicator}>
                        <MaterialCommunityIcons name="circle" size={12} color="white" />
                        <Text style={styles.backgroundIndicatorText}>
                            Background mode active - Native service running
                        </Text>
                    </View>
                )}

                <View style={styles.volumeIndicator}>
                    <MaterialCommunityIcons name="volume-high" size={16} color="white" />
                    <Text style={styles.volumeText}>
                        Volume: {Math.round(volume * 100)}%
                    </Text>
                </View>

                <View style={styles.gestureContainer}>
                    <Text style={styles.gestureText}>
                        {!state.isRunning
                            ? "Service stopped"
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
                        (!currentGesture || currentGesture === "none") && (
                            <ActivityIndicator size="large" color={colors.primary} />
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
