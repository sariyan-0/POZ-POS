import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  findStaffForPin,
  getImplicitOwnerSession,
  normalizeState,
  preserveAuthenticatedStaffId,
} from '../src/context/POSProvider';
import { initialPOSState } from '../src/services/mockData';
import { savePOSState, loadPOSState } from '../src/storage/persistence';
import { createPinCredentials } from '../src/utils/pin';
import { StaffMember } from '../src/models/pos';
import { HttpResponseError } from '../src/services/api/ApiClient';
import { OfflinePinInvalidError, OfflinePinLockedError } from '../src/services/api/OfflineStaffUnlock';
import {
  getPinFailureResult,
  PIN_LOCKOUT_MS,
  classifyPinFailure,
  pickStaffWelcome,
  STAFF_WELCOME_MESSAGES,
} from '../src/screens/StaffLockScreen';

jest.mock('@react-native-async-storage/async-storage',()=>{const values=new Map();return {getItem:jest.fn(async key=>values.get(key)??null),setItem:jest.fn(async(key,value)=>{values.set(key,value);})};});

function staff(overrides: Partial<StaffMember> = {}): StaffMember {
  return {
    id: 'staff-1',
    name: 'Sam',
    role: 'cashier',
    active: true,
    ...createPinCredentials('2468'),
    ...overrides,
  };
}

test('valid PIN unlocks while invalid, inactive, and PIN-less staff fail closed', () => {
  const active = staff();
  expect(findStaffForPin([active], '2468')).toEqual(active);
  expect(findStaffForPin([active], '0000')).toBeNull();
  expect(findStaffForPin([staff({ active: false })], '2468')).toBeNull();
  expect(
    findStaffForPin([staff({ pinHash: '', pinSalt: '' })], '2468'),
  ).toBeNull();
});

test('cold launch clears legacy authentication and persistence omits the session', async () => {
  const state = {
    ...initialPOSState,
    staffMembers: [staff()],
    currentStaffId: 'staff-1',
  };
  expect(normalizeState(state).currentStaffId).toBeUndefined();
  await AsyncStorage.setItem('oneregister/device-connection/v1', JSON.stringify({business:{id:'fixture-business',name:state.settings.business.businessName},device:{id:'fixture-device'}}));
  await savePOSState(state);
  const stored = await loadPOSState();
  expect(stored).not.toBeNull();
  expect(stored?.currentStaffId).toBeUndefined();

});

test('brief background-safe reconciliation retains only active PIN-enabled staff', () => {
  expect(preserveAuthenticatedStaffId('staff-1', [staff()])).toBe('staff-1');
  expect(
    preserveAuthenticatedStaffId('staff-1', [staff({ active: false })]),
  ).toBeUndefined();
  expect(
    preserveAuthenticatedStaffId('staff-1', [
      staff({ pinHash: '', pinSalt: '' }),
    ]),
  ).toBeUndefined();
});

test('the fifth failed attempt starts a 15-minute lockout', () => {
  expect(getPinFailureResult(4, 1_000)).toEqual({
    failedAttempts: 4,
    lockedUntil: null,
  });
  expect(getPinFailureResult(5, 1_000)).toEqual({
    failedAttempts: 0,
    lockedUntil: 1_000 + PIN_LOCKOUT_MS,
  });
});

test('only a wrong PIN counts as a failed attempt', () => {
  expect(classifyPinFailure(new OfflinePinInvalidError())).toEqual({ kind: 'invalid' });
  expect(classifyPinFailure(new HttpResponseError(401, { error: { code: 'invalid_pin' } }))).toEqual({ kind: 'invalid' });
  expect(classifyPinFailure(new HttpResponseError(503, { error: { code: 'pin_verification_unavailable' } })).kind).toBe('connection');
  expect(classifyPinFailure(new HttpResponseError(401, { error: { code: 'device_revoked' } })).kind).toBe('connection');
});

test('local and server PIN lockouts use the reported wait', () => {
  expect(classifyPinFailure(new OfflinePinLockedError(7 * 60_000))).toEqual({ kind: 'locked', retryAfterMs: 7 * 60_000 });
  expect(classifyPinFailure(new HttpResponseError(429, { error: { code: 'pin_locked' } }, 60_000))).toEqual({ kind: 'locked', retryAfterMs: 60_000 });
});

test('a synced owner-only shop without a PIN enters without staff sign-in', () => {
  const owner = staff({
    id: 'staff-owner',
    name: 'Store Owner',
    role: 'owner',
    pinHash: '',
    pinSalt: '',
  });
  expect(getImplicitOwnerSession([owner], 'synced')).toEqual(owner);
  expect(getImplicitOwnerSession([owner], 'syncing')).toBeUndefined();
  expect(
    getImplicitOwnerSession([owner, staff({ id: 'employee-1' })], 'synced'),
  ).toBeUndefined();
  expect(
    getImplicitOwnerSession([owner, staff({ id: 'inactive', active: false })], 'synced'),
  ).toEqual(owner);
});

test('an owner configured with a dashboard PIN must sign in', () => {
  const owner = staff({
    id: 'owner-1',
    role: 'owner',
    pinHash: '',
    pinSalt: '',
    pinSet: true,
  });
  expect(getImplicitOwnerSession([owner], 'synced')).toBeUndefined();
});

test('staff lock chooses one of ten stable welcome messages', () => {
  expect(new Set(STAFF_WELCOME_MESSAGES).size).toBe(10);
  expect(pickStaffWelcome(0)).toBe(STAFF_WELCOME_MESSAGES[0]);
  expect(pickStaffWelcome(0.999999)).toBe(STAFF_WELCOME_MESSAGES[9]);
});
