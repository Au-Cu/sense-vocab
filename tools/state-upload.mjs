// Normalized SQL tables need the core top-level fields. Supplemental fields
// already live in the active book; omitting their identical mirror is lossless.
export function compactStateUpload(state) {
  const active = state?.bookStates?.[state.activeBookId];
  if (!active) return state;
  const payload = { ...state };
  for (const key of ["dashboardSnapshots", "dashboardEvents", "_sync", "confusionLinks"]) {
    if (Object.hasOwn(active, key) &&
        JSON.stringify(payload[key]) === JSON.stringify(active[key])) {
      delete payload[key];
    }
  }
  return payload;
}
