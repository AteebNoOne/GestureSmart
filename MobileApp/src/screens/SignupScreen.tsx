import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Image,
    SafeAreaView,
    Animated,
    Keyboard,
    ActivityIndicator,
    Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { spacing, typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { NavigationProp } from '@react-navigation/native';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { Input } from '../components/Input';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
    responsiveHeight,
    responsiveWidth,
    responsiveFontSize,
} from 'react-native-responsive-dimensions';
import userApi from '../api/user';
import { validateAge, validatePassword, validatePhoneNumber } from '../utils/validators';
import { SignupData } from '../types/User';
import { getAddressFromOSM } from '../utils/getAddressFromOSM';

interface SignupScreenProps {
    navigation: NavigationProp<any>;
}

interface FormErrors {
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    gender: string;
    dateOfBirth: string;
    phone: string;
    location: string;
    general: string; // For general API errors
}

export const SignupScreen: React.FC<SignupScreenProps> = ({ navigation }) => {
    // Form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [gender, setGender] = useState<'male' | 'female'>('male');
    const [dateOfBirth, setDateOfBirth] = useState(() => {
        const date = new Date();
        date.setFullYear(date.getFullYear() - 18);
        return date;
    });
    const [phone, setPhone] = useState('');
    const [location, setLocation] = useState('');
    const [locationLoading, setLocationLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const [animatedValue] = useState(new Animated.Value(0));

    // Loading states for different operations
    const [isEmailChecking, setIsEmailChecking] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
    const [isSigningUp, setIsSigningUp] = useState(false);

    const [errors, setErrors] = useState<FormErrors>({
        email: '',
        password: '',
        confirmPassword: '',
        firstName: '',
        lastName: '',
        gender: '',
        dateOfBirth: '',
        phone: '',
        location: '',
        general: '',
    });

    const { theme, colors } = useTheme();
    const isDarkTheme = theme === 'dark' || theme === 'blue' || theme === 'purple';

    // Clear specific field errors when user starts typing
    const clearFieldError = useCallback((field: keyof FormErrors) => {
        setErrors(prev => ({
            ...prev,
            [field]: '',
            general: '', // Also clear general errors when user interacts
        }));
    }, []);

    useEffect(() => {
        clearFieldError('email');
    }, [email, clearFieldError]);

    useEffect(() => {
        clearFieldError('password');
    }, [password, clearFieldError]);

    useEffect(() => {
        clearFieldError('confirmPassword');
    }, [confirmPassword, clearFieldError]);

    useEffect(() => {
        clearFieldError('firstName');
    }, [firstName, clearFieldError]);

    useEffect(() => {
        clearFieldError('lastName');
    }, [lastName, clearFieldError]);

    useEffect(() => {
        clearFieldError('phone');
    }, [phone, clearFieldError]);

    useEffect(() => {
        clearFieldError('location');
    }, [location, clearFieldError]);

    useEffect(() => {
        clearFieldError('gender');
    }, [gender, clearFieldError]);

    useEffect(() => {
        clearFieldError('dateOfBirth');
    }, [dateOfBirth, clearFieldError]);

    // Clear errors when changing pages
    useEffect(() => {
        setErrors(prev => ({
            ...prev,
            general: '',
        }));
    }, [currentPage]);

    // Animate accessibility icons
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(animatedValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(animatedValue, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const gestureTranslateY = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -8]
    });

    const voiceOpacity = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.4, 1]
    });

    // Keyboard listeners
    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            () => setKeyboardVisible(true)
        );
        const keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide',
            () => setKeyboardVisible(false)
        );

        return () => {
            keyboardDidShowListener.remove();
            keyboardDidHideListener.remove();
        };
    }, []);


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
                setLocation(completeAddress);
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
                setLocation(getLocation);
            } catch (fallbackError) {
                Alert.alert('Error', 'Failed to get current location and address');
            }
        } finally {
            setLocationLoading(false);
        }
    };


    // Theme-specific styling for access options
    const getAccessibilityOptions = () => {
        const options = [
            {
                icon: 'gesture-tap' as const,
                label: 'Gesture',
                color: theme === 'light' ? '#FF6B6B' :
                    theme === 'dark' ? '#ffc300' :
                        theme === 'blue' ? '#4ECDC4' :
                            '#FF9FB2'
            },
            {
                icon: 'microphone' as const,
                label: 'Voice',
                color: theme === 'light' ? '#4ECDC4' :
                    theme === 'dark' ? '#4ECDC4' :
                        theme === 'blue' ? '#7BDFFF' :
                            '#9381FF'
            },
            {
                icon: 'eye-outline' as const,
                label: 'Eye Tracking',
                color: theme === 'light' ? '#FFD166' :
                    theme === 'dark' ? '#FFD166' :
                        theme === 'blue' ? '#FFD166' :
                            '#F8C8DC'
            },
        ];
        return options;
    };

    const validatePage = (page: number): boolean => {
        let isValid = true;
        const newErrors: FormErrors = {
            email: '',
            password: '',
            confirmPassword: '',
            firstName: '',
            lastName: '',
            gender: '',
            dateOfBirth: '',
            phone: '',
            location: '',
            general: '',
        };

        if (page === 1) {
            if (!email.trim()) {
                newErrors.email = 'Email is required';
                isValid = false;
            } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
                newErrors.email = 'Invalid email format';
                isValid = false;
            }

            if (!password) {
                newErrors.password = 'Password is required';
                isValid = false;
            } else if (!validatePassword(password)) {
                newErrors.password = 'Password must be at least 8 characters, include uppercase, lowercase, number, and special character';
                isValid = false;
            }

            if (!confirmPassword) {
                newErrors.confirmPassword = 'Please confirm your password';
                isValid = false;
            } else if (password !== confirmPassword) {
                newErrors.confirmPassword = 'Passwords do not match';
                isValid = false;
            }
        }

        if (page === 2) {
            if (!firstName.trim()) {
                newErrors.firstName = 'First name is required';
                isValid = false;
            } else if (firstName.trim().length < 2) {
                newErrors.firstName = 'First name must be at least 2 characters';
                isValid = false;
            }

            if (!lastName.trim()) {
                newErrors.lastName = 'Last name is required';
                isValid = false;
            } else if (lastName.trim().length < 2) {
                newErrors.lastName = 'Last name must be at least 2 characters';
                isValid = false;
            }
        }

        if (page === 3) {
            if (!gender) {
                newErrors.gender = 'Please select a gender';
                isValid = false;
            }
            if (!dateOfBirth) {
                newErrors.dateOfBirth = 'Date of birth is required';
                isValid = false;
            } else if (!validateAge(dateOfBirth)) {
                newErrors.dateOfBirth = 'You must be at least 18 years old';
                isValid = false;
            }
        }

        if (page === 4) {
            if (!phone.trim()) {
                newErrors.phone = 'Phone number is required';
                isValid = false;
            } else if (!validatePhoneNumber(phone)) {
                newErrors.phone = 'Please enter a valid phone number';
                isValid = false;
            }

            if (!location.trim()) {
                newErrors.location = 'Location is required';
                isValid = false;
            } else if (location.trim().length < 3) {
                newErrors.location = 'Please enter a valid location';
                isValid = false;
            }
        }

        setErrors(newErrors);
        return isValid;
    };

    const checkEmailAvailability = async (emailToCheck: string): Promise<boolean> => {
        try {
            setIsEmailChecking(true);
            const response = await userApi.checkEmailAvailability(emailToCheck.trim());
            return response.available;
        } catch (error: any) {
            console.error('Email availability check error:', error);

            // Handle different types of errors
            if (error?.response?.status === 429) {
                throw new Error('Too many requests. Please try again in a moment.');
            } else if (error?.response?.status >= 500) {
                throw new Error('Server error. Please try again later.');
            } else if (!error?.response) {
                throw new Error('Network error. Please check your connection.');
            } else {
                throw new Error(error?.response?.data?.message || 'Error checking email availability');
            }
        } finally {
            setIsEmailChecking(false);
        }
    };

    const handleNext = async () => {
        // Prevent multiple simultaneous requests
        if (isNavigating || isEmailChecking) {
            return;
        }

        console.log("Next page:", currentPage);

        if (!validatePage(currentPage)) {
            return;
        }

        if (currentPage === 1) {
            try {
                const isAvailable = await checkEmailAvailability(email);
                if (!isAvailable) {
                    setErrors(prev => ({
                        ...prev,
                        email: 'This email is already registered',
                        general: '',
                    }));
                    return;
                }
            } catch (error: any) {
                console.error("Email check error:", error.data.code);
                setErrors(prev => ({
                    ...prev,
                    email: error.message || 'Error checking email availability',
                    general: '',
                }));
                return;
            }
        }

        setIsNavigating(true);
        try {
            // Small delay to show loading state
            await new Promise(resolve => setTimeout(resolve, 100));
            setCurrentPage(prev => prev + 1);
        } finally {
            setIsNavigating(false);
        }
    };

    const handleBack = () => {
        if (isNavigating || isSigningUp) {
            return;
        }

        setCurrentPage(prev => prev - 1);
        // Clear any general errors when going back
        setErrors(prev => ({
            ...prev,
            general: '',
        }));
    };

    const handleSignup = async () => {
        // Prevent multiple simultaneous signup requests
        if (isSigningUp || isNavigating) {
            return;
        }

        if (!validatePage(4)) {
            return;
        }

        setIsSigningUp(true);

        try {
            const userData: SignupData = {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim().toLowerCase(),
                password,
                gender,
                dateOfBirth: dateOfBirth.toISOString(),
                phone: phone.trim(),
                location: location.trim()
            };

            console.log("Attempting signup...");
            const response = await userApi.signup(userData);

            if (response.success) {
                console.log("Signup successful:", response);

                // Show success message
                Alert.alert(
                    'Success!',
                    'Account created successfully. Please login.',
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.navigate('Login')
                        }
                    ]
                );
            } else {
                throw new Error(response.message || 'Signup failed');
            }
        } catch (error: any) {
            console.error("Signup error:", error);

            let errorMessage = 'An unexpected error occurred. Please try again.';

            if (error?.response?.status === 409 ||
                (error?.response?.data?.message && error.response.data.message.toLowerCase().includes('email'))) {
                // Email already exists - go back to first page
                setErrors(prev => ({
                    ...prev,
                    email: 'This email is already registered',
                    general: '',
                }));
                setCurrentPage(1);
                return;
            } else if (error?.response?.status === 400) {
                errorMessage = error?.response?.data?.message || 'Invalid data provided. Please check your information.';
            } else if (error?.response?.status === 429) {
                errorMessage = 'Too many requests. Please try again in a moment.';
            } else if (error?.response?.status >= 500) {
                errorMessage = 'Server error. Please try again later.';
            } else if (!error?.response) {
                errorMessage = 'Network error. Please check your connection and try again.';
            } else if (error?.message) {
                errorMessage = error.message;
            }

            setErrors(prev => ({
                ...prev,
                general: errorMessage,
            }));

            // Show error alert for better UX
            Alert.alert(
                'Signup Failed',
                errorMessage,
                [{ text: 'OK' }]
            );
        } finally {
            setIsSigningUp(false);
        }
    };

    const styles = StyleSheet.create({
        safeArea: {
            flex: 1,
            backgroundColor: colors.background,
        },
        themeSwitcherWrapper: {
            position: 'absolute',
            top: Platform.OS === 'ios' ? responsiveHeight(5) : responsiveHeight(2),
            right: responsiveWidth(4),
            zIndex: 1000,
        },
        mainContainer: {
            flex: 1,
            justifyContent: 'space-between',
            paddingHorizontal: responsiveWidth(5),
            paddingBottom: responsiveHeight(2),
            paddingTop: responsiveHeight(isKeyboardVisible ? 1 : 4),
        },
        headerSection: {
            alignItems: 'center',
            marginBottom: responsiveHeight(2),
            height: isKeyboardVisible ? responsiveHeight(0) : 'auto',
            opacity: isKeyboardVisible ? 0 : 1,
        },
        logoContainer: {
            width: responsiveWidth(50),
            height: responsiveWidth(50),
            borderRadius: responsiveWidth(25),
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: responsiveHeight(1.5),
            elevation: 8,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 6,
            backgroundColor: isDarkTheme ? colors.surface : colors.card,
        },
        logo: {
            width: responsiveWidth(50),
            height: responsiveWidth(50),
        },
        title: {
            fontSize: responsiveFontSize(2.5),
            fontFamily: typography.fontFamily.bold,
            color: colors.text,
            marginBottom: responsiveHeight(1),
        },
        subtitle: {
            fontSize: responsiveFontSize(1.8),
            fontFamily: typography.fontFamily.regular,
            color: colors.textSecondary,
            marginBottom: responsiveHeight(2),
        },
        accessibilityOptionsContainer: {
            flexDirection: 'row',
            justifyContent: 'space-evenly',
            marginTop: responsiveHeight(1.5),
            marginBottom: isKeyboardVisible ? 0 : responsiveHeight(2),
            height: isKeyboardVisible ? 0 : 'auto',
            opacity: isKeyboardVisible ? 0 : 1,
        },
        accessibilityOption: {
            alignItems: 'center',
            width: responsiveWidth(20),
        },
        accessibilityIconContainer: {
            width: responsiveWidth(12),
            height: responsiveWidth(12),
            borderRadius: responsiveWidth(6),
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: responsiveHeight(0.6),
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 3,
        },
        accessibilityLabel: {
            fontSize: responsiveFontSize(1.5),
            fontFamily: typography.fontFamily.medium,
            color: colors.textSecondary,
            textAlign: 'center',
        },
        formSection: {
            flex: isKeyboardVisible ? 1 : 0.6,
            justifyContent: 'center',
        },
        inputContainer: {
            marginBottom: responsiveHeight(1.5),
        },
        genderContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: responsiveHeight(1.5),
        },
        genderButton: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: responsiveHeight(1.5),
            borderRadius: responsiveHeight(1),
            marginHorizontal: responsiveWidth(1),
            backgroundColor: colors.primary,
        },
        genderButtonSelected: {
            backgroundColor: colors.secondary,
        },
        genderButtonText: {
            color: '#FFFFFF',
            fontSize: responsiveFontSize(1.8),
            fontFamily: typography.fontFamily.medium,
            marginLeft: responsiveWidth(2),
        },
        dateButton: {
            backgroundColor: colors.primary,
            padding: responsiveHeight(1.5),
            borderRadius: responsiveHeight(1),
            marginBottom: responsiveHeight(1.5),
        },
        dateButtonText: {
            color: '#FFFFFF',
            fontSize: responsiveFontSize(1.8),
            fontFamily: typography.fontFamily.medium,
            textAlign: 'center',
        },
        navigationButtons: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: responsiveHeight(2),
        },
        button: {
            flex: 1,
            borderRadius: responsiveHeight(4),
            paddingVertical: responsiveHeight(1.5),
            marginHorizontal: responsiveWidth(1),
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            height: responsiveHeight(6.5),
            backgroundColor: colors.primary,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 3,
        },
        buttonOutline: {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: colors.primary,
        },
        buttonDisabled: {
            opacity: 0.6,
        },
        buttonText: {
            color: '#FFFFFF',
            fontSize: responsiveFontSize(1.8),
            fontFamily: typography.fontFamily.medium,
            marginLeft: responsiveWidth(2),
        },
        buttonTextOutline: {
            color: colors.primary,
        },
        errorText: {
            color: colors.error,
            fontSize: responsiveFontSize(1.4),
            fontFamily: typography.fontFamily.regular,
            marginTop: responsiveHeight(0.5),
        },
        generalErrorText: {
            color: colors.error,
            fontSize: responsiveFontSize(1.6),
            fontFamily: typography.fontFamily.medium,
            textAlign: 'center',
            marginBottom: responsiveHeight(1),
            paddingHorizontal: responsiveWidth(2),
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

    const renderCurrentPage = () => {
        switch (currentPage) {
            case 1:
                return (
                    <>
                        <Input
                            type="email"
                            label="Email"
                            placeholder="Enter your email"
                            value={email}
                            onChangeText={setEmail}
                            error={errors.email}
                            leftIcon="email"
                            required
                            variant="filled"
                            autoCapitalize="none"
                            editable={!isEmailChecking}
                        />
                        <Input
                            type="password"
                            label="Password"
                            placeholder="Enter your password"
                            value={password}
                            onChangeText={setPassword}
                            error={errors.password}
                            leftIcon="lock"
                            required
                            variant="filled"
                            autoCapitalize="none"
                        />
                        <Input
                            type="password"
                            label="Confirm Password"
                            placeholder="Confirm your password"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            error={errors.confirmPassword}
                            leftIcon="lock-check"
                            required
                            variant="filled"
                            autoCapitalize="none"
                        />
                    </>
                );
            case 2:
                return (
                    <>
                        <Input
                            type="text"
                            label="First Name"
                            placeholder="Enter your first name"
                            value={firstName}
                            onChangeText={setFirstName}
                            error={errors.firstName}
                            leftIcon="account"
                            required
                            variant="filled"
                            autoCapitalize="words"
                        />
                        <Input
                            type="text"
                            label="Last Name"
                            placeholder="Enter your last name"
                            value={lastName}
                            onChangeText={setLastName}
                            error={errors.lastName}
                            leftIcon="account"
                            required
                            variant="filled"
                            autoCapitalize="words"
                        />
                    </>
                );
            case 3:
                return (
                    <>
                        <View style={styles.genderContainer}>
                            <TouchableOpacity
                                style={[
                                    styles.genderButton,
                                    gender === 'male' && styles.genderButtonSelected,
                                ]}
                                onPress={() => setGender('male')}
                                disabled={isSigningUp}
                            >
                                <MaterialCommunityIcons name="gender-male" size={24} color="#FFFFFF" />
                                <Text style={styles.genderButtonText}>Male</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.genderButton,
                                    gender === 'female' && styles.genderButtonSelected,
                                ]}
                                onPress={() => setGender('female')}
                                disabled={isSigningUp}
                            >
                                <MaterialCommunityIcons name="gender-female" size={24} color="#FFFFFF" />
                                <Text style={styles.genderButtonText}>Female</Text>
                            </TouchableOpacity>
                        </View>
                        {errors.gender ? <Text style={styles.errorText}>{errors.gender}</Text> : null}

                        <TouchableOpacity
                            style={styles.dateButton}
                            onPress={() => setShowDatePicker(true)}
                            disabled={isSigningUp}
                        >
                            <Text style={styles.dateButtonText}>
                                Date of Birth: {dateOfBirth.toLocaleDateString()}
                            </Text>
                        </TouchableOpacity>
                        {errors.dateOfBirth ? <Text style={styles.errorText}>{errors.dateOfBirth}</Text> : null}
                        {showDatePicker && (
                            <DateTimePicker
                                value={dateOfBirth}
                                mode="date"
                                display="default"
                                maximumDate={new Date(new Date().setFullYear(new Date().getFullYear() - 18))}
                                minimumDate={new Date(new Date().setFullYear(new Date().getFullYear() - 100))}
                                onChange={(_event, selectedDate) => {
                                    setShowDatePicker(false);
                                    if (selectedDate) {
                                        setDateOfBirth(selectedDate);
                                    }
                                }}
                            />
                        )}
                    </>
                );
            case 4:
                return (
                    <>
                        <Input
                            type="text"
                            label="Phone"
                            placeholder="03XXXXXXXXX"
                            value={phone}
                            onChangeText={setPhone}
                            error={errors.phone}
                            leftIcon="phone"
                            required
                            variant="filled"
                            keyboardType="phone-pad"
                            maxLength={11}
                        />
                        <Input
                            type="text"
                            label="Location"
                            placeholder="Enter your location"
                            value={location}
                            onChangeText={setLocation}
                            error={errors.location}
                            leftIcon="map-marker"
                            required
                            variant="filled"
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
                    </>
                );
            default:
                return null;
        }
    };

    const isLoading = isEmailChecking || isNavigating || isSigningUp;
    const canGoBack = currentPage > 1 && !isLoading;
    const canProceed = !isLoading;

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={[styles.decorationCircle, styles.themeDecorationTop]} />
            <View style={[styles.decorationCircle, styles.themeDecorationBottom]} />

            <View style={styles.themeSwitcherWrapper}>
                <ThemeSwitcher />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.mainContainer}
            >
                <View style={styles.headerSection}>
                    <View style={styles.logoContainer}>
                        <Image
                            source={
                                isDarkTheme
                                    ? require('../assets/logo-light.png')
                                    : require('../assets/logo-dark.png')
                            }
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </View>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Step {currentPage} of 4</Text>

                    {/* Accessibility Options Icons */}
                    <View style={styles.accessibilityOptionsContainer}>
                        {getAccessibilityOptions().map((option, index) => (
                            <View key={index} style={styles.accessibilityOption}>
                                <Animated.View
                                    style={[
                                        styles.accessibilityIconContainer,
                                        { backgroundColor: option.color + '20' },
                                        index === 0 ? { transform: [{ translateY: gestureTranslateY }] } :
                                            index === 1 ? { opacity: voiceOpacity } : {}
                                    ]}
                                >
                                    <MaterialCommunityIcons
                                        name={option.icon}
                                        size={Math.round(responsiveFontSize(2.5))}
                                        color={option.color}
                                    />
                                </Animated.View>
                                <Text style={styles.accessibilityLabel}>{option.label}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                <View style={styles.formSection}>
                    {errors.general ? (
                        <Text style={styles.generalErrorText}>{errors.general}</Text>
                    ) : null}
                    {renderCurrentPage()}
                </View>

                <View style={styles.navigationButtons}>
                    {canGoBack && (
                        <TouchableOpacity
                            style={[styles.button, styles.buttonOutline]}
                            onPress={handleBack}
                            disabled={!canGoBack}
                        >
                            <MaterialCommunityIcons
                                name="arrow-left"
                                size={Math.round(responsiveFontSize(2.2))}
                                color={colors.primary}
                            />
                            <Text style={[styles.buttonText, styles.buttonTextOutline]}>Back</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.button,
                            !canProceed && styles.buttonDisabled
                        ]}
                        onPress={currentPage === 4 ? handleSignup : handleNext}
                        disabled={!canProceed}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <MaterialCommunityIcons
                                    name={currentPage === 4 ? "account-plus" : "arrow-right"}
                                    size={Math.round(responsiveFontSize(2.2))}
                                    color="#FFFFFF"
                                />
                                <Text style={styles.buttonText}>
                                    {currentPage === 4 ? "Sign Up" :
                                        currentPage === 1 && isEmailChecking ? "Checking..." : "Next"}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};