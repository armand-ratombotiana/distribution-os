import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateChannelScore,
  rankChannels,
  getTopChannel,
  type ChannelPriority,
} from "../lib/channel-priority-pure.ts";

const channels: ChannelPriority[] = [
  { id: "email", ctr: 0.05, cvr: 0.2, roi: 2.5, reach: 0.4 },
  { id: "paid_search", ctr: 0.08, cvr: 0.1, roi: 1.5, reach: 0.6 },
  { id: "social", ctr: 0.03, cvr: 0.05, roi: 0.8, reach: 0.8 },
];

test("calculateChannelScore returns a value in [0, 1] for valid inputs", () => {
  const s = calculateChannelScore(channels[0]);
  assert.ok(s >= 0 && s <= 1);
});

test("calculateChannelScore weights CTR/CVR/ROI/reach per the default weights", () => {
  // defaults: ctr=0.2, cvr=0.3, roi=0.3, reach=0.2 (normalised to sum 1)
  // email: 0.05*0.2 + 0.2*0.3 + 1*0.3 + 0.4*0.2 = 0.01 + 0.06 + 0.3 + 0.08 = 0.45
  const s = calculateChannelScore(channels[0]);
  assert.ok(Math.abs(s - 0.45) < 1e-9);
});

test("calculateChannelScore clamps ROI > 1 to 1", () => {
  const s = calculateChannelScore({ id: "x", ctr: 0, cvr: 0, roi: 5, reach: 0 });
  // Only ROI contributes (weight 0.3) and is clamped to 1 → 0.3
  assert.ok(Math.abs(s - 0.3) < 1e-9);
});

test("calculateChannelScore accepts custom weights and normalises them to sum 1", () => {
  const s = calculateChannelScore(channels[0], { ctr: 1, cvr: 0, roi: 0, reach: 0 });
  // Only CTR contributes → 0.05
  assert.ok(Math.abs(s - 0.05) < 1e-9);
});

test("rankChannels returns channels sorted by score descending with 1-based ranks", () => {
  const ranked = rankChannels(channels);
  assert.equal(ranked.length, 3);
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].rank, 2);
  assert.equal(ranked[2].rank, 3);
  assert.ok(ranked[0].score >= ranked[1].score);
  assert.ok(ranked[1].score >= ranked[2].score);
});

test("rankChannels breaks ties deterministically by channel id", () => {
  const tied: ChannelPriority[] = [
    { id: "z", ctr: 0.1, cvr: 0.1, roi: 1, reach: 0.1 },
    { id: "a", ctr: 0.1, cvr: 0.1, roi: 1, reach: 0.1 },
  ];
  const ranked = rankChannels(tied);
  assert.equal(ranked[0].channel.id, "a");
  assert.equal(ranked[1].channel.id, "z");
});

test("rankChannels returns an empty array for an empty channel list", () => {
  assert.deepEqual(rankChannels([]), []);
});

test("rankChannels treats non-array input as an empty list", () => {
  assert.deepEqual(rankChannels(undefined as unknown as ChannelPriority[]), []);
});

test("getTopChannel returns the highest-scoring channel", () => {
  // email: 0.45, paid_search: 0.08*0.2 + 0.1*0.3 + 1*0.3 + 0.6*0.2 = 0.016+0.03+0.3+0.12 = 0.466
  // social: 0.03*0.2 + 0.05*0.3 + 0.8*0.3 + 0.8*0.2 = 0.006+0.015+0.24+0.16 = 0.421
  // → paid_search wins
  const top = getTopChannel(channels);
  assert.equal(top?.id, "paid_search");
});

test("getTopChannel returns null for an empty channel list", () => {
  assert.equal(getTopChannel([]), null);
});
