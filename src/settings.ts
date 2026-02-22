import {App, Notice, PluginSettingTab, Setting} from 'obsidian';
import type PlaudSyncPlugin from './main';
import {clearPlaudToken, getPlaudToken, setPlaudToken} from './secret-store';
import {DEFAULT_SETTINGS} from './settings-schema';

export class PlaudSettingTab extends PluginSettingTab {
	plugin: PlaudSyncPlugin;

	constructor(app: App, plugin: PlaudSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		const tokenStatusSetting = new Setting(containerEl)
			.setName('Plaud token status')
			.setDesc('Checking token status...');

		new Setting(containerEl)
			.setName('Plaud token')
			.setDesc('Stored in Obsidian secret storage when available.')
			.addText((text) => {
				text.inputEl.type = 'password';
				text.setPlaceholder('Paste plaud token');

				void getPlaudToken(this.app).then((token) => {
					text.setValue(token ?? '');
				});

				text.onChange(async (value) => {
					const token = value.trim();
					if (!token) {
						await clearPlaudToken(this.app);
						await this.refreshTokenStatus(tokenStatusSetting);
						new Notice('Plaud token cleared. Paste a token to enable API sync.');
						return;
					}

					try {
						await setPlaudToken(this.app, token);
						await this.refreshTokenStatus(tokenStatusSetting);
						new Notice('Plaud token saved.');
					} catch (error) {
						const message = error instanceof Error ? error.message : 'Failed to save Plaud token.';
						new Notice(message);
					}
				});
			});

		void this.refreshTokenStatus(tokenStatusSetting);

		new Setting(containerEl)
			.setName('API domain')
			.setDesc('Base endpoint for plaud requests.')
			.addText((text) => text
				.setPlaceholder(DEFAULT_SETTINGS.apiDomain)
				.setValue(this.plugin.settings.apiDomain)
				.onChange(async (value) => {
					this.plugin.settings.apiDomain = value.trim() || DEFAULT_SETTINGS.apiDomain;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Sync folder')
			.setDesc('Store synced notes in this folder.')
			.addText((text) => text
				.setPlaceholder('Plaud')
				.setValue(this.plugin.settings.syncFolder)
				.onChange(async (value) => {
					this.plugin.settings.syncFolder = value.trim() || DEFAULT_SETTINGS.syncFolder;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Sync on startup')
			.setDesc('Run a sync automatically when Obsidian starts.')
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.syncOnStartup)
				.onChange(async (value) => {
					this.plugin.settings.syncOnStartup = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Update existing notes')
			.setDesc('Update existing files when matching plaud recordings are found.')
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.updateExisting)
				.onChange(async (value) => {
					this.plugin.settings.updateExisting = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Filename pattern')
			.setDesc('Pattern used for new synced files.')
			.addText((text) => text
				.setPlaceholder(DEFAULT_SETTINGS.filenamePattern)
				.setValue(this.plugin.settings.filenamePattern)
				.onChange(async (value) => {
					this.plugin.settings.filenamePattern = value.trim() || DEFAULT_SETTINGS.filenamePattern;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Last sync checkpoint')
			.setDesc('Unix timestamp in milliseconds for incremental sync state.')
			.addText((text) => text
				.setValue(String(this.plugin.settings.lastSyncAtMs))
				.onChange(async (value) => {
					const parsed = Number.parseInt(value, 10);
					this.plugin.settings.lastSyncAtMs = Number.isFinite(parsed) && parsed >= 0
						? parsed
						: DEFAULT_SETTINGS.lastSyncAtMs;
					await this.plugin.saveSettings();
				}));
	}

	private async refreshTokenStatus(statusSetting: Setting): Promise<void> {
		const token = await getPlaudToken(this.app);
		statusSetting.setDesc(
			token
				? 'Plaud token configured. Use Validate token command to confirm access.'
				: 'Plaud token missing. Paste your token above to enable sync.'
		);
	}
}
