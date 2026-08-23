import { DarkTheme, DefaultTheme, Theme } from '@react-navigation/native';
import { useColorScheme } from 'react-native';

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
  const isDark = useColorScheme() === 'dark';

  const colors = isDark
    ? {
        background: '#0C0C0D',
        header: '#000000',
        surface: '#151516',
        surfaceMuted: '#252527',
        surfaceStrong: '#303033',
        border: '#3B3B3F',
        divider: '#2C2C2F',
        text: '#F6F6F7',
        textMuted: '#AAAAAE',
        accent: '#FFFFFF',
        accentText: '#111214',
        accentSoft: '#29292B',
        success: '#7BE0AE',
        warning: '#F0D17A',
        danger: '#F57C7C',
        overlay: 'rgba(0,0,0,0.42)',
        tabActive: '#232326',
        rail: '#323236',
        railText: '#F6F6F7',
        badge: '#F59B38',
      }
    : {
        background: '#F3F3F5',
        header: '#050505',
        surface: '#FFFFFF',
        surfaceMuted: '#F2F2F4',
        surfaceStrong: '#EBEBEE',
        border: '#DEDEE2',
        divider: '#D6D6DB',
        text: '#111214',
        textMuted: '#6E7177',
        accent: '#121212',
        accentText: '#FFFFFF',
        accentSoft: '#F0F0F2',
        success: '#2F8B5E',
        warning: '#9F7A29',
        danger: '#A13E3E',
        overlay: 'rgba(0,0,0,0.36)',
        tabActive: '#EFEFF1',
        rail: '#6F6F72',
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
