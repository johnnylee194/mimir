import React, { useEffect } from 'react';
import { useVaultStore } from './store/useVaultStore';
import { Sidebar } from './components/Sidebar';
import { EditorPane } from './components/EditorPane';
import { RightPanel } from './components/RightPanel';
import { SpotlightSearch } from './components/SpotlightSearch';
import { CommandPalette } from './components/CommandPalette';
import { QuickRefillModal } from './components/QuickRefillModal';
import { ExportModal } from './components/ExportModal';
import { SyncSettingsModal } from './components/SyncSettingsModal';
import { MobileLayout } from './components/MobileLayout';
import { useIsMobile } from './hooks/useIsMobile';
import { AlertTriangle, Columns2, X } from 'lucide-react';

export const App: React.FC = () => {
  const isMobile = useIsMobile();
  const leftSidebarOpen = useVaultStore((s) => s.leftSidebarOpen);
  const rightSidebarOpen = useVaultStore((s) => s.rightSidebarOpen);
  const toasts = useVaultStore((s) => s.toasts);
  const conflicts = useVaultStore((s) => s.conflicts);
  const syncConfig = useVaultStore((s) => s.syncConfig);

  const setSpotlightOpen = useVaultStore((s) => s.setSpotlightOpen);
  const setCommandPaletteOpen = useVaultStore((s) => s.setCommandPaletteOpen);
  const setQuickRefillOpen = useVaultStore((s) => s.setQuickRefillOpen);
  const openExportModal = useVaultStore((s) => s.openExportModal);
  const toggleBothSidebars = useVaultStore((s) => s.toggleBothSidebars);
  const syncNow = useVaultStore((s) => s.syncNow);
  const openFile = useVaultStore((s) => s.openFile);
  const dismissConflict = useVaultStore((s) => s.dismissConflict);

  // Periodic background sync with Ubuntu Mimir Daemon
  useEffect(() => {
    if (!syncConfig.enabled || !syncConfig.autoSync || !syncConfig.serverUrl) return;
    syncNow(true);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncNow(true);
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [syncConfig.enabled, syncConfig.autoSync, syncConfig.serverUrl, syncNow]);

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
        return;
      }

      // Ctrl+E -> Clean Export Modal (MD / PNG / PDF)
      if (key === 'e' && !e.shiftKey) {
        e.preventDefault();
        openExportModal('current');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    setSpotlightOpen,
    setCommandPaletteOpen,
    setQuickRefillOpen,
    openExportModal,
    toggleBothSidebars,
  ]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#0f1117] text-slate-200">
      {/* Gentle Lossless Conflict Banner */}
      {conflicts.length > 0 && (
        <div className="px-4 py-1.5 bg-amber-950/90 border-b border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">
              同步冲突保护已生效：<strong>{conflicts[0].originalPath}</strong> 已无损保留双方修改副本 ({conflicts[0].conflictPath})
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                openFile(conflicts[0].originalPath);
                openFile(conflicts[0].conflictPath, { split: true });
              }}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/25 hover:bg-amber-500/40 text-amber-100 font-medium"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>分屏对照合并</span>
            </button>
            <button
              type="button"
              onClick={() => dismissConflict(conflicts[0].conflictPath)}
              className="text-amber-300 hover:text-white"
              title="关闭提示"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {isMobile ? (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <MobileLayout />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {leftSidebarOpen && <Sidebar />}
          <EditorPane />
          {rightSidebarOpen && <RightPanel />}
        </div>
      )}

      {/* Modals */}
      <SpotlightSearch />
      <CommandPalette />
      <QuickRefillModal />
      <ExportModal />
      <SyncSettingsModal />

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
