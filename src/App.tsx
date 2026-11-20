import React, { useEffect } from 'react';
import { useVaultStore } from './store/useVaultStore';
import { Sidebar } from './components/Sidebar';
import { EditorPane } from './components/EditorPane';
import { RightPanel } from './components/RightPanel';
import { SpotlightSearch } from './components/SpotlightSearch';
import { CommandPalette } from './components/CommandPalette';
import { QuickRefillModal } from './components/QuickRefillModal';

export const App: React.FC = () => {
  const leftSidebarOpen = useVaultStore((s) => s.leftSidebarOpen);
  const rightSidebarOpen = useVaultStore((s) => s.rightSidebarOpen);
  const toasts = useVaultStore((s) => s.toasts);

  const setSpotlightOpen = useVaultStore((s) => s.setSpotlightOpen);
  const setCommandPaletteOpen = useVaultStore((s) => s.setCommandPaletteOpen);
  const setQuickRefillOpen = useVaultStore((s) => s.setQuickRefillOpen);
  const toggleBothSidebars = useVaultStore((s) => s.toggleBothSidebars);

  // Global keyboard-first shortcut bindings
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      const key = e.key.toLowerCase();

      // Ctrl+K or Ctrl+O -> Spotlight Omnibar
      if ((key === 'k' || key === 'o') && !e.shiftKey) {
        e.preventDefault();
        setCommandPaletteOpen(false);
        setSpotlightOpen(true);
        return;
      }

      // Ctrl+P -> Global Command Palette
      if (key === 'p' && !e.shiftKey) {
        e.preventDefault();
        setSpotlightOpen(false);
        setCommandPaletteOpen(true);
        return;
      }

      // Ctrl+\ -> Toggle Left & Right Sidebars (Focus Mode)
      if (e.key === '\\') {
        e.preventDefault();
        toggleBothSidebars();
        return;
      }

      // Ctrl+Shift+V -> Quick Refill from LLM Clipboard
      if (key === 'v' && e.shiftKey) {
        e.preventDefault();
        setQuickRefillOpen(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    setSpotlightOpen,
    setCommandPaletteOpen,
    setQuickRefillOpen,
    toggleBothSidebars,
  ]);

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#0f1117] text-slate-200">
      {leftSidebarOpen && <Sidebar />}
      <EditorPane />
      {rightSidebarOpen && <RightPanel />}

      {/* Modals */}
      <SpotlightSearch />
      <CommandPalette />
      <QuickRefillModal />

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium shadow-lg border backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : toast.type === 'warning'
                  ? 'bg-amber-950/90 border-amber-500/40 text-amber-200'
                  : 'bg-slate-900/90 border-slate-700 text-slate-200'
            }`}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
