import React, { useMemo, useState } from 'react';
import { RouteProp, useRoute } from '@react-navigation/native';
import {
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
import { Discount } from '../models/pos';
import { createEmptyDiscount, usePOS } from '../hooks/usePOS';
import { RootStackParamList, useRootNavigation } from '../navigation/AppNavigator';
import { useAppTheme } from '../theme';

type DiscountEditorRoute = RouteProp<RootStackParamList, 'DiscountEditor'>;

export function DiscountEditorScreen() {
  const route = useRoute<DiscountEditorRoute>();
  const navigation = useRootNavigation();
  const theme = useAppTheme();
  const { state, upsertDiscount } = usePOS();
  const existingDiscount = useMemo(
    () => state.discounts.find(discount => discount.id === route.params?.discountId),
    [route.params?.discountId, state.discounts],
  );
  const [discount, setDiscount] = useState<Discount>(
    existingDiscount ? { ...existingDiscount } : createEmptyDiscount(),
  );

  const isEditing = !!existingDiscount;
  const saveDisabled = !discount.name.trim();

  function saveDiscount() {
    if (saveDisabled) {
      return;
    }

    upsertDiscount({
      ...discount,
      name: discount.name.trim(),
      active: true,
    });
    navigation.goBack();
  }

  function deleteDiscount() {
    if (!isEditing) {
      return;
    }

    upsertDiscount({
      ...discount,
      name: discount.name.trim(),
      active: false,
    });
    navigation.goBack();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.surface }}
        contentContainerStyle={styles.content}>
        <View style={[styles.headerRow, { borderBottomColor: theme.colors.border }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.closeButton, { backgroundColor: theme.colors.surfaceMuted }]}>
            <MaterialDesignIcons color={theme.colors.text} name="close" size={28} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {isEditing ? 'Edit Discount' : 'Create Discount'}
          </Text>
          <Pressable
            onPress={saveDiscount}
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

        <View style={styles.tileWrap}>
          <View
            style={[
              styles.tileCard,
              {
                backgroundColor: theme.colors.surfaceStrong,
                borderColor: theme.colors.border,
              },
            ]}>
            <MaterialDesignIcons
              color={theme.colors.textMuted}
              name="ticket-percent-outline"
              size={56}
            />
          </View>
          <View
            style={[
              styles.tileLabelWrap,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
              },
            ]}>
            <Text style={[styles.tileLabel, { color: theme.colors.text }]}>Price</Text>
          </View>
        </View>

        <TextInput
          value={discount.name}
          onChangeText={text => setDiscount(current => ({ ...current, name: text }))}
          placeholder="Price Adjustment"
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.nameField,
            { color: theme.colors.text, borderBottomColor: theme.colors.border },
          ]}
        />

        <View style={[styles.amountRow, { borderBottomColor: theme.colors.border }]}>
          <TextInput
            value={
              discount.amount
                ? String(discount.amount / (discount.type === 'fixed' ? 100 : 1))
                : ''
            }
            onChangeText={text =>
              setDiscount(current => ({
                ...current,
                amount:
                  current.type === 'fixed'
                    ? Math.max(0, Math.round((Number.parseFloat(text || '0') || 0) * 100))
                    : Math.max(0, Number.parseFloat(text || '0') || 0),
              }))
            }
            placeholder="$0.00"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="numeric"
            style={[styles.amountInput, { color: theme.colors.text }]}
          />

          <View
            style={[
              styles.typeSwitch,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surfaceMuted,
              },
            ]}>
            {[
              { key: 'percentage' as const, label: '%' },
              { key: 'fixed' as const, label: '$' },
            ].map(option => {
              const selected = discount.type === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setDiscount(current => ({ ...current, type: option.key }))}
                  style={[
                    styles.typeButton,
                    selected ? { backgroundColor: theme.colors.surface } : null,
                  ]}>
                  <Text style={[styles.typeButtonLabel, { color: theme.colors.text }]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
          Leave the discount amount blank to enter at the time of sale.
        </Text>
        <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
          Discounts are applied to the ticket before tax is calculated.
        </Text>

        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

        <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>OPTIONS</Text>

        <ToggleRow
          label="Apply discount after taxes"
          value={discount.applyAfterTaxes}
          onValueChange={value =>
            setDiscount(current => ({ ...current, applyAfterTaxes: value }))
          }
          description="This should only be used for manufacturer discounts and instant rebates. Learn More."
        />

        <ToggleRow
          label="Require passcode"
          value={discount.requirePasscode}
          onValueChange={value =>
            setDiscount(current => ({ ...current, requirePasscode: value }))
          }
        />

        {isEditing ? (
          <Pressable
            onPress={deleteDiscount}
            style={[
              styles.deleteButton,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}>
            <Text style={[styles.deleteLabel, { color: theme.colors.text }]}>
              Delete Discount
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
  description,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  description?: string;
}) {
  const theme = useAppTheme();

  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <View style={styles.toggleTopRow}>
          <Text style={[styles.toggleLabel, { color: theme.colors.text }]}>{label}</Text>
          <Switch value={value} onValueChange={onValueChange} />
        </View>
        {description ? (
          <Text style={[styles.toggleDescription, { color: theme.colors.textMuted }]}>
            {description}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 40,
  },
  headerRow: {
    minHeight: 72,
    borderBottomWidth: 1,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
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
    paddingHorizontal: 22,
  },
  saveLabel: {
    fontSize: 18,
    fontWeight: '800',
  },
  tileWrap: {
    alignItems: 'center',
    marginTop: 42,
    marginBottom: 20,
  },
  tileCard: {
    width: 138,
    height: 102,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabelWrap: {
    width: 138,
    minHeight: 36,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  nameField: {
    minHeight: 58,
    marginHorizontal: 44,
    borderBottomWidth: 1,
    fontSize: 18,
    paddingHorizontal: 0,
    marginBottom: 10,
  },
  amountRow: {
    minHeight: 66,
    marginHorizontal: 44,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  amountInput: {
    flex: 1,
    minHeight: 44,
    fontSize: 18,
    padding: 0,
  },
  typeSwitch: {
    height: 48,
    borderWidth: 1,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  typeButton: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeButtonLabel: {
    fontSize: 20,
    fontWeight: '800',
  },
  helperText: {
    marginHorizontal: 44,
    marginTop: 12,
    fontSize: 14,
    lineHeight: 22,
  },
  divider: {
    height: 8,
    marginTop: 18,
    marginBottom: 8,
  },
  sectionTitle: {
    marginHorizontal: 44,
    marginBottom: 20,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  toggleRow: {
    marginHorizontal: 44,
    marginBottom: 24,
  },
  toggleCopy: {
    gap: 14,
  },
  toggleTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  toggleLabel: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  toggleDescription: {
    fontSize: 14,
    lineHeight: 22,
  },
  deleteButton: {
    minHeight: 70,
    marginHorizontal: 68,
    marginTop: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
});
