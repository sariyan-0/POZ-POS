import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppScreen, ListRow } from '../components/POSUI';
import { usePOS } from '../hooks/usePOS';
import { apiClient } from '../services/api/ApiClient';
import { useRootNavigation } from '../navigation/AppNavigator';
import { useAppTheme } from '../theme';
export function SettingsScreen() {
  const { state, currentStaff, syncCatalog } = usePOS();
  const business = state.settings.business;
  const navigation = useRootNavigation();
  const theme = useAppTheme();
  const [name, setName] = useState(business.businessName);
  const [inclusive, setInclusive] = useState(
    business.pricesIncludeTax === true,
  );
  const [header, setHeader] = useState(business.receiptHeader ?? '');
  const [footer, setFooter] = useState(business.receiptFooter ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await apiClient.patch('/api/settings/operations', {
        expectedUpdatedAt: business.settingsUpdatedAt,
        name,
        pricesIncludeTax: inclusive,
        taxRegistrationNumber: business.taxRegistrationNumber,
        receiptHeader: header,
        receiptFooter: footer,
      });
      await syncCatalog();
      setMessage('Business settings saved across OneRegister.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  }
  const inputStyle = [
    styles.input,
    { color: theme.colors.text, borderColor: theme.colors.border },
  ];
  return (
    <AppScreen
      title="Settings"
      subtitle="Shared business settings and this register’s preferences."
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Business and receipts
        </Text>
        <Text style={{ color: theme.colors.textMuted }}>
          {business.country ?? 'CA'} · {business.currency}
        </Text>
        <TextInput
          accessibilityLabel="Business name"
          value={name}
          onChangeText={setName}
          style={inputStyle}
        />
        <View style={styles.toggle}>
          <Text style={{ color: theme.colors.text }}>Prices include tax</Text>
          <Switch
            value={inclusive}
            onValueChange={setInclusive}
            accessibilityLabel="Prices include tax"
          />
        </View>
        <TextInput
          accessibilityLabel="Receipt heading"
          placeholder="Receipt heading"
          placeholderTextColor={theme.colors.textMuted}
          value={header}
          onChangeText={setHeader}
          style={inputStyle}
        />
        <TextInput
          accessibilityLabel="Receipt footer"
          placeholder="Receipt footer"
          placeholderTextColor={theme.colors.textMuted}
          value={footer}
          onChangeText={setFooter}
          multiline
          style={inputStyle}
        />
        {message && (
          <Text accessibilityRole="alert" style={{ color: theme.colors.text }}>
            {message}
          </Text>
        )}
        <Pressable
          disabled={busy}
          accessibilityRole="button"
          onPress={() => save()}
          style={[styles.button, { backgroundColor: theme.colors.accent }]}
        >
          <Text style={{ color: theme.colors.accentText }}>
            {busy ? 'Saving…' : 'Save business settings'}
          </Text>
        </Pressable>
      </View>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={{ color: theme.colors.textMuted }}>
          Signed in as {currentStaff?.name ?? 'Staff'}
        </Text>
        <ListRow
          label="Register location"
          icon="map-marker-outline"
          onPress={() => navigation.navigate('Locations')}
        />
        <ListRow
          label="Taxes"
          icon="percent-outline"
          onPress={() => navigation.navigate('Taxes')}
        />
        <ListRow
          label="People and security"
          icon="shield-lock-outline"
          onPress={() => navigation.navigate('SecuritySettings')}
        />
        <ListRow
          label="Register connection"
          icon="link-variant"
          onPress={() => navigation.navigate('BackendSettings')}
        />
        <ListRow
          label="Appearance"
          icon="theme-light-dark"
          onPress={() =>
            navigation.navigate('MoreSection', { section: 'appearance' })
          }
        />
      </View>
    </AppScreen>
  );
}
const styles = StyleSheet.create({
  card: { padding: 20, gap: 12, borderWidth: 1, borderRadius: 12 },
  title: { fontSize: 18, fontWeight: '600' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  toggle: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  button: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
