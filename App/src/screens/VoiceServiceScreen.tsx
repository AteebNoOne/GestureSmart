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
import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

import * as Notifications from 'expo-notifications';
import { responsiveFontSize, responsiveHeight, responsiveWidth } from 'react-native-responsive-dimensions';
import { useTheme } from '../hooks/useTheme';
import { typography } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';

interface CommandConfig {
  [key: string]: {
    label: string;
    imagePath: any;
    action: () => void;
  };
}

const BACKGROUND_TASK_NAME = 'VOICE_DETECTION';
const NOTIFICATION_ID = 'voice-service-notification';

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
  await Notifications.setNotificationChannelAsync('voice-service', {
    name: 'Voice Service',
    importance: Notifications.AndroidImportance.LOW,
    vibrationPattern: [0, 0, 0],
    lightColor: '#FF231F7C',
  });

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Voice Command Service Active',
      body: 'Running in background mode',
      priority: 'low',
    },
    trigger: null,
    identifier: NOTIFICATION_ID,
  });
};

interface VoiceScreenProps {
  navigation: NavigationProp<any>;
}

const VoiceService: React.FC<VoiceScreenProps> = ({ navigation }) => {
  const appState = useRef(AppState.currentState);
  const processingRef = useRef<boolean>(false);
  const keepAwakeRef = useRef<boolean>(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { colors } = useTheme();

  const [currentCommand, setCurrentCommand] = useState<string>('none');
  const [isListening, setIsListening] = useState(false);
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

  const commandConfigs: CommandConfig = {
    'swipe right': {
      label: 'Swipe Right',
      imagePath: require('../assets/gestures/swipe_right.png'),
      action: () => console.log('Swipe right')
    },
    'swipe left': {
      label: 'Swipe Left',
      imagePath: require('../assets/gestures/swipe_left.png'),
      action: () => console.log('Swipe left')
    },
    'tap': {
      label: 'Tap',
      imagePath: require('../assets/gestures/tap.png'),
      action: () => console.log('Tap')
    },
    'scroll up': {
      label: 'Scroll Up',
      imagePath: require('../assets/gestures/scroll_up.png'),
      action: () => console.log('Scroll up')
    },
    'scroll down': {
      label: 'Scroll Down',
      imagePath: require('../assets/gestures/scroll_down.png'),
      action: () => console.log('Scroll down')
    }
  };

  useEffect(() => {
    isRunningRef.current = state.isRunning;
  }, [state.isRunning]);

  // Initialize Voice recognition
  useEffect(() => {
    const initializeVoice = async () => {
      try {
        await Voice.destroy();
        await Voice.start('en-US');
        setState(prev => ({
          ...prev,
          isInitialized: true,
          status: 'stopped'
        }));
      } catch (e) {
        console.error(e);
      }
    };

    const restartVoice = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (isRunningRef.current) {
        try {
          await Voice.start('en-US');
        } catch (e) {
          console.error('Error restarting voice:', e);
        }
      }
    };

    
    Voice.onSpeechStart = () => setIsListening(true);
    Voice.onSpeechEnd = async () => {
      setIsListening(false);
      await restartVoice();
    };
    Voice.onSpeechResults = async (e: SpeechResultsEvent) => {
      if (e.value?.[0]) {
        const command = e.value[0].toLowerCase();
        handleCommand(command);
      }
      await restartVoice();
    };
  
    Voice.onSpeechError = async (e: SpeechErrorEvent) => {
      console.error('Speech error:', e);
      await restartVoice();
    };
  

    initializeVoice();

    return () => {
      Voice.destroy();
    };
  }, []);

  const handleCommand = (command: string) => {
    // Check if the command exists in our config
    const matchedCommand = Object.keys(commandConfigs).find(key => 
      command.includes(key)
    );

    if (matchedCommand) {
      setCurrentCommand(matchedCommand);
      commandConfigs[matchedCommand].action();
      
      // Provide audio feedback
      Speech.speak('Command recognized: ' + commandConfigs[matchedCommand].label, {
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
      marginVertical: 20,
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    listeningIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    listeningDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#4CAF50',
      marginRight: 10,
    },
    listeningText: {
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
        await Voice.start('en-US');
      } else {
        await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
        await safeDeactivateKeepAwake();
        processingRef.current = false;
        await Voice.stop();
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
            <Text style={styles.headerText}>Voice Commands</Text>
          </View>
        </View>

        {state.isRunning && (
          <View style={styles.listeningIndicator}>
            <View style={[
              styles.listeningDot,
              { opacity: isListening ? 1 : 0.3 }
            ]} />
            <Text style={styles.listeningText}>
              {isListening ? 'Listening...' : 'Waiting for voice...'}
            </Text>
          </View>
        )}

        <View style={styles.commandContainer}>
          <Text style={styles.commandText}>
            {!state.isRunning
              ? 'Voice service stopped'
              : commandConfigs[currentCommand]?.label || 'Say a command...'}
          </Text>

          {state.isRunning && (
            currentCommand !== 'none' && commandConfigs[currentCommand] ? (
              <Animated.View style={{ opacity: fadeAnim }}>
                <Image
                  source={commandConfigs[currentCommand].imagePath}
                  style={styles.commandImage}
                />
              </Animated.View>
            ) : (
              <ActivityIndicator size={100} color={colors.primary} />
            )
          )}
        </View>

        <TouchableOpacity
          style={[styles.button, state.isRunning ? styles.buttonStop : styles.buttonStart]}
          onPress={toggleService}
        >
          <Text style={styles.buttonText}>
            {state.isRunning ? 'Stop Voice Service' : 'Start Voice Service'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.status}>
          Available commands: swipe right, swipe left, tap, scroll up, scroll down
        </Text>

        <Text style={styles.status}>
          Status: {state.status.charAt(0).toUpperCase() + state.status.slice(1)}
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default VoiceService;