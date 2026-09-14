import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppScreen, ListRow } from '../components/POSUI';
import { usePOS } from '../hooks/usePOS';
import { StaffMember } from '../models/pos';
import { useAppTheme } from '../theme';
import { useDeviceConnection } from '../context/DeviceConnectionProvider';
import { PinPadField } from '../components/PinPad';

const ROLE_OPTIONS: StaffMember['role'][] = ['owner', 'manager', 'cashier'];

function roleLabel(role: StaffMember['role']) {
  return role === 'owner' ? 'Owner' : role === 'manager' ? 'Manager' : 'Cashier';
}

function roleDescription(role: StaffMember['role']) {
  return role === 'owner'
    ? 'Full access to settings and register controls.'
    : role === 'manager'
      ? 'Store management access with fewer critical permissions.'
      : 'Basic checkout access for frontline staff.';
}

export function SecuritySettingsScreen() {
  const {
    state,
    currentStaff,
    updateCurrentStaffPin,
    createStaffProfile,
    updateStaffProfile,
    deleteStaffProfile,
    syncStaff,
    staffSyncStatus,
    staffSyncError,
    lastStaffSyncAt,
  } = usePOS();
  const { connection } = useDeviceConnection();
  const theme = useAppTheme();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');
  const [securityError, setSecurityError] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePin, setProfilePin] = useState('');
  const [profileRole, setProfileRole] = useState<StaffMember['role']>('cashier');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

  const editingStaff = useMemo(
    () =>
      editingStaffId
        ? state.staffMembers.find(staffMember => staffMember.id === editingStaffId)
        : undefined,
    [editingStaffId, state.staffMembers],
  );
  const activeStaffMembers = useMemo(
    () => state.staffMembers.filter(staffMember => staffMember.active),
    [state.staffMembers],
  );
  const currentStaffHasPin = !!currentStaff?.pinHash?.trim() && !!currentStaff?.pinSalt?.trim();

  if (connection) {
    return <AppScreen title="People & security" subtitle="People and permissions are managed from the OneRegister web dashboard.">
      <View style={[styles.block, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>Dashboard managed</Text>
        <Text style={[styles.helper, { color: theme.colors.textMuted }]}>This register receives active people, hashed PIN credentials, and app permissions from {connection.business.name}. Local edits are disabled so every register stays consistent.</Text>
        {state.staffMembers.filter(member => member.active).map(member => <ListRow key={member.id} label={`${member.name} · ${roleLabel(member.role)}`} icon="account-lock-outline" />)}
        <Text style={[styles.helper, { color: staffSyncError ? theme.colors.danger : theme.colors.textMuted }]}>{staffSyncError ?? (lastStaffSyncAt ? `Last synced ${new Date(lastStaffSyncAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'People will sync automatically while online.')}</Text>
        <Pressable disabled={staffSyncStatus === 'syncing'} onPress={() => syncStaff().catch(() => undefined)} style={[styles.button, { backgroundColor: theme.colors.accent }]}><Text style={[styles.buttonLabel, { color: theme.colors.accentText }]}>{staffSyncStatus === 'syncing' ? 'Syncing…' : 'Sync people now'}</Text></Pressable>
      </View>
    </AppScreen>;
  }

  function resetProfileForm() {
    setEditingStaffId(null);
    setProfileName('');
    setProfilePin('');
    setProfileRole('cashier');
  }

  function handleSavePin() {
    if (!currentStaff) {
      setSecurityError(true);
      setSecurityMessage('No staff session is active.');
      return;
    }

    if (newPin.trim() !== confirmPin.trim()) {
      setSecurityError(true);
      setSecurityMessage('New PIN and confirmation do not match.');
      return;
    }

    const result = updateCurrentStaffPin(currentPin, newPin);
    if (!result.ok) {
      setSecurityError(true);
      setSecurityMessage(result.message);
      return;
    }

    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setSecurityError(false);
    setSecurityMessage('PIN updated successfully.');
  }

  function handleSaveProfile() {
    if (editingStaff) {
      const result = updateStaffProfile({
        staffId: editingStaff.id,
        name: profileName,
        role: profileRole,
      });
      if (!result.ok) {
        setProfileError(true);
        setProfileMessage(result.message);
        return;
      }
      setProfileError(false);
      setProfileMessage('Staff profile updated.');
      resetProfileForm();
      return;
    }

    const result = createStaffProfile({
      name: profileName,
      role: profileRole,
      pin: profilePin,
    });
    if (!result.ok) {
      setProfileError(true);
      setProfileMessage(result.message);
      return;
    }

    setProfileError(false);
    setProfileMessage('Staff profile created.');
    resetProfileForm();
  }

  function startEditing(staffMember: StaffMember) {
    setEditingStaffId(staffMember.id);
    setProfileName(staffMember.name);
    setProfileRole(staffMember.role);
    setProfilePin('');
    setProfileError(false);
    setProfileMessage('');
  }

  function handleDeleteProfile() {
    if (!editingStaff) {
      return;
    }

    const result = deleteStaffProfile(editingStaff.id);
    if (!result.ok) {
      setProfileError(true);
      setProfileMessage(result.message);
      return;
    }

    setProfileError(false);
    setProfileMessage('Staff profile deleted.');
    resetProfileForm();
  }

  return (
    <AppScreen
      title="Security"
      subtitle="Manage staff sign-in settings and register permissions.">
      <View style={[styles.block, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>Staff</Text>
        <Text style={[styles.helper, { color: theme.colors.textMuted }]}>
          Signed in as {currentStaff?.name || 'Unknown staff'}.
        </Text>
      </View>

      <View style={[styles.block, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>Change your PIN</Text>
        {currentStaffHasPin ? (
          <PinPadField
            label="Current PIN"
            value={currentPin}
            onChange={value => {
              setCurrentPin(value);
              if (securityMessage) {
                setSecurityMessage('');
              }
            }}
          />
        ) : null}
        <PinPadField
          label="New PIN"
          value={newPin}
          onChange={value => {
            setNewPin(value);
            if (securityMessage) {
              setSecurityMessage('');
            }
          }}
        />
        <PinPadField
          label="Confirm new PIN"
          value={confirmPin}
          onChange={value => {
            setConfirmPin(value);
            if (securityMessage) {
              setSecurityMessage('');
            }
          }}
        />
        <Text
          style={[
            styles.helper,
            {
              color: securityMessage
                ? securityError
                  ? theme.colors.danger
                  : theme.colors.success
                : theme.colors.textMuted,
            },
          ]}>
          {securityMessage ||
            (currentStaffHasPin
              ? 'Use a 4 digit PIN for staff sign-in.'
              : 'No PIN is set yet. Add one here if you want the owner account locked.')}
        </Text>
        <Pressable
          onPress={handleSavePin}
          style={[styles.button, { backgroundColor: theme.colors.accent }]}>
          <Text style={[styles.buttonLabel, { color: theme.colors.accentText }]}>
            Update staff PIN
          </Text>
        </Pressable>
      </View>

      <View style={[styles.block, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>Profiles</Text>
        <Text style={[styles.helper, { color: theme.colors.textMuted }]}>
          Create staff profiles with names and permission levels.
        </Text>
        <TextInput
          value={profileName}
          onChangeText={value => {
            setProfileName(value);
            if (profileMessage) {
              setProfileMessage('');
            }
          }}
          placeholder="Staff name"
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surfaceMuted,
            },
          ]}
        />
        {!editingStaff ? (
          <PinPadField
            label="Staff PIN"
            value={profilePin}
            onChange={value => {
              setProfilePin(value);
              if (profileMessage) {
                setProfileMessage('');
              }
            }}
          />
        ) : null}
        <View style={styles.roleOptions}>
          {ROLE_OPTIONS.map(role => {
            const selected = profileRole === role;
            return (
              <Pressable
                key={role}
                onPress={() => setProfileRole(role)}
                style={[
                  styles.roleChip,
                  {
                    backgroundColor: selected
                      ? theme.colors.accent
                      : theme.colors.surfaceMuted,
                    borderColor: selected ? theme.colors.accent : theme.colors.border,
                  },
                ]}>
                <Text
                  style={[
                    styles.roleChipLabel,
                    { color: selected ? theme.colors.accentText : theme.colors.text },
                  ]}>
                  {roleLabel(role)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.helper, { color: theme.colors.textMuted }]}>
          {roleDescription(profileRole)}
        </Text>
        <Text
          style={[
            styles.helper,
            {
              color: profileMessage
                ? profileError
                  ? theme.colors.danger
                  : theme.colors.success
                : theme.colors.textMuted,
            },
          ]}>
          {profileMessage ||
            (editingStaff
              ? 'Editing name and role. PIN changes still happen from each staff account.'
              : 'New staff get their own 4 digit PIN and permission level.')}
        </Text>
        <View style={styles.buttonRow}>
          <Pressable
            onPress={handleSaveProfile}
            style={[styles.button, styles.flexButton, { backgroundColor: theme.colors.accent }]}>
            <Text style={[styles.buttonLabel, { color: theme.colors.accentText }]}>
              {editingStaff ? 'Save profile' : 'Create profile'}
            </Text>
          </Pressable>
          {editingStaff ? (
            <Pressable
              onPress={resetProfileForm}
              style={[
                styles.button,
                styles.secondaryButton,
                styles.flexButton,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.border,
                },
              ]}>
              <Text style={[styles.buttonLabel, { color: theme.colors.text }]}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
        {editingStaff ? (
          <Pressable
            onPress={handleDeleteProfile}
            style={[
              styles.button,
              styles.deleteButton,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.danger,
              },
            ]}>
            <Text style={[styles.buttonLabel, { color: theme.colors.danger }]}>
              Delete profile
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ backgroundColor: theme.colors.surface, borderRadius: 18, overflow: 'hidden' }}>
        {activeStaffMembers.map(staffMember => (
          <ListRow
            key={staffMember.id}
            label={`${staffMember.name} • ${roleLabel(staffMember.role)}`}
            rightLabel="Edit"
            compact
            showChevron={false}
            onPress={() => startEditing(staffMember)}
          />
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: 18,
    padding: 18,
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  helper: {
    fontSize: 13,
  },
  roleOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  roleChip: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleChipLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  button: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryButton: {
    borderWidth: 1,
  },
  flexButton: {
    flex: 1,
  },
  deleteButton: {
    borderWidth: 1,
    marginTop: 10,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
});
