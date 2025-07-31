// hooks/useVoiceService.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import Voice, {
    SpeechResultsEvent,
    SpeechErrorEvent,
    SpeechStartEvent,
    SpeechEndEvent,
    SpeechVolumeChangeEvent,
} from '@react-native-voice/voice';
import * as Speech from 'expo-speech';
import { Alert, Platform } from 'react-native';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import * as Notifications from 'expo-notifications';

export interface CommandConfig {
    [key: string]: {
        label: string;
        imagePath: any;
        action: () => void;
    };
}

export interface VoiceServiceState {
    isRunning: boolean;
    isInitialized: boolean;
    isListening: boolean;
    currentCommand: string;
    status: 'initializing' | 'stopped' | 'running' | 'error' | 'no-service';
    error: string | null;
    currentLocale: string;
    partialResults: string[];
}

const NOTIFICATION_ID = 'voice-service-notification';

// Fallback locales in order of preference
const FALLBACK_LOCALES = [
    'en-US',
    'en-GB',
    'en-AU',
    'en-CA',
    'en-IN',
    'en', // Generic English
];

// Voice recognition options for better continuous listening
const VOICE_OPTIONS = {
    EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 10000, // 10 seconds minimum
    EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2000, // 2 seconds of silence
    EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 2000,
    REQUEST_PERMISSIONS_AUTO: true,
};

// Configure notifications
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
    }),
});

const showForegroundNotification = async () => {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('voice-service', {
            name: 'Voice Service',
            importance: Notifications.AndroidImportance.LOW,
            vibrationPattern: [0, 0, 0],
            lightColor: '#FF231F7C',
        });

        await Notifications.scheduleNotificationAsync({
            content: {
                title: 'Voice Command Service Active',
                body: 'Listening for voice commands...',
                priority: 'low',
            },
            trigger: null,
            identifier: NOTIFICATION_ID,
        });
    }
};

export const useVoiceService = (commandConfigs: CommandConfig) => {
    const [state, setState] = useState<VoiceServiceState>({
        isRunning: false,
        isInitialized: false,
        isListening: false,
        currentCommand: 'none',
        status: 'initializing',
        error: null,
        currentLocale: 'en-US',
        partialResults: [],
    });

    const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const keepAwakeRef = useRef<boolean>(false);
    const isDestroyedRef = useRef<boolean>(false);
    const localeIndexRef = useRef<number>(0);
    const errorCountRef = useRef<number>(0);
    const consecutiveErrorsRef = useRef<number>(0);
    const isActivelyListeningRef = useRef<boolean>(false);
    const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Find working locale for the device
    const findWorkingLocale = useCallback(async (): Promise<string> => {
        console.log('Finding working locale for device...');

        for (let i = localeIndexRef.current; i < FALLBACK_LOCALES.length; i++) {
            const locale = FALLBACK_LOCALES[i];
            try {
                console.log(`Testing locale: ${locale}`);
                await Voice.stop();
                await Voice.destroy();
                await new Promise(resolve => setTimeout(resolve, 500));

                // Try to start with this locale
                await Voice.start(locale, VOICE_OPTIONS);
                await Voice.stop();

                console.log(`Locale ${locale} works!`);
                localeIndexRef.current = i;
                return locale;
            } catch (error: any) {
                console.log(`Locale ${locale} failed:`, error);
                if (error?.code === '12' || error?.message?.includes('12')) {
                    continue; // Language not supported, try next
                } else {
                    console.log(`Using ${locale} despite test error`);
                    localeIndexRef.current = i;
                    return locale;
                }
            }
        }

        console.log('All locales failed, using en-US as fallback');
        return FALLBACK_LOCALES[0];
    }, []);

    // Check if voice recognition is available
    const checkVoiceAvailability = useCallback(async () => {
        try {
            const available = await Voice.isAvailable();
            if (!available) {
                setState(prev => ({
                    ...prev,
                    status: 'no-service',
                    error: 'Voice recognition service not available'
                }));
                return false;
            }

            if (Platform.OS === 'android') {
                const services = await Voice.getSpeechRecognitionServices();
                console.log('Available speech services:', services);

                if (!services || services.length === 0) {
                    setState(prev => ({
                        ...prev,
                        status: 'no-service',
                        error: 'No speech recognition services found'
                    }));
                    Alert.alert(
                        'Speech Recognition Unavailable',
                        'Please install Google Search App or enable Google Speech Recognition in your device settings.',
                        [{ text: 'OK' }]
                    );
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error('Error checking voice availability:', error);
            setState(prev => ({
                ...prev,
                status: 'error',
                error: 'Failed to check voice availability'
            }));
            return false;
        }
    }, []);

    // Handle voice command processing
    const handleCommand = useCallback((command: string) => {
        console.log('Processing command:', command);
        errorCountRef.current = 0;
        consecutiveErrorsRef.current = 0;

        const matchedCommand = Object.keys(commandConfigs).find(key =>
            command.toLowerCase().includes(key.toLowerCase())
        );

        if (matchedCommand) {
            console.log('Matched command:', matchedCommand);
            setState(prev => ({ ...prev, currentCommand: matchedCommand, partialResults: [] }));

            // Execute command action
            commandConfigs[matchedCommand].action();

            // Provide audio feedback
            Speech.speak(`${commandConfigs[matchedCommand].label}`, {
                rate: 1.2,
                pitch: 1.0,
                language: 'en-US'
            });

            // Reset command after 2 seconds
            setTimeout(() => {
                setState(prev => ({ ...prev, currentCommand: 'none' }));
            }, 2000);
        } else {
            console.log('No matching command found for:', command);
            // Clear partial results if no match
            setState(prev => ({ ...prev, partialResults: [] }));
        }
    }, [commandConfigs]);

    // Smart restart with backoff strategy
    const smartRestart = useCallback(async (delay: number = 1000) => {
        if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
        }

        if (!state.isRunning || isDestroyedRef.current || !isActivelyListeningRef.current) {
            return;
        }

        // Implement exponential backoff for consecutive errors
        const backoffDelay = consecutiveErrorsRef.current > 0
            ? Math.min(delay * Math.pow(2, consecutiveErrorsRef.current), 10000)
            : delay;

        console.log(`Smart restart in ${backoffDelay}ms (consecutive errors: ${consecutiveErrorsRef.current})`);

        restartTimeoutRef.current = setTimeout(async () => {
            if (!state.isRunning || isDestroyedRef.current) return;

            try {
                console.log('Smart restarting voice recognition...');
                const isRecognizing = await Voice.isRecognizing();

                if (isRecognizing) {
                    await Voice.stop();
                    await new Promise(resolve => setTimeout(resolve, 300));
                }

                await Voice.start(state.currentLocale, VOICE_OPTIONS);
                consecutiveErrorsRef.current = 0; // Reset on successful start
            } catch (error: any) {
                console.error('Error in smart restart:', error);
                consecutiveErrorsRef.current++;

                if (error?.code === '12') {
                    try {
                        const newLocale = await findWorkingLocale();
                        setState(prev => ({ ...prev, currentLocale: newLocale }));
                        setTimeout(() => smartRestart(2000), 1000);
                    } catch (localeError) {
                        console.error('Failed to find working locale:', localeError);
                        setTimeout(() => smartRestart(3000), 2000);
                    }
                } else {
                    setTimeout(() => smartRestart(Math.min(backoffDelay * 2, 10000)), 2000);
                }
            }
        }, backoffDelay);
    }, [state.isRunning, state.currentLocale, findWorkingLocale]);

    // Voice event handlers
    const onSpeechStart = useCallback((e: SpeechStartEvent) => {
        console.log('Speech started:', e);
        setState(prev => ({
            ...prev,
            isListening: true,
            error: null,
            partialResults: []
        }));
        errorCountRef.current = 0;
        consecutiveErrorsRef.current = 0;

        // Clear any existing silence timeout
        if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
        }
    }, []);

    const onSpeechEnd = useCallback((e: SpeechEndEvent) => {
        console.log('Speech ended:', e);
        setState(prev => ({ ...prev, isListening: false }));

        // Only restart if we're still supposed to be running
        if (state.isRunning && isActivelyListeningRef.current) {
            smartRestart(800); // Shorter delay for normal end
        }
    }, [state.isRunning, smartRestart]);

    const onSpeechResults = useCallback((e: SpeechResultsEvent) => {
        console.log('Speech results:', e.value);
        if (e.value && e.value.length > 0) {
            handleCommand(e.value[0]);
        }

        // Continue listening after processing results
        if (state.isRunning && isActivelyListeningRef.current) {
            smartRestart(500); // Quick restart after results
        }
    }, [handleCommand, state.isRunning, smartRestart]);

    // Handle partial results for better UX
    const onSpeechPartialResults = useCallback((e: any) => {
        console.log('Partial results:', e.value);
        if (e.value && e.value.length > 0) {
            setState(prev => ({ ...prev, partialResults: e.value }));

            // Check if partial result contains a command
            const partialText = e.value[0].toLowerCase();
            const hasCommand = Object.keys(commandConfigs).some(key =>
                partialText.includes(key.toLowerCase())
            );

            if (hasCommand) {
                console.log('Potential command detected in partial results');
            }
        }
    }, [commandConfigs]);

    // Handle volume changes for better UX feedback
    const onSpeechVolumeChanged = useCallback((e: SpeechVolumeChangeEvent) => {
        // Use volume to detect if user is actively speaking
        // Values typically range from -2 to 10
        const volume = e.value || 0;
        const isSpeaking = volume > -1;

        if (isSpeaking && silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
        }
    }, []);

    const onSpeechError = useCallback(async (e: SpeechErrorEvent) => {
        console.error('Speech error:', e);
        setState(prev => ({ ...prev, isListening: false }));
        errorCountRef.current++;
        consecutiveErrorsRef.current++;

        // Handle specific error codes
        if (e.error?.code === '5') {
            setState(prev => ({
                ...prev,
                status: 'error',
                error: 'Microphone permission required'
            }));
            Alert.alert(
                'Voice Recognition Error',
                'Please check microphone permissions and try again.',
                [{ text: 'OK' }]
            );
            return;
        } else if (e.error?.code === '9') {
            setState(prev => ({
                ...prev,
                status: 'error',
                error: 'Insufficient permissions - Please enable microphone permission for Google App'
            }));
            Alert.alert(
                'Permission Error',
                'Please go to Google App settings and enable microphone permission, then restart the voice service.',
                [{ text: 'OK' }]
            );
            return;
        } else if (e.error?.code === '12') {
            console.log('Language not supported error, trying different locale...');

            if (consecutiveErrorsRef.current < 3) {
                try {
                    const newLocale = await findWorkingLocale();
                    setState(prev => ({ ...prev, currentLocale: newLocale }));
                    console.log(`Switching to locale: ${newLocale}`);
                    smartRestart(2000);
                    return;
                } catch (localeError) {
                    console.error('Failed to find working locale:', localeError);
                }
            } else {
                setState(prev => ({
                    ...prev,
                    status: 'error',
                    error: 'No supported language found for this device'
                }));
                return;
            }
        } else if (e.error?.code === '13' || e.error?.code === '7') {
            // Didn't understand or no match - this is normal for continuous listening
            console.log('Speech not understood, continuing to listen...');
            if (state.isRunning && isActivelyListeningRef.current) {
                smartRestart(1000);
            }
            return;
        } else if (e.error?.code === '8') {
            // Recognizer busy - wait a bit longer
            console.log('Recognizer busy, waiting before restart...');
            if (state.isRunning && isActivelyListeningRef.current) {
                smartRestart(2000);
            }
            return;
        }

        // For other errors, use smart restart with backoff
        if (state.isRunning && isActivelyListeningRef.current && consecutiveErrorsRef.current < 5) {
            smartRestart(1500);
        } else if (consecutiveErrorsRef.current >= 5) {
            console.error('Too many consecutive errors, stopping service');
            setState(prev => ({
                ...prev,
                status: 'error',
                error: 'Voice service encountered too many errors'
            }));
        }
    }, [state.isRunning, smartRestart, findWorkingLocale]);

    // Initialize voice recognition
    useEffect(() => {
        let mounted = true;

        const initializeVoice = async () => {
            try {
                isDestroyedRef.current = false;
                errorCountRef.current = 0;
                consecutiveErrorsRef.current = 0;

                const isAvailable = await checkVoiceAvailability();
                if (!isAvailable || !mounted) return;

                await Voice.destroy();
                await new Promise(resolve => setTimeout(resolve, 500));

                const workingLocale = await findWorkingLocale();
                console.log('Using locale:', workingLocale);

                // Set up event listeners
                Voice.onSpeechStart = onSpeechStart;
                Voice.onSpeechEnd = onSpeechEnd;
                Voice.onSpeechResults = onSpeechResults;
                Voice.onSpeechPartialResults = onSpeechPartialResults;
                Voice.onSpeechVolumeChanged = onSpeechVolumeChanged;
                Voice.onSpeechError = onSpeechError;

                if (mounted) {
                    setState(prev => ({
                        ...prev,
                        isInitialized: true,
                        status: 'stopped',
                        error: null,
                        currentLocale: workingLocale,
                    }));
                    console.log('Voice service initialized successfully with locale:', workingLocale);
                }
            } catch (error) {
                console.error('Voice initialization error:', error);
                if (mounted) {
                    setState(prev => ({
                        ...prev,
                        status: 'error',
                        error: 'Failed to initialize voice service'
                    }));
                }
            }
        };

        initializeVoice();

        return () => {
            mounted = false;
            isDestroyedRef.current = true;
            if (restartTimeoutRef.current) {
                clearTimeout(restartTimeoutRef.current);
            }
            if (silenceTimeoutRef.current) {
                clearTimeout(silenceTimeoutRef.current);
            }
        };
    }, [checkVoiceAvailability, onSpeechStart, onSpeechEnd, onSpeechResults, onSpeechPartialResults, onSpeechVolumeChanged, onSpeechError, findWorkingLocale]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isDestroyedRef.current = true;
            isActivelyListeningRef.current = false;
            if (restartTimeoutRef.current) {
                clearTimeout(restartTimeoutRef.current);
            }
            if (silenceTimeoutRef.current) {
                clearTimeout(silenceTimeoutRef.current);
            }
            Voice.destroy().catch(console.error);
            if (keepAwakeRef.current) {
                deactivateKeepAwake().catch(console.error);
            }
        };
    }, []);

    // Safe keep awake functions
    const safeActivateKeepAwake = useCallback(async () => {
        if (!keepAwakeRef.current) {
            try {
                await activateKeepAwake();
                keepAwakeRef.current = true;
            } catch (error) {
                console.error('Error activating keep awake:', error);
            }
        }
    }, []);

    const safeDeactivateKeepAwake = useCallback(async () => {
        if (keepAwakeRef.current) {
            try {
                await deactivateKeepAwake();
                keepAwakeRef.current = false;
            } catch (error) {
                console.error('Error deactivating keep awake:', error);
            }
        }
    }, []);

    // Start voice service
    const startService = useCallback(async () => {
        try {
            console.log('Starting voice service...');

            if (state.isRunning) {
                console.log('Service already running');
                return;
            }

            if (!state.isInitialized) {
                throw new Error('Voice service not initialized');
            }

            errorCountRef.current = 0;
            consecutiveErrorsRef.current = 0;
            isActivelyListeningRef.current = true;

            await showForegroundNotification();
            await safeActivateKeepAwake();

            setState(prev => ({
                ...prev,
                currentCommand: 'none',
                error: null,
                partialResults: [],
            }));

            console.log('Starting voice with locale:', state.currentLocale);
            await Voice.start(state.currentLocale, VOICE_OPTIONS);

            setState(prev => ({
                ...prev,
                isRunning: true,
                status: 'running'
            }));

            console.log('Voice service started successfully');
        } catch (error: any) {
            console.error('Error starting voice service:', error);

            if (error?.code === '12') {
                try {
                    console.log('Locale error on start, finding working locale...');
                    const newLocale = await findWorkingLocale();
                    setState(prev => ({ ...prev, currentLocale: newLocale }));

                    await Voice.start(newLocale, VOICE_OPTIONS);
                    setState(prev => ({
                        ...prev,
                        isRunning: true,
                        status: 'running'
                    }));
                    console.log('Voice service started with fallback locale:', newLocale);
                    return;
                } catch (fallbackError) {
                    console.error('Fallback locale also failed:', fallbackError);
                }
            }

            isActivelyListeningRef.current = false;
            setState(prev => ({
                ...prev,
                status: 'error',
                error: 'Failed to start voice service'
            }));
            throw error;
        }
    }, [state.isRunning, state.isInitialized, state.currentLocale, safeActivateKeepAwake, findWorkingLocale]);

    // Stop voice service
    const stopService = useCallback(async () => {
        try {
            console.log('Stopping voice service...');

            isActivelyListeningRef.current = false;

            if (restartTimeoutRef.current) {
                clearTimeout(restartTimeoutRef.current);
                restartTimeoutRef.current = null;
            }

            if (silenceTimeoutRef.current) {
                clearTimeout(silenceTimeoutRef.current);
                silenceTimeoutRef.current = null;
            }

            errorCountRef.current = 0;
            consecutiveErrorsRef.current = 0;

            await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
            await safeDeactivateKeepAwake();

            await Voice.stop();
            await Voice.destroy();

            setState(prev => ({
                ...prev,
                isRunning: false,
                isListening: false,
                status: 'stopped',
                currentCommand: 'none',
                error: null,
                partialResults: [],
            }));

            console.log('Voice service stopped successfully');
        } catch (error) {
            console.error('Error stopping voice service:', error);
            setState(prev => ({
                ...prev,
                status: 'error',
                error: 'Failed to stop voice service'
            }));
        }
    }, [safeDeactivateKeepAwake]);

    // Toggle service
    const toggleService = useCallback(async () => {
        if (state.isRunning) {
            await stopService();
        } else {
            await startService();
        }
    }, [state.isRunning, startService, stopService]);

    return {
        state,
        startService,
        stopService,
        toggleService,
    };
};