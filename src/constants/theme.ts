export type ThemeType = 'light' | 'dark' | 'blue' | 'purple';

interface ColorPalette {
  primary: string;
  primaryLight: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  success: string;
  warning: string;
  card: string;
  shadow: string;
}

interface Typography {
  fontFamily: {
    regular: string;
    medium: string;
    bold: string;
    semibold: string;
  };
  fontSize: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
}

interface Spacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export const typography: Typography = {
  fontFamily: {
    regular: 'Inter_400Regular',  // Clean, modern font with excellent readability
    medium: 'Inter_500Medium',
    bold: 'Inter_700Bold',
    semibold: 'Inter_600SemiBold',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,  // Slightly increased for better visibility
    xl: 24,  // Increased for more impact
    xxl: 32,  // Larger headlines for emphasis
  },
};

export const spacing: Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const themes: Record<ThemeType, ColorPalette> = {
  light: {
    primary: '#03045e',
    primaryLight: '#e6e6ff',
    secondary: '#ffc300',
    background: '#ffffff',
    surface: '#f8f9fa',
    text: '#03045e',
    textSecondary: '#4a4b7c',
    border: '#d8d9eb',
    error: '#dc3545',
    success: '#28a745',
    warning: '#ffc300',
    card: '#ffffff',
    shadow: 'rgba(3, 4, 94, 0.1)',
  },
  dark: {
    primary: '#ffc300',
    primaryLight: '#03045e',
    secondary: '#ffdb4d',
    background: '#020318',
    surface: '#030426',
    text: '#ffffff',
    textSecondary: '#b3b3cc',
    border: '#1a1b3d',
    error: '#ff4d4d',
    success: '#4caf50',
    warning: '#ffd60a',
    card: '#030426',
    shadow: 'rgba(0, 0, 0, 0.3)',
  },
  blue: {
    primary: '#03045e',
    primaryLight: '#050982',
    secondary: '#ffc300',
    background: '#020318',
    surface: '#030426',
    text: '#ffffff',
    textSecondary: '#b3b3cc',
    border: '#1a1b3d',
    error: '#ff4d4d',
    success: '#4caf50',
    warning: '#ffc300',
    card: '#030426',
    shadow: 'rgba(3, 4, 94, 0.3)',
  },
  purple: {
    primary: '#03045e',
    primaryLight: '#380440',
    secondary: '#ffc300',
    background: '#1a0f2e',
    surface: '#251443',
    text: '#ffffff',
    textSecondary: '#c4b3cc',
    border: '#342058',
    error: '#ff4d4d',
    success: '#4caf50',
    warning: '#ffc300',
    card: '#251443',
    shadow: 'rgba(26, 15, 46, 0.3)',
  },
};