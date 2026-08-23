import { AppSettings, POSState } from '../models/pos';

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
  mockPaymentMode: true,
};

export const initialPOSState: POSState = {
  products: [],
  cart: [],
  currentCustomerId: undefined,
  customers: [],
  transactions: [],
  settings: defaultSettings,
};
