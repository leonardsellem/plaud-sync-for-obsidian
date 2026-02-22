export interface NormalizedPlaudDetail {
	id: string;
	fileId: string;
	title: string;
	startAtMs: number;
	durationMs: number;
	summary: string;
	highlights: string[];
	transcript: string;
	raw: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function stripMarkup(value: string): string {
	return value
		.replace(/<[^>]*>/g, ' ')
		.replace(/!\[.*?\]\(.*?\)/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function asNonNegativeNumber(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
		return 0;
	}
	return Math.floor(value);
}

function firstNonEmptyString(values: unknown[]): string {
	for (const value of values) {
		const next = asString(value);
		if (next) {
			return next;
		}
	}
	return '';
}

function extractSummary(detail: Record<string, unknown>): string {
	const directSummary = firstNonEmptyString([
		detail.summary,
		isRecord(detail.ai_content) ? detail.ai_content.summary : undefined,
		isRecord(detail.ai_notes) ? detail.ai_notes.summary : undefined,
		isRecord(detail.ai_notes) ? detail.ai_notes.abstract : undefined
	]);

	if (directSummary) {
		return directSummary;
	}

	const preDownloadList = Array.isArray(detail.pre_download_content_list)
		? detail.pre_download_content_list
		: [];

	for (const item of preDownloadList) {
		if (!isRecord(item)) {
			continue;
		}

		const type = firstNonEmptyString([item.type, item.label, item.name]).toLowerCase();
		if (type.includes('summary') || type.includes('abstract')) {
			const content = firstNonEmptyString([item.content, item.value, item.text]);
			if (content) {
				return content;
			}
		}

		const dataId = firstNonEmptyString([item.data_id]).toLowerCase();
		if (dataId.startsWith('auto_sum:') || dataId.includes('summary')) {
			const content = firstNonEmptyString([item.data_content, item.content, item.value, item.text]);
			const cleaned = stripMarkup(content);
			if (cleaned) {
				return cleaned;
			}
		}
	}

	return '';
}

function normalizeHighlightsArray(values: unknown[]): string[] {
	const normalized: string[] = [];
	for (const value of values) {
		const text = isRecord(value)
			? firstNonEmptyString([value.text, value.value, value.content, value.highlight, value.title])
			: asString(value);
		if (text) {
			normalized.push(text);
		}
	}
	return normalized;
}

function parseHighlightsString(value: string): string[] {
	if (!value) {
		return [];
	}

	try {
		const parsed = JSON.parse(value) as unknown;
		if (Array.isArray(parsed)) {
			return normalizeHighlightsArray(parsed);
		}
	} catch {
		// fallback to line split
	}

	return value
		.split(/\r?\n/)
		.map((line) => line.replace(/^[-*]\s*/, '').trim())
		.filter((line) => line.length > 0);
}

function extractHighlights(detail: Record<string, unknown>): string[] {
	const candidates = [
		detail.highlights,
		isRecord(detail.ai_content) ? detail.ai_content.highlights : undefined,
		isRecord(detail.ai_notes) ? detail.ai_notes.highlights : undefined,
		isRecord(detail.ai_notes) ? detail.ai_notes.key_points : undefined
	];

	for (const candidate of candidates) {
		if (Array.isArray(candidate)) {
			const normalized = normalizeHighlightsArray(candidate);
			if (normalized.length > 0) {
				return normalized;
			}
		}

		if (typeof candidate === 'string') {
			const normalized = parseHighlightsString(candidate.trim());
			if (normalized.length > 0) {
				return normalized;
			}
		}
	}

	const preDownloadList = Array.isArray(detail.pre_download_content_list)
		? detail.pre_download_content_list
		: [];

	for (const item of preDownloadList) {
		if (!isRecord(item)) {
			continue;
		}

		const dataId = firstNonEmptyString([item.data_id]).toLowerCase();
		if (!dataId.startsWith('note:')) {
			continue;
		}

		const content = firstNonEmptyString([item.data_content, item.content, item.value, item.text]);
		if (!content) {
			continue;
		}

		try {
			const parsed = JSON.parse(content) as unknown;
			if (Array.isArray(parsed)) {
				const highlights = normalizeHighlightsArray(parsed);
				if (highlights.length > 0) {
					return highlights;
				}
			}
		} catch {
			const fallback = stripMarkup(content);
			if (fallback) {
				return [fallback];
			}
		}
	}

	return [];
}

function normalizeTranscriptLine(entry: unknown): string {
	if (!isRecord(entry)) {
		return '';
	}

	const speaker = firstNonEmptyString([entry.speaker, entry.speaker_name, entry.name]) || 'Speaker';
	const text = firstNonEmptyString([entry.text, entry.content, entry.value]);
	if (!text) {
		return '';
	}
	return `${speaker}: ${text}`;
}

function extractTranscript(detail: Record<string, unknown>): string {
	const transResult = isRecord(detail.trans_result) ? detail.trans_result : {};
	const directText = firstNonEmptyString([transResult.full_text, detail.full_text, detail.transcript_text]);
	if (directText) {
		return directText;
	}

	const transcriptArrays: unknown[] = [
		transResult.paragraphs,
		transResult.sentences,
		detail.transcript,
		detail.paragraphs
	];

	for (const candidate of transcriptArrays) {
		if (!Array.isArray(candidate)) {
			continue;
		}

		const lines = candidate
			.map((entry) => normalizeTranscriptLine(entry))
			.filter((line) => line.length > 0);

		if (lines.length > 0) {
			return lines.join('\n');
		}
	}

	return '';
}

export function normalizePlaudDetail(raw: unknown): NormalizedPlaudDetail {
	const detail = isRecord(raw) ? raw : {};

	const id = firstNonEmptyString([detail.id, detail.file_id]) || 'unknown';
	const fileId = firstNonEmptyString([detail.file_id, detail.id]) || 'unknown';
	const title = firstNonEmptyString([detail.file_name, detail.filename, detail.title]);

	return {
		id,
		fileId,
		title,
		startAtMs: asNonNegativeNumber(detail.start_time),
		durationMs: asNonNegativeNumber(detail.duration),
		summary: extractSummary(detail),
		highlights: extractHighlights(detail),
		transcript: extractTranscript(detail),
		raw: detail
	};
}
