import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface Theme {
  accent: string;
  accentDark: string;
  accentLight: string;
  sidebarBg: string;
  name: string;
}

export const THEME_PRESETS: Theme[] = [
  { name: 'blue',   accent: '#3b82f6', accentDark: '#2563eb', accentLight: '#eff6ff', sidebarBg: '#0a1628' },
  { name: 'indigo', accent: '#6366f1', accentDark: '#4f46e5', accentLight: '#eef2ff', sidebarBg: '#0f0e2b' },
  { name: 'purple', accent: '#8b5cf6', accentDark: '#7c3aed', accentLight: '#f5f3ff', sidebarBg: '#170a2d' },
  { name: 'teal',   accent: '#14b8a6', accentDark: '#0d9488', accentLight: '#f0fdfa', sidebarBg: '#041e1c' },
  { name: 'green',  accent: '#10b981', accentDark: '#059669', accentLight: '#f0fdf4', sidebarBg: '#04200f' },
  { name: 'orange', accent: '#f59e0b', accentDark: '#d97706', accentLight: '#fffbeb', sidebarBg: '#1c1003' },
  { name: 'rose',   accent: '#f43f5e', accentDark: '#e11d48', accentLight: '#fff1f2', sidebarBg: '#200508' },
  { name: 'slate',  accent: '#64748b', accentDark: '#475569', accentLight: '#f8fafc', sidebarBg: '#0f172a' },
];

const LS_KEY = 'hm_theme';

// ─── Color helpers for custom accent generation ───────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const num = parseInt(h, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('');
}

// Blend a hex color toward a target RGB by `amount` (0-1).
function mix(hex: string, target: [number, number, number], amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    r + (target[0] - r) * amount,
    g + (target[1] - g) * amount,
    b + (target[2] - b) * amount,
  );
}

const BLACK: [number, number, number] = [0, 0, 0];
const WHITE: [number, number, number] = [255, 255, 255];

// Build a full Theme from a single accent color, deriving the rest of the palette.
export function buildCustomTheme(accent: string): Theme {
  return {
    name: 'custom',
    accent,
    accentDark: mix(accent, BLACK, 0.2),
    accentLight: mix(accent, WHITE, 0.92),
    sidebarBg: mix(accent, BLACK, 0.9),
  };
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent-dark', theme.accentDark);
  root.style.setProperty('--accent-light', theme.accentLight);
  root.style.setProperty('--sidebar-bg', theme.sidebarBg);
}

function isValidTheme(t: any): t is Theme {
  return t && typeof t.accent === 'string' && typeof t.accentDark === 'string'
    && typeof t.accentLight === 'string' && typeof t.sidebarBg === 'string';
}

function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      // New format: full theme object stored as JSON (presets + custom colors)
      try {
        const parsed = JSON.parse(saved);
        if (isValidTheme(parsed)) return parsed;
      } catch {
        // Old format: just the preset name as a plain string
        const found = THEME_PRESETS.find(t => t.name === saved);
        if (found) return found;
      }
    }
  } catch {
    // ignore
  }
  return THEME_PRESETS[0]; // default: blue
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(loadTheme);

  useEffect(() => {
    applyTheme(theme);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(newTheme));
    } catch {
      // ignore
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
