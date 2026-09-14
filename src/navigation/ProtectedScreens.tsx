import React from 'react';
import { PermissionBoundary } from '../components/PermissionBoundary';
import { CheckoutScreen } from '../screens/CheckoutScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { MoneyScreen } from '../screens/MoneyScreen';
import { OrdersScreen } from '../screens/OrdersScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { ItemSettingsScreen } from '../screens/ItemSettingsScreen';
import { AllItemsScreen } from '../screens/AllItemsScreen';
import { ModifiersScreen } from '../screens/ModifiersScreen';
import { ModifierSetEditorScreen } from '../screens/ModifierSetEditorScreen';
import { ProductEditorScreen } from '../screens/ProductEditorScreen';
import { DiscountEditorScreen } from '../screens/DiscountEditorScreen';
import { DiscountsScreen } from '../screens/DiscountsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SecuritySettingsScreen } from '../screens/SecuritySettingsScreen';
import { BackendSettingsScreen } from '../screens/BackendSettingsScreen';
import { MoreSectionScreen } from '../screens/MoreSectionScreen';
import { TransactionDetailScreen } from '../screens/TransactionDetailScreen';
import { CashPaymentScreen } from '../screens/CashPaymentScreen';

export function ProtectedCheckout() {
  return (
    <PermissionBoundary permission="process_sales" title="Process sales">
      <CheckoutScreen />
    </PermissionBoundary>
  );
}
export function ProtectedTransactions() {
  return (
    <PermissionBoundary
      permission="view_transactions"
      title="View transactions"
    >
      <TransactionsScreen />
    </PermissionBoundary>
  );
}
export function ProtectedMoney() {
  return (
    <PermissionBoundary permission="view_reports" title="View reports">
      <MoneyScreen />
    </PermissionBoundary>
  );
}
export function ProtectedOrders() {
  return (
    <PermissionBoundary
      permission="view_transactions"
      title="View transactions"
    >
      <OrdersScreen />
    </PermissionBoundary>
  );
}
export function ProtectedInventory() {
  return (
    <PermissionBoundary permission="manage_inventory" title="Manage inventory">
      <InventoryScreen />
    </PermissionBoundary>
  );
}
export function ProtectedItems() {
  return (
    <PermissionBoundary permission="manage_catalog" title="Manage catalog">
      <ItemSettingsScreen />
    </PermissionBoundary>
  );
}
export function ProtectedAllItems() {
  return (
    <PermissionBoundary permission="manage_catalog" title="Manage catalog">
      <AllItemsScreen />
    </PermissionBoundary>
  );
}
export function ProtectedModifiers() {
  return (
    <PermissionBoundary permission="manage_catalog" title="Manage catalog">
      <ModifiersScreen />
    </PermissionBoundary>
  );
}
export function ProtectedModifierEditor() {
  return (
    <PermissionBoundary permission="manage_catalog" title="Manage catalog">
      <ModifierSetEditorScreen />
    </PermissionBoundary>
  );
}
export function ProtectedProductEditor() {
  return (
    <PermissionBoundary permission="manage_catalog" title="Manage catalog">
      <ProductEditorScreen />
    </PermissionBoundary>
  );
}
export function ProtectedDiscountEditor() {
  return (
    <PermissionBoundary permission="manage_catalog" title="Manage catalog">
      <DiscountEditorScreen />
    </PermissionBoundary>
  );
}
export function ProtectedDiscounts() {
  return (
    <PermissionBoundary permission="manage_catalog" title="Manage catalog">
      <DiscountsScreen />
    </PermissionBoundary>
  );
}
export function ProtectedSettings() {
  return (
    <PermissionBoundary
      permission="manage_register_settings"
      title="Register settings"
    >
      <SettingsScreen />
    </PermissionBoundary>
  );
}
export function ProtectedSecurity() {
  return (
    <PermissionBoundary
      permission="manage_register_settings"
      title="Register settings"
    >
      <SecuritySettingsScreen />
    </PermissionBoundary>
  );
}
export function ProtectedBackend() {
  return (
    <PermissionBoundary
      permission="manage_register_settings"
      title="Register settings"
    >
      <BackendSettingsScreen />
    </PermissionBoundary>
  );
}
export function ProtectedMoreSection() {
  return (
    <PermissionBoundary
      permission="manage_register_settings"
      title="Register settings"
    >
      <MoreSectionScreen />
    </PermissionBoundary>
  );
}
export function ProtectedTransactionDetail() {
  return (
    <PermissionBoundary
      permission="view_transactions"
      title="View transactions"
    >
      <TransactionDetailScreen />
    </PermissionBoundary>
  );
}
export function ProtectedCashPayment() {
  return (
    <PermissionBoundary permission="process_sales" title="Process sales">
      <CashPaymentScreen />
    </PermissionBoundary>
  );
}
