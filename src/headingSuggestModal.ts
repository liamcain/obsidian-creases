import { App, FuzzyMatch, FuzzySuggestModal, MarkdownView } from "obsidian";

type FoldLevel = 1 | 2 | 3 | 4 | 5 | 6;

export class HeadingLevelSuggestModal extends FuzzySuggestModal<FoldLevel> {
  constructor(app: App) {
    super(app);
  }

  getItemText(item: FoldLevel): string {
    return item.toString();
  }

  getItems(): FoldLevel[] {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const headings = this.app.metadataCache.getFileCache(view.file)?.headings ?? [];

    return Array.from(new Set(headings.map((h) => h.level as FoldLevel))).sort();
  }

  renderSuggestion(matchedHeading: FuzzyMatch<FoldLevel>, el: HTMLElement) {
    const level = matchedHeading.item;
    el.createDiv({ text: `Fold all level ${level}` });
  }

  async onChooseItem(item: FoldLevel, _evt: MouseEvent | KeyboardEvent): Promise<void> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingFolds = await (this.app as any).foldManager.load(view.file);

    const foldPositions = [
      ...(existingFolds?.folds ?? []),
      ...(this.app.metadataCache.getFileCache(view.file).headings || [])
        .filter((headingInfo) => headingInfo.level === item)
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
