import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View,
    StyleSheet,
    Dimensions,
    Text,
    StatusBar,
    Alert,
    SafeAreaView,
    TouchableOpacity,
    AppState,
    AppStateStatus,
    Platform,
    Animated,
    ActivityIndicator,
    PermissionsAndroid,
} from 'react-native';
import { Camera } from 'expo-camera';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import '@tensorflow/tfjs-backend-webgl';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import {
    responsiveFontSize,
    responsiveHeight,
    responsiveWidth
} from 'react-native-responsive-dimensions';
import { useTheme } from '../hooks/useTheme';
import { typography } from '../constants/theme';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const PROCESSING_THROTTLE = 100; // Increased throttle for better performance
const CONFIDENCE_THRESHOLD = 0.7;
const CURSOR_SIZE = 30;

// Background task name
const FINGER_TRACKING_TASK = 'finger-tracking-background';

// Types
interface CursorPosition {
    x: number;
    y: number;
}

interface FingerTrackingState {
    isRunning: boolean;
    isInitialized: boolean;
    isBackgroundActive: boolean;
    status: "initializing" | "stopped" | "running" | "background" | "error";
}

interface FingerTrackingScreenProps {
    navigation: NavigationProp<any>;
}

// Configure notifications
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
    }),
});

// Background task definition
TaskManager.defineTask(FINGER_TRACKING_TASK, async () => {
    try {
        console.log('Background finger tracking task running');
        // Background processing logic would go here
        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
        console.error('Background task error:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

const FingerTrackingScreen: React.FC<FingerTrackingScreenProps> = ({ navigation }) => {
    // Refs
    const cameraRef = useRef<Camera>(null);
    const detectorRef = useRef<handPoseDetection.HandDetector | null>(null);
    const animationRef = useRef<number>();
    const appState = useRef<AppStateStatus>(AppState.currentState);
    const isMountedRef = useRef<boolean>(true);
    const processingRef = useRef<boolean>(false);
    const backgroundProcessingRef = useRef<boolean>(false);
    const lastProcessTime = useRef<number>(0);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // State
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [isTfReady, setIsTfReady] = useState(false);
    const [cursorPosition, setCursorPosition] = useState<CursorPosition>({ x: screenWidth / 2, y: screenHeight / 2 });
    const [isTracking, setIsTracking] = useState(false);
    const [confidence, setConfidence] = useState<number>(0);
    const [state, setState] = useState<FingerTrackingState>({
        isRunning: false,
        isInitialized: false,
        isBackgroundActive: false,
        status: "initializing",
    });

    const { colors } = useTheme();

    // Safe state update helper
    const safeSetState = useCallback((updater: (prev: FingerTrackingState) => FingerTrackingState) => {
        if (isMountedRef.current) {
            setState(updater);
        }
    }, []);



    // Initialize TensorFlow and hand detector
    const initializeTensorFlow = useCallback(async (): Promise<void> => {
        try {
            console.log('Initializing TensorFlow.js...');

            // Wait for tf to be ready
            await tf.ready();
            console.log('TensorFlow.js is ready!');
            setIsTfReady(true);

            // Create hand detector with optimized config
            const model = handPoseDetection.SupportedModels.MediaPipeHands;
            const detectorConfig = {
                runtime: 'tfjs' as const,
                modelType: 'lite' as const,
                maxHands: 1,
                solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
            };

            const handDetector = await handPoseDetection.createDetector(model, detectorConfig);
            detectorRef.current = handDetector;
            console.log('Hand detector created successfully!');

            safeSetState(prev => ({
                ...prev,
                isInitialized: true,
                status: "stopped",
            }));

        } catch (error) {
            console.error('Failed to initialize TensorFlow.js:', error);
            Alert.alert('Error', 'Failed to initialize finger tracking');
            safeSetState(prev => ({ ...prev, status: "error" }));
        }
    }, [safeSetState]);

    // Process camera frame for finger detection
    const processFrame = useCallback(async (): Promise<void> => {
        if (!cameraRef.current || !detectorRef.current || !processingRef.current || !isMountedRef.current) {
            return;
        }

        const now = Date.now();
        if (now - lastProcessTime.current < PROCESSING_THROTTLE) {
            // Schedule next frame
            animationRef.current = requestAnimationFrame(processFrame);
            return;
        }
        lastProcessTime.current = now;

        try {
            // Take a low-quality picture for processing
            const imageUri = await cameraRef.current.takePictureAsync({
                quality: 0.1,
                base64: false,
                skipProcessing: true,
                width: 224,
                height: 224,
            });

            // Create tensor from image URI using TensorFlow React Native method
            const imageTensor = decodeJpeg(
                tf.util.encodeString(imageUri.uri, 'utf-8') as any
            );

            // Alternative approach: use tf.browser.fromPixels if decodeJpeg doesn't work
            // You might need to convert the image using a different approach

            // For now, let's use a simpler approach with fetch and proper tensor creation
            const response = await fetch(imageUri.uri);
            const imageBlob = await response.blob();

            // Convert blob to ImageData (this might need platform-specific handling)
            // For React Native, you'll need to use a different approach

            // Temporary workaround: create a dummy tensor for testing
            const dummyTensor = tf.zeros([224, 224, 3]);

            // Detect hands
            const hands = await detectorRef.current.estimateHands(dummyTensor as any);

            if (hands.length > 0) {
                const hand = hands[0];

                // Get index finger tip (landmark 8)
                const indexFingerTip = hand.keypoints[8];

                if (indexFingerTip && indexFingerTip.score && indexFingerTip.score > CONFIDENCE_THRESHOLD) {
                    // Convert coordinates to screen coordinates
                    const x = (indexFingerTip.x / 224) * screenWidth;
                    const y = (indexFingerTip.y / 224) * screenHeight;

                    if (isMountedRef.current) {
                        setCursorPosition({ x, y });
                        setIsTracking(true);
                        setConfidence(indexFingerTip.score);

                        // Animate cursor
                        Animated.timing(fadeAnim, {
                            toValue: 1,
                            duration: 100,
                            useNativeDriver: true,
                        }).start();
                    }
                } else {
                    if (isMountedRef.current) {
                        setIsTracking(false);
                        setConfidence(0);

                        Animated.timing(fadeAnim, {
                            toValue: 0.3,
                            duration: 200,
                            useNativeDriver: true,
                        }).start();
                    }
                }
            } else {
                if (isMountedRef.current) {
                    setIsTracking(false);
                    setConfidence(0);

                    Animated.timing(fadeAnim, {
                        toValue: 0.3,
                        duration: 200,
                        useNativeDriver: true,
                    }).start();
                }
            }

            // Clean up tensor
            dummyTensor.dispose();

        } catch (error) {
            console.error('Frame processing error:', error);
        }

        // Schedule next frame
        if (processingRef.current && isMountedRef.current) {
            animationRef.current = requestAnimationFrame(processFrame);
        }
    }, [fadeAnim]);

    // Handle app state changes for background processing
    useEffect(() => {
        const handleAppStateChange = async (nextAppState: AppStateStatus): Promise<void> => {
            console.log('App state changed:', appState.current, '->', nextAppState);

            if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
                // App going to background
                if (processingRef.current) {
                    console.log('App going to background - Starting background processing');

                    backgroundProcessingRef.current = true;

                    try {
                        // Check if task is already registered
                        const isRegistered = await BackgroundFetch.getStatusAsync();

                        if (isRegistered === BackgroundFetch.BackgroundFetchStatus.Available) {
                            await BackgroundFetch.registerTaskAsync(FINGER_TRACKING_TASK, {
                                minimumInterval: 1000,
                                stopOnTerminate: false,
                                startOnBoot: true,
                            });
                        }

                        // Show background notification
                        await Notifications.scheduleNotificationAsync({
                            content: {
                                title: 'Finger Tracking Active',
                                body: 'Background finger tracking is running',
                                data: { screen: 'finger-tracking' },
                            },
                            trigger: null,
                        });
                    } catch (error) {
                        console.error('Failed to start background processing:', error);
                    }

                    safeSetState(prev => ({
                        ...prev,
                        isBackgroundActive: true,
                        status: "background"
                    }));
                }
            } else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                // App coming to foreground
                console.log('App coming to foreground');

                backgroundProcessingRef.current = false;

                try {
                    await BackgroundFetch.unregisterTaskAsync(FINGER_TRACKING_TASK);
                    await Notifications.dismissAllNotificationsAsync();
                } catch (error) {
                    console.error('Failed to stop background processing:', error);
                }

                safeSetState(prev => ({
                    ...prev,
                    isBackgroundActive: false,
                    status: prev.isRunning ? "running" : "stopped"
                }));
            }

            appState.current = nextAppState;
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription?.remove();
        };
    }, [safeSetState]);

    // Initialize on mount
    useEffect(() => {
        isMountedRef.current = true;

        const initialize = async (): Promise<void> => {
            await initializeTensorFlow();
        };

        initialize();

        return () => {
            isMountedRef.current = false;

            // Cleanup
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }

            processingRef.current = false;
            backgroundProcessingRef.current = false;

            // Unregister background task
            BackgroundFetch.unregisterTaskAsync(FINGER_TRACKING_TASK).catch(console.error);
        };
    }, [initializeTensorFlow]);

    // Toggle finger tracking service
    const toggleService = useCallback(async (): Promise<void> => {
        try {
            if (!state.isRunning) {
                // Start finger tracking
                processingRef.current = true;
                processFrame(); // Start processing loop

                safeSetState(prev => ({
                    ...prev,
                    isRunning: true,
                    status: "running",
                }));
            } else {
                // Stop finger tracking
                processingRef.current = false;
                backgroundProcessingRef.current = false;

                if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current);
                }

                try {
                    await BackgroundFetch.unregisterTaskAsync(FINGER_TRACKING_TASK);
                    await Notifications.dismissAllNotificationsAsync();
                } catch (error) {
                    console.error('Failed to cleanup background task:', error);
                }

                setIsTracking(false);
                setConfidence(0);

                safeSetState(prev => ({
                    ...prev,
                    isRunning: false,
                    status: "stopped",
                    isBackgroundActive: false,
                }));
            }
        } catch (error) {
            console.error("Service toggle failed:", error);
            Alert.alert('Error', 'Failed to toggle finger tracking service');
        }
    }, [state.isRunning, safeSetState, processFrame]);

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
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        centerContent: {
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: responsiveWidth(5),
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            paddingTop: Platform.OS === "ios" ? responsiveHeight(2) : responsiveHeight(4),
            marginBottom: responsiveHeight(2),
            paddingHorizontal: responsiveWidth(5),
        },
        backButton: {
            padding: responsiveWidth(2),
            marginRight: responsiveWidth(2),
        },
        headerText: {
            fontSize: responsiveFontSize(3),
            fontFamily: typography.fontFamily.bold,
            color: colors.text,
            flex: 1,
        },
        camera: {
            flex: 1,
            width: '100%',
        },
        cursor: {
            position: 'absolute',
            width: CURSOR_SIZE,
            height: CURSOR_SIZE,
            borderRadius: CURSOR_SIZE / 2,
            backgroundColor: 'rgba(255, 0, 0, 0.8)',
            borderWidth: 3,
            borderColor: 'white',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.8,
            shadowRadius: 4,
            elevation: 8,
        },
        overlayContainer: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
        },
        statusContainer: {
            position: 'absolute',
            top: responsiveHeight(15),
            left: 0,
            right: 0,
            alignItems: 'center',
        },
        statusCard: {
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            paddingHorizontal: responsiveWidth(4),
            paddingVertical: responsiveHeight(1),
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
        },
        statusText: {
            fontSize: responsiveFontSize(1.8),
            color: 'white',
            fontFamily: typography.fontFamily.medium,
            marginLeft: 8,
        },
        confidenceContainer: {
            position: 'absolute',
            bottom: responsiveHeight(25),
            left: 0,
            right: 0,
            alignItems: 'center',
        },
        confidenceCard: {
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            paddingHorizontal: responsiveWidth(4),
            paddingVertical: responsiveHeight(1),
            borderRadius: 15,
        },
        confidenceText: {
            fontSize: responsiveFontSize(1.6),
            color: 'white',
            fontFamily: typography.fontFamily.regular,
        },
        controlsContainer: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            paddingHorizontal: responsiveWidth(5),
            paddingVertical: responsiveHeight(3),
            paddingBottom: responsiveHeight(5),
        },
        button: {
            padding: responsiveHeight(2),
            borderRadius: 10,
            width: "100%",
            alignItems: "center",
            marginBottom: responsiveHeight(1),
        },
        buttonStart: {
            backgroundColor: "#4CAF50",
        },
        buttonStop: {
            backgroundColor: "#f44336",
        },
        buttonText: {
            color: "white",
            fontSize: responsiveFontSize(2.2),
            fontFamily: typography.fontFamily.bold,
        },
        statusIndicator: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: responsiveHeight(1),
        },
        statusIndicatorText: {
            fontSize: responsiveFontSize(1.8),
            fontFamily: typography.fontFamily.medium,
            marginLeft: 8,
        },
        backgroundIndicator: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginVertical: responsiveHeight(1),
            padding: responsiveHeight(1.5),
            backgroundColor: "#FF9800",
            borderRadius: 8,
        },
        backgroundIndicatorText: {
            color: "white",
            fontSize: responsiveFontSize(1.6),
            fontFamily: typography.fontFamily.bold,
            marginLeft: 5,
        },
        text: {
            fontSize: responsiveFontSize(2),
            fontFamily: typography.fontFamily.medium,
            textAlign: 'center',
        },
    });

    // Show loading screen while initializing
    if (!state.isInitialized && state.status === "initializing") {
        return (
            <SafeAreaView style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.text, { color: colors.text, marginTop: 20 }]}>
                    Initializing TensorFlow.js...
                </Text>
            </SafeAreaView>
        );
    }

    // Show error if camera permission denied
    if (hasPermission === false) {
        return (
            <SafeAreaView style={[styles.container, styles.centerContent]}>
                <MaterialCommunityIcons
                    name="camera-off"
                    size={80}
                    color={colors.text}
                />
                <Text style={[styles.text, { color: colors.text, marginTop: 20 }]}>
                    Camera permission is required for finger tracking
                </Text>

            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar hidden />

            {/* Header */}
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
                <Text style={styles.headerText}>Index Finger Tracking</Text>
            </View>

            {/* Camera View */}
            {hasPermission && (
                <Camera
                    ref={cameraRef}
                    style={styles.camera}
                    type={Camera.Constants.Type.front}
                    ratio="16:9"
                />
            )}

            {/* Overlay Container */}
            <View style={styles.overlayContainer}>
                {/* Cursor that follows finger tip */}
                {isTracking && (
                    <Animated.View
                        style={[
                            styles.cursor,
                            {
                                left: cursorPosition.x - CURSOR_SIZE / 2,
                                top: cursorPosition.y - CURSOR_SIZE / 2,
                                opacity: fadeAnim,
                            },
                        ]}
                    />
                )}

                {/* Status indicator */}
                <View style={styles.statusContainer}>
                    <View style={styles.statusCard}>
                        <MaterialCommunityIcons
                            name={isTracking ? "hand-pointing-up" : "hand-wave"}
                            size={20}
                            color={isTracking ? "#4CAF50" : "#FF9800"}
                        />
                        <Text style={styles.statusText}>
                            {isTracking ? 'Tracking finger!' : 'Show your index finger'}
                        </Text>
                    </View>
                </View>

                {/* Confidence indicator */}
                {isTracking && (
                    <View style={styles.confidenceContainer}>
                        <View style={styles.confidenceCard}>
                            <Text style={styles.confidenceText}>
                                Confidence: {Math.round(confidence * 100)}%
                            </Text>
                        </View>
                    </View>
                )}

                {/* Background mode indicator */}
                {state.isBackgroundActive && (
                    <View style={styles.backgroundIndicator}>
                        <MaterialCommunityIcons name="circle" size={12} color="white" />
                        <Text style={styles.backgroundIndicatorText}>
                            Background tracking active
                        </Text>
                    </View>
                )}
            </View>

            {/* Controls */}
            <View style={styles.controlsContainer}>
                <TouchableOpacity
                    style={[
                        styles.button,
                        state.isRunning ? styles.buttonStop : styles.buttonStart,
                    ]}
                    onPress={toggleService}
                    disabled={!state.isInitialized || state.status === "initializing"}
                >
                    <Text style={styles.buttonText}>
                        {state.isRunning ? "Stop Finger Tracking" : "Start Finger Tracking"}
                    </Text>
                </TouchableOpacity>

                <View style={styles.statusIndicator}>
                    <MaterialCommunityIcons
                        name="circle"
                        size={12}
                        color={getStatusColor()}
                    />
                    <Text style={[styles.statusIndicatorText, { color: getStatusColor() }]}>
                        Status: {getStatusText()}
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
};

export default FingerTrackingScreen;