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

export const Input = forwardRef<TextInput, InputProps>((props, ref) => {
  const {
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
  } = props;

  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Simple focus/blur handlers
  const handleFocus = (e: any) => {
    setIsFocused(true);
    if (rest.onFocus) {
      rest.onFocus(e);
    }
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (rest.onBlur) {
      rest.onBlur(e);
    }
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
      borderWidth: variant === 'outlined' ? 1 : variant === 'default' ? 1 : 0,
      borderRadius: spacing.sm,
      backgroundColor: variant === 'filled' ? colors.surface : 'transparent',
      borderColor: error ? colors.error : isFocused ? colors.primary : colors.border,
      overflow: 'hidden',
      minHeight: Platform.OS === 'ios' ? 44 : 48,
    },
    input: {
      flex: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      fontSize: typography.fontSize.md,
      fontFamily: typography.fontFamily.regular,
      color: colors.text,
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
    // Simple focus indicator
    focusIndicator: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: error ? colors.error : colors.primary,
      opacity: isFocused ? 1 : 0,
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

  // Determine accessibility properties based on input type
  const getAccessibilityProps = () => {
    const baseProps = {
      accessible: true,
      accessibilityRole: 'none' as const,
    };

    switch (type) {
      case 'email':
        return {
          ...baseProps,
          accessibilityLabel: `${label || 'Email'} input field. ${required ? 'Required.' : ''}`,
          accessibilityHint: 'Enter your email address'
        };
      case 'password':
        return {
          ...baseProps,
          accessibilityLabel: `${label || 'Password'} input field. ${required ? 'Required.' : ''}`,
          accessibilityHint: 'Enter your password. Double tap to show or hide password'
        };
      default:
        return {
          ...baseProps,
          accessibilityLabel: `${label || 'Text'} input field. ${required ? 'Required.' : ''}`
        };
    }
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
          blurOnSubmit={false}
          {...getAccessibilityProps()}
          {...rest}
        />

        {type === 'password' ? (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.icon}
            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons
              name={showPassword ? 'eye-off' : 'eye'}
              size={24}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        ) : renderIcon(rightIcon, onRightIconPress)}

        {variant === 'default' && (
          <View style={styles.focusIndicator} />
        )}
      </View>

      {error ? (
        <Text style={styles.errorText} accessibilityLabel={`Error: ${error}`}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hintText} accessibilityHint={hint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

Input.displayName = 'Input';