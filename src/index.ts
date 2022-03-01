import {
  Editor,
  HeadingCache,
  MarkdownView,
  Menu,
  Plugin,
  TemplaterAppendedEvent,
  TemplaterNewNoteEvent,
  TFile,
} from "obsidian";
import { creasePlugin } from "./creaseWidget";
import { hasFold } from "./utils";

interface IFoldable {
  view?: MarkdownView;
  file?: TFile;
}

interface IEditorFold {
  from: number;
  to: number;
}

const headingLevels = [1, 2, 3, 4, 5, 6];

export default class CreasesPlugin extends Plugin {
  private asyncFoldQueue: IFoldable[];

  async onload(): Promise<void> {
    this.asyncFoldQueue = [];

    this.registerEditorExtension(creasePlugin(this.app));
    this.addCommand({
      id: "fold",
      name: "Fold along creases",
      editorCallback: (_editor, view) => {
        this.foldCreases({ view });
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
      name: "Iron out the creases",
      editorCallback: this.clearCreases.bind(this),
    });

    headingLevels.forEach((level) => {
      this.addCommand({
        id: `toggle-fold-heading-level-${level}`,
        name: `Toggle fold for H${level}`,
        editorCheckCallback: (checking: boolean, editor: Editor, view: MarkdownView) => {
          if (checking) {
            const headings =
              this.app.metadataCache.getFileCache(view.file)?.headings ?? [];
            return headings.find((h) => h.level === level) !== undefined;
          }
          this.toggleFoldForHeadingLevel(editor, view, level);
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
      this.app.workspace.on("templater:template-appended", this.onTemplaterAppend, this)
    );

    this.registerEvent(
      this.app.metadataCache.on("changed", (changedFile: TFile) => {
        const foldable = this.asyncFoldQueue.filter(
          (f) => f.file === changedFile || f.view?.file === changedFile
        );
        if (foldable.length > 0) {
          this.foldCreases(foldable[0]);
        }
      })
    );
  }

  async onTemplaterNewFile(evt: TemplaterNewNoteEvent) {
    const { file, contents } = evt;
    if (hasFold(contents)) {
      this.asyncFoldQueue.push({ file });
    }
  }

  async onTemplaterAppend(evt: TemplaterAppendedEvent) {
    const { view, newSelections, oldSelections, content } = evt;

    if (hasFold(content)) {
      const foldPositions: IEditorFold[] = [];
      for (let i = oldSelections[0].head.line; i <= newSelections[0].anchor.line; i++) {
        const line = view.editor.getLine(i);
        if (hasFold(line)) {
          foldPositions.push({
            from: i,
            to: i + 1,
          });
        }
      }

      view.currentMode.applyFoldInfo({
        folds: foldPositions,
        lines: view.editor.lineCount(),
      });
    }
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

  findCurrentHeading(view: MarkdownView): HeadingCache | null {
    const editor = view.editor;
    const cursor = editor.getCursor("head");
    const metadata = this.app.metadataCache.getFileCache(view.file);
    if (!metadata.headings) {
      return null;
    }

    return metadata.headings
      .reverse()
      .find((headingInfo) => headingInfo.position.start.line <= cursor.line);
  }

  toggleCrease(editor: Editor, view: MarkdownView): void {
    const heading = this.findCurrentHeading(view);
    if (!heading) {
      return;
    }

    const lineNum = heading.position.start.line;
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
  }

  async foldCreases(foldable: IFoldable) {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

    const file = foldable.view?.file ?? foldable.file;
    const view = activeView.file === file ? activeView : foldable.view;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingFolds = await (this.app as any).foldManager.load(file);

    const foldPositions = [
      ...(existingFolds?.folds ?? []),
      ...(this.app.metadataCache.getFileCache(file).headings || [])
        .filter((headingInfo) => hasFold(headingInfo.heading))
        .map((headingInfo) => ({
          from: headingInfo.position.start.line,
          to: headingInfo.position.start.line + 1,
        })),
    ];

    if (view) {
      view.currentMode.applyFoldInfo({
        folds: foldPositions,
        lines: view.editor.lineCount(),
      });
    } else {
      await this.app.foldManager.save(file, foldPositions);
    }
  }

  async toggleFoldForHeadingLevel(
    _editor: Editor,
    view: MarkdownView,
    level: number
  ): Promise<void> {
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

    (existingFolds?.folds ?? []).forEach((fold: IEditorFold) => {
      const from = { line: fold.from, ch: 0 };
      const line = editor.getLine(fold.from);
      if (!hasFold(line)) {
        editor.setLine(from.line, `${line} %% fold %%`);
      }
    });
  }

  clearCreases(editor: Editor, _view: MarkdownView) {
    for (let lineNum = 0; lineNum < editor.lastLine(); lineNum++) {
      const line = editor.getLine(lineNum);
      if (hasFold(line)) {
        const lineWithoutCrease = line.replace("%% fold %%", "").trimEnd();
        editor.setLine(lineNum, lineWithoutCrease);
      }
    }
  }
}
