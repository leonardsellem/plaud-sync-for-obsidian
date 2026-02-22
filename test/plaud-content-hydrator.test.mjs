import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';
import {pathToFileURL} from 'node:url';

const root = process.cwd();
const moduleUrl = pathToFileURL(path.join(root, 'src/plaud-content-hydrator.ts')).href;
const {hydratePlaudDetailContent} = await import(moduleUrl);

test('hydrates summary and transcript from content_list signed links', async () => {
  const calls = [];
  const detail = {
    file_id: 'f_1',
    content_list: [
      {data_type: 'auto_sum_note', data_link: 'https://example.test/sum'},
      {data_type: 'transaction', data_link: 'https://example.test/trans'}
    ]
  };

  const hydrated = await hydratePlaudDetailContent(detail, async (url) => {
    calls.push(url);
    if (url.endsWith('/sum')) {
      return {ai_content: 'Summary from signed content'};
    }
    return [
      {speaker: 'Speaker 1', content: 'Hello world'}
    ];
  });

  assert.deepEqual(calls, ['https://example.test/sum', 'https://example.test/trans']);
  assert.equal(hydrated.summary, 'Summary from signed content');
  assert.ok(Array.isArray(hydrated.transcript));
  assert.equal(hydrated.transcript.length, 1);
});

test('does not fetch summary link when summary already exists', async () => {
  const calls = [];
  const detail = {
    file_id: 'f_2',
    summary: 'Already present',
    content_list: [
      {data_type: 'auto_sum_note', data_link: 'https://example.test/sum'}
    ]
  };

  const hydrated = await hydratePlaudDetailContent(detail, async (url) => {
    calls.push(url);
    return {ai_content: 'Should not be used'};
  });

  assert.deepEqual(calls, []);
  assert.equal(hydrated.summary, 'Already present');
});

test('parses transcript payload when content URL returns JSON string', async () => {
  const detail = {
    file_id: 'f_3',
    content_list: [
      {data_type: 'transaction', data_link: 'https://example.test/trans'}
    ]
  };

  const hydrated = await hydratePlaudDetailContent(detail, async () => {
    return JSON.stringify([{speaker: 'S', content: 'Line'}]);
  });

  assert.ok(Array.isArray(hydrated.transcript));
  assert.equal(hydrated.transcript[0].content, 'Line');
});
