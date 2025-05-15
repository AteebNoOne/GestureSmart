// BackgroundCameraService.ts
import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import { Camera } from 'expo-camera';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import * as ForegroundService from 'expo-keep-awake';

const BACKGROUND_CAMERA_TASK = 'BACKGROUND_CAMERA_TASK';
const NOTIFICATION_ID = 'background-camera-service';

class BackgroundCameraService {
  private static instance: BackgroundCameraService;
  private isRunning: boolean = false;
  private foregroundServiceStarted: boolean = false;

  private constructor() {
    this.setupService();
  }

  public static getInstance(): BackgroundCameraService {
    if (!BackgroundCameraService.instance) {
      BackgroundCameraService.instance = new BackgroundCameraService();
    }
    return BackgroundCameraService.instance;
  }

  private async setupService() {
    await this.setupNotifications();
    await this.registerBackgroundTask();
  }

  private async setupNotifications() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('background-camera', {
        name: 'Background Camera',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 0, 0],
        lightColor: '#FF231F7C',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
  }

  private async startForegroundService() {
    if (Platform.OS === 'android' && !this.foregroundServiceStarted) {
      await ForegroundService.activateKeepAwake(BACKGROUND_CAMERA_TASK);
      this.foregroundServiceStarted = true;
    }
  }

  private async stopForegroundService() {
    if (Platform.OS === 'android' && this.foregroundServiceStarted) {
      await ForegroundService.deactivateKeepAwake(BACKGROUND_CAMERA_TASK);
      this.foregroundServiceStarted = false;
    }
  }

  private async registerBackgroundTask() {
    TaskManager.defineTask(BACKGROUND_CAMERA_TASK, async () => {
      try {
        if (this.isRunning) {
          await this.startForegroundService();
          return BackgroundFetch.BackgroundFetchResult.NewData;
        }
        return BackgroundFetch.BackgroundFetchResult.NoData;
      } catch (error) {
        console.error('Background task error:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });

    try {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_CAMERA_TASK, {
        minimumInterval: 1,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    } catch (error) {
      console.error('Task registration failed:', error);
    }
  }

  public async startService() {
    try {
      if (!this.isRunning) {
        this.isRunning = true;
        await this.startForegroundService();
        await activateKeepAwake();
        
        // Request necessary permissions
        await Camera.requestCameraPermissionsAsync();
        if (Platform.OS === 'android') {
          await Notifications.requestPermissionsAsync();
        }
      }
    } catch (error) {
      console.error('Failed to start service:', error);
      this.isRunning = false;
      throw error;
    }
  }

  public async stopService() {
    try {
      if (this.isRunning) {
        this.isRunning = false;
        await this.stopForegroundService();
        await deactivateKeepAwake();
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_CAMERA_TASK);
      }
    } catch (error) {
      console.error('Failed to stop service:', error);
      throw error;
    }
  }

  public isServiceRunning(): boolean {
    return this.isRunning;
  }
}

export default BackgroundCameraService;