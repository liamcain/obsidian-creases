import "obsidian";

declare module "obsidian" {
  interface FoldRange {
    from: number;
    to: number;
  }

  interface FoldInfo {
    folds: FoldRange[];
    lines: number;
  }

  interface EditorComponent {
    editor: Editor;
    getFoldInfo(): FoldInfo | null;
    applyFoldInfo(info: FoldInfo): void;
  }

  interface Editor {
    getAllFoldableLines(): FoldRange[];
  }

  interface MarkdownViewController extends MarkdownFileInfo {
    editMode: EditorComponent;
    getMode(): "source" | "preview";
    onMarkdownFold(): void;
  }

  interface MarkdownSubView {
    applyFoldInfo(info: FoldInfo): void;
  }

  interface Workspace {
    on(name: "status-bar-updated", callback: () => any, ctx?: any): EventRef;
    on(name: "ribbon-bar-updated", callback: () => any, ctx?: any): EventRef;
    on(
      name: "templates:template-appended",
      callback: (event: TemplaterAppendedEvent) => any,
      ctx?: any
    ): EventRef;
    on(
      name: "templater:new-note-from-template",
      callback: (event: TemplaterNewNoteEvent) => any,
      ctx?: any
    ): EventRef;
    on(
      name: "templater:template-appended",
      callback: (event: TemplaterAppendedEvent) => any,
      ctx?: any
    ): EventRef;
    on(
      name: "templater:overwrite-file",
      callback: (event: TemplaterOverwriteEvent) => any,
      ctx?: any
    ): EventRef;
  }

  export interface TemplaterNewNoteEvent {
    file: TFile;
    contents: string;
  }

  export interface TemplaterOverwriteEvent {
    file: TFile;
    contents: string;
  }

  export interface TemplaterAppendedEvent {
    oldSelections: EditorSelection[];
    newSelections: EditorSelection[];
    view: MarkdownViewController;
    content: string;
  }

  export interface FoldManager {
    load(file: TFile): Promise<FoldInfo>;
    save(file: TFile, foldInfo: FoldInfo): Promise<void>;
  }

  interface App {
    foldManager: FoldManager;
    internalPlugins: InternalPlugins;
    viewRegistry: ViewRegistry;
  }

  interface VaultSettings {
    legacyEditor: boolean;
    foldHeading: boolean;
    foldIndent: boolean;
    rightToLeft: boolean;
    readableLineLength: boolean;
    tabSize: number;
    showFrontmatter: boolean;
  }

  interface Vault {
    config: Record<string, any>;
    getConfig<T extends keyof VaultSettings>(setting: T): VaultSettings[T];
  }

  export interface PluginInstance {
    id: string;
  }

  export interface InstalledPlugin {
    enabled: boolean;
    instance: PluginInstance;
  }

  export interface InternalPlugins {
    plugins: Record<string, InstalledPlugin>;
    getPluginById(id: string): InstalledPlugin;
  }

  export interface ViewRegistry {
    viewByType: Record<string, (leaf: WorkspaceLeaf) => unknown>;
    isExtensionRegistered(extension: string): boolean;
  }
}
