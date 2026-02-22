import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';
import {pathToFileURL} from 'node:url';

const root = process.cwd();
const moduleUrl = pathToFileURL(path.join(root, 'src/commands.ts')).href;
const {registerPlaudCommands} = await import(moduleUrl);

function createHost() {
  const commands = [];
  let syncCalls = 0;
  let validateCalls = 0;

  return {
    commands,
    get syncCalls() {
      return syncCalls;
    },
    get validateCalls() {
      return validateCalls;
    },
    addCommand(command) {
      commands.push(command);
    },
    async runPlaudSyncNow() {
      syncCalls += 1;
    },
    async validatePlaudToken() {
      validateCalls += 1;
    }
  };
}

test('registerPlaudCommands wires sync-now and validate-token command handlers', async () => {
  const host = createHost();

  registerPlaudCommands(host);

  assert.equal(host.commands.length, 2);
  assert.equal(host.commands[0].id, 'sync-now');
  assert.equal(host.commands[0].name, 'Plaud: sync now');
  assert.equal(host.commands[1].id, 'validate-token');
  assert.equal(host.commands[1].name, 'Plaud: validate token');

  host.commands[0].callback();
  host.commands[1].callback();
  await Promise.resolve();

  assert.equal(host.syncCalls, 1);
  assert.equal(host.validateCalls, 1);
});
