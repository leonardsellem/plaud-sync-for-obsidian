import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const root = process.cwd();
const secretModuleUrl = pathToFileURL(path.join(root, 'src/secret-store.ts')).href;
const {
  PLAUD_TOKEN_SECRET_KEY,
  getPlaudToken,
  setPlaudToken,
  clearPlaudToken
} = await import(secretModuleUrl);

const settingsSource = fs.readFileSync(path.join(root, 'src/settings.ts'), 'utf8');
const schemaSource = fs.readFileSync(path.join(root, 'src/settings-schema.ts'), 'utf8');

test('secret key constant is stable and plugin-scoped', () => {
  assert.equal(PLAUD_TOKEN_SECRET_KEY, 'plaud-sync.token');
});

test('secret backend path is used when available', async () => {
  const storage = new Map();
  const host = {
    async getSecret(key) {
      return storage.get(key) ?? null;
    },
    async setSecret(key, value) {
      storage.set(key, value);
    },
    async deleteSecret(key) {
      storage.delete(key);
    }
  };

  await setPlaudToken(host, 'tok_abc');
  assert.equal(await getPlaudToken(host), 'tok_abc');

  await clearPlaudToken(host);
  assert.equal(await getPlaudToken(host), null);
});

test('fallback storage path still keeps token out of plugin saveData payload', async () => {
  const kv = new Map();
  const host = {
    loadLocalStorage(key) {
      return kv.get(key) ?? null;
    },
    saveLocalStorage(key, value) {
      if (value === null) {
        kv.delete(key);
        return;
      }
      kv.set(key, value);
    }
  };

  await setPlaudToken(host, 'tok_local');
  assert.equal(await getPlaudToken(host), 'tok_local');
  await clearPlaudToken(host);
  assert.equal(await getPlaudToken(host), null);

  assert.doesNotMatch(schemaSource, /token/i);
});

test('settings uses secret input flow and token feedback copy', () => {
  assert.match(settingsSource, /setPlaudToken\(/);
  assert.match(settingsSource, /getPlaudToken\(/);
  assert.match(settingsSource, /type\s*=\s*'password'/);
  assert.match(settingsSource, /Plaud token/);
});
