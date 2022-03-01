import {
  Editor,
  EditorSelection,
  HeadingCache,
  MarkdownView,
  Menu,
  Plugin,
  TFile,
} from "obsidian";
import { crease } from "./creaseWidget";
import { HeadingLevelSuggestModal } from "./headingSuggestModal";
import { hasFold } from "./utils";

interface IFoldable {
  view?: MarkdownView;
  file?: TFile;
}

interface IEditorFold {
  from: int;
  to: int;
}

export default class CreasesPlugin extends Plugin {
  private asyncFoldQueue: IFoldable[];

  async onload(): Promise<void> {
    this.asyncFoldQueue = [];

    this.registerEditorExtension(crease);
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
      id: "fold-headings-by-level",
      name: "Fold headings by level...",
      editorCallback: this.onFoldHeadingsByLevel.bind(this),
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

    this.registerEvent(this.app.workspace.on("editor-menu", this.onEditorMenu, this));
    this.registerEvent(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.app.workspace as any).on(
        "templater:new-note-from-template",
        this.onTemplaterNewFile,
        this
      )
    );
    this.registerEvent(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.app.workspace as any).on(
        "templater:template-appended",
        this.onTemplaterAppend,
        this
      )
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

  async onTemplaterNewFile(createdFile: TFile, templateContents: string) {
    if (hasFold(templateContents)) {
      this.asyncFoldQueue.push({ file: createdFile });
    }
  }

  async onTemplaterAppend(evt: {
    oldSelections: EditorSelection[];
    newSelections: EditorSelection[];
    view: MarkdownView;
    content: string;
  }) {
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (view.currentMode as any).applyFoldInfo({
        folds: foldPositions,
        lines: view.editor.lineCount(),
      });
    }
  }

  onFoldHeadingsByLevel() {
    new HeadingLevelSuggestModal(this.app).open();
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (view.currentMode as any).applyFoldInfo({
        folds: foldPositions,
        lines: view.editor.lineCount(),
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.app as any).foldManager.save(file, foldPositions);
    }
  }

  async creaseCurrentFolds(editor: Editor, view: MarkdownView) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingFolds = await (this.app as any).foldManager.load(view.file);

    console.log("existingFolds", existingFolds);

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
