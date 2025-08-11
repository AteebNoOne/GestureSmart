import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContex';
import { themes, ThemeType } from '../constants/theme';

export const useTheme = () => {
  const { theme } = useContext(ThemeContext);
  return {
    theme,
    colors: themes[theme as ThemeType],
  };
};