import { NativeModules, Platform, BackHandler, Dimensions } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

// Define the background task name
const GESTURE_BACKGROUND_TASK = 'GESTURE_BACKGROUND_TASK';

// Register background task
TaskManager.defineTask(GESTURE_BACKGROUND_TASK, async () => {
  try {
    // Keep the gesture service running in the background
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Register the background task
export const registerBackgroundTask = async () => {
  try {
    await BackgroundFetch.registerTaskAsync(GESTURE_BACKGROUND_TASK, {
      minimumInterval: 1, // 1 second
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (err) {
    console.log("Background Task Register failed:", err);
  }
};

// Handle swipe left gesture (Android-specific logic)
export const handleSwipeLeft = async () => {
  try {
    if (Platform.OS === 'android') {
      // Simulate back gesture on Android using BackHandler
      BackHandler.exitApp(); // This exits the app, similar to a back gesture
    } else {
      // For iOS, handle custom navigation logic here
      console.log("Swipe Left on iOS");
    }
  } catch (error) {
    console.error('Error handling swipe left:', error);
  }
};

// Handle swipe right gesture (Android-specific logic)
export const handleSwipeRight = async () => {
  try {
    if (Platform.OS === 'android') {
      // Simulate forward navigation or other gestures (adjust as needed)
      console.log("Swipe Right on Android");
    } else {
      console.log("Swipe Right on iOS");
    }
  } catch (error) {
    console.error('Error handling swipe right:', error);
  }
};

// Handle tap gesture (Android-specific logic using NativeModules)
export const handleTap = async () => {
  try {
    if (Platform.OS === 'android') {
      // Simulate a tap at the center of the screen using custom native module
      const { width, height } = Dimensions.get('window');
      if (NativeModules.GestureModule) {
        await NativeModules.GestureModule.tap(width / 2, height / 2);
      } else {
        console.log("GestureModule not available");
      }
    } else {
      console.log("Tap on iOS");
    }
  } catch (error) {
    console.error('Error handling tap:', error);
  }
};

// Handle wave gesture (Android-specific logic)
export const handleWave = async () => {
  try {
    if (Platform.OS === 'android') {
      // Open recent apps or perform other actions using a custom native module
      if (NativeModules.GestureModule) {
        await NativeModules.GestureModule.openRecentApps();
      } else {
        console.log("GestureModule not available");
      }
    } else {
      console.log("Wave on iOS");
    }
  } catch (error) {
    console.error('Error handling wave:', error);
  }
};
