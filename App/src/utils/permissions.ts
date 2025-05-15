import { PermissionsAndroid, Platform } from 'react-native';
import * as Battery from 'expo-battery';
import { Camera } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Device from 'expo-device';

export interface PermissionStatus {
  camera: boolean;
  backgroundProcessing: boolean;
  batteryOptimization: boolean;
  systemAlert: boolean;
  notifications: boolean;
}

export const requestPermissions = async (): Promise<PermissionStatus> => {
  if (Platform.OS !== 'android') {
    throw new Error('This permission handler is for Android only');
  }

  try {
    // 1. Request camera permission
    const cameraPermission = await Camera.requestCameraPermissionsAsync();

    // 2. Request notification permissions for foreground service
    const notificationPermission = await Notifications.requestPermissionsAsync();

    // 3. Request system alert window permission
    const systemAlertPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.SYSTEM_ALERT_WINDOW,
      {
        title: 'Display Over Other Apps Permission',
        message: 'This permission is required for gesture detection to work properly',
        buttonPositive: 'Grant Permission'
      }
    );

    // 4. Request background processing permissions
    const backgroundPermissions = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.FOREGROUND_SERVICE,
      PermissionsAndroid.PERMISSIONS.WAKE_LOCK,
    ]);

    // 5. Handle battery optimization
    await disableBatteryOptimization();

    // 6. Open auto-start settings if available
    await openAutoStartSettings();

    return {
      camera: cameraPermission.status === 'granted',
      backgroundProcessing: Object.values(backgroundPermissions).every(
        permission => permission === 'granted'
      ),
      batteryOptimization: true, // We can't programmatically check this
      systemAlert: systemAlertPermission === 'granted',
      notifications: notificationPermission.status === 'granted',
    };
  } catch (error) {
    console.error('Error requesting permissions:', error);
    throw error;
  }
};

const disableBatteryOptimization = async () => {
  try {
    const packageName = "com.ateebnoone.gesturesmart"; // Replace with your actual package name
    
    await IntentLauncher.startActivityAsync(
      'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      {
        data: `package:${packageName}`,
        flags: 268435456, // FLAG_ACTIVITY_NEW_TASK
      }
    );
  } catch (error) {
    console.warn('Could not open battery optimization settings:', error);
  }
};

const openAutoStartSettings = async () => {
  try {
    // Common paths for different manufacturers
    const paths = {
      xiaomi: {
        action: 'android.settings.APPLICATION_DETAILS_SETTINGS',
        category: 'android.intent.category.DEFAULT',
      },
      huawei: {
        action: 'android.settings.APPLICATION_DETAILS_SETTINGS',
        category: 'android.intent.category.DEFAULT',
      },
      oppo: {
        action: 'android.settings.APPLICATION_DETAILS_SETTINGS',
        category: 'android.intent.category.DEFAULT',
      },
      vivo: {
        action: 'android.settings.APPLICATION_DETAILS_SETTINGS',
        category: 'android.intent.category.DEFAULT',
      },
      samsung: {
        action: 'android.settings.APPLICATION_DETAILS_SETTINGS',
        category: 'android.intent.category.DEFAULT',
      },
    };

    // Get device manufacturer
    const manufacturer = Device.manufacturer?.toLowerCase() as keyof typeof paths || 'samsung';
    const settings = paths[manufacturer]; // Default to Samsung if unknown

    await IntentLauncher.startActivityAsync(settings.action, {
      flags: 268435456, // FLAG_ACTIVITY_NEW_TASK
      category: settings.category,
      data: `package:com.ateebnoone.gesturesmart`,
    });
  } catch (error) {
    console.warn('Could not open auto-start settings:', error);
  }
};

export const checkPermissions = async (): Promise<boolean> => {
  try {
    const status = await requestPermissions();
    return Object.values(status).every(Boolean);
  } catch (error) {
    console.error('Permission check failed:', error);
    return false;
  }
};