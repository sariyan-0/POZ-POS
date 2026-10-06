import { calculateSale, SaleInput } from '@oneregister/commerce-core';
import { POSState } from '../models/pos';

export function createSaleSnapshot(state: POSState): SaleInput {
  const business = state.settings.business;
  const taxes = business.taxDefinitions;
  const hasDefaultFlags = taxes.some(t => t.isDefault !== undefined);
  const defaults = hasDefaultFlags ? taxes.filter(t => t.isDefault && t.enabled) : business.defaultTaxRate
    ? [{ id: 'tax-default', name: 'Tax', rate: business.defaultTaxRate, enabled: true }] : [];
  return {
    items: state.cart.filter(item => item.type !== 'discount').map(item => {
      const product = state.products.find(p => p.id === item.productId);
      const selected = product?.taxIds?.length ? taxes.filter(t => product.taxIds?.includes(t.id) && t.enabled) : defaults;
      const behavior = product?.taxBehavior ?? 'inherit';
      return { id: item.id, productId: item.productId, quantityMilli: Math.round(item.quantity * 1000), unitPriceInCents: item.unitPriceInCents, modifierIds: item.metadata?.selectedModifiers?.map(m => m.modifierId) ?? [],
        inclusive: behavior === 'inclusive' || (behavior === 'inherit' && business.pricesIncludeTax === true),
        taxes: item.taxable && behavior !== 'none' ? selected.map(t => ({ id: t.id, name: t.name, ratePpm: 'ratePpm' in t && typeof t.ratePpm === 'number' ? t.ratePpm : Math.round(t.rate * 10000), enabled: t.enabled })) : [] };
    }),
    discounts: state.cart.filter(item => item.type === 'discount').map(item => {
      const discount = state.discounts.find(d => d.id === item.discountId);
      return { id: item.discountId ?? item.id, type: discount?.type ?? 'fixed', amountPpm: discount?.type === 'percentage' ? Math.round(discount.amount * 10000) : undefined,
        amountInCents: discount?.type === 'fixed' ? Math.round(discount.amount) : Math.abs(item.unitPriceInCents * item.quantity), applyAfterTaxes: discount?.applyAfterTaxes ?? item.metadata?.applyAfterTaxes };
    }),
  };
}
export function calculateCartTotals(state: POSState) {
  const result = calculateSale(createSaleSnapshot(state));
  return { grossSubtotal: result.subtotalInCents, subtotal: result.subtotalInCents - result.discountInCents, tax: result.taxInCents, taxLines: result.taxLines, total: result.totalInCents, allocations: result.lines, discount: result.discountInCents };
}
