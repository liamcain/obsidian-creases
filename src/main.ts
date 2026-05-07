import sortBy from "lodash/sortBy";
import {
  Editor,
  EditorChange,
  EditorSelection,
  EventRef,
  FoldRange,
  MarkdownFileInfo,
  MarkdownView,
  MarkdownViewController,
  Menu,
  Plugin,
  TAbstractFile,
  TemplaterAppendedEvent,
  TemplaterNewNoteEvent,
  TFile,
} from "obsidian";
import { around } from "monkey-around";

import { creasePlugin } from "./creaseWidget";
import { CREASE_REGEX, hasCrease } from "./utils";
import { CreasesSettings, CreasesSettingTab, DEFAULT_SETTINGS } from "./settings";

const headingLevels = [1, 2, 3, 4, 5, 6];

const BLOCK_ID_REGEX = /\^([a-zA-Z0-9-]+)$/;

export default class CreasesPlugin extends Plugin {
  public settings!: CreasesSettings;
  private onFileOpenListener: EventRef | null = null;

  private get activeEditor(): MarkdownViewController | null {
    return this.app.workspace.activeEditor as MarkdownViewController | null;
  }

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new CreasesSettingTab(this.app, this));
    this.registerEditorExtension(creasePlugin(this.app));
    this.addCommand({
      id: "fold",
      name: "Fold along creases",
      checkCallback: (checking) => {
        const ctx = this.activeEditor;
        if (ctx && ctx.editor) {
          if (!checking) {
            this.foldCreasesForView(ctx);
          }
          return true;
        }
      },
    });

    this.addCommand({
      id: "toggle-crease",
      name: "Toggle crease",
      checkCallback: (checking) => {
        const ctx = this.activeEditor;
        if (ctx && ctx.editor) {
          if (!checking) {
            this.toggleCrease(ctx);
          }
          return true;
        }
      },
    });

    this.addCommand({
      id: "crease-current-folds",
      name: "Crease the current folds",
      checkCallback: (checking) => {
        const ctx = this.activeEditor;
        if (ctx && ctx.editor && (ctx.editMode.getFoldInfo()?.folds.length ?? 0) > 0) {
          if (!checking) {
            this.creaseCurrentFolds(ctx);
          }
          return true;
        }
      },
    });

    this.addCommand({
      id: "clear-creases",
      name: "Iron out (clear) the creases",
      checkCallback: (checking) => {
        const ctx = this.activeEditor;
        if (ctx && ctx.editor) {
          if (!checking) {
            this.clearCreases(ctx);
          }
          return true;
        }
      },
    });

    this.addCommand({
      id: "increase-fold-level",
      name: "Increase heading fold level",
      checkCallback: (checking) => {
        const ctx = this.activeEditor;
        if (ctx && ctx.editor) {
          if (!checking) {
            this.increaseHeadingFoldLevel(ctx);
          }
          return true;
        }
      },
    });

    this.addCommand({
      id: "decrease-fold-level",
      name: "Decrease heading fold level",
      checkCallback: (checking) => {
        const ctx = this.activeEditor;
        if (ctx && ctx.editor) {
          if (!checking) {
            this.decreaseHeadingFoldLevel(ctx);
          }
          return true;
        }
      },
    });

    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(this.app.vault.on("create", this.onNewFile.bind(this)));
      this.patchCoreTemplatePlugin();
    });

    headingLevels.forEach((level) => {
      this.addCommand({
        id: `toggle-fold-heading-level-${level}`,
        name: `Toggle fold for H${level}`,
        checkCallback: (checking) => {
          const ctx = this.activeEditor;
          if (ctx && ctx.editor) {
            if (!checking) {
              this.toggleFoldForHeadingLevel(ctx, level);
            }
            return true;
          }
        },
      });
    });

    this.onFileOpenListener = this.app.workspace.on('file-open', this.onFileOpen, this);
    this.registerEvent(this.onFileOpenListener);

    this.registerEvent(this.app.workspace.on("editor-menu", this.onEditorMenu, this));
    this.registerEvent(
      this.app.workspace.on("templater:overwrite-file", this.onTemplaterNewFile, this)
    );
    this.registerEvent(
      this.app.workspace.on(
        "templater:new-note-from-template",
        this.onTemplaterNewFile,
        this
      )
    );
    this.registerEvent(
      this.app.workspace.on("templater:template-appended", this.onTemplateAppend, this)
    );
    this.registerEvent(
      this.app.workspace.on("templates:template-appended", this.onTemplateAppend, this)
    );
  }

  private onFileOpen(_file: TFile): void {
    if (this.app.workspace.activeLeaf) {
      this.patchMarkdownView();
      this.app.workspace.offref(this.onFileOpenListener);
    }
  }

  private async handleNewFile(file: TFile, contents: string): Promise<void> {
    if (
      ["start-folded", "fold-and-clear"].contains(
        this.settings.templateCreasesBehavior
      ) &&
      hasCrease(contents)
    ) {
      this.foldCreasesForFile(file);
      if (this.settings.templateCreasesBehavior === "fold-and-clear") {
        this.app.vault.modify(file, contents.replace(new RegExp(CREASE_REGEX, "g"), ""));
      }
    }
  }

  private async onNewFile(fileOrFolder: TAbstractFile): Promise<void> {
    if (!(fileOrFolder instanceof TFile)) {
      return;
    }
    const contents = await this.app.vault.cachedRead(fileOrFolder);
    this.handleNewFile(fileOrFolder, contents);
  }

  private async onTemplaterNewFile(evt: TemplaterNewNoteEvent): Promise<void> {
    const { file, contents } = evt;
    this.handleNewFile(file, contents);
  }

  async onTemplateAppend(evt: TemplaterAppendedEvent): Promise<void> {
    if (
      !["start-folded", "fold-and-clear"].contains(this.settings.templateCreasesBehavior)
    ) {
      return;
    }
    const { view, newSelections, oldSelections } = evt;
    if (!view.editor) return;

    const foldPositions: FoldRange[] = [];
    const changes: EditorChange[] = [];

    for (let idx = 0; idx < newSelections.length; idx++) {
      const [start, , , end] = sortBy(
        [
          oldSelections[idx].anchor,
          oldSelections[idx].head,
          newSelections[idx].anchor,
          newSelections[idx].head,
        ],
        ["line", "ch"]
      );
      const content = view.editor.getRange(start, end);

      if (!hasCrease(content)) continue;

      for (let lineNum = start.line; lineNum <= end.line; lineNum++) {
        const line = view.editor.getLine(lineNum);
        if (hasCrease(line)) {
          foldPositions.push({
            from: lineNum,
            to: lineNum + 1,
          });
        }

        if (this.settings.templateCreasesBehavior === "fold-and-clear") {
          const lineWithoutCrease = line.replace(CREASE_REGEX, "").trimEnd();
          changes.push({
            text: lineWithoutCrease,
            from: { line: lineNum, ch: 0 },
            to: { line: lineNum + 1, ch: 0 },
          });
        }
      }
    }

    view.editMode.applyFoldInfo({
      folds: foldPositions,
      lines: view.editor.lineCount(),
    });
    view.editor.transaction({ changes });
  }

  async decreaseHeadingFoldLevel(ctx: MarkdownViewController) {
    if (!ctx.editor || !ctx.file) return;
    const existingFolds = ctx.editMode.getFoldInfo()?.folds ?? [];
    const headings = this.app.metadataCache.getFileCache(ctx.file)?.headings ?? [];

    // Find the heading with the highest level that's unfolded
    let maxUnfoldedLevel = 1;
    for (const heading of headings) {
      if (!existingFolds.find((f) => f.from === heading.position.start.line)) {
        maxUnfoldedLevel = Math.max(maxUnfoldedLevel, heading.level);
      }
    }

    const headingsAtLevel = headings.filter((h) => h.level === maxUnfoldedLevel);
    const folds = [
      ...existingFolds,
      ...headingsAtLevel.map((h) => ({
        from: h.position.start.line,
        to: h.position.end.line,
      })),
    ];

    ctx.editMode.applyFoldInfo({
      folds,
      lines: ctx.editor.lineCount(),
    });
    ctx.onMarkdownFold();
  }

  async increaseHeadingFoldLevel(ctx: MarkdownViewController) {
    if (!ctx.editor || !ctx.file) return;
    const existingFolds = ctx.editMode.getFoldInfo()?.folds ?? [];
    const headings = this.app.metadataCache.getFileCache(ctx.file)?.headings ?? [];

    let maxFoldLevel = Math.max(...headings.map((h) => h.level));
    for (const heading of headings) {
      if (existingFolds.find((f) => f.from === heading.position.start.line)) {
        maxFoldLevel = Math.min(maxFoldLevel, heading.level);
      }
    }

    const excludedHeadingPositions = new Set(
      headings.filter((h) => h.level <= maxFoldLevel).map((h) => h.position.start.line)
    );
    const folds = existingFolds.filter(
      (fold) => !excludedHeadingPositions.has(fold.from)
    );

    ctx.editMode.applyFoldInfo({
      folds,
      lines: ctx.editor.lineCount(),
    });
    ctx.onMarkdownFold();
  }

  private patchMarkdownView() {
    const plugin = this as CreasesPlugin;
    const { workspace } = this.app;
    const leaf = workspace.activeLeaf;

    if (!leaf) {
      return;
    }

    this.register(
      around(leaf.view.constructor.prototype, {
        onLoadFile(old: (file: TFile) => void) {
          return async function (file: TFile) {
            await old.call(this, file);
            if (file && plugin.settings.onOpenCreasesBehavior === "always-fold") {
              plugin.foldCreasesForFile(file);
            }
          };
        },
      })
    );
  }

  private patchCoreTemplatePlugin() {
    const coreTemplatePlugin = this.app.internalPlugins.getPluginById("templates");
    if (!coreTemplatePlugin) {
      // could not find core templates plugin
      return;
    }

    this.register(
      around(coreTemplatePlugin.instance.constructor.prototype, {
        insertTemplate(old: () => void) {
          return async function (templateFile: TFile) {
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (!view) {
              return;
            }

            const oldSelections = view.editor.listSelections();
            await old.call(this, templateFile);
            const newSelections = view.editor.listSelections();

            this.app.workspace.trigger("templates:template-appended", {
              content: this.app.vault.cachedRead(templateFile),
              oldSelections,
              newSelections,
              view,
            });
          };
        },
      })
    );
  }

  private getRelevantFold(
    ctx: MarkdownViewController,
    selection: EditorSelection
  ): FoldRange | null {
    const editor = ctx.editor;
    if (!editor) return null;

    const allFolds = editor.getAllFoldableLines().map((r) => ({
      from: editor.offsetToPos(r.from).line,
      to: editor.offsetToPos(r.to).line,
    }));

    for (let i = allFolds.length - 1; i >= 0; i--) {
      const fold = allFolds[i];
      if (fold.from <= selection.anchor.line && selection.anchor.line <= fold.to) {
        return fold;
      }
    }

    return null;
  }

  onEditorMenu(menu: Menu, _editor: Editor, info: MarkdownView | MarkdownFileInfo): void {
    const ctx = info as MarkdownViewController;
    if (!ctx.editor || !ctx.editor.getSelection()) {
      return;
    }

    menu.addItem((item) =>
      item
        .setTitle("Toggle crease")
        .setIcon("shirt")
        .onClick(() => {
          this.toggleCrease(ctx);
        })
    );
  }

  toggleCrease(ctx: MarkdownViewController): void {
    const editor = ctx.editor;
    if (!editor) return;
    const selections = editor.listSelections();

    selections.forEach((selection) => {
      const currentFold = this.getRelevantFold(ctx, selection);
      if (!currentFold) {
        return;
      }

      const lineNum = currentFold.from;
      const line = editor.getLine(lineNum);

      if (hasCrease(line)) {
        const from = { line: lineNum, ch: 0 };
        const to = { line: lineNum, ch: this.getFoldTargetPosition(line) };
        const lineWithoutCrease = line.replace(CREASE_REGEX, "").trimEnd();
        editor.replaceRange(lineWithoutCrease, from, to);
      } else {
        const foldTargetPosition = this.getFoldTargetPosition(line);
        const from = { line: lineNum, ch: foldTargetPosition };
        const to = { line: lineNum, ch: foldTargetPosition };
        editor.replaceRange(" %% fold %% ", from, to);
      }
    });
  }

  private getFoldTargetPosition(line: string): number {
    let pos = line.length;
    const blockIdExp = BLOCK_ID_REGEX.exec(line);
    if (blockIdExp) {
      pos = blockIdExp.index - 1;
    }
    return pos;
  }

  private async getCreasesFromFile(file: TFile): Promise<FoldRange[]> {
    const fileContents = await this.app.vault.cachedRead(file);
    const fileLines = fileContents.split("\n");
    const foldPositions: FoldRange[] = [];
    for (let lineNum = 0; lineNum <= fileLines.length; lineNum++) {
      const line = fileLines[lineNum];
      if (hasCrease(line)) {
        foldPositions.push({
          from: lineNum,
          to: lineNum + 1,
        });
      }
    }
    return foldPositions;
  }

  private getCreasesFromEditor(editor: Editor): FoldRange[] {
    const foldPositions: FoldRange[] = [];
    for (let lineNum = 0; lineNum <= editor.lastLine(); lineNum++) {
      const line = editor.getLine(lineNum);
      if (hasCrease(line)) {
        foldPositions.push({
          from: lineNum,
          to: lineNum + 1,
        });
      }
    }
    return foldPositions;
  }

  async foldCreasesForView(ctx: MarkdownViewController): Promise<void> {
    if (!ctx.editor) return;
    const existingFolds = ctx.editMode.getFoldInfo();

    const foldPositions = [
      ...(existingFolds?.folds ?? []),
      ...this.getCreasesFromEditor(ctx.editor),
    ];

    ctx.editMode.applyFoldInfo({
      folds: foldPositions,
      lines: ctx.editor.lineCount(),
    });
  }

  async foldCreasesForFile(file: TFile): Promise<void> {
    const fileContent = await this.app.vault.cachedRead(file);
    const existingFolds = await this.app.foldManager.load(file);

    const foldPositions = [
      ...(existingFolds?.folds ?? []),
      ...(await this.getCreasesFromFile(file)),
    ];

    const foldInfo = {
      folds: foldPositions,
      lines: fileContent.match(/^/gm)?.length ?? 0,
    };

    const openCtx = this.app.workspace
      .getLeavesOfType("markdown")
      .map((leaf) => leaf.view)
      .find(
        (view): view is MarkdownView =>
          view instanceof MarkdownView && view.file === file
      );

    if (openCtx) {
      openCtx.currentMode.applyFoldInfo(foldInfo);
    } else {
      await this.app.foldManager.save(file, foldInfo);
    }
  }

  toggleFoldForHeadingLevel(ctx: MarkdownViewController, level: number): void {
    if (!ctx.editor || !ctx.file) return;
    const existingFolds = ctx.editMode.getFoldInfo()?.folds ?? [];

    const headingsAtLevel = (
      this.app.metadataCache.getFileCache(ctx.file)?.headings ?? []
    ).filter((heading) => heading.level === level);

    const headingLineNums = new Set(headingsAtLevel.map((h) => h.position.start.line));
    const firstHeadingLine = headingsAtLevel[0].position.start.line;

    if (existingFolds.find((fold) => fold.from === firstHeadingLine)) {
      ctx.editMode.applyFoldInfo({
        folds: existingFolds.filter((fold) => !headingLineNums.has(fold.from)),
        lines: ctx.editor.lineCount(),
      });
    } else {
      ctx.editMode.applyFoldInfo({
        folds: [
          ...existingFolds,
          ...headingsAtLevel.map((headingInfo) => ({
            from: headingInfo.position.start.line,
            to: headingInfo.position.start.line + 1,
          })),
        ],
        lines: ctx.editor.lineCount(),
      });
    }
    ctx.onMarkdownFold();
  }

  creaseCurrentFolds(ctx: MarkdownViewController): void {
    const editor = ctx.editor;
    if (!editor) return;
    const existingFoldInfo = ctx.editMode.getFoldInfo();
    const existingFolds = existingFoldInfo?.folds ?? [];

    const changes: EditorChange[] = [];
    existingFolds.forEach((fold) => {
      const line = editor.getLine(fold.from);
      if (!hasCrease(line)) {
        const endOfLinePos = { line: fold.from, ch: this.getFoldTargetPosition(line) };
        changes.push({
          text: " %% fold %%",
          from: endOfLinePos,
          to: endOfLinePos,
        });
      }
    });
    editor.transaction({ changes });

    if (existingFoldInfo) {
      ctx.editMode.applyFoldInfo(existingFoldInfo);
    }
  }

  clearCreases(ctx: MarkdownViewController): void {
    const editor = ctx.editor;
    if (!editor) return;

    const changes: EditorChange[] = [];
    for (let lineNum = 0; lineNum < editor.lineCount(); lineNum++) {
      const line = editor.getLine(lineNum);
      if (hasCrease(line)) {
        changes.push({
          text: line.replace(CREASE_REGEX, ""),
          from: { line: lineNum, ch: 0 },
          to: { line: lineNum, ch: line.length },
        });
      }
    }
    editor.transaction({ changes });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
