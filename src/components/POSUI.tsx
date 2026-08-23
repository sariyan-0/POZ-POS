import React, { PropsWithChildren } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Product } from '../models/pos';
import { useAppStripeTerminal } from '../terminal/StripeTerminalProvider';
import { useAppTheme } from '../theme';

type IconName = React.ComponentProps<typeof MaterialDesignIcons>['name'];

function getBatteryTone(
  level: number,
  status: ReturnType<typeof useAppStripeTerminal>['batteryStatus'],
  colors: ReturnType<typeof useAppTheme>['colors'],
) {
  if (status === 'critical' || level <= 10) {
    return colors.danger;
  }

  if (status === 'low' || level <= 25) {
    return colors.warning;
  }

  return colors.success;
}

function ReaderBatteryMeter({
  level,
  status,
}: {
  level: number;
  status: ReturnType<typeof useAppStripeTerminal>['batteryStatus'];
}) {
  const theme = useAppTheme();
  const fillColor = getBatteryTone(level, status, theme.colors);

  return (
    <View
      accessibilityLabel={`Reader battery ${level}%`}
      style={styles.readerBatteryWrap}>
      <View style={[styles.readerBatteryShell, { borderColor: theme.colors.border }]}>
        <View
          style={[
            styles.readerBatteryFill,
            {
              backgroundColor: fillColor,
              width: `${level}%`,
            },
          ]}
        />
      </View>
      <View style={[styles.readerBatteryTip, { backgroundColor: theme.colors.border }]} />
      <Text style={[styles.readerBatteryText, { color: theme.colors.textMuted }]}>
        {level}%
      </Text>
    </View>
  );
}

export function AppScreen({
  title,
  subtitle,
  children,
  rightSlot,
  contentStyle,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}>) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={[
        styles.screenContent,
        { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 28 },
        contentStyle,
      ]}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={[styles.screenTitle, { color: theme.colors.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.screenSubtitle, { color: theme.colors.textMuted }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {rightSlot}
      </View>
      {children}
    </ScrollView>
  );
}

export function CheckoutHeader() {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const terminal = useAppStripeTerminal();

  const readerTone =
    terminal.isReaderConnected
      ? theme.colors.success
      : terminal.connectionStatus === 'connecting' ||
          terminal.connectionStatus === 'reconnecting' ||
          terminal.discoveryStatus === 'discovering'
        ? theme.colors.warning
        : terminal.connectionError || terminal.initializationError
          ? theme.colors.danger
          : theme.colors.textMuted;
  const readerLabel =
    terminal.isReaderConnected
      ? 'Reader connected'
      : terminal.connectionStatus === 'connecting' ||
          terminal.connectionStatus === 'reconnecting' ||
          terminal.discoveryStatus === 'discovering'
        ? 'Reader connecting'
        : terminal.connectionError || terminal.initializationError
          ? 'Reader error'
          : 'Reader not connected';
  const readerIconName: IconName =
    terminal.connectionError || terminal.initializationError
      ? 'exclamation-thick'
      : terminal.isReaderConnected
        ? 'checkbox-blank-outline'
        : terminal.connectionStatus === 'connecting' ||
            terminal.connectionStatus === 'reconnecting' ||
            terminal.discoveryStatus === 'discovering'
          ? 'progress-wrench'
          : 'shape-outline';
  const readerIconBackground =
    terminal.connectionError || terminal.initializationError
      ? theme.colors.badge
      : terminal.isReaderConnected
        ? theme.colors.surface
        : 'transparent';
  const readerBatteryLevel =
    terminal.isReaderConnected && terminal.batteryLevel !== null
      ? terminal.batteryLevel
      : null;

  return (
    <View
      style={[
        styles.checkoutHeader,
        {
          paddingTop: insets.top + 8,
          backgroundColor: theme.colors.header,
        },
      ]}>
      <View style={styles.headerUtilityRow}>
        <Pressable
          onPress={() => navigation.navigate('MoreSection', { section: 'hardware' })}
          style={[
            styles.readerStatusButton,
            {
              borderColor: theme.colors.divider,
              backgroundColor: theme.colors.surface,
            },
          ]}>
          <View
            style={[
              styles.readerStatusIconWrap,
              {
                backgroundColor: readerIconBackground,
              },
            ]}
          >
            <MaterialDesignIcons
              color={
                terminal.connectionError || terminal.initializationError
                  ? theme.colors.railText
                  : readerTone
              }
              name={readerIconName}
              size={20}
            />
          </View>
          <Text style={[styles.readerStatusLabel, { color: theme.colors.text }]}>
            {readerLabel}
          </Text>
          {readerBatteryLevel !== null ? (
            <View style={styles.readerBatterySlot}>
              <ReaderBatteryMeter
                level={readerBatteryLevel}
                status={terminal.batteryStatus}
              />
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

export function SegmentedTabs({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: string; label: string }>;
  value: string;
  onChange: (nextValue: string) => void;
}) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.segmentedContainer,
        {
          backgroundColor: theme.colors.surfaceStrong,
          borderColor: theme.colors.border,
        },
      ]}>
      {options.map(option => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[
              styles.segmentButton,
              selected
                ? {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    shadowColor: '#000000',
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 1,
                  }
                : undefined,
            ]}>
            <Text
              style={[
                styles.segmentLabel,
                { color: selected ? theme.colors.text : theme.colors.textMuted },
              ]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SearchRow({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (nextValue: string) => void;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.searchRow,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.divider,
          borderBottomColor: theme.colors.divider,
        },
      ]}>
      <MaterialDesignIcons color={theme.colors.text} name="magnify" size={26} />
      <TextInput
        placeholder="Search"
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.searchInput, { color: theme.colors.text }]}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

export function RailIconColumn() {
  const theme = useAppTheme();
  const icons: IconName[] = [
    'archive-outline',
    'gift-outline',
    'tag-heart-outline',
    'ticket-percent-outline',
    'notebook-outline',
    'calendar-blank-outline',
  ];
  return (
    <View style={[styles.rail, { backgroundColor: theme.colors.rail }]}>
      {icons.map(icon => (
        <MaterialDesignIcons
          key={icon}
          color={theme.colors.railText}
          name={icon}
          size={28}
          style={styles.railIcon}
        />
      ))}
    </View>
  );
}

export function ListRow({
  icon,
  label,
  rightLabel,
  onPress,
  showChevron = true,
  compact = false,
  thumbnail,
  tone = 'default',
}: {
  icon?: IconName;
  label: string;
  rightLabel?: string;
  onPress?: () => void;
  showChevron?: boolean;
  compact?: boolean;
  thumbnail?: React.ReactNode;
  tone?: 'default' | 'muted';
}) {
  const theme = useAppTheme();
  const content = (
    <View
      style={[
        styles.listRow,
        {
          minHeight: compact ? 58 : 64,
          backgroundColor:
            tone === 'muted' ? theme.colors.surfaceMuted : theme.colors.surface,
          borderBottomColor: theme.colors.divider,
        },
      ]}>
      <View style={styles.listRowLeft}>
        {thumbnail}
        {!thumbnail && icon ? (
          <View
            style={[
              styles.rowIconHolder,
              { backgroundColor: theme.colors.surfaceMuted },
            ]}>
            <MaterialDesignIcons color={theme.colors.text} name={icon} size={24} />
          </View>
        ) : null}
        <Text style={[styles.listRowLabel, { color: theme.colors.text }]}>{label}</Text>
      </View>
      <View style={styles.listRowRight}>
        {rightLabel ? (
          <Text style={[styles.listRowPrice, { color: theme.colors.text }]}>
            {rightLabel}
          </Text>
        ) : null}
        {showChevron ? (
          <MaterialDesignIcons
            color={theme.colors.textMuted}
            name="chevron-right"
            size={28}
          />
        ) : null}
      </View>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

export function Thumbnail({ product }: { product: Product }) {
  const theme = useAppTheme();
  if (product.imageUri) {
    return <Image source={{ uri: product.imageUri }} style={styles.thumbnailImage} />;
  }

  return (
    <View
      style={[
        styles.thumbnailFallback,
        { backgroundColor: theme.colors.surfaceStrong },
      ]}>
      <Text style={[styles.thumbnailText, { color: theme.colors.text }]}>
        {product.imagePlaceholder || 'PO'}
      </Text>
    </View>
  );
}

export function PrimaryPillButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.primaryPillButton,
        { backgroundColor: theme.colors.accent },
        { opacity: disabled ? 0.45 : 1 },
        style,
      ]}>
      <Text style={[styles.primaryPillLabel, { color: theme.colors.accentText }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function EmptyNotice({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.emptyWrap}>
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: theme.colors.textMuted }]}>{body}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: 16,
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  screenTitle: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  screenSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  checkoutHeader: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerUtilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readerStatusButton: {
    flex: 1,
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readerStatusIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readerStatusLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  readerBatterySlot: {
    flex: 1,
    alignItems: 'flex-end',
  },
  readerBatteryWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 2,
  },
  readerBatteryShell: {
    width: 24,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 1,
  },
  readerBatteryFill: {
    height: '100%',
    borderRadius: 2,
  },
  readerBatteryTip: {
    width: 2,
    height: 6,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  readerBatteryText: {
    fontSize: 11,
    fontWeight: '800',
  },
  segmentedContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 2,
  },
  segmentButton: {
    flex: 1,
    minHeight: 62,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 72,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 18,
  },
  rail: {
    width: 54,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 18,
  },
  railIcon: {
    marginVertical: 3,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  listRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowIconHolder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listRowLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  listRowPrice: {
    fontSize: 16,
    fontWeight: '500',
  },
  thumbnailImage: {
    width: 62,
    height: 62,
    borderRadius: 2,
    resizeMode: 'cover',
  },
  thumbnailFallback: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
  },
  thumbnailText: {
    fontSize: 18,
    fontWeight: '800',
  },
  primaryPillButton: {
    minHeight: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryPillLabel: {
    fontSize: 18,
    fontWeight: '800',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyBody: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
});
