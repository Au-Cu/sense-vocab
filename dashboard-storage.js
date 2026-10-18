(function initDashboardStorage(global) {
  "use strict";

  const object = value => value && typeof value === "object" && !Array.isArray(value);
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

  function diffMap(previous, next) {
    return {
      set: Object.fromEntries(Object.entries(next).filter(([key, value]) => (
        !own(previous, key) || previous[key] !== value
      ))),
      remove: Object.keys(previous).filter(key => !own(next, key)),
    };
  }

  function applyDiff(previous, patch) {
    if (!object(patch?.set) || !Array.isArray(patch?.remove)) {
      throw new Error("Invalid dashboard history delta");
    }
    const result = new Map(Object.entries(previous));
    patch.remove.forEach(key => result.delete(key));
    Object.entries(patch.set).forEach(([key, value]) => result.set(key, value));
    return Object.fromEntries(result);
  }

  function encodeTimeline(bookId, snapshots) {
    let statuses = {};
    let enteredAt = {};
    const frames = Object.entries(snapshots).sort(([left], [right]) => left.localeCompare(right))
      .map(([id, snapshot]) => {
        if (!object(snapshot) || !object(snapshot.statuses) || !object(snapshot.enteredAt)) {
          statuses = object(snapshot?.statuses) ? snapshot.statuses : {};
          enteredAt = object(snapshot?.enteredAt) ? snapshot.enteredAt : {};
          return { id, raw: snapshot };
        }
        const { statuses: nextStatuses, enteredAt: nextEnteredAt, ...header } = snapshot;
        const frame = { id, header,
          statuses: diffMap(statuses, nextStatuses), enteredAt: diffMap(enteredAt, nextEnteredAt) };
        statuses = nextStatuses;
        enteredAt = nextEnteredAt;
        return frame;
      });
    return { format: "sense-vocab-dashboard-timeline", version: 1, bookId, frames };
  }

  function decodeTimeline(encoded, bookId) {
    if (encoded?.format !== "sense-vocab-dashboard-timeline" || encoded.version !== 1 ||
        encoded.bookId !== bookId || !Array.isArray(encoded.frames)) {
      throw new Error("Invalid dashboard history envelope");
    }
    let statuses = {};
    let enteredAt = {};
    const snapshots = new Map();
    encoded.frames.forEach(frame => {
      if (typeof frame?.id !== "string" || snapshots.has(frame.id)) {
        throw new Error("Invalid dashboard history frame");
      }
      if (own(frame, "raw")) {
        snapshots.set(frame.id, frame.raw);
        statuses = object(frame.raw?.statuses) ? frame.raw.statuses : {};
        enteredAt = object(frame.raw?.enteredAt) ? frame.raw.enteredAt : {};
        return;
      }
      if (!object(frame.header)) throw new Error("Invalid dashboard history header");
      statuses = applyDiff(statuses, frame.statuses);
      enteredAt = applyDiff(enteredAt, frame.enteredAt);
      snapshots.set(frame.id, { ...frame.header, statuses, enteredAt });
    });
    return Object.fromEntries(snapshots);
  }

  function encodeSidecar(envelope) {
    const { statuses, enteredAt, ...header } = envelope.snapshot;
    if (!object(statuses) || !object(enteredAt)) return envelope;
    const keys = [...new Set([...Object.keys(statuses), ...Object.keys(enteredAt)])];
    const values = [...new Set([...Object.values(statuses), ...Object.values(enteredAt)])];
    const indexes = new Map(values.map((value, index) => [value, index]));
    return { format: "sense-vocab-dashboard-columns", version: 1,
      bookId: envelope.bookId, snapshotId: envelope.snapshotId, header, values,
      rows: keys.map(key => [key, own(statuses, key) ? indexes.get(statuses[key]) : -1,
        own(enteredAt, key) ? indexes.get(enteredAt[key]) : -1]) };
  }

  function decodeSidecar(encoded) {
    if (encoded?.format !== "sense-vocab-dashboard-columns") return encoded;
    if (encoded.version !== 1 || !object(encoded.header) ||
        !Array.isArray(encoded.values) || !Array.isArray(encoded.rows)) {
      throw new Error("Invalid dashboard snapshot columns");
    }
    const statuses = new Map();
    const enteredAt = new Map();
    encoded.rows.forEach(row => {
      if (!Array.isArray(row) || typeof row[0] !== "string") {
        throw new Error("Invalid dashboard snapshot row");
      }
      [statuses, enteredAt].forEach((target, index) => {
        const position = row[index + 1];
        if (position === -1) return;
        if (!Number.isInteger(position) || position < 0 || position >= encoded.values.length) {
          throw new Error("Invalid dashboard snapshot value");
        }
        target.set(row[0], encoded.values[position]);
      });
    });
    return { bookId: encoded.bookId, snapshotId: encoded.snapshotId,
      snapshot: { ...encoded.header, statuses: Object.fromEntries(statuses),
        enteredAt: Object.fromEntries(enteredAt) } };
  }

  const api = Object.freeze({ encodeTimeline, decodeTimeline, encodeSidecar, decodeSidecar });
  global.SenseVocabDashboardStorage = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : window);
