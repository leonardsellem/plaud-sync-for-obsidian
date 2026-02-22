import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';
import {pathToFileURL} from 'node:url';

const root = process.cwd();
const retryUrl = pathToFileURL(path.join(root, 'src/plaud-retry.ts')).href;
const apiUrl = pathToFileURL(path.join(root, 'src/plaud-api.ts')).href;

const {withRetry, sanitizeTelemetryMessage} = await import(retryUrl);
const {PlaudApiError} = await import(apiUrl);

test('retries transient errors and eventually succeeds', async () => {
  let attempts = 0;
  const sleeps = [];

  const result = await withRetry(
    'listFiles',
    async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new PlaudApiError('network', 'socket timeout');
      }
      return 'ok';
    },
    {
      policy: {maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 250},
      sleep: async (ms) => {
        sleeps.push(ms);
      }
    }
  );

  assert.equal(result, 'ok');
  assert.equal(attempts, 3);
  assert.deepEqual(sleeps, [100, 200]);
});

test('does not retry permanent auth failures', async () => {
  let attempts = 0;
  const sleeps = [];

  await assert.rejects(
    () => withRetry(
      'validateToken',
      async () => {
        attempts += 1;
        throw new PlaudApiError('auth', 'invalid token');
      },
      {
        policy: {maxAttempts: 5, baseDelayMs: 50, maxDelayMs: 500},
        sleep: async (ms) => {
          sleeps.push(ms);
        }
      }
    ),
    (error) => error instanceof PlaudApiError && error.category === 'auth'
  );

  assert.equal(attempts, 1);
  assert.deepEqual(sleeps, []);
});

test('uses bounded exponential backoff', async () => {
  const sleeps = [];

  await assert.rejects(
    () => withRetry(
      'syncDetail',
      async () => {
        throw new PlaudApiError('network', 'temporary network failure');
      },
      {
        policy: {maxAttempts: 5, baseDelayMs: 200, maxDelayMs: 300},
        sleep: async (ms) => {
          sleeps.push(ms);
        }
      }
    )
  );

  assert.deepEqual(sleeps, [200, 300, 300, 300]);
});

test('sanitizes bearer tokens in telemetry messages', () => {
  const message = sanitizeTelemetryMessage('Authorization: Bearer tok_super_secret_value');
  assert.equal(message, 'Authorization: Bearer [REDACTED]');
});
