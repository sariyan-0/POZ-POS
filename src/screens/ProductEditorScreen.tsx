import React, { useMemo, useState } from 'react';
import { RouteProp, useRoute } from '@react-navigation/native';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AppScreen } from '../components/POSUI';
import { Product } from '../models/pos';
import { createEmptyProduct, usePOS } from '../hooks/usePOS';
import { RootStackParamList, useRootNavigation } from '../navigation/AppNavigator';
import { useAppTheme } from '../theme';

type ProductEditorRoute = RouteProp<RootStackParamList, 'ProductEditor'>;

export function ProductEditorScreen() {
  const route = useRoute<ProductEditorRoute>();
  const theme = useAppTheme();
  const navigation = useRootNavigation();
  const { state, upsertProduct } = usePOS();
  const existingProduct = useMemo(
    () => state.products.find(product => product.id === route.params?.productId),
    [route.params?.productId, state.products],
  );
  const [product, setProduct] = useState<Product>(
    existingProduct ? { ...existingProduct } : createEmptyProduct(),
  );

  const saveDisabled = !product.name.trim();

  return (
    <AppScreen
      title={existingProduct ? 'Edit Product' : 'Add Product'}
      subtitle="Create or update compact catalog items for Library and Favorites.">
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Field
          label="Product name"
          value={product.name}
          onChangeText={text => setProduct(current => ({ ...current, name: text }))}
        />
        <Field
          label="Price (CAD)"
          value={(product.priceInCents / 100).toString()}
          onChangeText={text =>
            setProduct(current => ({
              ...current,
              priceInCents: Math.max(
                0,
                Math.round((Number.parseFloat(text || '0') || 0) * 100),
              ),
            }))
          }
          keyboardType="numeric"
        />
        <Field
          label="Description"
          value={product.description}
          onChangeText={text =>
            setProduct(current => ({ ...current, description: text }))
          }
          multiline
        />
        <Field
          label="Category"
          value={product.category}
          onChangeText={text =>
            setProduct(current => ({ ...current, category: text || 'Items' }))
          }
        />
        <Field
          label="SKU"
          value={product.sku}
          onChangeText={text => setProduct(current => ({ ...current, sku: text }))}
        />
        <Field
          label="Image URL"
          value={product.imageUri ?? ''}
          onChangeText={text => setProduct(current => ({ ...current, imageUri: text }))}
        />
        <Field
          label="Quantity"
          value={product.inventory.toString()}
          onChangeText={text =>
            setProduct(current => ({
              ...current,
              inventory: Math.max(0, Number.parseInt(text || '0', 10) || 0),
            }))
          }
          keyboardType="numeric"
        />

        <ToggleRow
          label="Inventory tracking"
          description="Reduce stock when a mock sale completes."
          value={product.trackInventory}
          onValueChange={value =>
            setProduct(current => ({ ...current, trackInventory: value }))
          }
        />
        <ToggleRow
          label="Taxable"
          description="Include this item in tax calculations."
          value={product.taxable}
          onValueChange={value =>
            setProduct(current => ({ ...current, taxable: value }))
          }
        />
        <ToggleRow
          label="Favorite"
          description="Show this item in the Favorites tab."
          value={product.isFavorite}
          onValueChange={value =>
            setProduct(current => ({ ...current, isFavorite: value }))
          }
        />
        <ToggleRow
          label="Active"
          description="Hide inactive items from checkout."
          value={product.active}
          onValueChange={value => setProduct(current => ({ ...current, active: value }))}
        />

        <Text
          style={[
            styles.actionText,
            { color: saveDisabled ? theme.colors.textMuted : theme.colors.text },
          ]}
          onPress={() => {
            if (saveDisabled) {
              return;
            }
            upsertProduct({
              ...product,
              name: product.name.trim(),
              sku: product.sku.trim(),
              category: product.category.trim() || 'Items',
              imagePlaceholder: (product.name.trim().slice(0, 2) || 'PO').toUpperCase(),
            });
            navigation.goBack();
          }}>
          Save item
        </Text>
      </View>
    </AppScreen>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'numeric';
  multiline?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[
          styles.input,
          {
            color: theme.colors.text,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surfaceMuted,
            minHeight: multiline ? 96 : 52,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
      />
    </View>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700' }}>
          {label}
        </Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 18 }}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 18,
    gap: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  actionText: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 4,
  },
});
