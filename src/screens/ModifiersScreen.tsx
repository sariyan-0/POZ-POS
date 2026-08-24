import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePOS } from '../hooks/usePOS';
import { useRootNavigation } from '../navigation/AppNavigator';
import { useAppTheme } from '../theme';

export function ModifiersScreen() {
  const navigation = useRootNavigation();
  const theme = useAppTheme();
  const { modifierSets } = usePOS();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.headerButton, { backgroundColor: theme.colors.surfaceMuted }]}>
          <MaterialDesignIcons color={theme.colors.text} name="arrow-left" size={28} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Modifiers</Text>
        <View style={styles.headerSpacer} />
      </View>

      {modifierSets.length ? (
        <View style={styles.list}>
          {modifierSets.map(modifierSet => (
            <Pressable
              key={modifierSet.id}
              onPress={() =>
                navigation.navigate('ModifierSetEditor', { modifierSetId: modifierSet.id })
              }
              style={[styles.row, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.rowLabel, { color: theme.colors.text }]}>
                {modifierSet.name}
              </Text>
              <MaterialDesignIcons
                color={theme.colors.textMuted}
                name="chevron-right"
                size={28}
              />
            </Pressable>
          ))}
          <Pressable
            onPress={() => navigation.navigate('ModifierSetEditor')}
            style={[styles.createMoreButton, { backgroundColor: theme.colors.text }]}>
            <Text style={[styles.createMoreLabel, { color: theme.colors.surface }]}>
              Create modifier set
            </Text>
          </Pressable>
        </View>
      ) : (
        <View
          style={[
            styles.emptyCard,
            { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
          ]}>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            Create modifiers for your items
          </Text>
          <Text style={[styles.emptyBody, { color: theme.colors.text }]}>
            Add a set of modifiers to have customizable options for an item at checkout, such as
            toppings, add-ons, or special requests.
          </Text>
          <Pressable
            onPress={() => navigation.navigate('ModifierSetEditor')}
            style={[styles.createButton, { backgroundColor: theme.colors.text }]}>
            <Text style={[styles.createButtonLabel, { color: theme.colors.surface }]}>
              Create modifier set
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    minHeight: 96,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 62,
    height: 62,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerSpacer: {
    width: 62,
  },
  emptyCard: {
    marginTop: 34,
    marginHorizontal: 34,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 44,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: -0.4,
  },
  emptyBody: {
    fontSize: 17,
    lineHeight: 30,
    textAlign: 'center',
    marginBottom: 30,
  },
  createButton: {
    minHeight: 64,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  createButtonLabel: {
    fontSize: 17,
    fontWeight: '800',
  },
  list: {
    paddingHorizontal: 22,
    paddingTop: 14,
  },
  row: {
    minHeight: 74,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  createMoreButton: {
    minHeight: 58,
    borderRadius: 999,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createMoreLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
});
