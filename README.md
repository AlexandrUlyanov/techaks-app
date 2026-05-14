# TechAks E-commerce Platform

Modern, high-performance e-commerce platform with deep MoySklad (МойСклад) synchronization, built with React, Hono, tRPC, and Drizzle ORM.

## 🚀 Tech Stack

### Frontend
- **Framework:** React 19 + Vite
- **Routing:** React Router v7
- **Styling:** Tailwind CSS + UI components (Radix UI, Lucide icons)
- **State/Data Fetching:** tRPC (React Query) + Zustand
- **Animations:** GSAP

### Backend
- **Framework:** Hono (Node.js Adapter)
- **API:** tRPC
- **Database:** MySQL
- **ORM:** Drizzle ORM

---

## 🛠️ Local Development Setup

1. **Clone & Install:**
   ```bash
   git clone https://github.com/AlexandrUlyanov/techaks-app.git
   cd techaks-app/app
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file in the `app` directory:
   ```env
   DATABASE_URL="mysql://root:root@localhost:3306/tehax"
   PORT=3000
   NODE_ENV=development
   ```

3. **Database Setup:**
   Ensure MySQL is running locally and the database exists. Then push the schema:
   ```bash
   npm run db:push
   ```

4. **Start Development Server:**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

---

## 🔄 MoySklad (МойСклад) Synchronization

The platform includes a robust, 4-step wizard in the Admin Panel (`/admin/sync`) for pulling data from MoySklad API v1.2.

### Features
1. **Hierarchical Categories:** Preserves nested folders from MoySklad. Parent logic is linked via 2-pass DB updating.
2. **Auto-Slugs:** Converts Cyrillic names to Latin SEO-friendly URLs (`slugify`). Uses `ms_id` to prevent duplication on re-sync.
3. **Images Persistence:** Images are downloaded into category-specific folders under `public/images/`. This ensures files survive backend rebuilds.
4. **Fuzzy Store Matching:** Accurately maps MoySklad warehouses/stores to local DB stores by analyzing `name` and `address` strings.
5. **Store-to-Warehouse Binding:** Local stores now keep `stores.ms_id` with explicit warehouse binding. In Admin Stores, each card supports manual binding via "Привязать склад" and selection from live MoySklad warehouse list.
5. **Detailed Logging:** Sync operations log deeply to both the DB (`sync_logs` table) and local `.log` files in `public/logs/`.

### Store Binding in Admin

- Page: `/admin/stores`
- Each store card shows current binding status.
- Action flow:
  1. Click `Привязать склад`.
  2. Select warehouse from list (fetched via `sync.getStores`).
  3. Click `Сохранить`.
- Binding is persisted in `stores.ms_id` and reused during stock synchronization.

---

## 🧩 Catalog & UX Notes (Current)

- Catalog top switcher `Категории/Производители` removed from customer page header.
- Brand strip removed from product list pages; brand filtering remains in filters.
- Product list filters can display small brand logos for `Производитель/Бренд`.
- Sorting control on catalog page uses a custom dropdown (non-blocking), replacing Radix `Select` to avoid mobile scroll lock/layout jump.
- Mobile header simplified:
  - profile and cart icons removed from top bar;
  - catalog trigger displays text-only `Каталог` on mobile.
- Mobile bottom bar updated:
  - removed `Главная` and `Каталог`;
  - added call action button (`tel:+79273750555`);
  - cart icon aligned to product-card style (`ShoppingCart`).

---

## 🌍 Production Deployment (REG.RU VPS)

The application is deployed on an **Ubuntu VPS** via **GitHub Actions**.

### Architecture
- **Server size:** 1 vCPU, 1 GB RAM, 10 GB disk.
- **Process Manager:** PM2 keeps the Node.js compiled script (`dist/boot.js`) running.
- **Reverse Proxy:** Nginx listens on port 80 and proxies requests to `127.0.0.1:3000`.
- **Database:** MySQL 8 running natively on the VPS.

Production maintenance jobs must account for the small VPS size: keep them
sequential, use explicit batch limits, and avoid loading the whole catalog into
memory at once.

### CI/CD Workflow
Located in `.github/workflows/deploy.yml`. On every push to `master`:
1. SSH into the VPS (`195.208.2.100`).
2. Pull latest code from GitHub.
3. `npm ci` and `npm run db:push` (Schema migrations).
4. Apply deterministic SQL updates for store profiles (name/address/hours/phone/rating/review_count/image/map_url/sort_order), including fallback insert for Zastava card if missing.
4. `npm run build` (Vite compiles frontend to `dist/public` and backend to `dist/boot.js`).
5. `pm2 restart techaks` applies the new build.

### Useful Server Commands (SSH)
```bash
# Check app logs
pm2 logs techaks

# Restart app
pm2 restart techaks

# Check Nginx config
nginx -t
```

## 🌐 Primary Domain: `techaks.ru`

Use `techaks.ru` as the only canonical storefront host.

### 1) DNS
Create records at your DNS provider:

- `A` record: `techaks.ru` -> `195.208.2.100`
- `A` record: `www.techaks.ru` -> `195.208.2.100`

Recommended TTL for cutover: `300`.

### 2) Nginx (HTTP + canonical redirect)
On the server:

```bash
sudo cp /var/www/techaks/nginx.conf.example /etc/nginx/sites-available/techaks
sudo ln -sf /etc/nginx/sites-available/techaks /etc/nginx/sites-enabled/techaks
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

This config already redirects `www.techaks.ru` to `techaks.ru`.

### 3) SSL (Let's Encrypt)
Issue certificates and enable HTTPS redirect:

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d techaks.ru -d www.techaks.ru --redirect -m info@techaks.ru --agree-tos --no-eff-email
```

### 4) Verification
```bash
curl -I http://www.techaks.ru
curl -I http://techaks.ru
curl -I https://techaks.ru
```

Expected:
- `www` -> `301` to `https://techaks.ru/...`
- `http://techaks.ru` -> `301` to `https://techaks.ru/...`
- `https://techaks.ru` -> `200`
