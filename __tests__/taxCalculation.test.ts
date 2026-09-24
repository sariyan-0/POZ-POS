import { POSState, Product } from '../src/models/pos';
import { initialPOSState } from '../src/services/mockData';
import { calculateCartTotals } from '../src/utils/tax';

const product: Product = {
  id: 'product-1',
  name: 'Test item',
  description: '',
  priceInCents: 1000,
  currency: 'CAD',
  category: 'Items',
  sku: '',
  inventory: 10,
  taxable: true,
  active: true,
  isFavorite: false,
  trackInventory: false,
  taxIds: [],
};

function stateWithTaxIds(taxIds: string[]): POSState {
  return {
    ...initialPOSState,
    products: [{ ...product, taxIds }],
    cart: [
      {
        id: 'cart-1',
        type: 'product',
        productId: product.id,
        title: product.name,
        quantity: 1,
        unitPriceInCents: product.priceInCents,
        taxable: true,
      },
    ],
    settings: {
      ...initialPOSState.settings,
      business: {
        ...initialPOSState.settings.business,
        defaultTaxRate: 13,
        taxDefinitions: [
          { id: 'tax-hst', name: 'HST', rate: 13, enabled: true },
          { id: 'tax-gst', name: 'GST', rate: 5, enabled: true },
        ],
      },
    },
  };
}

describe('item tax selection', () => {
  it('applies only the tax explicitly linked to the product', () => {
    const totals = calculateCartTotals(stateWithTaxIds(['tax-gst']));

    expect(totals.tax).toBe(50);
    expect(totals.taxLines).toEqual([
      { taxId: 'tax-gst', name: 'GST', rate: 5, amount: 50 },
    ]);
  });

  it('uses the business default when the product has no linked tax', () => {
    const totals = calculateCartTotals(stateWithTaxIds([]));

    expect(totals.tax).toBe(130);
    expect(totals.taxLines).toEqual([
      { taxId: 'tax-default', name: 'Tax', rate: 13, amount: 130 },
    ]);
  });
});
