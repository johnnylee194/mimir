export interface VaultFile {
  /** Normalized relative path inside the vault, e.g. "SOPs/Git_Branch_Cleanup.md" */
  path: string;
  /** Raw markdown text */
  content: string;
  /** Last modified timestamp (ms) */
  updatedAt: number;
}

export interface VaultAsset {
  /** Relative asset path, e.g. "assets/img-20261119-abc123.png" */
  path: string;
  /** Data URL (base64) for local Phase 1 storage; will map to synced binary URL in Phase 3 */
  dataUrl: string;
  createdAt: number;
}

export interface HeadingInfo {
  level: number;
  text: string;
  /** 1-based line number */
  line: number;
  /** Character offset in document */
  from: number;
}

export interface WikiLinkRef {
  raw: string;
  target: string;
  heading?: string;
  alias?: string;
  isEmbed: boolean;
  from: number;
  to: number;
}

export interface BacklinkEntry {
  sourcePath: string;
  line: number;
  snippet: string;
}

export interface BasketItem {
  id: string;
  path: string;
  /** Optional heading text if only a specific section is added */
  heading?: string;
}

export interface FolderTreeNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  children?: FolderTreeNode[];
}

export type RightPanelTab = 'basket' | 'outline';

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'info' | 'success' | 'warning';
}
