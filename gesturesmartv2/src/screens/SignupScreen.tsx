import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { typography, spacing } from '../constants/theme';
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
import { validateAge, validatePassword } from '../utils/validators';

interface SignupScreenProps {
    navigation: NavigationProp<any>;
}

export const SignupScreen: React.FC<SignupScreenProps> = ({ navigation }) => {
    // Form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [gender, setGender] = useState<'male' | 'female' | null>(null);
    const [dateOfBirth, setDateOfBirth] = useState(() => {
        const date = new Date();
        date.setFullYear(date.getFullYear() - 18);
        return date;
    });
    const [phone, setPhone] = useState('');
    const [location, setLocation] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const [animatedValue] = useState(new Animated.Value(0));
    const [loading, setLoading] = useState(false)

    const [errors, setErrors] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        firstName: '',
        lastName: '',
        gender: '',
        dateOfBirth: '',
        phone: '',
        location: '',
    });

    const { theme, colors } = useTheme();
    const isDarkTheme = theme === 'dark' || theme === 'blue' || theme === 'purple';


    useEffect(() => {
        if (errors.email) {
            setErrors({
                ...errors,
                email: ''
            })
        }
    }, [email])

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
        const newErrors = { ...errors };

        if (page === 1) {
            if (!email) {
                newErrors.email = 'Email is required';
                isValid = false;
            } else if (!/\S+@\S+\.\S+/.test(email)) {
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

            if (password !== confirmPassword) {
                newErrors.confirmPassword = 'Passwords do not match';
                isValid = false;
            }
        }

        if (page === 2) {
            if (!firstName.trim()) {
                newErrors.firstName = 'First name is required';
                isValid = false;
            }
            if (!lastName.trim()) {
                newErrors.lastName = 'Last name is required';
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
            if (!phone) {
                newErrors.phone = 'Phone number is required';
                isValid = false;
            }
            if (!location) {
                newErrors.location = 'Location is required';
                isValid = false;
            }
        }

        setErrors(newErrors);
        return isValid;
    };

    const handleNext = async () => {
        console.log("Next", currentPage)
        if (currentPage === 1) {
            try {
                const av = await userApi.checkEmailAvailability(email)
                if (!av.available) {
                    setErrors({
                        ...errors,
                        email: 'Email already exist!'
                    })
                    return
                }

            }
            catch (error) {
                console.log("Error", error)
                setErrors({
                    ...errors,
                    email: error.message
                })
                return
            }

        }
        if (validatePage(currentPage)) {
            setCurrentPage(prev => prev + 1);
        }
    };

    const handleBack = () => {
        setCurrentPage(prev => prev - 1);
    };

    const handleSignup = async () => {
        if (validatePage(4)) {
            try {
                const userData = {
                    firstName,
                    lastName,
                    email,
                    password,
                    gender,
                    dateOfBirth,
                    phone,
                    location
                };
                const response = await userApi.signup(userData);
                if (response.success) {
                    console.log("Signup successful:", response);
                    navigation.navigate('Login');
                }
            } catch (error) {
                console.error("Error signing up:", error);

                if (error instanceof Error) {
                    // Check if error has a response property (likely an Axios error)
                    const errWithResponse = error as Error & { response?: { data?: { message?: string } } };
                    if (errWithResponse.response && errWithResponse.response.data && errWithResponse.response.data.message) {
                        console.log("Error message:", errWithResponse.response.data.message);
                        setErrors({
                            ...errors,
                            email: 'Email already exist!'
                        })
                        setCurrentPage(1)
                    } else {
                        console.log("Error message:", error.message);
                    }
                } else {
                    console.log("Unknown error:", error);
                }
            }
            finally {
                setLoading(false)
            }
        };
    }
    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            () => {
                setKeyboardVisible(true);
            }
        );
        const keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide',
            () => {
                setKeyboardVisible(false);
            }
        );

        return () => {
            keyboardDidShowListener.remove();
            keyboardDidHideListener.remove();
        };
    }, []);

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
            paddingTop: responsiveHeight(isKeyboardVisible ? 2 : 4),
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
        buttonText: {
            color: colors.secondary,
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
                            value={confirmPassword} onChangeText={setConfirmPassword}
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
                            >
                                <MaterialCommunityIcons name="gender-female" size={24} color="#FFFFFF" />
                                <Text style={styles.genderButtonText}>Female</Text>
                            </TouchableOpacity>
                        </View>
                        {errors.gender ? <Text style={styles.errorText}>{errors.gender}</Text> : null}

                        <TouchableOpacity
                            style={styles.dateButton}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <Text style={styles.dateButtonText}>
                                {dateOfBirth.toLocaleDateString()}
                            </Text>
                        </TouchableOpacity>
                        {errors.dateOfBirth ? <Text style={styles.errorText}>{errors.dateOfBirth}</Text> : null}
                        {showDatePicker && (
                            <DateTimePicker
                                value={dateOfBirth}
                                mode="date"
                                display="default"
                                maximumDate={new Date(new Date().setFullYear(new Date().getFullYear() - 18))} // user must be born before this
                                onChange={(event, selectedDate) => {
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
                            placeholder="Enter your phone number"
                            value={phone}
                            onChangeText={setPhone}
                            error={errors.phone}
                            leftIcon="phone"
                            required
                            variant="filled"
                            keyboardType="phone-pad"
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
                    </>
                );
            default:
                return null;
        }
    };

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
                    {renderCurrentPage()}
                </View>

                <View style={styles.navigationButtons}>
                    {currentPage > 1 && (
                        <TouchableOpacity
                            style={[styles.button, styles.buttonOutline]}
                            onPress={handleBack}
                            disabled={loading}
                        >
                            <MaterialCommunityIcons
                                name="arrow-left"
                                size={Math.round(responsiveFontSize(2.2))}
                                color={colors.primary}
                            />
                            {loading ?
                                <ActivityIndicator size={20} color={"#000000"} />
                                :
                                <Text style={styles.buttonText}>Back</Text>
                            }
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={styles.button}
                        onPress={currentPage === 4 ? handleSignup : handleNext}
                        disabled={loading}
                    >
                        <MaterialCommunityIcons
                            name={currentPage === 4 ? "account-plus" : "arrow-right"}
                            size={Math.round(responsiveFontSize(2.2))}
                            color="#FFFFFF"
                        />
                        {loading ?
                            <ActivityIndicator size={20} color={"#FFFFFF"} />
                            :
                            <Text style={styles.buttonText}>
                                {currentPage === 4 ? "Sign Up" : "Next"}
                            </Text>
                        }
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};