import { SkeletonRows } from '../components/Skeleton';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../components/POSUI';
import { apiClient } from '../services/api/ApiClient';
import { usePOS } from '../hooks/usePOS';
import { useAppTheme } from '../theme';
import { formatCurrency } from '../utils/format';
type Report = {
  gross: number;
  refunds: number;
  net: number;
  taxes: number;
  discounts: number;
  reportingCurrency: string;
  completed: unknown[];
  tenders?: Record<string, number>;
};
export function MoneyScreen() {
  const theme = useAppTheme();
  const { state } = usePOS();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiClient.get<{ data: { report: Report } }>(
        '/api/reports/summary',
      );
      setReport(payload.data.report);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Unable to load report.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const currency = report?.reportingCurrency === 'usd' ? 'USD' : 'CAD';
  const rows = report
    ? ([
        ['Sales collected', report.gross],
        ['Refunds', report.refunds],
        ['Net collected', report.net],
        ['Tax charged before refunds', report.taxes],
        ['Discounts applied', report.discounts ?? 0],
        ...Object.entries(report.tenders ?? {}).map(([provider, amount]) => [
          `${
            provider === 'stripe'
              ? 'Card'
              : provider === 'cash'
              ? 'Cash'
              : 'Other'
          } collected`,
          amount,
        ]),
      ] as Array<[string, number]>)
    : [];
  return (
    <AppScreen
      title="Money"
      subtitle="Last 30 days · Same sales summary as your web dashboard."
    >
      {error && (
        <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>
          {error}
        </Text>
      )}
      {loading && !report && (
        <SkeletonRows
          label="Loading sales summary"
          variant="summary"
          count={5}
        />
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => load()}
        disabled={loading}
        style={styles.button}
      >
        <Text style={{ color: theme.colors.accent }}>
          {loading ? 'Refreshing summary…' : 'Refresh summary'}
        </Text>
      </Pressable>
      {report && (
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {rows.map(([label, amount]) => (
            <View
              key={label}
              style={[styles.row, { borderBottomColor: theme.colors.divider }]}
            >
              <Text style={[styles.label, { color: theme.colors.textMuted }]}>
                {label}
              </Text>
              <Text style={[styles.amount, { color: theme.colors.text }]}>
                {formatCurrency(amount, currency)}
              </Text>
            </View>
          ))}
          <Text style={{ color: theme.colors.textMuted }}>
            {report.completed.length} completed sales
          </Text>
        </View>
      )}
      <Text style={{ color: theme.colors.textMuted }}>
        {state.transactions.filter(t => t.serverSyncStatus !== 'synced').length}{' '}
        local sales waiting to sync. They appear in this summary after upload.
      </Text>
    </AppScreen>
  );
}
const styles = StyleSheet.create({
  button: { minHeight: 48, justifyContent: 'center' },
  card: { padding: 20, borderWidth: 1, borderRadius: 12, gap: 12 },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderBottomWidth: 1,
  },
  label: { flex: 1, fontSize: 16 },
  amount: { fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
