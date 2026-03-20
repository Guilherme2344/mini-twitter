export type ProfilePreferences = {
  bio?: string;
  avatarUrl?: string;
};

const LEGACY_PROFILE_STORAGE_KEY = 'profilePreferences';
const PROFILE_STORAGE_KEY_PREFIX = 'profilePreferences:';

const getProfileStorageKey = (userId: number) => `${PROFILE_STORAGE_KEY_PREFIX}${userId}`;

const parsePreferences = (value: string | null): ProfilePreferences | null => {
  if (!value) return null;

  try {
    return JSON.parse(value) as ProfilePreferences;
  } catch {
    return null;
  }
};

// Serviço de preferências visuais do perfil persistidas localmente por usuário.
export const profilePreferencesService = {
  get(userId?: number | null): ProfilePreferences {
    if (!userId) return {};

    const userKey = getProfileStorageKey(userId);
    const userPreferences = parsePreferences(localStorage.getItem(userKey));

    if (userPreferences) {
      return userPreferences;
    }

    const legacyPreferences = parsePreferences(localStorage.getItem(LEGACY_PROFILE_STORAGE_KEY));
    if (legacyPreferences) {
      localStorage.setItem(userKey, JSON.stringify(legacyPreferences));
      localStorage.removeItem(LEGACY_PROFILE_STORAGE_KEY);
      return legacyPreferences;
    }

    return {};
  },

  set(userId: number | null | undefined, preferences: ProfilePreferences) {
    if (!userId) return;

    const userKey = getProfileStorageKey(userId);
    localStorage.setItem(userKey, JSON.stringify(preferences));
  },

  clear(userId: number | null | undefined) {
    if (!userId) return;

    const userKey = getProfileStorageKey(userId);
    localStorage.removeItem(userKey);
  },
};
