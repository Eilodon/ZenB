import { create } from 'zustand';

type SnackbarMessage = {
  id: string;
  text: string;
  kind: 'success' | 'warn' | 'error';
};

// NEW: AI confirmation request
type PendingConfirmation = {
  confirmId: string;
  toolName: string;
  args: Record<string, any>;
  reason: string;
};

type UIState = {
  isSettingsOpen: boolean;
  isHistoryOpen: boolean;
  showSummary: boolean;
  snackbar: SnackbarMessage | null;
  pendingConfirmation: PendingConfirmation | null;  // NEW

  setSettingsOpen: (isOpen: boolean) => void;
  setHistoryOpen: (isOpen: boolean) => void;
  setShowSummary: (show: boolean) => void;
  showSnackbar: (text: string, kind?: 'success' | 'warn' | 'error') => void;
  hideSnackbar: () => void;

  // NEW: AI confirmation actions
  showConfirmation: (confirmId: string, toolName: string, args: Record<string, any>, reason: string) => void;
  dismissConfirmation: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  isSettingsOpen: false,
  isHistoryOpen: false,
  showSummary: false,
  snackbar: null,
  pendingConfirmation: null,

  setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
  setHistoryOpen: (isOpen) => set({ isHistoryOpen: isOpen }),
  setShowSummary: (show) => set({ showSummary: show }),

  showSnackbar: (text, kind = 'success') => {
    const id = Date.now().toString();
    set({ snackbar: { id, text, kind } });
  },

  hideSnackbar: () => set({ snackbar: null }),

  // NEW: AI confirmation actions
  showConfirmation: (confirmId, toolName, args, reason) => {
    set({ pendingConfirmation: { confirmId, toolName, args, reason } });
  },

  dismissConfirmation: () => set({ pendingConfirmation: null }),
}));