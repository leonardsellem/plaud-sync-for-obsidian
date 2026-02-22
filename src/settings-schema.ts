export interface PlaudPluginSettings {
	apiDomain: string;
	syncFolder: string;
	syncOnStartup: boolean;
	updateExisting: boolean;
	filenamePattern: string;
	lastSyncAtMs: number;
}

export const DEFAULT_SETTINGS: PlaudPluginSettings = {
	apiDomain: 'https://api.plaud.ai',
	syncFolder: 'Plaud',
	syncOnStartup: true,
	updateExisting: true,
	filenamePattern: 'plaud-{date}-{title}',
	lastSyncAtMs: 0
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function readString(value: unknown, fallback: string): string {
	if (typeof value !== 'string') {
		return fallback;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function readTimestampMs(value: unknown, fallback: number): number {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
		return fallback;
	}

	return Math.floor(value);
}

export function normalizeSettings(raw: unknown): PlaudPluginSettings {
	const persisted = isRecord(raw) ? raw : {};

	return {
		apiDomain: readString(persisted.apiDomain, DEFAULT_SETTINGS.apiDomain),
		syncFolder: readString(persisted.syncFolder, DEFAULT_SETTINGS.syncFolder),
		syncOnStartup: readBoolean(persisted.syncOnStartup, DEFAULT_SETTINGS.syncOnStartup),
		updateExisting: readBoolean(persisted.updateExisting, DEFAULT_SETTINGS.updateExisting),
		filenamePattern: readString(persisted.filenamePattern, DEFAULT_SETTINGS.filenamePattern),
		lastSyncAtMs: readTimestampMs(persisted.lastSyncAtMs, DEFAULT_SETTINGS.lastSyncAtMs)
	};
}

export function toPersistedSettings(settings: PlaudPluginSettings): PlaudPluginSettings {
	return {
		...settings,
		lastSyncAtMs: readTimestampMs(settings.lastSyncAtMs, DEFAULT_SETTINGS.lastSyncAtMs)
	};
}
