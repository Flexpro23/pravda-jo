/**
 * Proves the harness itself: the `@/` alias loader and NODE_OPTIONS wiring
 * work under `node --test`, where every test file runs in its own child
 * process rather than sharing the parent's `--import` flag.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseHandle } from '@/lib/meta/discovery';

test('normaliseHandle lowercases and strips the @', () => {
  assert.equal(normaliseHandle('@Foo.Bar'), 'foo.bar');
});

test('normaliseHandle rejects a non-handle', () => {
  assert.equal(normaliseHandle('not a handle'), null);
});
