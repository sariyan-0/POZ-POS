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
        background: '#10191E',
        header: '#0E1C21',
        surface: '#18252B',
        surfaceMuted: '#24343C',
        surfaceStrong: '#30434D',
        border: '#3B4D57',
        divider: '#33454F',
        text: '#F2F6F7',
        textMuted: '#B1C0C7',
        accent: '#85D4C8',
        accentText: '#10322F',
        accentSoft: '#23413E',
        success: '#7BE0AE',
        warning: '#F0D17A',
        danger: '#F57C7C',
        overlay: 'rgba(0,0,0,0.42)',
        tabActive: '#23413E',
        rail: '#243B42',
        railText: '#F6F6F7',
        badge: '#F59B38',
      }
    : {
        background: '#F5F7F8',
        header: '#17282C',
        surface: '#FFFFFF',
        surfaceMuted: '#EEF2F4',
        surfaceStrong: '#E0E7EB',
        border: '#D9E1E5',
        divider: '#D9E1E5',
        text: '#202A30',
        textMuted: '#58666F',
        accent: '#086E63',
        accentText: '#FFFFFF',
        accentSoft: '#DDF2EE',
        success: '#2C7C50',
        warning: '#9F7A29',
        danger: '#A13E3E',
        overlay: 'rgba(0,0,0,0.36)',
        tabActive: '#E3F1EF',
        rail: '#48636B',
        railText: '#FFFFFF',
        badge: '#F59B38',
      };

  return {
    isDark,
    colors,
    radius: {
      sm: 8,
      md: 8,
      lg: 12,
      xl: 16,
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
