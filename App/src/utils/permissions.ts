// permissions.ts
import { PermissionsAndroid, Platform, Rationale, Alert, Linking } from 'react-native';

// Type for permission request result
type PermissionStatus = 'granted' | 'denied' | 'never_ask_again';

// Interface for multiple permissions result
interface MultiplePermissionsResult {
  [key: string]: PermissionStatus;
}

// Notification permission function (Android 13+)
export const askNotificationPermission = async (
  rationale?: Rationale
): Promise<PermissionStatus> => {
  if (Platform.OS !== 'android') {
    console.warn('Notification permissions are only required on Android 13+');
    return 'granted'; // iOS handles notifications differently
  }

  // Check Android version - notification permission only needed for Android 13+
  if (Platform.Version < 33) {
    return 'granted'; // Not required for older versions
  }

  try {
    const hasPermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );

    if (hasPermission) return 'granted';

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      rationale || {
        title: 'Notification Permission',
        message: 'This app needs permission to send you notifications',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );

    switch (result) {
      case PermissionsAndroid.RESULTS.GRANTED:
        return 'granted';
      case PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN:
        return 'never_ask_again';
      default:
        return 'denied';
    }
  } catch (error) {
    console.error('Notification permission error:', error);
    return 'denied';
  }
};

// Camera permission function
export const askCameraPermission = async (
  rationale?: Rationale
): Promise<PermissionStatus> => {
  if (Platform.OS !== 'android') {
    console.warn('Camera permissions are only required on Android');
    return 'denied';
  }

  try {
    const hasPermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.CAMERA
    );

    if (hasPermission) return 'granted';

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      rationale || {
        title: 'Camera Permission',
        message: 'This app needs access to your camera to take photos',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );

    switch (result) {
      case PermissionsAndroid.RESULTS.GRANTED:
        return 'granted';
      case PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN:
        return 'never_ask_again';
      default:
        return 'denied';
    }
  } catch (error) {
    console.error('Camera permission error:', error);
    return 'denied';
  }
};

// Photo/Media permissions (for accessing gallery)
export const askPhotoPermission = async (
  rationale?: Rationale
): Promise<PermissionStatus> => {
  if (Platform.OS !== 'android') {
    console.warn('Photo permissions are only required on Android');
    return 'denied';
  }

  try {
    // For Android 13+ use READ_MEDIA_IMAGES, for older versions use READ_EXTERNAL_STORAGE
    const permission = Platform.Version >= 33 
      ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
      : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

    const hasPermission = await PermissionsAndroid.check(permission);

    if (hasPermission) return 'granted';

    const result = await PermissionsAndroid.request(
      permission,
      rationale || {
        title: 'Photo Access Permission',
        message: 'This app needs access to your photos to upload profile pictures',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );

    switch (result) {
      case PermissionsAndroid.RESULTS.GRANTED:
        return 'granted';
      case PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN:
        return 'never_ask_again';
      default:
        return 'denied';
    }
  } catch (error) {
    console.error('Photo permission error:', error);
    return 'denied';
  }
};

// Video permissions (for accessing gallery videos)
export const askVideoPermission = async (
  rationale?: Rationale
): Promise<PermissionStatus> => {
  if (Platform.OS !== 'android') {
    console.warn('Video permissions are only required on Android');
    return 'denied';
  }

  try {
    // For Android 13+ use READ_MEDIA_VIDEO, for older versions use READ_EXTERNAL_STORAGE
    const permission = Platform.Version >= 33 
      ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO
      : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

    const hasPermission = await PermissionsAndroid.check(permission);

    if (hasPermission) return 'granted';

    const result = await PermissionsAndroid.request(
      permission,
      rationale || {
        title: 'Video Access Permission',
        message: 'This app needs access to your videos to upload profile videos',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );

    switch (result) {
      case PermissionsAndroid.RESULTS.GRANTED:
        return 'granted';
      case PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN:
        return 'never_ask_again';
      default:
        return 'denied';
    }
  } catch (error) {
    console.error('Video permission error:', error);
    return 'denied';
  }
};

// Request multiple media permissions at once
export const askMediaPermissions = async (): Promise<MultiplePermissionsResult> => {
  if (Platform.OS !== 'android') {
    return {};
  }

  try {
    const permissions = Platform.Version >= 33 
      ? [
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
          PermissionsAndroid.PERMISSIONS.CAMERA,
        ]
      : [
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.CAMERA,
        ];

    const rationales = Platform.Version >= 33 
      ? {
          [PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES]: {
            title: 'Photo Access',
            message: 'Access photos for profile pictures',
            buttonPositive: 'Allow',
          },
          [PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO]: {
            title: 'Video Access',
            message: 'Access videos for profile videos',
            buttonPositive: 'Allow',
          },
          [PermissionsAndroid.PERMISSIONS.CAMERA]: {
            title: 'Camera Access',
            message: 'Take photos and videos',
            buttonPositive: 'Allow',
          },
        }
      : {
          [PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE]: {
            title: 'Storage Access',
            message: 'Access photos and videos for profile uploads',
            buttonPositive: 'Allow',
          },
          [PermissionsAndroid.PERMISSIONS.CAMERA]: {
            title: 'Camera Access',
            message: 'Take photos and videos',
            buttonPositive: 'Allow',
          },
        };

    const results = await PermissionsAndroid.requestMultiple(permissions, rationales);
    
    // Convert results to our PermissionStatus type
    const convertedResults: MultiplePermissionsResult = {};
    Object.keys(results).forEach(permission => {
      const result = results[permission];
      switch (result) {
        case PermissionsAndroid.RESULTS.GRANTED:
          convertedResults[permission] = 'granted';
          break;
        case PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN:
          convertedResults[permission] = 'never_ask_again';
          break;
        default:
          convertedResults[permission] = 'denied';
      }
    });

    return convertedResults;
  } catch (error) {
    console.error('Media permissions error:', error);
    return {};
  }
};

// Microphone permission function (your existing function)
export const askMicrophonePermission = async (
  rationale?: Rationale
): Promise<PermissionStatus> => {
  if (Platform.OS !== 'android') {
    console.warn('Microphone permissions are only required on Android');
    return 'denied';
  }

  try {
    const hasPermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    );

    if (hasPermission) return 'granted';

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      rationale || {
        title: 'Microphone Permission',
        message: 'This app needs access to your microphone',
        buttonPositive: 'OK',
        buttonNegative: 'Cancel',
      }
    );

    switch (result) {
      case PermissionsAndroid.RESULTS.GRANTED:
        return 'granted';
      case PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN:
        return 'never_ask_again';
      default:
        return 'denied';
    }
  } catch (error) {
    console.error('Microphone permission error:', error);
    return 'denied';
  }
};

// Helper function to open app settings
export const openAppSettings = async (): Promise<void> => {
  try {
    if (Platform.OS === 'android') {
      await Linking.openSettings();
    }
  } catch (error) {
    console.error('Error opening app settings:', error);
  }
};

// Handle blocked permissions with user-friendly dialog
export const handlePermissionBlocked = (permission: string): void => {
  Alert.alert(
    'Permission Required',
    `Please enable ${permission} access in app settings to continue using this feature.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: openAppSettings }
    ]
  );
};

// Profile picture upload flow with permission handling
export const handleProfilePictureUpload = async (): Promise<boolean> => {
  try {
    // First check if we have the necessary permissions
    const cameraStatus = await askCameraPermission({
      title: 'Camera Permission',
      message: 'Allow access to camera to take a new profile picture or choose from gallery',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    });

    const photoStatus = await askPhotoPermission({
      title: 'Photo Access',
      message: 'Allow access to photos to choose a profile picture from your gallery',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    });

    // Check if at least one permission is granted
    if (cameraStatus === 'granted' || photoStatus === 'granted') {
      // Show options to user
      Alert.alert(
        'Profile Picture',
        'How would you like to add your profile picture?',
        [
          { text: 'Cancel', style: 'cancel' },
          ...(cameraStatus === 'granted' ? [{ text: 'Take Photo', onPress: () => console.log('Open camera') }] : []),
          ...(photoStatus === 'granted' ? [{ text: 'Choose from Gallery', onPress: () => console.log('Open gallery') }] : []),
        ]
      );
      return true;
    } else {
      // Handle case where permissions are denied
      if (cameraStatus === 'never_ask_again' || photoStatus === 'never_ask_again') {
        handlePermissionBlocked('camera and photo');
      } else {
        Alert.alert(
          'Permissions Required',
          'Camera or photo access is needed to upload a profile picture.',
          [{ text: 'OK' }]
        );
      }
      return false;
    }
  } catch (error) {
    console.error('Error handling profile picture upload:', error);
    return false;
  }
};

// Check if permission is permanently denied
export const isPermissionPermanentlyDenied = (status: PermissionStatus): boolean => {
  return status === 'never_ask_again';
};

// Get user-friendly permission names
export const getPermissionDisplayName = (permission: string): string => {
  const permissionNames: { [key: string]: string } = {
    [PermissionsAndroid.PERMISSIONS.CAMERA]: 'Camera',
    [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO]: 'Microphone',
    [PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS]: 'Notifications',
    [PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE]: 'Storage',
    [PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES]: 'Photos',
    [PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO]: 'Videos',
  };
  
  return permissionNames[permission] || permission;
};