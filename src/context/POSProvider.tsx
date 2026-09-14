import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import {
  AppearanceMode,
  AppSettings,
  CartItem,
  Customer,
  Discount,
  ModifierSet,
  PaymentMethod,
  POSState,
  Product,
  ProductOptionSet,
  RefundRecord,
  StaffMember,
  StaffPermission,
  StripePaymentDetails,
  TaxDefinition,
  TaxLine,
  Transaction,
  TransactionItem,
} from '../models/pos';
import { initialPOSState } from '../services/mockData';
import { loadPOSState, savePOSState } from '../storage/persistence';
import { createId } from '../utils/id';
import { createPinCredentials, verifyPin } from '../utils/pin';
import { fetchCatalog } from '../services/api/catalog';
import { fetchStaff } from '../services/api/staff';
import { fetchCustomers } from '../services/api/customers';

const isTestRuntime =
  (
    globalThis as typeof globalThis & {
      process?: { env?: { NODE_ENV?: string } };
    }
  ).process?.env?.NODE_ENV === 'test';

type CreateTransactionInput = {
  paymentMethod: PaymentMethod;
  transactionReference: string;
  paymentProvider?: 'mock' | 'stripe_terminal';
  processorReference?: string;
  paymentDetails?: StripePaymentDetails;
  cashDetails?: Transaction['cashDetails'];
};

type POSContextValue = {
  state: POSState;
  isHydrated: boolean;
  activeProducts: Product[];
  favoriteProducts: Product[];
  activeDiscounts: Discount[];
  modifierSets: ModifierSet[];
  currentStaff?: StaffMember;
  isStaffAuthenticated: boolean;
  saleItemCount: number;
  subtotal: number;
  tax: number;
  taxLines: TaxLine[];
  total: number;
  selectedCustomer?: Customer;
  addProductToCart: (
    productId: string,
    input?: {
      quantity?: number;
      title?: string;
      unitPriceInCents?: number;
      note?: string;
      metadata?: CartItem['metadata'];
    },
  ) => void;
  addCustomAmountToCart: (amountInCents: number, note?: string) => void;
  addDiscountToCart: (
    discountId: string,
    authorizedByStaffId?: string,
  ) => { ok: true } | { ok: false; message: string };
  updateCartItemQuantity: (itemId: string, quantity: number) => void;
  removeCartItem: (itemId: string) => void;
  clearCart: () => void;
  upsertProduct: (product: Product) => void;
  upsertModifierSet: (modifierSet: ModifierSet) => void;
  deactivateProduct: (productId: string) => void;
  adjustInventory: (productId: string, delta: number) => void;
  upsertDiscount: (discount: Discount) => void;
  upsertCustomer: (customer: Customer) => void;
  selectCustomerForSale: (customerId?: string) => void;
  updateCustomerStripeId: (
    customerId: string,
    stripeCustomerId: string,
  ) => void;
  createApprovedTransaction: (
    input: CreateTransactionInput,
  ) => Transaction | null;
  refundTransaction: (transactionId: string, refund: RefundRecord) => void;
  updateTaxRate: (taxRate: number) => void;
  upsertTaxDefinition: (tax: TaxDefinition) => void;
  deleteTaxDefinition: (taxId: string) => void;
  updateBusinessName: (name: string) => void;
  updateAppearanceMode: (mode: AppearanceMode) => void;
  unlockWithPin: (pin: string, staffId?: string) => StaffMember | null;
  authorizeManagerPin: (pin: string) => StaffMember | null;
  authorizePermissionPin: (
    pin: string,
    permission: StaffPermission,
  ) => StaffMember | null;
  hasPermission: (permission: StaffPermission, staff?: StaffMember) => boolean;
  lockSession: () => void;
  updateCurrentStaffPin: (
    currentPin: string,
    nextPin: string,
  ) => { ok: true } | { ok: false; message: string };
  createStaffProfile: (input: {
    name: string;
    role: StaffMember['role'];
    pin: string;
  }) => { ok: true } | { ok: false; message: string };
  updateStaffProfile: (input: {
    staffId: string;
    name: string;
    role: StaffMember['role'];
  }) => { ok: true } | { ok: false; message: string };
  deleteStaffProfile: (
    staffId: string,
  ) => { ok: true } | { ok: false; message: string };
  catalogSyncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  catalogSyncError: string | null;
  lastCatalogSyncAt: string | null;
  syncCatalog: () => Promise<void>;
  staffSyncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  staffSyncError: string | null;
  lastStaffSyncAt: string | null;
  syncStaff: () => Promise<void>;
  customerSyncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  customerSyncError: string | null;
  lastCustomerSyncAt: string | null;
  syncCustomers: () => Promise<void>;
  updateTransactionSync: (
    transactionId: string,
    update: Pick<
      Transaction,
      | 'serverSyncStatus'
      | 'serverOrderId'
      | 'serverOrderNumber'
      | 'serverSyncError'
      | 'syncedAt'
    >,
  ) => void;
};

type POSAction =
  | { type: 'hydrate'; payload: POSState }
  | {
      type: 'addProductToCart';
      payload: {
        productId: string;
        quantity?: number;
        title?: string;
        unitPriceInCents?: number;
        note?: string;
        metadata?: CartItem['metadata'];
      };
    }
  | {
      type: 'addCustomAmountToCart';
      payload: { amountInCents: number; note?: string };
    }
  | { type: 'addDiscountToCart'; payload: { item: CartItem } }
  | {
      type: 'updateCartItemQuantity';
      payload: { itemId: string; quantity: number };
    }
  | { type: 'removeCartItem'; payload: { itemId: string } }
  | { type: 'clearCart' }
  | { type: 'upsertProduct'; payload: Product }
  | { type: 'upsertModifierSet'; payload: ModifierSet }
  | { type: 'upsertDiscount'; payload: Discount }
  | { type: 'deactivateProduct'; payload: { productId: string } }
  | { type: 'adjustInventory'; payload: { productId: string; delta: number } }
  | { type: 'upsertCustomer'; payload: Customer }
  | { type: 'selectCustomerForSale'; payload: { customerId?: string } }
  | {
      type: 'updateCustomerStripeId';
      payload: { customerId: string; stripeCustomerId: string };
    }
  | { type: 'completeSale'; payload: Transaction }
  | {
      type: 'refundTransaction';
      payload: { transactionId: string; refund: RefundRecord };
    }
  | { type: 'updateSettings'; payload: AppSettings }
  | { type: 'upsertTaxDefinition'; payload: TaxDefinition }
  | { type: 'deleteTaxDefinition'; payload: { taxId: string } }
  | { type: 'unlockWithPin'; payload: { staffId: string } }
  | { type: 'lockSession' }
  | {
      type: 'updateStaffPin';
      payload: { staffId: string; pinHash: string; pinSalt: string };
    }
  | { type: 'upsertStaffProfile'; payload: StaffMember }
  | { type: 'deactivateStaffProfile'; payload: { staffId: string } }
  | { type: 'reconcileCatalog'; payload: { products: Product[] } }
  | { type: 'reconcileStaff'; payload: { staff: StaffMember[] } }
  | { type: 'reconcileCustomers'; payload: { customers: Customer[] } }
  | {
      type: 'updateTransactionSync';
      payload: { transactionId: string; update: Partial<Transaction> };
    };

const POSContext = createContext<POSContextValue | undefined>(undefined);

function hasConfiguredPin(
  staffMember: Pick<StaffMember, 'pinHash' | 'pinSalt'>,
) {
  return !!staffMember.pinHash?.trim() && !!staffMember.pinSalt?.trim();
}

const DEFAULT_STAFF_PERMISSIONS: Record<
  StaffMember['role'],
  StaffPermission[]
> = {
  owner: [
    'process_sales',
    'view_transactions',
    'apply_discounts',
    'issue_refunds',
    'manage_customers',
    'manage_catalog',
    'manage_inventory',
    'view_reports',
    'manage_register_settings',
  ],
  manager: [
    'process_sales',
    'view_transactions',
    'apply_discounts',
    'issue_refunds',
    'manage_customers',
    'manage_catalog',
    'manage_inventory',
    'view_reports',
  ],
  cashier: ['process_sales', 'view_transactions', 'manage_customers'],
};

function staffHasPermission(
  staffMember: StaffMember | undefined,
  permission: StaffPermission,
) {
  return Boolean(
    staffMember?.active &&
      (
        staffMember.permissions ?? DEFAULT_STAFF_PERMISSIONS[staffMember.role]
      ).includes(permission),
  );
}

function normalizeProduct(product: Product): Product {
  return {
    ...product,
    category: product.category || 'Items',
    unitType: product.unitType === 'mass' ? 'mass' : 'item',
    massUnit: product.massUnit === 'lb' ? 'lb' : 'kg',
    isFavorite: product.isFavorite ?? false,
    trackInventory: product.trackInventory ?? true,
    taxIds: Array.isArray(product.taxIds) ? product.taxIds : [],
    optionSets: Array.isArray(product.optionSets)
      ? product.optionSets.map(optionSet =>
          normalizeProductOptionSet(optionSet),
        )
      : [],
    modifierSetIds: Array.isArray(product.modifierSetIds)
      ? product.modifierSetIds
      : [],
    imageUri: product.imageUri ?? '',
    imagePlaceholder: product.imagePlaceholder ?? 'PO',
    tileColor: product.tileColor ?? '',
    tileLabel: product.tileLabel ?? '',
  };
}

function isServerProductId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function normalizeProductOptionSet(
  optionSet: ProductOptionSet,
): ProductOptionSet {
  return {
    ...optionSet,
    name: optionSet.name?.trim() || '',
    displayName: optionSet.displayName?.trim() || optionSet.name?.trim() || '',
    values: Array.isArray(optionSet.values)
      ? optionSet.values
          .map(value => ({
            ...value,
            name: value.name?.trim() || '',
          }))
          .filter(value => value.name)
      : [],
  };
}

function normalizeTaxDefinition(tax: TaxDefinition): TaxDefinition {
  return {
    ...tax,
    name: tax.name?.trim() || 'Tax',
    rate: Math.max(0, Number.isFinite(tax.rate) ? tax.rate : 0),
    enabled: tax.enabled ?? true,
  };
}

function normalizeDiscount(discount: Discount): Discount {
  return {
    ...discount,
    name: discount.name.trim(),
    type: discount.type === 'percentage' ? 'percentage' : 'fixed',
    amount: Math.max(0, Number.isFinite(discount.amount) ? discount.amount : 0),
    requirePasscode: discount.requirePasscode ?? false,
    applyAfterTaxes: discount.applyAfterTaxes ?? false,
    active: discount.active ?? true,
  };
}

function normalizeModifierSet(modifierSet: ModifierSet): ModifierSet {
  return {
    ...modifierSet,
    name: modifierSet.name?.trim() || 'Modifier set',
    itemIds: Array.isArray(modifierSet.itemIds) ? modifierSet.itemIds : [],
    modifiers: Array.isArray(modifierSet.modifiers)
      ? modifierSet.modifiers
          .map(modifier => ({
            ...modifier,
            name: modifier.name?.trim() || '',
            priceAdjustmentInCents: Math.max(
              0,
              Number.isFinite(modifier.priceAdjustmentInCents)
                ? modifier.priceAdjustmentInCents
                : 0,
            ),
          }))
          .filter(modifier => modifier.name)
      : [],
  };
}

function normalizeCustomer(customer: Customer): Customer {
  const now = new Date().toISOString();
  return {
    ...customer,
    createdAt: customer.createdAt || now,
    updatedAt: customer.updatedAt || customer.createdAt || now,
    name: customer.name.trim(),
    email: customer.email?.trim() || undefined,
    phone: customer.phone?.trim() || undefined,
    note: customer.note?.trim() || undefined,
    stripeCustomerId: customer.stripeCustomerId?.trim() || undefined,
    syncStatus:
      customer.syncStatus ?? (customer.stripeCustomerId ? 'synced' : 'local'),
    visitCount: Math.max(0, customer.visitCount ?? 0),
    totalSpentInCents: Math.max(0, customer.totalSpentInCents ?? 0),
    lastVisitAt: customer.lastVisitAt || undefined,
  };
}

function normalizeStaffMember(staffMember: StaffMember): StaffMember {
  const entry = staffMember as StaffMember & { pin?: string };

  if (typeof entry.pinHash === 'string' && typeof entry.pinSalt === 'string') {
    return {
      ...entry,
      name: entry.name.trim(),
      role: entry.role || 'cashier',
      active: entry.active ?? true,
      permissions: Array.isArray(entry.permissions)
        ? entry.permissions
        : DEFAULT_STAFF_PERMISSIONS[entry.role || 'cashier'],
      pinHash: entry.pinHash,
      pinSalt: entry.pinSalt,
    };
  }

  const legacyPin = typeof entry.pin === 'string' ? entry.pin.trim() : '';
  const migratedCredentials = legacyPin
    ? createPinCredentials(legacyPin)
    : { pinHash: '', pinSalt: '' };
  return {
    ...entry,
    name: entry.name.trim(),
    role: entry.role || 'cashier',
    active: entry.active ?? true,
    permissions: DEFAULT_STAFF_PERMISSIONS[entry.role || 'cashier'],
    pinHash: migratedCredentials.pinHash,
    pinSalt: migratedCredentials.pinSalt,
  };
}

function clearLegacyDefaultOwnerPin(staffMember: StaffMember): StaffMember {
  const isSeededOwner =
    staffMember.id === 'staff-owner' &&
    staffMember.role === 'owner' &&
    staffMember.name.trim().toLowerCase() === 'store owner';

  if (!isSeededOwner || !hasConfiguredPin(staffMember)) {
    return staffMember;
  }

  if (
    verifyPin({
      pin: '1234',
      pinHash: staffMember.pinHash,
      pinSalt: staffMember.pinSalt,
    })
  ) {
    return {
      ...staffMember,
      pinHash: '',
      pinSalt: '',
    };
  }

  return staffMember;
}

function normalizeState(state: POSState): POSState {
  const rawCart = (state.cart ?? []) as Array<
    CartItem | { productId?: string; quantity?: number }
  >;

  const normalizedStaffMembers = ((state.staffMembers ?? []) as StaffMember[])
    .length
    ? ((state.staffMembers ?? []) as StaffMember[])
        .map(staffMember => normalizeStaffMember(staffMember))
        .map(staffMember => clearLegacyDefaultOwnerPin(staffMember))
    : initialPOSState.staffMembers
        .map(staffMember => normalizeStaffMember(staffMember))
        .map(staffMember => clearLegacyDefaultOwnerPin(staffMember));
  const hasAnyConfiguredPins = normalizedStaffMembers.some(
    staffMember => staffMember.active && hasConfiguredPin(staffMember),
  );
  const fallbackStaffId =
    normalizedStaffMembers.find(
      staffMember => staffMember.active && staffMember.role === 'owner',
    )?.id ?? normalizedStaffMembers.find(staffMember => staffMember.active)?.id;

  return {
    ...state,
    products: (state.products ?? []).map(product =>
      normalizeProduct(product as Product),
    ),
    modifierSets: ((state.modifierSets ?? []) as ModifierSet[]).map(
      modifierSet => normalizeModifierSet(modifierSet),
    ),
    discounts: ((state.discounts ?? []) as Discount[]).map(discount =>
      normalizeDiscount(discount),
    ),
    customers: ((state.customers ?? []) as Customer[]).map(customer =>
      normalizeCustomer(customer),
    ),
    staffMembers: normalizedStaffMembers,
    currentStaffId:
      typeof state.currentStaffId === 'string' && state.currentStaffId
        ? state.currentStaffId
        : hasAnyConfiguredPins
        ? undefined
        : fallbackStaffId,
    currentCustomerId:
      typeof state.currentCustomerId === 'string'
        ? state.currentCustomerId
        : undefined,
    cart: rawCart.map(item => {
      const entry = item as Record<string, unknown>;
      if (
        typeof entry.type === 'string' &&
        typeof entry.title === 'string' &&
        typeof entry.unitPriceInCents === 'number'
      ) {
        return item as CartItem;
      }
      return {
        id: createId('cart'),
        type: 'product',
        productId:
          typeof entry.productId === 'string' ? entry.productId : undefined,
        title: '',
        quantity: typeof entry.quantity === 'number' ? entry.quantity : 1,
        unitPriceInCents: 0,
        taxable: true,
      } as CartItem;
    }),
    transactions: (state.transactions ?? []).map(transaction => ({
      ...transaction,
      taxLines: Array.isArray(transaction.taxLines)
        ? (transaction.taxLines as TaxLine[])
        : undefined,
      refundedAmount:
        typeof transaction.refundedAmount === 'number'
          ? transaction.refundedAmount
          : 0,
      refundRecords: Array.isArray(transaction.refundRecords)
        ? (transaction.refundRecords as RefundRecord[])
        : [],
      paymentDetails:
        transaction.paymentDetails &&
        typeof transaction.paymentDetails === 'object'
          ? (transaction.paymentDetails as StripePaymentDetails)
          : undefined,
      customer:
        transaction.customer && typeof transaction.customer === 'object'
          ? transaction.customer
          : undefined,
    })),
    settings: {
      ...initialPOSState.settings,
      ...(state.settings ?? {}),
      business: {
        ...initialPOSState.settings.business,
        ...(state.settings?.business ?? {}),
        taxDefinitions: Array.isArray(state.settings?.business?.taxDefinitions)
          ? state.settings.business.taxDefinitions.map(tax =>
              normalizeTaxDefinition(tax),
            )
          : initialPOSState.settings.business.taxDefinitions,
      },
      hardware: {
        ...initialPOSState.settings.hardware,
        ...(state.settings?.hardware ?? {}),
      },
      appearanceMode:
        state.settings?.appearanceMode === 'light' ||
        state.settings?.appearanceMode === 'dark' ||
        state.settings?.appearanceMode === 'system'
          ? state.settings.appearanceMode
          : initialPOSState.settings.appearanceMode,
    },
  };
}

function roundCurrency(value: number): number {
  return Math.round(value);
}

function calculateCartTotals(state: POSState) {
  const subtotal = state.cart.reduce(
    (sum, item) => sum + item.unitPriceInCents * item.quantity,
    0,
  );
  const enabledTaxes = state.settings.business.taxDefinitions.filter(
    tax => tax.enabled,
  );
  const defaultTaxRate =
    enabledTaxes.reduce((sum, tax) => sum + tax.rate, 0) ||
    state.settings.business.defaultTaxRate;
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

    return enabledTaxes.length ? enabledTaxes : fallbackTaxes;
  }

  state.cart.forEach(item => {
    if (!item.taxable) {
      return;
    }

    const itemAmount = item.unitPriceInCents * item.quantity;
    getApplicableTaxes(item).forEach(taxDef => {
      const amount = roundCurrency(itemAmount * (taxDef.rate / 100));
      if (!amount) {
        return;
      }

      const taxId = 'taxId' in taxDef ? taxDef.taxId : taxDef.id;
      const existing = taxLinesById.get(taxId);
      if (existing) {
        taxLinesById.set(taxId, {
          ...existing,
          amount: existing.amount + amount,
        });
        return;
      }

      taxLinesById.set(taxId, {
        taxId,
        name: taxDef.name,
        rate: taxDef.rate,
        amount,
      });
    });
  });

  const taxLines = Array.from(taxLinesById.values());
  const tax = taxLines.reduce((sum, line) => sum + line.amount, 0);
  return { subtotal, tax, taxLines, total: subtotal + tax };
}

function calculatePreDiscountTotals(state: POSState) {
  const baseItems = state.cart.filter(item => item.type !== 'discount');
  const subtotal = baseItems.reduce(
    (sum, item) => sum + item.unitPriceInCents * item.quantity,
    0,
  );
  const taxRate = state.settings.business.defaultTaxRate / 100;
  const taxableSubtotal = baseItems.reduce((sum, item) => {
    return item.taxable ? sum + item.unitPriceInCents * item.quantity : sum;
  }, 0);
  const tax = roundCurrency(taxableSubtotal * taxRate);
  return { subtotal, tax, total: subtotal + tax };
}

function createTransactionItems(state: POSState): TransactionItem[] {
  return state.cart.map(item => ({
    id: item.id,
    type: item.type,
    productId: item.productId,
    name: item.title,
    sku: item.sku,
    quantity: item.quantity,
    unitPriceInCents: item.unitPriceInCents,
    taxable: item.taxable,
    note: item.note,
    metadata: item.metadata,
  }));
}

function posReducer(state: POSState, action: POSAction): POSState {
  switch (action.type) {
    case 'hydrate':
      return normalizeState(action.payload);
    case 'addProductToCart': {
      const product = state.products.find(
        entry => entry.id === action.payload.productId,
      );
      if (!product || !product.active) {
        return state;
      }
      if (product.trackInventory && product.inventory < 0) {
        return state;
      }

      const quantity = Math.max(0.001, action.payload.quantity ?? 1);
      const unitPriceInCents =
        action.payload.unitPriceInCents ?? product.priceInCents;
      const title = action.payload.title?.trim() || product.name;
      const note = action.payload.note?.trim() || undefined;
      const metadata = action.payload.metadata;
      const hasCustomizations =
        !!note ||
        unitPriceInCents !== product.priceInCents ||
        title !== product.name ||
        !!metadata?.selectedOptions?.length ||
        !!metadata?.selectedModifiers?.length;

      const existing = hasCustomizations
        ? undefined
        : state.cart.find(
            item =>
              item.type === 'product' &&
              item.productId === product.id &&
              !item.note &&
              !item.metadata?.soldByMass &&
              !item.metadata?.selectedOptions?.length &&
              !item.metadata?.selectedModifiers?.length,
          );
      const maxQuantity = product.trackInventory
        ? Math.max(product.inventory, 1)
        : 999;

      if (existing) {
        return {
          ...state,
          cart: state.cart.map(item =>
            item.id === existing.id
              ? {
                  ...item,
                  quantity: Math.min(item.quantity + quantity, maxQuantity),
                }
              : item,
          ),
        };
      }

      return {
        ...state,
        cart: [
          ...state.cart,
          {
            id: createId('cart'),
            type: 'product',
            productId: product.id,
            title,
            quantity: Math.min(quantity, maxQuantity),
            unitPriceInCents,
            taxable: product.taxable,
            sku: product.sku,
            note,
            metadata,
          },
        ],
      };
    }
    case 'addCustomAmountToCart': {
      if (action.payload.amountInCents <= 0) {
        return state;
      }

      return {
        ...state,
        cart: [
          ...state.cart,
          {
            id: createId('cart'),
            type: 'custom',
            title: 'Custom amount',
            quantity: 1,
            unitPriceInCents: action.payload.amountInCents,
            taxable: true,
            note: action.payload.note?.trim() || undefined,
          },
        ],
      };
    }
    case 'addDiscountToCart':
      return {
        ...state,
        cart: [...state.cart, action.payload.item],
      };
    case 'updateCartItemQuantity':
      return {
        ...state,
        cart: state.cart
          .map(item => {
            if (item.id !== action.payload.itemId) {
              return item;
            }

            const nextQuantity = Math.max(0, action.payload.quantity);
            if (item.type === 'product' && item.productId) {
              const product = state.products.find(
                entry => entry.id === item.productId,
              );
              const maxQuantity =
                product?.trackInventory && product
                  ? Math.max(product.inventory, 0)
                  : 999;
              return { ...item, quantity: Math.min(nextQuantity, maxQuantity) };
            }

            return { ...item, quantity: nextQuantity };
          })
          .filter(item => item.quantity > 0),
      };
    case 'removeCartItem':
      return {
        ...state,
        cart: state.cart.filter(item => item.id !== action.payload.itemId),
      };
    case 'clearCart':
      return { ...state, cart: [], currentCustomerId: undefined };
    case 'upsertProduct': {
      const normalized = normalizeProduct(action.payload);
      const exists = state.products.some(
        product => product.id === normalized.id,
      );
      return {
        ...state,
        products: exists
          ? state.products.map(product =>
              product.id === normalized.id ? normalized : product,
            )
          : [...state.products, normalized],
      };
    }
    case 'upsertModifierSet': {
      const normalized = normalizeModifierSet(action.payload);
      const exists = state.modifierSets.some(
        modifierSet => modifierSet.id === normalized.id,
      );
      return {
        ...state,
        modifierSets: exists
          ? state.modifierSets.map(modifierSet =>
              modifierSet.id === normalized.id ? normalized : modifierSet,
            )
          : [...state.modifierSets, normalized],
      };
    }
    case 'upsertDiscount': {
      const normalized = normalizeDiscount(action.payload);
      const exists = state.discounts.some(
        discount => discount.id === normalized.id,
      );
      return {
        ...state,
        discounts: exists
          ? state.discounts.map(discount =>
              discount.id === normalized.id ? normalized : discount,
            )
          : [...state.discounts, normalized],
      };
    }
    case 'deactivateProduct':
      return {
        ...state,
        products: state.products.map(product =>
          product.id === action.payload.productId
            ? { ...product, active: false }
            : product,
        ),
        cart: state.cart.filter(
          item => item.productId !== action.payload.productId,
        ),
      };
    case 'adjustInventory':
      return {
        ...state,
        products: state.products.map(product =>
          product.id === action.payload.productId
            ? {
                ...product,
                inventory: Math.max(
                  0,
                  product.inventory + action.payload.delta,
                ),
              }
            : product,
        ),
      };
    case 'upsertCustomer': {
      const normalized = normalizeCustomer(action.payload);
      if (!normalized.name) {
        return state;
      }
      const exists = state.customers.some(
        customer => customer.id === normalized.id,
      );
      return {
        ...state,
        customers: exists
          ? state.customers.map(customer =>
              customer.id === normalized.id ? normalized : customer,
            )
          : [normalized, ...state.customers],
        currentCustomerId: normalized.id,
      };
    }
    case 'selectCustomerForSale':
      return {
        ...state,
        currentCustomerId: action.payload.customerId,
      };
    case 'updateCustomerStripeId':
      return {
        ...state,
        customers: state.customers.map(customer =>
          customer.id === action.payload.customerId
            ? {
                ...customer,
                stripeCustomerId: action.payload.stripeCustomerId,
                syncStatus: 'synced',
                updatedAt: new Date().toISOString(),
              }
            : customer,
        ),
      };
    case 'completeSale': {
      const soldQuantities = new Map<string, number>();
      action.payload.items.forEach(item => {
        if (item.type === 'product' && item.productId) {
          soldQuantities.set(
            item.productId,
            (soldQuantities.get(item.productId) ?? 0) + item.quantity,
          );
        }
      });

      return {
        ...state,
        cart: [],
        currentCustomerId: undefined,
        products: state.products.map(product => {
          if (!product.trackInventory) {
            return product;
          }
          return {
            ...product,
            inventory: Math.max(
              0,
              product.inventory - (soldQuantities.get(product.id) ?? 0),
            ),
          };
        }),
        transactions: [action.payload, ...state.transactions],
      };
    }
    case 'refundTransaction': {
      const transaction = state.transactions.find(
        entry => entry.id === action.payload.transactionId,
      );
      if (!transaction) {
        return state;
      }
      if (action.payload.refund.status !== 'succeeded') {
        return {
          ...state,
          transactions: state.transactions.map(entry =>
            entry.id === transaction.id
              ? {
                  ...entry,
                  refundRecords: [
                    action.payload.refund,
                    ...(entry.refundRecords ?? []),
                  ],
                }
              : entry,
          ),
        };
      }
      const nextRefundedAmount = Math.min(
        transaction.total,
        (transaction.refundedAmount ?? 0) + action.payload.refund.amount,
      );
      const nextStatus =
        nextRefundedAmount >= transaction.total
          ? 'refunded'
          : 'partially_refunded';

      return {
        ...state,
        transactions: state.transactions.map(entry =>
          entry.id === transaction.id
            ? {
                ...entry,
                status: nextStatus,
                refundedAmount: nextRefundedAmount,
                refundRecords: [
                  action.payload.refund,
                  ...(entry.refundRecords ?? []),
                ],
              }
            : entry,
        ),
      };
    }
    case 'updateSettings':
      return { ...state, settings: action.payload };
    case 'upsertTaxDefinition': {
      const normalized = normalizeTaxDefinition(action.payload);
      const existing = state.settings.business.taxDefinitions.some(
        tax => tax.id === normalized.id,
      );
      const taxDefinitions = existing
        ? state.settings.business.taxDefinitions.map(tax =>
            tax.id === normalized.id ? normalized : tax,
          )
        : [...state.settings.business.taxDefinitions, normalized];
      return {
        ...state,
        settings: {
          ...state.settings,
          business: {
            ...state.settings.business,
            taxDefinitions,
            defaultTaxRate: taxDefinitions
              .filter(tax => tax.enabled)
              .reduce((sum, tax) => sum + tax.rate, 0),
          },
        },
      };
    }
    case 'deleteTaxDefinition': {
      const taxDefinitions = state.settings.business.taxDefinitions.filter(
        tax => tax.id !== action.payload.taxId,
      );
      return {
        ...state,
        products: state.products.map(product => ({
          ...product,
          taxIds: (product.taxIds ?? []).filter(
            id => id !== action.payload.taxId,
          ),
        })),
        settings: {
          ...state.settings,
          business: {
            ...state.settings.business,
            taxDefinitions,
            defaultTaxRate: taxDefinitions
              .filter(tax => tax.enabled)
              .reduce((sum, tax) => sum + tax.rate, 0),
          },
        },
      };
    }
    case 'unlockWithPin':
      return {
        ...state,
        currentStaffId: action.payload.staffId,
      };
    case 'lockSession':
      return {
        ...state,
        currentStaffId: undefined,
      };
    case 'updateStaffPin':
      return {
        ...state,
        staffMembers: state.staffMembers.map(staffMember =>
          staffMember.id === action.payload.staffId
            ? {
                ...staffMember,
                pinHash: action.payload.pinHash,
                pinSalt: action.payload.pinSalt,
              }
            : staffMember,
        ),
      };
    case 'upsertStaffProfile': {
      const exists = state.staffMembers.some(
        staffMember => staffMember.id === action.payload.id,
      );
      return {
        ...state,
        staffMembers: exists
          ? state.staffMembers.map(staffMember =>
              staffMember.id === action.payload.id
                ? action.payload
                : staffMember,
            )
          : [...state.staffMembers, action.payload],
      };
    }
    case 'deactivateStaffProfile':
      return {
        ...state,
        staffMembers: state.staffMembers.map(staffMember =>
          staffMember.id === action.payload.staffId
            ? { ...staffMember, active: false }
            : staffMember,
        ),
        currentStaffId:
          state.currentStaffId === action.payload.staffId
            ? undefined
            : state.currentStaffId,
      };
    case 'reconcileCatalog': {
      const serverProducts = action.payload.products.map(normalizeProduct);
      const retainedLocalProducts = state.products.filter(
        product => !isServerProductId(product.id),
      );
      const availableIds = new Set(
        [...serverProducts, ...retainedLocalProducts].map(
          product => product.id,
        ),
      );
      return {
        ...state,
        products: [...serverProducts, ...retainedLocalProducts],
        cart: state.cart.filter(
          item => !item.productId || availableIds.has(item.productId),
        ),
      };
    }
    case 'reconcileStaff': {
      const staff = action.payload.staff.map(normalizeStaffMember);
      return {
        ...state,
        staffMembers: staff,
        currentStaffId: staff.some(
          member => member.active && member.id === state.currentStaffId,
        )
          ? state.currentStaffId
          : undefined,
      };
    }
    case 'reconcileCustomers': {
      const serverCustomers = action.payload.customers.map(normalizeCustomer);
      const serverIds = new Set(serverCustomers.map(customer => customer.id));
      const serverStripeIds = new Set(
        serverCustomers.flatMap(customer =>
          customer.stripeCustomerId ? [customer.stripeCustomerId] : [],
        ),
      );
      const retainedLocal = state.customers.filter(
        customer =>
          !serverIds.has(customer.id) &&
          (!customer.stripeCustomerId ||
            !serverStripeIds.has(customer.stripeCustomerId)) &&
          customer.syncStatus !== 'synced',
      );
      const availableIds = new Set(
        [...serverCustomers, ...retainedLocal].map(customer => customer.id),
      );
      return {
        ...state,
        customers: [...serverCustomers, ...retainedLocal],
        currentCustomerId:
          state.currentCustomerId && availableIds.has(state.currentCustomerId)
            ? state.currentCustomerId
            : undefined,
      };
    }
    case 'updateTransactionSync':
      return {
        ...state,
        transactions: state.transactions.map(transaction =>
          transaction.id === action.payload.transactionId
            ? { ...transaction, ...action.payload.update }
            : transaction,
        ),
      };
    default:
      return state;
  }
}

export function POSProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(posReducer, initialPOSState);
  const [isHydrated, setIsHydrated] = useState(false);
  const [catalogSyncStatus, setCatalogSyncStatus] = useState<
    'idle' | 'syncing' | 'synced' | 'error'
  >('idle');
  const [catalogSyncError, setCatalogSyncError] = useState<string | null>(null);
  const [lastCatalogSyncAt, setLastCatalogSyncAt] = useState<string | null>(
    null,
  );
  const lastCatalogSyncAtRef = useRef<string | null>(null);
  const [staffSyncStatus, setStaffSyncStatus] = useState<
    'idle' | 'syncing' | 'synced' | 'error'
  >('idle');
  const [staffSyncError, setStaffSyncError] = useState<string | null>(null);
  const [lastStaffSyncAt, setLastStaffSyncAt] = useState<string | null>(null);
  const lastStaffSyncAtRef = useRef<string | null>(null);
  const [customerSyncStatus, setCustomerSyncStatus] = useState<
    'idle' | 'syncing' | 'synced' | 'error'
  >('idle');
  const [customerSyncError, setCustomerSyncError] = useState<string | null>(
    null,
  );
  const [lastCustomerSyncAt, setLastCustomerSyncAt] = useState<string | null>(
    null,
  );
  const lastCustomerSyncAtRef = useRef<string | null>(null);

  const syncCatalog = useCallback(async () => {
    setCatalogSyncStatus('syncing');
    setCatalogSyncError(null);
    try {
      const result = await fetchCatalog();
      dispatch({
        type: 'reconcileCatalog',
        payload: { products: result.products },
      });
      lastCatalogSyncAtRef.current = result.syncedAt;
      setLastCatalogSyncAt(result.syncedAt);
      setCatalogSyncStatus('synced');
    } catch (error) {
      setCatalogSyncStatus('error');
      setCatalogSyncError(
        error instanceof Error ? error.message : 'Unable to sync items.',
      );
      throw error;
    }
  }, []);

  const syncStaff = useCallback(async () => {
    setStaffSyncStatus('syncing');
    setStaffSyncError(null);
    try {
      const result = await fetchStaff();
      dispatch({ type: 'reconcileStaff', payload: { staff: result.staff } });
      lastStaffSyncAtRef.current = result.syncedAt;
      setLastStaffSyncAt(result.syncedAt);
      setStaffSyncStatus('synced');
    } catch (error) {
      setStaffSyncStatus('error');
      setStaffSyncError(
        error instanceof Error ? error.message : 'Unable to sync people.',
      );
      throw error;
    }
  }, []);

  const syncCustomers = useCallback(async () => {
    setCustomerSyncStatus('syncing');
    setCustomerSyncError(null);
    try {
      const result = await fetchCustomers();
      dispatch({
        type: 'reconcileCustomers',
        payload: { customers: result.customers },
      });
      lastCustomerSyncAtRef.current = result.syncedAt;
      setLastCustomerSyncAt(result.syncedAt);
      setCustomerSyncStatus('synced');
    } catch (error) {
      setCustomerSyncStatus('error');
      setCustomerSyncError(
        error instanceof Error ? error.message : 'Unable to sync customers.',
      );
      throw error;
    }
  }, []);

  useEffect(() => {
    async function hydrate() {
      const storedState = await loadPOSState();
      if (storedState) {
        dispatch({ type: 'hydrate', payload: storedState });
      }
      setIsHydrated(true);
    }

    hydrate();
  }, []);

  useEffect(() => {
    if (isHydrated) {
      savePOSState(state);
    }
  }, [isHydrated, state]);

  useEffect(() => {
    if (!isHydrated || isTestRuntime) return;

    syncCatalog().catch(() => undefined);
    syncStaff().catch(() => undefined);
    syncCustomers().catch(() => undefined);
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') return;
      const lastSync = lastCatalogSyncAtRef.current
        ? Date.parse(lastCatalogSyncAtRef.current)
        : 0;
      if (!lastSync || Date.now() - lastSync > 60_000) {
        syncCatalog().catch(() => undefined);
      }
      const lastStaffSync = lastStaffSyncAtRef.current
        ? Date.parse(lastStaffSyncAtRef.current)
        : 0;
      if (!lastStaffSync || Date.now() - lastStaffSync > 60_000)
        syncStaff().catch(() => undefined);
      const lastCustomerSync = lastCustomerSyncAtRef.current
        ? Date.parse(lastCustomerSyncAtRef.current)
        : 0;
      if (!lastCustomerSync || Date.now() - lastCustomerSync > 60_000)
        syncCustomers().catch(() => undefined);
    });

    return () => subscription.remove();
  }, [isHydrated, syncCatalog, syncCustomers, syncStaff]);

  const { subtotal, tax, taxLines, total } = useMemo(
    () => calculateCartTotals(state),
    [state],
  );
  const saleItemCount = useMemo(
    () => state.cart.reduce((sum, item) => sum + item.quantity, 0),
    [state.cart],
  );
  const selectedCustomer = useMemo(
    () =>
      state.currentCustomerId
        ? state.customers.find(
            customer => customer.id === state.currentCustomerId,
          )
        : undefined,
    [state.currentCustomerId, state.customers],
  );
  const currentStaff = useMemo(() => {
    if (state.currentStaffId) {
      return state.staffMembers.find(
        staffMember => staffMember.id === state.currentStaffId,
      );
    }

    const activeStaffWithoutPins = state.staffMembers.filter(
      staffMember => staffMember.active && !hasConfiguredPin(staffMember),
    );

    return (
      activeStaffWithoutPins.find(
        staffMember => staffMember.role === 'owner',
      ) ?? activeStaffWithoutPins[0]
    );
  }, [state.currentStaffId, state.staffMembers]);

  const value = useMemo<POSContextValue>(() => {
    return {
      state,
      isHydrated,
      activeProducts: state.products.filter(product => product.active),
      modifierSets: state.modifierSets,
      activeDiscounts: state.discounts.filter(discount => discount.active),
      favoriteProducts: state.products.filter(
        product => product.active && product.isFavorite,
      ),
      currentStaff,
      isStaffAuthenticated: !!currentStaff,
      saleItemCount,
      subtotal,
      tax,
      taxLines,
      total,
      selectedCustomer,
      catalogSyncStatus,
      catalogSyncError,
      lastCatalogSyncAt,
      syncCatalog,
      staffSyncStatus,
      staffSyncError,
      lastStaffSyncAt,
      syncStaff,
      customerSyncStatus,
      customerSyncError,
      lastCustomerSyncAt,
      syncCustomers,
      updateTransactionSync: (transactionId, update) =>
        dispatch({
          type: 'updateTransactionSync',
          payload: { transactionId, update },
        }),
      addProductToCart: (productId, input) =>
        dispatch({
          type: 'addProductToCart',
          payload: { productId, ...input },
        }),
      addCustomAmountToCart: (amountInCents, note) =>
        dispatch({
          type: 'addCustomAmountToCart',
          payload: { amountInCents, note },
        }),
      addDiscountToCart: (discountId, authorizedByStaffId) => {
        const discount = state.discounts.find(
          entry => entry.id === discountId && entry.active,
        );
        if (!discount) {
          return { ok: false, message: 'Discount not found.' };
        }

        const baseTotals = calculatePreDiscountTotals(state);
        const basis = discount.applyAfterTaxes
          ? baseTotals.total
          : baseTotals.subtotal;
        const amountInCents =
          discount.type === 'percentage'
            ? roundCurrency(basis * (discount.amount / 100))
            : roundCurrency(discount.amount);

        if (amountInCents <= 0) {
          return {
            ok: false,
            message: 'Discount amount must be greater than zero.',
          };
        }

        dispatch({
          type: 'addDiscountToCart',
          payload: {
            item: {
              id: createId('cart'),
              type: 'discount',
              discountId: discount.id,
              title: discount.name,
              quantity: 1,
              unitPriceInCents: -amountInCents,
              taxable: !discount.applyAfterTaxes,
              metadata: {
                discountType: discount.type,
                applyAfterTaxes: discount.applyAfterTaxes,
                authorizedByStaffId,
              },
            },
          },
        });
        return { ok: true };
      },
      updateCartItemQuantity: (itemId, quantity) =>
        dispatch({
          type: 'updateCartItemQuantity',
          payload: { itemId, quantity },
        }),
      removeCartItem: itemId =>
        dispatch({ type: 'removeCartItem', payload: { itemId } }),
      clearCart: () => dispatch({ type: 'clearCart' }),
      upsertProduct: product =>
        dispatch({ type: 'upsertProduct', payload: product }),
      upsertModifierSet: modifierSet =>
        dispatch({ type: 'upsertModifierSet', payload: modifierSet }),
      deactivateProduct: productId =>
        dispatch({ type: 'deactivateProduct', payload: { productId } }),
      adjustInventory: (productId, delta) =>
        dispatch({ type: 'adjustInventory', payload: { productId, delta } }),
      upsertDiscount: discount =>
        dispatch({ type: 'upsertDiscount', payload: discount }),
      upsertCustomer: customer =>
        dispatch({ type: 'upsertCustomer', payload: customer }),
      selectCustomerForSale: customerId =>
        dispatch({ type: 'selectCustomerForSale', payload: { customerId } }),
      updateCustomerStripeId: (customerId, stripeCustomerId) =>
        dispatch({
          type: 'updateCustomerStripeId',
          payload: { customerId, stripeCustomerId },
        }),
      createApprovedTransaction: ({
        paymentMethod,
        transactionReference,
        paymentProvider,
        processorReference,
        paymentDetails,
        cashDetails,
      }) => {
        if (
          !state.cart.length ||
          !staffHasPermission(currentStaff, 'process_sales')
        ) {
          return null;
        }

        const items = createTransactionItems(state);
        const transaction: Transaction = {
          id: transactionReference,
          createdAt: new Date().toISOString(),
          subtotal,
          tax,
          taxLines,
          total,
          currency: state.settings.business.currency,
          paymentMethod,
          paymentProvider,
          processorReference,
          status: 'approved',
          customer: selectedCustomer
            ? {
                id: selectedCustomer.id,
                name: selectedCustomer.name,
                email: selectedCustomer.email,
                phone: selectedCustomer.phone,
                stripeCustomerId:
                  paymentDetails?.stripeCustomerId ||
                  selectedCustomer.stripeCustomerId,
              }
            : undefined,
          refundedAmount: 0,
          refundRecords: [],
          paymentDetails,
          cashDetails:
            paymentMethod === 'cash'
              ? cashDetails ?? { receivedInCents: total, changeGivenInCents: 0 }
              : undefined,
          staff: currentStaff
            ? { id: currentStaff.id, name: currentStaff.name }
            : undefined,
          serverSyncStatus: 'pending',
          items,
        };

        dispatch({ type: 'completeSale', payload: transaction });
        return transaction;
      },
      refundTransaction: (transactionId, refund) =>
        dispatch({
          type: 'refundTransaction',
          payload: { transactionId, refund },
        }),
      updateTaxRate: taxRate =>
        dispatch({
          type: 'updateSettings',
          payload: {
            ...state.settings,
            business: {
              ...state.settings.business,
              defaultTaxRate: Math.max(
                0,
                Number.isFinite(taxRate) ? taxRate : 0,
              ),
            },
          },
        }),
      upsertTaxDefinition: tax =>
        dispatch({ type: 'upsertTaxDefinition', payload: tax }),
      deleteTaxDefinition: taxId =>
        dispatch({ type: 'deleteTaxDefinition', payload: { taxId } }),
      updateBusinessName: name =>
        dispatch({
          type: 'updateSettings',
          payload: {
            ...state.settings,
            business: {
              ...state.settings.business,
              businessName: name || state.settings.business.businessName,
            },
          },
        }),
      updateAppearanceMode: mode =>
        dispatch({
          type: 'updateSettings',
          payload: {
            ...state.settings,
            appearanceMode: mode,
          },
        }),
      unlockWithPin: (pin, staffId) => {
        const matchedStaff = state.staffMembers.find(staffMember => {
          if (!staffMember.active) {
            return false;
          }
          if (!hasConfiguredPin(staffMember)) {
            return false;
          }
          if (staffId && staffMember.id !== staffId) {
            return false;
          }
          return verifyPin({
            pin,
            pinHash: staffMember.pinHash,
            pinSalt: staffMember.pinSalt,
          });
        });
        if (!matchedStaff) {
          return null;
        }
        dispatch({
          type: 'unlockWithPin',
          payload: { staffId: matchedStaff.id },
        });
        return matchedStaff;
      },
      authorizeManagerPin: pin => {
        const matchedStaff = state.staffMembers.find(staffMember => {
          if (!staffHasPermission(staffMember, 'issue_refunds')) {
            return false;
          }
          if (!hasConfiguredPin(staffMember)) {
            return false;
          }
          return verifyPin({
            pin,
            pinHash: staffMember.pinHash,
            pinSalt: staffMember.pinSalt,
          });
        });
        return matchedStaff ?? null;
      },
      authorizePermissionPin: (pin, permission) =>
        state.staffMembers.find(
          staffMember =>
            staffHasPermission(staffMember, permission) &&
            hasConfiguredPin(staffMember) &&
            verifyPin({
              pin,
              pinHash: staffMember.pinHash,
              pinSalt: staffMember.pinSalt,
            }),
        ) ?? null,
      hasPermission: (permission, staffMember = currentStaff) =>
        staffHasPermission(staffMember, permission),
      lockSession: () => dispatch({ type: 'lockSession' }),
      updateCurrentStaffPin: (currentPin, nextPin) => {
        if (!currentStaff) {
          return {
            ok: false,
            message: 'No staff member is currently signed in.',
          };
        }

        const normalizedCurrentPin = currentPin.trim();
        const normalizedNextPin = nextPin.trim();
        const requiresCurrentPin = hasConfiguredPin(currentStaff);

        if (
          requiresCurrentPin &&
          !verifyPin({
            pin: normalizedCurrentPin,
            pinHash: currentStaff.pinHash,
            pinSalt: currentStaff.pinSalt,
          })
        ) {
          return { ok: false, message: 'Current PIN is incorrect.' };
        }

        if (!/^\d{4}$/.test(normalizedNextPin)) {
          return { ok: false, message: 'New PIN must be exactly 4 digits.' };
        }

        const nextCredentials = createPinCredentials(normalizedNextPin);

        dispatch({
          type: 'updateStaffPin',
          payload: {
            staffId: currentStaff.id,
            pinHash: nextCredentials.pinHash,
            pinSalt: nextCredentials.pinSalt,
          },
        });
        return { ok: true };
      },
      createStaffProfile: ({ name, role, pin }) => {
        const normalizedName = name.trim();
        const normalizedPin = pin.trim();

        if (!normalizedName) {
          return { ok: false, message: 'Staff name is required.' };
        }

        if (!/^\d{4}$/.test(normalizedPin)) {
          return { ok: false, message: 'PIN must be exactly 4 digits.' };
        }

        const duplicateName = state.staffMembers.some(
          staffMember =>
            staffMember.active &&
            staffMember.name.toLowerCase() === normalizedName.toLowerCase(),
        );
        if (duplicateName) {
          return {
            ok: false,
            message: 'A staff profile with that name already exists.',
          };
        }

        const credentials = createPinCredentials(normalizedPin);
        dispatch({
          type: 'upsertStaffProfile',
          payload: {
            id: createId('staff'),
            name: normalizedName,
            role,
            active: true,
            pinHash: credentials.pinHash,
            pinSalt: credentials.pinSalt,
          },
        });
        return { ok: true };
      },
      updateStaffProfile: ({ staffId, name, role }) => {
        const normalizedName = name.trim();
        const target = state.staffMembers.find(
          staffMember => staffMember.id === staffId,
        );

        if (!target) {
          return { ok: false, message: 'Staff profile not found.' };
        }

        if (!normalizedName) {
          return { ok: false, message: 'Staff name is required.' };
        }

        const duplicateName = state.staffMembers.some(
          staffMember =>
            staffMember.id !== staffId &&
            staffMember.active &&
            staffMember.name.toLowerCase() === normalizedName.toLowerCase(),
        );
        if (duplicateName) {
          return {
            ok: false,
            message: 'Another staff profile already uses that name.',
          };
        }

        dispatch({
          type: 'upsertStaffProfile',
          payload: {
            ...target,
            name: normalizedName,
            role,
          },
        });
        return { ok: true };
      },
      deleteStaffProfile: staffId => {
        const target = state.staffMembers.find(
          staffMember => staffMember.id === staffId,
        );

        if (!target || !target.active) {
          return { ok: false, message: 'Staff profile not found.' };
        }

        if (currentStaff?.id === staffId) {
          return {
            ok: false,
            message: 'You cannot delete the profile that is signed in.',
          };
        }

        if (target.role === 'owner') {
          const activeOwners = state.staffMembers.filter(
            staffMember => staffMember.active && staffMember.role === 'owner',
          );
          if (activeOwners.length <= 1) {
            return {
              ok: false,
              message: 'You must keep at least one owner profile.',
            };
          }
        }

        dispatch({
          type: 'deactivateStaffProfile',
          payload: { staffId },
        });
        return { ok: true };
      },
    };
  }, [
    currentStaff,
    catalogSyncError,
    catalogSyncStatus,
    isHydrated,
    lastCatalogSyncAt,
    lastStaffSyncAt,
    staffSyncError,
    staffSyncStatus,
    syncCatalog,
    syncStaff,
    customerSyncError,
    customerSyncStatus,
    lastCustomerSyncAt,
    syncCustomers,
    saleItemCount,
    selectedCustomer,
    state,
    subtotal,
    tax,
    taxLines,
    total,
  ]);

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>;
}

export function usePOS() {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error('usePOS must be used within POSProvider');
  }
  return context;
}

export function createEmptyProduct(overrides?: Partial<Product>): Product {
  return {
    id: createId('prod'),
    name: '',
    description: '',
    priceInCents: 0,
    unitType: 'item',
    massUnit: 'kg',
    currency: 'CAD',
    category: 'Items',
    sku: '',
    inventory: 0,
    taxable: true,
    active: true,
    isFavorite: false,
    trackInventory: false,
    taxIds: [],
    optionSets: [],
    modifierSetIds: [],
    imageUri: '',
    imagePlaceholder: 'PO',
    tileColor: '',
    tileLabel: '',
    ...overrides,
  };
}

export function createEmptyDiscount(overrides?: Partial<Discount>): Discount {
  return {
    id: createId('disc'),
    name: '',
    type: 'fixed',
    amount: 0,
    requirePasscode: false,
    applyAfterTaxes: false,
    active: true,
    ...overrides,
  };
}
