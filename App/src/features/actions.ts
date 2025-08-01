import { Alert,NativeModules, Platform } from 'react-native';

// Define types for the native module
interface GestureActionsType {
  swipeLeft(): Promise<boolean>;
  swipeRight(): Promise<boolean>;
  tap(x: number, y: number): Promise<boolean>;
  scrollUp(): Promise<boolean>;
  scrollDown(): Promise<boolean>;
  goBack(): Promise<boolean>;
  goHome(): Promise<boolean>;
  showRecentApps(): Promise<boolean>;
  cursor(): Promise<boolean>;
  requestAccessibilityPermission(): Promise<boolean>;
  openApp(appName: string): Promise<string>;
  continuousScrollDown(): Promise<boolean>;
  continuousScrollUp(): Promise<boolean>;
  stopScrolling(): Promise<boolean>;
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

export const handleContinuousScrollUp = async (): Promise<void> => {
  if (Platform.OS === 'android' && hasGestureActions(NativeModules)) {
    try {
      await GestureActions.continuousScrollUp();
    } catch (error) {
      console.error('Error performing scroll up:', error);
      // If permission is needed, request it
      await requestAccessibilityPermission();
    }
  }
};

export const handleStopScrolling = async (): Promise<void> => {
  if (Platform.OS === 'android' && hasGestureActions(NativeModules)) {
    try {
      await GestureActions.stopScrolling();
    } catch (error) {
      console.error('Error performing scroll up:', error);
      // If permission is needed, request it
      await requestAccessibilityPermission();
    }
  }
};

export const handleContinuousScrollDown = async (): Promise<void> => {
  if (Platform.OS === 'android' && hasGestureActions(NativeModules)) {
    try {
      await GestureActions.continuousScrollDown();
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

export const handleReturn = async (): Promise<void> => {
  if (Platform.OS === 'android' && hasGestureActions(NativeModules)) {
    try {
      await GestureActions.goBack();
    } catch (error) {
      console.error('Error performing scroll down:', error);
      // If permission is needed, request it
      await requestAccessibilityPermission();
    }
  }
};

export const handlegoHome = async (): Promise<void> => {
  if (Platform.OS === 'android' && hasGestureActions(NativeModules)) {
    try {
      await GestureActions.goHome();
    } catch (error) {
      console.error('Error performing scroll down:', error);
      // If permission is needed, request it
      await requestAccessibilityPermission();
    }
  }
};

export const handleShowRecentApps = async (): Promise<void> => {
  if (Platform.OS === 'android' && hasGestureActions(NativeModules)) {
    try {
      await GestureActions.showRecentApps();
    } catch (error) {
      console.error('Error performing scroll down:', error);
      // If permission is needed, request it
      await requestAccessibilityPermission();
    }
  }
};

export const handleOpenApp = async (appName: string): Promise<void> => {
  console.log("Open app called!!")
  if (Platform.OS === 'android' && hasGestureActions(NativeModules)) {
    try {
      const result = await GestureActions.openApp(appName);
      console.log('App open result:', result);
    } catch (error: any) {
      console.error('Error opening app:', error?.message || error);
      if (error?.code === 'APP_NOT_FOUND') {
        Alert.alert('App Not Found', `Can't find app "${appName}"`);
      } else {
        await requestAccessibilityPermission(); // If needed
      }
    }
  } else {
    console.warn('GestureActions module not available or unsupported platform.');
  }
};

export const handleCursor = async (): Promise<void> => {
  if (Platform.OS === 'android' && hasGestureActions(NativeModules)) {
    try {
      await GestureActions.cursor();
    } catch (error) {
      console.error('Error performing scroll down:', error);
      // If permission is needed, request it
      await requestAccessibilityPermission();
    }
  }
};