import { NativeModules, Platform } from "react-native";

export const requestAccessibilityPermission = async () => {
    if (Platform.OS === 'android') {
        try {
            await NativeModules.GestureModule.requestAccessibilityPermission();
        } catch (error) {
            console.error('Error requesting accessibility permission:', error);
        }
    }
};