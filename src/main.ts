import sortBy from "lodash/sortBy";
import {
  Editor,
  EditorChange,
  EditorSelection,
  EventRef,
  FoldPosition,
  MarkdownView,
  Menu,
  Plugin,
  TAbstractFile,
  TemplaterAppendedEvent,
  TemplaterNewNoteEvent,
  TFile,
} from "obsidian";
import { foldable } from "@codemirror/language";
import { around } from "monkey-around";

import { creasePlugin } from "./creaseWidget";
import { CREASE_REGEX, hasCrease } from "./utils";
import { CreasesSettings, CreasesSettingTab, DEFAULT_SETTINGS } from "./settings";

const headingLevels = [1, 2, 3, 4, 5, 6];

const BLOCK_ID_REGEX = /\^([a-zA-Z0-9-]+)$/;

export default class CreasesPlugin extends Plugin {
  public settings: CreasesSettings;
  private onFileOpenListener: EventRef;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerSettingsTab();
    this.registerEditorExtension(creasePlugin(this.app));
    this.addCommand({
      id: "fold",
      name: "Fold along creases",
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (checking) {
          return !!view;
        }
        if (view) {
          this.foldCreasesForView(view);
        }
      },
    });

    this.addCommand({
      id: "toggle-crease",
      name: "Toggle crease",
      editorCallback: this.toggleCrease.bind(this),
    });

    this.addCommand({
      id: "crease-current-folds",
      name: "Crease the current folds",
      editorCallback: this.creaseCurrentFolds.bind(this),
    });

    this.addCommand({
      id: "clear-creases",
      name: "Iron out (clear) the creases",
      editorCallback: this.clearCreases.bind(this),
    });

    this.addCommand({
      id: "increase-fold-level",
      name: "Increase heading fold level",
      editorCallback: this.increaseHeadingFoldLevel.bind(this),
    });

    this.addCommand({
      id: "decrease-fold-level",
      name: "Decrease heading fold level",
      editorCallback: this.decreaseHeadingFoldLevel.bind(this),
    });

    this.app.workspace.onLayoutReady(() => {
      // this.patchCoreOutlinePlugin();
      this.registerEvent(this.app.vault.on("create", this.onNewFile.bind(this)));
      this.patchCoreTemplatePlugin();
    });

    headingLevels.forEach((level) => {
      this.addCommand({
        id: `toggle-fold-heading-level-${level}`,
        name: `Toggle fold for H${level}`,
        checkCallback: (checking) => {
          const view = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (!view) {
            return false;
          }

          if (checking) {
            const headings =
              this.app.metadataCache.getFileCache(view.file)?.headings ?? [];
            return headings.find((h) => h.level === level) !== undefined;
          }

          this.toggleFoldForHeadingLevel(view, level);
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
      ["start-folded", "fold-and-clear"].contains(this.settings.templateCreasesBehavior)
    ) {
      const { view, newSelections, oldSelections } = evt;
      const foldPositions: FoldPosition[] = [];
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

        if (hasCrease(content)) {
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
      }

      view.currentMode.applyFoldInfo({
        folds: foldPositions,
        lines: view.editor.lineCount(),
      });
      view.editor.transaction({ changes });
    }
  }

  async decreaseHeadingFoldLevel(_editor: Editor, view: MarkdownView) {
    const foldInfo = view.currentMode.getFoldInfo();
    const existingFolds = foldInfo?.folds ?? [];

    const headings = this.app.metadataCache.getFileCache(view.file)?.headings ?? [];

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

    view.currentMode.applyFoldInfo({
      folds,
      lines: view.editor.lineCount(),
    });
    view.onMarkdownFold();
  }

  async increaseHeadingFoldLevel(_editor: Editor, view: MarkdownView) {
    const foldInfo = view.currentMode.getFoldInfo();
    const existingFolds = foldInfo?.folds ?? [];

    const headings = this.app.metadataCache.getFileCache(view.file)?.headings ?? [];

    let maxFoldLevel = Math.max(...headings.map((h) => h.level));
    for (const heading of headings) {
      if (existingFolds.find((f) => f.from === heading.position.start.line)) {
        maxFoldLevel = Math.min(maxFoldLevel, heading.level);
      }
    }

    // Remove any folds with a fold level < maxFoldLevel
    const excludedHeadingPositions = new Set(
      headings.filter((h) => h.level <= maxFoldLevel).map((h) => h.position.start.line)
    );
    const folds = existingFolds.filter(
      (fold) => !excludedHeadingPositions.has(fold.from)
    );

    view.currentMode.applyFoldInfo({
      folds,
      lines: view.editor.lineCount(),
    });
    view.onMarkdownFold();
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

  private getAllFoldableLines(editor: Editor): FoldPosition[] {
    if (this.app.vault.getConfig("legacyEditor")) {
      const foldOpts = editor.cm.state.foldGutter.options;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getFoldRegion = (editor.cm as any).foldOption(foldOpts, "rangeFinder");

      const foldPositions: FoldPosition[] = [];
      for (let lineNum = 0; lineNum <= editor.lastLine(); lineNum++) {
        const foldRegion = getFoldRegion(editor.cm, CodeMirror.Pos(lineNum, 0));
        if (foldRegion) {
          foldPositions.push({
            from: foldRegion.from.line,
            to: foldRegion.to.line,
          });
        }
      }
      return foldPositions;
    }

    const foldPositions: FoldPosition[] = [];
    for (let lineNum = 0; lineNum <= editor.lastLine(); lineNum++) {
      const linePos = editor.posToOffset({ line: lineNum, ch: 0 });
      const foldRegion = foldable(editor.cm.state, linePos, linePos);
      if (foldRegion) {
        const foldStartPos = editor.offsetToPos(foldRegion.from);
        const foldEndPos = editor.offsetToPos(foldRegion.to);
        foldPositions.push({
          from: foldStartPos.line,
          to: foldEndPos.line,
        });
      }
    }
    return foldPositions;
  }

  private getRelevantFold(
    editor: Editor,
    selection: EditorSelection
  ): FoldPosition | null {
    const allFolds = this.getAllFoldableLines(editor);

    for (let i = allFolds.length - 1; i >= 0; i--) {
      const fold = allFolds[i];
      if (fold.from <= selection.anchor.line && selection.anchor.line <= fold.to) {
        return fold;
      }
    }

    return null;
  }

  onEditorMenu(menu: Menu, editor: Editor, view: MarkdownView): void {
    if (!editor.getSelection()) {
      return;
    }

    menu.addItem((item) =>
      item
        .setTitle("Toggle crease")
        .setIcon("shirt")
        .onClick(() => {
          this.toggleCrease(editor, view);
        })
    );
  }

  toggleCrease(editor: Editor, _view: MarkdownView): void {
    const selections = editor.listSelections();

    selections.forEach((selection) => {
      const currentFold = this.getRelevantFold(editor, selection);
      if (!currentFold) {
        return;
      }

      const lineNum = currentFold.from;
      const line = editor.getLine(lineNum);

      if (hasCrease(line)) {
        // Remove crease
        const from = { line: lineNum, ch: 0 };
        const to = { line: lineNum, ch: this.getFoldTargetPosition(line) };
        const lineWithoutCrease = line.replace(CREASE_REGEX, "").trimEnd();
        editor.replaceRange(lineWithoutCrease, from, to);
      } else {
        // Add Crease
        const  foldTargetPosition = this.getFoldTargetPosition(line)
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

  private async getCreasesFromFile(file: TFile): Promise<FoldPosition[]> {
    const fileContents = await this.app.vault.cachedRead(file);
    const fileLines = fileContents.split("\n");
    const foldPositions: FoldPosition[] = [];
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

  private getCreasesFromEditor(editor: Editor): FoldPosition[] {
    const foldPositions: FoldPosition[] = [];
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

  async foldCreasesForView(view: MarkdownView): Promise<void> {
    const existingFolds = view.currentMode.getFoldInfo();

    const foldPositions = [
      ...(existingFolds?.folds ?? []),
      ...this.getCreasesFromEditor(view.editor),
    ];

    view.currentMode.applyFoldInfo({
      folds: foldPositions,
      lines: view.editor.lineCount(),
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

    // Check if the file is open in any editors
    const leaves = this.app.workspace
      .getLeavesOfType("markdown")
      .filter(
        (leaf) =>
          leaf.view && leaf.view instanceof MarkdownView && leaf.view.file === file
      );

    if (leaves.length) {
      (leaves[0].view as MarkdownView).currentMode.applyFoldInfo(foldInfo);
    } else {
      await this.app.foldManager.save(file, foldInfo);
    }
  }

  toggleFoldForHeadingLevel(view: MarkdownView, level: number): void {
    const existingFolds = view.currentMode.getFoldInfo()?.folds ?? [];

    const headingsAtLevel = (
      this.app.metadataCache.getFileCache(view.file)?.headings || []
    ).filter((heading) => heading.level === level);
    const headingLineNums = new Set(headingsAtLevel.map((h) => h.position.start.line));
    const firstHeadingPos = headingsAtLevel[0].position.start;

    // First heading at level is folded, unfold all headings at level
    if (existingFolds.find((fold) => fold.from === firstHeadingPos.line)) {
      view.currentMode.applyFoldInfo({
        folds: existingFolds.filter((fold) => !headingLineNums.has(fold.from)),
        lines: view.editor.lineCount(),
      });
      view.onMarkdownFold();
    } else {
      const foldPositions = [
        ...existingFolds,
        ...headingsAtLevel.map((headingInfo) => ({
          from: headingInfo.position.start.line,
          to: headingInfo.position.start.line + 1,
        })),
      ];

      view.currentMode.applyFoldInfo({
        folds: foldPositions,
        lines: view.editor.lineCount(),
      });
      view.onMarkdownFold();
    }
  }

  creaseCurrentFolds(editor: Editor, view: MarkdownView): void {
    const existingFolds = view.currentMode.getFoldInfo();

    const changes: EditorChange[] = [];
    (existingFolds?.folds ?? []).forEach((fold) => {
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
  }

  clearCreases(editor: Editor, _view: MarkdownView): void {
    const changes: EditorChange[] = [];
    for (let lineNum = 0; lineNum < editor.lastLine(); lineNum++) {
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

  registerSettingsTab() {
    this.addSettingTab(new CreasesSettingTab(this.app, this));
  }
}
