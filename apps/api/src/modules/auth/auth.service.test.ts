import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isUniqueViolation } from './auth.service.js';

/**
 * Regression: Drizzle wraps driver errors, so the Postgres SQLSTATE lives on
 * `cause`. When this guard missed it, a duplicate registration escaped as an
 * unhandled 500 whose body embedded the failed INSERT and its bound params —
 * including the argon2 password hash.
 */
test('isUniqueViolation finds SQLSTATE 23505 on the error itself', () => {
  assert.equal(isUniqueViolation({ code: '23505' }), true);
});

test('isUniqueViolation finds SQLSTATE 23505 wrapped in a cause chain', () => {
  const driverError = Object.assign(new Error('duplicate key value'), { code: '23505' });
  const wrapped = new Error('Failed query: insert into "users" ...', { cause: driverError });
  assert.equal(isUniqueViolation(wrapped), true);
});

test('isUniqueViolation finds SQLSTATE nested two levels down', () => {
  const driverError = Object.assign(new Error('duplicate key'), { code: '23505' });
  const inner = new Error('inner', { cause: driverError });
  const outer = new Error('outer', { cause: inner });
  assert.equal(isUniqueViolation(outer), true);
});

test('isUniqueViolation ignores unrelated postgres errors', () => {
  // 23503 = foreign key violation. Must not be swallowed as a duplicate.
  const other = new Error('fk', { cause: { code: '23503' } });
  assert.equal(isUniqueViolation(other), false);
  assert.equal(isUniqueViolation(new Error('plain')), false);
  assert.equal(isUniqueViolation(null), false);
  assert.equal(isUniqueViolation(undefined), false);
});

test('isUniqueViolation terminates on a self-referential cause chain', () => {
  const loop: { cause?: unknown } = {};
  loop.cause = loop;
  assert.equal(isUniqueViolation(loop), false);
});
