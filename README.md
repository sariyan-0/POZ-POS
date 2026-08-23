# PowersOfZeroPOS

<div align="center">

### Modern mobile point-of-sale built with React Native

Checkout, local transaction history, inventory tools, backend connectivity, and Stripe Terminal reader workflows in one app.

![React Native](https://img.shields.io/badge/React%20Native-0.87-111827?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-6.x-111827?style=for-the-badge&logo=typescript&logoColor=3178C6)
![Stripe Terminal](https://img.shields.io/badge/Stripe%20Terminal-Integrated-111827?style=for-the-badge&logo=stripe&logoColor=635BFF)
![Platform](https://img.shields.io/badge/iOS%20%26%20Android-Supported-111827?style=for-the-badge)

</div>

---

## Overview

**PowersOfZeroPOS** is a React Native mobile POS application designed for fast in-person checkout and operational simplicity. It combines a touch-first checkout flow, product and inventory management, locally persisted sales data, configurable backend connectivity, and Stripe Terminal reader support for in-person payments.

The app is structured to work well both as a realistic product prototype and as a strong foundation for production POS development.

## Highlights

| Area | What it does |
| --- | --- |
| Checkout | Supports keypad-based custom amounts, product library browsing, favorites, notes, and sale review flows |
| Transactions | Stores completed sales locally and shows detailed transaction history with payment metadata |
| Refunds | Supports refund flows from transaction details, including Stripe Terminal-linked refund handling |
| Inventory | Lets staff manage products, stock, and item visibility from within the app |
| Backend | Includes backend URL and POS API key configuration with live connection testing |
| Readers | Includes Stripe Terminal setup, reader discovery, location selection, connection, and diagnostics |
| Persistence | Hydrates and saves POS state locally for a native app experience |

## Feature Set

### Checkout experience

- Keypad mode for quick custom amount entry
- Product library and favorites tabs
- Add notes to custom amount entries
- Review current sale before payment
- Customer selection and cart state management

### Operations and management

- Product creation and editing
- Inventory adjustments
- Business settings and tax configuration
- Transaction detail view with line items, totals, and refund history

### Payments

- Mock payment flow for testing and development
- Stripe Terminal integration for in-person reader payments
- Reader discovery, connection status, battery visibility, and reconnect handling
- Support for card-present transaction metadata and reader-aware refunds

### Connectivity

- Configurable backend server URL
- POS API key storage using secure credential handling
- Health-check based backend verification
- Safe normalization for development and production backend URLs

## Tech Stack

| Layer | Tools |
| --- | --- |
| Mobile app | React Native 0.87, React 19 |
| Language | TypeScript |
| Navigation | React Navigation |
| Storage | AsyncStorage |
| Secure credentials | react-native-keychain |
| Payments | `@stripe/stripe-terminal-react-native` |
| Testing | Jest |

## App Structure

```text
PowersOfZeroPOS/
├── App.tsx
├── src/
│   ├── components/
│   ├── config/
│   ├── context/
│   ├── navigation/
│   ├── screens/
│   ├── services/
│   ├── storage/
│   ├── terminal/
│   └── utils/
├── android/
├── ios/
└── __tests__/
```

## Screens Included

- `Checkout`
- `Transactions`
- `Money`
- `Orders`
- `More`
- `Items`
- `Inventory`
- `Settings`
- `Backend / Server`
- `Readers`
- `Transaction Details`

## Getting Started

### Prerequisites

Make sure your machine is ready for React Native CLI development:

- Node.js `>= 22.11.0`
- npm
- Xcode for iOS development
- Android Studio for Android development
- CocoaPods for iOS native dependencies

Follow the official React Native environment setup guide if needed:

- https://reactnative.dev/docs/set-up-your-environment

### Installation

```bash
npm install
```

For iOS, install pods after dependencies are installed:

```bash
bundle install
bundle exec pod install --project-directory=ios
```

### Run the app

Start Metro:

```bash
npm start
```

Run on Android:

```bash
npm run android
```

Run on iOS:

```bash
npm run ios
```

## Backend Configuration

The app includes a built-in **Backend / Server** settings screen where you can:

- Enter the backend base URL
- Save a POS API key securely
- Test connectivity before saving
- Validate that the backend is a compatible `PowersOfZeroPOS` API

API server reference:

- https://github.com/sariyan-0/POZ-POS-api-server-

The health check expects a successful response compatible with:

- service: `PowersOfZeroPOS`
- apiVersion: `1`
- status: `ok`

Production backends should use `https`. `http` is only accepted for recognized local development hosts such as `localhost` and `10.0.2.2`.

If you are setting up the full stack, use the companion API server repository above as the backend reference implementation for this app.

## Stripe Terminal Support

This app includes a dedicated Stripe Terminal provider and reader management workflow.

Supported capabilities in the current codebase include:

- Terminal initialization
- Reader discovery
- Bluetooth and simulated reader flows
- Location loading and selection
- Reader connection and reconnection handling
- Payment collection and processing hooks
- In-person refund processing support

If you plan to use live Stripe Terminal flows, make sure your backend exposes the required token and payment endpoints and that your Stripe account, locations, and readers are configured correctly.

## Testing

Run the test suite with:

```bash
npm test
```

Lint the project with:

```bash
npm run lint
```

## Why This Project Stands Out

- Clean React Native architecture with separate config, service, terminal, and state layers
- Good foundation for extending into a full production POS system
- Strong local-first workflow for testing app behavior before backend completion
- Stripe Terminal support already considered at the product architecture level

## Roadmap Ideas

- Sync transactions and inventory with a live backend
- Add authentication and staff roles
- Expand customer profiles and CRM features
- Add receipts, reporting, and analytics
- Support offline queueing and background sync

## License

Add your preferred license here before publishing publicly on GitHub.

---

<div align="center">
Built for fast in-person selling, modern mobile workflows, and future-ready POS expansion.
</div>
