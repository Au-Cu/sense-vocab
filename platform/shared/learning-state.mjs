import { SENSE_STATUSES, assertStableIdentity } from "./product-contract.mjs";

const NEXT = Object.freeze({
  new: ["reinforce", "mastered"],
  reinforce: ["review", "mastered", "new"],
  review: ["mastered", "reinforce"],
  mastered: ["review", "reinforce"],
});

export function transitionSense({ identity, from, to, learningDay, occurredAt }) {
  assertStableIdentity(identity);
  if (!SENSE_STATUSES.includes(from) || !SENSE_STATUSES.includes(to)) throw new TypeError("unknown sense status");
  if (!NEXT[from].includes(to)) throw new RangeError(`invalid sense transition: ${from} -> ${to}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(learningDay)) throw new TypeError("learningDay must be YYYY-MM-DD");
  const timestamp = occurredAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(timestamp))) throw new TypeError("occurredAt must be an ISO timestamp");
  return { identity: { ...identity }, from, to, learningDay, occurredAt: timestamp };
}

export function createInitialSenseState(identity) {
  return { identity: assertStableIdentity(identity), status: "new", learningDay: null, revision: 0 };
}
