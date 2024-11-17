import { NativeModules, Platform } from "react-native";

export const requestAccessibilityPermission = async () => {
    if (Platform.OS === 'android') {
        try {
            if (NativeModules.GestureModule) {
                await NativeModules.GestureModule.requestAccessibilityPermission();
                return true;
            } else {
                console.warn('GestureModule not found');
                return false;
            }
        } catch (error) {
            console.error('Error requesting accessibility permission:', error);
            return false;
        }
    }
    return true; // Return true for other platforms
};