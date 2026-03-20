/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { themePreferencesService, type ThemeMode } from '../services/theme-preferences.service';

interface ThemeContextType {
  themeMode: ThemeMode;
  isDarkMode: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  toggleThemeMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Provider de tema (claro/escuro) com persistência por usuário.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [, setThemeRevision] = useState(0);
  const themeMode = themePreferencesService.getThemeModeForSession(user?.id);

  // Atualiza tema em estado e persistência local.
  const setThemeMode = (mode: ThemeMode) => {
    themePreferencesService.setThemeModeForSession(mode, user?.id);
    setThemeRevision((current) => current + 1);
  };

  // Alterna entre claro e escuro.
  const toggleThemeMode = () => {
    setThemeMode(themeMode === 'dark' ? 'light' : 'dark');
  };

  const value: ThemeContextType = {
    themeMode,
    isDarkMode: themeMode === 'dark',
    setThemeMode,
    toggleThemeMode,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme deve ser usado dentro de um ThemeProvider');
  }

  return context;
}
