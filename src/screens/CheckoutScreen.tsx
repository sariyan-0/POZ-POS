import React, { useMemo, useState } from 'react';
import {
  Pressable,
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
  RailIconColumn,
  SearchRow,
  SegmentedTabs,
  Thumbnail,
} from '../components/POSUI';
import { usePOS } from '../hooks/usePOS';
import { useRootNavigation } from '../navigation/AppNavigator';
import { useAppTheme } from '../theme';
import { formatCurrency } from '../utils/format';

type CheckoutTab = 'keypad' | 'library' | 'favorites';

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

              <PrimaryPillButton
                label={formatReviewSaleLabel(reviewSaleItemCount)}
                disabled={reviewSaleItemCount === 0}
                onPress={reviewSale}
                style={[
                  styles.keypadReviewButton,
                  { marginTop: compactLayout ? 10 : 16, marginBottom: insets.bottom + 8 },
                ]}
              />
            </View>
          ) : (
            <View style={{ flex: 1, paddingBottom: insets.bottom + 14 }}>
              <SearchRow value={search} onChangeText={setSearch} />
              <View style={styles.libraryWrap}>
                <RailIconColumn />
                <View style={styles.libraryList}>
                  <ListRow label="Items" showChevron icon="archive-outline" />
                  <ListRow label="Categories" showChevron icon="shape-outline" />
                  <ListRow label="Discounts" showChevron icon="ticket-percent-outline" />

                  {filteredProducts.map(product => (
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

                  <ListRow
                    label="Create a new item"
                    showChevron={false}
                    onPress={() => navigation.navigate('ProductEditor')}
                    tone="muted"
                  />
                </View>
              </View>
            </View>
          )}
        </View>
      </View>

      {tab !== 'keypad' ? (
        <View
          style={[
            styles.reviewSaleFooter,
            {
              paddingBottom: insets.bottom + 10,
              backgroundColor: theme.colors.background,
            },
          ]}>
          <View style={[styles.innerWrap, contentMaxWidth ? { maxWidth: contentMaxWidth } : null]}>
            <PrimaryPillButton
              label={formatReviewSaleLabel(reviewSaleItemCount)}
              disabled={reviewSaleItemCount === 0}
              onPress={reviewSale}
            />
          </View>
        </View>
      ) : null}
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
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  keypadReviewButton: {
    minHeight: 54,
  },
  libraryWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  libraryList: {
    flex: 1,
  },
});
