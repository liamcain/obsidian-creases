import {
  MarkdownPostProcessorContext,
  MarkdownPreviewRenderer,
  MarkdownView,
  Plugin,
} from "obsidian";

function regexIndexOf(text: string, re: RegExp, startPos = 0) {
  const indexInSuffix = text.slice(startPos).search(re);
  return indexInSuffix < 0 ? indexInSuffix : indexInSuffix + startPos;
}

/**
 * Finds the first <li> element within sectionEl that appears after startIndex.
 *
 * Relies on the fact that querySelector traverses depth-first, so I can count
 * the total number of <li> elements then return the nth result from querying
 * the DOM element.
 *
 * @param sectionEl
 * @param htmlStr
 * @param startIndex
 */
function findListEl(
  sectionEl: HTMLElement,
  htmlStr: string,
  startIndex: number
): [HTMLElement, number] {
  const listIdx = regexIndexOf(
    htmlStr,
    /<!--\s*fold\s*-->.*<ul|ol>$/i,
    startIndex
  );

  if (listIdx !== -1) {
    const count = (htmlStr.substring(0, listIdx).match(/<li/g) || []).length;
    return [sectionEl.querySelectorAll("li")[count - 1], listIdx];
  }
  return [null, listIdx];
}

/**
 * Recursively collapses all li elements within a section that have a foldmarker
 * @param sectionEl
 * @param htmlStr
 * @param startIndex
 */
function collapseListElements(
  sectionEl: HTMLElement,
  htmlStr: string,
  startIndex: number
): boolean {
  const [listEl, listElIdx] = findListEl(sectionEl, htmlStr, startIndex);
  if (!listEl) {
    return false;
  }

  listEl.toggleClass("is-collapsed", true);
  collapseListElements(sectionEl, htmlStr, listElIdx + 1);
  return true;
}

export default class FoldMarkerPlugin extends Plugin {
  async onload(): Promise<void> {
    MarkdownPreviewRenderer.registerPostProcessor(
      this.collapseFoldmarkers.bind(this)
    );
  }

  collapseFoldmarkers(
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): void {
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (leaf.view.file.path === (<any>ctx).sourcePath) {
          this.collapseFoldmarkersForView(leaf.view, el);
        }
      }
    });
  }

  collapseFoldmarkersForView(
    markdownView: MarkdownView,
    sectionEl: HTMLElement
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renderer = (<any>markdownView.previewMode).renderer;

    for (const section of renderer.sections) {
      const foldCommentPos = regexIndexOf(section.html, /<!--\s*fold\s*-->/i);
      if (sectionEl === section.el && foldCommentPos !== -1) {
        if (section.html.startsWith("<ul") || section.html.startsWith("<ol")) {
          if (collapseListElements(section.el, section.html, foldCommentPos)) {
            window.getSelection().removeAllRanges();
            section.resetCompute();
          }
        } /* folding heading */ else {
          section.setCollapsed(true);
        }
        renderer.queueRender();
        return;
      }
    }
  }
}
