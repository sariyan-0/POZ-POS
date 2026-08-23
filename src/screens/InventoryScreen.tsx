import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen, EmptyNotice, Thumbnail } from '../components/POSUI';
import { usePOS } from '../hooks/usePOS';
import { useAppTheme } from '../theme';

export function InventoryScreen() {
  const { state, adjustInventory } = usePOS();
  const theme = useAppTheme();

  return (
    <AppScreen
      title="Inventory"
      subtitle="Manual stock adjustment for tracked items.">
      {state.products.length ? (
        <View style={{ backgroundColor: theme.colors.surface }}>
          {state.products.map(product => (
            <View
              key={product.id}
              style={[styles.row, { borderBottomColor: theme.colors.divider }]}>
              <View style={styles.left}>
                <Thumbnail product={product} />
                <View style={{ gap: 4 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700' }}>
                    {product.name}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                    {product.sku || 'No SKU'}
                  </Text>
                </View>
              </View>
              <View style={styles.right}>
                <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>
                  {product.inventory}
                </Text>
                <View style={styles.controls}>
                  <CounterButton
                    label="-1"
                    onPress={() => adjustInventory(product.id, -1)}
                  />
                  <CounterButton
                    label="+1"
                    onPress={() => adjustInventory(product.id, 1)}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <EmptyNotice
          title="No inventory yet"
          body="Create items first to manage stock."
        />
      )}
    </AppScreen>
  );
}

function CounterButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.counterButton, { backgroundColor: theme.colors.surfaceMuted }]}>
      <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 84,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  right: {
    alignItems: 'flex-end',
    gap: 8,
  },
  controls: {
    flexDirection: 'row',
    gap: 8,
  },
  counterButton: {
    minWidth: 44,
    minHeight: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
});
