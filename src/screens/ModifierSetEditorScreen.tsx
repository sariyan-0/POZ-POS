import React, { useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModifierSet } from '../models/pos';
import { RootStackParamList, useRootNavigation } from '../navigation/AppNavigator';
import { useAppTheme } from '../theme';
import { createId } from '../utils/id';
import { getProductTileInitials, getReadableTileTextColor } from '../utils/productTile';
import { usePOS } from '../hooks/usePOS';

type ModifierSetEditorRoute = RouteProp<RootStackParamList, 'ModifierSetEditor'>;

export function ModifierSetEditorScreen() {
  const route = useRoute<ModifierSetEditorRoute>();
  const navigation = useRootNavigation();
  const theme = useAppTheme();
  const { state, modifierSets, upsertModifierSet } = usePOS();
  const existing = useMemo(
    () => modifierSets.find(entry => entry.id === route.params?.modifierSetId),
    [modifierSets, route.params?.modifierSetId],
  );

  const [name, setName] = useState(existing?.name ?? '');
  const [showApplyToItems, setShowApplyToItems] = useState(false);
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(existing?.itemIds ?? []);
  const [pickedRowId, setPickedRowId] = useState<string | null>(null);
  const [modifierRows, setModifierRows] = useState(
    existing?.modifiers.length
      ? [
          ...existing.modifiers.map(modifier => ({
            id: modifier.id,
            name: modifier.name,
            price: modifier.priceAdjustmentInCents
              ? (modifier.priceAdjustmentInCents / 100).toFixed(2)
              : '',
          })),
          { id: createId('modrow'), name: '', price: '' },
        ]
      : [{ id: createId('modrow'), name: '', price: '' }],
  );

  const saveDisabled = !name.trim() || !modifierRows.some(row => row.name.trim());
  const normalizedDraftRows = modifierRows
    .filter(row => row.name.trim() || row.price.trim())
    .map(row => ({
      name: row.name.trim(),
      price: Math.max(0, Math.round((Number.parseFloat(row.price || '0') || 0) * 100)),
    }));
  const normalizedExistingRows = (existing?.modifiers ?? []).map(row => ({
    name: row.name.trim(),
    price: row.priceAdjustmentInCents,
  }));
  const hasUnsavedChanges =
    name.trim() !== (existing?.name?.trim() ?? '') ||
    JSON.stringify(selectedItemIds) !== JSON.stringify(existing?.itemIds ?? []) ||
    JSON.stringify(normalizedDraftRows) !== JSON.stringify(normalizedExistingRows);
  const filteredProducts = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();
    if (!query) {
      return state.products;
    }

    return state.products.filter(product =>
      product.name.toLowerCase().includes(query) ||
      product.category.toLowerCase().includes(query),
    );
  }, [itemSearch, state.products]);

  function updateRow(
    rowId: string,
    field: 'name' | 'price',
    value: string,
  ) {
    setModifierRows(current => {
      const next = current.map(row => (row.id === rowId ? { ...row, [field]: value } : row));
      const last = next[next.length - 1];
      if (last.name.trim() || last.price.trim()) {
        next.push({ id: createId('modrow'), name: '', price: '' });
      }
      while (
        next.length > 1 &&
        !next[next.length - 1].name.trim() &&
        !next[next.length - 1].price.trim() &&
        !next[next.length - 2].name.trim() &&
        !next[next.length - 2].price.trim()
      ) {
        next.pop();
      }
      return next;
    });
  }

  function moveRow(sourceRowId: string, targetRowId: string) {
    if (sourceRowId === targetRowId) {
      return;
    }

    setModifierRows(current => {
      const sourceIndex = current.findIndex(row => row.id === sourceRowId);
      const targetIndex = current.findIndex(row => row.id === targetRowId);

      if (sourceIndex < 0 || targetIndex < 0) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setPickedRowId(null);
  }

  function removeRow(rowId: string) {
    setModifierRows(current => {
      const next = current.filter(row => row.id !== rowId);
      return next.length ? next : [{ id: createId('modrow'), name: '', price: '' }];
    });
  }

  function save() {
    if (saveDisabled) {
      return;
    }

    const payload: ModifierSet = {
      id: existing?.id ?? createId('mods'),
      name: name.trim(),
      itemIds: selectedItemIds,
      modifiers: modifierRows
        .filter(row => row.name.trim())
        .map(row => ({
          id: row.id.startsWith('modrow') ? createId('modi') : row.id,
          name: row.name.trim(),
          priceAdjustmentInCents: Math.max(
            0,
            Math.round((Number.parseFloat(row.price || '0') || 0) * 100),
          ),
        })),
    };

    upsertModifierSet(payload);
    navigation.goBack();
  }

  function handleClose() {
    if (showApplyToItems) {
      setShowApplyToItems(false);
      return;
    }
    if (hasUnsavedChanges) {
      setShowDiscardPrompt(true);
      return;
    }
    navigation.goBack();
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.header}>
        <Pressable
          onPress={handleClose}
          style={[styles.headerButton, { backgroundColor: theme.colors.surfaceMuted }]}>
          <MaterialDesignIcons color={theme.colors.text} name="close" size={28} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Create modifier set</Text>
        <Pressable
          onPress={save}
          style={[
            styles.saveButton,
            { backgroundColor: theme.colors.surfaceMuted, opacity: saveDisabled ? 0.55 : 1 },
          ]}>
          <Text style={[styles.saveButtonLabel, { color: theme.colors.textMuted }]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Text style={[styles.helperText, { color: theme.colors.text }]}>
          To set pre-selected modifiers and other advanced settings, visit your{' '}
          <Text style={styles.linkText}>Dashboard.</Text>
        </Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Modifier set name"
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.nameInput,
            {
              color: theme.colors.text,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            },
          ]}
        />

        <Pressable
          onPress={() => setShowApplyToItems(true)}
          style={[styles.applyRow, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.applyLabel, { color: theme.colors.text }]}>Apply to items</Text>
          <View style={styles.applyRight}>
            <Text style={[styles.applyCount, { color: theme.colors.text }]}>
              {selectedItemIds.length}
            </Text>
            <MaterialDesignIcons color={theme.colors.textMuted} name="chevron-right" size={28} />
          </View>
        </Pressable>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Modifiers</Text>
        {pickedRowId ? (
          <Text style={[styles.reorderHint, { color: theme.colors.textMuted }]}>
            Tap another six-dot handle to place this modifier there.
          </Text>
        ) : null}
        <View style={styles.modifierList}>
          {modifierRows.map(row => (
            <View
              key={row.id}
              style={[
                styles.modifierRow,
                pickedRowId === row.id
                  ? {
                      backgroundColor: theme.colors.surfaceMuted,
                      borderColor: theme.colors.text,
                    }
                  : {
                      borderColor: 'transparent',
                    },
              ]}>
              <Pressable
                onLongPress={() => {
                  if (row.name.trim() || row.price.trim()) {
                    setPickedRowId(row.id);
                  }
                }}
                onPress={() => {
                  if (pickedRowId && pickedRowId !== row.id) {
                    moveRow(pickedRowId, row.id);
                  }
                }}
                style={styles.dragHandle}>
                <MaterialDesignIcons
                  color={theme.colors.text}
                  name="drag-vertical"
                  size={24}
                />
              </Pressable>
              <TextInput
                value={row.name}
                onChangeText={text => updateRow(row.id, 'name', text)}
                placeholder="Modifier"
                placeholderTextColor={theme.colors.textMuted}
                style={[
                  styles.modifierNameInput,
                  {
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
              />
              <TextInput
                value={row.price}
                onChangeText={text => updateRow(row.id, 'price', text)}
                placeholder="$0.00"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
                style={[
                  styles.modifierPriceInput,
                  {
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
              />
              {(row.name.trim() || row.price.trim()) && modifierRows.length > 1 ? (
                <Pressable onPress={() => removeRow(row.id)} style={styles.deleteButton}>
                  <MaterialDesignIcons
                    color={theme.colors.text}
                    name="trash-can-outline"
                    size={24}
                  />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>

      {showApplyToItems ? (
        <View style={[styles.overlayScreen, { backgroundColor: theme.colors.surface }]}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.header}>
              <Pressable
                onPress={() => setShowApplyToItems(false)}
                style={[styles.headerButton, { backgroundColor: theme.colors.surfaceMuted }]}>
                <MaterialDesignIcons color={theme.colors.text} name="close" size={28} />
              </Pressable>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Apply to items</Text>
              <Pressable
                onPress={() => setShowApplyToItems(false)}
                style={[styles.headerDoneButton, { backgroundColor: theme.colors.text }]}>
                <Text style={[styles.headerDoneLabel, { color: theme.colors.surface }]}>Save</Text>
              </Pressable>
            </View>

            <View
              style={[
                styles.searchWrap,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
              ]}>
              <MaterialDesignIcons color={theme.colors.text} name="magnify" size={28} />
              <TextInput
                value={itemSearch}
                onChangeText={setItemSearch}
                placeholder="Search items"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.searchInput, { color: theme.colors.text }]}
              />
            </View>

            <ScrollView contentContainerStyle={styles.itemsList}>
              {filteredProducts.map(product => {
                const selected = selectedItemIds.includes(product.id);
                return (
                  <Pressable
                    key={product.id}
                    onPress={() =>
                      setSelectedItemIds(current =>
                        selected
                          ? current.filter(id => id !== product.id)
                          : [...current, product.id],
                      )
                    }
                    style={[styles.itemRow, { borderBottomColor: theme.colors.border }]}>
                    <View
                      style={[
                        styles.itemThumb,
                        {
                          backgroundColor: product.tileColor?.trim() || theme.colors.surfaceMuted,
                          borderColor: theme.colors.border,
                        },
                      ]}>
                      {product.imageUri ? (
                        <Image source={{ uri: product.imageUri }} style={styles.itemThumbImage} />
                      ) : (
                        <Text
                          style={[
                            styles.itemThumbLabel,
                            {
                              color: getReadableTileTextColor(
                                product.tileColor?.trim() || theme.colors.surfaceMuted,
                                theme.colors.text,
                                theme.colors.surface,
                              ),
                            },
                          ]}>
                          {getProductTileInitials(product)}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.itemName, { color: theme.colors.text }]}>
                      {product.name}
                    </Text>
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: selected ? theme.colors.text : theme.colors.textMuted,
                          backgroundColor: selected ? theme.colors.text : 'transparent',
                        },
                      ]}>
                      {selected ? (
                        <MaterialDesignIcons
                          color={theme.colors.surface}
                          name="check"
                          size={18}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </View>
      ) : null}

      <Modal
        transparent
        animationType="fade"
        visible={showDiscardPrompt}
        onRequestClose={() => setShowDiscardPrompt(false)}>
        <View style={[styles.promptBackdrop, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.promptCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.promptTitle, { color: theme.colors.text }]}>
              Unsaved changes
            </Text>
            <Text style={[styles.promptBody, { color: theme.colors.text }]}>
              Do you want to resume editing or discard these changes?
            </Text>
            <View style={styles.promptActions}>
              <Pressable
                onPress={() => {
                  setShowDiscardPrompt(false);
                  navigation.goBack();
                }}
                style={[styles.promptButton, { backgroundColor: theme.colors.surfaceMuted }]}>
                <Text style={[styles.discardLabel, { color: theme.colors.danger }]}>
                  Discard
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShowDiscardPrompt(false)}
                style={[styles.promptButton, { backgroundColor: theme.colors.text }]}>
                <Text style={[styles.resumeLabel, { color: theme.colors.surface }]}>
                  Resume
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingTop: 22,
    paddingBottom: 40,
  },
  header: {
    minHeight: 82,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 54,
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  saveButton: {
    minWidth: 112,
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonLabel: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerDoneButton: {
    minWidth: 120,
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  headerDoneLabel: {
    fontSize: 17,
    fontWeight: '800',
  },
  helperText: {
    paddingHorizontal: 34,
    fontSize: 17,
    lineHeight: 26,
    marginTop: 4,
    marginBottom: 22,
  },
  linkText: {
    textDecorationLine: 'underline',
  },
  nameInput: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 16,
    marginHorizontal: 34,
    paddingHorizontal: 18,
    fontSize: 17,
    marginBottom: 22,
  },
  applyRow: {
    minHeight: 72,
    marginHorizontal: 34,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  applyLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  applyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  applyCount: {
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    paddingHorizontal: 34,
    marginBottom: 18,
  },
  reorderHint: {
    paddingHorizontal: 34,
    fontSize: 13,
    lineHeight: 18,
    marginTop: -8,
    marginBottom: 14,
  },
  modifierList: {
    paddingHorizontal: 34,
    gap: 14,
  },
  modifierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  dragHandle: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modifierNameInput: {
    flex: 1,
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 17,
  },
  modifierPriceInput: {
    width: 136,
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 17,
  },
  overlayScreen: {
    ...StyleSheet.absoluteFill,
  },
  searchWrap: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 999,
    marginHorizontal: 34,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    minHeight: 40,
  },
  itemsList: {
    paddingHorizontal: 34,
    paddingBottom: 40,
  },
  itemRow: {
    minHeight: 82,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  itemThumb: {
    width: 54,
    height: 54,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemThumbImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  itemThumbLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  itemName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
  },
  checkbox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  promptCard: {
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  promptTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 18,
  },
  promptBody: {
    fontSize: 17,
    lineHeight: 28,
    marginBottom: 26,
  },
  promptActions: {
    flexDirection: 'row',
    gap: 14,
  },
  promptButton: {
    flex: 1,
    minHeight: 68,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardLabel: {
    fontSize: 17,
    fontWeight: '800',
  },
  resumeLabel: {
    fontSize: 17,
    fontWeight: '800',
  },
});
