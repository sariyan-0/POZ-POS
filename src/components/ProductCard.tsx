import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Product } from '../models/pos';
import { useAppTheme } from '../theme';
import { formatCurrency } from '../utils/format';
import { Pill } from './ui';

export function ProductCard({
  product,
  onPress,
}: {
  product: Product;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const inventoryTone =
    product.inventory === 0
      ? 'danger'
      : product.inventory < 6
        ? 'warning'
        : 'success';

  return (
    <Pressable
      disabled={!product.active || product.inventory <= 0}
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          opacity: !product.active || product.inventory <= 0 ? 0.55 : pressed ? 0.85 : 1,
        },
      ]}>
      <View
        style={[
          styles.placeholder,
          {
            backgroundColor: theme.colors.surfaceMuted,
          },
        ]}>
        <Text style={[styles.placeholderText, { color: theme.colors.text }]}>
          {product.imagePlaceholder ?? 'PO'}
        </Text>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={[styles.name, { color: theme.colors.text }]}>{product.name}</Text>
        <Text style={[styles.description, { color: theme.colors.textMuted }]}>
          {product.category}
        </Text>
      </View>
      <Text style={[styles.price, { color: theme.colors.text }]}>
        {formatCurrency(product.priceInCents, product.currency)}
      </Text>
      <Pill
        label={
          product.inventory > 0 ? `${product.inventory} in stock` : 'Out of stock'
        }
        tone={inventoryTone}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 150,
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    gap: 12,
  },
  placeholder: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '800',
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
  },
  description: {
    fontSize: 13,
  },
  price: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
});
