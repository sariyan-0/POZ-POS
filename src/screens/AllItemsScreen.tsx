import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { AppScreen, EmptyNotice } from '../components/POSUI';
import { usePOS } from '../hooks/usePOS';
import { Product } from '../models/pos';
import { useRootNavigation } from '../navigation/AppNavigator';
import { useAppTheme } from '../theme';
import { formatCurrency } from '../utils/format';
import {
  getProductTileInitials,
  getReadableTileTextColor,
} from '../utils/productTile';

type CatalogFilter = 'all' | 'active' | 'lowStock' | 'inactive';

const FILTERS: Array<{ key: CatalogFilter; label: string }> = [
  { key: 'all', label: 'All items' },
  { key: 'active', label: 'Active' },
  { key: 'lowStock', label: 'Low stock' },
  { key: 'inactive', label: 'Inactive' },
];

export function AllItemsScreen() {
  const {
    state,
    deactivateProduct,
    syncCatalog,
    catalogSyncStatus,
    catalogSyncError,
    lastCatalogSyncAt,
  } = usePOS();
  const navigation = useRootNavigation();
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CatalogFilter>('all');
  const useTwoColumns = width >= 820;

  useEffect(() => {
    syncCatalog().catch(() => undefined);
  }, [syncCatalog]);

  const lowStockCount = state.products.filter(isLowStock).length;
  const activeCount = state.products.filter(product => product.active).length;
  const inventoryUnits = state.products.reduce(
    (sum, product) =>
      sum + (product.trackInventory ? Math.max(product.inventory, 0) : 0),
    0,
  );

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return state.products.filter(product => {
      const matchesQuery =
        !normalizedQuery ||
        [product.name, product.sku, product.category].some(value =>
          value.toLocaleLowerCase().includes(normalizedQuery),
        );
      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && product.active) ||
        (filter === 'inactive' && !product.active) ||
        (filter === 'lowStock' && isLowStock(product));

      return matchesQuery && matchesFilter;
    });
  }, [filter, query, state.products]);

  const openEditor = (productId: string) => {
    navigation.navigate('ProductEditor', { productId });
  };

  return (
    <AppScreen
      title="Item library"
      subtitle={
        lastCatalogSyncAt
          ? `Catalog updated ${new Date(lastCatalogSyncAt).toLocaleTimeString(
              [],
              {
                hour: 'numeric',
                minute: '2-digit',
              },
            )}`
          : 'Create, price, and manage every item in one place.'
      }
      contentStyle={styles.screenContent}
      refreshControl={
        <RefreshControl
          refreshing={catalogSyncStatus === 'syncing'}
          onRefresh={() => syncCatalog().catch(() => undefined)}
          tintColor={theme.colors.accent}
          colors={[theme.colors.accent]}
        />
      }
      rightSlot={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a new item"
          onPress={() => navigation.navigate('ProductEditor')}
          style={({ pressed }) => [
            styles.addButton,
            {
              backgroundColor: theme.colors.accent,
              opacity: pressed ? 0.82 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <MaterialDesignIcons
            color={theme.colors.accentText}
            name="plus"
            size={20}
          />
          <Text
            style={[styles.addButtonLabel, { color: theme.colors.accentText }]}
          >
            New item
          </Text>
        </Pressable>
      }
    >
      {catalogSyncError ? (
        <View
          accessibilityRole="alert"
          style={[
            styles.syncNotice,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <MaterialDesignIcons
            color={theme.colors.danger}
            name="cloud-alert-outline"
            size={20}
          />
          <View style={styles.syncNoticeCopy}>
            <Text
              style={[styles.syncNoticeTitle, { color: theme.colors.text }]}
            >
              Sync paused
            </Text>
            <Text
              style={[styles.syncNoticeText, { color: theme.colors.textMuted }]}
            >
              Showing your saved catalog. Pull down to try again.
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.metricGrid}>
        <MetricCard
          label="Active items"
          value={activeCount}
          icon="check-decagram-outline"
        />
        <MetricCard
          label="Low stock"
          value={lowStockCount}
          icon="chart-box-outline"
          warning={lowStockCount > 0}
        />
        <MetricCard
          label="Units on hand"
          value={inventoryUnits}
          icon="package-variant-closed"
        />
      </View>

      <View style={styles.toolbar}>
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <MaterialDesignIcons
            color={theme.colors.textMuted}
            name="magnify"
            size={22}
          />
          <TextInput
            accessibilityLabel="Search items"
            value={query}
            onChangeText={setQuery}
            placeholder="Search name, SKU, or category"
            placeholderTextColor={theme.colors.textMuted}
            returnKeyType="search"
            style={[styles.searchInput, { color: theme.colors.text }]}
          />
          {query ? (
            <Pressable
              accessibilityLabel="Clear search"
              onPress={() => setQuery('')}
              hitSlop={10}
            >
              <MaterialDesignIcons
                color={theme.colors.textMuted}
                name="close-circle"
                size={20}
              />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map(option => {
            const selected = option.key === filter;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setFilter(option.key)}
                style={({ pressed }) => [
                  styles.filterButton,
                  {
                    backgroundColor: selected
                      ? theme.colors.accent
                      : theme.colors.surface,
                    borderColor: selected
                      ? theme.colors.accent
                      : theme.colors.border,
                    opacity: pressed ? 0.76 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterLabel,
                    {
                      color: selected
                        ? theme.colors.accentText
                        : theme.colors.textMuted,
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {filteredProducts.length ? (
        <View style={styles.productGrid}>
          {filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              twoColumns={useTwoColumns}
              onEdit={() => openEditor(product.id)}
              onDeactivate={() => deactivateProduct(product.id)}
            />
          ))}
        </View>
      ) : state.products.length ? (
        <View
          style={[
            styles.filteredEmpty,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <MaterialDesignIcons
            color={theme.colors.textMuted}
            name="text-search"
            size={34}
          />
          <Text
            style={[styles.filteredEmptyTitle, { color: theme.colors.text }]}
          >
            No matching items
          </Text>
          <Text
            style={[
              styles.filteredEmptyBody,
              { color: theme.colors.textMuted },
            ]}
          >
            Try another search or clear the current filter.
          </Text>
          <Pressable
            onPress={() => {
              setQuery('');
              setFilter('all');
            }}
            style={[
              styles.clearButton,
              { backgroundColor: theme.colors.surfaceStrong },
            ]}
          >
            <Text
              style={[styles.clearButtonLabel, { color: theme.colors.text }]}
            >
              Clear filters
            </Text>
          </Pressable>
        </View>
      ) : (
        <EmptyNotice
          title="Your catalog is ready to grow"
          body="Create your first item, then add pricing, inventory, modifiers, and a custom tile."
        />
      )}
    </AppScreen>
  );
}

function MetricCard({
  label,
  value,
  icon,
  warning = false,
}: {
  label: string;
  value: number;
  icon: React.ComponentProps<typeof MaterialDesignIcons>['name'];
  warning?: boolean;
}) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.metricCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.metricIcon,
          {
            backgroundColor: warning
              ? `${theme.colors.warning}22`
              : theme.colors.accentSoft,
          },
        ]}
      >
        <MaterialDesignIcons
          color={warning ? theme.colors.warning : theme.colors.accent}
          name={icon}
          size={20}
        />
      </View>
      <View>
        <Text style={[styles.metricValue, { color: theme.colors.text }]}>
          {value}
        </Text>
        <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function ProductCard({
  product,
  twoColumns,
  onEdit,
  onDeactivate,
}: {
  product: Product;
  twoColumns: boolean;
  onEdit: () => void;
  onDeactivate: () => void;
}) {
  const theme = useAppTheme();
  const lowStock = isLowStock(product);
  const artworkColor = product.tileColor?.trim() || theme.colors.surfaceStrong;
  const artworkTextColor = getReadableTileTextColor(
    artworkColor,
    theme.colors.text,
    theme.colors.surface,
  );

  return (
    <View
      style={[
        styles.productCard,
        twoColumns ? styles.productCardWide : styles.productCardFull,
        !product.active ? styles.productCardInactive : undefined,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${product.name}`}
        onPress={onEdit}
        style={({ pressed }) => [
          styles.productMain,
          { opacity: pressed ? 0.78 : 1 },
        ]}
      >
        <View style={[styles.artwork, { backgroundColor: artworkColor }]}>
          {product.imageUri ? (
            <Image
              source={{ uri: product.imageUri }}
              style={styles.artworkImage}
            />
          ) : (
            <Text style={[styles.artworkText, { color: artworkTextColor }]}>
              {getProductTileInitials(product)}
            </Text>
          )}
        </View>

        <View style={styles.productCopy}>
          <View style={styles.productHeadingRow}>
            <Text
              numberOfLines={1}
              style={[styles.productName, { color: theme.colors.text }]}
            >
              {product.name}
            </Text>
            {product.isFavorite ? (
              <MaterialDesignIcons
                color={theme.colors.warning}
                name="star"
                size={18}
              />
            ) : null}
          </View>
          <Text style={[styles.productPrice, { color: theme.colors.text }]}>
            {formatCurrency(product.priceInCents, product.currency)}
            <Text
              style={[styles.productUnit, { color: theme.colors.textMuted }]}
            >
              {' '}
              /{' '}
              {product.unitType === 'mass' ? product.massUnit || 'kg' : 'item'}
            </Text>
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.productMeta, { color: theme.colors.textMuted }]}
          >
            {product.sku || 'No SKU'} · {product.category || 'Items'}
          </Text>
        </View>

        <View style={styles.editCue}>
          <Text style={[styles.editCueLabel, { color: theme.colors.text }]}>
            Edit
          </Text>
          <MaterialDesignIcons
            color={theme.colors.text}
            name="arrow-top-right"
            size={18}
          />
        </View>
      </Pressable>

      <View
        style={[styles.productFooter, { borderTopColor: theme.colors.divider }]}
      >
        <View style={styles.statusGroup}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: product.active
                  ? theme.colors.success
                  : theme.colors.textMuted,
              },
            ]}
          />
          <Text style={[styles.statusText, { color: theme.colors.textMuted }]}>
            {product.active ? 'Active' : 'Inactive'}
          </Text>
          <View
            style={[
              styles.footerDivider,
              { backgroundColor: theme.colors.divider },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              {
                color: lowStock ? theme.colors.warning : theme.colors.textMuted,
              },
            ]}
          >
            {product.trackInventory
              ? `${product.inventory} in stock${lowStock ? ' · low' : ''}`
              : 'Stock not tracked'}
          </Text>
        </View>
        {product.active ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Deactivate ${product.name}`}
            hitSlop={8}
            onPress={onDeactivate}
          >
            <Text
              style={[
                styles.deactivateLabel,
                { color: theme.colors.textMuted },
              ]}
            >
              Deactivate
            </Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={onEdit} hitSlop={8}>
            <Text
              style={[styles.deactivateLabel, { color: theme.colors.text }]}
            >
              Review
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function isLowStock(product: Product) {
  return product.active && product.trackInventory && product.inventory <= 5;
}

const styles = StyleSheet.create({
  screenContent: { width: '100%', maxWidth: 1180, alignSelf: 'center' },
  addButton: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 16,
  },
  addButtonLabel: { fontSize: 14, fontWeight: '800' },
  syncNotice: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  syncNoticeCopy: { flex: 1, gap: 2 },
  syncNoticeTitle: { fontSize: 14, fontWeight: '800' },
  syncNoticeText: { fontSize: 12, lineHeight: 17 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    minWidth: 150,
    flex: 1,
    minHeight: 92,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  toolbar: { gap: 12 },
  searchBox: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, minHeight: 48, paddingVertical: 0 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterButton: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  filterLabel: { fontSize: 12, fontWeight: '800' },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  productCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  productCardInactive: { opacity: 0.72 },
  productCardWide: { flexBasis: '48%', flexGrow: 1, maxWidth: '50%' },
  productCardFull: { flexBasis: '100%', flexGrow: 1 },
  productMain: {
    minHeight: 126,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  artwork: {
    width: 82,
    height: 82,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  artworkImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  artworkText: { fontSize: 21, fontWeight: '900', letterSpacing: -0.6 },
  productCopy: { flex: 1, minWidth: 0, gap: 4 },
  productHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  productName: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  productPrice: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  productUnit: { fontSize: 12, fontWeight: '600' },
  productMeta: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
  editCue: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingTop: 2,
  },
  editCueLabel: { fontSize: 12, fontWeight: '800' },
  productFooter: {
    minHeight: 48,
    borderTopWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  statusGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  footerDivider: { width: 1, height: 14 },
  deactivateLabel: {
    fontSize: 11,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  filteredEmpty: {
    minHeight: 250,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  filteredEmptyTitle: { marginTop: 4, fontSize: 18, fontWeight: '900' },
  filteredEmptyBody: {
    maxWidth: 340,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
  },
  clearButton: {
    minHeight: 42,
    marginTop: 6,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
  },
  clearButtonLabel: { fontSize: 13, fontWeight: '800' },
});
