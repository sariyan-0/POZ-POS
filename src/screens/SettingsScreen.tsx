import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AppScreen } from '../components/POSUI';
import { usePOS } from '../hooks/usePOS';
import { useAppTheme } from '../theme';
import { percentToLabel } from '../utils/format';

export function SettingsScreen() {
  const { state, updateBusinessName, updateTaxRate } = usePOS();
  const theme = useAppTheme();
  const [businessName, setBusinessName] = useState(state.settings.business.businessName);
  const [taxRate, setTaxRate] = useState(
    state.settings.business.defaultTaxRate.toString(),
  );

  return (
    <AppScreen
      title="Settings"
      subtitle="Local business configuration for the mock POS.">
      <View style={[styles.block, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>Business name</Text>
        <TextInput
          value={businessName}
          onChangeText={setBusinessName}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surfaceMuted,
            },
          ]}
        />
        <Text style={[styles.helper, { color: theme.colors.textMuted }]}>
          Currency: {state.settings.business.currency}
        </Text>
        <Text style={[styles.action, { color: theme.colors.text }]} onPress={() => updateBusinessName(businessName.trim())}>
          Save business
        </Text>
      </View>

      <View style={[styles.block, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>Default tax percentage</Text>
        <TextInput
          value={taxRate}
          onChangeText={setTaxRate}
          keyboardType="numeric"
          style={[
            styles.input,
            {
              color: theme.colors.text,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surfaceMuted,
            },
          ]}
        />
        <Text style={[styles.helper, { color: theme.colors.textMuted }]}>
          Current default: {percentToLabel(state.settings.business.defaultTaxRate)}
        </Text>
        <Text style={[styles.action, { color: theme.colors.text }]} onPress={() => updateTaxRate(Number.parseFloat(taxRate || '0') || 0)}>
          Save tax rate
        </Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: 18,
    padding: 18,
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  helper: {
    fontSize: 13,
  },
  action: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
});
