import { authCredentialStore } from './AuthCredentialStore';

type Session = { token: string; staffId: string; expiresAt: number; offline?: boolean };
type OfflineGrant = { token: string; expiresAt: number };
let current: Session | null = null;
let approval: Session | null = null;
let offlineGrant: OfflineGrant | null = null;
const listeners = new Set<() => void>();
export const staffSession = {
  set(token: string, staffId: string, expiresIn: number, asApproval = false, grant?: OfflineGrant) {
    if (!token || expiresIn <= 0) throw new Error('Invalid staff authorization');
    const session = { token, staffId, expiresAt: Date.now() + expiresIn * 1000 };
    if (asApproval) approval = session; else { current = session; approval = null; offlineGrant = grant ?? null; }
    listeners.forEach(listener => listener());
  },
  restore(session: Session) {
    if (!session.token || session.expiresAt <= Date.now()) throw new Error('Staff session expired. Connect to sign in again.');
    current = { ...session }; approval = null; offlineGrant = null;
    listeners.forEach(listener => listener());
  },
  restoreOffline(token: string, staffId: string, grantExpiresAt: number) {
    this.restore({ token, staffId, expiresAt: Math.min(Date.now() + 8 * 3600000, grantExpiresAt), offline: true });
  },
  offlineGrant() { return offlineGrant; },
  current() { return current && current.expiresAt > Date.now() ? current : null; },
  approval() { return approval && approval.expiresAt > Date.now() ? approval : null; },
  clear() { current = null; approval = null; offlineGrant = null; listeners.forEach(listener => listener()); },
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
};
// Changing or revoking a device must never retain the previous merchant's staff session.
authCredentialStore.subscribe(() => staffSession.clear());
