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

Apply mode will be added after preview is reviewed.

Expected behavior:

- update only products with non-conflicting changes by default;
- write normalization logs;
- support batch size and dry-run flags;
- preserve old values in logs for audit and rollback.

## Future filter index

For fast category filters, add an index table after normalization stabilizes:

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

## Rollout plan

1. Implement parser and preview tRPC endpoint.
2. Add admin preview page/button.
3. Review preview output on production data.
4. Implement apply endpoint with logs.
5. Add filter index table and rebuild job.
6. Add scheduled/after-sync automation.
