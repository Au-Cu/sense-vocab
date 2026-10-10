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
  const payload = { ...state };
  const active = payload?.bookStates?.[payload.activeBookId];
  if (!active) return compactSessions(state);
  for (const key of [
    "dashboardSnapshots",
    "dashboardEvents",
    "_sync",
    "confusionLinks",
    "planTargetHistory",
  ]) {
    if (Object.hasOwn(active, key) &&
        (payload[key] === active[key] ||
         JSON.stringify(payload[key]) === JSON.stringify(active[key]))) {
      delete payload[key];
    }
  }
  // Omit identical mirrors before the JSON clone. A large chart history must
  // not consume another full set of objects only to be discarded immediately.
  return compactSessions(payload);
}

function utf8Bytes(text) {
  if (typeof TextEncoder === "function") {
    return new TextEncoder().encode(text);
  }
  // All supported browsers expose TextEncoder. This fallback keeps the
  // serializer usable in the small Node/browser test harness as well.
  return Uint8Array.from(unescape(encodeURIComponent(text)), (character) =>
    character.charCodeAt(0));
}

function decodeUtf8(bytes) {
  if (typeof TextDecoder === "function") {
    return new TextDecoder().decode(bytes);
  }
  return decodeURIComponent(String.fromCharCode(...bytes));
}

function hashBytes(bytes) {
  // The manifest identifies a resumable payload; it is not an auth token.
  // Two independent 32-bit FNV streams make accidental reuse vanishingly
  // unlikely without requiring async WebCrypto before an upload can begin.
  let first = 2166136261;
  let second = 2246822519;
  for (const value of bytes) {
    first ^= value;
    first = Math.imul(first, 16777619) >>> 0;
    second ^= value;
    second = Math.imul(second, 3266489917) >>> 0;
  }
  return `${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`;
}

export function splitStateUpload(state, maxBytes = 1000000) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1024) {
    throw new Error("Invalid staged upload chunk size");
  }
  const payload = compactStateUpload(state);
  const serialized = JSON.stringify(payload);
  const bytes = utf8Bytes(serialized);
  const chunks = [];
  for (let offset = 0; offset < bytes.byteLength; ) {
    let end = Math.min(offset + maxBytes, bytes.byteLength);
    // Do not split a UTF-8 continuation sequence. JSON remains byte-for-byte
    // reassemblable, including Chinese content and punctuation.
    while (end < bytes.byteLength && (bytes[end] & 0xc0) === 0x80) end -= 1;
    if (end <= offset) throw new Error("Unable to split staged upload payload");
    const data = decodeUtf8(bytes.slice(offset, end));
    chunks.push({ data, bytes: end - offset });
    offset = end;
  }
  return {
    chunks,
    totalBytes: bytes.byteLength,
    manifest: `${bytes.byteLength}:${chunks.length}:${hashBytes(bytes)}`,
  };
}
