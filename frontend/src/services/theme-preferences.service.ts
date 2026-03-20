export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY_PREFIX = 'themeMode:';

type StoredUser = { id?: number };

const getThemeStorageKey = (userId?: number) => `${THEME_STORAGE_KEY_PREFIX}${userId ?? 'guest'}`;

const getStoredUserId = (): number | undefined => {
  const userRaw = localStorage.getItem('user');
  if (!userRaw) return undefined;

  try {
    const user = JSON.parse(userRaw) as StoredUser;
    return typeof user.id === 'number' ? user.id : undefined;
  } catch {
    return undefined;
  }
};

const getThemeMode = (userId?: number): ThemeMode => {
  const raw = localStorage.getItem(getThemeStorageKey(userId));
  if (raw === 'light') return 'light';
  if (raw === 'dark') return 'dark';
  return 'dark';
};

const setThemeMode = (mode: ThemeMode, userId?: number) => {
  localStorage.setItem(getThemeStorageKey(userId), mode);
};

// Serviço para persistência do modo de tema por sessão/usuário.
export const themePreferencesService = {
  getThemeMode,

  getThemeModeForSession(userId?: number): ThemeMode {
    if (typeof userId === 'number') {
      return getThemeMode(userId);
    }

    const storedUserId = getStoredUserId();
    if (typeof storedUserId === 'number') {
      return getThemeMode(storedUserId);
    }

    return getThemeMode();
  },

  setThemeMode,

  setThemeModeForSession(mode: ThemeMode, userId?: number) {
    if (typeof userId === 'number') {
      setThemeMode(mode, userId);
      return;
    }

    setThemeMode(mode);
  },
};
