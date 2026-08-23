import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { AppScreen } from '../components/POSUI';
import { RootStackParamList } from '../navigation/AppNavigator';
import { usePOS } from '../hooks/usePOS';
import { AppearanceMode } from '../models/pos';
import { DeveloperTerminalPanel } from './DeveloperTerminalPanel';
import { useAppStripeTerminal } from '../terminal/StripeTerminalProvider';
import { useAppTheme } from '../theme';
import { percentToLabel } from '../utils/format';

type MoreSectionRoute = RouteProp<RootStackParamList, 'MoreSection'>;

export function MoreSectionScreen() {
  const { params } = useRoute<MoreSectionRoute>();
  const { state, updateTaxRate, updateAppearanceMode } = usePOS();
  const theme = useAppTheme();
  const terminal = useAppStripeTerminal();
  const [taxRate, setTaxRate] = useState(
    state.settings.business.defaultTaxRate.toString(),
  );

  if (params.section === 'hardware') {
    return (
      <AppScreen
        title="Readers"
        subtitle="Manage Stripe Terminal readers, Tap to Pay, and terminal locations.">
        <DeveloperTerminalPanel />
      </AppScreen>
    );
  }

  if (params.section === 'taxes') {
    return (
      <AppScreen
        title="Taxes"
        subtitle="Configure the default tax behavior used during checkout.">
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 18,
            padding: 18,
            gap: 10,
          }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Default tax percentage
          </Text>
          <TextInput
            value={taxRate}
            onChangeText={setTaxRate}
            keyboardType="numeric"
            style={{
              minHeight: 52,
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 14,
              fontSize: 16,
              color: theme.colors.text,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surfaceMuted,
            }}
          />
          <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
            Current default: {percentToLabel(state.settings.business.defaultTaxRate)}
          </Text>
          <Text style={{ color: theme.colors.text, lineHeight: 22 }}>
            Applied to taxable items and custom amounts during checkout.
          </Text>
          <Pressable
            onPress={() => updateTaxRate(Number.parseFloat(taxRate || '0') || 0)}
            style={{
              minHeight: 50,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 6,
              paddingHorizontal: 14,
              backgroundColor: theme.colors.accent,
            }}>
            <Text style={{ color: theme.colors.accentText, fontSize: 15, fontWeight: '800' }}>
              Save tax rate
            </Text>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  if (params.section === 'appearance') {
    const options: Array<{
      key: AppearanceMode;
      label: string;
      body: string;
    }> = [
      {
        key: 'system',
        label: 'Match device',
        body: 'Follow the phone or tablet light and dark setting automatically.',
      },
      {
        key: 'light',
        label: 'Light',
        body: 'Keep the register bright all day, regardless of device theme.',
      },
      {
        key: 'dark',
        label: 'Dark',
        body: 'Use the darker register theme all the time.',
      },
    ];

    return (
      <AppScreen
        title="Appearance"
        subtitle="Choose how this register should look for staff on this device.">
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 18,
            padding: 18,
            gap: 12,
          }}>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: 12,
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: 0.8,
            }}>
            Theme
          </Text>
          {options.map(option => {
            const selected = state.settings.appearanceMode === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => updateAppearanceMode(option.key)}
                style={{
                  borderWidth: 1,
                  borderRadius: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  gap: 6,
                  backgroundColor: selected
                    ? theme.colors.surfaceMuted
                    : theme.colors.background,
                  borderColor: selected ? theme.colors.accent : theme.colors.border,
                }}>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: 16,
                    fontWeight: '800',
                  }}>
                  {option.label}
                </Text>
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    lineHeight: 20,
                  }}>
                  {option.body}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </AppScreen>
    );
  }

  const content =
    {
      title: 'Developer',
      lines: [
        'Terminal diagnostics are available from the Readers screen.',
        'Backend connectivity is configurable from Backend / Server settings.',
        `Stripe Terminal status: ${terminal.status}`,
      ],
    };

  return (
    <AppScreen title={content.title}>
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: 18,
          padding: 18,
          gap: 10,
        }}>
        {content.lines.map(line => (
          <Text key={line} style={{ color: theme.colors.text, lineHeight: 22 }}>
            {line}
          </Text>
        ))}
      </View>
    </AppScreen>
  );
}
