import { create } from 'zustand';
import {
  BasketItem,
  RightPanelTab,
  ToastMessage,
  VaultAsset,
  VaultFile,
} from '../types/mimir';
import { SAMPLE_VAULT_FILES } from '../data/sampleVault';
import {
  ensureMdExtension,
  getParentDir,
  normalizePath,
  resolveWikiLink,
} from '../utils/markdown';
import {
  collectFolderDocuments,
  collectRecursiveLinks,
} from '../utils/contextBundler';
import {
  ConflictNotice,
  GitBackupStatus,
  SyncConfig,
  SyncStatus,
  deleteRemoteFile,
  loadSyncConfig,
  loadSyncedHashes,
  performFullSync,
  pushSingleAsset,
  pushSingleFile,
  saveSyncConfig,
  saveSyncedHashes,
} from '../utils/syncClient';

const STORAGE_KEY_FILES = 'mimir_vault_files_v1';
const STORAGE_KEY_ASSETS = 'mimir_vault_assets_v1';
const STORAGE_KEY_FAVORITES = 'mimir_vault_favorites_v1';

function loadInitialFiles(): Record<string, VaultFile> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FILES);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, VaultFile>;
      if (parsed && Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return SAMPLE_VAULT_FILES;
}

function loadInitialAssets(): Record<string, VaultAsset> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ASSETS);
    if (raw) {
      return JSON.parse(raw) as Record<string, VaultAsset>;
    }
  } catch {
    // ignore
  }
  return {};
}

function loadInitialFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FAVORITES);
    if (raw) {
      return JSON.parse(raw) as string[];
    }
  } catch {
    // ignore
  }
  return ['Welcome_to_Mimir.md', 'SOPs/Git_Branch_Cleanup.md'];
}

function persistFiles(files: Record<string, VaultFile>) {
  try {
    localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(files));
  } catch {
    // quota exceeded
  }
}

function persistAssets(assets: Record<string, VaultAsset>) {
  try {
    localStorage.setItem(STORAGE_KEY_ASSETS, JSON.stringify(assets));
  } catch {
    // quota exceeded
  }
}

function persistFavorites(favorites: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favorites));
  } catch {
    // ignore
  }
}

interface VaultState {
  files: Record<string, VaultFile>;
  assets: Record<string, VaultAsset>;
  favorites: string[];

  // Editor tabs & split pane
  openTabs: string[];
  activePath: string | null;
  splitPath: string | null;
  focusedPane: 'primary' | 'secondary';
  jumpRequest: { path: string; line?: number; heading?: string; ts: number } | null;

  // Layout panels
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  rightPanelTab: RightPanelTab;

  // Modals
  spotlightOpen: boolean;
  commandPaletteOpen: boolean;
  quickRefillOpen: boolean;
  exportModalOpen: boolean;
  exportSource: 'current' | 'basket';
  syncSettingsOpen: boolean;

  // Sync state (Phase 3)
  syncConfig: SyncConfig;
  syncStatus: SyncStatus;
  syncedHashes: Record<string, string>;
  lastSyncAt: number | null;
  syncError: string | null;
  gitBackupStatus: GitBackupStatus | null;
  conflicts: ConflictNotice[];

  // Context Basket
  basketItems: BasketItem[];
  selectedPromptPath: string | null;

  // Toasts
  toasts: ToastMessage[];

  // File actions
  openFile: (path: string, opts?: { split?: boolean; line?: number; heading?: string }) => void;
  closeTab: (path: string) => void;
  closeSplitPane: () => void;
  setFocusedPane: (pane: 'primary' | 'secondary') => void;
  updateFileContent: (path: string, content: string) => void;
  createFile: (rawPath: string, initialContent?: string) => string;
  renameFile: (oldPath: string, newRawPath: string) => void;
  deleteFile: (path: string) => void;
  toggleFavorite: (path: string) => void;
  openWikiLink: (target: string, heading?: string, currentPath?: string, split?: boolean) => void;

  // Asset actions (Clipboard image paste)
  saveImageAsset: (dataUrl: string, currentDocPath?: string) => string;

  // Layout & Modal actions
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  toggleBothSidebars: () => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  setSpotlightOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setQuickRefillOpen: (open: boolean) => void;
  openExportModal: (source?: 'current' | 'basket') => void;
  setExportModalOpen: (open: boolean) => void;
  setSyncSettingsOpen: (open: boolean) => void;

  // Sync actions (Phase 3)
  updateSyncConfig: (config: SyncConfig) => void;
  syncNow: (silent?: boolean) => Promise<void>;
  dismissConflict: (conflictPath: string) => void;

  // Context Basket actions
  addToBasket: (path: string, heading?: string) => void;
  removeFromBasket: (id: string) => void;
  moveBasketItem: (index: number, direction: -1 | 1) => void;
  clearBasket: () => void;
  setSelectedPromptPath: (path: string | null) => void;
  loadRecursiveLinksToBasket: (rootPath: string) => void;
  loadFolderToBasket: (rootPath: string) => void;

  // Reset sample vault
  resetSampleVault: () => void;

  // Toast
  pushToast: (text: string, type?: ToastMessage['type']) => void;
}

const initialFiles = loadInitialFiles();
const initialSyncConfig = loadSyncConfig();
const firstFile = initialFiles['Welcome_to_Mimir.md']
  ? 'Welcome_to_Mimir.md'
  : Object.keys(initialFiles)[0] ?? null;

// Debounced per-file background push timers
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useVaultStore = create<VaultState>((set, get) => ({
  files: initialFiles,
  assets: loadInitialAssets(),
  favorites: loadInitialFavorites(),

  openTabs: firstFile ? [firstFile] : [],
  activePath: firstFile,
  splitPath: null,
  focusedPane: 'primary',
  jumpRequest: null,

  leftSidebarOpen: true,
  rightSidebarOpen: true,
  rightPanelTab: 'basket',

  spotlightOpen: false,
  commandPaletteOpen: false,
  quickRefillOpen: false,
  exportModalOpen: false,
  exportSource: 'current',
  syncSettingsOpen: false,

  syncConfig: initialSyncConfig,
  syncStatus: initialSyncConfig.enabled ? 'synced' : 'offline',
  syncedHashes: loadSyncedHashes(),
  lastSyncAt: null,
  syncError: null,
  gitBackupStatus: null,
  conflicts: [],

  basketItems: [],
  selectedPromptPath: null,

  toasts: [],

  openFile: (path, opts) => {
    const state = get();
    if (!state.files[path]) return;

    if (opts?.split) {
      set({
        splitPath: path,
        focusedPane: 'secondary',
        jumpRequest:
          opts.line || opts.heading
            ? { path, line: opts.line, heading: opts.heading, ts: Date.now() }
            : state.jumpRequest,
      });
      return;
    }

    const openTabs = state.openTabs.includes(path)
      ? state.openTabs
      : [...state.openTabs, path];

    set({
      openTabs,
      activePath: path,
      focusedPane: 'primary',
      jumpRequest:
        opts?.line || opts?.heading
          ? { path, line: opts.line, heading: opts.heading, ts: Date.now() }
          : state.jumpRequest,
    });
  },

  closeTab: (path) => {
    const state = get();
    const nextTabs = state.openTabs.filter((t) => t !== path);
    let nextActive = state.activePath;
    if (state.activePath === path) {
      const idx = state.openTabs.indexOf(path);
      nextActive = nextTabs[Math.min(idx, nextTabs.length - 1)] ?? null;
    }
    set({ openTabs: nextTabs, activePath: nextActive });
  },

  closeSplitPane: () => set({ splitPath: null, focusedPane: 'primary' }),

  setFocusedPane: (pane) => set({ focusedPane: pane }),

  updateFileContent: (path, content) => {
    const state = get();
    const existing = state.files[path];
    if (!existing || existing.content === content) return;

    const nextFiles = {
      ...state.files,
      [path]: {
        ...existing,
        content,
        updatedAt: Date.now(),
      },
    };
    persistFiles(nextFiles);
    set({ files: nextFiles });

    // Auto-debounced background push if sync is enabled
    const { syncConfig } = get();
    if (syncConfig.enabled && syncConfig.autoSync && syncConfig.serverUrl) {
      const prevTimer = pushTimers.get(path);
      if (prevTimer) clearTimeout(prevTimer);
      pushTimers.set(
        path,
        setTimeout(async () => {
          pushTimers.delete(path);
          const cur = get();
          const latestFile = cur.files[path];
          if (!latestFile || !cur.syncConfig.enabled) return;
          try {
            const baseHash = cur.syncedHashes[path] ?? null;
            const res = await pushSingleFile(
              cur.syncConfig,
              path,
              latestFile.content,
              baseHash
            );
            if (res.conflict && res.conflictPath && res.serverContent !== undefined) {
              const updatedFiles = {
                ...get().files,
                [path]: {
                  path,
                  content: res.serverContent,
                  updatedAt: res.serverUpdatedAt ?? Date.now(),
                },
                [res.conflictPath]: {
                  path: res.conflictPath,
                  content: latestFile.content,
                  updatedAt: Date.now(),
                },
              };
              const nextHashes = {
                ...get().syncedHashes,
                ...(res.serverHash ? { [path]: res.serverHash } : {}),
              };
              persistFiles(updatedFiles);
              saveSyncedHashes(nextHashes);
              set((s) => ({
                files: updatedFiles,
                syncedHashes: nextHashes,
                syncStatus: 'conflict',
                conflicts: [
                  ...s.conflicts.filter((c) => c.conflictPath !== res.conflictPath),
                  {
                    originalPath: path,
                    conflictPath: res.conflictPath!,
                    detectedAt: Date.now(),
                  },
                ],
              }));
              get().pushToast(
                `检测到并发修改冲突：已保留双方副本 (${res.conflictPath})`,
                'warning'
              );
            } else if (res.hash) {
              const nextHashes = { ...get().syncedHashes, [path]: res.hash };
              saveSyncedHashes(nextHashes);
              set({ syncedHashes: nextHashes, lastSyncAt: Date.now(), syncError: null });
            }
          } catch (err) {
            set({
              syncStatus: 'error',
              syncError: err instanceof Error ? err.message : String(err),
            });
          }
        }, 1800)
      );
    }
  },

  createFile: (rawPath, initialContent) => {
    const state = get();
    let path = ensureMdExtension(rawPath);

    // Avoid overwriting existing file silently
    if (state.files[path]) {
      const base = path.replace(/\.md$/i, '');
      let n = 2;
      while (state.files[`${base}_${n}.md`]) n++;
      path = `${base}_${n}.md`;
    }

    const title = path.split('/').pop()?.replace(/\.md$/i, '') || 'Untitled';
    const content = initialContent ?? `# ${title}\n\n`;

    const nextFiles: Record<string, VaultFile> = {
      ...state.files,
      [path]: {
        path,
        content,
        updatedAt: Date.now(),
      },
    };
    persistFiles(nextFiles);

    const openTabs = state.openTabs.includes(path)
      ? state.openTabs
      : [...state.openTabs, path];

    set({
      files: nextFiles,
      openTabs,
      activePath: path,
      focusedPane: 'primary',
    });
    return path;
  },

  renameFile: (oldPath, newRawPath) => {
    const state = get();
    const existing = state.files[oldPath];
    if (!existing) return;

    const newPath = ensureMdExtension(newRawPath);
    if (newPath === oldPath || state.files[newPath]) {
      get().pushToast('目标文件名已存在或未变化', 'warning');
      return;
    }

    const nextFiles = { ...state.files };
    delete nextFiles[oldPath];
    nextFiles[newPath] = {
      ...existing,
      path: newPath,
      updatedAt: Date.now(),
    };
    persistFiles(nextFiles);

    const nextFavorites = state.favorites.map((f) => (f === oldPath ? newPath : f));
    persistFavorites(nextFavorites);

    set({
      files: nextFiles,
      favorites: nextFavorites,
      openTabs: state.openTabs.map((t) => (t === oldPath ? newPath : t)),
      activePath: state.activePath === oldPath ? newPath : state.activePath,
      splitPath: state.splitPath === oldPath ? newPath : state.splitPath,
      basketItems: state.basketItems.map((b) =>
        b.path === oldPath ? { ...b, path: newPath, id: b.heading ? `${newPath}#${b.heading}` : newPath } : b
      ),
    });
    get().pushToast(`已重命名为 ${newPath}`, 'success');
  },

  deleteFile: (path) => {
    const state = get();
    if (!state.files[path]) return;
    const nextFiles = { ...state.files };
    delete nextFiles[path];
    persistFiles(nextFiles);

    const nextTabs = state.openTabs.filter((t) => t !== path);
    const nextActive =
      state.activePath === path ? nextTabs[0] ?? Object.keys(nextFiles)[0] ?? null : state.activePath;
    const nextSplit = state.splitPath === path ? null : state.splitPath;
    const nextFavorites = state.favorites.filter((f) => f !== path);
    persistFavorites(nextFavorites);

    set({
      files: nextFiles,
      openTabs: nextTabs,
      activePath: nextActive,
      splitPath: nextSplit,
      favorites: nextFavorites,
      basketItems: state.basketItems.filter((b) => b.path !== path),
    });
    get().pushToast(`已删除 ${path}`, 'info');
    if (state.syncConfig.enabled && state.syncConfig.serverUrl) {
      deleteRemoteFile(state.syncConfig, path).catch(() => {});
    }
  },

  toggleFavorite: (path) => {
    const state = get();
    const exists = state.favorites.includes(path);
    const next = exists
      ? state.favorites.filter((f) => f !== path)
      : [...state.favorites, path];
    persistFavorites(next);
    set({ favorites: next });
  },

  openWikiLink: (target, heading, currentPath, split) => {
    const state = get();
    const resolved = resolveWikiLink(target, state.files, currentPath);
    if (resolved) {
      state.openFile(resolved.path, { heading, split });
    } else if (target.trim()) {
      const dir = currentPath ? getParentDir(currentPath) : '';
      const rawPath = target.includes('/')
        ? normalizePath(target)
        : dir
          ? `${dir}/${target}`
          : target;
      const created = state.createFile(rawPath);
      state.pushToast(`已自动创建新双链文档：${created}`, 'success');
    }
  },

  saveImageAsset: (dataUrl, currentDocPath) => {
    const state = get();
    const docSlug = currentDocPath
      ? currentDocPath
          .split('/')
          .pop()
          ?.replace(/\.md$/i, '')
          .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_') || 'img'
      : 'img';
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const rand = Math.random().toString(36).slice(2, 6);
    const assetPath = `assets/${docSlug}_${stamp}_${rand}.png`;

    const nextAssets: Record<string, VaultAsset> = {
      ...state.assets,
      [assetPath]: {
        path: assetPath,
        dataUrl,
        createdAt: Date.now(),
      },
    };
    persistAssets(nextAssets);
    set({ assets: nextAssets });
    state.pushToast(`图片已归档至 ${assetPath}`, 'success');
    if (state.syncConfig.enabled && state.syncConfig.serverUrl) {
      pushSingleAsset(state.syncConfig, assetPath, dataUrl).catch(() => {});
    }
    return assetPath;
  },

  toggleLeftSidebar: () => set((s) => ({ leftSidebarOpen: !s.leftSidebarOpen })),
  toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),
  toggleBothSidebars: () =>
    set((s) => {
      const anyOpen = s.leftSidebarOpen || s.rightSidebarOpen;
      return {
        leftSidebarOpen: !anyOpen,
        rightSidebarOpen: !anyOpen,
      };
    }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab, rightSidebarOpen: true }),
  setSpotlightOpen: (open) => set({ spotlightOpen: open }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setQuickRefillOpen: (open) => set({ quickRefillOpen: open }),
  openExportModal: (source = 'current') =>
    set({ exportModalOpen: true, exportSource: source }),
  setExportModalOpen: (open) => set({ exportModalOpen: open }),
  setSyncSettingsOpen: (open) => set({ syncSettingsOpen: open }),

  updateSyncConfig: (config) => {
    saveSyncConfig(config);
    set({
      syncConfig: config,
      syncStatus: config.enabled ? 'synced' : 'offline',
      syncError: null,
    });
  },

  syncNow: async (silent = false) => {
    const state = get();
    if (!state.syncConfig.enabled || !state.syncConfig.serverUrl) return;
    if (state.syncStatus === 'syncing') return;

    set({ syncStatus: 'syncing', syncError: null });
    try {
      const result = await performFullSync(
        state.syncConfig,
        state.files,
        state.assets,
        state.syncedHashes
      );
      persistFiles(result.files);
      persistAssets(result.assets);
      saveSyncedHashes(result.syncedHashes);

      const mergedConflicts = [
        ...state.conflicts,
        ...result.conflicts.filter(
          (nc) => !state.conflicts.some((oc) => oc.conflictPath === nc.conflictPath)
        ),
      ];

      set({
        files: result.files,
        assets: result.assets,
        syncedHashes: result.syncedHashes,
        lastSyncAt: Date.now(),
        gitBackupStatus: result.gitBackup ?? state.gitBackupStatus,
        conflicts: mergedConflicts,
        syncStatus: mergedConflicts.length > 0 ? 'conflict' : 'synced',
        syncError: null,
      });

      if (!silent) {
        if (result.conflicts.length > 0) {
          state.pushToast(
            `同步完成，但检测到 ${result.conflicts.length} 个冲突（已无损保留双方副本）`,
            'warning'
          );
        } else {
          state.pushToast(
            `双向同步完成：拉取 ${result.pulledCount} 篇 · 推送 ${result.pushedCount} 篇`,
            'success'
          );
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ syncStatus: 'error', syncError: message });
      if (!silent) {
        state.pushToast(`同步失败：${message}`, 'warning');
      }
    }
  },

  dismissConflict: (conflictPath) =>
    set((s) => {
      const next = s.conflicts.filter((c) => c.conflictPath !== conflictPath);
      return {
        conflicts: next,
        syncStatus:
          next.length > 0
            ? 'conflict'
            : s.syncConfig.enabled
              ? 'synced'
              : 'offline',
      };
    }),

  addToBasket: (path, heading) => {
    const state = get();
    if (!state.files[path]) return;
    const id = heading ? `${path}#${heading}` : path;
    if (state.basketItems.some((b) => b.id === id)) {
      state.pushToast('该文档/章节已在上下文篮子中', 'info');
      return;
    }
    set({
      basketItems: [...state.basketItems, { id, path, heading }],
      rightPanelTab: 'basket',
      rightSidebarOpen: true,
    });
    state.pushToast(
      heading ? `已加入篮子：${path} #${heading}` : `已加入篮子：${path}`,
      'success'
    );
  },

  removeFromBasket: (id) =>
    set((s) => ({
      basketItems: s.basketItems.filter((b) => b.id !== id),
    })),

  moveBasketItem: (index, direction) =>
    set((s) => {
      const target = index + direction;
      if (target < 0 || target >= s.basketItems.length) return s;
      const next = [...s.basketItems];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return { basketItems: next };
    }),

  clearBasket: () => set({ basketItems: [] }),

  setSelectedPromptPath: (path) => set({ selectedPromptPath: path }),

  loadRecursiveLinksToBasket: (rootPath) => {
    const state = get();
    const collected = collectRecursiveLinks(rootPath, state.files, 3);
    const existingIds = new Set(state.basketItems.map((b) => b.id));
    const merged = [
      ...state.basketItems,
      ...collected.filter((c) => !existingIds.has(c.id)),
    ];
    set({
      basketItems: merged,
      rightPanelTab: 'basket',
      rightSidebarOpen: true,
    });
    state.pushToast(`已递归聚合 ${collected.length} 篇关联文档到上下文篮子`, 'success');
  },

  loadFolderToBasket: (rootPath) => {
    const state = get();
    const collected = collectFolderDocuments(rootPath, state.files);
    const existingIds = new Set(state.basketItems.map((b) => b.id));
    const merged = [
      ...state.basketItems,
      ...collected.filter((c) => !existingIds.has(c.id)),
    ];
    set({
      basketItems: merged,
      rightPanelTab: 'basket',
      rightSidebarOpen: true,
    });
    state.pushToast(`已将同目录 ${collected.length} 篇文档加入上下文篮子`, 'success');
  },

  resetSampleVault: () => {
    persistFiles(SAMPLE_VAULT_FILES);
    set({
      files: SAMPLE_VAULT_FILES,
      openTabs: ['Welcome_to_Mimir.md'],
      activePath: 'Welcome_to_Mimir.md',
      splitPath: null,
      basketItems: [],
    });
    get().pushToast('已重置为 Mimir 示例仓库', 'info');
  },

  pushToast: (text, type = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ toasts: [...s.toasts, { id, text, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 2800);
  },
}));
