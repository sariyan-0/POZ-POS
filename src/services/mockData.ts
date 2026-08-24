import { AppSettings, POSState } from '../models/pos';

export const defaultSettings: AppSettings = {
  business: {
    businessName: 'Powers of Zero',
    currency: 'CAD',
    defaultTaxRate: 13,
    taxDefinitions: [
      {
        id: 'tax-hst',
        name: 'HST',
        rate: 13,
        enabled: true,
      },
    ],
  },
  hardware: {
    readerLabel: 'WisePad 3',
    readerStatus: 'Connected',
    readerBatteryLevel: 87,
  },
  appearanceMode: 'system',
  mockPaymentMode: true,
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
  currentStaffId: 'staff-owner',
  transactions: [],
  settings: defaultSettings,
};
