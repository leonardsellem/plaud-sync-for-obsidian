import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const root = process.cwd();
const moduleUrl = pathToFileURL(path.join(root, 'src/plaud-api.ts')).href;
const {createPlaudApiClient, PlaudApiError} = await import(moduleUrl);
const obsidianAdapterSource = fs.readFileSync(path.join(root, 'src/plaud-api-obsidian.ts'), 'utf8');

test('listFiles uses /file/simple/web with requestUrl-compatible call shape', async () => {
  let called = null;
  const client = createPlaudApiClient({
    apiDomain: 'https://api.plaud.ai',
    token: 'tok_123',
    request: async (req) => {
      called = req;
      return {status: 200, json: {status: 0, msg: 'ok', payload: [{id: 'f1', is_trash: false}]}};
    }
  });

  const files = await client.listFiles();
  assert.equal(files.length, 1);
  assert.equal(files[0].id, 'f1');

  assert.equal(called.method, 'GET');
  assert.equal(called.url, 'https://api.plaud.ai/file/simple/web');
  assert.equal(called.headers.Authorization, 'Bearer tok_123');
});

test('getFileDetail uses /file/detail/{id} and returns payload', async () => {
  const client = createPlaudApiClient({
    apiDomain: 'https://api.plaud.ai',
    token: 'tok_123',
    request: async (req) => {
      assert.equal(req.url, 'https://api.plaud.ai/file/detail/file_99');
      return {status: 200, json: {status: 0, msg: 'ok', payload: {id: 'file_99'}}};
    }
  });

  const detail = await client.getFileDetail('file_99');
  assert.equal(detail.id, 'file_99');
});

test('listFiles accepts plaud data_file_list response shape', async () => {
  const client = createPlaudApiClient({
    apiDomain: 'https://api-euc1.plaud.ai',
    token: 'tok_123',
    request: async () => ({
      status: 200,
      json: {
        status: 0,
        msg: 'success',
        data_file_total: 1,
        data_file_list: [{id: 'legacy_1', is_trash: false}]
      }
    })
  });

  const files = await client.listFiles();
  assert.equal(files.length, 1);
  assert.equal(files[0].id, 'legacy_1');
});

test('getFileDetail accepts plaud data wrapper without status envelope', async () => {
  const client = createPlaudApiClient({
    apiDomain: 'https://api-euc1.plaud.ai',
    token: 'tok_123',
    request: async (req) => {
      assert.equal(req.url, 'https://api-euc1.plaud.ai/file/detail/file_legacy');
      return {
        status: 200,
        json: {
          data: {
            file_id: 'file_legacy',
            file_name: 'Legacy Detail'
          }
        }
      };
    }
  });

  const detail = await client.getFileDetail('file_legacy');
  assert.equal(detail.id, 'file_legacy');
  assert.equal(detail.file_id, 'file_legacy');
  assert.equal(detail.file_name, 'Legacy Detail');
});

test('maps 401 to auth category', async () => {
  const client = createPlaudApiClient({
    apiDomain: 'https://api.plaud.ai',
    token: 'tok_123',
    request: async () => {
      const error = new Error('unauthorized');
      error.status = 401;
      throw error;
    }
  });

  await assert.rejects(
    () => client.listFiles(),
    (error) => error instanceof PlaudApiError && error.category === 'auth'
  );
});

test('maps 429 to rate_limit category', async () => {
  const client = createPlaudApiClient({
    apiDomain: 'https://api.plaud.ai',
    token: 'tok_123',
    request: async () => {
      const error = new Error('too many requests');
      error.status = 429;
      throw error;
    }
  });

  await assert.rejects(
    () => client.listFiles(),
    (error) => error instanceof PlaudApiError && error.category === 'rate_limit'
  );
});

test('maps 5xx to server category', async () => {
  const client = createPlaudApiClient({
    apiDomain: 'https://api.plaud.ai',
    token: 'tok_123',
    request: async () => {
      const error = new Error('server fail');
      error.status = 503;
      throw error;
    }
  });

  await assert.rejects(
    () => client.listFiles(),
    (error) => error instanceof PlaudApiError && error.category === 'server'
  );
});

test('maps invalid response shape to invalid_response category', async () => {
  const client = createPlaudApiClient({
    apiDomain: 'https://api.plaud.ai',
    token: 'tok_123',
    request: async () => ({status: 200, json: {unexpected: true}})
  });

  await assert.rejects(
    () => client.listFiles(),
    (error) => error instanceof PlaudApiError && error.category === 'invalid_response'
  );
});

test('maps network exception to network category', async () => {
  const client = createPlaudApiClient({
    apiDomain: 'https://api.plaud.ai',
    token: 'tok_123',
    request: async () => {
      throw new Error('socket hang up');
    }
  });

  await assert.rejects(
    () => client.listFiles(),
    (error) => error instanceof PlaudApiError && error.category === 'network'
  );
});

test('obsidian adapter uses requestUrl transport', () => {
  assert.match(obsidianAdapterSource, /requestUrl\(/);
});

test('normalizes configured token that already includes bearer prefix', async () => {
  let called = null;
  const client = createPlaudApiClient({
    apiDomain: 'https://api.plaud.ai',
    token: 'bearer tok_prefixed',
    request: async (req) => {
      called = req;
      return {status: 200, json: {status: 0, msg: 'ok', payload: [{id: 'f1'}]}};
    }
  });

  await client.listFiles();
  assert.equal(called.headers.Authorization, 'Bearer tok_prefixed');
});
