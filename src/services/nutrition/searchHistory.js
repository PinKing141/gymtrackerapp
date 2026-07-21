const MAX_RECENT_SEARCHES = 8;

// Most-recent-first, case-insensitively deduped, capped list of past search
// terms. Pure so the ordering/dedupe/cap rules are unit-testable without a
// screen attached.
export function addRecentSearch(recentSearches, term) {
  const trimmed = String(term || "").trim();
  if (trimmed.length < 2) {
    return recentSearches;
  }
  const withoutDuplicate = (recentSearches || []).filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase());
  return [trimmed, ...withoutDuplicate].slice(0, MAX_RECENT_SEARCHES);
}

export function removeRecentSearch(recentSearches, term) {
  return (recentSearches || []).filter((entry) => entry.toLowerCase() !== String(term || "").toLowerCase());
}
