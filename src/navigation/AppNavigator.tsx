import React from 'react';
import {
  NavigationContainer,
  RouteProp,
  useNavigation,
} from '@react-navigation/native';
import {
  BottomTabNavigationProp,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import {
  NativeStackNavigationProp,
  createNativeStackNavigator,
} from '@react-navigation/native-stack';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { useAppTheme } from '../theme';
import { MockPaymentScreen } from '../screens/MockPaymentScreen';
import { CheckoutDiscountsScreen } from '../screens/CheckoutDiscountsScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { CurrentSaleScreen } from '../screens/CurrentSaleScreen';
import { AddModifiersScreen } from '../screens/AddModifiersScreen';
import {
  ProtectedAllItems,
  ProtectedBackend,
  ProtectedCashPayment,
  ProtectedCheckout,
  ProtectedDiscountEditor,
  ProtectedDiscounts,
  ProtectedInventory,
  ProtectedItems,
  ProtectedModifierEditor,
  ProtectedModifiers,
  ProtectedMoney,
  ProtectedMoreSection,
  ProtectedOrders,
  ProtectedProductEditor,
  ProtectedSecurity,
  ProtectedSettings,
  ProtectedTransactionDetail,
  ProtectedTransactions,
} from './ProtectedScreens';

export type RootStackParamList = {
  MainTabs: undefined;
  CurrentSale: undefined;
  MockPayment: undefined;
  CashPayment: undefined;
  ProductEditor: { productId?: string } | undefined;
  DiscountEditor: { discountId?: string } | undefined;
  Discounts: undefined;
  CheckoutDiscounts: undefined;
  Items: undefined;
  AllItems: undefined;
  Modifiers: undefined;
  ModifierSetEditor: { modifierSetId?: string } | undefined;
  Inventory: undefined;
  Settings: undefined;
  SecuritySettings: undefined;
  BackendSettings: undefined;
  AddModifiers: undefined;
  MoreSection: { section: 'hardware' | 'taxes' | 'appearance' | 'developer' };
  TransactionDetail: { transactionId: string };
};

export type MainTabParamList = {
  Checkout: undefined;
  Transactions: undefined;
  Money: undefined;
  Orders: undefined;
  More: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
  const theme = useAppTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.text,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.divider,
          height: 92,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveBackgroundColor: theme.colors.tabActive,
        tabBarItemStyle: {
          borderRadius: 12,
          marginHorizontal: 6,
          marginVertical: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
      }}
    >
      <Tab.Screen
        name="Checkout"
        component={ProtectedCheckout}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialDesignIcons
              color={color}
              name="view-grid-outline"
              size={size}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Transactions"
        component={ProtectedTransactions}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialDesignIcons
              color={color}
              name="swap-horizontal"
              size={size}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Money"
        component={ProtectedMoney}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialDesignIcons
              color={color}
              name="cash-multiple"
              size={size}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Orders"
        component={ProtectedOrders}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialDesignIcons
              color={color}
              name="receipt-text-outline"
              size={size}
            />
          ),
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialDesignIcons color={color} name="menu" size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const theme = useAppTheme();

  return (
    <NavigationContainer theme={theme.navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerTintColor: theme.colors.text,
          headerStyle: {
            backgroundColor: theme.colors.surface,
          },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: theme.colors.background,
          },
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CurrentSale"
          component={CurrentSaleScreen}
          options={{
            headerShown: false,
            presentation: 'transparentModal',
            animation: 'slide_from_bottom',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen
          name="MockPayment"
          component={MockPaymentScreen}
          options={{ title: 'Payment', presentation: 'modal' }}
        />
        <Stack.Screen
          name="CashPayment"
          component={ProtectedCashPayment}
          options={{
            headerShown: false,
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="ProductEditor"
          component={ProtectedProductEditor}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DiscountEditor"
          component={ProtectedDiscountEditor}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Discounts"
          component={ProtectedDiscounts}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CheckoutDiscounts"
          component={CheckoutDiscountsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Items"
          component={ProtectedItems}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AllItems"
          component={ProtectedAllItems}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Modifiers"
          component={ProtectedModifiers}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ModifierSetEditor"
          component={ProtectedModifierEditor}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Inventory"
          component={ProtectedInventory}
          options={{ title: 'Inventory' }}
        />
        <Stack.Screen
          name="Settings"
          component={ProtectedSettings}
          options={{ title: 'Settings' }}
        />
        <Stack.Screen
          name="SecuritySettings"
          component={ProtectedSecurity}
          options={{ title: 'Security' }}
        />
        <Stack.Screen
          name="BackendSettings"
          component={ProtectedBackend}
          options={{ title: 'Register connection' }}
        />
        <Stack.Screen
          name="AddModifiers"
          component={AddModifiersScreen}
          options={{ headerShown: false, presentation: 'card' }}
        />
        <Stack.Screen
          name="MoreSection"
          component={ProtectedMoreSection}
          options={({ route }) => ({
            title:
              route.params.section === 'hardware'
                ? 'Readers'
                : route.params.section === 'taxes'
                ? 'Taxes'
                : route.params.section === 'appearance'
                ? 'Appearance'
                : 'Developer',
          })}
        />
        <Stack.Screen
          name="TransactionDetail"
          component={ProtectedTransactionDetail}
          options={{ title: 'Transaction Details' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export function useRootNavigation() {
  return useNavigation<NativeStackNavigationProp<RootStackParamList>>();
}

export function useMainTabNavigation() {
  return useNavigation<BottomTabNavigationProp<MainTabParamList>>();
}

export type TransactionDetailRoute = RouteProp<
  RootStackParamList,
  'TransactionDetail'
>;
