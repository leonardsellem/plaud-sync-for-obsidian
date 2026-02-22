export const PLAUD_TOKEN_SECRET_KEY = 'plaud-sync.token';
const PLAUD_TOKEN_FALLBACK_KEY = 'plaud-sync.token.fallback';

type SecretCapableHost = {
	getSecret?: (key: string) => Promise<string | null>;
	setSecret?: (key: string, value: string) => Promise<void>;
	deleteSecret?: (key: string) => Promise<void>;
};

type LocalStorageCapableHost = {
	loadLocalStorage?: (key: string) => unknown;
	saveLocalStorage?: (key: string, data: unknown) => void;
};

export type SecretStoreHost = SecretCapableHost & LocalStorageCapableHost;

function normalizeToken(value: unknown): string | null {
	if (typeof value !== 'string') {
		return null;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function hasSecretApi(host: SecretStoreHost): host is Required<Pick<SecretStoreHost, 'getSecret' | 'setSecret' | 'deleteSecret'>> {
	return typeof host.getSecret === 'function'
		&& typeof host.setSecret === 'function'
		&& typeof host.deleteSecret === 'function';
}

function hasLocalStorageApi(host: SecretStoreHost): host is Required<Pick<SecretStoreHost, 'loadLocalStorage' | 'saveLocalStorage'>> {
	return typeof host.loadLocalStorage === 'function' && typeof host.saveLocalStorage === 'function';
}

export async function getPlaudToken(host: SecretStoreHost): Promise<string | null> {
	if (hasSecretApi(host)) {
		return normalizeToken(await host.getSecret(PLAUD_TOKEN_SECRET_KEY));
	}

	if (hasLocalStorageApi(host)) {
		return normalizeToken(host.loadLocalStorage(PLAUD_TOKEN_FALLBACK_KEY));
	}

	return null;
}

export async function setPlaudToken(host: SecretStoreHost, token: string): Promise<void> {
	const normalizedToken = normalizeToken(token);
	if (!normalizedToken) {
		throw new Error('Plaud token cannot be empty. Paste a valid token string.');
	}

	if (hasSecretApi(host)) {
		await host.setSecret(PLAUD_TOKEN_SECRET_KEY, normalizedToken);
		return;
	}

	if (hasLocalStorageApi(host)) {
		host.saveLocalStorage(PLAUD_TOKEN_FALLBACK_KEY, normalizedToken);
		return;
	}

	throw new Error('No secret storage API is available in this Obsidian runtime.');
}

export async function clearPlaudToken(host: SecretStoreHost): Promise<void> {
	if (hasSecretApi(host)) {
		await host.deleteSecret(PLAUD_TOKEN_SECRET_KEY);
		return;
	}

	if (hasLocalStorageApi(host)) {
		host.saveLocalStorage(PLAUD_TOKEN_FALLBACK_KEY, null);
	}
}
