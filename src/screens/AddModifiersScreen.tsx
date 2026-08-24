import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRootNavigation } from '../navigation/AppNavigator';
import { useAppTheme } from '../theme';

export function AddModifiersScreen() {
  const navigation = useRootNavigation();
  const theme = useAppTheme();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.surface }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.headerButton, { backgroundColor: theme.colors.surfaceMuted }]}>
          <MaterialDesignIcons color={theme.colors.text} name="close" size={28} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Add modifiers</Text>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.doneButton, { backgroundColor: theme.colors.text }]}>
          <Text style={[styles.doneButtonLabel, { color: theme.colors.surface }]}>Done</Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.emptyCard,
          { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
        ]}>
        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
          You don't have any modifiers
        </Text>
        <Text style={[styles.emptyBody, { color: theme.colors.text }]}>
          Create new modifiers{'\n'}in Items &gt; Modifiers.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    minHeight: 96,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
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
  doneButton: {
    minWidth: 120,
    height: 62,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  doneButtonLabel: {
    fontSize: 18,
    fontWeight: '800',
  },
  emptyCard: {
    marginTop: 34,
    marginHorizontal: 34,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  emptyBody: {
    fontSize: 17,
    lineHeight: 30,
    textAlign: 'center',
  },
});
