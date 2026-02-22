import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('package.json'));
const mainTs = read('src/main.ts');

const forbiddenMainPatterns = [
  'SampleModal',
  'addRibbonIcon',
  'addStatusBarItem',
  'open-modal-simple',
  'open-modal-complex',
  'replace-selected',
  "registerDomEvent(document, 'click'",
  'setInterval('
];

test('manifest is rebranded for Plaud sync plugin identity', () => {
  assert.equal(manifest.id, 'plaud-sync');
  assert.equal(manifest.name, 'Plaud Sync');
  assert.match(manifest.description, /Plaud/i);
  assert.equal(manifest.isDesktopOnly, false);
});

test('package metadata is rebranded from sample defaults', () => {
  assert.equal(pkg.name, 'obsidian-plaud-sync');
  assert.doesNotMatch(pkg.description, /sample plugin/i);
  assert.match(pkg.description, /Plaud/i);
});

test('main lifecycle keeps sample placeholders removed', () => {
  for (const pattern of forbiddenMainPatterns) {
    assert.equal(
      mainTs.includes(pattern),
      false,
      `main.ts still contains sample placeholder: ${pattern}`
    );
  }
});

test('main delegates feature wiring to dedicated module(s)', () => {
  assert.match(mainTs, /registerPlaudCommands\(/);
  assert.match(mainTs, /PlaudSettingTab/);
});
