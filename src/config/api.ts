export const apiConfig = {
  endpoints: {
    health: '/api/health',
    terminalConnectionToken: '/api/terminal/connection-token',
    terminalLocations: '/api/terminal/locations',
    createPaymentIntent: '/api/payments/create-intent',
    createPayment: '/api/payments/create',
    createRefund: '/api/refunds/create',
    searchCustomers: '/api/customers/search',
    createCustomer: '/api/customers/create',
  },
} as const;
