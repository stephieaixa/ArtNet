import { Platform } from 'react-native';

// On web the app banner + browser chrome already provides top spacing
export const HEADER_TOP = Platform.OS === 'web' ? 16 : 56;

export const COLORS = {
  primary: '#6C3CE1',       // purple - main brand color
  primaryLight: '#9B6DFF',
  primaryDark: '#4A1FA8',
  secondary: '#FF6B35',     // orange - accent (energy, arts)
  secondaryLight: '#FF9A6C',
  background: '#F8F7FF',
  surface: '#FFFFFF',
  surfaceElevated: '#F0EDFF',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  white: '#FFFFFF',
  black: '#000000',
  // Status colors
  pending: '#F59E0B',
  viewed: '#3B82F6',
  shortlisted: '#8B5CF6',
  hired: '#10B981',
  rejected: '#EF4444',
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 19,
    xl: 22,
    xxl: 28,
    xxxl: 34,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};
