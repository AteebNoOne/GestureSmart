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

interface CommandConfig {
  [key: string]: {
    label: string;
    imagePath: any;
    action: () => void;
  };
}

interface TranscriptTurn {
  transcript?: string;
  isFormatted?: boolean;
}

// AssemblyAI Configuration - Following SDK pattern
const ASSEMBLYAI_CONFIG = {
  apiKey: '77955c73bf114d379a9047c6525e0d58',
  sampleRate: 16000,
  formatTurns: true,
  channels: 1,
};

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

// SDK-like Streaming Transcriber Class
class StreamingTranscriber {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private sessionId: string | null = null;
  private eventHandlers: { [key: string]: Function[] } = {};

  constructor(private config: typeof ASSEMBLYAI_CONFIG) { }

  // Event emitter methods - following SDK pattern
  on(event: string, handler: Function) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  private emit(event: string, ...args: any[]) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler(...args));
    }
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const queryParams = new URLSearchParams({
        sample_rate: this.config.sampleRate.toString(),
        format_turns: this.config.formatTurns.toString(),
      });

      const wsUrl = `wss://streaming.assemblyai.com/v3/ws?${queryParams.toString()}`;

      this.ws = new WebSocket(wsUrl, [], {
        headers: {
          'Authorization': this.config.apiKey,
        },
      });

      const timeout = setTimeout(() => {
        this.ws?.close();
        reject(new Error('Connection timeout'));
      }, 10000);

      this.ws.onopen = () => {
        clearTimeout(timeout);
        this.isConnected = true;
        console.log('Connected to streaming transcript service');
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing message:', error);
          this.emit('error', error);
        }
      };

      this.ws.onerror = (error) => {
        clearTimeout(timeout);
        console.error('WebSocket error:', error);
        this.emit('error', error);
        reject(error);
      };

      this.ws.onclose = (event) => {
        clearTimeout(timeout);
        this.isConnected = false;
        console.log('Session closed:', event.code, event.reason);
        this.emit('close', event.code, event.reason);
      };
    });
  }

  private handleMessage(data: any) {
    const msgType = data.type;

    if (msgType === 'Begin') {
      this.sessionId = data.id;
      const expiresAt = data.expires_at;
      console.log(`Session opened with ID: ${this.sessionId}`);
      this.emit('open', { id: this.sessionId, expiresAt });
    } else if (msgType === 'Turn') {
      const transcript = data.transcript || '';
      const isFormatted = data.turn_is_formatted;

      if (transcript) {
        const turn: TranscriptTurn = {
          transcript,
          isFormatted
        };

        console.log('Turn:', transcript, isFormatted ? '(formatted)' : '(partial)');
        this.emit('turn', turn);
      }
    } else if (msgType === 'Termination') {
      const audioDuration = data.audio_duration_seconds;
      const sessionDuration = data.session_duration_seconds;
      console.log(`Session terminated: Audio=${audioDuration}s, Session=${sessionDuration}s`);
      this.emit('termination', { audioDuration, sessionDuration });
    }
  }

  // Send audio data - following SDK stream pattern
  sendAudio(audioData: Uint8Array) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(audioData);
    }
  }

  async close(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send termination message
      const terminateMessage = { type: 'Terminate' };
      console.log('Closing streaming transcript connection');
      this.ws.send(JSON.stringify(terminateMessage));
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.sessionId = null;
  }

  get connected(): boolean {
    return this.isConnected;
  }
}

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
  const transcriberRef = useRef<StreamingTranscriber | null>(null);
  const isRecordingRef = useRef(false);
  const audioStreamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isStreamingRef = useRef(false);

  const [currentCommand, setCurrentCommand] = useState<string>('none');
  const [isListening, setIsListening] = useState(false);
  const [lastHeard, setLastHeard] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
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

  // Create and setup transcriber - following SDK pattern
  const createTranscriber = (): StreamingTranscriber => {
    const transcriber = new StreamingTranscriber(ASSEMBLYAI_CONFIG);

    // Setup event handlers - following SDK pattern
    transcriber.on('open', ({ id }: { id: string }) => {
      console.log(`Session opened with ID: ${id}`);
      setSessionId(id);
      setIsListening(true);
    });

    transcriber.on('error', (error: any) => {
      console.error('Transcriber error:', error);
      setIsListening(false);
    });

    transcriber.on('close', (code: number, reason: string) => {
      console.log('Session closed:', code, reason);
      setIsListening(false);
      setSessionId('');
    });

    // Handle transcript turns - following SDK pattern
    transcriber.on('turn', (turn: TranscriptTurn) => {
      if (!turn.transcript) {
        return;
      }

      if (turn.isFormatted) {
        // Final transcript
        console.log('Turn:', turn.transcript);
        setLastHeard(turn.transcript);
        handleCommand(turn.transcript.toLowerCase());
      } else {
        // Partial transcript
        setLastHeard(`${turn.transcript}...`);
      }
    });

    transcriber.on('termination', ({ audioDuration, sessionDuration }: any) => {
      console.log(`Audio: ${audioDuration}s, Session: ${sessionDuration}s`);
    });

    return transcriber;
  };

  // Start recording and streaming - following SDK pattern
  const startRecording = async () => {
    try {
      if (isRecordingRef.current) {
        console.log('Recording already in progress');
        return;
      }

      console.log('Starting recording');

      // Create transcriber and connect - following SDK pattern
      transcriberRef.current = createTranscriber();
      await transcriberRef.current.connect();

      // Start continuous audio recording
      await startContinuousRecording();

      // Start streaming audio data
      startAudioStreaming();

    } catch (error) {
      console.error('Error starting recording:', error);
      setIsListening(false);
      isRecordingRef.current = false;
    }
  };

  const startContinuousRecording = async () => {
    try {
      // Clean up any existing recording
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
          sampleRate: ASSEMBLYAI_CONFIG.sampleRate,
          numberOfChannels: ASSEMBLYAI_CONFIG.channels,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: ASSEMBLYAI_CONFIG.sampleRate,
          numberOfChannels: ASSEMBLYAI_CONFIG.channels,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });

      recordingRef.current = recording;
      isRecordingRef.current = true;
      isStreamingRef.current = true;

      await recording.startAsync();
      console.log('Continuous recording started');

    } catch (error) {
      console.error('Error starting continuous recording:', error);
      isRecordingRef.current = false;
      isStreamingRef.current = false;
    }
  };

  // Stream audio data - following SDK pattern
  const startAudioStreaming = () => {
    if (audioStreamIntervalRef.current) {
      clearInterval(audioStreamIntervalRef.current);
    }

    // Stream audio chunks at regular intervals
    audioStreamIntervalRef.current = setInterval(async () => {
      if (!isStreamingRef.current || !transcriberRef.current?.connected || !recordingRef.current) {
        return;
      }

      try {
        await streamAudioChunk();
      } catch (error) {
        console.error('Error in audio streaming:', error);
      }
    }, 1000); // Stream every 1 second
  };

  const streamAudioChunk = async () => {
    try {
      if (!recordingRef.current || !transcriberRef.current?.connected || !isStreamingRef.current) {
        return;
      }

      const status = await recordingRef.current.getStatusAsync();
      if (!status.isRecording || status.durationMillis < 800) {
        return; // Need minimum audio duration
      }

      // Stop current recording to get audio data
      const uri = await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;

      // Send audio to transcriber - following SDK pattern
      await sendAudioToTranscriber(uri);

      // Restart recording for continuous streaming
      if (isStreamingRef.current) {
        await startContinuousRecording();
      }

    } catch (error) {
      console.error('Error streaming audio chunk:', error);

      // Try to recover
      if (isStreamingRef.current) {
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

  // Send audio to transcriber - following SDK pattern
  const sendAudioToTranscriber = async (uri: string) => {
    try {
      if (!transcriberRef.current?.connected) {
        return;
      }

      // Read audio file as binary data
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const audioData = new Uint8Array(arrayBuffer);

      // Send to transcriber - following SDK pattern
      transcriberRef.current.sendAudio(audioData);

      console.log(`Streamed ${audioData.length} bytes to transcriber`);

    } catch (error) {
      console.error('Error sending audio to transcriber:', error);
    }
  };

  const stopRecording = async () => {
    try {
      console.log('Stopping recording');

      isStreamingRef.current = false;

      // Clear streaming interval
      if (audioStreamIntervalRef.current) {
        clearInterval(audioStreamIntervalRef.current);
        audioStreamIntervalRef.current = null;
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

    // Close transcriber connection - following SDK pattern
    if (transcriberRef.current) {
      await transcriberRef.current.close();
      transcriberRef.current = null;
    }

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
    sessionText: {
      fontSize: responsiveFontSize(1.6),
      fontFamily: typography.fontFamily.regular,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: responsiveHeight(1),
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
              {isListening ? 'Listening with AssemblyAI Streaming...' : 'Connecting...'}
            </Text>
          </View>
        )}

        <View style={styles.commandContainer}>
          <Text style={styles.commandText}>
            {!state.isRunning
              ? 'Voice service stopped'
              : commandConfigs[currentCommand]?.label || 'Say a command...'}
          </Text>

          {sessionId && (
            <Text style={styles.sessionText}>
              Session: {sessionId.substring(0, 8)}...
            </Text>
          )}

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
          Powered by AssemblyAI Streaming SDK Pattern
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default VoiceService;