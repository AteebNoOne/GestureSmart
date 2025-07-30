import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  NativeModules,
  NativeEventEmitter,
  PermissionsAndroid,
  Alert,
  Linking,
  EmitterSubscription,
} from 'react-native';
import {
  responsiveFontSize,
  responsiveHeight,
  responsiveWidth,
} from 'react-native-responsive-dimensions';
import { useTheme } from '../hooks/useTheme';
import { typography } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';

// Import your existing action handlers
import {
  handleCursor,
  handleReturn,
  handleScrollDown,
  handleScrollUp,
  handleSwipeLeft,
  handleSwipeRight,
  handleTap,
} from '../features/actions';

interface CommandConfig {
  [key: string]: {
    label: string;
    imagePath: any;
    action: () => Promise<void>;
  };
}

interface VoiceEvent {
  command: string;
  confidence: number;
  originalText: string;
  timestamp: number;
}

interface StatusEvent {
  status: string;
  message?: string;
  timestamp: number;
  isListening: boolean;
}

interface VoiceScreenProps {
  navigation: NavigationProp<any>;
}

interface AppState {
  isRunning: boolean;
  isInitialized: boolean;
  isBackgroundActive: boolean;
  status: 'initializing' | 'stopped' | 'running' | 'background' | 'error';
  errorMessage?: string;
}

// Native module interface
const { VoiceService } = NativeModules;

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const VoiceServiceNative: React.FC<VoiceScreenProps> = ({ navigation }) => {
  // Refs
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isMountedRef = useRef<boolean>(true);
  const voiceSubscriptionRef = useRef<EmitterSubscription | null>(null);
  const statusSubscriptionRef = useRef<EmitterSubscription | null>(null);
  const initializationAttempted = useRef<boolean>(false);

  // State
  const [currentCommand, setCurrentCommand] = useState<string>('none');
  const [backgroundPermissionGranted, setBackgroundPermissionGranted] = useState<boolean>(false);
  const [state, setState] = useState<AppState>({
    isRunning: false,
    isInitialized: false,
    isBackgroundActive: false,
    status: 'initializing',
  });
  const [isListening, setIsListening] = useState<boolean>(false);
  const [lastCommand, setLastCommand] = useState<VoiceEvent | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<{ [key: string]: string }>({});

  const { colors } = useTheme();

  // Command configurations
  const commandConfigs: CommandConfig = {
    'swipe right': {
      label: 'Swipe Right',
      imagePath: require('../assets/gestures/swipe_right.png'),
      action: async () => await handleSwipeRight(),
    },
    'swipe left': {
      label: 'Swipe Left',
      imagePath: require('../assets/gestures/swipe_left.png'),
      action: async () => await handleSwipeLeft(),
    },
    'tap': {
      label: 'Tap',
      imagePath: require('../assets/gestures/tap.png'),
      action: async () => await handleTap(0, 0),
    },
    'scroll up': {
      label: 'Scroll Up',
      imagePath: require('../assets/gestures/scroll_up.png'),
      action: async () => await handleScrollUp(),
    },
    'scroll down': {
      label: 'Scroll Down',
      imagePath: require('../assets/gestures/scroll_down.png'),
      action: async () => await handleScrollDown(),
    },
    'return': {
      label: 'Return',
      imagePath: require('../assets/gestures/return.png'),
      action: async () => await handleReturn(),
    },
    'cursor': {
      label: 'Cursor',
      imagePath: require('../assets/gestures/follow_cursor.png'),
      action: async () => await handleCursor(),
    },
  };

  // Safe state update helper
  const safeSetState = useCallback((updater: (prev: AppState) => AppState) => {
    if (isMountedRef.current) {
      setState(updater);
    }
  }, []);

  // Check if VoiceService module is available
  const checkNativeModuleAvailability = useCallback((): boolean => {
    if (!VoiceService) {
      console.error('VoiceService native module not found');
      safeSetState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: 'Voice service module not available. Please check native module installation.',
        isInitialized: false,
      }));
      return false;
    }
    return true;
  }, [safeSetState]);

  // Get required permissions based on Android version
  const getRequiredPermissions = useCallback((): string[] => {
    const permissions: string[] = [];
    const androidVersion = Platform.Version as number;

    console.log(`Android version: ${androidVersion}`);

    // Core permissions that exist on all versions
    if (PermissionsAndroid.PERMISSIONS.RECORD_AUDIO) {
      permissions.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    }

    // Wake lock permission (available from API 21+)
    if (androidVersion >= 21 && PermissionsAndroid.PERMISSIONS.WAKE_LOCK) {
      permissions.push(PermissionsAndroid.PERMISSIONS.WAKE_LOCK);
    }

    // Foreground service permission (API 28+)
    if (androidVersion >= 28 && PermissionsAndroid.PERMISSIONS.FOREGROUND_SERVICE) {
      permissions.push(PermissionsAndroid.PERMISSIONS.FOREGROUND_SERVICE);
    }

    // Foreground service microphone permission (API 34+)
    if (androidVersion >= 34) {
      // This permission was added in API 34, so we use string literal
      permissions.push('android.permission.FOREGROUND_SERVICE_MICROPHONE');
    }

    // Post notifications permission (API 33+) 
    if (androidVersion >= 33) {
      // This permission was added in API 33, so we use string literal
      permissions.push('android.permission.POST_NOTIFICATIONS');
    }

    // Additional useful permissions for voice services
    if (androidVersion >= 23) {
      // System alert window permission for overlay functionality
      if (PermissionsAndroid.PERMISSIONS.SYSTEM_ALERT_WINDOW) {
        // Don't add this automatically as it's very intrusive
        // permissions.push(PermissionsAndroid.PERMISSIONS.SYSTEM_ALERT_WINDOW);
      }
    }

    console.log('Required permissions for this Android version:', permissions);
    return permissions;
  }, []);

  // Check individual permission status
  const checkPermissionStatus = useCallback(async (permission: string): Promise<string> => {
    try {
      const result = await PermissionsAndroid.check(permission);
      return result ? 'granted' : 'denied';
    } catch (error) {
      console.log(`Permission ${permission} check failed:`, error);
      return 'not_available';
    }
  }, []);

  // Request individual permission with fallback
  const requestSinglePermission = useCallback(async (permission: string): Promise<string> => {
    try {
      const result = await PermissionsAndroid.request(permission);
      return result;
    } catch (error) {
      console.log(`Permission ${permission} request failed:`, error);
      return PermissionsAndroid.RESULTS.DENIED;
    }
  }, []);

  // Enhanced Android permission request with version compatibility
  const requestAndroidPermissions = useCallback(async (): Promise<boolean> => {
    try {
      if (Platform.OS !== 'android') {
        await requestNotificationPermission();
        setBackgroundPermissionGranted(true);
        return true;
      }

      console.log('Requesting Android permissions with compatibility checks...');

      const requiredPermissions = getRequiredPermissions();
      const permissionResults: { [key: string]: string } = {};
      let criticalPermissionsMissing = false;

      // Check current status of all permissions
      for (const permission of requiredPermissions) {
        const status = await checkPermissionStatus(permission);
        permissionResults[permission] = status;
        console.log(`Permission ${permission}: ${status}`);
      }

      // Filter out permissions that are not available on this device/version
      const availablePermissions = requiredPermissions.filter(
        permission => permissionResults[permission] !== 'not_available'
      );

      console.log('Available permissions to request:', availablePermissions);

      if (availablePermissions.length === 0) {
        console.log('No permissions to request');
        setBackgroundPermissionGranted(true);
        return true;
      }

      // Request permissions individually for better error handling
      const finalResults: { [key: string]: string } = {};

      for (const permission of availablePermissions) {
        if (permissionResults[permission] !== 'granted') {
          console.log(`Requesting permission: ${permission}`);
          const result = await requestSinglePermission(permission);
          finalResults[permission] = result;
        } else {
          finalResults[permission] = 'granted';
        }
      }

      setPermissionStatus(finalResults);

      // Check if critical permissions are granted
      const recordAudioGranted = finalResults[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;

      if (!recordAudioGranted) {
        criticalPermissionsMissing = true;
        Alert.alert(
          'Critical Permission Required',
          'Microphone permission is essential for voice commands to work. The app cannot function without this permission.',
          [
            {
              text: 'Try Again',
              onPress: () => requestAndroidPermissions()
            },
            {
              text: 'Open Settings',
              onPress: () => {
                try {
                  Linking.openSettings();
                } catch (error) {
                  console.error('Failed to open settings:', error);
                }
              }
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        );
      }

      // Log all permission results
      console.log('Final permission results:', finalResults);

      if (!criticalPermissionsMissing) {
        // Request notification permission separately
        await requestNotificationPermission();

        // Request battery optimization disable
        await requestBatteryOptimizationDisable();

        setBackgroundPermissionGranted(true);

        // Show optional permissions info
        const optionalPermissionsMissing = Object.entries(finalResults).some(
          ([permission, result]) =>
            permission !== PermissionsAndroid.PERMISSIONS.RECORD_AUDIO &&
            result !== PermissionsAndroid.RESULTS.GRANTED
        );

        if (optionalPermissionsMissing) {
          Alert.alert(
            'Optional Permissions',
            'Some optional permissions were not granted. The app will work, but background functionality may be limited.',
            [{ text: 'OK' }]
          );
        }

        return true;
      }

      return false;

    } catch (error) {
      console.error('Permission request failed:', error);

      Alert.alert(
        'Permission Error',
        `Failed to request permissions: ${error.message || 'Unknown error'}. Please try granting permissions manually in Settings.`,
        [
          {
            text: 'Open Settings',
            onPress: () => {
              try {
                Linking.openSettings();
              } catch (settingsError) {
                console.error('Failed to open settings:', settingsError);
              }
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );

      return false;
    }
  }, [getRequiredPermissions, checkPermissionStatus, requestSinglePermission, requestNotificationPermission, requestBatteryOptimizationDisable]);

  // Request notification permission
  const requestNotificationPermission = useCallback(async (): Promise<void> => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      console.log('Notification permission status:', status);

      if (status !== 'granted') {
        console.log('Notification permission not granted, but continuing...');
      }
    } catch (error) {
      console.error('Notification permission request failed:', error);
      // Don't fail the entire process for notification permissions
    }
  }, []);

  // Request battery optimization disable
  const requestBatteryOptimizationDisable = useCallback(async (): Promise<void> => {
    try {
      if (Platform.OS === 'android' && Platform.Version >= 23) {
        // Don't show this alert immediately, show it after a delay to avoid overwhelming user
        setTimeout(() => {
          Alert.alert(
            'Battery Optimization',
            'For best performance, please disable battery optimization for this app. This ensures voice commands work reliably in the background.',
            [
              {
                text: 'Open Settings',
                onPress: () => {
                  try {
                    Linking.openSettings();
                  } catch (error) {
                    console.error('Failed to open settings:', error);
                  }
                },
              },
              { text: 'Skip', style: 'cancel' },
            ]
          );
        }, 2000);
      }
    } catch (error) {
      console.error('Battery optimization request failed:', error);
    }
  }, []);

  // Check microphone permission specifically
  const checkMicrophonePermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    try {
      const hasPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      return hasPermission;
    } catch (error) {
      console.error('Failed to check microphone permission:', error);
      return false;
    }
  }, []);

  // Initialize voice service
  useEffect(() => {
    if (initializationAttempted.current) return;

    initializationAttempted.current = true;
    isMountedRef.current = true;

    const initialize = async () => {
      try {
        console.log('Initializing voice service...');

        // Check native module availability first
        if (!checkNativeModuleAvailability()) {
          return;
        }

        // For iOS, skip Android-specific permission requests
        if (Platform.OS === 'ios') {
          await requestNotificationPermission();
          setBackgroundPermissionGranted(true);
        } else {
          // Request permissions for Android
          const permissionsGranted = await requestAndroidPermissions();
          if (!permissionsGranted) {
            // Check if at least microphone permission is granted
            const hasMicrophone = await checkMicrophonePermission();
            if (hasMicrophone) {
              console.log('Microphone permission available, continuing with limited functionality');
              setBackgroundPermissionGranted(true);
            } else {
              safeSetState(prev => ({
                ...prev,
                status: 'error',
                errorMessage: 'Microphone permission is required for voice commands',
                isInitialized: false,
              }));
              return;
            }
          }
        }

        // Set up event listeners
        if (VoiceService) {
          const eventEmitter = new NativeEventEmitter(VoiceService);

          console.log('Setting up event listeners...');

          // Voice command events
          const voiceSubscription = eventEmitter.addListener(
            VoiceService.EVENT_NAME || 'VoiceCommandDetected',
            (data: VoiceEvent) => {
              console.log('Voice event received:', data);
              if (isMountedRef.current) {
                setCurrentCommand(data.command);
                setLastCommand(data);
                handleVoiceCommand(data.command);
              }
            }
          );

          // Service status events
          const statusSubscription = eventEmitter.addListener(
            VoiceService.STATUS_EVENT_NAME || 'VoiceServiceStatus',
            (data: StatusEvent) => {
              console.log('Voice status event:', data);
              if (isMountedRef.current) {
                setIsListening(data.isListening);

                // Update service status based on native events
                if (data.status === 'listening' || data.status === 'ready') {
                  safeSetState(prev => ({ ...prev, status: 'running' }));
                } else if (data.status.startsWith('error')) {
                  safeSetState(prev => ({
                    ...prev,
                    status: 'error',
                    errorMessage: data.message || 'Unknown error'
                  }));
                }
              }
            }
          );

          voiceSubscriptionRef.current = voiceSubscription;
          statusSubscriptionRef.current = statusSubscription;

          console.log('Event listeners set up successfully');
        }

        safeSetState(prev => ({
          ...prev,
          isInitialized: true,
          status: 'stopped',
          errorMessage: undefined,
        }));

        console.log('Voice service initialized successfully');

      } catch (error) {
        console.error('Initialization failed:', error);
        safeSetState(prev => ({
          ...prev,
          status: 'error',
          errorMessage: `Initialization failed: ${error.message}`,
          isInitialized: false,
        }));
      }
    };

    initialize();

    return () => {
      isMountedRef.current = false;
      if (voiceSubscriptionRef.current) {
        voiceSubscriptionRef.current.remove();
        voiceSubscriptionRef.current = null;
      }
      if (statusSubscriptionRef.current) {
        statusSubscriptionRef.current.remove();
        statusSubscriptionRef.current = null;
      }
    };
  }, [checkNativeModuleAvailability, requestAndroidPermissions, safeSetState, checkMicrophonePermission]);

  // Enhanced app state handling
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus): Promise<void> => {
      console.log('App state changed:', appState.current, '->', nextAppState);

      if (state.isRunning) {
        if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
          // App going to background
          console.log('App going to background - maintaining voice service');
          safeSetState(prev => ({
            ...prev,
            isBackgroundActive: true,
            status: 'background'
          }));
        } else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
          // App coming to foreground
          console.log('App returning to foreground');
          safeSetState(prev => ({
            ...prev,
            isBackgroundActive: false,
            status: 'running'
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

  // Command animation
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
        }),
      ]).start();
    }
  }, [currentCommand, fadeAnim]);

  // Voice command handler
  const handleVoiceCommand = useCallback(async (command: string): Promise<void> => {
    console.log(`Voice command detected: ${command} (${state.isBackgroundActive ? 'background' : 'foreground'} mode)`);

    try {
      const config = commandConfigs[command];
      if (config) {
        await config.action();
        console.log(`Executed action for command: ${command}`);
      } else {
        console.log(`No action configured for command: ${command}`);
      }
    } catch (error) {
      console.error('Error handling voice command:', error);
    }
  }, [state.isBackgroundActive, commandConfigs]);

  // Service toggle
  const toggleService = useCallback(async (): Promise<void> => {
    try {
      console.log('Toggling voice service...', {
        isRunning: state.isRunning,
        isInitialized: state.isInitialized,
        permissionsGranted: backgroundPermissionGranted
      });

      if (!state.isInitialized) {
        Alert.alert(
          'Service Not Ready',
          'Voice service is still initializing. Please wait a moment.',
          [{ text: 'OK' }]
        );
        return;
      }

      if (!backgroundPermissionGranted) {
        const hasMicrophone = await checkMicrophonePermission();

        if (!hasMicrophone) {
          Alert.alert(
            'Microphone Permission Required',
            'Please grant microphone permission for voice commands to work.',
            [
              { text: 'Grant Permissions', onPress: requestAndroidPermissions },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
          return;
        } else {
          // Microphone available, continue with limited functionality
          setBackgroundPermissionGranted(true);
        }
      }

      if (!checkNativeModuleAvailability()) {
        return;
      }

      if (!state.isRunning) {
        console.log('Starting voice service...');

        // Update commands in native service
        const commands = Object.keys(commandConfigs);
        console.log('Updating commands:', commands);

        try {
          if (VoiceService.updateCommands) {
            await VoiceService.updateCommands(commands);
          }
        } catch (error) {
          console.error('Failed to update commands:', error);
        }

        // Set sensitivity
        try {
          if (VoiceService.setSensitivity) {
            await VoiceService.setSensitivity(0.7);
          }
        } catch (error) {
          console.error('Failed to set sensitivity:', error);
        }

        // Start native service
        console.log('Starting native voice service...');
        await VoiceService.startService();

        safeSetState(prev => ({
          ...prev,
          isRunning: true,
          status: 'running',
          errorMessage: undefined,
        }));

        console.log('Voice service started successfully');

      } else {
        console.log('Stopping voice service...');

        // Stop native service
        await VoiceService.stopService();

        safeSetState(prev => ({
          ...prev,
          isRunning: false,
          status: 'stopped',
          isBackgroundActive: false,
          errorMessage: undefined,
        }));

        setCurrentCommand('none');
        setIsListening(false);

        console.log('Voice service stopped successfully');
      }
    } catch (error) {
      console.error('Service toggle failed:', error);
      safeSetState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: `Service toggle failed: ${error.message}`,
      }));

      Alert.alert(
        'Service Error',
        `Failed to ${state.isRunning ? 'stop' : 'start'} voice service:\n\n${error.message}`,
        [{ text: 'OK' }]
      );
    }
  }, [
    backgroundPermissionGranted,
    requestAndroidPermissions,
    state.isRunning,
    state.isInitialized,
    safeSetState,
    commandConfigs,
    checkNativeModuleAvailability,
    checkMicrophonePermission,
  ]);

  // Status helpers
  const getStatusText = useCallback((): string => {
    switch (state.status) {
      case 'background':
        return 'Background Mode Active';
      case 'running':
        return isListening ? 'Listening...' : 'Ready';
      case 'stopped':
        return 'Stopped';
      case 'initializing':
        return 'Initializing...';
      case 'error':
        return state.errorMessage || 'Error';
      default:
        return 'Unknown';
    }
  }, [state.status, state.errorMessage, isListening]);

  const getStatusColor = useCallback((): string => {
    switch (state.status) {
      case 'background':
        return '#FF9800';
      case 'running':
        return isListening ? '#4CAF50' : '#2196F3';
      case 'stopped':
        return '#666';
      case 'initializing':
        return '#2196F3';
      case 'error':
        return '#f44336';
      default:
        return '#666';
    }
  }, [state.status, isListening]);

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
    commandContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    commandText: {
      fontSize: responsiveFontSize(2.5),
      fontFamily: typography.fontFamily.medium,
      color: colors.text,
      marginBottom: responsiveHeight(2),
      textAlign: 'center',
    },
    commandImage: {
      width: responsiveWidth(50),
      height: responsiveWidth(50),
      resizeMode: 'contain',
    },
    button: {
      padding: 20,
      borderRadius: 10,
      width: '100%',
      alignItems: 'center',
      marginVertical: 10,
    },
    buttonStart: {
      backgroundColor: '#4CAF50',
    },
    buttonStop: {
      backgroundColor: '#f44336',
    },
    buttonDisabled: {
      backgroundColor: '#cccccc',
    },
    buttonText: {
      color: 'white',
      fontSize: 18,
      fontWeight: 'bold',
    },
    status: {
      marginVertical: 20,
      fontSize: 16,
      textAlign: 'center',
      fontWeight: 'bold',
    },
    backgroundIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 10,
      padding: 10,
      backgroundColor: '#FF9800',
      borderRadius: 5,
    },
    backgroundIndicatorText: {
      color: 'white',
      fontSize: 14,
      fontWeight: 'bold',
      marginLeft: 5,
    },
    listeningIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 10,
      padding: 15,
      borderRadius: 8,
      borderWidth: 2,
    },
    listeningStyle: {
      backgroundColor: '#E8F5E8',
      borderColor: '#4CAF50',
    },
    waitingStyle: {
      backgroundColor: '#FFF3E0',
      borderColor: '#FF9800',
    },
    listeningDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 10,
    },
    listeningText: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    permissionContainer: {
      padding: 20,
      backgroundColor: '#ffeb3b',
      borderRadius: 10,
      marginVertical: 10,
    },
    permissionText: {
      fontSize: 14,
      color: '#333',
      textAlign: 'center',
    },
    errorContainer: {
      padding: 15,
      backgroundColor: '#ffebee',
      borderRadius: 8,
      marginVertical: 10,
      borderLeftWidth: 4,
      borderLeftColor: '#f44336',
    },
    errorText: {
      fontSize: 14,
      color: '#c62828',
      textAlign: 'center',
    },
    commandsContainer: {
      marginVertical: 15,
      padding: 15,
      backgroundColor: colors.surface || '#f5f5f5',
      borderRadius: 8,
    },
    commandsTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    commandsText: {
      fontSize: 14,
      color: colors.textSecondary || '#666',
      lineHeight: 20,
    },
    debugContainer: {
      marginVertical: 10,
      padding: 10,
      backgroundColor: '#f0f0f0',
      borderRadius: 5,
    },
    debugText: {
      fontSize: 12,
      color: '#666',
      fontFamily: 'monospace',
    },
    permissionStatusContainer: {
      marginVertical: 10,
      padding: 10,
      backgroundColor: '#f8f9fa',
      borderRadius: 5,
      borderWidth: 1,
      borderColor: '#dee2e6',
    },
    permissionStatusTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#495057',
      marginBottom: 5,
    },
    permissionStatusText: {
      fontSize: 12,
      color: '#6c757d',
      fontFamily: 'monospace',
    },
  });

  const renderListeningStatus = () => {
    if (!state.isRunning) return null;

    const containerStyle = isListening ? styles.listeningStyle : styles.waitingStyle;
    const dotColor = isListening ? '#4CAF50' : '#FF9800';
    const textColor = isListening ? '#2E7D32' : '#F57C00';

    return (
      <View style={[styles.listeningIndicator, containerStyle]}>
        <View style={[styles.listeningDot, { backgroundColor: dotColor }]} />
        <Text style={[styles.listeningText, { color: textColor }]}>
          {isListening ? '🎤 Listening for commands...' : '⏳ Ready to listen'}
        </Text>
      </View>
    );
  };

  const renderErrorMessage = () => {
    if (state.status !== 'error' || !state.errorMessage) return null;

    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          {state.errorMessage}
        </Text>
      </View>
    );
  };

  const renderPermissionStatus = () => {
    if (Platform.OS !== 'android' || Object.keys(permissionStatus).length === 0) return null;

    return (
      <View style={styles.permissionStatusContainer}>
        <Text style={styles.permissionStatusTitle}>Permission Status (Android {Platform.Version}):</Text>
        {Object.entries(permissionStatus).map(([permission, status]) => (
          <Text key={permission} style={styles.permissionStatusText}>
            {permission.split('.').pop()}: {status}
          </Text>
        ))}
      </View>
    );
  };

  const isButtonDisabled = !state.isInitialized || state.status === 'initializing' || state.status === 'error';

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
            <Text style={styles.headerText}>Voice Commands</Text>
          </View>
        </View>

        {!backgroundPermissionGranted && (
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>
              Microphone permission required for voice detection
            </Text>
          </View>
        )}

        {renderErrorMessage()}
        {renderPermissionStatus()}
        {renderListeningStatus()}

        {state.isBackgroundActive && (
          <View style={styles.backgroundIndicator}>
            <MaterialCommunityIcons name="circle" size={12} color="white" />
            <Text style={styles.backgroundIndicatorText}>
              Background mode active
            </Text>
          </View>
        )}

        <View style={styles.commandContainer}>
          <Text style={styles.commandText}>
            {!state.isRunning
              ? 'Voice service stopped'
              : state.isBackgroundActive
                ? 'Background mode: Service running'
                : commandConfigs[currentCommand]?.label || 'Say a command...'}
          </Text>

          {state.isRunning &&
            !state.isBackgroundActive &&
            currentCommand !== 'none' &&
            commandConfigs[currentCommand] && (
              <Animated.View style={{ opacity: fadeAnim }}>
                <Image
                  source={commandConfigs[currentCommand].imagePath}
                  style={styles.commandImage}
                />
              </Animated.View>
            )}

          {state.isRunning &&
            !state.isBackgroundActive &&
            (!currentCommand || currentCommand === 'none') && (
              <ActivityIndicator size="large" color={colors.primary} />
            )}
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            state.isRunning ? styles.buttonStop : styles.buttonStart,
            isButtonDisabled && styles.buttonDisabled,
          ]}
          onPress={toggleService}
          disabled={isButtonDisabled}
        >
          <Text style={styles.buttonText}>
            {state.isRunning ? 'Stop Voice Service' : 'Start Voice Service'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#2196F3' }]}
          onPress={requestAndroidPermissions}
        >
          <Text style={styles.buttonText}>
            Check Permissions
          </Text>
        </TouchableOpacity>

        <View style={styles.commandsContainer}>
          <Text style={styles.commandsTitle}>Available Commands:</Text>
          <Text style={styles.commandsText}>
            {Object.keys(commandConfigs).join(', ')}
          </Text>
        </View>

        <Text style={[styles.status, { color: getStatusColor() }]}>
          Status: {getStatusText()}
        </Text>

        {__DEV__ && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugText}>
              Debug Info:{'\n'}
              Android Version: {Platform.Version}{'\n'}
              Is Initialized: {state.isInitialized ? 'Yes' : 'No'}{'\n'}
              Background Permission: {backgroundPermissionGranted ? 'Yes' : 'No'}{'\n'}
              Native Module Available: {VoiceService ? 'Yes' : 'No'}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default VoiceServiceNative;