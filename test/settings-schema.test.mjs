import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';
import {pathToFileURL} from 'node:url';
import fs from 'node:fs';

const root = process.cwd();
const schemaModuleUrl = pathToFileURL(path.join(root, 'src/settings-schema.ts')).href;
const {
  DEFAULT_SETTINGS,
  normalizeSettings,
  toPersistedSettings
} = await import(schemaModuleUrl);

const mainSource = fs.readFileSync(path.join(root, 'src/main.ts'), 'utf8');

test('default settings expose full Plaud sync schema', () => {
  assert.deepEqual(Object.keys(DEFAULT_SETTINGS).sort(), [
    'apiDomain',
    'filenamePattern',
    'lastSyncAtMs',
    'syncFolder',
    'syncOnStartup',
    'updateExisting'
  ]);

  assert.equal(DEFAULT_SETTINGS.apiDomain, 'https://api.plaud.ai');
  assert.equal(DEFAULT_SETTINGS.syncFolder, 'Plaud');
  assert.equal(DEFAULT_SETTINGS.syncOnStartup, true);
  assert.equal(DEFAULT_SETTINGS.updateExisting, true);
  assert.equal(DEFAULT_SETTINGS.filenamePattern, 'plaud-{date}-{title}');
  assert.equal(DEFAULT_SETTINGS.lastSyncAtMs, 0);
});

test('normalizeSettings merges persisted partial values with defaults', () => {
  const merged = normalizeSettings({
    syncFolder: 'My Plaud Notes',
    syncOnStartup: false,
    lastSyncAtMs: 1730000000123
  });

  assert.equal(merged.apiDomain, DEFAULT_SETTINGS.apiDomain);
  assert.equal(merged.syncFolder, 'My Plaud Notes');
  assert.equal(merged.syncOnStartup, false);
  assert.equal(merged.updateExisting, DEFAULT_SETTINGS.updateExisting);
  assert.equal(merged.filenamePattern, DEFAULT_SETTINGS.filenamePattern);
  assert.equal(merged.lastSyncAtMs, 1730000000123);
});

test('normalizeSettings protects against malformed persisted values', () => {
  const merged = normalizeSettings({
    apiDomain: '',
    syncFolder: 42,
    syncOnStartup: 'yes',
    updateExisting: null,
    filenamePattern: '',
    lastSyncAtMs: -100
  });

  assert.deepEqual(merged, DEFAULT_SETTINGS);
});

test('toPersistedSettings preserves explicit lastSyncAtMs checkpoint semantics', () => {
  const persisted = toPersistedSettings({
    ...DEFAULT_SETTINGS,
    lastSyncAtMs: 1731000000000
  });

  assert.equal(persisted.lastSyncAtMs, 1731000000000);
});

test('plugin main wiring uses normalizeSettings during load path', () => {
  assert.match(mainSource, /this\.settings\s*=\s*normalizeSettings\(await this\.loadData\(\)\)/);
});
