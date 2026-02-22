export interface RetryPolicy {
	maxAttempts: number;
	baseDelayMs: number;
	maxDelayMs: number;
}

export interface RetryTelemetryEvent {
	operation: string;
	attempt: number;
	maxAttempts: number;
	delayMs: number;
	transient: boolean;
	message: string;
	category?: string;
	status?: number;
}

export interface WithRetryOptions {
	policy?: Partial<RetryPolicy>;
	sleep?: (delayMs: number) => Promise<void>;
	onRetry?: (event: RetryTelemetryEvent) => void;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
	maxAttempts: 3,
	baseDelayMs: 300,
	maxDelayMs: 2000
};

function defaultSleep(delayMs: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, delayMs);
	});
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
	if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
		return fallback;
	}

	return Math.floor(value);
}

function resolvePolicy(policy?: Partial<RetryPolicy>): RetryPolicy {
	const maxAttempts = normalizePositiveInteger(policy?.maxAttempts, DEFAULT_RETRY_POLICY.maxAttempts);
	const baseDelayMs = normalizePositiveInteger(policy?.baseDelayMs, DEFAULT_RETRY_POLICY.baseDelayMs);
	const maxDelayMs = normalizePositiveInteger(policy?.maxDelayMs, DEFAULT_RETRY_POLICY.maxDelayMs);

	return {
		maxAttempts,
		baseDelayMs,
		maxDelayMs: Math.max(maxDelayMs, baseDelayMs)
	};
}

function extractMessage(error: unknown): string {
	if (error instanceof Error && error.message.trim().length > 0) {
		return error.message;
	}

	return 'Unknown error.';
}

function extractStatus(error: unknown): number | undefined {
	if (typeof error !== 'object' || error === null) {
		return undefined;
	}

	const maybeStatus = (error as {status?: unknown}).status;
	return typeof maybeStatus === 'number' ? maybeStatus : undefined;
}

function extractCategory(error: unknown): string | undefined {
	if (typeof error !== 'object' || error === null) {
		return undefined;
	}

	const maybeCategory = (error as {category?: unknown}).category;
	return typeof maybeCategory === 'string' ? maybeCategory : undefined;
}

function isTransientError(error: unknown): boolean {
	const category = extractCategory(error);
	return category === 'network' || category === 'rate_limit' || category === 'server';
}

function retryDelayMs(baseDelayMs: number, maxDelayMs: number, attempt: number): number {
	const exponent = Math.max(attempt - 1, 0);
	const expanded = baseDelayMs * Math.pow(2, exponent);
	return Math.min(Math.floor(expanded), maxDelayMs);
}

export function sanitizeTelemetryMessage(message: string): string {
	return message.replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]');
}

export async function withRetry<T>(
	operation: string,
	execute: () => Promise<T>,
	options?: WithRetryOptions
): Promise<T> {
	const policy = resolvePolicy(options?.policy);
	const sleep = options?.sleep ?? defaultSleep;

	let attempt = 1;
	while (true) {
		try {
			return await execute();
		} catch (error) {
			const transient = isTransientError(error);
			if (!transient || attempt >= policy.maxAttempts) {
				throw error;
			}

			const delayMs = retryDelayMs(policy.baseDelayMs, policy.maxDelayMs, attempt);
			options?.onRetry?.({
				operation,
				attempt,
				maxAttempts: policy.maxAttempts,
				delayMs,
				transient,
				message: sanitizeTelemetryMessage(extractMessage(error)),
				category: extractCategory(error),
				status: extractStatus(error)
			});

			await sleep(delayMs);
			attempt += 1;
		}
	}
}
