import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';
import { cameraWithTensors } from '@tensorflow/tfjs-react-native';
import { detectGesture, Gesture } from './utils/detectGesture';
import { handleSwipeLeft, handleSwipeRight, handleTap, handleWave, registerBackgroundTask } from './features/actions';
import { ExpoWebGLRenderingContext } from 'expo-gl';
import { requestAccessibilityPermission } from './permissions';

// Type definitions
interface TensorCamera extends React.ComponentProps<typeof Camera> {
  onReady: (
    images: IterableIterator<tf.Tensor3D>,
    updatePreview: () => void,
    gl: ExpoWebGLRenderingContext
  ) => void;
  resizeDepth: number;
  resizeHeight: number;
  resizeWidth: number;
  autorender?: boolean;
  useCustomShadersToResize?: boolean;
}

type ServiceStatus = 'initializing' | 'stopped' | 'running' | 'error';

interface ServiceState {
  isRunning: boolean;
  isInitialized: boolean;
  status: ServiceStatus;
  error?: string;
}

// Constants
const TensorCamera = cameraWithTensors(Camera);
const OUTPUT_TENSOR_WIDTH = 120;
const OUTPUT_TENSOR_HEIGHT = 160;
const PROCESS_INTERVAL = 100; // ms
const CONFIDENCE_THRESHOLD = 0.8;

const GestureService: React.FC = () => {

  useEffect(() => {
    requestAccessibilityPermission()
    registerBackgroundTask();
  }, []);
  
  // State with TypeScript
  const [state, setState] = useState<ServiceState>({
    isRunning: false,
    isInitialized: false,
    status: 'initializing'
  });
  const [model, setModel] = useState<handpose.HandPose | null>(null);

  // Initialize TensorFlow and request permissions
  useEffect(() => {
    async function initialize(): Promise<void> {
      try {
        const { status } = await Camera.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Camera permission not granted');
        }

        await tf.ready();
        const handModel = await handpose.load();
        setModel(handModel);
        setState(prev => ({
          ...prev,
          isInitialized: true,
          status: 'stopped'
        }));
      } catch (error) {
        console.error('Initialization failed:', error);
        setState(prev => ({
          ...prev,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        }));
      }
    }
    initialize();
  }, []);

  // Handle camera stream with reduced processing
  const handleCameraStream = async (
    images: IterableIterator<tf.Tensor3D>,
    updatePreview: () => void,
    gl: ExpoWebGLRenderingContext
  ): Promise<void> => {
    let lastProcessingTime = Date.now();

    const processFrame = async (): Promise<void> => {
      if (!state.isRunning) return;

      const now = Date.now();
      if (now - lastProcessingTime < PROCESS_INTERVAL) {
        requestAnimationFrame(processFrame);
        return;
      }

      const imageTensor = images.next().value;
      if (!imageTensor || !model) {
        requestAnimationFrame(processFrame);
        return;
      }

      try {
        const predictions = await model.estimateHands(imageTensor);

        if (predictions.length > 0) {
          const result = detectGesture(predictions[0].landmarks);

          if (result.confidence > CONFIDENCE_THRESHOLD) {
            handleGesture(result.gesture);
          }
        }

        tf.dispose(imageTensor);
        lastProcessingTime = now;

      } catch (error) {
        console.error('Processing error:', error);
      }

      requestAnimationFrame(processFrame);
    };

    processFrame();
  };

  const handleGesture = (gesture: Gesture): void => {
    switch (gesture) {
      case 'swipe_left':
        handleSwipeLeft();
        break;
      case 'swipe_right':
        handleSwipeRight();
        break;
      case 'tap':
        handleTap();
        break;
      case 'wave':
        handleWave();
        break;
    }
  };

  const toggleService = (): void => {
    setState(prev => ({
      ...prev,
      isRunning: !prev.isRunning,
      status: !prev.isRunning ? 'running' : 'stopped'
    }));
  };

  const getStatusMessage = (): string => {
    switch (state.status) {
      case 'initializing':
        return 'Initializing gesture service...';
      case 'running':
        return 'Running in background';
      case 'stopped':
        return 'Service stopped';
      case 'error':
        return `Error: ${state.error || 'Unknown error'}`;
      default:
        return 'Unknown status';
    }
  };

  if (!state.isInitialized) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>{getStatusMessage()}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          state.isRunning ? styles.buttonStop : styles.buttonStart
        ]}
        onPress={toggleService}
      >
        <Text style={styles.buttonText}>
          {state.isRunning ? 'Stop Gesture Service' : 'Start Gesture Service'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.status}>Status: {getStatusMessage()}</Text>

      {state.isRunning && (
        <TensorCamera
          style={styles.hidden}
          type={CameraType.front}
          resizeWidth={OUTPUT_TENSOR_WIDTH}
          resizeHeight={OUTPUT_TENSOR_HEIGHT}
          resizeDepth={3}
          autorender={true}
          onReady={handleCameraStream}
          useCustomShadersToResize={false} cameraTextureWidth={0} cameraTextureHeight={0} />
      )}
    </View>
  );
};

// Styles with TypeScript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  button: {
    padding: 20,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
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
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  text: {
    fontSize: 16,
    color: '#666',
  },
  hidden: {
    width: 1,
    height: 1,
    opacity: 0,
  },
});

export default GestureService;