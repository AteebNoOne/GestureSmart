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
import { Audio } from 'expo-av';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { responsiveFontSize, responsiveHeight, responsiveWidth } from 'react-native-responsive-dimensions';
import { useTheme } from '../hooks/useTheme';
import { typography } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import { Readable } from 'stream'
import { AssemblyAI } from 'assemblyai'
import recorder from 'node-record-lpcm16'

interface CommandConfig {
  [key: string]: {
    label: string;
    imagePath: any;
    action: () => void;
  };
}

const BACKGROUND_TASK_NAME = 'VOICE_DETECTION';
const NOTIFICATION_ID = 'voice-service-notification';

// AssemblyAI Streaming API v3 Configuration
const ASSEMBLYAI_API_KEY = '77955c73bf114d379a9047c6525e0d58'; // Your API key
const CONNECTION_PARAMS = {
  sample_rate: 16000,
  format_turns: true, // Request formatted final transcripts
};
const API_ENDPOINT_BASE_URL = 'wss://streaming.assemblyai.com/v3/ws';

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

  // Audio recording refs
  const recordingRef = useRef<Audio.Recording | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const isRecordingRef = useRef(false);
  const audioChunkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isStreamingRef = useRef(false);
  const isPreparingRecordingRef = useRef(false);

  const [currentCommand, setCurrentCommand] = useState<string>('none');
  const [isListening, setIsListening] = useState(false);
  const [lastHeard, setLastHeard] = useState<string>('');
  const [state, setState] = useState<{
    isRunning: boolean;
    isInitialized: boolean;
    status: 'initializing' | 'stopped' | 'running' | 'error';
  }>({
    isRunning: false,
    isInitialized: false,
    status: 'initializing',
  });

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

  // Initialize Audio
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) {
          console.error('Audio permission not granted');
          setState(prev => ({ ...prev, status: 'error' }));
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        setState(prev => ({
          ...prev,
          isInitialized: true,
          status: 'stopped'
        }));
      } catch (e) {
        console.error('Audio initialization error:', e);
        setState(prev => ({ ...prev, status: 'error' }));
      }
    };

    initializeAudio();

    return () => {
      cleanup();
    };
  }, []);

  // Create WebSocket connection to AssemblyAI Streaming API v3
  const createWebSocket = (): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      // Build query string for connection parameters
      const queryParams = new URLSearchParams({
        sample_rate: CONNECTION_PARAMS.sample_rate.toString(),
        format_turns: CONNECTION_PARAMS.format_turns.toString(),
      });

      // Correct AssemblyAI Streaming API v3 endpoint
      const wsUrl = `${API_ENDPOINT_BASE_URL}?${queryParams.toString()}`;
      console.log('Connecting to:', wsUrl);

      const ws = new WebSocket(wsUrl, [], {
        headers: {
          'Authorization': ASSEMBLYAI_API_KEY,
        },
      });

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      ws.onopen = () => {
        clearTimeout(timeout);
        console.log('AssemblyAI Streaming v3 WebSocket connected');
        setIsListening(true);
        resolve(ws);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('AssemblyAI v3 message:', data);

          const msgType = data.type;

          if (msgType === 'Begin') {
            const sessionId = data.id;
            const expiresAt = data.expires_at;
            console.log(`Session began: ID=${sessionId}, ExpiresAt=${new Date(expiresAt * 1000).toISOString()}`);
          } else if (msgType === 'Turn') {
            const transcript = data.transcript || '';
            const formatted = data.turn_is_formatted;

            if (transcript) {
              if (formatted) {
                console.log('Final transcript:', transcript);
                setLastHeard(transcript);
                handleCommand(transcript.toLowerCase());
              } else {
                console.log('Partial transcript:', transcript);
                setLastHeard(`${transcript}...`);
              }
            }
          } else if (msgType === 'Termination') {
            const audioDuration = data.audio_duration_seconds;
            const sessionDuration = data.session_duration_seconds;
            console.log(`Session Terminated: Audio Duration=${audioDuration}s, Session Duration=${sessionDuration}s`);
            setIsListening(false);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          console.error('Message data:', event.data);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        console.error('WebSocket error:', error);
        setIsListening(false);
        reject(error);
      };

      ws.onclose = (event) => {
        clearTimeout(timeout);
        console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
        setIsListening(false);
      };
    });
  };

  const closeWebSocket = () => {
    if (websocketRef.current) {
      if (websocketRef.current.readyState === WebSocket.OPEN) {
        // Send termination message for v3 API
        const terminateMessage = { type: 'Terminate' };
        console.log('Sending termination message:', JSON.stringify(terminateMessage));
        websocketRef.current.send(JSON.stringify(terminateMessage));
      }
      websocketRef.current.close();
      websocketRef.current = null;
    }
  };

  // Start recording with proper single Recording management
  const startRecording = async () => {
    try {
      if (isRecordingRef.current || isPreparingRecordingRef.current) {
        console.log('Recording already in progress');
        return;
      }

      // Create WebSocket connection first
      websocketRef.current = await createWebSocket();

      // Start continuous recording
      await startContinuousRecording();

    } catch (error) {
      console.error('Error starting recording:', error);
      isRecordingRef.current = false;
      isPreparingRecordingRef.current = false;
      setIsListening(false);
    }
  };

  const startContinuousRecording = async () => {
    try {
      if (isPreparingRecordingRef.current) {
        console.log('Already preparing recording');
        return;
      }

      isPreparingRecordingRef.current = true;

      // Clean up any existing recording first
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (e) {
          console.log('Previous recording cleanup:', e.message);
        }
        recordingRef.current = null;
      }

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_DEFAULT,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });

      recordingRef.current = recording;
      isRecordingRef.current = true;
      isStreamingRef.current = true;
      isPreparingRecordingRef.current = false;

      await recording.startAsync();
      console.log('Continuous recording started');

      // Start the streaming cycle with longer intervals to avoid conflicts
      startStreamingCycle();

    } catch (error) {
      console.error('Error starting continuous recording:', error);
      isRecordingRef.current = false;
      isStreamingRef.current = false;
      isPreparingRecordingRef.current = false;
    }
  };

  const startStreamingCycle = () => {
    if (audioChunkIntervalRef.current) {
      clearInterval(audioChunkIntervalRef.current);
    }

    // Use longer intervals (2 seconds) to avoid Recording conflicts
    audioChunkIntervalRef.current = setInterval(async () => {
      if (!isStreamingRef.current || !websocketRef.current || !recordingRef.current || isPreparingRecordingRef.current) {
        return;
      }

      try {
        await processAudioChunk();
      } catch (error) {
        console.error('Error in streaming cycle:', error);
      }
    }, 2000); // Process every 2 seconds
  };

  const processAudioChunk = async () => {
    try {
      if (!recordingRef.current || !websocketRef.current || !isStreamingRef.current || isPreparingRecordingRef.current) {
        return;
      }

      const status = await recordingRef.current.getStatusAsync();
      if (!status.isRecording || status.durationMillis < 1000) {
        return; // Need at least 1 second of audio
      }

      // Stop current recording and get the audio data
      const uri = await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;

      // Send to AssemblyAI
      await sendAudioToAssemblyAI(uri);

      // Start new recording if still streaming
      if (isStreamingRef.current) {
        await startContinuousRecording();
      }

    } catch (error) {
      console.error('Error processing audio chunk:', error);
      isPreparingRecordingRef.current = false;

      // Try to recover by restarting recording
      if (isStreamingRef.current && !isPreparingRecordingRef.current) {
        setTimeout(async () => {
          try {
            await startContinuousRecording();
          } catch (restartError) {
            console.error('Error restarting recording:', restartError);
          }
        }, 1000);
      }
    }
  };

  // Send audio data to AssemblyAI v3 API
  const sendAudioToAssemblyAI = async (uri: string) => {
    try {
      if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
        return;
      }

      // Read audio file as binary data
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();

      // Convert to Buffer and send directly (v3 API expects raw binary data)
      const audioBuffer = new Uint8Array(arrayBuffer);
      websocketRef.current.send(audioBuffer);

      console.log(`Sent ${audioBuffer.length} bytes to AssemblyAI v3`);

    } catch (error) {
      console.error('Error sending audio to AssemblyAI:', error);
    }
  };

  const stopRecording = async () => {
    try {
      isStreamingRef.current = false;

      // Clear streaming interval
      if (audioChunkIntervalRef.current) {
        clearInterval(audioChunkIntervalRef.current);
        audioChunkIntervalRef.current = null;
      }

      // Stop and clean up recording
      if (recordingRef.current && isRecordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (e) {
          console.log('Recording cleanup:', e.message);
        }
        recordingRef.current = null;
      }

      isRecordingRef.current = false;
      isPreparingRecordingRef.current = false;
      setIsListening(false);

    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  };

  const handleCommand = (command: string) => {
    console.log('Processing command:', command);

    const matchedCommand = Object.keys(commandConfigs).find(key =>
      command.includes(key)
    );

    if (matchedCommand) {
      console.log('Matched command:', matchedCommand);
      setCurrentCommand(matchedCommand);
      commandConfigs[matchedCommand].action();

      Speech.speak('Command recognized: ' + commandConfigs[matchedCommand].label, {
        rate: 1.0,
        pitch: 1.0,
        language: 'en-US'
      });
    } else {
      console.log('No command matched for:', command);
    }
  };

  const cleanup = async () => {
    await stopRecording();
    closeWebSocket();
    await safeDeactivateKeepAwake();
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
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
    const subscription = AppState.addEventListener('change', (nextAppState) => {
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
        await startRecording();
      } else {
        await cleanup();
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
    debugText: {
      fontSize: responsiveFontSize(1.8),
      fontFamily: typography.fontFamily.regular,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: responsiveHeight(1),
      fontStyle: 'italic',
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
              {isListening ? 'Listening with AssemblyAI v3 Streaming...' : 'Connecting...'}
            </Text>
          </View>
        )}

        <View style={styles.commandContainer}>
          <Text style={styles.commandText}>
            {!state.isRunning
              ? 'Voice service stopped'
              : commandConfigs[currentCommand]?.label || 'Say a command...'}
          </Text>

          {lastHeard && (
            <Text style={styles.debugText}>
              Last heard: "{lastHeard}"
            </Text>
          )}

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

        <Text style={styles.status}>
          Powered by AssemblyAI Streaming API v3
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default VoiceService;