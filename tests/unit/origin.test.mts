import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicOrigin, absolute } from '@/lib/origin';
import { SITE } from '@/lib/data/company';

const req = (headers: Record<string, string>, url = 'http://0.0.0.0:8080/api/x') =>
  new Request(url, { headers });

test('the container address is never the answer', () => {
  assert.equal(publicOrigin(req({ host: 'my-web-app--pravda-jo.europe-west4.hosted.app' })),
    'https://my-web-app--pravda-jo.europe-west4.hosted.app');
});
test('forwarded host and scheme win over Host', () => {
  assert.equal(publicOrigin(req({
    host: '0.0.0.0:8080', 'x-forwarded-host': 'pravda.jo', 'x-forwarded-proto': 'https',
  })), 'https://pravda.jo');
});
test('a comma-separated forwarded host takes the first hop', () => {
  assert.equal(publicOrigin(req({ 'x-forwarded-host': 'pravda.jo, internal.example', 'x-forwarded-proto': 'https' })),
    'https://pravda.jo');
});
test('localhost stays http', () => {
  assert.equal(publicOrigin(req({ host: 'localhost:3000' })), 'http://localhost:3000');
});
test('no headers at all falls back to the configured site', () => {
  assert.equal(publicOrigin(new Request('http://0.0.0.0:8080/x')), SITE);
});
test('absolute joins a path onto the public origin', () => {
  assert.equal(absolute(req({ host: 'localhost:3000' }), '/ops?bad=1'), 'http://localhost:3000/ops?bad=1');
});
