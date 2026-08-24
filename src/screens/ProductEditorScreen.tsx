import React, { useMemo, useRef, useState } from 'react';
import { RouteProp, useRoute } from '@react-navigation/native';
import {
  Image,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Asset,
  launchCamera,
  launchImageLibrary,
  type CameraOptions,
  type ImageLibraryOptions,
} from 'react-native-image-picker';
import {
  RichEditor,
  RichToolbar,
  actions as richTextActions,
} from 'react-native-pell-rich-editor';
import { Product, ProductOptionSet } from '../models/pos';
import { SegmentedTabs } from '../components/POSUI';
import { createEmptyProduct, usePOS } from '../hooks/usePOS';
import { RootStackParamList, useRootNavigation } from '../navigation/AppNavigator';
import { useAppTheme } from '../theme';
import { createId } from '../utils/id';
import {
  getProductTileLabel,
  getReadableTileTextColor,
  PRODUCT_TILE_COLORS,
} from '../utils/productTile';

type ProductEditorRoute = RouteProp<RootStackParamList, 'ProductEditor'>;
type TileEditorTab = 'image' | 'color';
type TileDraft = {
  label: string;
  imageUri: string;
  tileColor: string;
};

export function ProductEditorScreen() {
  const route = useRoute<ProductEditorRoute>();
  const theme = useAppTheme();
  const navigation = useRootNavigation();
  const { state, upsertProduct } = usePOS();
  const existingProduct = useMemo(
    () => state.products.find(product => product.id === route.params?.productId),
    [route.params?.productId, state.products],
  );
  const [product, setProduct] = useState<Product>(
    existingProduct ? { ...existingProduct } : createEmptyProduct(),
  );
  const [showTaxSelector, setShowTaxSelector] = useState(false);
  const [showOptionSelector, setShowOptionSelector] = useState(false);
  const [showOptionCreator, setShowOptionCreator] = useState(false);
  const [showModifierSelector, setShowModifierSelector] = useState(false);
  const [showTileEditor, setShowTileEditor] = useState(false);
  const [tileEditorTab, setTileEditorTab] = useState<TileEditorTab>('image');
  const [tileEditorMessage, setTileEditorMessage] = useState('');
  const [tileDraft, setTileDraft] = useState<TileDraft>({
    label: existingProduct?.tileLabel?.trim() || existingProduct?.name?.trim() || '',
    imageUri: existingProduct?.imageUri?.trim() || '',
    tileColor: existingProduct?.tileColor?.trim() || '',
  });
  const [optionSetName, setOptionSetName] = useState('');
  const [optionDisplayName, setOptionDisplayName] = useState('');
  const [optionValues, setOptionValues] = useState(['']);
  const [editingOptionSetId, setEditingOptionSetId] = useState<string | null>(null);
  const scrollViewRef = useRef<any>(null);
  const descriptionEditorRef = useRef<RichEditor>(null);

  const saveDisabled = !product.name.trim();
  const isEditing = !!existingProduct;

  function saveProduct() {
    if (saveDisabled) {
      return;
    }

    const trimmedName = product.name.trim();
    upsertProduct({
      ...product,
      name: trimmedName,
      description: product.description.trim(),
      sku: product.sku.trim(),
      category: product.category.trim() || 'Items',
      imageUri: product.imageUri?.trim() || '',
      tileColor: product.tileColor?.trim() || '',
      tileLabel: product.tileLabel?.trim() || '',
      imagePlaceholder: (
        (product.tileLabel?.trim() || trimmedName).slice(0, 2) || 'PO'
      ).toUpperCase(),
    });
    navigation.goBack();
  }

  const selectedTaxNames = state.settings.business.taxDefinitions
    .filter(tax => product.taxIds?.includes(tax.id))
    .map(tax => tax.name);
  const selectedModifierNames = state.modifierSets
    .filter(modifierSet => product.modifierSetIds?.includes(modifierSet.id))
    .map(modifierSet => modifierSet.name);
  const tilePreviewColor = product.tileColor?.trim() || theme.colors.surfaceMuted;
  const tilePreviewLabel = getProductTileLabel(product);
  const tilePreviewTextColor = getReadableTileTextColor(
    tilePreviewColor,
    theme.colors.text,
    theme.colors.surface,
  );
  const tileDraftPreviewColor = tileDraft.tileColor?.trim() || theme.colors.surfaceMuted;
  const tileDraftPreviewLabel = tileDraft.label.trim() || product.name.trim() || 'New Item';
  const tileDraftTextColor = getReadableTileTextColor(
    tileDraftPreviewColor,
    theme.colors.text,
    theme.colors.surface,
  );

  function createOptionSet() {
    const values = optionValues
      .map(value => value.trim())
      .filter(Boolean)
      .map(value => ({ id: createId('optv'), name: value }));

    if (!optionSetName.trim() || !optionDisplayName.trim() || !values.length) {
      return;
    }

    const nextOptionSet: ProductOptionSet = {
      id: editingOptionSetId ?? createId('opts'),
      name: optionSetName.trim(),
      displayName: optionDisplayName.trim(),
      values,
    };

    setProduct(current => ({
      ...current,
      optionSets: editingOptionSetId
        ? (current.optionSets ?? []).map(optionSet =>
            optionSet.id === editingOptionSetId ? nextOptionSet : optionSet,
          )
        : [...(current.optionSets ?? []), nextOptionSet],
    }));
    setOptionSetName('');
    setOptionDisplayName('');
    setOptionValues(['']);
    setEditingOptionSetId(null);
    setShowOptionCreator(false);
    setShowOptionSelector(true);
  }

  function openOptionEditor(optionSet?: ProductOptionSet) {
    if (optionSet) {
      setEditingOptionSetId(optionSet.id);
      setOptionSetName(optionSet.name);
      setOptionDisplayName(optionSet.displayName);
      setOptionValues(
        optionSet.values.length ? [...optionSet.values.map(value => value.name), ''] : [''],
      );
    } else {
      setEditingOptionSetId(null);
      setOptionSetName('');
      setOptionDisplayName('');
      setOptionValues(['']);
    }
    setShowOptionSelector(false);
    setShowOptionCreator(true);
  }

  function updateOptionValue(index: number, nextValue: string) {
    setOptionValues(current => {
      const next = [...current];
      next[index] = nextValue;

      const isLast = index === next.length - 1;
      if (isLast && nextValue.trim()) {
        next.push('');
      }

      while (next.length > 1 && !next[next.length - 1].trim() && !next[next.length - 2].trim()) {
        next.pop();
      }

      return next;
    });
  }

  function openTileEditor() {
    setTileDraft({
      label: product.tileLabel?.trim() || product.name.trim(),
      imageUri: product.imageUri?.trim() || '',
      tileColor: product.tileColor?.trim() || '',
    });
    setTileEditorTab('image');
    setTileEditorMessage('');
    setShowTileEditor(true);
  }

  function closeTileEditor() {
    setShowTileEditor(false);
  }

  function saveTileEditor() {
    setProduct(current => ({
      ...current,
      imageUri: tileDraft.imageUri.trim(),
      tileColor: tileDraft.tileColor.trim(),
      tileLabel: tileDraft.label.trim(),
      imagePlaceholder: (
        (tileDraft.label.trim() || current.name.trim()).slice(0, 2) || 'PO'
      ).toUpperCase(),
    }));
    setShowTileEditor(false);
  }

  async function ensureAndroidCameraPermission() {
    if (Platform.OS !== 'android') {
      return true;
    }

    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Allow camera access',
        message: 'PowersOfZeroPOS needs the camera so you can take a product tile photo.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      },
    );

    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  function getStoredImageUri(asset?: Asset) {
    if (!asset) {
      return '';
    }

    if (asset.base64) {
      return `data:${asset.type || 'image/jpeg'};base64,${asset.base64}`;
    }

    return asset.uri?.trim() || '';
  }

  function applyPickedTileImage(asset?: Asset) {
    const nextUri = getStoredImageUri(asset);
    if (!nextUri) {
      setTileEditorMessage('We could not read that image.');
      return;
    }

    setTileDraft(current => ({ ...current, imageUri: nextUri }));
    setTileEditorTab('image');
    setTileEditorMessage('Image ready for this POS tile.');
  }

  async function chooseTileImageFromLibrary() {
    setTileEditorMessage('');
    try {
      const options: ImageLibraryOptions = {
        mediaType: 'photo',
        selectionLimit: 1,
        includeBase64: true,
        quality: 0.8,
        maxWidth: 1200,
        maxHeight: 1200,
      };

      const response = await launchImageLibrary(options);
      if (response.didCancel) {
        return;
      }

      if (response.errorCode) {
        setTileEditorMessage(response.errorMessage || 'Could not open the photo library.');
        return;
      }

      applyPickedTileImage(response.assets?.[0]);
    } catch {
      setTileEditorMessage(
        'Image picker is not available in this build yet. Rebuild the app and try again.',
      );
    }
  }

  async function takeTilePhoto() {
    setTileEditorMessage('');
    try {
      const hasPermission = await ensureAndroidCameraPermission();
      if (!hasPermission) {
        setTileEditorMessage('Camera access was denied.');
        return;
      }

      const options: CameraOptions = {
        mediaType: 'photo',
        includeBase64: true,
        quality: 0.8,
        maxWidth: 1200,
        maxHeight: 1200,
        cameraType: 'back',
        saveToPhotos: false,
      };

      const response = await launchCamera(options);
      if (response.didCancel) {
        return;
      }

      if (response.errorCode) {
        setTileEditorMessage(response.errorMessage || 'Could not open the camera.');
        return;
      }

      applyPickedTileImage(response.assets?.[0]);
    } catch {
      setTileEditorMessage(
        'Camera is not available in this build yet. Rebuild the app and try again.',
      );
    }
  }

  function removeTileImage() {
    setTileDraft(current => ({ ...current, imageUri: '' }));
    setTileEditorMessage('Image removed.');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1, backgroundColor: theme.colors.surface }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.topBar, { borderBottomColor: theme.colors.border }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.circleButton, { backgroundColor: theme.colors.surfaceMuted }]}>
            <MaterialDesignIcons color={theme.colors.text} name="close" size={28} />
          </Pressable>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {isEditing ? 'Edit item' : 'Create item'}
          </Text>
          <Pressable
            onPress={saveProduct}
            disabled={saveDisabled}
            style={[
              styles.saveButton,
              {
                backgroundColor: saveDisabled
                  ? theme.colors.surfaceMuted
                  : theme.colors.accent,
                opacity: saveDisabled ? 0.55 : 1,
              },
            ]}>
            <Text
              style={[
                styles.saveLabel,
                {
                  color: saveDisabled ? theme.colors.textMuted : theme.colors.accentText,
                },
              ]}>
              Save
            </Text>
          </Pressable>
        </View>

        <View style={styles.heroBlock}>
          <View
            style={[
              styles.previewCard,
              {
                backgroundColor: product.imageUri ? theme.colors.surfaceMuted : tilePreviewColor,
                borderColor: theme.colors.border,
              },
            ]}>
            {product.imageUri ? (
              <Image source={{ uri: product.imageUri }} style={styles.previewCardImage} />
            ) : null}
            <View
              style={[
                styles.previewCardFooter,
                {
                  backgroundColor: product.imageUri ? 'rgba(0,0,0,0.36)' : 'transparent',
                },
              ]}>
              <Text
                style={[
                  styles.previewTitle,
                  { color: product.imageUri ? '#FFFFFF' : tilePreviewTextColor },
                ]}>
                {tilePreviewLabel}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={openTileEditor}
            style={[styles.softPill, { backgroundColor: theme.colors.surfaceStrong }]}>
            <Text style={[styles.softPillLabel, { color: theme.colors.text }]}>
              Edit POS tile
            </Text>
          </Pressable>
        </View>

      <FieldCard>
        <View style={styles.nameRow}>
          <TextInput
            value={product.name}
            onChangeText={text => setProduct(current => ({ ...current, name: text }))}
            placeholder="Name"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.nameInput, { color: theme.colors.text }]}
          />
          <Pressable style={styles.inlineAction}>
            <MaterialDesignIcons color={theme.colors.text} name="barcode-scan" size={26} />
            <Text style={[styles.inlineActionLabel, { color: theme.colors.text }]}>
              Auto create
            </Text>
          </Pressable>
        </View>
      </FieldCard>

      <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
        Scan a barcode with a connected scanner to auto create the item.
      </Text>

      <FieldCard>
        <View style={styles.descriptionEditor}>
          <RichEditor
            ref={descriptionEditorRef}
            initialHeight={178}
            initialContentHTML={toRichTextHtml(product.description)}
            placeholder="Description"
            onCursorPosition={offsetY => {
              scrollViewRef.current?.scrollTo({
                y: Math.max(0, offsetY - 180),
                animated: true,
              });
            }}
            editorStyle={{
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
              caretColor: theme.colors.text,
              placeholderColor: theme.colors.textMuted,
              contentCSSText: `
                font-size: 18px;
                line-height: 26px;
                padding: 18px 18px 18px 18px;
                color: ${theme.colors.text};
                background-color: ${theme.colors.surface};
              `,
              cssText: `
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                  color: ${theme.colors.text};
                  background-color: ${theme.colors.surface};
                }
                p, div {
                  margin: 0 0 10px 0;
                }
                ul, ol {
                  padding-left: 22px;
                  margin: 0 0 10px 0;
                }
                a {
                  color: ${theme.colors.text};
                }
              `,
            }}
            onChange={html => setProduct(current => ({ ...current, description: html }))}
            style={styles.richEditor}
          />
        </View>
        <RichToolbar
          editor={descriptionEditorRef}
          actions={[
            richTextActions.setBold,
            richTextActions.setItalic,
            richTextActions.setUnderline,
            richTextActions.setStrikethrough,
            richTextActions.insertBulletsList,
            richTextActions.insertOrderedList,
            richTextActions.insertLink,
          ]}
          iconTint={theme.colors.textMuted}
          selectedIconTint={theme.colors.text}
          style={[
            styles.richToolbar,
            {
              borderTopColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            },
          ]}
          flatContainerStyle={styles.richToolbarContent}
          selectedButtonStyle={{ backgroundColor: theme.colors.surfaceStrong }}
        />
      </FieldCard>

      <SectionDivider themeBorder={theme.colors.border} />

      <SectionTitle label="Taxes" />
      <Pressable style={styles.infoRow} onPress={() => setShowTaxSelector(true)}>
        <View style={styles.infoCopy}>
          <Text style={[styles.infoTitle, { color: theme.colors.text }]}>Taxes</Text>
          <Text style={[styles.infoBody, { color: theme.colors.textMuted }]}>
            {!product.taxable
              ? 'No taxes available'
              : selectedTaxNames.length
                ? selectedTaxNames.join(', ')
                : 'Uses store tax settings'}
          </Text>
        </View>
        <MaterialDesignIcons color={theme.colors.textMuted} name="chevron-right" size={28} />
      </Pressable>

      <SectionDivider themeBorder={theme.colors.border} />

      <SectionTitle label="Categorization" />
      <Pressable style={styles.infoRow}>
        <View style={styles.rowIconWrap}>
          <MaterialDesignIcons color={theme.colors.text} name="folder-outline" size={30} />
        </View>
        <View style={styles.infoCopy}>
          <Text style={[styles.infoTitle, { color: theme.colors.text }]}>Categories</Text>
          <Text style={[styles.infoBody, { color: theme.colors.textMuted }]}>
            {product.category || 'None'}
          </Text>
        </View>
        <MaterialDesignIcons color={theme.colors.textMuted} name="chevron-right" size={28} />
      </Pressable>

      <SectionDivider themeBorder={theme.colors.border} />

      <SectionTitle label="Options" />
      <Text style={[styles.paragraph, { color: theme.colors.text }]}>
        Add a custom set of options to create variations for an item. For example, add a size option
        set to create variations for small, medium, and large. <Text style={styles.linkLike}>Learn more</Text>
      </Text>
      <Pressable
        onPress={() => setShowOptionSelector(true)}
        style={[styles.fullWidthPill, { backgroundColor: theme.colors.surfaceStrong }]}>
        <Text style={[styles.fullWidthPillLabel, { color: theme.colors.text }]}>
          {product.optionSets?.length ? 'Manage options' : 'Add options'}
        </Text>
      </Pressable>

      <SectionTitle label="Price and inventory" />
      <StackField
        label="SKU"
        value={product.sku}
        onChangeText={text => setProduct(current => ({ ...current, sku: text }))}
      />
      <StackField
        label="GTIN"
        value=""
        onChangeText={() => {}}
        placeholder="GTIN"
      />
      <Pressable style={[styles.stackCard, { borderColor: theme.colors.border }]}>
        <View>
          <Text style={[styles.stackLabel, { color: theme.colors.text }]}>Unit</Text>
          <Text style={[styles.stackValue, { color: theme.colors.text }]}>Per item</Text>
        </View>
        <Text style={[styles.linkLike, { color: theme.colors.text }]}>Change</Text>
      </Pressable>
      <StackField
        label="Price"
        value={product.priceInCents ? String(product.priceInCents / 100) : ''}
        onChangeText={text =>
          setProduct(current => ({
            ...current,
            priceInCents: Math.max(0, Math.round((Number.parseFloat(text || '0') || 0) * 100)),
          }))
        }
        placeholder="Price"
        keyboardType="numeric"
      />
      <StackField
        label="Unit cost"
        value=""
        onChangeText={() => {}}
        placeholder="Unit cost"
        keyboardType="numeric"
      />

      <View style={styles.rowBetween}>
        <Text style={[styles.sectionInlineTitle, { color: theme.colors.text }]}>Stock on hand</Text>
        <Text style={[styles.linkLike, { color: theme.colors.text }]}>Manage stock</Text>
      </View>

      <View style={styles.toggleSection}>
        <ToggleRow
          label="Inventory tracking"
          value={product.trackInventory}
          onValueChange={value => setProduct(current => ({ ...current, trackInventory: value }))}
        />
        <ToggleRow
          label="Favorite"
          value={product.isFavorite}
          onValueChange={value => setProduct(current => ({ ...current, isFavorite: value }))}
        />
        <ToggleRow
          label="Active"
          value={product.active}
          onValueChange={value => setProduct(current => ({ ...current, active: value }))}
        />
      </View>

      <Pressable style={[styles.fullWidthPill, { backgroundColor: theme.colors.surfaceStrong }]}>
        <Text style={[styles.fullWidthPillLabel, { color: theme.colors.text }]}>
          Create variation
        </Text>
      </Pressable>

      <SectionDivider themeBorder={theme.colors.border} />

      <SectionTitle label="Modifiers" />
      <Text style={[styles.paragraph, { color: theme.colors.text }]}>
        Allow customizations such as toppings or special requests like extra cheese.
      </Text>
      <Pressable
        onPress={() => setShowModifierSelector(true)}
        style={[styles.fullWidthPill, { backgroundColor: theme.colors.surfaceStrong }]}>
        <Text style={[styles.fullWidthPillLabel, { color: theme.colors.text }]}>
          {selectedModifierNames.length ? 'Manage modifiers' : 'Add modifiers'}
        </Text>
      </Pressable>
      {selectedModifierNames.length ? (
        <Text style={[styles.selectionSummary, { color: theme.colors.textMuted }]}>
          {selectedModifierNames.join(', ')}
        </Text>
      ) : null}

      <Modal
        visible={showTileEditor}
        animationType="slide"
        onRequestClose={closeTileEditor}>
        <SafeAreaView style={[styles.tileEditorScreen, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.topBar, { borderBottomColor: theme.colors.border }]}>
            <Pressable
              onPress={closeTileEditor}
              style={[styles.circleButton, { backgroundColor: theme.colors.surfaceMuted }]}>
              <MaterialDesignIcons color={theme.colors.text} name="close" size={28} />
            </Pressable>
            <Text style={[styles.title, { color: theme.colors.text }]}>Edit POS tile</Text>
            <Pressable
              onPress={saveTileEditor}
              style={[styles.tileSaveButton, { backgroundColor: theme.colors.accent }]}>
              <Text style={[styles.tileSaveLabel, { color: theme.colors.accentText }]}>Save</Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.tileEditorContent}>
            <View style={styles.tilePreviewWrap}>
              <View
                style={[
                  styles.tilePreviewCard,
                  {
                    backgroundColor: tileDraft.imageUri
                      ? theme.colors.surfaceMuted
                      : tileDraftPreviewColor,
                    borderColor: theme.colors.border,
                  },
                ]}>
                {tileDraft.imageUri ? (
                  <Image source={{ uri: tileDraft.imageUri }} style={styles.tilePreviewImage} />
                ) : null}
                <View
                  style={[
                    styles.tilePreviewFooter,
                    {
                      backgroundColor: tileDraft.imageUri
                        ? 'rgba(0,0,0,0.36)'
                        : 'transparent',
                    },
                  ]}>
                  <Text
                    style={[
                      styles.tilePreviewTitle,
                      { color: tileDraft.imageUri ? '#FFFFFF' : tileDraftTextColor },
                    ]}
                    numberOfLines={2}>
                    {tileDraftPreviewLabel}
                  </Text>
                </View>
              </View>
            </View>

            <FieldCard>
              <TextInput
                value={tileDraft.label}
                onChangeText={text => setTileDraft(current => ({ ...current, label: text }))}
                placeholder="Tile label"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.tileLabelInput, { color: theme.colors.text }]}
              />
            </FieldCard>

            <View style={styles.tileSegmentWrap}>
              <SegmentedTabs
                options={[
                  { key: 'image', label: 'Image' },
                  { key: 'color', label: 'Color' },
                ]}
                value={tileEditorTab}
                onChange={nextValue => setTileEditorTab(nextValue as TileEditorTab)}
              />
            </View>

            {tileEditorTab === 'image' ? (
              <View style={styles.tileActionList}>
                <TileActionRow
                  icon="view-grid-outline"
                  label="Choose from library"
                  onPress={chooseTileImageFromLibrary}
                />
                <TileActionRow
                  icon="camera-outline"
                  label="Take a photo"
                  onPress={takeTilePhoto}
                />
                <TileActionRow
                  icon="trash-can-outline"
                  label="Remove image"
                  onPress={removeTileImage}
                />
              </View>
            ) : (
              <View style={styles.colorGrid}>
                {PRODUCT_TILE_COLORS.map(color => {
                  const selected = tileDraft.tileColor === color && !tileDraft.imageUri;
                  return (
                    <Pressable
                      key={color}
                      onPress={() =>
                        setTileDraft(current => ({
                          ...current,
                          tileColor: color,
                          imageUri: '',
                        }))
                      }
                      style={[
                        styles.colorSwatchOuter,
                        { borderColor: selected ? theme.colors.text : 'transparent' },
                      ]}>
                      <View style={[styles.colorSwatch, { backgroundColor: color }]} />
                    </Pressable>
                  );
                })}
              </View>
            )}
            <Text
              style={[
                styles.tileEditorMessage,
                {
                  color: tileEditorMessage ? theme.colors.textMuted : 'transparent',
                },
              ]}>
              {tileEditorMessage || ' '}
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

        <Modal
        visible={showModifierSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModifierSelector(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.sheetCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.sheetHeader}>
              <Pressable onPress={() => setShowModifierSelector(false)}>
                <MaterialDesignIcons color={theme.colors.text} name="close" size={28} />
              </Pressable>
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>
                Add modifiers
              </Text>
              <View style={{ width: 28 }} />
            </View>
            {state.modifierSets.length ? (
              state.modifierSets.map(modifierSet => {
                const selected = product.modifierSetIds?.includes(modifierSet.id);
                return (
                  <Pressable
                    key={modifierSet.id}
                    onPress={() =>
                      setProduct(current => ({
                        ...current,
                        modifierSetIds: selected
                          ? (current.modifierSetIds ?? []).filter(id => id !== modifierSet.id)
                          : [...(current.modifierSetIds ?? []), modifierSet.id],
                      }))
                    }
                    style={[styles.sheetRow, { borderBottomColor: theme.colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.infoTitle, { color: theme.colors.text }]}>
                        {modifierSet.name}
                      </Text>
                      <Text style={[styles.infoBody, { color: theme.colors.textMuted }]}>
                        {modifierSet.modifiers.map(modifier => modifier.name).join(', ')}
                      </Text>
                    </View>
                    <MaterialDesignIcons
                      color={selected ? theme.colors.accent : theme.colors.textMuted}
                      name={selected ? 'check-circle' : 'checkbox-blank-circle-outline'}
                      size={24}
                    />
                  </Pressable>
                );
              })
            ) : (
              <View style={styles.emptyOptionState}>
                <Text style={[styles.emptyOptionTitle, { color: theme.colors.text }]}>
                  You don't have any modifiers
                </Text>
                <Text style={[styles.emptyOptionBody, { color: theme.colors.textMuted }]}>
                  Create new modifiers in Items {'>'} Modifiers.
                </Text>
                <Pressable
                  onPress={() => {
                    setShowModifierSelector(false);
                    navigation.navigate('Modifiers');
                  }}
                  style={[styles.createOptionButton, { backgroundColor: theme.colors.surfaceStrong }]}>
                  <Text style={[styles.fullWidthPillLabel, { color: theme.colors.text }]}>
                    Open modifiers
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTaxSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTaxSelector(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.sheetCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.sheetHeader}>
              <Pressable onPress={() => setShowTaxSelector(false)}>
                <MaterialDesignIcons color={theme.colors.text} name="close" size={28} />
              </Pressable>
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>Select taxes</Text>
              <View style={{ width: 28 }} />
            </View>
            {state.settings.business.taxDefinitions.map(tax => {
              const selected = product.taxIds?.includes(tax.id);
              return (
                <Pressable
                  key={tax.id}
                  onPress={() =>
                    setProduct(current => ({
                      ...current,
                      taxIds: selected
                        ? (current.taxIds ?? []).filter(id => id !== tax.id)
                        : [...(current.taxIds ?? []), tax.id],
                    }))
                  }
                  style={[
                    styles.sheetRow,
                    { borderBottomColor: theme.colors.border },
                  ]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoTitle, { color: theme.colors.text }]}>{tax.name}</Text>
                    <Text style={[styles.infoBody, { color: theme.colors.textMuted }]}>
                      {tax.rate}%
                    </Text>
                  </View>
                  <MaterialDesignIcons
                    color={selected ? theme.colors.accent : theme.colors.textMuted}
                    name={selected ? 'check-circle' : 'checkbox-blank-circle-outline'}
                    size={24}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showOptionSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOptionSelector(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.sheetCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.sheetHeader}>
              <Pressable onPress={() => setShowOptionSelector(false)}>
                <MaterialDesignIcons color={theme.colors.text} name="close" size={28} />
              </Pressable>
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>
                Select item options
              </Text>
              <Pressable onPress={() => setShowOptionSelector(false)}>
                <Text style={[styles.sheetAction, { color: theme.colors.text }]}>Next</Text>
              </Pressable>
            </View>
            {product.optionSets?.length ? (
              product.optionSets.map(optionSet => (
                <Pressable
                  key={optionSet.id}
                  onPress={() => openOptionEditor(optionSet)}
                  style={[styles.sheetRow, { borderBottomColor: theme.colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoTitle, { color: theme.colors.text }]}>
                      {optionSet.name}
                    </Text>
                    <Text style={[styles.infoBody, { color: theme.colors.textMuted }]}>
                      {optionSet.values.map(value => value.name).join(', ')}
                    </Text>
                  </View>
                  <MaterialDesignIcons
                    color={theme.colors.textMuted}
                    name="chevron-right"
                    size={24}
                  />
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyOptionState}>
                <MaterialDesignIcons
                  color={theme.colors.textMuted}
                  name="layers-outline"
                  size={72}
                />
                <Text style={[styles.emptyOptionTitle, { color: theme.colors.text }]}>
                  No options
                </Text>
                <Pressable
                  onPress={() => openOptionEditor()}
                  style={[styles.createOptionButton, { backgroundColor: theme.colors.surfaceStrong }]}>
                  <Text style={[styles.fullWidthPillLabel, { color: theme.colors.text }]}>
                    Create option
                  </Text>
                </Pressable>
                <Text style={[styles.emptyOptionBody, { color: theme.colors.textMuted }]}>
                  Create options for selectable values on your items at checkout. Learn More
                </Text>
              </View>
            )}
            {product.optionSets?.length ? (
              <Pressable
                onPress={() => openOptionEditor()}
                style={[styles.createOptionButton, { backgroundColor: theme.colors.surfaceStrong }]}>
                <Text style={[styles.fullWidthPillLabel, { color: theme.colors.text }]}>
                  Create option
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showOptionCreator}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOptionCreator(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.sheetCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.sheetHeader}>
              <Pressable onPress={() => setShowOptionCreator(false)}>
                <MaterialDesignIcons color={theme.colors.text} name="close" size={28} />
              </Pressable>
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>
                {editingOptionSetId ? 'Edit option' : 'Create option'}
              </Text>
              <Pressable onPress={createOptionSet}>
                <Text style={[styles.sheetAction, { color: theme.colors.text }]}>Create</Text>
              </Pressable>
            </View>
            <Text style={[styles.optionLabel, { color: theme.colors.text }]}>Option set</Text>
            <TextInput
              value={optionSetName}
              onChangeText={setOptionSetName}
              placeholder="T-shirt color"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.optionInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
            />
            <Text style={[styles.optionLabel, { color: theme.colors.text }]}>Display name</Text>
            <TextInput
              value={optionDisplayName}
              onChangeText={setOptionDisplayName}
              placeholder="Color"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.optionInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
            />
            <Text style={[styles.optionLabel, { color: theme.colors.text }]}>Options</Text>
            <View style={styles.optionInputList}>
              {optionValues.map((value, index) => (
                <TextInput
                  key={`${editingOptionSetId ?? 'new'}-${index}`}
                  value={value}
                  onChangeText={text => updateOptionValue(index, text)}
                  placeholder={index === 0 ? 'Add option' : 'Add another option'}
                  placeholderTextColor={theme.colors.textMuted}
                  style={[
                    styles.optionInput,
                    { color: theme.colors.text, borderColor: theme.colors.border },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

function FieldCard({ children }: { children: React.ReactNode }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.fieldCard, { borderColor: theme.colors.border }]}>{children}</View>
  );
}

function StackField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
}) {
  const theme = useAppTheme();

  return (
    <View style={[styles.stackCard, { borderColor: theme.colors.border }]}>
      <Text style={[styles.stackLabel, { color: theme.colors.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        keyboardType={keyboardType}
        style={[styles.stackInput, { color: theme.colors.text }]}
      />
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.toggleRow}>
      <Text style={[styles.toggleLabel, { color: theme.colors.text }]}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

function SectionTitle({ label }: { label: string }) {
  const theme = useAppTheme();
  return <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{label}</Text>;
}

function SectionDivider({ themeBorder }: { themeBorder: string }) {
  return <View style={[styles.sectionDivider, { backgroundColor: themeBorder }]} />;
}

function TileActionRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialDesignIcons>['name'];
  label: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[styles.tileActionRow, { borderBottomColor: theme.colors.border }]}>
      <MaterialDesignIcons color={theme.colors.text} name={icon} size={28} />
      <Text style={[styles.tileActionLabel, { color: theme.colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function toRichTextHtml(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed;
  }

  return trimmed
    .split('\n')
    .map(line => `<p>${escapeHtml(line) || '<br/>'}</p>`)
    .join('');
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 40,
  },
  topBar: {
    minHeight: 72,
    borderBottomWidth: 1,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleButton: {
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  saveButton: {
    minWidth: 96,
    minHeight: 58,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  saveLabel: {
    fontSize: 17,
    fontWeight: '800',
  },
  heroBlock: {
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 18,
    gap: 14,
  },
  previewCard: {
    width: 120,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  previewCardImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  previewCardFooter: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'flex-end',
    minHeight: 42,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  softPill: {
    minHeight: 64,
    borderRadius: 999,
    paddingHorizontal: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  softPillLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  fieldCard: {
    marginHorizontal: 18,
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  nameRow: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 16,
  },
  nameInput: {
    flex: 1,
    fontSize: 18,
    minHeight: 52,
  },
  inlineAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineActionLabel: {
    fontSize: 17,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  helperText: {
    paddingHorizontal: 18,
    paddingTop: 14,
    fontSize: 14,
    lineHeight: 22,
  },
  descriptionEditor: {
    minHeight: 178,
  },
  richEditor: {
    minHeight: 178,
  },
  richToolbar: {
    minHeight: 58,
    borderTopWidth: 1,
  },
  richToolbarContent: {
    paddingHorizontal: 12,
  },
  sectionDivider: {
    height: 8,
    borderRadius: 999,
    marginHorizontal: 18,
    marginVertical: 20,
  },
  sectionTitle: {
    paddingHorizontal: 18,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  infoRow: {
    minHeight: 88,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowIconWrap: {
    width: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCopy: {
    flex: 1,
    gap: 4,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  infoBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  paragraph: {
    paddingHorizontal: 18,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 18,
  },
  linkLike: {
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  fullWidthPill: {
    minHeight: 66,
    borderRadius: 999,
    marginHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  fullWidthPillLabel: {
    fontSize: 17,
    fontWeight: '800',
  },
  selectionSummary: {
    paddingHorizontal: 18,
    marginTop: -10,
    marginBottom: 22,
    fontSize: 14,
    lineHeight: 20,
  },
  stackCard: {
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 18,
    marginHorizontal: 18,
    marginBottom: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  stackLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  stackValue: {
    fontSize: 18,
    lineHeight: 24,
  },
  stackInput: {
    fontSize: 18,
    minHeight: 28,
    padding: 0,
  },
  rowBetween: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionInlineTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  toggleSection: {
    gap: 14,
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  toggleRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  tileEditorScreen: {
    flex: 1,
  },
  tileSaveButton: {
    minWidth: 96,
    minHeight: 58,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  tileSaveLabel: {
    fontSize: 18,
    fontWeight: '800',
  },
  tileEditorContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 40,
  },
  tilePreviewWrap: {
    alignItems: 'center',
    marginBottom: 22,
  },
  tilePreviewCard: {
    width: 260,
    aspectRatio: 1.15,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  tilePreviewImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  tilePreviewFooter: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    justifyContent: 'flex-end',
    minHeight: 74,
  },
  tilePreviewTitle: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  tileLabelInput: {
    minHeight: 82,
    paddingHorizontal: 18,
    fontSize: 18,
  },
  tileSegmentWrap: {
    paddingTop: 18,
    paddingBottom: 12,
  },
  tileActionList: {
    marginTop: 8,
  },
  tileActionRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    borderBottomWidth: 1,
  },
  tileActionLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingTop: 18,
  },
  tileEditorMessage: {
    minHeight: 20,
    fontSize: 14,
    lineHeight: 20,
    paddingTop: 16,
  },
  colorSwatchOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  sheetCard: {
    minHeight: '74%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
  },
  sheetHeader: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  sheetAction: {
    fontSize: 18,
    fontWeight: '800',
  },
  sheetRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    gap: 12,
  },
  emptyOptionState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  emptyOptionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 16,
  },
  emptyOptionBody: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 16,
  },
  createOptionButton: {
    minHeight: 62,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 26,
    width: '100%',
  },
  optionLabel: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  optionInput: {
    minHeight: 58,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 18,
    marginBottom: 18,
  },
  optionInputList: {
    gap: 0,
  },
});
