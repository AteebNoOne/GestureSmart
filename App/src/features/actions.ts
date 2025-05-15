import { NativeModules, Platform } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

const GESTURE_BACKGROUND_TASK = 'GESTURE_BACKGROUND_TASK';

// Define types for the native module
interface GestureModule {
  swipeLeft(): Promise<boolean>;
  swipeRight(): Promise<boolean>;
  tap(x: number, y: number): Promise<boolean>;
  requestAccessibilityPermission(): Promise<boolean>;
}

// Type guard for the GestureModule
const hasGestureModule = (
  nativeModules: typeof NativeModules
): nativeModules is typeof NativeModules & { GestureModule: GestureModule } => {
  return 'GestureModule' in nativeModules;
};

TaskManager.defineTask(GESTURE_BACKGROUND_TASK, async () => {
  try {
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const registerBackgroundTask = async (): Promise<void> => {
  try {
    await BackgroundFetch.registerTaskAsync(GESTURE_BACKGROUND_TASK, {
      minimumInterval: 1,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (err) {
    console.log("Background Task Register failed:", err);
  }
};

export const handleSwipeLeft = async (): Promise<void> => {
  if (Platform.OS === 'android' && hasGestureModule(NativeModules)) {
    try {
      await NativeModules.GestureModule.swipeLeft();
    } catch (error) {
      console.error('Error performing swipe left:', error);
    }
  }
};

export const handleSwipeRight = async (): Promise<void> => {
  if (Platform.OS === 'android' && hasGestureModule(NativeModules)) {
    try {
      await NativeModules.GestureModule.swipeRight();
    } catch (error) {
      console.error('Error performing swipe right:', error);
    }
  }
};

export const handleTap = async (x: number, y: number): Promise<void> => {
  if (Platform.OS === 'android' && hasGestureModule(NativeModules)) {
    try {
      await NativeModules.GestureModule.tap(x, y);
    } catch (error) {
      console.error('Error performing tap:', error);
    }
  }
};

export const handleWave = async (): Promise<void> => {
  if (Platform.OS === 'android' && hasGestureModule(NativeModules)) {
    try {
      // You can implement custom wave gesture behavior here
      console.log('Wave gesture detected');
    } catch (error) {
      console.error('Error handling wave gesture:', error);
    }
  }
};