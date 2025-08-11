import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useTheme } from '../hooks/useTheme';
import { spacing, typography } from '../constants/theme';
import { NavigationProp } from '@react-navigation/native';
import { Input } from '../components/Input';
import {
  responsiveHeight,
  responsiveWidth,
  responsiveFontSize,
} from 'react-native-responsive-dimensions';
import { User } from '../types/User';
import { formatDate } from '../utils/formatDate';
import DateTimePicker from '@react-native-community/datetimepicker';
import { clearError, getUserProfile, updateUser } from '../store/reducers';
import LineLoader from '../components/LineLoader';
import { validateEmail, validatePhoneNumber } from '../utils/validators';
import { getAddressFromOSM } from '../utils/getAddressFromOSM';

interface ProfileScreenProps {
  navigation: NavigationProp<any>;
}

// Define RootState interface
interface RootState {
  user: {
    user: User | null;
    isLoading: boolean;
    error: string | null;
    isAuthenticated: boolean;
  };
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { theme, colors } = useTheme();

  // Redux hooks
  const dispatch = useDispatch();
  const { user, isLoading, error } = useSelector((state: RootState) => state.user);
  console.log("User", user)
  // Local state
  const [isEditing, setIsEditing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [locationLoading, setLocationLoading] = useState(false);

  // Form data state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    dateOfBirth: new Date(),
    phone: '',
    location: '',
  });

  // Initialize form data when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth) : new Date(),
        phone: user.phone || '',
        location: user.location || '',
      });
      setProfileImage(user.profileImage || null);
    }
  }, [user]);

  // Handle Redux errors
  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [
        { text: 'OK', onPress: () => dispatch(clearError()) }
      ]);
    }
  }, [error, dispatch]);

  // Load user profile on mount
  useEffect(() => {
    dispatch(getUserProfile());
  }, [dispatch]);

  // Form validation
  const validateForm = () => {
    const errors = {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
    };
    let isValid = true;

    // First name validation
    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required';
      isValid = false;
    }

    // Last name validation
    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required';
      isValid = false;
    }

    // Email validation
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
      isValid = false;
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
      isValid = false;
    }

    // Phone validation (optional but if provided, should be valid)
    if (formData.phone.trim() && !validatePhoneNumber(formData.phone)) {
      errors.phone = 'Please enter a valid phone number';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      const updateData = {
        ...formData,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        location: formData.location.trim(),
        profileImage: profileImage,
      };

      const result = await dispatch(updateUser(updateData));

      if (updateUser.fulfilled.match(result)) {
        setIsEditing(false);
        Alert.alert('Success', 'Profile updated successfully!');
      }
    } catch (error) {
      console.error('Update profile error:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to original user data
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth) : new Date(),
        phone: user.phone || '',
        location: user.location || '',
      });
      setProfileImage(user.profileImage || null);
    }
    setFormErrors({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
    });
    setIsEditing(false);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData(prev => ({
        ...prev,
        dateOfBirth: selectedDate,
      }));
    }
  };

  const pickImage = async () => {
    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission needed', 'Please grant permission to access your photo library.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission needed', 'Please grant permission to access your camera.');
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handleImagePicker = () => {
    Alert.alert(
      'Select Profile Picture',
      'Choose how you want to select your profile picture',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Gallery', onPress: pickImage },
      ]
    );
  };

  const getUserInitials = () => {
    const firstName = formData.firstName || user?.firstName || '';
    const lastName = formData.lastName || user?.lastName || '';

    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    } else if (firstName) {
      return firstName.charAt(0).toUpperCase();
    } else if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }

    return 'U';
  };

  const calculateAge = (birthDate: Date) => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  };

  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      paddingHorizontal: responsiveWidth(5),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: Platform.OS === 'ios' ? responsiveHeight(2) : responsiveHeight(4),
      marginBottom: responsiveHeight(3),
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButton: {
      marginRight: responsiveWidth(3),
    },
    title: {
      fontSize: responsiveFontSize(2.5),
      fontFamily: typography.fontFamily.bold,
      color: colors.text,
    },
    editButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isEditing ? colors.primary : 'transparent',
      paddingHorizontal: responsiveWidth(4),
      paddingVertical: responsiveHeight(1),
      borderRadius: responsiveWidth(5),
      borderWidth: isEditing ? 0 : 1,
      borderColor: colors.primary,
      opacity: (isLoading || isSaving) ? 0.7 : 1,
    },
    editButtonText: {
      color: isEditing ? '#FFFFFF' : colors.primary,
      marginLeft: responsiveWidth(2),
      fontFamily: typography.fontFamily.medium,
      fontSize: responsiveFontSize(1.6),
    },
    cancelButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'transparent',
      paddingHorizontal: responsiveWidth(4),
      paddingVertical: responsiveHeight(1),
      borderRadius: responsiveWidth(5),
      borderWidth: 1,
      borderColor: colors.error,
      marginRight: responsiveWidth(2),
    },
    cancelButtonText: {
      color: colors.error,
      marginLeft: responsiveWidth(2),
      fontFamily: typography.fontFamily.medium,
      fontSize: responsiveFontSize(1.6),
    },
    headerButtons: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    profileSection: {
      alignItems: 'center',
      marginBottom: responsiveHeight(4),
    },
    avatarContainer: {
      position: 'relative',
      marginBottom: responsiveHeight(2),
    },
    avatar: {
      width: responsiveWidth(30),
      height: responsiveWidth(30),
      borderRadius: responsiveWidth(15),
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: responsiveWidth(15),
    },
    avatarText: {
      fontSize: responsiveFontSize(4),
      color: colors.primary,
      fontFamily: typography.fontFamily.bold,
    },
    editAvatarButton: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: colors.primary,
      width: responsiveWidth(10),
      height: responsiveWidth(10),
      borderRadius: responsiveWidth(5),
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    sectionCard: {
      backgroundColor: colors.card,
      borderRadius: responsiveWidth(4),
      padding: responsiveWidth(5),
      marginBottom: responsiveHeight(2),
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
      elevation: 5,
    },
    sectionTitle: {
      fontSize: responsiveFontSize(2),
      fontFamily: typography.fontFamily.semibold,
      color: colors.text,
      marginBottom: responsiveHeight(2),
    },
    inputContainer: {
      marginBottom: responsiveHeight(2),
    },
    readOnlyContainer: {
      marginBottom: responsiveHeight(1.5),
    },
    label: {
      fontSize: responsiveFontSize(1.6),
      fontFamily: typography.fontFamily.medium,
      color: colors.textSecondary,
      marginBottom: responsiveHeight(0.5),
    },
    value: {
      fontSize: responsiveFontSize(1.8),
      fontFamily: typography.fontFamily.regular,
      color: colors.text,
    },
    datePickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      padding: responsiveWidth(4),
      borderRadius: responsiveWidth(2),
      borderWidth: 1,
      borderColor: colors.border,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    decorationCircle: {
      position: 'absolute',
      borderRadius: responsiveWidth(100),
      width: responsiveWidth(150),
      height: responsiveWidth(150),
      zIndex: -1,
    },
    themeDecorationTop: {
      top: -responsiveHeight(15),
      left: -responsiveWidth(25),
      backgroundColor: theme === 'light' ? 'rgba(3, 4, 94, 0.03)' :
        theme === 'dark' ? 'rgba(255, 195, 0, 0.05)' :
          theme === 'blue' ? 'rgba(5, 9, 130, 0.08)' :
            'rgba(56, 4, 64, 0.08)',
    },
    themeDecorationBottom: {
      bottom: -responsiveHeight(15),
      right: -responsiveWidth(25),
      backgroundColor: theme === 'light' ? 'rgba(3, 4, 94, 0.02)' :
        theme === 'dark' ? 'rgba(255, 219, 77, 0.03)' :
          theme === 'blue' ? 'rgba(123, 223, 255, 0.04)' :
            'rgba(196, 179, 204, 0.04)',
    },
    splashContainer: {
      flex: 1,
      backgroundColor: '#fff', // or any brand color
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    logo: {
      width: 350,
      height: 350,
      marginBottom: 20,
    },
    loader: {
      marginTop: 10,
    },
    locationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight || colors.primary + '20',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: spacing.sm,
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },
    locationButtonText: {
      color: colors.primary,
      fontSize: typography.fontSize.sm,
      fontFamily: typography.fontFamily.semibold,
      marginLeft: spacing.xs,
    },
  });

  // Show loading screen while fetching user data
  if (isLoading) {
    return (
      <View style={styles.splashContainer}>
        <Image
          source={require('../../assets/splash-icon.png')}

          style={styles.logo}
          resizeMode="contain"
        />
        <LineLoader />
      </View>
    );
  }



  const handleGetCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant location permissions to use current location.');
        return;
      }

      const locationResult = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Method 1: Using Expo Location's reverse geocoding (more complete address)
      const address = await Location.reverseGeocodeAsync({
        latitude: locationResult.coords.latitude,
        longitude: locationResult.coords.longitude,
      });

      if (address.length > 0) {
        const addr = address[0];

        // Build complete address from all available components
        const addressParts = [];

        if (addr.streetNumber) addressParts.push(addr.streetNumber);
        if (addr.street) addressParts.push(addr.street);
        if (addr.district) addressParts.push(addr.district);
        if (addr.subregion) addressParts.push(addr.subregion);
        if (addr.city) addressParts.push(addr.city);
        if (addr.region) addressParts.push(addr.region);
        if (addr.postalCode) addressParts.push(addr.postalCode);
        if (addr.country) addressParts.push(addr.country);

        const completeAddress = addressParts.join(', ');
        setFormData(prev => ({
          ...prev,
          location: completeAddress,
        }));
      } else {
        // Fallback to OpenStreetMap Nominatim API for more detailed address
        await getAddressFromOSM(locationResult.coords.latitude, locationResult.coords.longitude);
      }
    } catch (error) {
      console.error('Location error:', error);
      // Fallback to OpenStreetMap if Expo's geocoding fails
      try {
        const locationResult = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const getLocation = await getAddressFromOSM(locationResult.coords.latitude, locationResult.coords.longitude);
        setFormData(prev => ({
          ...prev,
          location: getLocation,
        }));
      } catch (fallbackError) {
        Alert.alert('Error', 'Failed to get current location and address');
      }
    } finally {
      setLocationLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Background decorations */}
      <View style={[styles.decorationCircle, styles.themeDecorationTop]} />
      <View style={[styles.decorationCircle, styles.themeDecorationBottom]} />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              disabled={isSaving}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
            <Text style={styles.title}>Profile</Text>
          </View>

          <View style={styles.headerButtons}>
            {isEditing && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                disabled={isSaving}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={colors.error}
                />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.editButton}
              onPress={isEditing ? handleSave : () => setIsEditing(true)}
              disabled={isLoading || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size={20} color={isEditing ? '#FFFFFF' : colors.primary} />
              ) : (
                <MaterialCommunityIcons
                  name={isEditing ? "content-save" : "pencil"}
                  size={20}
                  color={isEditing ? '#FFFFFF' : colors.primary}
                />
              )}
              <Text style={styles.editButtonText}>
                {isSaving ? 'Saving...' : (isEditing ? 'Save' : 'Edit')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {getUserInitials()}
                </Text>
              )}
            </View>
            {isEditing && (
              <TouchableOpacity
                style={styles.editAvatarButton}
                onPress={handleImagePicker}
                disabled={isSaving}
              >
                <MaterialCommunityIcons
                  name="camera"
                  size={20}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          {isEditing ? (
            <>
              <View style={styles.inputContainer}>
                <Input
                  type="text"
                  label="First Name"
                  value={formData.firstName}
                  onChangeText={(text: string) => setFormData(prev => ({ ...prev, firstName: text }))}
                  error={formErrors.firstName}
                  variant="filled"
                  required
                  editable={!isSaving}
                />
              </View>
              <View style={styles.inputContainer}>
                <Input
                  type="text"
                  label="Last Name"
                  value={formData.lastName}
                  onChangeText={(text: string) => setFormData(prev => ({ ...prev, lastName: text }))}
                  error={formErrors.lastName}
                  variant="filled"
                  required
                  editable={!isSaving}
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Date of Birth</Text>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowDatePicker(true)}
                  disabled={isSaving}
                >
                  <Text style={styles.value}>
                    {formatDate(formData.dateOfBirth)}
                  </Text>
                  <MaterialCommunityIcons
                    name="calendar"
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={styles.readOnlyContainer}>
                <Text style={styles.label}>Name</Text>
                <Text style={styles.value}>
                  {formData.firstName} {formData.lastName}
                </Text>
              </View>
              <View style={styles.readOnlyContainer}>
                <Text style={styles.label}>Date of Birth</Text>
                <Text style={styles.value}>
                  {formatDate(formData.dateOfBirth)}
                </Text>
              </View>
              <View style={styles.readOnlyContainer}>
                <Text style={styles.label}>Age</Text>
                <Text style={styles.value}>{calculateAge(formData.dateOfBirth)} years</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          {isEditing ? (
            <>
              <View style={styles.inputContainer}>
                <Input
                  type="email"
                  label="Email"
                  value={formData.email}
                  onChangeText={(text: string) => setFormData(prev => ({ ...prev, email: text }))}
                  error={formErrors.email}
                  variant="filled"
                  required
                  editable={!isSaving}
                />
              </View>
              <View style={styles.inputContainer}>
                <Input
                  type="text"
                  label="Phone"
                  value={formData.phone}
                  onChangeText={(text: string) => setFormData(prev => ({ ...prev, phone: text }))}
                  error={formErrors.phone}
                  variant="filled"
                  keyboardType="phone-pad"
                  editable={!isSaving}
                />
              </View>
              <View style={styles.inputContainer}>
                <Input
                  type="text"
                  label="Location"
                  value={formData.location}
                  onChangeText={(text: string) => setFormData(prev => ({ ...prev, location: text }))}
                  variant="filled"
                  editable={!isSaving}
                />
                <TouchableOpacity
                  style={styles.locationButton}
                  onPress={handleGetCurrentLocation}
                  disabled={locationLoading}
                >
                  {locationLoading ? (
                    <ActivityIndicator size={16} color={colors.primary} />
                  ) : (
                    <MaterialCommunityIcons name="crosshairs-gps" size={16} color={colors.primary} />
                  )}
                  <Text style={styles.locationButtonText}>
                    {locationLoading ? 'Getting Location...' : 'Use Current Location'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={styles.readOnlyContainer}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.value}>{formData.email}</Text>
              </View>
              <View style={styles.readOnlyContainer}>
                <Text style={styles.label}>Phone</Text>
                <Text style={styles.value}>{formData.phone || 'Not provided'}</Text>
              </View>
              <View style={styles.readOnlyContainer}>
                <Text style={styles.label}>Location</Text>
                <Text style={styles.value}>{formData.location || 'Not provided'}</Text>
              </View>
            </>
          )}
        </View>

        {!isEditing && user?.createdAt && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            <View style={styles.readOnlyContainer}>
              <Text style={styles.label}>Member Since</Text>
              <Text style={styles.value}>
                {formatDate(new Date(user.createdAt))}
              </Text>
            </View>
          </View>
        )}

        {showDatePicker && (


          <DateTimePicker
            value={formData.dateOfBirth}
            mode="date"
            display="default"
            maximumDate={new Date(new Date().setFullYear(new Date().getFullYear() - 18))}
            minimumDate={new Date(new Date().setFullYear(new Date().getFullYear() - 100))}
            onChange={handleDateChange}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};