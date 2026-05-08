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
5. **Detailed Logging:** Sync operations log deeply to both the DB (`sync_logs` table) and local `.log` files in `public/logs/`.

---

## 🌍 Production Deployment (REG.RU VPS)

The application is deployed on an **Ubuntu VPS** via **GitHub Actions**.

### Architecture
- **Process Manager:** PM2 keeps the Node.js compiled script (`dist/boot.js`) running.
- **Reverse Proxy:** Nginx listens on port 80 and proxies requests to `127.0.0.1:3000`.
- **Database:** MySQL 8 running natively on the VPS.

### CI/CD Workflow
Located in `.github/workflows/deploy.yml`. On every push to `master`:
1. SSH into the VPS (`195.208.2.100`).
2. Pull latest code from GitHub.
3. `npm ci` and `npm run db:push` (Schema migrations).
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
