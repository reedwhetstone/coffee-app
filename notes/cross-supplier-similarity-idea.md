# Purveyors Cross-Supplier Similarity Scoring

**Created:** 2026-06-01
**Type:** Product insight
**Related:** [[../MOC-coffee-platform|Coffee Platform MOC]]

Similarity scoring on catalog pages should default to cross-supplier comparison rather than same-supplier comparison.

Core assumption: a supplier is unlikely to list the same physical coffee twice on its own site. Same-supplier near-duplicates are therefore less useful for the buyer-facing similarity metric than competitor matches across suppliers.

Product implication:

- Catalog similarity modules should exclude candidate beans from the same supplier by default.
- The primary user value is discovering comparable alternatives, price spreads, and substitute lots across competing suppliers.
- Same-supplier duplicates can still be useful, but they belong in a separate data-quality or duplicate-detection audit mode, not the default catalog similarity experience.

Implementation note:

- Similarity queries should include a default `candidate.supplier_id != target.supplier_id` filter for buyer-facing surfaces.
- If an internal mode is needed later, expose it explicitly as `include_same_supplier` or `mode = 'duplicate_audit'`, not as the default behavior.
