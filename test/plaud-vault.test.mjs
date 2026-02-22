import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';
import {pathToFileURL} from 'node:url';

const root = process.cwd();
const moduleUrl = pathToFileURL(path.join(root, 'src/plaud-vault.ts')).href;
const {upsertPlaudNote, buildPlaudFilename} = await import(moduleUrl);

function createMockVault(initialFiles = {}) {
  const files = new Map(Object.entries(initialFiles));
  const createdFolders = [];
  const writes = [];
  const creates = [];

  return {
    files,
    createdFolders,
    writes,
    creates,
    async ensureFolder(path) {
      createdFolders.push(path);
    },
    async listMarkdownFiles(folder) {
      return [...files.keys()].filter((key) => key.startsWith(folder) && key.endsWith('.md'));
    },
    async read(path) {
      return files.get(path) ?? '';
    },
    async write(path, content) {
      writes.push(path);
      files.set(path, content);
    },
    async create(path, content) {
      creates.push(path);
      files.set(path, content);
    }
  };
}

test('buildPlaudFilename is deterministic and slug-safe', () => {
  const filename = buildPlaudFilename({
    filenamePattern: 'plaud-{date}-{title}',
    date: '2024-11-04',
    title: 'Weekly Sync: Team / Product'
  });

  assert.equal(filename, 'plaud-2024-11-04-weekly-sync-team-product.md');
});

test('creates sync folder and new note when no existing file_id match', async () => {
  const vault = createMockVault();

  const result = await upsertPlaudNote({
    vault,
    syncFolder: 'Plaud',
    filenamePattern: 'plaud-{date}-{title}',
    updateExisting: true,
    fileId: 'f_001',
    title: 'First Note',
    date: '2024-11-04',
    markdown: '---\nfile_id: f_001\n---\n\n# First Note\n'
  });

  assert.equal(result.action, 'created');
  assert.equal(result.path, 'Plaud/plaud-2024-11-04-first-note.md');
  assert.deepEqual(vault.createdFolders, ['Plaud']);
  assert.deepEqual(vault.creates, ['Plaud/plaud-2024-11-04-first-note.md']);
});

test('matches existing note by frontmatter file_id and updates in place', async () => {
  const vault = createMockVault({
    'Plaud/existing.md': '---\nfile_id: f_abc\n---\n\nold'
  });

  const result = await upsertPlaudNote({
    vault,
    syncFolder: 'Plaud',
    filenamePattern: 'plaud-{date}-{title}',
    updateExisting: true,
    fileId: 'f_abc',
    title: 'Updated title',
    date: '2024-11-04',
    markdown: '---\nfile_id: f_abc\n---\n\nnew'
  });

  assert.equal(result.action, 'updated');
  assert.equal(result.path, 'Plaud/existing.md');
  assert.deepEqual(vault.writes, ['Plaud/existing.md']);
  assert.equal(vault.creates.length, 0);
});

test('matches existing note when frontmatter file_id is quoted', async () => {
  const vault = createMockVault({
    'Plaud/quoted.md': '---\nfile_id: "f_quoted"\n---\n\nold'
  });

  const result = await upsertPlaudNote({
    vault,
    syncFolder: 'Plaud',
    filenamePattern: 'plaud-{date}-{title}',
    updateExisting: true,
    fileId: 'f_quoted',
    title: 'Quoted match',
    date: '2024-11-04',
    markdown: '---\nfile_id: f_quoted\n---\n\nnew'
  });

  assert.equal(result.action, 'updated');
  assert.equal(result.path, 'Plaud/quoted.md');
  assert.deepEqual(vault.writes, ['Plaud/quoted.md']);
  assert.equal(vault.creates.length, 0);
});

test('skips update when updateExisting=false but still resolves by file_id', async () => {
  const vault = createMockVault({
    'Plaud/existing.md': '---\nfile_id: f_skip\n---\n\nold'
  });

  const result = await upsertPlaudNote({
    vault,
    syncFolder: 'Plaud',
    filenamePattern: 'plaud-{date}-{title}',
    updateExisting: false,
    fileId: 'f_skip',
    title: 'Ignored title',
    date: '2024-11-04',
    markdown: '---\nfile_id: f_skip\n---\n\nnew'
  });

  assert.equal(result.action, 'skipped');
  assert.equal(result.path, 'Plaud/existing.md');
  assert.equal(vault.writes.length, 0);
  assert.equal(vault.creates.length, 0);
});

test('applies collision-safe filename fallback for new notes', async () => {
  const vault = createMockVault({
    'Plaud/plaud-2024-11-04-first-note.md': '---\nfile_id: old\n---',
    'Plaud/plaud-2024-11-04-first-note-2.md': '---\nfile_id: old2\n---'
  });

  const result = await upsertPlaudNote({
    vault,
    syncFolder: 'Plaud',
    filenamePattern: 'plaud-{date}-{title}',
    updateExisting: true,
    fileId: 'f_new',
    title: 'First Note',
    date: '2024-11-04',
    markdown: '---\nfile_id: f_new\n---\n\nnew'
  });

  assert.equal(result.action, 'created');
  assert.equal(result.path, 'Plaud/plaud-2024-11-04-first-note-3.md');
});
