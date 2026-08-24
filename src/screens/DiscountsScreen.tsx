import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePOS } from '../hooks/usePOS';
import { useRootNavigation } from '../navigation/AppNavigator';
import { useAppTheme } from '../theme';
import { formatCurrency } from '../utils/format';

export function DiscountsScreen() {
  const navigation = useRootNavigation();
  const theme = useAppTheme();
  const { state } = usePOS();
  const [search, setSearch] = useState('');

  const filteredDiscounts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return state.discounts;
    }

    return state.discounts.filter(discount => discount.name.toLowerCase().includes(query));
  }, [search, state.discounts]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.headerButton, { backgroundColor: theme.colors.surfaceMuted }]}>
          <MaterialDesignIcons color={theme.colors.text} name="arrow-left" size={28} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Discounts</Text>
        <Pressable
          onPress={() => navigation.navigate('DiscountEditor')}
          style={[styles.addButton, { backgroundColor: theme.colors.text }]}>
          <MaterialDesignIcons color={theme.colors.surface} name="plus" size={30} />
        </Pressable>
      </View>

      <View
        style={[
          styles.searchWrap,
          { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
        ]}>
        <MaterialDesignIcons color={theme.colors.text} name="magnify" size={28} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search"
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.searchInput, { color: theme.colors.text }]}
        />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {filteredDiscounts.map(discount => (
          <Pressable
            key={discount.id}
            onPress={() => navigation.navigate('DiscountEditor', { discountId: discount.id })}
            style={[styles.row, { borderBottomColor: theme.colors.border }]}>
            <View
              style={[
                styles.rowIcon,
                { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
              ]}>
              <MaterialDesignIcons
                color={theme.colors.textMuted}
                name="ticket-percent-outline"
                size={24}
              />
            </View>
            <Text style={[styles.rowTitle, { color: theme.colors.text }]}>{discount.name}</Text>
            <Text style={[styles.rowValue, { color: theme.colors.text }]}>
              {discount.amount <= 0
                ? discount.type === 'percentage'
                  ? 'Variable %'
                  : 'Variable $'
                : discount.type === 'percentage'
                  ? `${discount.amount}%`
                  : formatCurrency(discount.amount)}
            </Text>
          </Pressable>
        ))}
        {!filteredDiscounts.length ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              No discounts yet
            </Text>
            <Text style={[styles.emptyBody, { color: theme.colors.textMuted }]}>
              Tap the plus button to create your first discount.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    minHeight: 88,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  addButton: {
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 999,
    marginHorizontal: 34,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    minHeight: 40,
  },
  list: {
    paddingHorizontal: 34,
    paddingBottom: 40,
  },
  row: {
    minHeight: 84,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  rowIcon: {
    width: 54,
    height: 54,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
  },
  rowValue: {
    fontSize: 17,
    fontWeight: '600',
  },
  emptyState: {
    paddingTop: 28,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
  },
});
