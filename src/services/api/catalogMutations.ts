import { Product, Discount, ModifierSet, TaxDefinition } from '../../models/pos';
import { apiClient } from './ApiClient';
const serverId = (id: string) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id);
export async function saveTax(tax: TaxDefinition) {
  await (serverId(tax.id) ? apiClient.patch(`/api/taxes/${tax.id}`, { ...tax, isDefault: tax.isDefault === true }) : apiClient.post('/api/taxes', tax));
}
export async function saveDiscount(discount: Discount) {
  await (serverId(discount.id) ? apiClient.patch(`/api/discounts/${discount.id}`, discount) : apiClient.post('/api/discounts', discount));
}
export async function saveModifierSet(set: ModifierSet) {
  await (serverId(set.id) ? apiClient.patch<{ data: { modifierSet: { id: string } } }>(`/api/modifier-sets/${set.id}`, set) : apiClient.post<{ data: { modifierSet: { id: string } } }>('/api/modifier-sets', set));

}
export async function saveProduct(product: Product, original?: Product) {
  let categoryId = product.categoryId;
  if (product.category && product.category !== 'Items') {
    const category=await apiClient.post<{data:{category:{id:string}}}>('/api/categories',{name:product.category});
    categoryId=category.data.category.id;
  }
  const body = { name: product.name, description: product.description, priceInCents: product.priceInCents, sku: product.sku,
    categoryId, active: product.active, trackInventory: !original || original.trackInventory!==product.trackInventory ? product.trackInventory : undefined,
    ...(product.trackInventory && (!original || original.inventory!==product.inventory) ? { inventoryQuantity: product.inventory } : {}), taxBehavior: product.taxable ? product.taxBehavior ?? 'inherit' : 'none', taxIds: product.taxIds,
    unitType: product.unitType, massUnit: product.massUnit, isFavorite: product.isFavorite, modifierSetIds: product.modifierSetIds,
    optionSets: product.optionSets?.map(set => ({ ...set, values: set.values.map(value => value.name) })), imageUrl: product.imageUri?.startsWith('https://') ? product.imageUri : undefined,
    tileColor: product.tileColor, tileLabel: product.tileLabel, updatedAt: product.updatedAt };
  const result = await (serverId(product.id) ? apiClient.patch<{data:{product:{id:string}}}>(`/api/catalog/${product.id}`, body) : apiClient.post<{data:{product:{id:string}}}>('/api/catalog', body));
  if (product.imageUri && !product.imageUri.startsWith('https://')) {
    try {
      const form = new FormData();
      form.append('image', { uri: product.imageUri, name: 'product.jpg', type: 'image/jpeg' } as unknown as Blob);
      await apiClient.post(`/api/products/${result.data.product.id}/image`, form, { timeoutMs: 30000 });
    } catch (cause) {
      const error = new Error('Item saved, but its photo could not upload. Retry or remove the photo.');
      Object.assign(error,{savedProductId:result.data.product.id,cause}); throw error;
    }
  }
}
export async function archiveProduct(id: string) { await apiClient.patch(`/api/catalog/${id}`, { active: false }); }
