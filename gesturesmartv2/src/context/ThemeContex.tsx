import React, { createContext, useState, useContext } from 'react';
import { ThemeType } from '../constants/theme';
import { StatusBar } from 'expo-status-bar';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: () => { },
});

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme: ThemeType;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialTheme,
}) => {
  const [theme, setTheme] = useState<ThemeType>(initialTheme);

  // Determine the status bar style and background color
  const statusBarStyle = theme === 'light' ? 'dark' : 'light';
  const statusBarBackgroundColor = theme === 'light' ? 'transparent' : theme === "dark" ? 'black' : theme;
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <StatusBar style={statusBarStyle} backgroundColor={statusBarBackgroundColor} />
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => useContext(ThemeContext);