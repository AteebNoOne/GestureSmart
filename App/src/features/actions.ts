import { NativeModules, Platform } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

const GESTURE_BACKGROUND_TASK = 'GESTURE_BACKGROUND_TASK';

// Define types for the native module
interface GestureActionsType {
  swipeLeft(): Promise<boolean>;
  swipeRight(): Promise<boolean>;
  tap(x: number, y: number): Promise<boolean>;
  scrollUp(): Promise<boolean>;
  scrollDown(): Promise<boolean>;
  requestAccessibilityPermission(): Promise<boolean>;
}

const GestureActions = NativeModules.GestureActions as GestureActionsType;

const hasGestureActions = (modules: any): boolean => {
  return modules && modules.GestureActions;
};

export const requestAccessibilityPermission = async (): Promise<void> => {
  if (Platform.OS === 'android' && hasGestureActions(NativeModules)) {
    try {
      await GestureActions.requestAccessibilityPermission();
    } catch (error) {
      console.error('Error requesting accessibility permission:', error);
    }
  }
};

export const handleSwipeLeft = async (): Promise<void> => {
  if (Platform.OS === 'android' && hasGestureActions(NativeModules)) {
    try {
      await GestureActions.swipeLeft();
    } catch (error) {
      console.error('Error performing swipe left:', error);
      // If permission is needed, request it
      await requestAccessibilityPermission();
    }
  }
};

export const handleSwipeRight = async (): Promise<void> => {
  if (Platform.OS === 'android' && hasGestureActions(NativeModules)) {
    try {
      await GestureActions.swipeRight();
    } catch (error) {
      console.error('Error performing swipe right:', error);
      // If permission is needed, request it
      await requestAccessibilityPermission();
    }
  }
};

export const handleTap = async (x: number, y: number): Promise<void> => {
  if (Platform.OS === 'android' && hasGestureActions(NativeModules)) {
    try {
      await GestureActions.tap(x, y);
    } catch (error) {
      console.error('Error performing tap:', error);
      // If permission is needed, request it
      await requestAccessibilityPermission();
    }
  }
};

export const handleScrollUp = async (): Promise<void> => {
  if (Platform.OS === 'android' && hasGestureActions(NativeModules)) {
    try {
      await GestureActions.scrollUp();
    } catch (error) {
      console.error('Error performing scroll up:', error);
      // If permission is needed, request it
      await requestAccessibilityPermission();
    }
  }
};

export const handleScrollDown = async (): Promise<void> => {
  if (Platform.OS === 'android' && hasGestureActions(NativeModules)) {
    try {
      await GestureActions.scrollDown();
    } catch (error) {
      console.error('Error performing scroll down:', error);
      // If permission is needed, request it
      await requestAccessibilityPermission();
    }
  }
};

