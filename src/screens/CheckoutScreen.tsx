import React, { useMemo, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckoutHeader,
  EmptyNotice,
  ListRow,
  PrimaryPillButton,
  SearchRow,
  SegmentedTabs,
  Thumbnail,
} from '../components/POSUI';
import { usePOS } from '../hooks/usePOS';
import { CartItem, Discount, Product } from '../models/pos';
import { useRootNavigation } from '../navigation/AppNavigator';
import { useAppTheme } from '../theme';
import { formatCurrency } from '../utils/format';
import { getProductTileInitials, getReadableTileTextColor } from '../utils/productTile';

type CheckoutTab = 'keypad' | 'library' | 'favorites';
type LibrarySectionKey =
  | 'items'
  | 'discounts'
  | 'services';

const LIBRARY_SECTIONS: Array<{
  key: LibrarySectionKey;
  label: string;
  icon: React.ComponentProps<typeof MaterialDesignIcons>['name'];
}> = [
  { key: 'items', label: 'Items', icon: 'archive-outline' },
  { key: 'discounts', label: 'Discounts', icon: 'ticket-percent-outline' },
  { key: 'services', label: 'Services', icon: 'calendar-blank-outline' },
];

function formatEntryAsCurrency(entryDigits: string): string {
  const cents = Number.parseInt(entryDigits || '0', 10) || 0;
  return formatCurrency(cents);
}

function formatReviewSaleLabel(itemCount: number): string {
  return itemCount === 1 ? 'Review sale (1 item)' : `Review sale (${itemCount} items)`;
}

export function CheckoutScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const navigation = useRootNavigation();
  const {
    state,
    activeProducts,
    activeDiscounts,
    favoriteProducts,
    currentStaff,
    saleItemCount,
    addProductToCart,
    addCustomAmountToCart,
    addDiscountToCart,
    authorizeManagerPin,
  } = usePOS();
  const [tab, setTab] = useState<CheckoutTab>('keypad');
  const [search, setSearch] = useState('');
  const [entryDigits, setEntryDigits] = useState('');
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [librarySection, setLibrarySection] = useState<LibrarySectionKey>('items');
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [customizationNote, setCustomizationNote] = useState('');
  const [customizationQuantity, setCustomizationQuantity] = useState(1);
  const [selectedOptionValueIds, setSelectedOptionValueIds] = useState<Record<string, string>>({});
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>([]);
  const [restrictedDiscount, setRestrictedDiscount] = useState<Discount | null>(null);
  const [showDiscountAuth, setShowDiscountAuth] = useState(false);
  const [managerPin, setManagerPin] = useState('');
  const [discountPinError, setDiscountPinError] = useState('');
  const shake = useState(() => new Animated.Value(0))[0];

  const filteredProducts = useMemo(() => {
    const base = tab === 'favorites' ? favoriteProducts : activeProducts;
    if (!search.trim()) {
      return base;
    }
    const query = search.trim().toLowerCase();
    return base.filter(product => {
      return (
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query)
      );
    });
  }, [activeProducts, favoriteProducts, search, tab]);

  const compactLayout = height < 860;
  const contentMaxWidth = width > 720 ? 720 : undefined;
  const contentWidth = Math.min(width - 32, (contentMaxWidth ?? width) - 32);
  const topSectionReserve = insets.top + (compactLayout ? 138 : 154);
  const bottomSectionReserve = insets.bottom + 108;
  const amountReserve = compactLayout ? 92 : 112;
  const noteReserve = noteOpen ? (compactLayout ? 124 : 150) : compactLayout ? 80 : 96;
  const buttonReserve = compactLayout ? 72 : 82;
  const pendingCustomAmountInCents = Number.parseInt(entryDigits || '0', 10) || 0;
  const pendingKeypadItemCount = pendingCustomAmountInCents > 0 ? 1 : 0;
  const reviewSaleItemCount =
    tab === 'keypad' ? saleItemCount + pendingKeypadItemCount : saleItemCount;
  const keypadVerticalBudget =
    height -
    topSectionReserve -
    bottomSectionReserve -
    amountReserve -
    noteReserve -
    buttonReserve;
  const keypadCellHeight = Math.max(
    68,
    Math.min(
      (contentWidth - 2) / 3,
      Math.floor(keypadVerticalBudget / 4),
      compactLayout ? 96 : 108,
    ),
  );
  const amountFontSize = Math.max(46, Math.min(66, width * 0.18, height * 0.075));
  const floatingButtonBottom = insets.bottom + 10;
  const floatingButtonHeight = 54;
  const floatingButtonReserve = floatingButtonBottom + floatingButtonHeight + 20;
  const visibleProducts = filteredProducts.slice(0, 40);
  const isItemsSection = tab === 'favorites' || librarySection === 'items';
  const favoriteGridProducts = useMemo(() => favoriteProducts.slice(0, 6), [favoriteProducts]);
  const customizationModifierSets = useMemo(
    () =>
      customizingProduct
        ? state.modifierSets.filter(modifierSet =>
            customizingProduct.modifierSetIds?.includes(modifierSet.id),
          )
        : [],
    [customizingProduct, state.modifierSets],
  );
  const customizationHasOptions = !!customizingProduct?.optionSets?.length;
  const selectedCustomizationOptions = useMemo(() => {
    if (!customizingProduct?.optionSets?.length) {
      return [];
    }

    return customizingProduct.optionSets
      .map(optionSet => {
        const valueId = selectedOptionValueIds[optionSet.id];
        const value = optionSet.values.find(entry => entry.id === valueId);
        return value
          ? {
              optionSetId: optionSet.id,
              optionSetName: optionSet.displayName || optionSet.name,
              valueId: value.id,
              valueName: value.name,
            }
          : null;
      })
      .filter(Boolean) as NonNullable<CartItemMetadata['selectedOptions']>[number][];
  }, [customizingProduct, selectedOptionValueIds]);
  const selectedCustomizationModifiers = useMemo(() => {
    return customizationModifierSets.flatMap(modifierSet =>
      modifierSet.modifiers
        .filter(modifier => selectedModifierIds.includes(modifier.id))
        .map(modifier => ({
          modifierSetId: modifierSet.id,
          modifierSetName: modifierSet.name,
          modifierId: modifier.id,
          modifierName: modifier.name,
          priceAdjustmentInCents: modifier.priceAdjustmentInCents,
        })),
    );
  }, [customizationModifierSets, selectedModifierIds]);
  const customizationExtraInCents = selectedCustomizationModifiers.reduce(
    (sum, modifier) => sum + modifier.priceAdjustmentInCents,
    0,
  );
  const customizationCanSubmit =
    !customizationHasOptions ||
    (customizingProduct?.optionSets ?? []).every(optionSet => !!selectedOptionValueIds[optionSet.id]);

  function appendDigit(value: string) {
    setEntryDigits(current => `${current}${value}`.replace(/^0+(?=\d)/, ''));
  }

  function clearEntry() {
    setEntryDigits('');
  }

  function commitCustomAmount() {
    if (!pendingCustomAmountInCents) {
      return;
    }
    addCustomAmountToCart(pendingCustomAmountInCents, note);
    setEntryDigits('');
    setNote('');
    setNoteOpen(false);
  }

  function reviewSale() {
    if (tab === 'keypad' && pendingCustomAmountInCents > 0) {
      commitCustomAmount();
      navigation.navigate('CurrentSale');
      return;
    }

    if (saleItemCount > 0) {
      navigation.navigate('CurrentSale');
    }
  }

  function handleCreateChoice(choice: 'item' | 'discount' | 'service') {
    setCreateMenuOpen(false);

    if (choice === 'item') {
      navigation.navigate('ProductEditor');
      return;
    }

    if (choice === 'discount') {
      navigation.navigate('DiscountEditor');
    }
  }

  function openProductCustomizer(product: Product) {
    setCustomizingProduct(product);
    setCustomizationNote('');
    setCustomizationQuantity(1);
    setSelectedOptionValueIds({});
    setSelectedModifierIds([]);
  }

  function closeProductCustomizer() {
    setCustomizingProduct(null);
    setCustomizationNote('');
    setCustomizationQuantity(1);
    setSelectedOptionValueIds({});
    setSelectedModifierIds([]);
  }

  function handleProductPress(product: Product) {
    if (product.optionSets?.length || product.modifierSetIds?.length) {
      openProductCustomizer(product);
      return;
    }

    addProductToCart(product.id);
  }

  function toggleModifier(modifierId: string) {
    setSelectedModifierIds(current =>
      current.includes(modifierId)
        ? current.filter(id => id !== modifierId)
        : [...current, modifierId],
    );
  }

  function buildCustomizationNote() {
    const lines: string[] = [];

    selectedCustomizationOptions.forEach(selection => {
      lines.push(`${selection.optionSetName}: ${selection.valueName}`);
    });

    if (selectedCustomizationModifiers.length) {
      lines.push(
        `Modifiers: ${selectedCustomizationModifiers.map(modifier => modifier.modifierName).join(', ')}`,
      );
    }

    if (customizationNote.trim()) {
      lines.push(customizationNote.trim());
    }

    return lines.join('\n').trim() || undefined;
  }

  function submitCustomizedProduct() {
    if (!customizingProduct || !customizationCanSubmit) {
      return;
    }

    addProductToCart(customizingProduct.id, {
      quantity: customizationQuantity,
      unitPriceInCents: customizingProduct.priceInCents + customizationExtraInCents,
      note: buildCustomizationNote(),
      metadata: {
        selectedOptions: selectedCustomizationOptions,
        selectedModifiers: selectedCustomizationModifiers,
      },
    });
    closeProductCustomizer();
  }

  function closeRestrictedDiscountFlow() {
    setRestrictedDiscount(null);
    setShowDiscountAuth(false);
    setManagerPin('');
    setDiscountPinError('');
  }

  function finishApplyDiscount(discount: Discount, authorizedByStaffId?: string) {
    const result = addDiscountToCart(discount.id, authorizedByStaffId);
    if (result.ok) {
      closeRestrictedDiscountFlow();
    }
  }

  function tryManagerUnlock(candidatePin: string) {
    const matchedStaff = authorizeManagerPin(candidatePin);
    if (!matchedStaff || !restrictedDiscount) {
      setManagerPin('');
      setDiscountPinError('Wrong PIN.');
      Animated.sequence([
        Animated.timing(shake, { toValue: 10, duration: 45, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -8, duration: 45, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 6, duration: 45, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -4, duration: 45, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 45, useNativeDriver: true }),
      ]).start();
      return;
    }

    finishApplyDiscount(restrictedDiscount, matchedStaff.id);
  }

  function appendManagerPin(value: string) {
    setDiscountPinError('');
    setManagerPin(current => {
      if (current.length >= 4) {
        return current;
      }
      const nextPin = `${current}${value}`;
      if (nextPin.length === 4) {
        setTimeout(() => tryManagerUnlock(nextPin), 0);
      }
      return nextPin;
    });
  }

  function handleDiscountPress(discount: Discount) {
    if (discount.requirePasscode && currentStaff?.role === 'cashier') {
      setRestrictedDiscount(discount);
      setShowDiscountAuth(false);
      setManagerPin('');
      setDiscountPinError('');
      return;
    }

    finishApplyDiscount(discount);
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <CheckoutHeader />
      <View style={styles.checkoutBody}>
        <View style={[styles.innerWrap, contentMaxWidth ? { maxWidth: contentMaxWidth } : null]}>
          <SegmentedTabs
            options={[
              { key: 'keypad', label: 'Keypad' },
              { key: 'library', label: 'Library' },
              { key: 'favorites', label: 'Favorites' },
            ]}
            value={tab}
            onChange={nextValue => setTab(nextValue as CheckoutTab)}
          />

          {tab === 'keypad' ? (
            <View
              style={[
                styles.keypadContent,
                {
                  paddingTop: compactLayout ? 10 : 18,
                  paddingBottom: floatingButtonReserve,
                },
              ]}>
              <Text
                style={[
                  styles.amountText,
                  {
                    color: theme.colors.text,
                    fontSize: amountFontSize,
                    marginBottom: compactLayout ? 14 : 24,
                  },
                ]}>
                {formatEntryAsCurrency(entryDigits)}
              </Text>

              <Pressable
                onPress={() => setNoteOpen(current => !current)}
                style={[
                  styles.noteButton,
                  {
                    minHeight: compactLayout ? 60 : 72,
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                    marginBottom: compactLayout ? 8 : 12,
                  },
                ]}>
                <MaterialDesignIcons color={theme.colors.text} name="plus" size={28} />
                <Text style={[styles.noteButtonText, { color: theme.colors.text }]}>Note</Text>
              </Pressable>

              {noteOpen ? (
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Add a note"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[
                    styles.noteInput,
                    {
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surface,
                    },
                  ]}
                />
              ) : null}

              <View
                style={[
                  styles.keypadGrid,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                  },
                ]}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '+'].map(
                  value => {
                    const isAction = value === 'C' || value === '+';
                    return (
                      <Pressable
                        key={value}
                        onPress={() => {
                          if (value === 'C') {
                            clearEntry();
                            return;
                          }
                          if (value === '+') {
                            commitCustomAmount();
                            return;
                          }
                          appendDigit(value);
                        }}
                        style={[
                          styles.keypadCell,
                          {
                            height: keypadCellHeight,
                            borderColor: theme.colors.border,
                          },
                        ]}>
                        <Text
                          style={[
                            styles.keypadCellText,
                            {
                              fontSize: compactLayout ? 34 : 42,
                              color:
                                isAction && value === '+'
                                  ? theme.colors.textMuted
                                  : theme.colors.text,
                            },
                          ]}>
                          {value}
                        </Text>
                      </Pressable>
                    );
                  },
                )}
              </View>
            </View>
          ) : tab === 'favorites' ? (
            <View style={{ flex: 1, paddingBottom: floatingButtonReserve }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.favoritesScrollContent}>
                <View style={styles.favoritesGrid}>
                  {favoriteGridProducts.map(product => {
                    const fallbackColor = product.tileColor?.trim() || theme.colors.surfaceStrong;
                    const fallbackTextColor = getReadableTileTextColor(
                      fallbackColor,
                      theme.colors.text,
                      theme.colors.surface,
                    );

                    return (
                      <Pressable
                        key={product.id}
                        onPress={() => handleProductPress(product)}
                        style={[
                          styles.favoriteTile,
                          {
                            backgroundColor: theme.colors.surface,
                            borderColor: theme.colors.divider,
                          },
                        ]}>
                        <View
                          style={[
                            styles.favoriteTileImageWrap,
                            {
                              backgroundColor: product.imageUri
                                ? theme.colors.surfaceMuted
                                : fallbackColor,
                            },
                          ]}>
                          {product.imageUri ? (
                            <Image
                              source={{ uri: product.imageUri }}
                              style={styles.favoriteTileImage}
                            />
                          ) : (
                            <Text
                              style={[
                                styles.favoriteTileFallback,
                                { color: fallbackTextColor },
                              ]}>
                              {getProductTileInitials(product)}
                            </Text>
                          )}
                        </View>
                        <View style={styles.favoriteTileBody}>
                          <Text
                            numberOfLines={1}
                            style={[styles.favoriteTileTitle, { color: theme.colors.text }]}>
                            {product.tileLabel?.trim() || product.name}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {!favoriteProducts.length ? (
                  <EmptyNotice
                    title="No favorites yet"
                    body="Mark items as favorites when you create or edit them."
                  />
                ) : null}
              </ScrollView>
            </View>
          ) : (
            <View style={{ flex: 1, paddingBottom: floatingButtonReserve }}>
              <SearchRow value={search} onChangeText={setSearch} />
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.libraryScrollContent}>
                <View
                  style={[
                    styles.libraryShell,
                    {
                      borderColor: theme.colors.divider,
                    },
                  ]}>
                  <View style={[styles.libraryRail, { backgroundColor: theme.colors.rail }]}>
                    {LIBRARY_SECTIONS.map(section => {
                      const selected = librarySection === section.key;
                      return (
                        <Pressable
                          key={section.key}
                          onPress={() => setLibrarySection(section.key)}
                          style={[
                            styles.libraryRailIconWrap,
                            selected
                              ? {
                                  backgroundColor: 'rgba(255,255,255,0.08)',
                                  borderRadius: 12,
                                }
                              : null,
                          ]}>
                          <MaterialDesignIcons
                            color={theme.colors.railText}
                            name={section.icon}
                            size={28}
                          />
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={styles.libraryMain}>
                    <View
                      style={[
                        styles.libraryCategorySection,
                        {
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.divider,
                        },
                      ]}>
                      {LIBRARY_SECTIONS.map(section => {
                        const selected = librarySection === section.key;

                        return (
                          <Pressable
                            key={section.key}
                            onPress={() => setLibrarySection(section.key)}
                            style={[
                              styles.libraryCategoryRow,
                              {
                                borderBottomColor: theme.colors.divider,
                                backgroundColor: theme.colors.surface,
                              },
                            ]}>
                            <Text
                              style={[
                                styles.libraryCategoryLabel,
                                {
                                  color: theme.colors.text,
                                  fontWeight: selected ? '800' : '700',
                                },
                              ]}>
                              {section.label}
                            </Text>
                            <MaterialDesignIcons
                              color={theme.colors.textMuted}
                              name="chevron-right"
                              size={28}
                            />
                          </Pressable>
                        );
                      })}
                    </View>

                    <View
                      style={[
                        styles.libraryProductSection,
                        {
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.divider,
                        },
                      ]}>
                      {tab === 'library' && librarySection === 'discounts' ? (
                        <>
                          {activeDiscounts.map(discount => (
                            <ListRow
                              key={discount.id}
                              label={discount.name}
                              rightLabel={
                                discount.type === 'percentage'
                                  ? `${discount.amount}%`
                                  : formatCurrency(discount.amount)
                              }
                              showChevron={false}
                              compact
                              onPress={() => handleDiscountPress(discount)}
                            />
                          ))}
                          {!activeDiscounts.length ? (
                            <EmptyNotice
                              title="No discounts yet"
                              body="Create your first discount to start using discount shortcuts in checkout."
                            />
                          ) : null}
                        </>
                      ) : isItemsSection ? (
                        <>
                          {visibleProducts.map(product => (
                            <ListRow
                              key={product.id}
                              label={product.name}
                              rightLabel={formatCurrency(product.priceInCents, product.currency)}
                              showChevron={false}
                              compact
                              thumbnail={<Thumbnail product={product} />}
                              onPress={() => handleProductPress(product)}
                            />
                          ))}

                          {!activeProducts.length && tab === 'library' ? (
                            <EmptyNotice
                              title="No items yet"
                              body="Create your first item to populate the library."
                            />
                          ) : null}
                        </>
                      ) : (
                        <View style={styles.libraryPlaceholder} />
                      )}
                    </View>
                  </View>
                </View>

                <Pressable
                  onPress={() => setCreateMenuOpen(true)}
                  style={[
                    styles.createItemCard,
                    {
                      backgroundColor: theme.colors.surfaceMuted,
                      borderColor: theme.colors.border,
                    },
                  ]}>
                  <Text style={[styles.createItemTitle, { color: theme.colors.text }]}>
                    Create a new item
                  </Text>
                  <Text style={[styles.createItemBody, { color: theme.colors.textMuted }]}>
                    Add products, set prices, and decide what should appear in checkout.
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
          )}
        </View>
      </View>

      {createMenuOpen ? (
        <View style={[styles.createMenuBackdrop, { backgroundColor: theme.colors.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCreateMenuOpen(false)} />
          <View
            style={[
              styles.createMenuCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}>
            {[
              { key: 'item', label: 'Create an item' },
              { key: 'discount', label: 'Create a discount' },
              { key: 'service', label: 'Create a service' },
            ].map((option, index, array) => (
              <Pressable
                key={option.key}
                onPress={() =>
                  handleCreateChoice(option.key as 'item' | 'discount' | 'service')
                }
                style={[
                  styles.createMenuRow,
                  index < array.length - 1
                    ? { borderBottomWidth: 1, borderBottomColor: theme.colors.divider }
                    : null,
                ]}>
                <Text style={[styles.createMenuLabel, { color: theme.colors.text }]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View
        pointerEvents="box-none"
        style={[
          styles.reviewSaleFooter,
          {
            bottom: floatingButtonBottom,
          },
        ]}>
        <View style={[styles.innerWrap, contentMaxWidth ? { maxWidth: contentMaxWidth } : null]}>
          <PrimaryPillButton
            label={formatReviewSaleLabel(reviewSaleItemCount)}
            disabled={reviewSaleItemCount === 0}
            onPress={reviewSale}
            style={styles.keypadReviewButton}
          />
        </View>
      </View>

      <Modal
        visible={!!customizingProduct}
        animationType="slide"
        onRequestClose={closeProductCustomizer}>
        <SafeAreaView style={[styles.customizerScreen, { backgroundColor: theme.colors.surface }]}>
          {customizingProduct ? (
            <>
              <View style={styles.customizerHeader}>
                <Pressable
                  onPress={closeProductCustomizer}
                  style={[styles.customizerClose, { backgroundColor: theme.colors.surfaceMuted }]}>
                  <MaterialDesignIcons color={theme.colors.text} name="close" size={28} />
                </Pressable>
                <Text style={[styles.customizerTitle, { color: theme.colors.text }]}>
                  {customizingProduct.name}
                </Text>
                <View style={{ width: 58 }} />
              </View>

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.customizerContent}>
                {(customizingProduct.optionSets ?? []).map(optionSet => (
                  <View key={optionSet.id} style={styles.customizerSection}>
                    <View style={styles.customizerSectionHeader}>
                      <Text style={[styles.customizerSectionTitle, { color: theme.colors.text }]}>
                        {optionSet.displayName || optionSet.name}
                      </Text>
                      <View
                        style={[
                          styles.customizerBadge,
                          { backgroundColor: theme.colors.surfaceMuted },
                        ]}>
                        <Text
                          style={[
                            styles.customizerBadgeLabel,
                            { color: theme.colors.textMuted },
                          ]}>
                          Select 1
                        </Text>
                      </View>
                    </View>
                    <View style={styles.customizerGrid}>
                      {optionSet.values.map(value => {
                        const selected = selectedOptionValueIds[optionSet.id] === value.id;
                        return (
                          <Pressable
                            key={value.id}
                            onPress={() =>
                              setSelectedOptionValueIds(current => ({
                                ...current,
                                [optionSet.id]: value.id,
                              }))
                            }
                            style={[
                              styles.choiceCard,
                              {
                                backgroundColor: theme.colors.surfaceMuted,
                                borderColor: selected ? theme.colors.text : theme.colors.border,
                              },
                            ]}>
                            <Text style={[styles.choiceTitle, { color: theme.colors.text }]}>
                              {value.name}
                            </Text>
                            <Text
                              style={[styles.choiceSubtitle, { color: theme.colors.textMuted }]}>
                              Variable
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}

                {customizationModifierSets.map(modifierSet => (
                  <View key={modifierSet.id} style={styles.customizerSection}>
                    <Text style={[styles.customizerSectionTitle, { color: theme.colors.text }]}>
                      {modifierSet.name}
                    </Text>
                    <View style={styles.customizerGrid}>
                      {modifierSet.modifiers.map(modifier => {
                        const selected = selectedModifierIds.includes(modifier.id);
                        return (
                          <Pressable
                            key={modifier.id}
                            onPress={() => toggleModifier(modifier.id)}
                            style={[
                              styles.choiceCard,
                              {
                                backgroundColor: theme.colors.surfaceMuted,
                                borderColor: selected ? theme.colors.text : theme.colors.border,
                              },
                            ]}>
                            <Text style={[styles.choiceTitle, { color: theme.colors.text }]}>
                              {modifier.name}
                            </Text>
                            <Text
                              style={[styles.choiceSubtitle, { color: theme.colors.textMuted }]}>
                              {modifier.priceAdjustmentInCents > 0
                                ? `+${formatCurrency(modifier.priceAdjustmentInCents)}`
                                : 'Optional'}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}

                <View style={styles.customizerSection}>
                  <Text style={[styles.customizerSectionTitle, { color: theme.colors.text }]}>
                    Note
                  </Text>
                  <TextInput
                    value={customizationNote}
                    onChangeText={setCustomizationNote}
                    placeholder="Add an item note..."
                    placeholderTextColor={theme.colors.textMuted}
                    multiline
                    style={[
                      styles.customizerNoteInput,
                      {
                        color: theme.colors.text,
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.surface,
                      },
                    ]}
                  />
                </View>
              </ScrollView>

              <View
                style={[
                  styles.customizerFooter,
                  {
                    paddingBottom: insets.bottom + 12,
                    backgroundColor: theme.colors.surface,
                  },
                ]}>
                <View
                  style={[
                    styles.quantityPill,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                  ]}>
                  <Pressable
                    onPress={() => setCustomizationQuantity(current => Math.max(1, current - 1))}
                    style={[
                      styles.quantityButton,
                      { backgroundColor: theme.colors.surfaceMuted },
                    ]}>
                    <MaterialDesignIcons color={theme.colors.text} name="minus" size={18} />
                  </Pressable>
                  <Text style={[styles.quantityValue, { color: theme.colors.text }]}>
                    {customizationQuantity}
                  </Text>
                  <Pressable
                    onPress={() => setCustomizationQuantity(current => current + 1)}
                    style={[
                      styles.quantityButton,
                      { backgroundColor: theme.colors.surfaceMuted },
                    ]}>
                    <MaterialDesignIcons color={theme.colors.text} name="plus" size={18} />
                  </Pressable>
                </View>

                <PrimaryPillButton
                  label={`Done${customizationExtraInCents > 0 ? ` • ${formatCurrency((customizingProduct.priceInCents + customizationExtraInCents) * customizationQuantity)}` : ''}`}
                  onPress={submitCustomizedProduct}
                  disabled={!customizationCanSubmit}
                  style={styles.customizerDoneButton}
                />
              </View>
            </>
          ) : null}
        </SafeAreaView>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={!!restrictedDiscount}
        onRequestClose={closeRestrictedDiscountFlow}>
        <View style={[styles.restrictedDiscountBackdrop, { backgroundColor: theme.colors.overlay }]}>
          <View
            style={[
              styles.restrictedDiscountCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}>
            {!showDiscountAuth ? (
              <>
                <Text style={[styles.restrictedDiscountTitle, { color: theme.colors.text }]}>
                  You do not have permission
                </Text>
                <Text style={[styles.restrictedDiscountBody, { color: theme.colors.textMuted }]}>
                  An admin or manager must enter their PIN to apply this discount.
                </Text>
                <View style={styles.restrictedDiscountActions}>
                  <Pressable
                    onPress={closeRestrictedDiscountFlow}
                    style={[
                      styles.restrictedDiscountButton,
                      {
                        backgroundColor: theme.colors.surfaceMuted,
                        borderColor: theme.colors.border,
                      },
                    ]}>
                    <Text style={[styles.restrictedDiscountButtonLabel, { color: theme.colors.text }]}>
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowDiscountAuth(true)}
                    style={[
                      styles.restrictedDiscountButton,
                      { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
                    ]}>
                    <Text
                      style={[
                        styles.restrictedDiscountButtonLabel,
                        { color: theme.colors.accentText },
                      ]}>
                      Continue
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.restrictedDiscountTitle, { color: theme.colors.text }]}>
                  Enter manager PIN
                </Text>
                <Animated.View
                  style={[styles.discountPinDots, { transform: [{ translateX: shake }] }]}>
                  {Array.from({ length: 4 }).map((_, index) => {
                    const filled = index < managerPin.length;
                    return (
                      <View
                        key={index}
                        style={[
                          styles.discountPinDot,
                          {
                            borderColor: discountPinError ? theme.colors.danger : theme.colors.border,
                            backgroundColor: filled ? theme.colors.text : 'transparent',
                          },
                        ]}
                      />
                    );
                  })}
                </Animated.View>
                <Text
                  style={[
                    styles.discountPinErrorText,
                    {
                      color: discountPinError ? theme.colors.danger : theme.colors.textMuted,
                    },
                  ]}>
                  {discountPinError || ' '}
                </Text>
                <View style={styles.discountPinKeypad}>
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0'].map(value => (
                    <Pressable
                      key={value}
                      onPress={() => {
                        if (value === '⌫') {
                          setManagerPin(current => current.slice(0, -1));
                          setDiscountPinError('');
                          return;
                        }
                        appendManagerPin(value);
                      }}
                      style={[
                        styles.discountPinKeypadButton,
                        {
                          backgroundColor: theme.colors.surfaceMuted,
                          borderColor: theme.colors.border,
                        },
                      ]}>
                      {value === '⌫' ? (
                        <MaterialDesignIcons
                          name="backspace-outline"
                          size={20}
                          color={theme.colors.text}
                        />
                      ) : (
                        <Text style={[styles.discountPinKeypadLabel, { color: theme.colors.text }]}>
                          {value}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

type CartItemMetadata = NonNullable<CartItem['metadata']>;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  checkoutBody: {
    flex: 1,
  },
  innerWrap: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  keypadContent: {
    flex: 1,
  },
  amountText: {
    fontSize: 74,
    fontWeight: '900',
    letterSpacing: -3,
    marginBottom: 34,
  },
  noteButton: {
    minHeight: 84,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 14,
  },
  noteButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  noteInput: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  keypadGrid: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  keypadCell: {
    width: '33.3333%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
  },
  keypadCellText: {
    fontSize: 38,
    fontWeight: '400',
  },
  reviewSaleFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  keypadReviewButton: {
    minHeight: 54,
  },
  libraryScrollContent: {
    paddingTop: 0,
    paddingBottom: 10,
    gap: 14,
  },
  libraryShell: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  libraryRail: {
    width: 58,
    alignItems: 'center',
  },
  libraryRailIconWrap: {
    minHeight: 68,
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  libraryMain: {
    flex: 1,
  },
  libraryCategorySection: {
    borderBottomWidth: 6,
  },
  libraryCategoryRow: {
    minHeight: 68,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  libraryCategoryLabel: {
    fontSize: 18,
    letterSpacing: -0.4,
  },
  libraryProductSection: {
    borderTopWidth: 1,
  },
  createItemCard: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 6,
  },
  createItemTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  createItemBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  libraryPlaceholder: {
    minHeight: 24,
  },
  favoritesScrollContent: {
    paddingTop: 14,
    paddingBottom: 10,
    gap: 16,
  },
  favoritesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  favoriteTile: {
    width: '48.2%',
    borderWidth: 1,
    overflow: 'hidden',
  },
  favoriteTileImageWrap: {
    aspectRatio: 0.96,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  favoriteTileImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  favoriteTileFallback: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  favoriteTileBody: {
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  favoriteTileTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  createMenuBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  createMenuCard: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  createMenuRow: {
    minHeight: 74,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  createMenuLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  customizerScreen: {
    flex: 1,
  },
  customizerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  customizerClose: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customizerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    marginHorizontal: 12,
  },
  customizerContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 24,
  },
  customizerSection: {
    gap: 14,
  },
  customizerSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customizerSectionTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  customizerBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  customizerBadgeLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  customizerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  choiceCard: {
    width: '48%',
    minHeight: 92,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
    gap: 4,
  },
  choiceTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  choiceSubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  customizerNoteInput: {
    minHeight: 144,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  customizerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  quantityPill: {
    width: 118,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityValue: {
    fontSize: 20,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
  },
  customizerDoneButton: {
    flex: 1,
    minHeight: 54,
  },
  restrictedDiscountBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  restrictedDiscountCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    gap: 16,
  },
  restrictedDiscountTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  restrictedDiscountBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  restrictedDiscountActions: {
    flexDirection: 'row',
    gap: 12,
  },
  restrictedDiscountButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restrictedDiscountButtonLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  discountPinDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginTop: 2,
  },
  discountPinDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  discountPinErrorText: {
    minHeight: 20,
    textAlign: 'center',
    fontSize: 14,
  },
  discountPinKeypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  discountPinKeypadButton: {
    width: 84,
    height: 62,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountPinKeypadLabel: {
    fontSize: 24,
    fontWeight: '700',
  },
});
