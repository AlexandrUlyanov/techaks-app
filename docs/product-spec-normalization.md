# Product spec normalization

## Problem

Many products synced from MoySklad have technical attributes stored in
`products.description` as plain text lines, for example:

```text
Тип устройства: Зонт автоматический
Производитель: HOCO
Цвет: Черный
```

At the same time `products.specs` often contains only a small subset of real
attributes, such as warranty. This blocks category filters because filterable
values must be structured and consistently named.

## Goals

- Move key-value lines from `products.description` into `products.specs`.
- Keep real human-readable description text in `products.description`.
- Normalize common key names and typos.
- Detect conflicts without silently overwriting existing specs.
- Provide a safe preview before applying database changes.
- Produce data suitable for future category filters.

## Non-goals

- Do not use AI to rewrite product copy in the first version.
- Do not delete existing specs blindly.
- Do not build the final filter UI in the first normalization step.

## Parsing rules

A description line is treated as a spec when it matches:

```text
Key: value
```

The parser must:

- trim whitespace around key and value;
- ignore empty keys or values;
- skip lines with very long keys;
- keep non key-value lines as description text;
- merge parsed specs into existing `products.specs`;
- normalize known key aliases.

Initial key aliases:

- `Прозводитель` -> `Производитель`
- `Производители` -> `Производитель`
- `Материалы` -> `Материал`
- `Цвета` -> `Цвет`
- `Тип товара` -> `Тип`
- `Тип устройства` -> `Тип`

## Conflict policy

When a parsed key already exists in `products.specs`:

- same value: keep existing value, no conflict;
- different value: do not overwrite in preview or safe apply;
- report conflict with product id, key, existing value, parsed value.

## Preview mode

Preview mode must not write to the database.

It returns:

- scanned product count;
- changed product count;
- moved spec count;
- conflict count;
- top parsed keys;
- per-product examples with old description, new description, parsed specs,
  merged specs, and conflicts.

## Apply mode

Behavior:

- update only products with non-conflicting changes by default;
- write normalization logs;
- support batch size and dry-run flags;
- preserve old values in logs for audit and rollback.

## Filter index

For fast category filters, the normalized specs are copied into:

```text
product_spec_values
- id
- product_id
- category_id
- key
- normalized_key
- value
- normalized_value
```

The filter UI should read available keys/values from this table by category and
descendant categories.

The server exposes `product.getSpecFilters` for category-aware filter metadata.
The current frontend product-list filter UI can be added on top of that endpoint
without re-reading JSON specs from every product.

## Rollout plan

1. Implement parser and preview tRPC endpoint. Done.
2. Add admin preview page/button. Done.
3. Review preview output on production data. Done.
4. Implement apply endpoint with logs. Done.
5. Add filter index table and rebuild job. Done.
6. Add scheduled/after-sync automation. Done through post-sync normalization.
7. Add admin controls for key/value standardization visibility and filterability.
   Done in Admin Products panels.
8. Add optional AI standardization pipeline via configurable API/proxy settings.
   Done with admin settings + backend integration hooks.

## Production constraints

The production VPS currently has 2 vCPU, 2 GB RAM, and 38 GB disk.
Normalization and index rebuild jobs should still stay sequential, use
explicit limits, and avoid unbounded full-catalog in-memory transforms.

## Related admin capabilities

- Admin Products:
  - spec-key standardization;
  - spec-value standardization;
  - visibility/filterability management for filter keys.
- Admin Stores:
  - explicit store-to-warehouse binding (`stores.ms_id`) for stable stock sync
    interpretation.
