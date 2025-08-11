import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Image,
    SafeAreaView,
    Keyboard,
    Alert,
    TextInput,
    Animated,
    Easing,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { typography, spacing } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { NavigationProp } from '@react-navigation/native';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { Input } from '../components/Input';
import axios from 'axios';
import { API_BASE_URL } from '../api';

interface ForgotPasswordScreenProps {
    navigation: NavigationProp<any>;
}

type Step = 'email' | 'otp' | 'newPassword';

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ navigation }) => {
    const [currentStep, setCurrentStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [timer, setTimer] = useState(60);
    const [canResend, setCanResend] = useState(false);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);

    const { colors } = useTheme();
    const otpRefs = useRef<TextInput[]>([]);
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const keyboardShowListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => setKeyboardVisible(true)
        );
        const keyboardHideListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setKeyboardVisible(false)
        );

        return () => {
            keyboardShowListener.remove();
            keyboardHideListener.remove();
        };
    }, []);

    useEffect(() => {
        if (currentStep === 'otp' && timer > 0) {
            const interval = setInterval(() => {
                setTimer((prev) => {
                    if (prev <= 1) {
                        setCanResend(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [currentStep, timer]);

    const animateTransition = () => {
        Animated.sequence([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
                easing: Easing.ease,
            }),
            Animated.timing(slideAnim, {
                toValue: 1,
                duration: 0,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
                easing: Easing.ease,
            }),
        ]).start();
    };

    const handleSendOTP = async () => {
        if (!email) {
            Alert.alert('Error', 'Please enter your email address');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            Alert.alert('Error', 'Please enter a valid email address');
            return;
        }

        setIsLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/user/forgot-password`, {
                email: email.toLowerCase().trim(),
            });

            if (response.data.success) {
                animateTransition();
                setCurrentStep('otp');
                setTimer(60);
                setCanResend(false);
                Alert.alert('Success', 'OTP sent to your email address');
            } else {
                Alert.alert('Error', response.data.message || 'Failed to send OTP');
            }
        } catch (error: any) {
            console.error('Send OTP error:', error);
            Alert.alert(
                'Error',
                error.response?.data?.message || 'Failed to send OTP. Please try again.'
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOTP = async () => {
        if (!canResend) return;

        setIsLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/user/forgot-password`, {
                email: email.toLowerCase().trim(),
            });

            if (response.data.success) {
                setTimer(60);
                setCanResend(false);
                setOtp(['', '', '', '', '', '']);
                Alert.alert('Success', 'OTP resent to your email address');
            } else {
                Alert.alert('Error', response.data.message || 'Failed to resend OTP');
            }
        } catch (error: any) {
            console.error('Resend OTP error:', error);
            Alert.alert('Error', 'Failed to resend OTP. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOTPChange = (text: string, index: number) => {
        const newOtp = [...otp];
        newOtp[index] = text;
        setOtp(newOtp);

        // Auto-focus next input
        if (text && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }

        // Auto-verify when all digits are entered
        if (newOtp.every(digit => digit !== '') && text) {
            handleVerifyOTP(newOtp.join(''));
        }
    };

    const handleOTPKeyPress = (key: string, index: number) => {
        if (key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleVerifyOTP = async (otpCode?: string) => {
        const otpToVerify = otpCode || otp.join('');

        if (otpToVerify.length !== 6) {
            Alert.alert('Error', 'Please enter the complete 6-digit OTP');
            return;
        }

        setIsLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/user/verify-otp`, {
                email: email.toLowerCase().trim(),
                otp: otpToVerify,
            });

            if (response.data.success) {
                animateTransition();
                setCurrentStep('newPassword');
                Alert.alert('Success', 'OTP verified successfully');
            } else {
                Alert.alert('Error', response.data.message || 'Invalid OTP');
                setOtp(['', '', '', '', '', '']);
                otpRefs.current[0]?.focus();
            }
        } catch (error: any) {
            console.error('Verify OTP error:', error);
            Alert.alert('Error', error.response?.data?.message || 'Invalid OTP. Please try again.');
            setOtp(['', '', '', '', '', '']);
            otpRefs.current[0]?.focus();
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!newPassword || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (newPassword.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters long');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        setIsLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/user/reset-password`, {
                email: email.toLowerCase().trim(),
                otp: otp.join(''),
                newPassword,
            });

            if (response.data.success) {
                Alert.alert(
                    'Success',
                    'Password reset successfully! You can now login with your new password.',
                    [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
                );
            } else {
                Alert.alert('Error', response.data.message || 'Failed to reset password');
            }
        } catch (error: any) {
            console.error('Reset password error:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to reset password. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const renderStepIndicator = () => {
        const steps = [
            { key: 'email', label: 'Email', icon: 'email' },
            { key: 'otp', label: 'Verify', icon: 'shield-check' },
            { key: 'newPassword', label: 'Reset', icon: 'lock-reset' },
        ];

        return (
            <View style={styles.stepIndicator}>
                {steps.map((step, index) => {
                    const isActive = step.key === currentStep;
                    const isCompleted = steps.findIndex(s => s.key === currentStep) > index;

                    return (
                        <View key={step.key} style={styles.stepItem}>
                            <View style={[
                                styles.stepCircle,
                                isActive && styles.stepCircleActive,
                                isCompleted && styles.stepCircleCompleted,
                            ]}>
                                <MaterialCommunityIcons
                                    name={step.icon as any}
                                    size={16}
                                    color={isActive || isCompleted ? '#FFFFFF' : colors.textSecondary}
                                />
                            </View>
                            <Text style={[
                                styles.stepLabel,
                                isActive && styles.stepLabelActive,
                            ]}>
                                {step.label}
                            </Text>
                            {index < steps.length - 1 && (
                                <View style={[
                                    styles.stepConnector,
                                    isCompleted && styles.stepConnectorCompleted,
                                ]} />
                            )}
                        </View>
                    );
                })}
            </View>
        );
    };

    const renderEmailStep = () => (
        <View>
            <Text style={styles.stepTitle}>Reset Your Password</Text>
            <Text style={styles.stepDescription}>
                Enter your email address and we'll send you a verification code
            </Text>

            <Input
                type="email"
                label="Email Address"
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                leftIcon="email"
                required
                variant="outlined"
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
            />

            <TouchableOpacity
                style={[styles.button, styles.primaryButton, isLoading && styles.buttonDisabled]}
                onPress={handleSendOTP}
                disabled={isLoading}
            >
                <MaterialCommunityIcons
                    name={isLoading ? "loading" : "send"}
                    size={20}
                    color="#FFFFFF"
                />
                <Text style={styles.buttonText}>
                    {isLoading ? 'Sending...' : 'Send Verification Code'}
                </Text>
            </TouchableOpacity>
        </View>
    );

    const renderOTPStep = () => (
        <View>
            <Text style={styles.stepTitle}>Enter Verification Code</Text>
            <Text style={styles.stepDescription}>
                We've sent a 6-digit code to {email}
            </Text>

            <View style={styles.otpContainer}>
                {otp.map((digit, index) => (
                    <TextInput
                        key={index}
                        ref={ref => {
                            if (ref) otpRefs.current[index] = ref;
                        }}
                        style={[
                            styles.otpInput,
                            digit && styles.otpInputFilled,
                        ]}
                        value={digit}
                        onChangeText={(text) => handleOTPChange(text.replace(/[^0-9]/g, ''), index)}
                        onKeyPress={({ nativeEvent }) => handleOTPKeyPress(nativeEvent.key, index)}
                        keyboardType="number-pad"
                        maxLength={1}
                        selectTextOnFocus
                        textContentType="oneTimeCode"
                        autoComplete="sms-otp"
                    />
                ))}
            </View>

            <View style={styles.timerContainer}>
                {timer > 0 ? (
                    <Text style={styles.timerText}>
                        Resend code in {formatTime(timer)}
                    </Text>
                ) : (
                    <TouchableOpacity
                        style={styles.resendButton}
                        onPress={handleResendOTP}
                        disabled={isLoading}
                    >
                        <MaterialCommunityIcons name="refresh" size={16} color={colors.primary} />
                        <Text style={styles.resendButtonText}>Resend Code</Text>
                    </TouchableOpacity>
                )}
            </View>

            <TouchableOpacity
                style={[styles.button, styles.primaryButton, isLoading && styles.buttonDisabled]}
                onPress={() => handleVerifyOTP()}
                disabled={isLoading || otp.some(digit => !digit)}
            >
                <MaterialCommunityIcons
                    name={isLoading ? "loading" : "check"}
                    size={20}
                    color="#FFFFFF"
                />
                <Text style={styles.buttonText}>
                    {isLoading ? 'Verifying...' : 'Verify Code'}
                </Text>
            </TouchableOpacity>
        </View>
    );

    const renderNewPasswordStep = () => (
        <View>
            <Text style={styles.stepTitle}>Create New Password</Text>
            <Text style={styles.stepDescription}>
                Enter your new password below
            </Text>

            <Input
                type="password"
                label="New Password"
                placeholder="Enter new password"
                value={newPassword}
                onChangeText={setNewPassword}
                leftIcon="lock"
                required
                variant="outlined"
                autoCapitalize="none"
                textContentType="newPassword"
                autoComplete="password-new"
            />

            <Input
                type="password"
                label="Confirm Password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                leftIcon="lock-check"
                required
                variant="outlined"
                autoCapitalize="none"
                textContentType="newPassword"
                autoComplete="password-new"
            />

            <TouchableOpacity
                style={[styles.button, styles.primaryButton, isLoading && styles.buttonDisabled]}
                onPress={handleResetPassword}
                disabled={isLoading}
            >
                <MaterialCommunityIcons
                    name={isLoading ? "loading" : "check-circle"}
                    size={20}
                    color="#FFFFFF"
                />
                <Text style={styles.buttonText}>
                    {isLoading ? 'Resetting...' : 'Reset Password'}
                </Text>
            </TouchableOpacity>
        </View>
    );

    const styles = StyleSheet.create({
        safeArea: {
            flex: 1,
            backgroundColor: colors.background,
        },
        themeSwitcherWrapper: {
            position: 'absolute',
            top: Platform.OS === 'ios' ? 50 : 20,
            right: 20,
            zIndex: 1000,
        },
        backButton: {
            position: 'absolute',
            top: Platform.OS === 'ios' ? 50 : 20,
            left: 20,
            zIndex: 1000,
            padding: 8,
        },
        mainContainer: {
            flex: 1,
        },
        scrollViewContainer: {
            flexGrow: 1,
        },
        contentContainer: {
            flex: 1,
            padding: spacing.xl,
            justifyContent: 'center',
        },
        headerContent: {
            opacity: isKeyboardVisible ? 0 : 1,
            height: isKeyboardVisible ? 0 : 'auto',
            marginBottom: isKeyboardVisible ? 0 : spacing.xl,
        },
        logo: {
            width: 80,
            height: 80,
            alignSelf: 'center',
            marginBottom: spacing.lg,
        },
        title: {
            fontSize: typography.fontSize.xl,
            fontFamily: typography.fontFamily.bold,
            color: colors.text,
            textAlign: 'center',
            marginBottom: spacing.md,
        },
        stepIndicator: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.xl,
            paddingHorizontal: spacing.md,
        },
        stepItem: {
            alignItems: 'center',
            flex: 1,
            position: 'relative',
        },
        stepCircle: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.surface,
            borderWidth: 2,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.xs,
        },
        stepCircleActive: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        stepCircleCompleted: {
            backgroundColor: colors.success || colors.primary,
            borderColor: colors.success || colors.primary,
        },
        stepLabel: {
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily.regular,
            color: colors.textSecondary,
        },
        stepLabelActive: {
            color: colors.text,
            fontFamily: typography.fontFamily.medium,
        },
        stepConnector: {
            position: 'absolute',
            top: 16,
            left: '60%',
            right: '-60%',
            height: 2,
            backgroundColor: colors.border,
        },
        stepConnectorCompleted: {
            backgroundColor: colors.success || colors.primary,
        },
        stepTitle: {
            fontSize: typography.fontSize.xl,
            fontFamily: typography.fontFamily.bold,
            color: colors.text,
            textAlign: 'center',
            marginBottom: spacing.md,
        },
        stepDescription: {
            fontSize: typography.fontSize.md,
            fontFamily: typography.fontFamily.regular,
            color: colors.textSecondary,
            textAlign: 'center',
            marginBottom: spacing.xl,
            lineHeight: 22,
        },
        otpContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: spacing.lg,
            paddingHorizontal: spacing.md,
        },
        otpInput: {
            width: 45,
            height: 55,
            borderWidth: 2,
            borderColor: colors.border,
            borderRadius: spacing.sm,
            backgroundColor: colors.surface,
            textAlign: 'center',
            fontSize: typography.fontSize.lg,
            fontFamily: typography.fontFamily.medium,
            color: colors.text,
        },
        otpInputFilled: {
            borderColor: colors.primary,
            backgroundColor: colors.primary + '10',
        },
        timerContainer: {
            alignItems: 'center',
            marginBottom: spacing.xl,
        },
        timerText: {
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily.regular,
            color: colors.textSecondary,
        },
        resendButton: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.sm,
        },
        resendButtonText: {
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily.medium,
            color: colors.primary,
            marginLeft: spacing.xs,
        },
        button: {
            borderRadius: spacing.sm,
            padding: spacing.md,
            marginBottom: spacing.md,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
        },
        primaryButton: {
            backgroundColor: colors.primary,
        },
        buttonDisabled: {
            opacity: 0.6,
        },
        buttonText: {
            color: '#FFFFFF',
            fontSize: typography.fontSize.md,
            fontFamily: typography.fontFamily.medium,
            marginLeft: spacing.sm,
        },
        backToLoginContainer: {
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: spacing.lg,
        },
        backToLoginText: {
            fontSize: typography.fontSize.md,
            fontFamily: typography.fontFamily.regular,
            color: colors.textSecondary,
        },
        backToLoginLink: {
            fontSize: typography.fontSize.md,
            fontFamily: typography.fontFamily.medium,
            color: colors.primary,
            marginLeft: spacing.xs,
        },
    });

    return (
        <SafeAreaView style={styles.safeArea}>
            <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
            >
                <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.themeSwitcherWrapper}>
                <ThemeSwitcher />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.mainContainer}
            >
                <ScrollView
                    style={styles.scrollViewContainer}
                    contentContainerStyle={styles.contentContainer}
                    bounces={false}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.headerContent}>
                        <Image
                            source={require('../../assets/splash-icon.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                        <Text style={styles.title}>Forgot Password?</Text>
                    </View>

                    {renderStepIndicator()}

                    <Animated.View
                        style={{
                            opacity: fadeAnim,
                            transform: [
                                {
                                    translateX: slideAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0, 0],
                                    }),
                                },
                            ],
                        }}
                    >
                        {currentStep === 'email' && renderEmailStep()}
                        {currentStep === 'otp' && renderOTPStep()}
                        {currentStep === 'newPassword' && renderNewPasswordStep()}
                    </Animated.View>

                    <View style={styles.backToLoginContainer}>
                        <Text style={styles.backToLoginText}>Remember your password?</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <Text style={styles.backToLoginLink}>Back to Login</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};