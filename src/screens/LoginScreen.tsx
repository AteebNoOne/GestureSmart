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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { typography, spacing, ThemeType } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { NavigationProp } from '@react-navigation/native';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { Input } from '../components/Input';
import {
  responsiveHeight,
  responsiveWidth,
  responsiveFontSize,
} from 'react-native-responsive-dimensions';

interface LoginScreenProps {
  navigation: NavigationProp<any>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({
    email: "",
    password: ""
  });
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const { theme, colors } = useTheme();
  const [animatedValue] = useState(new Animated.Value(0));

  // Determine if using dark theme variant
  const isDarkTheme = theme === 'dark' || theme === 'blue' || theme === 'purple';

  // Animate hand gesture icon
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



  const handleLogin = async () => {
    setErrors({
      email: "",
      password: ""
    });

    try {
      if (email === "ateebnoone" && password === "123123") {
        navigation.navigate('MainApp');
      } else {
        setErrors(prev => ({
          ...prev,
          password: "Invalid email or password"
        }));
      }
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        password: "Invalid email or password"
      }));
    }
  };

  const handleDetectWithoutLogin = () => {
    navigation.navigate('Detection');
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
    buttonSection: {
      marginTop: responsiveHeight(1),
    },
    button: {
      borderRadius: responsiveHeight(4),
      paddingVertical: responsiveHeight(1.5),
      marginBottom: responsiveHeight(1),
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      height: responsiveHeight(6.5),
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    loginButton: {
      backgroundColor: colors.primary,
    },
    detectButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.secondary,
      marginTop: responsiveHeight(1),
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: responsiveFontSize(1.8),
      fontFamily: typography.fontFamily.medium,
      marginLeft: responsiveWidth(2),
    },
    detectButtonText: {
      color: colors.secondary,
    },
    signupContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginVertical: responsiveHeight(1),
    },
    signupText: {
      color: colors.textSecondary,
      fontSize: responsiveFontSize(1.7),
      fontFamily: typography.fontFamily.regular,
    },
    signupLink: {
      color: colors.primary,
      fontSize: responsiveFontSize(1.7),
      fontFamily: typography.fontFamily.medium,
      marginLeft: responsiveWidth(1),
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
            'rgba(56, 4, 64, 0.08)', // purple
    },
    themeDecorationBottom: {
      bottom: -responsiveHeight(15),
      right: -responsiveWidth(25),
      backgroundColor: theme === 'light' ? 'rgba(3, 4, 94, 0.02)' :
        theme === 'dark' ? 'rgba(255, 219, 77, 0.03)' :
          theme === 'blue' ? 'rgba(123, 223, 255, 0.04)' :
            'rgba(196, 179, 204, 0.04)', // purple
    }
  });

  // At the top of your component, add keyboard listeners
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

    // Clean up listeners when component unmounts
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Background decorations - themed */}
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

        {/* Form Section */}
        <View style={styles.formSection}>
          <View style={styles.inputContainer}>
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
          </View>

          <View style={styles.inputContainer}>
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
          </View>
        </View>

        {/* Button Section */}
        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={[styles.button, styles.loginButton]}
            onPress={handleLogin}
          >
            <MaterialCommunityIcons
              name="login"
              size={Math.round(responsiveFontSize(2.2))}
              color="#FFFFFF"
            />
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>

          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, styles.detectButton]}
            onPress={handleDetectWithoutLogin}
          >
            <MaterialCommunityIcons
              name="gesture-tap"
              size={Math.round(responsiveFontSize(2.2))}
              color={colors.secondary}
            />
            <Text style={[styles.buttonText, styles.detectButtonText]}>
              Try Gesture Detection
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};