#!/usr/bin/env node
// Write the staff passwords into the local .env without ever showing them.
//
// The passwords are typed at a hidden prompt and go straight from your keyboard
// into the gitignored .env file. They are not echoed to the terminal, not passed
// as command-line arguments (so they stay out of shell history), and never need
// to be pasted into a chat or a commit message.
//
//   npm run set:staff-passwords
//   npm run set:staff-passwords -- --file .env.scratch   (used by the tests)

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TARGET = resolve(argValue('--file') ?? '.env');

const SLOTS = [
  { key: 'POS_CASHIER_PASSWORD', label: 'Cashier password', min: 12 },
  { key: 'POS_MANAGER_PASSWORD', label: 'Manager password', min: 12 },
];

// These were committed to the public repository before the rotation. Refuse to
// write them back even if someone re-types them out of habit.
const PUBLISHED = new Set(['123456', 'admin123']);

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? null : process.argv[i + 1];
}

function bail(message) {
  process.stdout.write(`  ${message}\n  .env was not modified.\n`);
  process.exit(1);
}

/**
 * One reader for the whole run, attached to stdin exactly once. Nothing is echoed
 * because raw mode is used on a terminal, and nothing is paused in between
 * prompts, so a piped value and a typed one are both read reliably.
 */
function createLineReader() {
  const stdin = process.stdin;
  const out = process.stdout;
  const interactive = Boolean(stdin.isTTY);
  if (interactive) stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  const queued = [];
  let waiting = null;
  let closed = false;
  let carry = '';

  function deliver(line) {
    if (waiting) {
      const { resolve: handOver, echoNewline } = waiting;
      waiting = null;
      if (echoNewline) out.write('\n');
      handOver(line);
    } else {
      queued.push(line);
    }
  }

  function onData(chunk) {
    if (chunk.includes('\u0003') || chunk.includes('\u0004')) {
      out.write('\n  Cancelled - .env was not modified.\n');
      process.exit(130);
    }
    carry += chunk;
    let nl;
    while ((nl = carry.indexOf('\n')) !== -1) {
      const line = carry.slice(0, nl).replace(/\r$/, '');
      carry = carry.slice(nl + 1);
      deliver(line);
    }
  }

  function onClose() {
    closed = true;
    if (carry) {
      const line = carry.replace(/\r$/, '');
      carry = '';
      deliver(line);
    }
    deliver(null);
  }

  stdin.on('data', onData);
  stdin.on('end', onClose);
  stdin.on('close', onClose);
  stdin.on('error', onClose);

  return {
    read(prompt) {
      if (!queued.length && closed) {
        out.write(prompt);
        return Promise.resolve(null);
      }
      if (queued.length) {
        out.write(prompt);
        return Promise.resolve(queued.shift());
      }
      out.write(prompt);
      return new Promise((handOver) => {
        waiting = { resolve: handOver, echoNewline: true };
      });
    },
    stop() {
      stdin.off('data', onData);
      if (interactive) stdin.setRawMode(false);
      stdin.pause();
    },
  };
}

/** dotenv cannot represent these, so reject them up front. */
function problemWith(value, label, min) {
  if (value === null) return 'no input received';
  if (!value) return 'cannot be empty';
  if (value.length < min) return `must be at least ${min} characters (got ${value.length})`;
  if (value !== value.trim()) return 'cannot start or end with a space';
  if (/\r|\n/.test(value)) return 'cannot contain a line break';
  if (PUBLISHED.has(value)) return 'is still the value published in git history - pick something new';
  return null;
}

async function main() {
  if (!existsSync(TARGET) && argValue('--file') === null) {
    bail(`no .env found at ${TARGET} - see .env.example for the expected keys`);
  }

  const reader = createLineReader();
  const answers = new Map();

  try {
    for (const slot of SLOTS) {
      let value = null;
      // Two attempts, so a typo in an invisible field is not fatal.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const prompt = attempt === 0 ? `${slot.label}: ` : `${slot.label} (retry): `;
        value = await reader.read(prompt);
        const issue = problemWith(value, slot.label, slot.min);
        if (!issue) break;
        if (attempt === 1) {
          reader.stop();
          bail(`${slot.label} ${issue}.`);
        }
        process.stdout.write(`  ${slot.label} ${issue}.\n`);
      }
      answers.set(slot.key, value);
    }
  } finally {
    reader.stop();
  }

  if (answers.get('POS_CASHIER_PASSWORD') === answers.get('POS_MANAGER_PASSWORD')) {
    bail('the two staff passwords must be different from each other');
  }

  const original = existsSync(TARGET) ? readFileSync(TARGET, 'utf8') : '';
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original.split(/\r?\n/);

  for (const { key } of SLOTS) {
    const line = `${key}=${answers.get(key)}`;
    const at = lines.findIndex((l) => new RegExp(`^\\s*${key}\\s*=`).test(l));
    if (at === -1) lines.push(line);
    else lines[at] = line;
  }
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  writeFileSync(TARGET, `${lines.join(eol)}${eol}`, 'utf8');

  process.stdout.write('\n  Written (values not shown):\n');
  for (const { key } of SLOTS) {
    process.stdout.write(`    ${key}  length ${answers.get(key).length}\n`);
  }
  process.stdout.write('\n  Next: npm run test:smoke\n\n');
}

await main();
