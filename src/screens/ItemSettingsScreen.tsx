import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRootNavigation } from '../navigation/AppNavigator';
import { useAppTheme } from '../theme';

const rows = [
  { key: 'all-items', label: 'All items', route: 'AllItems' as const },
  { key: 'modifiers', label: 'Modifiers', route: 'Modifiers' as const },
  { key: 'discounts', label: 'Discounts', route: 'Discounts' as const },
];

export function ItemSettingsScreen() {
  const navigation = useRootNavigation();
  const theme = useAppTheme();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Items</Text>
      </View>

      <View style={styles.list}>
        {rows.map(row => (
          <Pressable
            key={row.key}
            onPress={() => navigation.navigate(row.route)}
            style={[styles.row, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.rowLabel, { color: theme.colors.text }]}>{row.label}</Text>
            <MaterialDesignIcons color={theme.colors.textMuted} name="chevron-right" size={28} />
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 26,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  list: {
    paddingHorizontal: 22,
  },
  row: {
    minHeight: 78,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
});
