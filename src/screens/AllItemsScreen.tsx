import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { AppScreen, EmptyNotice, ListRow, Thumbnail } from '../components/POSUI';
import { usePOS } from '../hooks/usePOS';
import { useRootNavigation } from '../navigation/AppNavigator';
import { useAppTheme } from '../theme';
import { formatCurrency } from '../utils/format';

export function AllItemsScreen() {
  const { state, deactivateProduct } = usePOS();
  const navigation = useRootNavigation();
  const theme = useAppTheme();

  return (
    <AppScreen
      title="All items"
      rightSlot={
        <Pressable
          onPress={() => navigation.navigate('ProductEditor')}
          style={[styles.addButton, { backgroundColor: theme.colors.accent }]}>
          <Text style={[styles.addButtonLabel, { color: theme.colors.accentText }]}>
            Add item
          </Text>
        </Pressable>
      }>
      {state.products.length ? (
        <View style={{ backgroundColor: theme.colors.surface }}>
          {state.products.map(product => (
            <View key={product.id}>
              <ListRow
                label={product.name}
                rightLabel={formatCurrency(product.priceInCents, product.currency)}
                thumbnail={<Thumbnail product={product} />}
                compact
                showChevron={false}
                onPress={() =>
                  navigation.navigate('ProductEditor', {
                    productId: product.id,
                  })
                }
              />
              <View style={styles.metaRow}>
                <View style={styles.metaLeft}>
                  <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
                    {product.sku || 'No SKU'} • {product.category}
                  </Text>
                  {product.isFavorite ? (
                    <MaterialDesignIcons color={theme.colors.textMuted} name="star" size={16} />
                  ) : null}
                </View>
                <Pressable onPress={() => deactivateProduct(product.id)}>
                  <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
                    {product.active ? 'Deactivate' : 'Inactive'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <EmptyNotice
          title="No items yet"
          body="Create your first item to populate the library."
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  addButton: {
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  addButtonLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
