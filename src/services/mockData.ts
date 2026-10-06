import { AppSettings, POSState } from '../models/pos';

export const defaultSettings: AppSettings = {
  business: {
    businessName: 'OneRegister',
    currency: 'CAD',
    defaultTaxRate: 0,
    taxDefinitions: [],
  },
  hardware: {
    readerLabel: 'No reader',
    readerStatus: 'Disconnected',
    readerBatteryLevel: 0,
  },
  appearanceMode: 'system',
  mockPaymentMode: false,
};

export const initialPOSState: POSState = {
  products: [],
  modifierSets: [],
  discounts: [],
  cart: [],
  currentCustomerId: undefined,
  customers: [],
  staffMembers: [
    {
      id: 'staff-owner',
      name: 'Store Owner',
      pinHash: '',
      pinSalt: '',
      role: 'owner',
      active: true,
    },
  ],
  currentStaffId: undefined,
  transactions: [],
  settings: defaultSettings,
};
