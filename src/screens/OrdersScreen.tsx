import { SkeletonRows } from '../components/Skeleton';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { AppScreen, EmptyNotice, ListRow } from '../components/POSUI';
import { fetchOrders } from '../services/api/orders';
import { usePOS } from '../hooks/usePOS';
import { Transaction } from '../models/pos';
import { useRootNavigation } from '../navigation/AppNavigator';
import { formatCurrency } from '../utils/format';
import { useAppTheme } from '../theme';
export function OrdersScreen() {
  const { state, mergeServerTransactions } = usePOS();
  const navigation = useRootNavigation();
  const theme = useAppTheme();
  const [remote, setRemote] = useState<Transaction[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    async (next?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchOrders(next);
        setRemote(previous =>
          next ? [...previous, ...result.transactions] : result.transactions,
        );
        setCursor(result.nextCursor);
        mergeServerTransactions(result.transactions);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : 'Unable to load orders.',
        );
      } finally {
        setLoading(false);
      }
    },
    [mergeServerTransactions],
  );
  useEffect(() => {
    load();
  }, [load]);
  const entries = new Map(
    state.transactions
      .filter(t => t.serverSyncStatus !== 'synced')
      .map(t => [t.id, t]),
  );
  for (const sale of remote) entries.set(sale.id, sale);
  const sales = [...entries.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter(t =>
      `${t.referenceCode} ${t.customer?.name ?? ''} ${t.items
        .map(i => i.name)
        .join(' ')}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  return (
    <AppScreen
      title="Orders"
      subtitle="Sales from your business and pending sales on this register."
    >
      <TextInput
        accessibilityLabel="Search orders"
        placeholder="Search reference or customer"
        placeholderTextColor={theme.colors.textMuted}
        value={query}
        onChangeText={setQuery}
        style={{
          minHeight: 48,
          paddingHorizontal: 16,
          fontSize: 16,
          color: theme.colors.text,
          backgroundColor: theme.colors.surface,
          borderRadius: 8,
        }}
      />
      {error && (
        <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>
          {error}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={loading}
        onPress={() => load()}
        style={{ minHeight: 48, justifyContent: 'center' }}
      >
        <Text style={{ color: theme.colors.accent }}>
          {loading ? 'Refreshing orders…' : 'Refresh orders'}
        </Text>
      </Pressable>
      {loading && !sales.length && <SkeletonRows label="Loading orders" />}
      <View style={{ backgroundColor: theme.colors.surface }}>
        {sales.map(sale => (
          <ListRow
            key={sale.id}
            label={`${sale.referenceCode ?? sale.id} · ${
              sale.serverSyncStatus === 'synced' ? sale.status : 'Pending sync'
            }`}
            rightLabel={formatCurrency(sale.total, sale.currency)}
            onPress={() =>
              navigation.navigate('TransactionDetail', {
                transactionId: sale.id,
              })
            }
          />
        ))}
      </View>
      {!sales.length && !loading && (
        <EmptyNotice
          title="No matching orders"
          body="Completed cash and card sales appear here."
        />
      )}
      {cursor && (
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={() => load(cursor)}
          style={{ minHeight: 48, justifyContent: 'center' }}
        >
          <Text style={{ color: theme.colors.accent }}>Load more orders</Text>
        </Pressable>
      )}
    </AppScreen>
  );
}
