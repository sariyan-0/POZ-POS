# PowersOfZeroPOS

<div align="center">

### A modern mobile POS app built with React Native

Built for quick checkout, clean in-store workflows, and teams who want more control over their POS setup.

![React Native](https://img.shields.io/badge/React%20Native-0.87-111827?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-6.x-111827?style=for-the-badge&logo=typescript&logoColor=3178C6)
![Stripe Terminal](https://img.shields.io/badge/Stripe%20Terminal-Integrated-111827?style=for-the-badge&logo=stripe&logoColor=635BFF)
![Platform](https://img.shields.io/badge/iOS%20%26%20Android-Supported-111827?style=for-the-badge)

</div>

---

## Overview

**PowersOfZeroPOS** is a React Native mobile point-of-sale app for in-person selling. It brings together a fast checkout flow, product and inventory tools, local transaction history, backend connectivity, and Stripe Terminal support in one place.

It started as a practical POS build, but it is also a solid base if you want to keep building it into something bigger.

It is especially useful for people who like the flexibility of a **Stripe-powered backend** but want a **Square-style POS experience** on the front end.

## Highlights

| Area | What it does |
| --- | --- |
| Checkout | Custom amounts, product browsing, favorites, notes, and easy sale review |
| Transactions | Local transaction history with payment details and refund visibility |
| Refunds | Refund flows from transaction details, including Stripe Terminal-related handling |
| Inventory | Product editing, stock updates, and item management from inside the app |
| Backend | Server URL and POS API key setup with built-in connection testing |
| Readers | Stripe Terminal reader setup, discovery, location selection, and connection tools |
| Persistence | Saves app state locally so the experience feels fast and native |

## Feature Set

### Checkout

- Keypad mode for quick custom amount entry
- Product library and favorites tabs
- Add notes to custom amount entries
- Review current sale before payment
- Customer selection and cart state management

### Management

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

To run the app locally, you will want the usual React Native CLI setup in place:

- Node.js `>= 22.11.0`
- npm
- Xcode for iOS development
- Android Studio for Android development
- CocoaPods for iOS native dependencies

If you need it, the official React Native environment setup guide is here:

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

The app has a built-in **Backend / Server** screen where you can:

- Enter the backend base URL
- Save a POS API key securely
- Test connectivity before saving
- Make sure the backend matches the expected `PowersOfZeroPOS` API

If you want a backend to pair with this app, use the companion API server here:

- https://github.com/sariyan-0/POZ-POS-api-server-

The health check expects a successful response with:

- service: `PowersOfZeroPOS`
- apiVersion: `1`
- status: `ok`

For production, the backend should use `https`. Plain `http` is only allowed for local development hosts like `localhost` and `10.0.2.2`.

If you are setting up the full stack, that repo is the best reference point for the server side.

## Stripe Terminal Support

This app already includes a dedicated Stripe Terminal provider and reader management flow.

Right now, the codebase supports:

- Terminal initialization
- Reader discovery
- Bluetooth and simulated reader flows
- Location loading and selection
- Reader connection and reconnection handling
- Payment collection and processing hooks
- In-person refund processing support

If you want to use live Stripe Terminal flows, make sure your backend exposes the needed token and payment endpoints, and that your Stripe account, locations, and readers are all set up properly.

## Testing

Run the test suite with:

```bash
npm test
```

Lint the project with:

```bash
npm run lint
```

## Production release

The JavaScript package version is `1.0.0`. The native marketing version is `1.0`, with iOS build number and Android version code `1`.

### Local Android use without Google Play

Google Play is not required to run or sideload OneRegister. For day-to-day development, use `npm run android`. To create an optimized standalone APK signed with the local Android development certificate, use the familiar `npm run android:release:apk` command (the alias `npm run android:local:apk` does the same thing). The APK is written to `android/app/build/outputs/apk/release/app-release.apk`. With a device or emulator connected, `npm run android:local:install` builds and installs it directly.

Local-release APKs are deliberately marked by the build output as debug-certificate artifacts. They are suitable for local installation only and must not be uploaded to an app store. `npm run android:production:apk` and `npm run android:release:bundle` continue to require a private release key.

### Android signing and bundle

Create an upload key outside source control, copy `android/keystore.properties.example` to `android/keystore.properties`, and replace every example value. Put the keystore at the path named by `storeFile`; both the properties file and `*.keystore` files are ignored by Git. Release tasks intentionally fail when a required value or keystore is missing.

```bash
cd android
./gradlew clean assembleRelease bundleRelease
cd ..

# The signer must be the production upload certificate, never CN=Android Debug.
$ANDROID_HOME/build-tools/35.0.0/apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk
keytool -printcert -jarfile android/app/build/outputs/bundle/release/app-release.aab
```

The exact Build Tools directory may differ locally. Before upload, confirm both artifacts are version 1, are signed by the expected upload certificate, and do not report `CN=Android Debug`. Google Play Console access and the upload-key secret are external requirements.

### iOS archive

Install pods, select the `PowersOfZeroPOS` scheme in Xcode, choose `Any iOS Device (arm64)`, then use **Product → Archive**. Confirm version `1.0` and build `1`, validate the archive, and distribute it through the Organizer. An Apple Developer team, distribution certificate, App Store Connect record, and matching provisioning profile must be supplied outside this repository.

An unsigned simulator compile can be used as a native smoke check:

```bash
xcodebuild -workspace ios/PowersOfZeroPOS.xcworkspace \
  -scheme PowersOfZeroPOS -configuration Release \
  -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build
```

### Release checklist

- Run `npm test`, `npx tsc --noEmit`, and `npm run lint`.
- Exercise onboarding, activation, staff PIN lockout, checkout, and register locking on a clean install and an upgraded activated install.
- Verify light/dark mode, larger text, reduced motion, VoiceOver/TalkBack, one small phone, one tall phone, and an iPad/tablet smoke test.
- Confirm simulated readers and developer settings are absent from the release UI.
- Confirm production API, Stripe, Apple, and Google credentials are provided by the release environment and are not committed.

## Why This Exists

- Clean React Native architecture with separate config, service, terminal, and state layers
- Good starting point if you want to grow this into a fuller production POS
- Local-first workflows make it easy to test and iterate before every backend piece is finished
- Helpful for merchants or developers who want Stripe infrastructure with a Square-inspired POS UI
- Built from a real need for more flexibility and ownership in the POS stack

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
Built for fast in-person selling and a more flexible POS setup.
</div>

This project exists in part because Square's account management can be pretty strict. The goal here was to build an alternative for people who want more control over their setup, their backend, and the overall POS experience.
