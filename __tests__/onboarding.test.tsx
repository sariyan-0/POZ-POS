import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Pressable, Text } from 'react-native';
import {
  ONBOARDING_STORAGE_KEY,
  OnboardingProvider,
  shouldMigrateActivatedInstall,
  shouldShowOnboardingForLaunch,
  useOnboarding,
} from '../src/context/OnboardingProvider';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

function Harness() {
  const onboarding = useOnboarding();
  return (
    <Pressable
      testID="complete-onboarding"
      onPress={() => onboarding.completeOnboarding()}
    >
      <Text>{onboarding.status}</Text>
    </Pressable>
  );
}

async function renderProvider() {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <OnboardingProvider>
        <Harness />
      </OnboardingProvider>,
    );
  });
  return renderer!;
}

beforeEach(() => {
  jest.clearAllMocks();
  storage.getItem.mockResolvedValue(null);
  storage.setItem.mockResolvedValue(undefined);
});

test('a first installation starts with onboarding pending', async () => {
  const renderer = await renderProvider();
  expect(renderer.root.findByType(Text).props.children).toBe('pending');
});

test('a storage read failure cannot trap a first installation', async () => {
  storage.getItem.mockRejectedValueOnce(new Error('storage unavailable'));
  const renderer = await renderProvider();
  expect(renderer.root.findByType(Text).props.children).toBe('pending');
});

test('completion and Skip share durable completion behavior', async () => {
  const renderer = await renderProvider();
  await ReactTestRenderer.act(async () => {
    await renderer.root
      .findByProps({ testID: 'complete-onboarding' })
      .props.onPress();
  });
  expect(renderer.root.findByType(Text).props.children).toBe('complete');
  expect(storage.setItem).toHaveBeenCalledWith(
    ONBOARDING_STORAGE_KEY,
    'complete',
  );
});

test('completion remains in memory when storage fails', async () => {
  storage.setItem.mockRejectedValueOnce(new Error('disk unavailable'));
  const renderer = await renderProvider();
  await ReactTestRenderer.act(async () => {
    await renderer.root
      .findByProps({ testID: 'complete-onboarding' })
      .props.onPress();
  });
  expect(renderer.root.findByType(Text).props.children).toBe('complete');
});

test('a completed installation remains complete after restart', async () => {
  storage.getItem.mockResolvedValueOnce('complete');
  const renderer = await renderProvider();
  expect(renderer.root.findByType(Text).props.children).toBe('complete');
});

test('activated legacy installs migrate, but disconnected installs do not reset state', () => {
  expect(shouldMigrateActivatedInstall('pending', true)).toBe(true);
  expect(shouldMigrateActivatedInstall('pending', false)).toBe(false);
  expect(shouldMigrateActivatedInstall('complete', false)).toBe(false);
});

test('a disconnected, unauthenticated register sees onboarding again on a new app launch', () => {
  expect(shouldShowOnboardingForLaunch('complete', false, false, false)).toBe(
    true,
  );
  expect(shouldShowOnboardingForLaunch('pending', false, false, false)).toBe(
    true,
  );
});

test('onboarding does not interrupt connected or authenticated sessions', () => {
  expect(shouldShowOnboardingForLaunch('complete', false, false, true)).toBe(
    false,
  );
  expect(shouldShowOnboardingForLaunch('complete', false, true, false)).toBe(
    false,
  );
  expect(shouldShowOnboardingForLaunch('complete', true, false, false)).toBe(
    false,
  );
  expect(shouldShowOnboardingForLaunch('loading', false, false, false)).toBe(
    false,
  );
});
