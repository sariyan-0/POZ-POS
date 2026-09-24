import { NativeModules, Platform, Vibration } from 'react-native';

type RegisterFeedbackModule = {
  haptic: (style: 'selection' | 'light' | 'warning') => void;
  paymentSuccess: () => void;
  paymentFailure: () => void;
};

const nativeFeedback = NativeModules.RegisterFeedback as
  | RegisterFeedbackModule
  | undefined;

function fallbackVibration(duration: number) {
  if (Platform.OS !== 'web') Vibration.vibrate(duration);
}

export const feedback = {
  selection() {
    if (nativeFeedback) nativeFeedback.haptic('selection');
    else fallbackVibration(4);
  },
  light() {
    if (nativeFeedback) nativeFeedback.haptic('light');
    else fallbackVibration(8);
  },
  warning() {
    if (nativeFeedback) nativeFeedback.haptic('warning');
    else fallbackVibration(18);
  },
  paymentSuccess() {
    if (nativeFeedback) nativeFeedback.paymentSuccess();
    else fallbackVibration(24);
  },
  paymentFailure() {
    if (nativeFeedback) nativeFeedback.paymentFailure();
    else Vibration.vibrate([0, 28, 55, 42]);
  },
};
