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

  const saveDisabled = !discount.name.trim() || discount.amount <= 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.surface }}
      contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.circleButton, { backgroundColor: theme.colors.surfaceMuted }]}>
          <MaterialDesignIcons color={theme.colors.text} name="close" size={28} />
        </Pressable>
        <Pressable
          onPress={() => {
            if (saveDisabled) {
              return;
            }
            upsertDiscount({
              ...discount,
              name: discount.name.trim(),
            });
            navigation.goBack();
          }}
          style={[
            styles.saveButton,
            {
              backgroundColor: saveDisabled
                ? theme.colors.surfaceStrong
                : theme.colors.surfaceMuted,
            },
          ]}>
          <Text
            style={[
              styles.saveLabel,
              { color: saveDisabled ? theme.colors.textMuted : theme.colors.text },
            ]}>
            Save
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.title, { color: theme.colors.text }]}>Create discount</Text>

      <Field
        placeholder="Discount name"
        value={discount.name}
        onChangeText={text => setDiscount(current => ({ ...current, name: text }))}
      />

      <Pressable
        onPress={() =>
          setDiscount(current => ({
            ...current,
            type: current.type === 'fixed' ? 'percentage' : 'fixed',
          }))
        }
        style={[
          styles.selector,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}>
        <Text style={[styles.selectorText, { color: theme.colors.textMuted }]}>
          {discount.type === 'fixed' ? 'Fixed amount' : 'Percentage'}
        </Text>
        <MaterialDesignIcons color={theme.colors.textMuted} name="chevron-down" size={26} />
      </Pressable>

      <Field
        placeholder={discount.type === 'fixed' ? 'Amount' : 'Percent'}
        value={discount.amount ? String(discount.amount / (discount.type === 'fixed' ? 100 : 1)) : ''}
        onChangeText={text =>
          setDiscount(current => ({
            ...current,
            amount:
              current.type === 'fixed'
                ? Math.max(0, Math.round((Number.parseFloat(text || '0') || 0) * 100))
                : Math.max(0, Number.parseFloat(text || '0') || 0),
          }))
        }
        keyboardType="numeric"
      />

      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Advanced settings</Text>

      <ToggleRow
        label="Require passcode"
        value={discount.requirePasscode}
        onValueChange={value =>
          setDiscount(current => ({ ...current, requirePasscode: value }))
        }
      />

      <ToggleRow
        label="Apply discount after taxes"
        value={discount.applyAfterTaxes}
        onValueChange={value =>
          setDiscount(current => ({ ...current, applyAfterTaxes: value }))
        }
        description="This should only be used for manufacturer discounts and instant rebates."
      />
    </ScrollView>
  );
}

function Field({
  placeholder,
  value,
  onChangeText,
  keyboardType,
}: {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'numeric';
}) {
  const theme = useAppTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textMuted}
      keyboardType={keyboardType}
      style={[
        styles.input,
        {
          color: theme.colors.text,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
      ]}
    />
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
        <Text style={[styles.toggleLabel, { color: theme.colors.text }]}>{label}</Text>
        {description ? (
          <Text style={[styles.toggleDescription, { color: theme.colors.textMuted }]}>
            {description}
          </Text>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 36,
    gap: 22,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleButton: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    minWidth: 88,
    minHeight: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  saveLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  input: {
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 22,
    fontSize: 18,
  },
  selector: {
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorText: {
    fontSize: 18,
  },
  divider: {
    height: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  toggleCopy: {
    flex: 1,
    gap: 6,
  },
  toggleLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  toggleDescription: {
    fontSize: 14,
    lineHeight: 22,
  },
});
