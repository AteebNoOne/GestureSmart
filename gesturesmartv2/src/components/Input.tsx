import React, { forwardRef, useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  StyleProp,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { typography, spacing } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

export type InputVariant = 'default' | 'filled' | 'outlined';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: string;
  rightIcon?: string;
  variant?: InputVariant;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<ViewStyle>;
  required?: boolean;
  onRightIconPress?: () => void;
  onLeftIconPress?: () => void;
  type?: 'text' | 'email' | 'password' | 'number';
}

export const Input = forwardRef<TextInput, InputProps>(({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  variant = 'default',
  containerStyle,
  inputStyle,
  required,
  onRightIconPress,
  onLeftIconPress,
  type = 'text',
  value,
  onChangeText,
  placeholder,
  ...rest
}, ref) => {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Animation for focus effect
  const [focusAnim] = useState(new Animated.Value(0));

  const handleFocus = () => {
    setIsFocused(true);
    Animated.timing(focusAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    Animated.timing(focusAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const styles = StyleSheet.create({
    container: {
      marginBottom: spacing.md,
    },
    labelContainer: {
      flexDirection: 'row',
      marginBottom: spacing.xs,
    },
    label: {
      fontSize: typography.fontSize.sm,
      fontFamily: typography.fontFamily.medium,
      color: colors.text,
    },
    required: {
      color: colors.error,
      marginLeft: spacing.xs,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: variant === 'outlined' ? 1 : 0,
      borderRadius: spacing.sm,
      backgroundColor: variant === 'filled' ? colors.surface : 'transparent',
      borderColor: error ? colors.error : isFocused ? colors.primary : colors.border,
      overflow: 'hidden',
    },
    input: {
      flex: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      fontSize: typography.fontSize.md,
      fontFamily: typography.fontFamily.regular,
      color: colors.text,
      ...Platform.select({
        ios: {
          minHeight: 44,
        },
        android: {
          minHeight: 48,
        },
      }),
    },
    icon: {
      padding: spacing.sm,
      color: error ? colors.error : isFocused ? colors.primary : colors.textSecondary,
    },
    errorText: {
      color: colors.error,
      fontSize: typography.fontSize.sm,
      fontFamily: typography.fontFamily.regular,
      marginTop: spacing.xs,
    },
    hintText: {
      color: colors.textSecondary,
      fontSize: typography.fontSize.sm,
      fontFamily: typography.fontFamily.regular,
      marginTop: spacing.xs,
    },
    focusLine: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: error ? colors.error : colors.primary,
      transform: [{
        scaleX: focusAnim,
      }],
    },
  });

  const getKeyboardType = () => {
    switch (type) {
      case 'email':
        return 'email-address';
      case 'number':
        return 'numeric';
      default:
        return 'default';
    }
  };

  const renderIcon = (icon?: string, onPress?: () => void) => {
    if (!icon) return null;

    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={!onPress}
        style={styles.icon}
      >
        <MaterialCommunityIcons
          name={icon as any}
          size={24}
          color={error ? colors.error : isFocused ? colors.primary : colors.textSecondary}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <View style={styles.labelContainer}>
          <Text style={styles.label}>{label}</Text>
          {required && <Text style={styles.required}>*</Text>}
        </View>
      )}

      <View style={styles.inputContainer}>
        {renderIcon(leftIcon, onLeftIconPress)}

        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, inputStyle]}
          onFocus={handleFocus}
          onBlur={handleBlur}
          keyboardType={getKeyboardType()}
          secureTextEntry={type === 'password' && !showPassword}
          autoCapitalize={type === 'email' ? 'none' : 'sentences'}
          autoCorrect={type === 'password' ? false : true}
          {...rest}
        />

        {type === 'password' ? (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.icon}
          >
            <MaterialCommunityIcons
              name={showPassword ? 'eye-off' : 'eye'}
              size={24}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        ) : renderIcon(rightIcon, onRightIconPress)}

        {variant === 'default' && (
          <Animated.View style={styles.focusLine} />
        )}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
});

Input.displayName = 'Input';