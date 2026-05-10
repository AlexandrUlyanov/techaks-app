# Admin Operations (Current)

## Stores

Page: `/admin/stores`

- Full CRUD for store cards.
- Manual warehouse binding:
  - click `Привязать склад` on a store card;
  - select a MoySklad warehouse from live list;
  - save binding to `stores.ms_id`.
- Card badge shows current binding status.

## Sync (MoySklad)

Page: `/admin/sync`

- Token/login-based authorization support.
- Step-by-step sync flow:
  1. warehouses,
  2. categories,
  3. products,
  4. stocks/prices.
- Fuzzy store matching by name/address; mapping persisted via `stores.ms_id`.
- Sync logs are written to DB and file logs.

## Merchandising

Page: `/admin/merchandising`

- Product scoring (`Merchandising Score`) for recommendation placements.
- Badge assignment and manual priority.
- Recommended pools used by homepage blocks including popular products.

## Product spec standardization

Page: `/admin/products`

- Key standardization and value standardization.
- Visibility/filterability control for category filters.
- Normalization can move key-value lines from description to specs and rebuild
  filter index.

## AI settings

Page: admin settings area

- API/proxy fields for AI-assisted standardization are configurable.
- Intended for external model routing (for example, Gemini via proxy).
