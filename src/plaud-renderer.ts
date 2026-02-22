import type {NormalizedPlaudDetail} from './plaud-normalizer';

function formatDate(timestampMs: number): string {
	if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
		return '1970-01-01';
	}
	return new Date(timestampMs).toISOString().slice(0, 10);
}

function formatDuration(durationMs: number): string {
	if (!Number.isFinite(durationMs) || durationMs <= 0) {
		return '0 min';
	}
	return `${Math.round(durationMs / 60000)} min`;
}

function normalizeTitle(title: string): string {
	const trimmed = title.trim();
	return trimmed.length > 0 ? trimmed : 'Untitled recording';
}

function escapeFrontmatterValue(value: string): string {
	return value.replace(/"/g, '\\"');
}

function renderHighlights(highlights: string[]): string {
	if (highlights.length === 0) {
		return '- No highlights extracted.';
	}

	return highlights.map((highlight) => `- ${highlight}`).join('\n');
}

export function renderPlaudMarkdown(detail: NormalizedPlaudDetail): string {
	const title = normalizeTitle(detail.title);
	const date = formatDate(detail.startAtMs);
	const duration = formatDuration(detail.durationMs);
	const summary = detail.summary.trim() || 'No summary available.';
	const transcript = detail.transcript.trim() || 'No transcript available.';

	return [
		'---',
		'source: plaud',
		'type: recording',
		`file_id: ${detail.fileId}`,
		`title: "${escapeFrontmatterValue(title)}"`,
		`date: ${date}`,
		`duration: ${duration}`,
		'---',
		'',
		`# ${title}`,
		'',
		'## Summary',
		summary,
		'',
		'## Highlights',
		renderHighlights(detail.highlights),
		'',
		'## Transcript',
		transcript,
		''
	].join('\n');
}
