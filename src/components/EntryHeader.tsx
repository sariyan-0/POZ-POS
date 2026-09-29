import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BrandLogo } from './BrandLogo';

export function EntryHeader({ rightSlot }: { rightSlot?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <BrandLogo compact />
      {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  rightSlot: {
    flexShrink: 0,
  },
});
