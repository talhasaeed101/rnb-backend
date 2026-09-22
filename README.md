# RNB Collections Backend

Express + TypeScript + MongoDB API for the **RNB Admin Panel**.

## Important safety rules

- Connects **only** to MongoDB database `rnb_collections`
- **Never** connects to `zivora`
- Does **not** modify the customer-facing Next.js storefront
- Media uploads use Cloudflare R2 only (credentials stay server-side)
- Stripe is **not** implemented in this phase

## 1. Installation

```bash
cd rnb/backend
cp .env.example .env
npm install
```

## 2. Environment variables

Edit `.env`:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Atlas URI ending in `/rnb_collections` |
| `PORT` | Default `5000` |
| `NODE_ENV` | `development` / `production` |
| `JWT_SECRET` | Long random secret |
| `CLIENT_URL` / `ADMIN_URL` | CORS origins (`http://localhost:5173`) |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seed admin account |

Never commit `.env`. Never hardcode passwords.

## 3. MongoDB setup

Use Atlas Cluster0 with a **separate** database:

```
mongodb+srv://USER:PASSWORD@cluster0.9t6abjq.mongodb.net/rnb_collections?appName=Cluster0
```

The server refuses to start against database name `zivora`.

## 4. Media storage (Cloudflare R2)

Product images and videos use the same R2 bucket from existing `R2_*` env vars.

- Images: prefix `products/` via `POST /api/uploads/images`
- Videos: prefix `products/videos/` via `POST /api/uploads/videos`

Both routes require admin JWT. Cloudinary is not used by the RNB backend.

## 5. Admin seed

```bash
npm run seed:admin
```

Creates the admin once from `ADMIN_*` env vars. Does not seed products, categories, orders, customers, or promo codes.

## 6. Development commands

```bash
npm run seed:admin
npm run dev          # http://localhost:5000
npm run build
npm run start
```

## 7. API routes

| Method | Path | Auth |
|---|---|---|
| GET | `/api/health` | public |
| POST | `/api/auth/login` | public (rate limited) |
| GET | `/api/auth/me` | admin |
| POST | `/api/auth/logout` | admin |
| GET/POST | `/api/products` | GET public, POST admin |
| GET | `/api/products/:slug` | public |
| PUT/DELETE | `/api/products/:id` | admin (DELETE soft → inactive) |
| CRUD | `/api/categories` | writes admin |
| CRUD | `/api/orders` | admin |
| PATCH | `/api/orders/:id/status` | admin |
| PATCH | `/api/orders/:id/dispatch` | admin |
| GET/PUT/PATCH | `/api/customers` | admin |
| CRUD + validate | `/api/promo-codes` | validate can be public |
| GET | `/api/dashboard/*` | admin |
| POST/DELETE | `/api/uploads/images` / `videos` | admin |

Consistent JSON:

```json
{ "success": true, "data": {} }
```

Lists include `pagination`. Errors:

```json
{ "success": false, "message": "...", "errors": [] }
```

## 8. Admin integration

Admin Vite app (`rnb/admin`) uses:

```
VITE_API_URL=http://localhost:5000/api
```

Auth JWT is stored in `localStorage` and sent as `Authorization: Bearer <token>`.

## 9. Production notes

- Set strong `JWT_SECRET` and admin password
- Restrict CORS to real admin/client origins (no `*`)
- Keep R2 credentials server-side only
- Run behind HTTPS reverse proxy
- Do not drop or migrate the Zivora database

## Models

`Admin`, `Product`, `Category`, `Order`, `Customer`, `PromoCode`
