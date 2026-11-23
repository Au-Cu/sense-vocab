"""Pure, testable primitives for the two vocabulary universes.

Missing frequencies are distinct from a measured zero.  All senses remain
in the denominator; a missing vector makes the word-pair score unavailable.
"""

from __future__ import annotations

import math
import re
from itertools import combinations

import numpy as np


def frequency_weights(counts):
    """Laplace-smooth observed tag counts, estimating missing counts by their mean.

    None is unknown, 0 is an observed zero, and neither is a claim about a
    word's universal usage.  If every count is missing, use equal weights.
    """
    counts = list(counts)
    if not counts:
        raise ValueError("a word must contain at least one sense")
    for value in counts:
        if value is not None and (not isinstance(value, int) or isinstance(value, bool) or value < 0):
            raise ValueError("frequency counts must be non-negative integers or None")
    observed = [value for value in counts if value is not None]
    mean = sum(observed) / len(observed) if observed else 0.0
    smoothed = [(value if value is not None else mean) + 1.0 for value in counts]
    total = sum(smoothed)
    return [value / total for value in smoothed]


def weighted_vector(vectors, weights):
    """Return the unnormalised mean of unit sense vectors or None if incomplete."""
    if len(vectors) != len(weights) or not vectors:
        raise ValueError("every sense must have a weight and vector slot")
    if not math.isclose(sum(weights), 1.0, rel_tol=1e-7, abs_tol=1e-7):
        raise ValueError("weights must sum to one")
    if any(not math.isfinite(float(w)) or w < 0 for w in weights):
        raise ValueError("weights must be finite and non-negative")
    if any(vector is None for vector in vectors):
        return None
    matrix = np.asarray(vectors, dtype=np.float64)
    if matrix.ndim != 2 or not np.all(np.isfinite(matrix)):
        raise ValueError("invalid sense vectors")
    norms = np.linalg.norm(matrix, axis=1)
    if np.any(norms < 1e-12):
        raise ValueError("zero vector cannot represent a sense")
    return np.asarray(weights, dtype=np.float64) @ (matrix / norms[:, None])


def weighted_similarity(left, left_weights, right, right_weights):
    a = weighted_vector(left, left_weights)
    b = weighted_vector(right, right_weights)
    return None if a is None or b is None else float(a @ b)


def wordnet_key(word, pos, synset_id):
    """Parse only explicit OMW English WordNet 3.0 identity and agreeing POS."""
    match = re.fullmatch(r"omw-en-(\d{8})-([nvars])", synset_id or "")
    if not match:
        return None
    offset, tag = match.groups()
    tag = "a" if tag == "s" else tag
    expected = {"n.": "n", "v.": "v", "adj.": "a", "adv.": "r"}.get(pos)
    if tag != expected:
        return None
    return (word.strip().lower().replace(" ", "_"), offset, tag)


def spelling_form(word):
    value = word.strip().lower()
    return value if re.fullmatch(r"[a-z]+", value) else None


def deletion_signatures(word, max_deletes=2):
    signatures = {word}
    for count in range(1, min(max_deletes, len(word)) + 1):
        for removed in combinations(range(len(word)), count):
            removed = set(removed)
            signatures.add("".join(char for i, char in enumerate(word) if i not in removed))
    return signatures


def damerau_osa(a, b):
    """Optimal string alignment edit distance; allows adjacent transposition."""
    m, n = len(a), len(b)
    rows = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        rows[i][0] = i
    for j in range(n + 1):
        rows[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            rows[i][j] = min(rows[i - 1][j] + 1, rows[i][j - 1] + 1,
                             rows[i - 1][j - 1] + (a[i - 1] != b[j - 1]))
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                rows[i][j] = min(rows[i][j], rows[i - 2][j - 2] + 1)
    return rows[m][n]


def spelling_threshold(a, b):
    return 1 if min(len(a), len(b)) < 5 else 2
