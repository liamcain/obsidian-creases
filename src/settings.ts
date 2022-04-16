import { App, PluginSettingTab, Setting } from "obsidian";
import CreasesPlugin from "./main";

type TemplateCreasesBehaviorType = "start-folded" | "start-unfolded" | "fold-and-clear";
type OnOpenCreasesBehaviorType = "always-fold" | "preserve-fold-state";
type OutlineSyncType = "from-editor-to-outline" | "bidirectional" | "none";
export interface CreasesSettings {
  onOpenCreasesBehavior: OnOpenCreasesBehaviorType;
  templateCreasesBehavior: TemplateCreasesBehaviorType;
  syncOutlineView: OutlineSyncType;
}

export const DEFAULT_SETTINGS: CreasesSettings = {
  onOpenCreasesBehavior: "preserve-fold-state",
  templateCreasesBehavior: "start-folded",
  syncOutlineView: "from-editor-to-outline",
};

export class CreasesSettingTab extends PluginSettingTab {
  plugin: CreasesPlugin;

  constructor(app: App, plugin: CreasesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h3", {
      text: "Folding",
    });

    new Setting(containerEl)
      .setName("Sync editor folds with outline view")
      .addDropdown((cb) => {
        cb.addOptions({
          "from-editor-to-outline": "From editor to outline",
          bidirectional: "Bidirectionally",
          none: "None",
        });
        cb.setValue(this.plugin.settings.syncOutlineView);
        cb.onChange(async (value) => {
          this.plugin.settings.syncOutlineView = value as OutlineSyncType;
          await this.plugin.saveSettings();
        });
      });

    containerEl.createEl("h3", {
      text: "Crease Behavior",
    });

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
}
