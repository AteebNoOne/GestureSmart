import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, AppState, AppStateStatus, SafeAreaView, ScrollView } from 'react-native';
import * as Speech from 'expo-speech';
import AudioRecord from 'react-native-audio-record';
import { Buffer } from 'buffer';
import { handleContinuousScrollDown, handleContinuousScrollUp, handlegoHome, handleOpenApp, handleReturn, handleScrollDown, handleScrollUp, handleShowRecentApps, handleStopScrolling, handleSwipeLeft, handleSwipeRight, handleTap } from '../features/actions';
import BackgroundService from 'react-native-background-actions'; // Add this package
import { askMicrophonePermission, handlePermissionBlocked } from '../utils/permissions';
import { API_KEYS } from '../constants/api_keys';
import { HeaderNavigation } from '../components/HeaderBackNavigation';
import { responsiveWidth } from 'react-native-responsive-dimensions';
import { useTheme } from '../hooks/useTheme';

interface VoiceServiceProps {
  apiKey?: string;
}

interface V3Message {
  type: string;
  id?: string;
  expires_at?: number;
  transcript?: string;
  turn_is_formatted?: boolean;
  audio_duration_seconds?: number;
  session_duration_seconds?: number;
  end_of_turn?: boolean;
  confidence?: number;
}

const VoiceService: React.FC<VoiceServiceProps> = ({ apiKey }) => {
  const [isListening, setIsListening] = useState(false);
  const [lastDetected, setLastDetected] = useState<string>('');
  const [transcript, setTranscript] = useState<string>('');
  const [partialTranscript, setPartialTranscript] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [sessionId, setSessionId] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const dataListenerRef = useRef<any>(null);
  const audioBufferRef = useRef<Uint8Array>(new Uint8Array(0)); // Buffer for accumulating audio data
  const bufferSizeRef = useRef<number>(0); // Track current buffer size
  const appStateRef = useRef(AppState.currentState);
  const ASSEMBLY_AI_API_KEY = apiKey || API_KEYS.ASSEMBLY_AI;
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const backgroundTaskOptions = {
    taskName: 'VoiceCommandService',
    taskTitle: 'Voice Command Service',
    taskDesc: 'Listening for voice commands',
    taskIcon: {
      name: 'ic_launcher',
      type: 'mipmap',
    },
    color: '#4CAF50',
    parameters: {
      delay: 1000,
    },
  };

  // Audio recording configuration for PCM16 16kHz
  const audioOptions = {
    sampleRate: 16000,
    channels: 1,
    bitsPerSample: 16,
    audioSource: 6, // VOICE_RECOGNITION for Android
    wavFile: 'audio.wav',
  };

  const targetWords = ['stop',
    'open app',
    'tap',
    'swipe left',
    'swipe right',
    'hands up',
    'scroll up',
    'hands down',
    'scroll down',
    'surrender',
    'go home',
    'show recent apps',
    'go back'];

  // Calculate required buffer size for 50ms of audio (minimum required by AssemblyAI)
  const SAMPLES_PER_50MS = (16000 * 0.05) * 2; // 1600 bytes (16000 samples/sec * 0.05s * 2 bytes/sample)

  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCommandRef = useRef({ phrase: '', timestamp: 0 });

  useEffect(() => {
    // Setup background service

    const checkPermissions = async () => {
      await requestMic();
    };
    checkPermissions();

    const setupBackgroundService = async () => {
      try {
        await BackgroundService.start(async () => {
          // This keeps the background service alive
          return new Promise<void>(() => { });
        }, backgroundTaskOptions);
        console.log('✅ Background service initialized');
      } catch (error) {
        console.error('❌ Background service init error:', error);
      }
    };

    setupBackgroundService();

    return () => {
      BackgroundService.stop();
    };
  }, []);

  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      console.log(`App state changed from ${appStateRef.current} to ${nextAppState}`);

      // App going to background - keep connection alive
      if (appStateRef.current === 'active' &&
        nextAppState.match(/inactive|background/)) {
        console.log('App moving to background - maintaining connection');

        // Start background service explicitly
        try {
          await BackgroundService.updateNotification({
            taskDesc: 'Listening for commands in background',
          });
        } catch (error) {
          console.log('Background notification update error:', error);
        }
      }

      // App coming to foreground
      if (appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active') {
        console.log('App returned to foreground');

        // Update notification
        try {
          await BackgroundService.updateNotification({
            taskDesc: 'Listening for voice commands',
          });
        } catch (error) {
          console.log('Foreground notification update error:', error);
        }
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => subscription.remove();
  }, []);

  const restartAudioStreaming = async () => {
    console.log("🔄 Attempting to restart audio streaming...");

    try {
      // Stop any existing recording
      stopAudioRecording();

      // Clear WebSocket connection if exists
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Reset state
      audioBufferRef.current = new Uint8Array(0);
      bufferSizeRef.current = 0;
      setPartialTranscript('');
      setTranscript('');
      setSessionId('');

      // Start new session - works in background
      startListening();
    } catch (error) {
      console.error("❌ Failed to restart audio:", error);

      // Retry after delay
      setTimeout(() => {
        if (isListening) restartAudioStreaming();
      }, 2000);
    }
  };

  // Update your detectTargetWords function
  const detectTargetWords = async (text: string) => {
    if (!text) return null;

    const normalizedText = text.toLowerCase().replace(/[^\w\s]/g, '');

    // Check for "open <appname>" pattern - matches any app name after "open"
    const openAppMatch = normalizedText.match(/^open\s+(.+)$/);
    if (openAppMatch) {
      const appName = openAppMatch[1].trim();

      // Prevent duplicate execution
      const now = Date.now();
      if (lastCommandRef.current.phrase === `open ${appName}` &&
        (now - lastCommandRef.current.timestamp < 3000)) {
        return null;
      }

      lastCommandRef.current = {
        phrase: `open ${appName}`,
        timestamp: now
      };

      setLastDetected(`open ${appName}`);

      try {
        // Pass the app display name to the native function
        await handleOpenApp(appName);
        await Speech.speak(`Opening ${appName}`, {
          language: 'en',
          pitch: 1.0,
          rate: 1.0,
        });
      } catch (error) {
        console.error('Error opening app:', error);

        // Handle specific error cases
        let errorMessage = `Failed to open ${appName}`;
        if (error instanceof Error && error.message.includes('APP_NOT_FOUND')) {
          errorMessage = `App ${appName} not found`;
        }

        await Speech.speak(errorMessage, {
          language: 'en',
          pitch: 1.0,
          rate: 1.0,
        });
      }
      return `open ${appName}`;
    }

    // Existing command handling
    for (const phrase of targetWords) {
      const normalizedPhrase = phrase.toLowerCase().replace(/[^\w\s]/g, '');

      // Skip if we just executed this command
      const now = Date.now();
      if (lastCommandRef.current.phrase === normalizedPhrase &&
        (now - lastCommandRef.current.timestamp < 3000)) {
        continue;
      }

      if (normalizedText.includes(normalizedPhrase)) {
        // Update last command
        lastCommandRef.current = {
          phrase: normalizedPhrase,
          timestamp: now
        };

        setLastDetected(phrase);

        try {
          switch (phrase) {
            case "stop":
              await stopListening();
              break;
            case "tap":
              await handleTap(0, 0);
              break;
            case "swipe left":
              await handleSwipeLeft();
              break;
            case "swipe right":
              await handleSwipeRight();
              break;
            case "scroll up":
              await handleScrollUp();
              break;
            case "hands up":
              await handleContinuousScrollUp();
              break;

            case "scroll down":
              await handleScrollDown();
              break;
            case "hands down":
              await handleContinuousScrollDown();
              break;
            case "surrender":
              await handleStopScrolling();
              break;
            case "go home":
              await handlegoHome();
              break;
            case "show recent apps":
              await handleShowRecentApps();
              break;
            case "go back":
              await handleReturn();
              break;
            default:
              break;
          }

          // Speak feedback
          await Speech.speak(`${phrase} detected`, {
            language: 'en',
            pitch: 1.0,
            rate: 1.0,
          });
        } catch (error) {
          console.error('Command execution error:', error);
        }

        return phrase;
      }
    }
    return null;
  };


  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toISOString();
  };

  const base64ToUint8Array = (base64: string): Uint8Array => {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  };

  const requestMic = async () => {
    const status = await askMicrophonePermission({
      title: 'Voice Recording Permission',
      message: 'We need microphone access for voice features',
      buttonPositive: 'Enable',
      buttonNegative: 'Not Now'
    });

    if (status === 'granted') {
      // Start microphone operations
    } else if (status === 'never_ask_again') {
      // Show custom message with instructions
      handlePermissionBlocked('microphone')
    }
  };


  const startListening = async () => {
    const status = await askMicrophonePermission({
      title: 'Voice Recording Permission',
      message: 'We need microphone access for voice features',
      buttonPositive: 'Enable',
      buttonNegative: 'Not Now'
    });

    if (status !== 'granted') {
      if (status === 'never_ask_again') {
        handlePermissionBlocked('microphone');
      }
      return;
    }

    if (!ASSEMBLY_AI_API_KEY) {
      Alert.alert('Error', 'AssemblyAI API key is required');
      return;
    }

    try {
      setConnectionStatus('connecting');
      audioBufferRef.current = new Uint8Array(0);
      bufferSizeRef.current = 0;

      // Initialize audio recording
      AudioRecord.init(audioOptions);
      console.log('✅ Audio recording initialized');

      // Build V3 WebSocket URL with optimized parameters
      const queryParams = new URLSearchParams({
        sample_rate: '16000',
        encoding: 'pcm_s16le',
        format_turns: 'false',
      });

      const wsUrl = `wss://streaming.assemblyai.com/v3/ws?${queryParams.toString()}`;
      console.log('🔗 Connecting to:', wsUrl);

      // Create WebSocket connection to AssemblyAI V3
      const ws = new WebSocket(wsUrl, [], {
        headers: {
          'Authorization': ASSEMBLY_AI_API_KEY,
        },
      });

      wsRef.current = ws;

      ws.onopen = async () => {
        console.log('✅ WebSocket connection opened to AssemblyAI V3');
        setConnectionStatus('connected');
        setIsListening(true);

        // Start audio recording
        AudioRecord.start();
        console.log('🎤 Audio recording started');
        isRecordingRef.current = true;

        // Setup audio data listener
        dataListenerRef.current = AudioRecord.on('data', (base64Data: string) => {
          if (!isRecordingRef.current || !ws || ws.readyState !== WebSocket.OPEN) return;

          try {
            // Convert base64 to Uint8Array (raw PCM)
            const newData = base64ToUint8Array(base64Data);

            // Add new data to buffer
            const tempBuffer = new Uint8Array(bufferSizeRef.current + newData.length);
            tempBuffer.set(audioBufferRef.current);
            tempBuffer.set(newData, bufferSizeRef.current);
            audioBufferRef.current = tempBuffer;
            bufferSizeRef.current += newData.length;

            // Send chunks when we have at least 50ms of audio
            while (bufferSizeRef.current >= SAMPLES_PER_50MS) {
              const chunkToSend = audioBufferRef.current.slice(0, SAMPLES_PER_50MS);

              // Send to WebSocket
              ws.send(chunkToSend.buffer);

              // Remove sent data from buffer
              const remaining = bufferSizeRef.current - SAMPLES_PER_50MS;
              const temp = new Uint8Array(remaining);
              temp.set(audioBufferRef.current.subarray(SAMPLES_PER_50MS));
              audioBufferRef.current = temp;
              bufferSizeRef.current = remaining;
            }
          } catch (error) {
            console.error('❌ Error processing audio data:', error);
          }
        });
      };

      ws.onmessage = (event) => {
        try {
          const data: V3Message = JSON.parse(event.data);
          const msgType = data.type;
          console.log('📨 Received message:', msgType, data);

          if (msgType === 'Begin') {
            const sessionId = data.id || '';
            const expiresAt = data.expires_at;
            setSessionId(sessionId);
            setTranscript('');
            setPartialTranscript('');
            console.log(`🚀 Session began: ID=${sessionId}, ExpiresAt=${expiresAt ? formatTimestamp(expiresAt) : 'N/A'}`);
          }
          else if (msgType === 'Turn') {
            const transcriptText = data.transcript || '';
            const isFormatted = data.turn_is_formatted || false;

            if (!isFormatted) {
              // Unformatted transcript (partial)
              setPartialTranscript(transcriptText);
              detectTargetWords(transcriptText);
            } else {
              // Formatted transcript (final)
              setTranscript(prev => prev ? `${prev} ${transcriptText}` : transcriptText);
              setPartialTranscript('');
              detectTargetWords(transcriptText);
            }
          }
          else if (msgType === 'Termination') {
            const audioDuration = data.audio_duration_seconds || 0;
            const sessionDuration = data.session_duration_seconds || 0;
            console.log(`🛑 Session Terminated: Audio Duration=${audioDuration}s, Session Duration=${sessionDuration}s`);
            setConnectionStatus('disconnected');
            setIsListening(false);
          }
        } catch (error) {
          console.error('❌ Error handling message:', error);
          console.error('Message data:', event.data);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        Alert.alert('Connection Error', 'Failed to connect to AssemblyAI V3');
        setConnectionStatus('disconnected');
        stopAudioRecording();
      };

      ws.onclose = (event) => {
        console.log(`🔌 WebSocket Disconnected: Status=${event.code}, Reason=${event.reason}`);
        setConnectionStatus('disconnected');
        setIsListening(false);
        stopAudioRecording();
      };

    } catch (error: unknown) {
      console.error('❌ Error starting voice service:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Failed to start voice recognition: ${errorMessage}`);
      setConnectionStatus('disconnected');
    }
  };

  const stopAudioRecording = () => {
    if (isRecordingRef.current) {
      console.log('🛑 Stopping audio recording...');
      isRecordingRef.current = false;

      // Remove audio data listener
      if (dataListenerRef.current) {
        dataListenerRef.current.remove();
        dataListenerRef.current = null;
      }

      try {
        AudioRecord.stop();
        console.log('✅ Audio recording stopped');
      } catch (error) {
        console.error('❌ Error stopping audio recording:', error);
      }
    }
  };

  const stopListening = async () => {
    console.log('🛑 Stopping listening...');
    stopAudioRecording();

    // Send termination message to V3 API
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        const terminateMessage = { type: 'Terminate' };
        console.log('📤 Sending termination message:', terminateMessage);
        wsRef.current.send(JSON.stringify(terminateMessage));
      } catch (error) {
        console.error('❌ Error sending termination message:', error);
      }
    }

    if (wsRef.current) {
      wsRef.current.close();
    }

    setIsListening(false);
    setConnectionStatus('disconnected');
    setSessionId('');
  };

  useEffect(() => {
    return () => {
      stopListening();
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
      }
    };
  }, []);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#4CAF50';
      case 'connecting': return '#FF9800';
      default: return '#f44336';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected & Streaming';
      case 'connecting': return 'Connecting...';
      default: return 'Disconnected';
    }
  };



  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <HeaderNavigation title='Voice Service' />
        <View style={styles.statusContainer}>
          <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
        {sessionId && (
          <View style={styles.sessionContainer}>
            <Text style={styles.sessionText}>Session: {sessionId.slice(0, 8)}...</Text>
          </View>
        )}
        <View style={styles.targetWordsContainer}>
          <Text style={styles.sectionTitle}>Target Words:</Text>
          <View style={styles.wordsWrap}>
            <View style={styles.wordWrapContainer}>
              {targetWords.map((word) => (
                <View
                  key={word}
                  style={[
                    styles.wordChip,
                    lastDetected === word && styles.wordChipActive
                  ]}
                >
                  <Text
                    style={[
                      styles.wordText,
                      lastDetected === word && styles.wordTextActive
                    ]}
                  >
                    {word}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {lastDetected && (
          <View style={styles.detectionContainer}>
            <Text style={styles.detectionText}>
              🎯 Last Detected: "{lastDetected}"
            </Text>
          </View>
        )}

        <View style={styles.transcriptContainer}>
          <Text style={styles.sectionTitle}>Live Transcript:</Text>
          <Text style={styles.transcript}>
            {transcript || 'No speech detected...'}
          </Text>
          {partialTranscript && (
            <Text style={styles.partialTranscript}>
              Partial: {partialTranscript}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            isListening ? styles.stopButton : styles.startButton
          ]}
          onPress={isListening ? stopListening : startListening}
          disabled={connectionStatus === 'connecting'}
        >
          <Text style={styles.buttonText}>
            {isListening ? 'Stop Listening' : 'Start Listening'}
          </Text>
        </TouchableOpacity>

        <View style={styles.instructionContainer}>
          <Text style={styles.instruction}>
            Say any target word
          </Text>
          <Text style={styles.note}>
            ✅ Now using real PCM audio from microphone
          </Text>
          <Text style={styles.techNote}>
            react-native-audio-record → PCM16 → AssemblyAI V3
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: responsiveWidth(5),
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
    fontStyle: 'italic',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  sessionContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sessionText: {
    fontSize: 12,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  targetWordsContainer: {
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  wordsWrap: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  wordWrapContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10, // if not supported, use margin manually below
  },
  wordChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: 8, // fallback if `gap` not supported
    marginHorizontal: 5,
  },
  wordChipActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#388E3C',
  },
  wordText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  wordTextActive: {
    color: '#fff',
  },


  detectionContainer: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  detectionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  transcriptContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    minHeight: 120,
  },
  transcript: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
  },
  partialTranscript: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 5,
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 15,
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  instructionContainer: {
    alignItems: 'center',
  },
  instruction: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 5,
  },
  note: {
    fontSize: 12,
    textAlign: 'center',
    color: '#4CAF50',
    fontWeight: '600',
    marginBottom: 5,
  },
  techNote: {
    fontSize: 11,
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
  },
});

export default VoiceService;