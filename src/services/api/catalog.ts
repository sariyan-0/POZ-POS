import { apiConfig } from '../../config/api';
import { Product, ProductOptionSet } from '../../models/pos';
import { apiClient } from './ApiClient';

type CatalogCategory = { id: string; name: string; color?: string };
type CatalogProduct = Record<string, unknown> & { id: string; name: string };

function optionSets(value: unknown): ProductOptionSet[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const values = Array.isArray(record.values)
      ? record.values.flatMap(optionValue => {
          if (!optionValue || typeof optionValue !== 'object') return [];
          const item = optionValue as Record<string, unknown>;
          return typeof item.name === 'string' && item.name.trim()
            ? [{ id: typeof item.id === 'string' ? item.id : item.name, name: item.name.trim() }]
            : [];
        })
      : [];
    return name && values.length
      ? [{ id: typeof record.id === 'string' ? record.id : name, name, displayName: typeof record.displayName === 'string' ? record.displayName : name, values }]
      : [];
  });
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

export async function fetchCatalog(): Promise<{ products: Product[]; syncedAt: string }> {
  const payload = await apiClient.get<unknown>(apiConfig.endpoints.catalog, { timeoutMs: 10000 });
  if (!payload || typeof payload !== 'object') throw new Error('Invalid catalog response');
  const root = payload as Record<string, unknown>;
  const data = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null;
  if (root.success !== true || !data || !Array.isArray(data.products) || !Array.isArray(data.categories)) {
    throw new Error('Invalid catalog response');
  }

  const categories = new Map((data.categories as CatalogCategory[]).map(category => [category.id, category]));
  const products = (data.products as CatalogProduct[]).map(product => {
    const categoryId = typeof product.category_id === 'string' ? product.category_id : '';
    const category = categories.get(categoryId);
    const name = product.name.trim();
    const tileColor = typeof product.tile_color === 'string' ? product.tile_color : category?.color ?? '';
    return {
      id: product.id,
      name,
      description: typeof product.description === 'string' ? product.description : '',
      priceInCents: typeof product.price_in_cents === 'number' ? product.price_in_cents : 0,
      unitType: product.unit_type === 'mass' ? 'mass' : 'item',
      massUnit: product.mass_unit === 'lb' ? 'lb' : 'kg',
      currency: 'CAD',
      category: category?.name ?? 'Items',
      sku: typeof product.sku === 'string' ? product.sku : '',
      inventory: typeof product.inventory_quantity === 'number' ? product.inventory_quantity : 0,
      taxable: product.tax_behavior !== 'none',
      active: true,
      isFavorite: product.is_favorite === true,
      trackInventory: product.track_inventory === true,
      taxIds: strings(product.tax_ids),
      optionSets: optionSets(product.option_sets),
      modifierSetIds: strings(product.modifier_set_ids),
      imageUri: typeof product.image_url === 'string' ? product.image_url : '',
      imagePlaceholder: (name.slice(0, 2) || 'OR').toUpperCase(),
      tileColor,
      tileLabel: typeof product.tile_label === 'string' ? product.tile_label : '',
    } satisfies Product;
  });

  return {
    products,
    syncedAt: typeof data.syncedAt === 'string' ? data.syncedAt : new Date().toISOString(),
  };
}
