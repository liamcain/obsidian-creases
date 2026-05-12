import { App, PluginSettingTab, Setting, SettingDefinitionItem } from "obsidian";
import CreasesPlugin from "./main";

type TemplateCreasesBehaviorType = "start-folded" | "start-unfolded" | "fold-and-clear";
type OnOpenCreasesBehaviorType = "always-fold" | "preserve-fold-state";
export interface CreasesSettings {
  onOpenCreasesBehavior: OnOpenCreasesBehaviorType;
  templateCreasesBehavior: TemplateCreasesBehaviorType;
}

export const DEFAULT_SETTINGS: CreasesSettings = {
  onOpenCreasesBehavior: "preserve-fold-state",
  templateCreasesBehavior: "start-folded",
};

export class CreasesSettingTab extends PluginSettingTab<CreasesSettings> {
  plugin: CreasesPlugin;

  constructor(app: App, plugin: CreasesPlugin) {
    super(app, plugin, plugin.settings);
    this.plugin = plugin;
  }

  /**
   * Backwards compatibility for Obsidian <1.12
   */
  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("How should creases behave when opening a new file?")
      .setDesc(
        "By default, creases will not override what content you have folded in your file. You can change this so that creases always start folded."
      )
      .addDropdown((cb) => {
        cb.addOptions({
          "always-fold": "Always fold creases",
          "preserve-fold-state": "Respect existing fold state",
        });
        cb.setValue(this.plugin.settings.onOpenCreasesBehavior);
        cb.onChange(async (value) => {
          this.plugin.settings.onOpenCreasesBehavior = value as OnOpenCreasesBehaviorType;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("How should creases in templates behave?")
      .setDesc(
        "When creating a new file with creases in the template, do you want the creases to start folded or unfolded? Choose 'fold and clear' to have the creases folded and removed from the newly created note."
      )
      .addDropdown((cb) => {
        cb.addOptions({
          "start-folded": "Start folded",
          "start-unfolded": "Start unfolded",
          "fold-and-clear": "Fold them and clear the creases",
        });
        cb.setValue(this.plugin.settings.templateCreasesBehavior);
        cb.onChange(async (value) => {
          this.plugin.settings.templateCreasesBehavior =
            value as TemplateCreasesBehaviorType;
          await this.plugin.saveSettings();
        });
      });
  }

  getSettingDefinitions(): SettingDefinitionItem<keyof CreasesSettings>[] {
    return [
      {
        name: "How should creases behave when opening a new file?",
        desc: "By default, creases will not override what content you have folded in your file. You can change this so that creases always start folded.",
        control: {
          type: "dropdown",
          key: "onOpenCreasesBehavior",
          defaultValue: DEFAULT_SETTINGS.onOpenCreasesBehavior,
          options: {
            "always-fold": "Always fold creases",
            "preserve-fold-state": "Respect existing fold state",
          },
        },
      },
      {
        name: "How should creases in templates behave?",
        desc: "When creating a new file with creases in the template, do you want the creases to start folded or unfolded? Choose 'fold and clear' to have the creases folded and removed from the newly created note.",
        control: {
          type: "dropdown",
          key: "templateCreasesBehavior",
          defaultValue: DEFAULT_SETTINGS.templateCreasesBehavior,
          options: {
            "start-folded": "Start folded",
            "start-unfolded": "Start unfolded",
            "fold-and-clear": "Fold them and clear the creases",
          },
        },
      },
    ];
  }
}
