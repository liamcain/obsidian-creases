import {
  Decoration,
  DecorationSet,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { SelectionRange } from "@codemirror/state";
import { editorLivePreviewField, setIcon } from "obsidian";

interface CreaseDecoration extends Decoration {
  widget: CreaseWidget;
}

class CreaseWidget extends WidgetType {
  constructor(readonly from: number, readonly to: number) {
    super();
  }

  eq(other: CreaseWidget) {
    return other.from === this.from && other.to === this.to;
  }

  toDOM() {
    const creaseEl = createSpan("cm-creases-icon");
    setIcon(creaseEl, "shirt", 12);
    return creaseEl;
  }

  ignoreEvent() {
    return false;
  }
}

const rangesInclude = (ranges: readonly SelectionRange[], from: number, to: number) => {
  for (const range of ranges) {
    const { from: rFrom, to: rTo } = range;
    if (rFrom >= from && rFrom <= to) return true;
    if (rTo >= from && rTo <= to) return true;
    if (rFrom < from && rTo > to) return true;
  }
  return false;
};

export function creasePlugin() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet = Decoration.none;
      allDecos: DecorationSet = Decoration.none;
      decorator: MatchDecorator;

      constructor(public view: EditorView) {
        this.decorator = new MatchDecorator({
          regexp: /%%\s+fold\s+%%/g,
          decoration: this.getDeco.bind(this),
        });
        this.allDecos = this.decorator.createDeco(view);
        this.decorations = this.allDecos;
      }

      getDeco(match: RegExpExecArray, _view: EditorView, pos: number) {
        const from = pos;
        const to = pos + match[0].length;
        return Decoration.replace({
          inclusive: true,
          widget: new CreaseWidget(from, to),
        });
      }

      update(update: ViewUpdate) {
        if (!update.state.field(editorLivePreviewField)) {
          this.decorations = Decoration.none;
          return;
        }

        this.allDecos = this.decorator.updateDeco(update, this.allDecos);
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = this.allDecos.update({
            filter: (_, __, decoration) => {
              return !rangesInclude(
                update.state.selection.ranges,
                (decoration as CreaseDecoration).widget.from,
                (decoration as CreaseDecoration).widget.to
              );
            },
          });
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
}

export const crease = creasePlugin();
