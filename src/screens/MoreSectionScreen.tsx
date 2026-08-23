import React from 'react';
import { Text, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { AppScreen } from '../components/POSUI';
import { RootStackParamList } from '../navigation/AppNavigator';
import { usePOS } from '../hooks/usePOS';
import { DeveloperTerminalPanel } from './DeveloperTerminalPanel';
import { useAppStripeTerminal } from '../terminal/StripeTerminalProvider';
import { useAppTheme } from '../theme';
import { percentToLabel } from '../utils/format';

type MoreSectionRoute = RouteProp<RootStackParamList, 'MoreSection'>;

export function MoreSectionScreen() {
  const { params } = useRoute<MoreSectionRoute>();
  const { state } = usePOS();
  const theme = useAppTheme();
  const terminal = useAppStripeTerminal();

  if (params.section === 'hardware') {
    return (
      <AppScreen
        title="Readers"
        subtitle="Manage Stripe Terminal readers, Tap to Pay, and terminal locations.">
        <DeveloperTerminalPanel />
      </AppScreen>
    );
  }

  const content =
    params.section === 'taxes'
        ? {
            title: 'Taxes',
            lines: [
              `Default tax rate: ${percentToLabel(state.settings.business.defaultTaxRate)}`,
              'Applied to taxable items and custom amounts during checkout.',
            ],
          }
        : params.section === 'appearance'
          ? {
              title: 'Appearance',
              lines: [
                'The app follows the device light or dark appearance automatically.',
                'The redesigned checkout is optimized first for phone layouts.',
              ],
            }
          : {
              title: 'Developer',
              lines: [
                'Terminal diagnostics are available from the Readers screen.',
                'Backend connectivity is configurable from Backend / Server settings.',
                `Stripe Terminal status: ${terminal.status}`,
              ],
            };

  return (
    <AppScreen title={content.title}>
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: 18,
          padding: 18,
          gap: 10,
        }}>
        {content.lines.map(line => (
          <Text key={line} style={{ color: theme.colors.text, lineHeight: 22 }}>
            {line}
          </Text>
        ))}
      </View>
    </AppScreen>
  );
}
