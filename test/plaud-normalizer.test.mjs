import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';
import {pathToFileURL} from 'node:url';

const root = process.cwd();
const moduleUrl = pathToFileURL(path.join(root, 'src/plaud-normalizer.ts')).href;
const {normalizePlaudDetail} = await import(moduleUrl);

test('normalizes canonical fields into stable domain model', () => {
  const normalized = normalizePlaudDetail({
    id: '123',
    file_id: 'f_123',
    file_name: 'Meeting recap',
    start_time: 1730000000000,
    duration: 600000,
    pre_download_content_list: [
      {type: 'summary', content: 'Summary from pre download'}
    ],
    highlights: '["Action A","Action B"]',
    trans_result: {
      paragraphs: [
        {speaker: 'A', text: 'Hello'},
        {speaker: 'B', text: 'Hi'}
      ]
    }
  });

  assert.equal(normalized.id, '123');
  assert.equal(normalized.fileId, 'f_123');
  assert.equal(normalized.title, 'Meeting recap');
  assert.equal(normalized.startAtMs, 1730000000000);
  assert.equal(normalized.durationMs, 600000);
  assert.equal(normalized.summary, 'Summary from pre download');
  assert.deepEqual(normalized.highlights, ['Action A', 'Action B']);
  assert.match(normalized.transcript, /A: Hello/);
  assert.match(normalized.transcript, /B: Hi/);
});

test('extracts summary from known pre_download_content_list fallback variants', () => {
  const normalized = normalizePlaudDetail({
    id: 's-2',
    pre_download_content_list: [
      {label: 'abstract', value: 'Abstract summary'},
      {label: 'other', value: 'ignored'}
    ]
  });

  assert.equal(normalized.summary, 'Abstract summary');
});

test('extracts summary and highlights from pre_download_content_list data_id/data_content variants', () => {
  const normalized = normalizePlaudDetail({
    id: 'legacy-pre',
    pre_download_content_list: [
      {
        data_id: 'auto_sum:legacy',
        data_content: '<p>Legacy summary from data_content</p>'
      },
      {
        data_id: 'note:legacy',
        data_content: JSON.stringify([
          {title: 'Point A'},
          {content: 'Point B'}
        ])
      }
    ]
  });

  assert.equal(normalized.summary, 'Legacy summary from data_content');
  assert.deepEqual(normalized.highlights, ['Point A', 'Point B']);
});

test('supports highlights text fallback when not valid JSON', () => {
  const normalized = normalizePlaudDetail({
    id: 'h-1',
    highlights: 'First highlight\nSecond highlight\n\nThird highlight'
  });

  assert.deepEqual(normalized.highlights, ['First highlight', 'Second highlight', 'Third highlight']);
});

test('extracts highlights from JSON object entries that contain text/value fields', () => {
  const normalized = normalizePlaudDetail({
    id: 'h-obj',
    highlights: JSON.stringify([
      {text: 'Capture owner action'},
      {value: 'Follow up with design'}
    ])
  });

  assert.deepEqual(normalized.highlights, ['Capture owner action', 'Follow up with design']);
});

test('supports transcript extraction from object and array variants', () => {
  const fromObject = normalizePlaudDetail({
    id: 't-obj',
    trans_result: {
      sentences: [
        {speaker: 'S1', content: 'One'},
        {speaker: 'S2', content: 'Two'}
      ]
    }
  });

  const fromArray = normalizePlaudDetail({
    id: 't-arr',
    transcript: [
      {speaker_name: 'Speaker 1', text: 'Line 1'},
      {speaker_name: 'Speaker 2', text: 'Line 2'}
    ]
  });

  assert.match(fromObject.transcript, /S1: One/);
  assert.match(fromObject.transcript, /S2: Two/);
  assert.match(fromArray.transcript, /Speaker 1: Line 1/);
  assert.match(fromArray.transcript, /Speaker 2: Line 2/);
});

test('gracefully handles malformed payloads', () => {
  const normalized = normalizePlaudDetail({
    id: null,
    file_id: undefined,
    start_time: 'not-a-number',
    duration: -99,
    pre_download_content_list: 'unexpected',
    highlights: 12,
    trans_result: null
  });

  assert.equal(normalized.id, 'unknown');
  assert.equal(normalized.fileId, 'unknown');
  assert.equal(normalized.startAtMs, 0);
  assert.equal(normalized.durationMs, 0);
  assert.equal(normalized.summary, '');
  assert.deepEqual(normalized.highlights, []);
  assert.equal(normalized.transcript, '');
});
