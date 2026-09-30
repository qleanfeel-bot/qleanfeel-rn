import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Profile } from '../../domain/profile/entities/Profile';
import type { ProfileService } from '../../application/profile/ProfileService';

export const MAX_DISPLAY_NAME_LENGTH = 80;

interface EditProfileScreenProps {
  readonly profileService: ProfileService;
  readonly userId: string;
  readonly profile: Profile;
  readonly onSaved: (profile: Profile) => void;
  readonly onCancel: () => void;
}

export function EditProfileScreen({
  profileService,
  userId,
  profile,
  onSaved,
  onCancel,
}: EditProfileScreenProps): React.JSX.Element {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveInProgress = useRef(false);

  const save = async () => {
    if (saveInProgress.current) {
      return;
    }

    const normalizedName = displayName.trim();
    if (!normalizedName) {
      setValidationError('Please enter your name.');
      setSaveError(null);
      return;
    }
    if (normalizedName.length > MAX_DISPLAY_NAME_LENGTH) {
      setValidationError(`Name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`);
      setSaveError(null);
      return;
    }

    setValidationError(null);
    setSaveError(null);
    saveInProgress.current = true;
    setIsSaving(true);
    let savedProfile: Profile | null = null;
    try {
      const updatedProfile = await profileService.updateDisplayName(userId, normalizedName);
      if (!updatedProfile) {
        setSaveError("We couldn't save your profile. Please try again.");
        return;
      }
      savedProfile = updatedProfile;
    } catch {
      setSaveError("We couldn't save your profile. Please try again.");
    } finally {
      saveInProgress.current = false;
      setIsSaving(false);
    }
    if (savedProfile) {
      onSaved(savedProfile);
    }
  };

  const changeDisplayName = (value: string) => {
    setDisplayName(value.slice(0, MAX_DISPLAY_NAME_LENGTH));
    setValidationError(null);
    setSaveError(null);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
      testID="edit-profile-screen">
      <View style={styles.header}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>Q</Text>
        </View>
        <Text style={styles.brandName}>Qleanfeel</Text>
      </View>
      <Text style={styles.title}>Edit profile</Text>

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Display name</Text>
        <TextInput
          accessibilityLabel="Display name"
          autoCapitalize="words"
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          onChangeText={changeDisplayName}
          style={styles.input}
          testID="display-name-input"
          value={displayName}
        />

        <ReadOnlyField label="Phone" value={profile.phone} />
        <ReadOnlyField label="Email" value={profile.email} />

        {validationError ? (
          <Text accessibilityRole="alert" style={styles.error} testID="display-name-error">
            {validationError}
          </Text>
        ) : null}
        {saveError ? (
          <Text accessibilityRole="alert" style={styles.error} testID="profile-save-error">
            {saveError}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={isSaving}
          onPress={save}
          style={[styles.saveButton, isSaving && styles.disabledButton]}
          testID="save-profile-button">
          <Text style={styles.saveText}>{isSaving ? 'Saving…' : 'Save changes'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isSaving}
          onPress={onCancel}
          style={styles.cancelButton}
          testID="cancel-profile-button">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function ReadOnlyField({ label, value }: { readonly label: string; readonly value: string | null }) {
  return (
    <View style={styles.readOnlyField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text accessibilityLabel={`${label} (read only)`} style={styles.readOnlyValue}>
        {value ?? 'Not provided'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: '#F4F7F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 34,
  },
  brandMark: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#176B58',
  },
  brandMarkText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  brandName: {
    color: '#173C34',
    fontSize: 18,
    fontWeight: '700',
  },
  title: {
    marginBottom: 20,
    color: '#173C34',
    fontSize: 30,
    fontWeight: '700',
  },
  card: {
    gap: 12,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E7EEEB',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    shadowColor: '#193B33',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  fieldLabel: {
    color: '#648078',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#C8D9D1',
    borderRadius: 12,
    color: '#263C35',
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  readOnlyField: {
    gap: 6,
    marginTop: 8,
  },
  readOnlyValue: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: 'hidden',
    borderRadius: 12,
    color: '#667A74',
    fontSize: 15,
    backgroundColor: '#F4F7F6',
  },
  error: {
    color: '#A13D37',
    fontSize: 14,
  },
  saveButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: '#176B58',
  },
  disabledButton: {
    opacity: 0.65,
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  cancelText: {
    color: '#315B4E',
    fontSize: 15,
    fontWeight: '700',
  },
});
