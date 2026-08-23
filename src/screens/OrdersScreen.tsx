import React from 'react';
import { View } from 'react-native';
import { AppScreen, EmptyNotice, ListRow } from '../components/POSUI';
import { usePOS } from '../hooks/usePOS';
import { formatCurrency, formatDateTime } from '../utils/format';
import { useAppTheme } from '../theme';

export function OrdersScreen() {
  const { state } = usePOS();
  const theme = useAppTheme();

  return (
    <AppScreen
      title="Orders"
      subtitle="Local completed sales appear here until a dedicated orders backend exists.">
      {state.transactions.length ? (
        <View style={{ backgroundColor: theme.colors.surface }}>
          {state.transactions.map(transaction => (
            <ListRow
              key={transaction.id}
              label={`${formatDateTime(transaction.createdAt)} • ${transaction.items.length} item(s)`}
              rightLabel={formatCurrency(transaction.total, transaction.currency)}
              showChevron={false}
              compact
            />
          ))}
        </View>
      ) : (
        <EmptyNotice
          title="No orders yet"
          body="Completed mock sales will appear here."
        />
      )}
    </AppScreen>
  );
}
