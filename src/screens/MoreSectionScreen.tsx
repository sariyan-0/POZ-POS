import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { AppScreen } from '../components/POSUI';
import { RootStackParamList } from '../navigation/AppNavigator';
import { usePOS } from '../hooks/usePOS';
import { AppearanceMode, TaxDefinition } from '../models/pos';
import { DeveloperTerminalPanel } from './DeveloperTerminalPanel';
import { useAppStripeTerminal } from '../terminal/StripeTerminalProvider';
import { useAppTheme } from '../theme';

type MoreSectionRoute = RouteProp<RootStackParamList, 'MoreSection'>;

export function MoreSectionScreen() {
  const { params } = useRoute<MoreSectionRoute>();
  const { state, updateAppearanceMode, upsertTaxDefinition, deleteTaxDefinition } = usePOS();
  const theme = useAppTheme();
  const terminal = useAppStripeTerminal();
  const [taxName, setTaxName] = useState('');
  const [taxValue, setTaxValue] = useState('');
  const [editingTaxId, setEditingTaxId] = useState<string | null>(null);

  const editingTax = editingTaxId
    ? state.settings.business.taxDefinitions.find(tax => tax.id === editingTaxId)
    : undefined;

  function createTaxId(name: string) {
    const baseId = `tax-${
      name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'custom'
    }`;
    let nextId = baseId;
    let suffix = 2;
    while (state.settings.business.taxDefinitions.some(tax => tax.id === nextId)) {
      nextId = `${baseId}-${suffix}`;
      suffix += 1;
    }
    return nextId;
  }

  function resetTaxForm() {
    setTaxName('');
    setTaxValue('');
    setEditingTaxId(null);
  }

  function startEditingTax(tax: TaxDefinition) {
    setEditingTaxId(tax.id);
    setTaxName(tax.name);
    setTaxValue(String(tax.rate));
  }

  function saveTax() {
    const trimmedName = taxName.trim();
    if (!trimmedName) {
      return;
    }

    upsertTaxDefinition({
      id: editingTax?.id ?? createTaxId(trimmedName),
      name: trimmedName,
      rate: Math.max(0, Number.parseFloat(taxValue || '0') || 0),
      enabled: editingTax?.enabled ?? true,
    });
    resetTaxForm();
  }

  if (params.section === 'hardware') {
    return (
      <AppScreen
        hideStripeSetupNotice
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
        subtitle="Create and manage the tax types used during checkout.">
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 18,
            padding: 18,
            gap: 12,
          }}>
          <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: '800' }}>
            Tax types
          </Text>
          <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
            Taxable items use the tax types you create here. There is no separate default tax to manage.
          </Text>
          {state.settings.business.taxDefinitions.map(tax => (
            <View
              key={tax.id}
              style={{
                minHeight: 76,
                borderWidth: 1,
                borderRadius: 16,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surfaceMuted,
                paddingHorizontal: 14,
                paddingVertical: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700' }}>
                  {tax.name}
                </Text>
                <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
                  {tax.rate}% {tax.enabled ? 'enabled' : 'disabled'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => startEditingTax(tax)}
                  style={{
                    minHeight: 40,
                    minWidth: 62,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 12,
                  }}>
                  <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '800' }}>
                    Edit
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (editingTaxId === tax.id) {
                      resetTaxForm();
                    }
                    deleteTaxDefinition(tax.id);
                  }}
                  style={{
                    minHeight: 40,
                    minWidth: 72,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.colors.danger,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 12,
                  }}>
                  <Text style={{ color: theme.colors.danger, fontSize: 14, fontWeight: '800' }}>
                    Delete
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
          {!state.settings.business.taxDefinitions.length ? (
            <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
              No tax types yet. Add one below when you are ready.
            </Text>
          ) : null}
          <TextInput
            value={taxName}
            onChangeText={setTaxName}
            placeholder="Tax name"
            placeholderTextColor={theme.colors.textMuted}
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
          <TextInput
            value={taxValue}
            onChangeText={setTaxValue}
            placeholder="Tax percentage"
            placeholderTextColor={theme.colors.textMuted}
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
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={saveTax}
              style={{
                minHeight: 50,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 14,
                backgroundColor: theme.colors.accent,
                flex: 1,
              }}>
              <Text style={{ color: theme.colors.accentText, fontSize: 15, fontWeight: '800' }}>
                {editingTax ? 'Save tax type' : 'Add tax type'}
              </Text>
            </Pressable>
            {editingTax ? (
              <Pressable
                onPress={resetTaxForm}
                style={{
                  minHeight: 50,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 14,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surfaceMuted,
                }}>
                <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '800' }}>
                  Cancel
                </Text>
              </Pressable>
            ) : null}
          </View>
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
