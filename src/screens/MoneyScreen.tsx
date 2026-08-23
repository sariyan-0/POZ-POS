import React from 'react';
import { Text, View } from 'react-native';
import { AppScreen } from '../components/POSUI';
import { useAppTheme } from '../theme';

export function MoneyScreen() {
  const theme = useAppTheme();

  return (
    <AppScreen
      title="Money"
      subtitle="This area is reserved for future money tools and settlement views.">
      <View
        style={{
          borderRadius: 18,
          backgroundColor: theme.colors.surface,
          padding: 18,
          gap: 8,
        }}>
        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>
          Not configured yet
        </Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
          No banking or payout functionality is enabled in this mock build yet.
        </Text>
      </View>
    </AppScreen>
  );
}
