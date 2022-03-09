import {
  Decoration,
  DecorationSet,
  EditorView,
  MatchDecorator,
  PluginField,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { App, editorLivePreviewField, Menu, setIcon } from "obsidian";

class CreaseWidget extends WidgetType {
  constructor(
    readonly app: App,
    readonly view: EditorView,
    readonly from: number,
    readonly to: number
  ) {
    super();
  }

  eq(other: CreaseWidget) {
    return other.view === this.view && other.from === this.from && other.to === this.to;
  }

  toDOM() {
    const creaseEl = createSpan("cm-creases-icon");
    setIcon(creaseEl, "shirt", 12);
    creaseEl.addEventListener("click", (evt) => {
      const menu = new Menu(this.app);
      menu
        .addItem((item) =>
          item
            .setTitle("Remove crease")
            .setIcon("x")
            .onClick(() => {
              this.view.dispatch({
                changes: {
                  from: this.from,
                  to: this.to,
                  insert: "",
                },
              });
            })
        )
        .showAtMouseEvent(evt);
    });
    return creaseEl;
  }

  ignoreEvent() {
    return false;
  }
}

export function creasePlugin(app: App) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet = Decoration.none;
      allDecos: DecorationSet = Decoration.none;
      decorator: MatchDecorator;

      constructor(public view: EditorView) {
        this.decorator = new MatchDecorator({
          regexp: /\B%%\s+fold\s+%%\B/g,
          decoration: this.getDeco.bind(this),
        });
        this.decorations = this.decorator.createDeco(view);
      }

      getDeco(match: RegExpExecArray, _view: EditorView, pos: number) {
        const from = pos;
        const to = pos + match[0].length;
        return Decoration.replace({
          widget: new CreaseWidget(app, this.view, from, to),
        });
      }

      update(update: ViewUpdate) {
        if (!update.state.field(editorLivePreviewField)) {
          this.decorations = Decoration.none;
          return;
        }
        this.decorations = this.decorator.updateDeco(update, this.decorations);
      }
    },
    {
      decorations: (v) => v.decorations,
      provide: PluginField.atomicRanges.from((val) => val.decorations),
    }
  );
}
