import {
  MarkdownPostProcessorContext,
  MarkdownPreviewRenderer,
  MarkdownView,
  Plugin,
} from "obsidian";

export default class FoldMarkerPlugin extends Plugin {
  async onload(): Promise<void> {
    MarkdownPreviewRenderer.registerPostProcessor(
      this.collapseFoldmarkers.bind(this)
    );
  }

  collapseFoldmarkers(el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView) {
        if (leaf.view.file.path === (<any>ctx).sourcePath) {
          this.collapseFoldmarkersForView(leaf.view, el);
        }
      }
    });
  }

  collapseFoldmarkersForView(
    markdownView: MarkdownView,
    sectionEl: HTMLElement
  ) {
    const renderer = (<any>markdownView.previewMode).renderer;

    for (const section of renderer.sections) {
      if (
        sectionEl === section.el &&
        section.html.toLowerCase().indexOf("<!-- fold -->") !== -1
      ) {
        section.setCollapsed(true);
        renderer.queueRender();
        return;
      }
    }
  }
}
