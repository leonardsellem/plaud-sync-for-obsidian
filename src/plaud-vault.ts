export interface PlaudVaultAdapter {
	ensureFolder(path: string): Promise<void>;
	listMarkdownFiles(folder: string): Promise<string[]>;
	read(path: string): Promise<string>;
	write(path: string, content: string): Promise<void>;
	create(path: string, content: string): Promise<void>;
}

export interface BuildFilenameInput {
	filenamePattern: string;
	date: string;
	title: string;
}

export interface UpsertPlaudNoteInput {
	vault: PlaudVaultAdapter;
	syncFolder: string;
	filenamePattern: string;
	updateExisting: boolean;
	fileId: string;
	title: string;
	date: string;
	markdown: string;
}

export interface UpsertPlaudNoteResult {
	action: 'created' | 'updated' | 'skipped';
	path: string;
}

function normalizeFolder(folder: string): string {
	return folder.replace(/\/+$/, '').trim() || 'Plaud';
}

function slugify(value: string): string {
	const normalized = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-+/g, '-');

	return normalized || 'recording';
}

function extractFrontmatter(content: string): string {
	if (!content.startsWith('---\n')) {
		return '';
	}

	const closing = content.indexOf('\n---\n', 4);
	if (closing === -1) {
		return '';
	}

	return content.slice(4, closing);
}

function extractFrontmatterFileId(content: string): string {
	const frontmatter = extractFrontmatter(content);
	if (!frontmatter) {
		return '';
	}

	const match = frontmatter.match(/^file_id:\s*(.+)$/m);
	const raw = match?.[1]?.trim() ?? '';
	if (!raw) {
		return '';
	}

	const startsWithDouble = raw.startsWith('"');
	const endsWithDouble = raw.endsWith('"');
	if (startsWithDouble && endsWithDouble && raw.length >= 2) {
		return raw.slice(1, -1).trim();
	}

	const startsWithSingle = raw.startsWith("'");
	const endsWithSingle = raw.endsWith("'");
	if (startsWithSingle && endsWithSingle && raw.length >= 2) {
		return raw.slice(1, -1).trim();
	}

	return raw;
}

function joinPath(folder: string, fileName: string): string {
	return `${folder}/${fileName}`;
}

function withCollisionSuffix(fileName: string, suffix: number): string {
	const dotIndex = fileName.lastIndexOf('.');
	if (dotIndex === -1) {
		return `${fileName}-${suffix}`;
	}

	const base = fileName.slice(0, dotIndex);
	const ext = fileName.slice(dotIndex);
	return `${base}-${suffix}${ext}`;
}

export function buildPlaudFilename(input: BuildFilenameInput): string {
	const pattern = input.filenamePattern.trim() || 'plaud-{date}-{title}';
	const replacedDate = pattern.replace(/\{date\}/g, input.date);
	const filled = replacedDate.replace(/\{title\}/g, slugify(input.title));
	const filename = slugify(filled).replace(/^-+|-+$/g, '');
	return `${filename || 'plaud-recording'}.md`;
}

function resolveAvailablePath(folder: string, initialFileName: string, existingPaths: Set<string>): string {
	let candidate = joinPath(folder, initialFileName);
	if (!existingPaths.has(candidate)) {
		return candidate;
	}

	let suffix = 2;
	while (existingPaths.has(candidate)) {
		candidate = joinPath(folder, withCollisionSuffix(initialFileName, suffix));
		suffix += 1;
	}

	return candidate;
}

export async function upsertPlaudNote(input: UpsertPlaudNoteInput): Promise<UpsertPlaudNoteResult> {
	const folder = normalizeFolder(input.syncFolder);
	await input.vault.ensureFolder(folder);

	const existingPaths = await input.vault.listMarkdownFiles(folder);
	const existingSet = new Set(existingPaths);

	for (const path of existingPaths) {
		const fileId = extractFrontmatterFileId(await input.vault.read(path));
		if (fileId === input.fileId) {
			if (!input.updateExisting) {
				return {action: 'skipped', path};
			}

			await input.vault.write(path, input.markdown);
			return {action: 'updated', path};
		}
	}

	const initialFileName = buildPlaudFilename({
		filenamePattern: input.filenamePattern,
		date: input.date,
		title: input.title
	});
	const path = resolveAvailablePath(folder, initialFileName, existingSet);

	await input.vault.create(path, input.markdown);
	return {action: 'created', path};
}
