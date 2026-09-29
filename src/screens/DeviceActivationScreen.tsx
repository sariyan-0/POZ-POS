import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { DataScanner } from 'react-native-data-scanner';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_BACKEND_URL } from '../config/backend';
import { useDeviceConnection } from '../context/DeviceConnectionProvider';
import { usePOS } from '../hooks/usePOS';
import {
  formatActivationCode,
  isCompleteActivationCode,
  VerifiedDeviceActivation,
  verifyDeviceActivation,
} from '../services/api/deviceConnection';
import { useAppTheme } from '../theme';

type ActivationStage = 'pair' | 'name';

export function DeviceActivationScreen({ onBack }: { onBack?: () => void }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { connect, error: connectionError, refresh } = useDeviceConnection();
  const { syncCatalog, syncStaff, syncCustomers } = usePOS();
  const transition = useRef(new Animated.Value(1)).current;
  const scanSuccess = useRef(new Animated.Value(0)).current;
  const scanSuccessAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const scrollViewRef = useRef<any>(null);
  const [stage, setStage] = useState<ActivationStage>('pair');
  const [activation, setActivation] = useState('');
  const [verified, setVerified] = useState<VerifiedDeviceActivation | null>(
    null,
  );
  const [registerName, setRegisterName] = useState('Front counter');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isOpeningScanner, setIsOpeningScanner] = useState(false);
  const [scannerVerified, setScannerVerified] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (isMounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      transition.setValue(1);
      return;
    }

    transition.setValue(0);
    const animation = Animated.timing(transition, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, stage, transition]);

  useEffect(
    () => () => {
      scanSuccessAnimation.current?.stop();
    },
    [],
  );

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 80);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  function revealFormActions() {
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 220);
  }

  async function verify(
    nextActivation: unknown = activation,
    source: 'manual' | 'scanner' = 'manual',
  ) {
    if (isVerifying || isConnecting) return;
    setMessage(null);
    setIsVerifying(true);
    try {
      const result = await verifyDeviceActivation(nextActivation);
      setVerified(result);
      if (source === 'scanner' && !reduceMotion) {
        setScannerVerified(true);
        scanSuccess.setValue(0);
        if (Platform.OS === 'android') Vibration.vibrate(24);
        await new Promise<void>(resolve => {
          const animation = Animated.sequence([
            Animated.spring(scanSuccess, {
              toValue: 1,
              damping: 13,
              stiffness: 240,
              mass: 0.6,
              useNativeDriver: true,
            }),
            Animated.delay(180),
          ]);
          scanSuccessAnimation.current = animation;
          animation.start(() => resolve());
        });
      }
      setStage('name');
      AccessibilityInfo.announceForAccessibility(
        `Register connected to ${result.business.name}. Name this register.`,
      );
    } catch (error) {
      const nextMessage =
        error instanceof Error
          ? error.message
          : 'Unable to verify this activation code.';
      setMessage(nextMessage);
      AccessibilityInfo.announceForAccessibility(nextMessage);
    } finally {
      setIsVerifying(false);
    }
  }

  async function openScanner() {
    if (isOpeningScanner || isVerifying || isConnecting) return;
    setMessage(null);
    setIsOpeningScanner(true);
    try {
      const barcode = await DataScanner.scanBarcode({
        targetFormats: ['qr'],
        enableAutoZoom: true,
      });
      await verify(barcode.value, 'scanner');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (!errorMessage.toLowerCase().includes('cancel')) {
        setMessage(`Scanner unavailable: ${errorMessage}`);
      }
    } finally {
      setIsOpeningScanner(false);
    }
  }

  async function finishSetup() {
    if (!verified || isConnecting || registerName.trim().length < 2) return;
    setMessage(null);
    setIsConnecting(true);
    try {
      await connect({
        activation: verified.activation,
        name: registerName.trim(),
      });
      await Promise.allSettled([syncCatalog(), syncStaff(), syncCustomers()]);
    } catch (error) {
      const nextMessage =
        error instanceof Error
          ? error.message
          : 'Unable to finish setting up this register.';
      setMessage(nextMessage);
      AccessibilityInfo.announceForAccessibility(nextMessage);
    } finally {
      setIsConnecting(false);
    }
  }

  function goBack() {
    setMessage(null);
    if (stage === 'name') {
      setVerified(null);
      setScannerVerified(false);
      scanSuccess.setValue(0);
      setStage('pair');
      return;
    }
    onBack?.();
  }

  function openHelp() {
    Linking.openURL(`${DEFAULT_BACKEND_URL}/support`).catch(() => {
      setMessage('OneRegister support could not be opened on this device.');
    });
  }

  const isCodeComplete = isCompleteActivationCode(activation);
  const isBusy = isVerifying || isOpeningScanner;
  const canFinish = registerName.trim().length >= 2 && !isConnecting;
  const animatedStageStyle = {
    opacity: transition,
    transform: [
      {
        translateX: transition.interpolate({
          inputRange: [0, 1],
          outputRange: [reduceMotion ? 0 : 14, 0],
        }),
      },
    ],
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <View
        style={[
          styles.navigation,
          { paddingTop: insets.top + 8, borderColor: theme.colors.divider },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={stage === 'name' ? 'Back to pairing' : 'Go back'}
          hitSlop={10}
          onPress={goBack}
          style={({ pressed }) => [
            styles.navigationButton,
            {
              backgroundColor: theme.colors.surfaceMuted,
              opacity: pressed ? 0.66 : 1,
            },
          ]}
        >
          <MaterialDesignIcons
            color={theme.colors.text}
            name="chevron-left"
            size={27}
          />
        </Pressable>
        <Pressable
          accessibilityRole="link"
          hitSlop={10}
          onPress={openHelp}
          style={({ pressed }) => ({ opacity: pressed ? 0.56 : 1 })}
        >
          <Text style={[styles.help, { color: theme.colors.success }]}>
            Help
          </Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollViewRef}
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: keyboardVisible
              ? Math.max(insets.bottom + 150, 170)
              : Math.max(insets.bottom + 20, 30),
          },
        ]}
      >
        <Animated.View style={[styles.shell, animatedStageStyle]}>
          {stage === 'pair' ? (
            <PairStage
              activation={activation}
              connectionError={connectionError}
              isBusy={isBusy}
              isCodeComplete={isCodeComplete}
              isOpeningScanner={isOpeningScanner}
              scannerVerified={scannerVerified}
              scanSuccess={scanSuccess}
              isVerifying={isVerifying}
              message={message}
              onActivationChange={value => {
                setActivation(formatActivationCode(value));
                setMessage(null);
              }}
              onOpenScanner={openScanner}
              onInputFocus={revealFormActions}
              onRetry={refresh}
              onVerify={() => verify()}
            />
          ) : (
            <NameStage
              canFinish={canFinish}
              isConnecting={isConnecting}
              message={message}
              registerName={registerName}
              onFinish={finishSetup}
              onInputFocus={revealFormActions}
              onNameChange={value => {
                setRegisterName(value);
                setMessage(null);
              }}
            />
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type PairStageProps = {
  activation: string;
  connectionError: string | null;
  isBusy: boolean;
  isCodeComplete: boolean;
  isOpeningScanner: boolean;
  isVerifying: boolean;
  message: string | null;
  scannerVerified: boolean;
  scanSuccess: Animated.Value;
  onActivationChange: (value: string) => void;
  onOpenScanner: () => void;
  onInputFocus: () => void;
  onRetry: () => void | Promise<void>;
  onVerify: () => void;
};

function PairStage({
  activation,
  connectionError,
  isBusy,
  isCodeComplete,
  isOpeningScanner,
  isVerifying,
  message,
  scannerVerified,
  scanSuccess,
  onActivationChange,
  onOpenScanner,
  onInputFocus,
  onRetry,
  onVerify,
}: PairStageProps) {
  const theme = useAppTheme();
  return (
    <View style={styles.pairStage}>
      <View style={styles.intro}>
        <Image
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          resizeMode="contain"
          source={require('../assets/activation/register-terminal.png')}
          style={styles.deviceArtwork}
        />
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Set up this register
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Connect this device to your OneRegister account to start taking
          payments.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Scan activation QR code"
        disabled={isBusy}
        onPress={onOpenScanner}
        style={({ pressed }) => [
          styles.scanAction,
          {
            opacity: scannerVerified ? 1 : isBusy ? 0.58 : 1,
            transform: [{ scale: pressed ? 0.985 : 1 }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.scanIcon,
            { backgroundColor: theme.colors.accentSoft },
            scannerVerified
              ? {
                  opacity: scanSuccess,
                  transform: [
                    {
                      scale: scanSuccess.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.72, 1],
                      }),
                    },
                  ],
                }
              : null,
          ]}
        >
          <MaterialDesignIcons
            color={theme.colors.success}
            name={scannerVerified ? 'check' : 'qrcode-scan'}
            size={25}
          />
        </Animated.View>
        <View style={styles.scanCopy}>
          <Text style={[styles.actionTitle, { color: theme.colors.text }]}>
            {scannerVerified
              ? 'Code verified'
              : isOpeningScanner
              ? 'Opening scanner…'
              : 'Scan QR code'}
          </Text>
          <Text
            style={[
              styles.actionDescription,
              { color: theme.colors.textMuted },
            ]}
          >
            Scan the code in your OneRegister dashboard.
          </Text>
        </View>
        {isOpeningScanner && !scannerVerified ? (
          <ActivityIndicator color={theme.colors.success} />
        ) : (
          <MaterialDesignIcons
            color={theme.colors.success}
            name="arrow-right"
            size={22}
          />
        )}
      </Pressable>

      <View style={styles.dividerRow}>
        <View
          style={[styles.divider, { backgroundColor: theme.colors.divider }]}
        />
        <Text style={[styles.orLabel, { color: theme.colors.textMuted }]}>
          or
        </Text>
        <View
          style={[styles.divider, { backgroundColor: theme.colors.divider }]}
        />
      </View>

      <View style={styles.manualSection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Enter activation code
        </Text>
        <View
          style={[
            styles.inputFrame,
            {
              backgroundColor: theme.colors.surface,
              borderColor: message ? theme.colors.danger : theme.colors.border,
            },
          ]}
        >
          <MaterialDesignIcons
            color={theme.colors.textMuted}
            name="key-outline"
            size={22}
          />
          <TextInput
            accessibilityLabel="Activation code"
            accessibilityHint="Enter the 8-character code from your OneRegister dashboard"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isBusy}
            maxLength={9}
            placeholder="ABCD-1234"
            placeholderTextColor={theme.colors.textMuted}
            returnKeyType="go"
            value={activation}
            selectionColor={theme.colors.success}
            onChangeText={onActivationChange}
            onFocus={onInputFocus}
            onSubmitEditing={() => {
              if (isCodeComplete) onVerify();
            }}
            style={[styles.codeInput, { color: theme.colors.text }]}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={!isCodeComplete || isBusy}
          onPress={onVerify}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: theme.colors.accent,
              opacity: !isCodeComplete || isBusy ? 0.32 : 1,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            },
          ]}
        >
          {isVerifying ? (
            <ActivityIndicator color={theme.colors.accentText} />
          ) : (
            <Text
              style={[
                styles.primaryButtonText,
                { color: theme.colors.accentText },
              ]}
            >
              Continue
            </Text>
          )}
        </Pressable>
      </View>

      {message || connectionError ? (
        <InlineMessage
          message={message || connectionError || ''}
          onRetry={connectionError ? onRetry : undefined}
        />
      ) : null}

      <View style={styles.expiryNote}>
        <MaterialDesignIcons
          color={theme.colors.textMuted}
          name="information-outline"
          size={17}
        />
        <Text style={[styles.expiryText, { color: theme.colors.textMuted }]}>
          Codes expire after 10 minutes and can only be used once.
        </Text>
      </View>
    </View>
  );
}

type NameStageProps = {
  canFinish: boolean;
  isConnecting: boolean;
  message: string | null;
  registerName: string;
  onFinish: () => void;
  onInputFocus: () => void;
  onNameChange: (value: string) => void;
};

function NameStage({
  canFinish,
  isConnecting,
  message,
  registerName,
  onFinish,
  onInputFocus,
  onNameChange,
}: NameStageProps) {
  const theme = useAppTheme();
  return (
    <View style={styles.nameStage}>
      <View style={styles.successIntro}>
        <View
          style={[
            styles.successIcon,
            { backgroundColor: theme.colors.accentSoft },
          ]}
        >
          <MaterialDesignIcons
            color={theme.colors.success}
            name="check"
            size={25}
          />
        </View>
        <Text style={[styles.successLabel, { color: theme.colors.success }]}>
          Register connected
        </Text>
      </View>

      <View style={styles.nameHeading}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Name this register
        </Text>
      </View>

      <View style={styles.nameForm}>
        <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
          Register name
        </Text>
        <TextInput
          accessibilityLabel="Register name"
          autoCapitalize="words"
          autoFocus
          maxLength={64}
          placeholder="Front counter"
          placeholderTextColor={theme.colors.textMuted}
          returnKeyType="done"
          value={registerName}
          selectionColor={theme.colors.success}
          onChangeText={onNameChange}
          onFocus={onInputFocus}
          onSubmitEditing={onFinish}
          style={[
            styles.nameInput,
            {
              color: theme.colors.text,
              backgroundColor: theme.colors.surface,
              borderColor: message ? theme.colors.danger : theme.colors.border,
            },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          disabled={!canFinish}
          onPress={onFinish}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: theme.colors.accent,
              opacity: canFinish ? 1 : 0.32,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            },
          ]}
        >
          {isConnecting ? (
            <ActivityIndicator color={theme.colors.accentText} />
          ) : (
            <Text
              style={[
                styles.primaryButtonText,
                { color: theme.colors.accentText },
              ]}
            >
              Finish setup
            </Text>
          )}
        </Pressable>
      </View>

      {message ? <InlineMessage message={message} /> : null}
    </View>
  );
}

function InlineMessage({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void | Promise<void>;
}) {
  const theme = useAppTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.message, { backgroundColor: theme.colors.accentSoft }]}
    >
      <MaterialDesignIcons
        color={theme.colors.danger}
        name="alert-circle-outline"
        size={19}
      />
      <Text style={[styles.messageText, { color: theme.colors.text }]}>
        {message}
      </Text>
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={() => onRetry()}>
          <Text style={[styles.retry, { color: theme.colors.text }]}>
            Retry
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  navigation: {
    minHeight: 58,
    paddingHorizontal: 20,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navigationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  help: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  content: { flexGrow: 1, paddingHorizontal: 24 },
  shell: {
    flexGrow: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
    paddingTop: 34,
  },
  pairStage: { flex: 1 },
  intro: { alignItems: 'center', gap: 9, marginBottom: 28 },
  deviceArtwork: { width: 96, height: 96, marginBottom: 5 },
  title: {
    maxWidth: 460,
    textAlign: 'center',
    fontSize: 31,
    lineHeight: 37,
    fontWeight: '900',
    letterSpacing: -1,
  },
  subtitle: {
    maxWidth: 430,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 23,
  },
  scanAction: {
    minHeight: 74,
    paddingHorizontal: 2,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  scanIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanCopy: { flex: 1, gap: 2 },
  actionTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  actionDescription: { fontSize: 13, lineHeight: 18 },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginVertical: 24,
  },
  divider: { flex: 1, height: StyleSheet.hairlineWidth },
  orLabel: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  manualSection: { gap: 10 },
  sectionTitle: { fontSize: 19, lineHeight: 25, fontWeight: '800' },
  inputFrame: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  codeInput: {
    flex: 1,
    minHeight: 56,
    paddingVertical: 0,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '800',
    letterSpacing: 0.6,
    fontVariant: ['tabular-nums'],
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonText: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  expiryNote: {
    marginTop: 'auto',
    paddingTop: 24,
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
  },
  expiryText: {
    flexShrink: 1,
    maxWidth: 340,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
  message: {
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  messageText: { flex: 1, fontSize: 13, lineHeight: 18 },
  retry: { fontSize: 13, fontWeight: '900' },
  nameStage: { paddingTop: 42 },
  successIntro: { alignItems: 'center', gap: 10, marginBottom: 30 },
  successIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successLabel: { fontSize: 14, lineHeight: 19, fontWeight: '800' },
  nameHeading: { alignItems: 'center' },
  nameForm: { marginTop: 32, gap: 8 },
  inputLabel: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  nameInput: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 15,
    fontSize: 17,
    lineHeight: 22,
  },
});
