import { DarkTheme, DefaultTheme, Theme } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import { usePOS } from '../hooks/usePOS';

export interface AppTheme {
  isDark: boolean;
  colors: {
    background: string;
    header: string;
    surface: string;
    surfaceMuted: string;
    surfaceStrong: string;
    border: string;
    divider: string;
    text: string;
    textMuted: string;
    accent: string;
    accentText: string;
    accentSoft: string;
    success: string;
    warning: string;
    danger: string;
    overlay: string;
    tabActive: string;
    rail: string;
    railText: string;
    badge: string;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    pill: number;
  };
  spacing: (unit: number) => number;
  navigationTheme: Theme;
}

export function useAppTheme(): AppTheme {
  const systemColorScheme = useColorScheme();
  const { state } = usePOS();
  const appearanceMode = state.settings.appearanceMode;
  const isDark =
    appearanceMode === 'dark'
      ? true
      : appearanceMode === 'light'
        ? false
        : systemColorScheme === 'dark';

  const colors = isDark
    ? {
        background: '#0C1410',
        header: '#08100C',
        surface: '#131D18',
        surfaceMuted: '#1D2923',
        surfaceStrong: '#25332C',
        border: '#33453B',
        divider: '#29382F',
        text: '#F1F7F3',
        textMuted: '#9BAB9F',
        accent: '#C9F2D9',
        accentText: '#10251A',
        accentSoft: '#20372B',
        success: '#7BE0AE',
        warning: '#F0D17A',
        danger: '#F57C7C',
        overlay: 'rgba(0,0,0,0.42)',
        tabActive: '#203129',
        rail: '#30483B',
        railText: '#F6F6F7',
        badge: '#F59B38',
      }
    : {
        background: '#F3F6F2',
        header: '#14271D',
        surface: '#FEFFFC',
        surfaceMuted: '#EEF3EE',
        surfaceStrong: '#E4ECE5',
        border: '#D8E1D8',
        divider: '#DDE5DD',
        text: '#17211C',
        textMuted: '#66736B',
        accent: '#173D2B',
        accentText: '#F5FFF8',
        accentSoft: '#DDEDE3',
        success: '#2C7C50',
        warning: '#9F7A29',
        danger: '#A13E3E',
        overlay: 'rgba(0,0,0,0.36)',
        tabActive: '#E4EEE6',
        rail: '#4C6356',
        railText: '#FFFFFF',
        badge: '#F59B38',
      };

  return {
    isDark,
    colors,
    radius: {
      sm: 8,
      md: 14,
      lg: 18,
      xl: 24,
      pill: 999,
    },
    spacing: unit => unit * 4,
    navigationTheme: {
      ...(isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
        background: colors.background,
        card: colors.surface,
        border: colors.border,
        primary: colors.accent,
        text: colors.text,
      },
    },
  };
}
