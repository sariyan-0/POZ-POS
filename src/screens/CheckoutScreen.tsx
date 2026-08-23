import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { useRootNavigation } from '../navigation/AppNavigator';
import { useAppTheme } from '../theme';
import { formatCurrency } from '../utils/format';

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
    activeProducts,
    activeDiscounts,
    favoriteProducts,
    saleItemCount,
    addProductToCart,
    addCustomAmountToCart,
  } = usePOS();
  const [tab, setTab] = useState<CheckoutTab>('keypad');
  const [search, setSearch] = useState('');
  const [entryDigits, setEntryDigits] = useState('');
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [librarySection, setLibrarySection] = useState<LibrarySectionKey>('items');
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

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
                      const selected =
                        tab === 'favorites'
                          ? section.key === 'items'
                          : librarySection === section.key;
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
                        const selected =
                          tab === 'favorites'
                            ? section.key === 'items'
                            : librarySection === section.key;

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
                              {tab === 'favorites' && section.key === 'items'
                                ? 'Favorites'
                                : section.label}
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
                              onPress={() => addProductToCart(product.id)}
                            />
                          ))}

                          {tab === 'favorites' && !favoriteProducts.length ? (
                            <EmptyNotice
                              title="No favorites yet"
                              body="Mark items as favorites when you create or edit them."
                            />
                          ) : null}

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
    </View>
  );
}

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
});
