import sortBy from "lodash/sortBy";
import {
  Editor,
  EditorChange,
  EditorSelection,
  FoldPosition,
  HeadingCache,
  MarkdownView,
  Menu,
  OutlineView,
  Plugin,
  stripHeading,
  TemplaterAppendedEvent,
  TemplaterNewNoteEvent,
  TFile,
} from "obsidian";
import { foldable } from "@codemirror/language";
import { around } from "monkey-around";
import { creasePlugin } from "./creaseWidget";
import { hasFold } from "./utils";

const headingLevels = [1, 2, 3, 4, 5, 6];

export default class CreasesPlugin extends Plugin {
  async onload(): Promise<void> {
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

    this.app.workspace.onLayoutReady(() => {
      this.patchCoreTemplatePlugin();
      this.patchFileSuggest();
      this.patchCoreOutlinePlugin();
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

    this.registerEvent(this.app.workspace.on("editor-menu", this.onEditorMenu, this));
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

  patchCoreTemplatePlugin() {
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

  patchCoreOutlinePlugin() {
    const leaf = this.app.workspace.getLeaf();
    let outlineView: OutlineView | undefined = undefined;
    try {
      outlineView = this.app.viewRegistry.viewByType["outline"](leaf) as OutlineView;
    } catch (e) {
      // Outline plugin not enabled
      return;
    }

    this.register(
      around(outlineView.constructor.prototype, {
        getHeadings(old: () => HeadingCache[]) {
          return function () {
            const rawHeadings = old.call(this);
            if (!rawHeadings) {
              return null;
            }

            return rawHeadings.map((h) => ({
              ...h,
              heading: stripHeading(h.heading.replace("%% fold %%", "")),
            }));
          };
        },
      })
    );
  }

  patchFileSuggest() {
    const suggests = this.app.workspace.editorSuggest.suggests;
    const fileSuggest = suggests.find((s) => (s as any).mode !== undefined);
    if (!fileSuggest) {
      return;
    }

    this.register(
      around(fileSuggest.constructor.prototype, {
        getGlobalBlockSuggestions(old: () => any[]) {
          return async function (...args: any[]) {
            const blocks = await old.call(this, ...args);
            if (!blocks) {
              return null;
            }
            return blocks.map((b: any) => {
              if (b.node.type !== "heading") {
                return b;
              }
              return {
                ...b,
                display: stripHeading(
                  b.node.data.hProperties.dataHeading.replace("%% fold %%", "")
                ),
              };
            });
          };
        },
        getGlobalHeadingSuggestions(old: () => HeadingCache[]) {
          return async function (...args: any[]) {
            const headings = await old.call(this, ...args);
            if (!headings) {
              return null;
            }
            return headings.map((h: HeadingCache) => ({
              ...h,
              heading: stripHeading(h.heading.replace("%% fold %%", "")),
            }));
          };
        },

        getHeadingSuggestions(old: () => HeadingCache[]) {
          return async function (...args: any[]) {
            const headings = await old.call(this, ...args);
            if (!headings) {
              return null;
            }
            return headings.map((h: HeadingCache) => ({
              ...h,
              heading: stripHeading(h.heading.replace("%% fold %%", "")),
            }));
          };
        },
      })
    );
  }

  getAllFoldableLines(editor: Editor): FoldPosition[] {
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

  getRelevantFold(editor: Editor, selection: EditorSelection): FoldPosition | null {
    const allFolds = this.getAllFoldableLines(editor);

    for (let i = allFolds.length - 1; i >= 0; i--) {
      const fold = allFolds[i];
      if (fold.from <= selection.anchor.line && selection.anchor.line <= fold.to) {
        return fold;
      }
    }

    return null;
  }

  async onTemplaterNewFile(evt: TemplaterNewNoteEvent) {
    const { file, contents } = evt;
    if (hasFold(contents)) {
      this.foldCreasesForFile(file);
    }
  }

  async onTemplateAppend(evt: TemplaterAppendedEvent) {
    const { view, newSelections, oldSelections } = evt;
    const foldPositions: FoldPosition[] = [];
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
      if (hasFold(content)) {
        for (let lineNum = start.line; lineNum <= end.line; lineNum++) {
          const line = view.editor.getLine(lineNum);
          if (hasFold(line)) {
            foldPositions.push({
              from: lineNum,
              to: lineNum + 1,
            });
          }
        }
      }
    }

    view.currentMode.applyFoldInfo({
      folds: foldPositions,
      lines: view.editor.lineCount(),
    });
  }

  onEditorMenu(menu: Menu, editor: Editor, view: MarkdownView) {
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

      if (hasFold(line)) {
        // Remove crease
        const from = { line: lineNum, ch: 0 };
        const to = { line: lineNum, ch: line.length };
        const lineWithoutCrease = line.replace("%% fold %%", "").trimEnd();
        editor.replaceRange(lineWithoutCrease, from, to);
      } else {
        // Add Crease
        const from = { line: lineNum, ch: line.length };
        const to = { line: lineNum, ch: line.length };
        editor.replaceRange(" %% fold %%", from, to);
      }
    });
  }

  private async getCreasesFromFile(file: TFile): Promise<FoldPosition[]> {
    const fileContents = await this.app.vault.cachedRead(file);
    const fileLines = fileContents.split("\n");
    const foldPositions: FoldPosition[] = [];
    for (let lineNum = 0; lineNum <= fileLines.length; lineNum++) {
      const line = fileLines[lineNum];
      if (hasFold(line)) {
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
      if (hasFold(line)) {
        foldPositions.push({
          from: lineNum,
          to: lineNum + 1,
        });
      }
    }
    return foldPositions;
  }

  async foldCreasesForView(view: MarkdownView) {
    const file = view.file;
    const existingFolds = await this.app.foldManager.load(file);

    const foldPositions = [
      ...(existingFolds?.folds ?? []),
      ...this.getCreasesFromEditor(view.editor),
    ];

    view.currentMode.applyFoldInfo({
      folds: foldPositions,
      lines: view.editor.lineCount(),
    });
  }

  async foldCreasesForFile(file: TFile) {
    const existingFolds = await this.app.foldManager.load(file);

    const foldPositions = [
      ...(existingFolds?.folds ?? []),
      ...(await this.getCreasesFromFile(file)),
    ];

    await this.app.foldManager.save(file, foldPositions);
  }

  async toggleFoldForHeadingLevel(view: MarkdownView, level: number): Promise<void> {
    const existingFolds = (await this.app.foldManager.load(view.file))?.folds ?? [];

    const headingsAtLevel = (
      this.app.metadataCache.getFileCache(view.file).headings || []
    ).filter((heading) => heading.level === level);
    const headingLineNums = new Set(headingsAtLevel.map((h) => h.position.start.line));
    const firstHeadingPos = headingsAtLevel[0].position.start;

    // First heading at level is folded, unfold all headings at level
    if (existingFolds.find((fold) => fold.from === firstHeadingPos.line)) {
      view.currentMode.applyFoldInfo({
        folds: existingFolds.filter((fold) => !headingLineNums.has(fold.from)),
        lines: view.editor.lineCount(),
      });
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
    }
  }

  async creaseCurrentFolds(editor: Editor, view: MarkdownView) {
    const existingFolds = await this.app.foldManager.load(view.file);

    const changes: EditorChange[] = [];
    (existingFolds?.folds ?? []).forEach((fold) => {
      const line = editor.getLine(fold.from);
      if (!hasFold(line)) {
        const endOfLinePos = { line: fold.from, ch: line.length };
        changes.push({
          text: " %% fold %%",
          from: endOfLinePos,
          to: endOfLinePos,
        });
      }
    });
    editor.transaction({ changes });
  }

  clearCreases(editor: Editor, _view: MarkdownView) {
    const changes: EditorChange[] = [];
    for (let lineNum = 0; lineNum < editor.lastLine(); lineNum++) {
      const line = editor.getLine(lineNum);
      if (hasFold(line)) {
        const lineWithoutCrease = line.replace("%% fold %%", "").trimEnd();
        editor.setLine(lineNum, lineWithoutCrease);
        changes.push({
          text: lineWithoutCrease,
          from: { line: lineNum, ch: 0 },
          to: { line: lineNum + 1, ch: 0 },
        });
      }
    }
    editor.transaction({ changes });
  }
}
