import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatNotification,
  interpolate,
  isInQuietHours,
  shouldNotify,
  type Notification,
  type NotificationContext,
  type NotificationPreferences,
} from "../lib/notification-pure.ts";

const NOW = 1_700_000_000_000;

function baseNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "n1",
    kind: "system",
    title: "Hello",
    body: "Welcome back",
    channels: ["email", "in_app"],
    priority: "normal",
    userId: "u1",
    createdAtMs: NOW,
    ...overrides,
  };
}

function baseContext(overrides: Partial<NotificationContext> = {}): NotificationContext {
  return {
    notification: baseNotification(),
    preferences: { enabledChannels: ["email", "in_app"], mutedKinds: [] },
    nowMs: NOW,
    currentHour: 12,
    minGapMs: 60_000,
    ...overrides,
  };
}

test("shouldNotify returns true when all conditions pass", () => {
  const result = shouldNotify(baseContext());
  assert.equal(result.shouldSend, true);
});

test("shouldNotify returns false when the kind is muted", () => {
  const result = shouldNotify(
    baseContext({
      preferences: { enabledChannels: ["email"], mutedKinds: ["system"] },
    }),
  );
  assert.equal(result.shouldSend, false);
  assert.match((result as { reason: string }).reason, /muted/);
});

test("shouldNotify returns false when no enabled channel matches", () => {
  const result = shouldNotify(
    baseContext({
      preferences: { enabledChannels: ["sms"], mutedKinds: [] },
    }),
  );
  assert.equal(result.shouldSend, false);
  assert.match((result as { reason: string }).reason, /no enabled channels/);
});

test("shouldNotify returns false during quiet hours for non-urgent notifications", () => {
  const result = shouldNotify(
    baseContext({
      currentHour: 23,
      preferences: {
        enabledChannels: ["email"],
        mutedKinds: [],
        quietHours: { start: 22, end: 7 },
      },
    }),
  );
  assert.equal(result.shouldSend, false);
  assert.match((result as { reason: string }).reason, /quiet hours/);
});

test("shouldNotify bypasses quiet hours for urgent notifications", () => {
  const result = shouldNotify(
    baseContext({
      notification: baseNotification({ priority: "urgent" }),
      currentHour: 23,
      preferences: {
        enabledChannels: ["email"],
        mutedKinds: [],
        quietHours: { start: 22, end: 7 },
      },
    }),
  );
  assert.equal(result.shouldSend, true);
});

test("shouldNotify rate-limits duplicate sends within minGapMs", () => {
  const result = shouldNotify(
    baseContext({
      lastSentAtMs: NOW - 30_000,
      minGapMs: 60_000,
    }),
  );
  assert.equal(result.shouldSend, false);
  assert.match((result as { reason: string }).reason, /rate-limited/);
});

test("isInQuietHours handles wrap-around overnight windows", () => {
  const window = { start: 22, end: 7 };
  assert.equal(isInQuietHours(23, window), true);
  assert.equal(isInQuietHours(2, window), true);
  assert.equal(isInQuietHours(6, window), true);
  assert.equal(isInQuietHours(7, window), false);
  assert.equal(isInQuietHours(12, window), false);
  assert.equal(isInQuietHours(22, window), true);
});

test("isInQuietHours handles same-day windows", () => {
  const window = { start: 13, end: 14 };
  assert.equal(isInQuietHours(13, window), true);
  assert.equal(isInQuietHours(13.5, window), true);
  assert.equal(isInQuietHours(14, window), false);
  assert.equal(isInQuietHours(12, window), false);
});

test("interpolate replaces {{key}} tokens and leaves missing keys intact", () => {
  assert.equal(
    interpolate("Hello {{name}}, you have {{count}} alerts", { name: "Alice", count: 3 }),
    "Hello Alice, you have 3 alerts",
  );
  assert.equal(
    interpolate("Hi {{missing}}", {}),
    "Hi {{missing}}",
  );
  assert.equal(interpolate("no tokens", { x: 1 }), "no tokens");
});

test("formatNotification adapts the message per channel", () => {
  const n = baseNotification({
    title: "Welcome {{name}}",
    body: "A".repeat(200),
    variables: { name: "Bob" },
  });
  const email = formatNotification(n, "email");
  assert.equal(email.subject, "Welcome Bob");
  assert.equal(email.body, "A".repeat(200));
  assert.equal(email.channel, "email");

  const sms = formatNotification(n, "sms");
  assert.equal(sms.body.length, 160);
  assert.equal(sms.subject, undefined);

  const push = formatNotification(n, "push");
  assert.equal(push.title, "Welcome Bob");
  assert.equal(push.body.length, 100);

  const webhook = formatNotification(n, "webhook");
  assert.equal(webhook.payload, n);
});
