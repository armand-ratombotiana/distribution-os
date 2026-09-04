/**
 * Pure notification primitives.
 *
 * A notification is a typed message routed to one or more channels
 * (email, sms, push, in-app, webhook). The pure helpers decide whether
 * a notification should fire (rate limiting, quiet hours, preferences)
 * and how to format it per channel. No I/O.
 */

export type NotificationChannel =
  | "email"
  | "sms"
  | "push"
  | "in_app"
  | "webhook";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface Notification {
  id: string;
  /** Stable kind, used to dedupe / rate-limit per user. */
  kind: string;
  title: string;
  body: string;
  channels: ReadonlyArray<NotificationChannel>;
  priority: NotificationPriority;
  /** Recipient user id. */
  userId: string;
  /** Epoch milliseconds when the notification was created. */
  createdAtMs: number;
  /** Optional template variables for interpolation. */
  variables?: Record<string, string | number>;
}

export interface NotificationPreferences {
  /** Channels the user has explicitly enabled. */
  enabledChannels: ReadonlyArray<NotificationChannel>;
  /** Kinds the user has muted. */
  mutedKinds: ReadonlyArray<string>;
  /** Window of the day (24h local time, [0,24)) during which the user
   *  does not want non-urgent notifications. */
  quietHours?: { start: number; end: number };
}

export interface NotificationContext {
  notification: Notification;
  preferences: NotificationPreferences;
  /** Last time the same (userId, kind) was sent, for rate-limiting. */
  lastSentAtMs?: number;
  /** Current time (epoch ms). */
  nowMs: number;
  /** Current local hour [0,24). */
  currentHour: number;
  /** Minimum gap (ms) between two notifications of the same kind for the same user. */
  minGapMs: number;
}

/**
 * Decide whether a notification should be sent given the context.
 *
 * Returns `{ shouldSend: false, reason }` when:
 *   - the kind is muted,
 *   - none of the notification's channels are enabled,
 *   - the notification is non-urgent and the user is in quiet hours,
 *   - the same kind was sent to the user within `minGapMs`.
 */
export function shouldNotify(context: NotificationContext):
  | { shouldSend: true }
  | { shouldSend: false; reason: string } {
  const { notification, preferences, lastSentAtMs, nowMs, currentHour, minGapMs } = context;

  if (preferences.mutedKinds.includes(notification.kind)) {
    return { shouldSend: false, reason: `kind "${notification.kind}" is muted` };
  }

  const hasEnabledChannel = notification.channels.some((c) =>
    preferences.enabledChannels.includes(c),
  );
  if (!hasEnabledChannel) {
    return { shouldSend: false, reason: "no enabled channels match the notification" };
  }

  if (
    preferences.quietHours &&
    notification.priority !== "urgent" &&
    isInQuietHours(currentHour, preferences.quietHours)
  ) {
    return { shouldSend: false, reason: "user is in quiet hours" };
  }

  if (lastSentAtMs !== undefined && nowMs - lastSentAtMs < minGapMs) {
    return { shouldSend: false, reason: "rate-limited: too soon since last send" };
  }

  return { shouldSend: true };
}

/**
 * Whether the given hour falls inside a quiet-hours window.
 *
 * Handles wrap-around windows (e.g. 22 → 7 means "10pm to 7am").
 * The window is half-open on the start side and closed on the end side:
 * a quietHours of `{start: 22, end: 7}` matches hours 22, 23, 0, 1, 2, 3, 4, 5, 6.
 */
export function isInQuietHours(
  hour: number,
  window: { start: number; end: number },
): boolean {
  const { start, end } = window;
  if (start === end) return false;
  if (start < end) {
    return hour >= start && hour < end;
  }
  // Wrap-around (overnight) window.
  return hour >= start || hour < end;
}

/**
 * Interpolate a notification's variables into its title and body.
 *   - `{{name}}` → `variables.name`
 *   - Missing keys are left as the literal `{{name}}`.
 */
export function interpolate(
  template: string,
  variables: Record<string, string | number> = {},
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(variables, key)
      ? String(variables[key])
      : match;
  });
}

/**
 * Format a notification for delivery over a specific channel.
 *
 *   - `email`     → `{ subject, body }`
 *   - `sms`       → `{ body }` (truncated to 160 chars)
 *   - `push`      → `{ title, body }` (body truncated to 100 chars)
 *   - `in_app`    → `{ title, body }`
 *   - `webhook`   → `{ payload }` (the full notification object)
 */
export interface FormattedNotification {
  channel: NotificationChannel;
  subject?: string;
  title?: string;
  body: string;
  payload?: unknown;
}

export function formatNotification(
  notification: Notification,
  channel: NotificationChannel,
): FormattedNotification {
  const title = interpolate(notification.title, notification.variables);
  const body = interpolate(notification.body, notification.variables);
  switch (channel) {
    case "email":
      return { channel, subject: title, body };
    case "sms":
      return { channel, body: body.slice(0, 160) };
    case "push":
      return { channel, title, body: body.slice(0, 100) };
    case "in_app":
      return { channel, title, body };
    case "webhook":
      return { channel, body, payload: notification };
  }
}

/**
 * Build a notification object with sensible defaults.
 */
export function makeNotification(
  partial: Partial<Notification> & Pick<Notification, "id" | "kind" | "title" | "body" | "userId" | "createdAtMs">,
): Notification {
  return {
    channels: ["in_app"],
    priority: "normal",
    ...partial,
  };
}
