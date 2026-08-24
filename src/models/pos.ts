export type CurrencyCode = 'CAD';

export interface Product {
  id: string;
  name: string;
  description: string;
  priceInCents: number;
  currency: CurrencyCode;
  category: string;
  sku: string;
  inventory: number;
  taxable: boolean;
  active: boolean;
  isFavorite: boolean;
  trackInventory: boolean;
  taxIds?: string[];
  optionSets?: ProductOptionSet[];
  modifierSetIds?: string[];
  imageUri?: string;
  imagePlaceholder?: string;
  tileColor?: string;
  tileLabel?: string;
}

export interface ProductOptionValue {
  id: string;
  name: string;
}

export interface ProductOptionSet {
  id: string;
  name: string;
  displayName: string;
  values: ProductOptionValue[];
}

export interface ModifierSetItem {
  id: string;
  name: string;
  priceAdjustmentInCents: number;
}

export interface ModifierSet {
  id: string;
  name: string;
  itemIds?: string[];
  modifiers: ModifierSetItem[];
}

export type DiscountType = 'fixed' | 'percentage';

export interface Discount {
  id: string;
  name: string;
  type: DiscountType;
  amount: number;
  requirePasscode: boolean;
  applyAfterTaxes: boolean;
  active: boolean;
}

export type CartItemType = 'product' | 'custom' | 'discount';

export interface CartItem {
  id: string;
  type: CartItemType;
  productId?: string;
  discountId?: string;
  title: string;
  quantity: number;
  unitPriceInCents: number;
  taxable: boolean;
  note?: string;
  sku?: string;
  metadata?: {
    discountType?: DiscountType;
    applyAfterTaxes?: boolean;
    authorizedByStaffId?: string;
    selectedOptions?: Array<{
      optionSetId: string;
      optionSetName: string;
      valueId: string;
      valueName: string;
    }>;
    selectedModifiers?: Array<{
      modifierSetId: string;
      modifierSetName: string;
      modifierId: string;
      modifierName: string;
      priceAdjustmentInCents: number;
    }>;
  };
}

export type PaymentMethod = 'card_reader' | 'tap_to_pay' | 'cash';
export type PaymentStatus =
  | 'pending'
  | 'approved'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded';

export interface StripePaymentDetails {
  paymentIntentId?: string;
  chargeId?: string;
  stripeCustomerId?: string;
  cardBrand?: string;
  last4?: string;
  cardPresentType?: 'card_present' | 'interac_present';
  readerLabel?: string;
  readerType?: string;
  terminalLocationId?: string;
  sourceLabel?: string;
}

export interface Customer {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  email?: string;
  phone?: string;
  note?: string;
  stripeCustomerId?: string;
  syncStatus?: 'local' | 'synced' | 'failed';
}

export interface StaffMember {
  id: string;
  name: string;
  pinHash: string;
  pinSalt: string;
  role: 'owner' | 'manager' | 'cashier';
  active: boolean;
}

export interface TransactionCustomerSnapshot {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  stripeCustomerId?: string;
}

export interface RefundRecord {
  id: string;
  createdAt: string;
  amount: number;
  status: 'succeeded' | 'pending' | 'failed';
  type: 'remote' | 'in_person';
  reason?: string;
  note?: string;
  processorReference?: string;
}

export interface TransactionItem {
  id: string;
  type: CartItemType;
  productId?: string;
  name: string;
  sku?: string;
  quantity: number;
  unitPriceInCents: number;
  taxable: boolean;
  note?: string;
}

export interface Transaction {
  id: string;
  createdAt: string;
  subtotal: number;
  tax: number;
  total: number;
  currency: CurrencyCode;
  paymentMethod: PaymentMethod;
  paymentProvider?: 'mock' | 'stripe_terminal';
  processorReference?: string;
  status: PaymentStatus;
  customer?: TransactionCustomerSnapshot;
  refundedAmount?: number;
  refundRecords?: RefundRecord[];
  paymentDetails?: StripePaymentDetails;
  items: TransactionItem[];
}

export interface BusinessSettings {
  businessName: string;
  currency: CurrencyCode;
  defaultTaxRate: number;
  taxDefinitions: TaxDefinition[];
}

export interface TaxDefinition {
  id: string;
  name: string;
  rate: number;
  enabled: boolean;
}

export interface HardwareSettings {
  readerLabel: string;
  readerStatus: string;
  readerBatteryLevel: number;
}

export type AppearanceMode = 'system' | 'light' | 'dark';

export interface AppSettings {
  business: BusinessSettings;
  hardware: HardwareSettings;
  appearanceMode: AppearanceMode;
  mockPaymentMode: true;
}

export interface POSState {
  products: Product[];
  modifierSets: ModifierSet[];
  discounts: Discount[];
  cart: CartItem[];
  currentCustomerId?: string;
  customers: Customer[];
  staffMembers: StaffMember[];
  currentStaffId?: string;
  transactions: Transaction[];
  settings: AppSettings;
}

export interface PaymentIntentDraft {
  amount: number;
  currency: CurrencyCode;
}

export interface PaymentAttempt {
  id: string;
  amount: number;
  currency: CurrencyCode;
  method: PaymentMethod;
}

export interface ProcessedPayment {
  paymentId: string;
  status: Exclude<PaymentStatus, 'pending' | 'refunded'>;
  transactionReference: string;
}
