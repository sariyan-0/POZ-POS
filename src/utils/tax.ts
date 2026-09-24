import { CartItem, POSState, TaxLine } from '../models/pos';

export function calculateCartTotals(state: POSState) {
  const subtotal = state.cart.reduce(
    (sum, item) => sum + item.unitPriceInCents * item.quantity,
    0,
  );
  const enabledTaxes = state.settings.business.taxDefinitions.filter(
    tax => tax.enabled,
  );
  const defaultTaxRate = state.settings.business.defaultTaxRate;
  const fallbackTaxes: TaxLine[] = defaultTaxRate
    ? [
        {
          taxId: 'tax-default',
          name: 'Tax',
          rate: defaultTaxRate,
          amount: 0,
        },
      ]
    : [];
  const taxLinesById = new Map<string, TaxLine>();

  function getApplicableTaxes(item: CartItem) {
    if (item.type === 'product' && item.productId) {
      const product = state.products.find(entry => entry.id === item.productId);
      if (product?.taxIds?.length) {
        return enabledTaxes.filter(tax => product.taxIds?.includes(tax.id));
      }
    }

    return fallbackTaxes;
  }

  state.cart.forEach(item => {
    if (!item.taxable) return;

    const itemAmount = item.unitPriceInCents * item.quantity;
    getApplicableTaxes(item).forEach(taxDefinition => {
      const amount = Math.round(itemAmount * (taxDefinition.rate / 100));
      if (!amount) return;

      const taxId =
        'taxId' in taxDefinition ? taxDefinition.taxId : taxDefinition.id;
      const existing = taxLinesById.get(taxId);
      taxLinesById.set(taxId, {
        taxId,
        name: taxDefinition.name,
        rate: taxDefinition.rate,
        amount: (existing?.amount ?? 0) + amount,
      });
    });
  });

  const taxLines = Array.from(taxLinesById.values());
  const tax = taxLines.reduce((sum, line) => sum + line.amount, 0);
  return { subtotal, tax, taxLines, total: subtotal + tax };
}
