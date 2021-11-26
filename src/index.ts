import { Editor, HeadingCache, MarkdownView, Menu, Plugin } from "obsidian";

export default class CreasesPlugin extends Plugin {
  async onload(): Promise<void> {
    this.addCommand({
      id: "refold",
      name: "Refold",
      checkCallback: (checking: boolean) => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (checking) {
          return !!activeView;
        }
        this.foldCreases(activeView);
      },
    });

    this.addCommand({
      id: "add-crease",
      name: "Add Crease",
      editorCallback: (editor: Editor) => {
        this.addCrease(editor);
      },
    });

    this.registerEvent(this.app.workspace.on("editor-menu", this.onEditorMenu, this));
  }

  onEditorMenu(menu: Menu, editor: Editor, view: MarkdownView) {
    if (!editor.getSelection()) {
      return;
    }

    menu.addItem((item) =>
      item.setTitle("Toggle crease").onClick(() => {
        this.addCrease(editor);
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

  addCrease(editor: Editor): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const heading = this.findCurrentHeading(view);
    if (!heading) {
      return;
    }

    const lineNum = heading.position.start.line;
    const line = editor.getLine(lineNum);
    const from = {
      line: lineNum,
      ch: line.length,
    };

    const to = {
      line: lineNum,
      ch: line.length,
    };
    editor.replaceRange(" %% fold %%", from, to);
  }

  async foldCreases(view: MarkdownView) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingFolds = await (this.app as any).foldManager.load(view.file);

    const foldPositions = [
      ...(existingFolds ?? []),
      ...this.app.metadataCache
        .getFileCache(view.file)
        .headings?.filter((headingInfo) => headingInfo.heading.includes("%% fold %%"))
        .map((headingInfo) => ({
          from: headingInfo.position.start.line,
          to: headingInfo.position.start.line + 1,
        })),
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (view.currentMode as any).applyFoldInfo({
      folds: foldPositions,
      lines: view.editor.lineCount(),
    });
  }
}
