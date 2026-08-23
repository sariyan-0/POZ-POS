import { AppSettings, POSState } from '../models/pos';
import { createPinCredentials } from '../utils/pin';

const defaultOwnerCredentials = createPinCredentials('1234');

export const defaultSettings: AppSettings = {
  business: {
    businessName: 'Powers of Zero',
    currency: 'CAD',
    defaultTaxRate: 13,
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
  discounts: [],
  cart: [],
  currentCustomerId: undefined,
  customers: [],
  staffMembers: [
    {
      id: 'staff-owner',
      name: 'Store Owner',
      pinHash: defaultOwnerCredentials.pinHash,
      pinSalt: defaultOwnerCredentials.pinSalt,
      role: 'owner',
      active: true,
    },
  ],
  currentStaffId: undefined,
  transactions: [],
  settings: defaultSettings,
};
