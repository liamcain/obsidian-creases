import { App, PluginSettingTab, Setting } from "obsidian";
import CreasesPlugin from "./index";

type OutlineSyncType = "from-editor-to-outline" | "none";
export interface CreasesSettings {
  syncOutlineView: OutlineSyncType;
}

export const DEFAULT_SETTINGS: CreasesSettings = {
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

    new Setting(containerEl)
      .setName("Sync editor folds with outline view")
      .addDropdown((cb) => {
        cb.addOptions({
          "from-editor-to-outline": "From editor to outline",
          none: "None",
        });
        cb.setValue(this.plugin.settings.syncOutlineView);
        cb.onChange(async (value) => {
          this.plugin.settings.syncOutlineView = value as OutlineSyncType;
          await this.plugin.saveSettings();
        });
      });
  }
}
