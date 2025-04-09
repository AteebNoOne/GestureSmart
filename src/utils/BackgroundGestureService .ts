import { Camera, CameraType } from 'expo-camera';
import BackgroundService from 'react-native-background-actions';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import { cameraWithTensors } from '@tensorflow/tfjs-react-native';
import SystemSetting from 'react-native-system-setting';
import { AppState, AppStateStatus } from 'react-native';
import { detectGesture } from '../utils/detectGesture';

const TensorCamera = cameraWithTensors(Camera);
const OUTPUT_TENSOR_WIDTH = 120;
const OUTPUT_TENSOR_HEIGHT = 160;

const backgroundOptions = {
  taskName: 'GestureDetectionService',
  taskTitle: 'Gesture Detection',
  taskDesc: 'Processing gestures in background',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#ff00ff',
  linkingURI: "com.ateebnoone.gestureapp://Detection",
  parameters: {
    delay: 1000,
  },
};

export class BackgroundGestureService {
  private static detector: handPoseDetection.HandDetector | null = null;
  private static isProcessing = false;
  private static lastVolume = 0;
  private static lastAdjustmentTime = 0;
  private static appState: AppStateStatus = 'active';
  private static cameraPermission = false;

  static async initialize() {
    try {
      // Check and request camera permission
      const { status } = await Camera.requestCameraPermissionsAsync();
      this.cameraPermission = status === 'granted';
      
      if (!this.cameraPermission) {
        throw new Error('Camera permission not granted');
      }

      // Initialize TensorFlow
      await tf.ready();
      await tf.setBackend('rn-webgl');

      // Configure WebGL for better performance
      tf.env().set('WEBGL_PACK', false);
      tf.env().set('WEBGL_FORCE_F16_TEXTURES', false);
      tf.env().set('WEBGL_FLUSH_THRESHOLD', 1);
      
      // Initialize detector with optimized settings
      const model = handPoseDetection.SupportedModels.MediaPipeHands;
      const detectorConfig: handPoseDetection.MediaPipeHandsTfjsModelConfig = {
        runtime: 'tfjs',
        modelType: 'lite',
        maxHands: 1,
      };

      this.detector = await handPoseDetection.createDetector(model, detectorConfig);
      this.lastVolume = await SystemSetting.getVolume();

      // Set up app state listener
      AppState.addEventListener('change', this.handleAppStateChange);
    } catch (error) {
      console.error('Initialization failed:', error);
      throw error;
    }
  }

  private static handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (this.appState !== nextAppState) {
      this.appState = nextAppState;
      
      if (nextAppState === 'active') {
        // Resume full processing when app is active
        await this.resumeProcessing();
      } else if (nextAppState === 'background') {
        // Reduce processing in background
        await this.reduceProcessing();
      }
    }
  };

  private static async resumeProcessing() {
    if (!this.isProcessing) return;
    
    // Resume with full frame rate
    await this.updateNotification('Processing gestures');
    // Reset any background optimizations
    tf.engine().startScope();
  }

  private static async reduceProcessing() {
    if (!this.isProcessing) return;
    
    // Reduce processing frequency
    await this.updateNotification('Running in background mode');
    // Clean up tensor memory
    tf.engine().endScope();
  }

  private static async processFrame(imageTensor: tf.Tensor3D) {
    if (!this.detector || this.appState !== 'active') return;

    try {
      // Use tf.tidy to automatically clean up tensors
      const hands = await this.detector!.estimateHands(imageTensor);
      tf.tidy(() => {
            if (hands.length > 0) {
                const gestureResult = detectGesture(hands);
                this.handleGesture(gestureResult.gesture);
            }
      });
    } catch (error) {
      console.error('Frame processing error:', error);
    } finally {
      tf.dispose(imageTensor);
    }
  }

  private static async handleGesture(gesture: string) {
    const now = Date.now();
    if (now - this.lastAdjustmentTime < 500) return;
    
    switch (gesture) {
      case 'follow_cursor':
        await this.adjustVolume();
        break;
      case 'swipe_left':
        // Implement swipe left with rate limiting
        break;
      case 'swipe_right':
        // Implement swipe right with rate limiting
        break;
    }
    
    this.lastAdjustmentTime = now;
  }

  private static async adjustVolume() {
    try {
      const newVolume = Math.min(1, this.lastVolume + 0.05);
      if (newVolume !== this.lastVolume) {
        await SystemSetting.setVolume(newVolume, {
          type: 'music',
          playSound: false,
          showUI: true
        });
        this.lastVolume = newVolume;
      }
    } catch (error) {
      console.error('Error adjusting volume:', error);
    }
  }

  static async startService() {
    try {
      await this.initialize();
      this.isProcessing = true;
      
      // Start background service with minimal processing
      await BackgroundService.start(async (taskData?: { delay: number }) => {
        while (BackgroundService.isRunning()) {
          try {
            if (this.appState === 'active' && this.cameraPermission) {
              const camera = new TensorCamera({
                type: CameraType.front,
                resizeWidth: OUTPUT_TENSOR_WIDTH,
                resizeHeight: OUTPUT_TENSOR_HEIGHT,
                resizeDepth: 3,
                autorender: true,
                useCustomShadersToResize: false,
                cameraTextureWidth: 1,
                cameraTextureHeight: 1,
                onReady: (images: IterableIterator<tf.Tensor3D>) => {
                  const imageTensor = images.next().value;
                  if (imageTensor) {
                    this.processFrame(imageTensor);
                  }
                }
              });
            }
            
            await new Promise(r => setTimeout(r, 
              this.appState === 'active' ? 100 : taskData?.delay ?? 1000
            ));
          } catch (error) {
            console.error('Background task error:', error);
            await new Promise(r => setTimeout(r, taskData?.delay ?? 1000));
          }
        }
      }, backgroundOptions);
      
      console.log('Gesture detection service started');
    } catch (error) {
      console.error('Failed to start gesture service:', error);
      throw error;
    }
  }

  static async stopService() {
    try {
      this.isProcessing = false;
      AppState.removeEventListener('change', this.handleAppStateChange);
      await BackgroundService.stop();
      console.log('Gesture detection service stopped');
    } catch (error) {
      console.error('Failed to stop gesture service:', error);
      throw error;
    }
  }

  static async updateNotification(message: string) {
    try {
      await BackgroundService.updateNotification({
        taskDesc: message
      });
    } catch (error) {
      console.error('Failed to update notification:', error);
    }
  }
}