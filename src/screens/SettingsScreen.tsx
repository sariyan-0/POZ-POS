import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AppScreen, ListRow } from '../components/POSUI';
import { usePOS } from '../hooks/usePOS';
import { useRootNavigation } from '../navigation/AppNavigator';
import { useAppTheme } from '../theme';

export function SettingsScreen() {
  const { state, currentStaff, updateBusinessName } = usePOS();
  const navigation = useRootNavigation();
  const theme = useAppTheme();
  const [businessName, setBusinessName] = useState(state.settings.business.businessName);

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
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>Register</Text>
        <Text style={[styles.helper, { color: theme.colors.textMuted }]}>
          Signed in as {currentStaff?.name || 'Unknown staff'}.
        </Text>
      </View>

      <View style={{ backgroundColor: theme.colors.surface, borderRadius: 18, overflow: 'hidden' }}>
        <ListRow
          label="Security"
          icon="shield-lock-outline"
          onPress={() => navigation.navigate('SecuritySettings')}
        />
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
