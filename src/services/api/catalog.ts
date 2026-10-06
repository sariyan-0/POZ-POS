import { apiConfig } from '../../config/api';
import {
  ModifierSet,
  Product,
  ProductOptionSet,
  TaxDefinition,
  BusinessSettings,
  Discount,
} from '../../models/pos';
import { apiClient, HttpResponseError } from './ApiClient';

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
            ? [
                {
                  id: typeof item.id === 'string' ? item.id : item.name,
                  name: item.name.trim(),
                },
              ]
            : [];
        })
      : [];
    return name && values.length
      ? [
          {
            id: typeof record.id === 'string' ? record.id : name,
            name,
            displayName:
              typeof record.displayName === 'string'
                ? record.displayName
                : name,
            values,
          },
        ]
      : [];
  });
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

type CatalogSyncResult = {
  products: Product[];
  taxDefinitions: TaxDefinition[];
  modifierSets: ModifierSet[];
  defaultTaxRate: number;
  businessSettings: Partial<BusinessSettings>;
  discounts: Discount[];
  syncedAt: string;
};

export function fetchCatalog(): Promise<CatalogSyncResult>;
export function fetchCatalog(knownRevision: string): Promise<CatalogSyncResult | null>;
export function fetchCatalog(knownRevision?: string): Promise<CatalogSyncResult | null>;
export async function fetchCatalog(knownRevision?: string): Promise<CatalogSyncResult | null> {
  const payload = await apiClient.get<unknown>(apiConfig.endpoints.catalog, {
    timeoutMs: 10000,
    headers: knownRevision ? { 'If-None-Match': `"${knownRevision}"` } : undefined,
  }).catch(error => {
    if (knownRevision && error instanceof HttpResponseError && error.status === 304) return null;
    throw error;
  });
  if (payload === null) return null;
  if (!payload || typeof payload !== 'object')
    throw new Error('Invalid catalog response');
  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : null;
  if (
    root.success !== true ||
    !data ||
    !Array.isArray(data.products) ||
    !Array.isArray(data.categories)
  ) {
    throw new Error('Invalid catalog response');
  }

  const categories = new Map(
    (data.categories as CatalogCategory[]).map(category => [
      category.id,
      category,
    ]),
  );
  const products = (data.products as CatalogProduct[]).map(product => {
    const categoryId =
      typeof product.category_id === 'string' ? product.category_id : '';
    const category = categories.get(categoryId);
    const name = product.name.trim();
    const tileColor =
      typeof product.tile_color === 'string'
        ? product.tile_color
        : category?.color ?? '';
    return {
      id: product.id,
      name,
      description:
        typeof product.description === 'string' ? product.description : '',
      priceInCents:
        typeof product.price_in_cents === 'number' ? product.price_in_cents : 0,
      unitType: product.unit_type === 'mass' ? 'mass' : 'item',
      massUnit: product.mass_unit === 'lb' ? 'lb' : 'kg',
      currency: product.currency === 'usd' ? 'USD' : 'CAD',
      categoryId,
      updatedAt: typeof product.updated_at === 'string' ? product.updated_at : undefined,
      taxBehavior: ['inclusive', 'exclusive', 'none'].includes(String(product.tax_behavior)) ? product.tax_behavior as 'inclusive' | 'exclusive' | 'none' : 'inherit',
      category: category?.name ?? 'Items',
      sku: typeof product.sku === 'string' ? product.sku : '',
      inventory:
        typeof product.inventory_quantity === 'number'
          ? product.inventory_quantity
          : 0,
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
      tileLabel:
        typeof product.tile_label === 'string' ? product.tile_label : '',
    } satisfies Product;
  });
  const taxDefinitions: TaxDefinition[] = Array.isArray(data.taxRates)
    ? data.taxRates.flatMap(value => {
        if (!value || typeof value !== 'object') return [];
        const tax = value as Record<string, unknown>;
        if (typeof tax.id !== 'string' || typeof tax.name !== 'string')
          return [];
        return [
          {
            id: tax.id,
            name: tax.name,
            rate: typeof tax.rate_ppm === 'number' ? tax.rate_ppm / 10000 : typeof tax.rate_bps === 'number' ? tax.rate_bps / 100 : 0,
            ratePpm: typeof tax.rate_ppm === 'number' ? tax.rate_ppm : undefined,
            isDefault: tax.is_default === true,
            archived: Boolean(tax.archived_at),
            updatedAt: typeof tax.updated_at === 'string' ? tax.updated_at : undefined,
            enabled: tax.enabled === true,
          },
        ];
      })
    : [];
  const modifierSets: ModifierSet[] = Array.isArray(data.modifierSets)
    ? data.modifierSets.flatMap(value => {
        if (!value || typeof value !== 'object') return [];
        const set = value as Record<string, unknown>;
        if (typeof set.id !== 'string' || typeof set.name !== 'string')
          return [];
        const modifiers = Array.isArray(set.modifiers)
          ? set.modifiers.flatMap(entry => {
              if (!entry || typeof entry !== 'object') return [];
              const modifier = entry as Record<string, unknown>;
              if (
                typeof modifier.id !== 'string' ||
                typeof modifier.name !== 'string'
              )
                return [];
              return [
                {
                  id: modifier.id,
                  name: modifier.name,
                  priceAdjustmentInCents:
                    typeof modifier.priceAdjustmentInCents === 'number'
                      ? modifier.priceAdjustmentInCents
                      : 0,
                },
              ];
            })
          : [];
        return [{ id: set.id, name: set.name, modifiers, itemIds: products.filter(product=>product.modifierSetIds?.includes(set.id as string)).map(product=>product.id) }];
      })
    : [];
  const businessSettings =
    data.businessSettings && typeof data.businessSettings === 'object'
      ? (data.businessSettings as Record<string, unknown>)
      : {};

  return {
    products,
    businessSettings: {
      settingsUpdatedAt: typeof businessSettings.settingsUpdatedAt==='string'?businessSettings.settingsUpdatedAt:undefined,
      businessId: typeof businessSettings.businessId === 'string' ? businessSettings.businessId : undefined,
      businessName: typeof businessSettings.name === 'string' ? businessSettings.name : undefined,
      currency: businessSettings.currency === 'usd' ? 'USD' : 'CAD',
      country: businessSettings.country === 'US' ? 'US' : 'CA',
      pricesIncludeTax: businessSettings.pricesIncludeTax === true,
      taxRegistrationNumber: typeof businessSettings.taxRegistrationNumber === 'string' ? businessSettings.taxRegistrationNumber : '',
      receiptHeader: typeof businessSettings.receiptHeader === 'string' ? businessSettings.receiptHeader : '',
      receiptFooter: typeof businessSettings.receiptFooter === 'string' ? businessSettings.receiptFooter : '',
      catalogRevision: typeof data.catalogVersion === 'string' ? data.catalogVersion : undefined,
    },
    discounts: Array.isArray(data.discounts) ? data.discounts.map(value => {
      const d = value as Record<string, unknown>;
      return { id: String(d.id), name: String(d.name), type: d.type === 'percentage' ? 'percentage' : 'fixed', amount: Number(d.amount), active: d.active === true, requirePasscode: d.require_passcode === true, applyAfterTaxes: d.apply_after_taxes === true, updatedAt: String(d.updated_at) } as Discount;
    }) : [],
    taxDefinitions,
    modifierSets,
    defaultTaxRate:
      typeof businessSettings.defaultTaxRateBps === 'number'
        ? businessSettings.defaultTaxRateBps / 100
        : 0,
    syncedAt:
      typeof data.syncedAt === 'string'
        ? data.syncedAt
        : new Date().toISOString(),
  };
}
