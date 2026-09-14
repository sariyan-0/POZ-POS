export const apiConfig = {
  endpoints: {
    health: '/api/health',
    claimDevice: '/api/devices/claim',
    currentDevice: '/api/devices/current',
    terminalConnectionToken: '/api/terminal/connection-token',
    terminalLocations: '/api/terminal/locations',
    createPaymentIntent: '/api/payments/create-intent',
    createPayment: '/api/payments/create',
    createRefund: '/api/refunds/create',
    searchCustomers: '/api/customers/search',
    createCustomer: '/api/customers/create',
    customers: '/api/customers',
    catalog: '/api/catalog',
    orders: '/api/orders',
    staff: '/api/staff',
  },
} as const;
