function compactSession(session) {
  if (!session || typeof session !== "object" || Array.isArray(session)) {
    return session;
  }
  const compact = { ...session };
  if (Array.isArray(compact.queue)) {
    compact.queue = compact.queue.map((card) => {
      if (!card || typeof card !== "object") return card;
      const next = { ...card };
      // Encounter snapshots duplicate progress for every queued card. They
      // are local crash-recovery material, not authoritative cloud data.
      delete next.encounterSnapshot;
      return next;
    });
  }
  return compact;
}

function compactSessions(state) {
  if (!state || typeof state !== "object") return state;
  // State is JSON-only.  Use the same portable clone primitive as the
  // persistence format so older Safari/Harmony engines do not fail before a
  // sync request is even created.
  const payload = JSON.parse(JSON.stringify(state));
  Object.values(payload.bookStates ?? {}).forEach((bookState) => {
    if (bookState && Object.hasOwn(bookState, "session")) {
      bookState.session = compactSession(bookState.session);
    }
  });
  if (Object.hasOwn(payload, "session")) payload.session = compactSession(payload.session);
  return payload;
}

// Normalized SQL tables need the core top-level fields. Supplemental fields
// already live in the active book; omitting their identical mirror is lossless.
export function compactStateUpload(state) {
  const payload = compactSessions(state);
  const active = payload?.bookStates?.[payload.activeBookId];
  if (!active) return payload;
  for (const key of [
    "dashboardSnapshots",
    "dashboardEvents",
    "_sync",
    "confusionLinks",
    "planTargetHistory",
  ]) {
    if (Object.hasOwn(active, key) &&
        JSON.stringify(payload[key]) === JSON.stringify(active[key])) {
      delete payload[key];
    }
  }
  return payload;
}
