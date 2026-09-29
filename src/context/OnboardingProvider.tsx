import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export const ONBOARDING_STORAGE_KEY = 'oneregister/onboarding/v1';

export type OnboardingStatus = 'loading' | 'pending' | 'complete';

export function shouldMigrateActivatedInstall(
  onboardingStatus: OnboardingStatus,
  hasStoredCredential: boolean | null,
) {
  return onboardingStatus === 'pending' && hasStoredCredential === true;
}

export function shouldShowOnboardingForLaunch(
  onboardingStatus: OnboardingStatus,
  hasStoredCredential: boolean | null,
  isStaffAuthenticated: boolean,
  hasPassedOnboardingThisLaunch: boolean,
) {
  return (
    onboardingStatus !== 'loading' &&
    hasStoredCredential === false &&
    !isStaffAuthenticated &&
    !hasPassedOnboardingThisLaunch
  );
}

type OnboardingContextValue = {
  status: OnboardingStatus;
  completeOnboarding: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
  undefined,
);

export function OnboardingProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<OnboardingStatus>('loading');

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(ONBOARDING_STORAGE_KEY)
      .then(value => {
        if (isMounted) {
          setStatus(value === 'complete' ? 'complete' : 'pending');
        }
      })
      .catch(() => {
        if (isMounted) {
          setStatus('pending');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const completeOnboarding = useCallback(async () => {
    // Onboarding is informational, so a storage failure must never prevent an
    // installer from reaching secure device activation.
    setStatus('complete');
    try {
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'complete');
    } catch {
      // Keep the in-memory completion. A future launch can offer the tour again.
    }
  }, []);

  const value = useMemo(
    () => ({ status, completeOnboarding }),
    [completeOnboarding, status],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const value = useContext(OnboardingContext);
  if (!value) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return value;
}
