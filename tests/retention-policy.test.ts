import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldDelete,
  getDeletionDate,
  isExpired,
  getRetentionBasisLabel,
  type RetentionPolicy,
} from "../lib/retention-policy-pure.ts";

const DAY = 86_400_000;

test("getDeletionDate adds the retention period to the anchor timestamp", () => {
  const policy: RetentionPolicy = { period: 1, unit: "month" };
  const anchor = 1_700_000_000_000;
  // 1 month == 30 days == 30 * 86_400_000 ms
  assert.equal(getDeletionDate(anchor, policy), anchor + 30 * DAY);
});

test("getDeletionDate adds an optional grace period after the retention period", () => {
  const policy: RetentionPolicy = { period: 30, unit: "day", grace: 7 };
  const anchor = 1_700_000_000_000;
  // 30 days retention + 7 days grace = 37 days
  assert.equal(getDeletionDate(anchor, policy), anchor + 37 * DAY);
});

test("getDeletionDate supports day/week/month/year units", () => {
  const anchor = 1_700_000_000_000;
  assert.equal(getDeletionDate(anchor, { period: 1, unit: "day" }), anchor + DAY);
  assert.equal(getDeletionDate(anchor, { period: 1, unit: "week" }), anchor + 7 * DAY);
  assert.equal(getDeletionDate(anchor, { period: 1, unit: "year" }), anchor + 365 * DAY);
});

test("getDeletionDate returns NaN for a non-finite anchor", () => {
  assert.ok(Number.isNaN(getDeletionDate(NaN, { period: 1, unit: "month" })));
});

test("isExpired returns true once now >= deletion date", () => {
  const policy: RetentionPolicy = { period: 1, unit: "month" };
  const anchor = 1_700_000_000_000;
  const deletion = anchor + 30 * DAY;
  assert.equal(isExpired(anchor, policy, deletion - 1), false);
  assert.equal(isExpired(anchor, policy, deletion), true);
  assert.equal(isExpired(anchor, policy, deletion + 1), true);
});

test("isExpired handles edge cases: non-finite now and non-finite anchor", () => {
  const policy: RetentionPolicy = { period: 1, unit: "month" };
  assert.equal(isExpired(1_700_000_000_000, policy, NaN), false);
  assert.equal(isExpired(NaN, policy, Date.now()), true);
});

test("shouldDelete uses lastActivityAt when basis is last_activity (default)", () => {
  const policy: RetentionPolicy = { period: 1, unit: "day" };
  const createdAt = 1_700_000_000_000;
  const lastActivity = createdAt + 2 * DAY;
  const now = lastActivity + 2 * DAY; // 1 day after the deletion date
  assert.equal(shouldDelete({ createdAt, lastActivityAt: lastActivity }, policy, now), true);
  // Now is exactly at the deletion date → expired
  assert.equal(
    shouldDelete({ createdAt, lastActivityAt: lastActivity }, policy, lastActivity + DAY),
    true,
  );
});

test("shouldDelete falls back to createdAt when lastActivityAt is missing under last_activity basis", () => {
  const policy: RetentionPolicy = { period: 1, unit: "day" };
  const createdAt = 1_700_000_000_000;
  // No lastActivityAt → uses createdAt, deletion date = createdAt + 1 day
  assert.equal(
    shouldDelete({ createdAt }, policy, createdAt + 2 * DAY),
    true,
  );
  assert.equal(
    shouldDelete({ createdAt }, policy, createdAt),
    false,
  );
});

test("shouldDelete uses createdAt when basis is created", () => {
  const policy: RetentionPolicy = { period: 1, unit: "day", basis: "created" };
  const createdAt = 1_700_000_000_000;
  const lastActivity = createdAt + 5 * DAY;
  // Deletion date should be createdAt + 1 day regardless of lastActivity
  assert.equal(
    shouldDelete({ createdAt, lastActivityAt: lastActivity }, policy, createdAt + 2 * DAY),
    true,
  );
  assert.equal(
    shouldDelete({ createdAt, lastActivityAt: lastActivity }, policy, createdAt),
    false,
  );
});

test("getRetentionBasisLabel returns human-readable labels for each basis", () => {
  assert.equal(getRetentionBasisLabel("last_activity"), "Last Activity");
  assert.equal(getRetentionBasisLabel("created"), "Created");
});
