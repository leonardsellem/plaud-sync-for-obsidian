export type PlaudApiErrorCategory = 'auth' | 'rate_limit' | 'server' | 'network' | 'invalid_response';

export class PlaudApiError extends Error {
	category: PlaudApiErrorCategory;
	status?: number;
	cause?: unknown;

	constructor(category: PlaudApiErrorCategory, message: string, options?: {status?: number; cause?: unknown}) {
		super(message);
		this.name = 'PlaudApiError';
		this.category = category;
		this.status = options?.status;
		this.cause = options?.cause;
	}
}

export interface PlaudFileSummary {
	id: string;
	file_id?: string;
	is_trash?: boolean;
	start_time?: number;
}

export interface PlaudFileDetail {
	id: string;
	file_id?: string;
	[key: string]: unknown;
}

type PlaudEnvelope<T> = {
	status?: unknown;
	msg?: unknown;
	payload?: T;
	data?: unknown;
	data_file_list?: unknown;
};

export type PlaudRequest = {
	url: string;
	method?: string;
	headers?: Record<string, string>;
	throw?: boolean;
};

export type PlaudRequestResult = {status: number; json: unknown};
export type PlaudRequestFn = (request: PlaudRequest) => Promise<PlaudRequestResult>;

export interface PlaudApiClient {
	listFiles(): Promise<PlaudFileSummary[]>;
	getFileDetail(fileId: string): Promise<PlaudFileDetail>;
}

export interface CreatePlaudApiClientOptions {
	apiDomain: string;
	token: string;
	request: PlaudRequestFn;
}

function normalizeDomain(domain: string): string {
	return domain.trim().replace(/\/+$/, '');
}

function normalizeToken(token: string): string {
	const trimmed = token.trim();
	return trimmed.replace(/^bearer\s+/i, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isSuccessStatus(status: unknown): boolean {
	if (typeof status === 'number') {
		return status === 0 || status === 200;
	}

	if (typeof status === 'string') {
		const normalized = status.trim().toLowerCase();
		return normalized === '0' || normalized === '200' || normalized === 'ok' || normalized === 'success';
	}

	return false;
}

function toErrorMessage(msg: unknown, fallback: string): string {
	return typeof msg === 'string' && msg.trim().length > 0 ? msg : fallback;
}

function extractStatus(error: unknown): number | undefined {
	if (typeof error !== 'object' || error === null) {
		return undefined;
	}

	const maybeStatus = (error as {status?: unknown}).status;
	return typeof maybeStatus === 'number' ? maybeStatus : undefined;
}

function mapStatusCategory(status: number): PlaudApiErrorCategory {
	if (status === 401 || status === 403) {
		return 'auth';
	}
	if (status === 429) {
		return 'rate_limit';
	}
	if (status >= 500) {
		return 'server';
	}
	return 'network';
}

function assertSuccessStatusIfPresent(envelope: PlaudEnvelope<unknown>): void {
	if (!('status' in envelope)) {
		return;
	}

	if (!isSuccessStatus(envelope.status)) {
		throw new PlaudApiError('invalid_response', toErrorMessage(envelope.msg, 'Plaud API returned non-success status.'));
	}
}

async function requestJson(
	request: PlaudRequestFn,
	requestParam: PlaudRequest
): Promise<unknown> {
	let response: PlaudRequestResult;

	try {
		response = await request(requestParam);
	} catch (error) {
		const status = extractStatus(error);
		if (status !== undefined) {
			throw new PlaudApiError(mapStatusCategory(status), `Plaud request failed with HTTP ${status}.`, {status, cause: error});
		}

		throw new PlaudApiError('network', 'Plaud request failed due to network/transport error.', {cause: error});
	}

	if (response.status >= 400) {
		throw new PlaudApiError(mapStatusCategory(response.status), `Plaud request failed with HTTP ${response.status}.`, {
			status: response.status
		});
	}

	return response.json;
}

function extractListPayload(json: unknown): PlaudFileSummary[] {
	if (Array.isArray(json)) {
		return json as PlaudFileSummary[];
	}

	if (!isRecord(json)) {
		throw new PlaudApiError('invalid_response', 'Plaud file list payload is malformed.');
	}

	const envelope = json as PlaudEnvelope<PlaudFileSummary[]>;
	assertSuccessStatusIfPresent(envelope);

	if (Array.isArray(envelope.payload)) {
		return envelope.payload;
	}

	if (Array.isArray(envelope.data_file_list)) {
		return envelope.data_file_list as PlaudFileSummary[];
	}

	if (Array.isArray(envelope.data)) {
		return envelope.data as PlaudFileSummary[];
	}

	throw new PlaudApiError('invalid_response', 'Plaud file list payload must be an array.');
}

function normalizeFileDetail(raw: unknown): PlaudFileDetail {
	if (!isRecord(raw)) {
		throw new PlaudApiError('invalid_response', 'Plaud file detail payload is malformed.');
	}

	const detail: Record<string, unknown> = {...raw};
	const id = typeof detail.id === 'string' ? detail.id.trim() : '';
	const fileId = typeof detail.file_id === 'string' ? detail.file_id.trim() : '';

	if (!id && fileId) {
		detail.id = fileId;
	}
	if (!fileId && typeof detail.id === 'string' && detail.id.trim()) {
		detail.file_id = detail.id.trim();
	}

	if (typeof detail.id !== 'string' || detail.id.trim().length === 0) {
		throw new PlaudApiError('invalid_response', 'Plaud file detail payload is malformed.');
	}

	return detail as PlaudFileDetail;
}

function extractDetailPayload(json: unknown): PlaudFileDetail {
	if (!isRecord(json)) {
		throw new PlaudApiError('invalid_response', 'Plaud file detail payload is malformed.');
	}

	const envelope = json as PlaudEnvelope<PlaudFileDetail>;
	assertSuccessStatusIfPresent(envelope);

	if (isRecord(envelope.payload)) {
		return normalizeFileDetail(envelope.payload);
	}

	if (isRecord(envelope.data)) {
		return normalizeFileDetail(envelope.data);
	}

	return normalizeFileDetail(json);
}

export function createPlaudApiClient(options: CreatePlaudApiClientOptions): PlaudApiClient {
	const request = options.request;
	const apiDomain = normalizeDomain(options.apiDomain);
	const token = normalizeToken(options.token);

	return {
		async listFiles(): Promise<PlaudFileSummary[]> {
			const json = await requestJson(request, {
				url: `${apiDomain}/file/simple/web`,
				method: 'GET',
				headers: {
					Authorization: `Bearer ${token}`
				},
				throw: false
			});

			return extractListPayload(json);
		},

		async getFileDetail(fileId: string): Promise<PlaudFileDetail> {
			const json = await requestJson(request, {
				url: `${apiDomain}/file/detail/${encodeURIComponent(fileId)}`,
				method: 'GET',
				headers: {
					Authorization: `Bearer ${token}`
				},
				throw: false
			});

			return extractDetailPayload(json);
		}
	};
}
