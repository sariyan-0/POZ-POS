import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePOS } from '../hooks/usePOS';
import { Customer } from '../models/pos';
import { useRootNavigation } from '../navigation/AppNavigator';
import {
  createBackendCustomer,
  searchBackendCustomers,
} from '../services/api/customers';
import { useAppTheme } from '../theme';
import { formatCurrency } from '../utils/format';
import { createId } from '../utils/id';

export function CurrentSaleScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useRootNavigation();
  const {
    state,
    subtotal,
    tax,
    total,
    saleItemCount,
    updateCartItemQuantity,
    removeCartItem,
    clearCart,
    selectedCustomer,
    upsertCustomer,
    selectCustomerForSale,
  } = usePOS();
  const [showMenu, setShowMenu] = useState(false);
  const [showClearCartConfirm, setShowClearCartConfirm] = useState(false);
  const [showCustomerSheet, setShowCustomerSheet] = useState(false);

  function handleCustomerSaved(customer: Customer) {
    upsertCustomer(customer);
  }

  return (
    <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
      <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
        <View style={[styles.grabber, { backgroundColor: theme.colors.border }]} />
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.headerCircle, { backgroundColor: theme.colors.surfaceMuted }]}>
            <MaterialDesignIcons color={theme.colors.text} name="close" size={22} />
          </Pressable>
          <Text style={[styles.saleTitle, { color: theme.colors.text }]}>
            Current sale ({saleItemCount})
          </Text>
          <Pressable
            style={styles.ellipsisButton}
            onPress={() => setShowMenu(true)}>
            <MaterialDesignIcons color={theme.colors.text} name="dots-horizontal" size={26} />
          </Pressable>
        </View>

        <View
          style={[styles.forHereBar, { backgroundColor: theme.colors.surfaceStrong }]}>
          <Text style={[styles.forHereLabel, { color: theme.colors.text }]}>For Here</Text>
        </View>

        <Pressable
          onPress={() => setShowCustomerSheet(true)}
          style={[styles.customerRow, { backgroundColor: theme.colors.surfaceMuted }]}>
          <View style={[styles.customerIcon, { backgroundColor: theme.colors.surface }]}>
            <MaterialDesignIcons
              color={theme.colors.text}
              name={selectedCustomer ? 'account-check-outline' : 'account-plus-outline'}
              size={28}
            />
          </View>
          <View style={styles.customerCopy}>
            <Text style={[styles.customerLabel, { color: theme.colors.text }]}>
              {selectedCustomer?.name ?? 'Add customer'}
            </Text>
            {selectedCustomer ? (
              <Text style={[styles.customerMeta, { color: theme.colors.textMuted }]}>
                {[selectedCustomer.email, selectedCustomer.phone]
                  .filter(Boolean)
                  .join(' • ') || 'Attached to this sale'}
              </Text>
            ) : null}
          </View>
          <MaterialDesignIcons color={theme.colors.textMuted} name="chevron-right" size={28} />
        </Pressable>

        <View style={styles.itemsArea}>
          {state.cart.map(item => (
            <View key={item.id} style={styles.saleItemBlock}>
              <View style={styles.saleLine}>
                <Text style={[styles.saleItemName, { color: theme.colors.text }]}>
                  {item.title}
                </Text>
                <Text style={[styles.saleItemPrice, { color: theme.colors.text }]}>
                  {formatCurrency(item.unitPriceInCents * item.quantity)}
                </Text>
              </View>
              {item.note ? (
                <Text style={[styles.saleItemNote, { color: theme.colors.textMuted }]}>
                  {item.note}
                </Text>
              ) : null}
              <View style={styles.itemToolsRow}>
                <View style={styles.qtyTools}>
                  <Pressable
                    onPress={() => updateCartItemQuantity(item.id, item.quantity - 1)}
                    style={[styles.qtyButton, { backgroundColor: theme.colors.surfaceMuted }]}>
                    <MaterialDesignIcons color={theme.colors.text} name="minus" size={18} />
                  </Pressable>
                  <Text style={[styles.qtyText, { color: theme.colors.text }]}>
                    {item.quantity}
                  </Text>
                  <Pressable
                    onPress={() => updateCartItemQuantity(item.id, item.quantity + 1)}
                    style={[styles.qtyButton, { backgroundColor: theme.colors.surfaceMuted }]}>
                    <MaterialDesignIcons color={theme.colors.text} name="plus" size={18} />
                  </Pressable>
                </View>
                <Pressable onPress={() => removeCartItem(item.id)}>
                  <Text style={[styles.removeText, { color: theme.colors.textMuted }]}>
                    Remove
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}

          <View style={[styles.thinDivider, { backgroundColor: theme.colors.divider }]} />
          <Pressable onPress={() => navigation.navigate('Discounts')}>
            <Text style={[styles.discountLabel, { color: theme.colors.text }]}>
              Add discount
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.chargeFooter,
            {
              paddingBottom: insets.bottom + 14,
              backgroundColor: theme.colors.surface,
            },
          ]}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryText, { color: theme.colors.textMuted }]}>
              Subtotal
            </Text>
            <Text style={[styles.summaryText, { color: theme.colors.textMuted }]}>
              {formatCurrency(subtotal)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryText, { color: theme.colors.textMuted }]}>Tax</Text>
            <Text style={[styles.summaryText, { color: theme.colors.textMuted }]}>
              {formatCurrency(tax)}
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('MockPayment')}
            style={[styles.chargeButton, { backgroundColor: theme.colors.accent }]}>
            <Text style={[styles.chargeButtonLabel, { color: theme.colors.accentText }]}>
              {`Charge ${formatCurrency(total)}`}
            </Text>
          </Pressable>
        </View>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={showMenu}
        onRequestClose={() => setShowMenu(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: theme.colors.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowMenu(false)} />
          <View
            style={[
              styles.menuCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}>
            <Pressable
              onPress={() => {
                setShowMenu(false);
                setShowClearCartConfirm(true);
              }}
              style={[
                styles.menuAction,
                { backgroundColor: theme.colors.surfaceMuted },
              ]}>
              <MaterialDesignIcons color={theme.colors.danger} name="trash-can-outline" size={20} />
              <Text style={[styles.menuActionLabel, { color: theme.colors.text }]}>
                Clear cart
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowMenu(false)}
              style={[
                styles.menuAction,
                { backgroundColor: theme.colors.surfaceMuted },
              ]}>
              <MaterialDesignIcons color={theme.colors.textMuted} name="close" size={20} />
              <Text style={[styles.menuActionLabel, { color: theme.colors.text }]}>
                Nevermind
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={showClearCartConfirm}
        onRequestClose={() => setShowClearCartConfirm(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: theme.colors.overlay }]}>
          <View
            style={[
              styles.confirmCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}>
            <Text style={[styles.confirmTitle, { color: theme.colors.text }]}>
              Clear current sale?
            </Text>
            <Text style={[styles.confirmBody, { color: theme.colors.textMuted }]}>
              This removes all items from the cart. Transactions already saved will stay intact.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                onPress={() => setShowClearCartConfirm(false)}
                style={[
                  styles.confirmButton,
                  { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
                ]}>
                <Text style={[styles.confirmButtonLabel, { color: theme.colors.text }]}>
                  Nevermind
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  clearCart();
                  setShowClearCartConfirm(false);
                  navigation.goBack();
                }}
                style={[
                  styles.confirmButton,
                  { backgroundColor: theme.colors.danger, borderColor: theme.colors.danger },
                ]}>
                <Text style={[styles.confirmButtonLabel, { color: '#FFFFFF' }]}>
                  Clear cart
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <CustomerSheet
        visible={showCustomerSheet}
        customers={state.customers}
        selectedCustomerId={selectedCustomer?.id}
        onClose={() => setShowCustomerSheet(false)}
        onSelect={customer => {
          selectCustomerForSale(customer.id);
          setShowCustomerSheet(false);
        }}
        onRemove={() => {
          selectCustomerForSale(undefined);
          setShowCustomerSheet(false);
        }}
        onSave={handleCustomerSaved}
      />
    </View>
  );
}

function CustomerSheet({
  visible,
  customers,
  selectedCustomerId,
  onClose,
  onSelect,
  onRemove,
  onSave,
}: {
  visible: boolean;
  customers: Customer[];
  selectedCustomerId?: string;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
  onRemove: () => void;
  onSave: (customer: Customer) => void;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [remoteMatches, setRemoteMatches] = useState<Array<Partial<Customer>>>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 3) {
      setRemoteMatches([]);
      return undefined;
    }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      searchBackendCustomers(trimmedQuery).then(matches => {
        if (!cancelled) {
          setRemoteMatches(matches);
        }
      });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [query, visible]);

  useEffect(() => {
    if (visible) {
      return;
    }

    setQuery('');
    setShowCreate(false);
    setName('');
    setEmail('');
    setPhone('');
    setNote('');
    setRemoteMatches([]);
    setIsSaving(false);
  }, [visible]);

  const matchingCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const localMatches = normalizedQuery
      ? customers.filter(customer =>
          [
            customer.name,
            customer.email,
            customer.phone,
            customer.stripeCustomerId,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery),
        )
      : customers;

    const existingIds = new Set(localMatches.map(customer => customer.id));
    const remoteAsCustomers = remoteMatches
      .filter(customer => customer.id && customer.name && !existingIds.has(customer.id))
      .map(customer => ({
        id: customer.id as string,
        createdAt: customer.createdAt || new Date().toISOString(),
        updatedAt: customer.updatedAt || new Date().toISOString(),
        name: customer.name as string,
        email: customer.email,
        phone: customer.phone,
        note: customer.note,
        stripeCustomerId: customer.stripeCustomerId,
        syncStatus: customer.syncStatus ?? 'synced',
      }));

    return [...localMatches, ...remoteAsCustomers];
  }, [customers, query, remoteMatches]);

  const canSave = name.trim().length >= 2;

  async function saveCustomer() {
    if (!canSave || isSaving) {
      return;
    }

    setIsSaving(true);
    const now = new Date().toISOString();
    const localCustomer: Customer = {
      id: createId('cust'),
      createdAt: now,
      updatedAt: now,
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      note: note.trim() || undefined,
      syncStatus: 'local',
    };

    const backendCustomer = await createBackendCustomer(localCustomer);
    const savedCustomer: Customer = {
      ...localCustomer,
      ...backendCustomer,
      id: backendCustomer?.id || localCustomer.id,
      name: backendCustomer?.name || localCustomer.name,
      syncStatus: backendCustomer?.stripeCustomerId ? 'synced' : 'local',
      updatedAt: backendCustomer?.updatedAt || now,
    };

    onSave(savedCustomer);
    onSelect(savedCustomer);
    setIsSaving(false);
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={[styles.customerModalBackdrop, { backgroundColor: theme.colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.customerSheet,
            {
              backgroundColor: theme.colors.surface,
              paddingBottom: insets.bottom + 18,
            },
          ]}>
          <View style={[styles.sheetGrabber, { backgroundColor: theme.colors.border }]} />
          <View style={styles.customerSheetHeader}>
            <View>
              <Text style={[styles.customerSheetTitle, { color: theme.colors.text }]}>
                Customer
              </Text>
              <Text style={[styles.customerSheetBody, { color: theme.colors.textMuted }]}>
                Attach a customer now. Stripe syncs when the backend endpoint exists.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.headerCircle, { backgroundColor: theme.colors.surfaceMuted }]}>
              <MaterialDesignIcons color={theme.colors.text} name="close" size={22} />
            </Pressable>
          </View>

          <View
            style={[
              styles.customerSearch,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}>
            <MaterialDesignIcons
              color={theme.colors.textMuted}
              name="magnify"
              size={22}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search name, phone, or email"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.customerSearchInput, { color: theme.colors.text }]}
            />
          </View>

          <ScrollView
            style={styles.customerResults}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {matchingCustomers.length ? (
              matchingCustomers.map(customer => {
                const selected = customer.id === selectedCustomerId;
                return (
                  <Pressable
                    key={customer.id}
                    onPress={() => {
                      if (!customers.some(local => local.id === customer.id)) {
                        onSave(customer);
                      }
                      onSelect(customer);
                    }}
                    style={[
                      styles.customerResultCard,
                      {
                        backgroundColor: selected
                          ? theme.colors.surfaceStrong
                          : theme.colors.surfaceMuted,
                        borderColor: selected ? theme.colors.success : theme.colors.border,
                      },
                    ]}>
                    <View
                      style={[
                        styles.customerAvatar,
                        { backgroundColor: theme.colors.surface },
                      ]}>
                      <Text style={[styles.customerAvatarText, { color: theme.colors.text }]}>
                        {customer.name.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.customerResultCopy}>
                      <Text style={[styles.customerResultName, { color: theme.colors.text }]}>
                        {customer.name}
                      </Text>
                      <Text style={[styles.customerResultMeta, { color: theme.colors.textMuted }]}>
                        {[customer.email, customer.phone]
                          .filter(Boolean)
                          .join(' • ') || 'No contact info'}
                      </Text>
                      {customer.stripeCustomerId ? (
                        <Text style={[styles.customerStripeId, { color: theme.colors.success }]}>
                          Stripe linked
                        </Text>
                      ) : null}
                    </View>
                    {selected ? (
                      <MaterialDesignIcons
                        color={theme.colors.success}
                        name="check-circle"
                        size={24}
                      />
                    ) : null}
                  </Pressable>
                );
              })
            ) : (
              <View
                style={[
                  styles.emptyCustomerCard,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderColor: theme.colors.border,
                  },
                ]}>
                <MaterialDesignIcons
                  color={theme.colors.textMuted}
                  name="account-search-outline"
                  size={30}
                />
                <Text style={[styles.emptyCustomerTitle, { color: theme.colors.text }]}>
                  No customer found
                </Text>
                <Text style={[styles.emptyCustomerBody, { color: theme.colors.textMuted }]}>
                  Create one below and attach them to this sale.
                </Text>
              </View>
            )}

            {selectedCustomerId ? (
              <Pressable onPress={onRemove} style={styles.removeCustomerButton}>
                <Text style={[styles.removeCustomerText, { color: theme.colors.danger }]}>
                  Remove customer from sale
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => {
                setShowCreate(current => !current);
                if (!name && query.trim()) {
                  setName(query.trim());
                }
              }}
              style={[
                styles.createToggle,
                {
                  backgroundColor: theme.colors.accent,
                },
              ]}>
              <MaterialDesignIcons
                color={theme.colors.accentText}
                name={showCreate ? 'chevron-up' : 'plus'}
                size={22}
              />
              <Text style={[styles.createToggleText, { color: theme.colors.accentText }]}>
                {showCreate ? 'Hide new customer' : 'Create new customer'}
              </Text>
            </Pressable>

            {showCreate ? (
              <View style={styles.customerForm}>
                <CustomerInput
                  label="Name"
                  value={name}
                  onChangeText={setName}
                  placeholder="Customer name"
                />
                <CustomerInput
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@example.com"
                  keyboardType="email-address"
                />
                <CustomerInput
                  label="Phone"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="(555) 555-5555"
                  keyboardType="phone-pad"
                />
                <CustomerInput
                  label="Note"
                  value={note}
                  onChangeText={setNote}
                  placeholder="Optional note"
                  multiline
                />
                <Pressable
                  disabled={!canSave || isSaving}
                  onPress={saveCustomer}
                  style={[
                    styles.saveCustomerButton,
                    {
                      backgroundColor: theme.colors.accent,
                      opacity: canSave && !isSaving ? 1 : 0.45,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.saveCustomerLabel,
                      { color: theme.colors.accentText },
                    ]}>
                    {isSaving ? 'Saving...' : 'Save and attach'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function CustomerInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  multiline?: boolean;
}) {
  const theme = useAppTheme();

  return (
    <View style={styles.customerInputWrap}>
      <Text style={[styles.customerInputLabel, { color: theme.colors.textMuted }]}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[
          styles.customerInput,
          {
            minHeight: multiline ? 82 : 50,
            textAlignVertical: multiline ? 'top' : 'center',
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
            color: theme.colors.text,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    minHeight: '84%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  grabber: {
    alignSelf: 'center',
    width: 66,
    height: 6,
    borderRadius: 3,
    marginTop: 12,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  headerCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saleTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  ellipsisButton: {
    width: 42,
    alignItems: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 88,
    paddingHorizontal: 18,
  },
  customerModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  menuCard: {
    width: 200,
    borderRadius: 20,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  menuAction: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuActionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  confirmCard: {
    width: '100%',
    marginTop: '45%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  confirmBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  forHereBar: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forHereLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  customerRow: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginHorizontal: 18,
    marginTop: 18,
    paddingHorizontal: 14,
  },
  customerIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  customerCopy: {
    flex: 1,
    gap: 3,
  },
  customerMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  customerSheet: {
    width: '100%',
    maxHeight: '86%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 14,
  },
  sheetGrabber: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: 999,
  },
  customerSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 18,
  },
  customerSheetTitle: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  customerSheetBody: {
    maxWidth: 300,
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
  },
  customerSearch: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customerSearchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  customerResults: {
    marginHorizontal: -2,
  },
  customerResultCard: {
    minHeight: 74,
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    fontSize: 18,
    fontWeight: '900',
  },
  customerResultCopy: {
    flex: 1,
    gap: 3,
  },
  customerResultName: {
    fontSize: 17,
    fontWeight: '800',
  },
  customerResultMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  customerStripeId: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  emptyCustomerCard: {
    minHeight: 140,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 8,
    marginBottom: 10,
  },
  emptyCustomerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  emptyCustomerBody: {
    textAlign: 'center',
    lineHeight: 20,
  },
  removeCustomerButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  removeCustomerText: {
    fontSize: 15,
    fontWeight: '800',
  },
  createToggle: {
    minHeight: 56,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  createToggleText: {
    fontSize: 16,
    fontWeight: '900',
  },
  customerForm: {
    gap: 12,
    paddingBottom: 12,
  },
  customerInputWrap: {
    gap: 7,
  },
  customerInputLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  customerInput: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  saveCustomerButton: {
    minHeight: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveCustomerLabel: {
    fontSize: 16,
    fontWeight: '900',
  },
  itemsArea: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 26,
  },
  saleItemBlock: {
    paddingBottom: 18,
  },
  saleLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  saleItemName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
  },
  saleItemPrice: {
    fontSize: 17,
    fontWeight: '500',
  },
  saleItemNote: {
    fontSize: 13,
    marginTop: 6,
  },
  itemToolsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  qtyTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '700',
    minWidth: 16,
    textAlign: 'center',
  },
  removeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  thinDivider: {
    width: 44,
    height: 2,
    marginBottom: 22,
  },
  discountLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  discountList: {
    gap: 10,
  },
  discountOption: {
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  discountOptionTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  discountOptionMeta: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  pinDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginTop: 6,
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  pinErrorText: {
    minHeight: 20,
    textAlign: 'center',
    fontSize: 14,
  },
  pinKeypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  pinKeypadButton: {
    width: 84,
    height: 62,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinKeypadLabel: {
    fontSize: 24,
    fontWeight: '700',
  },
  chargeFooter: {
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '500',
  },
  chargeButton: {
    minHeight: 66,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  chargeButtonLabel: {
    fontSize: 19,
    fontWeight: '800',
  },
});
