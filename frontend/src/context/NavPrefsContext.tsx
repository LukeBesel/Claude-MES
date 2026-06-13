import { createContext, useContext, useState, ReactNode } from 'react';

const HIDDEN_KEY = 'hm_hidden_nav';
const COLLAPSED_KEY = 'hm_collapsed_nav_groups';

function loadSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    // ignore
  }
  return new Set();
}

function saveSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

interface NavPrefsContextValue {
  hiddenItems: Set<string>;
  isItemHidden: (to: string) => boolean;
  toggleItem: (to: string) => void;
  collapsedGroups: Set<string>;
  isGroupCollapsed: (group: string) => boolean;
  toggleGroup: (group: string) => void;
  resetNavPrefs: () => void;
}

const NavPrefsContext = createContext<NavPrefsContextValue | null>(null);

export function NavPrefsProvider({ children }: { children: ReactNode }) {
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(() => loadSet(HIDDEN_KEY));
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => loadSet(COLLAPSED_KEY));

  const toggleItem = (to: string) => {
    setHiddenItems(prev => {
      const next = new Set(prev);
      if (next.has(to)) next.delete(to);
      else next.add(to);
      saveSet(HIDDEN_KEY, next);
      return next;
    });
  };

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      saveSet(COLLAPSED_KEY, next);
      return next;
    });
  };

  const resetNavPrefs = () => {
    setHiddenItems(new Set());
    setCollapsedGroups(new Set());
    saveSet(HIDDEN_KEY, new Set());
    saveSet(COLLAPSED_KEY, new Set());
  };

  return (
    <NavPrefsContext.Provider
      value={{
        hiddenItems,
        isItemHidden: (to) => hiddenItems.has(to),
        toggleItem,
        collapsedGroups,
        isGroupCollapsed: (group) => collapsedGroups.has(group),
        toggleGroup,
        resetNavPrefs,
      }}
    >
      {children}
    </NavPrefsContext.Provider>
  );
}

export function useNavPrefs(): NavPrefsContextValue {
  const ctx = useContext(NavPrefsContext);
  if (!ctx) throw new Error('useNavPrefs must be used within a NavPrefsProvider');
  return ctx;
}
