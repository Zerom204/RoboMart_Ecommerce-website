// ─────────────────────────────────────────────────────────────────────────────
// RoboMart Cloudflare Worker
// Deploy: wrangler deploy
// Bindings needed in wrangler.toml:
//   [[d1_databases]]  name = "DB"  database_name = "robomart-db"
//   [[r2_buckets]]    name = "R2"  bucket_name   = "robomart-images"
// ─────────────────────────────────────────────────────────────────────────────

import { Hono } from "hono";
import { cors } from "hono/cors";
import { jwt, sign, verify } from "hono/jwt";

const app = new Hono();
const JWT_SECRET = "REPLACE_WITH_A_LONG_RANDOM_SECRET_STRING_32CHARS";

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use("*", cors({
  origin: ["https://your-app.vercel.app", "http://localhost:3000"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// ── Auth helpers ──────────────────────────────────────────────────────────────
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getUser(c) {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const payload = await verify(auth.slice(7), JWT_SECRET);
    return payload;
  } catch { return null; }
}

// ── Auth routes ───────────────────────────────────────────────────────────────

// POST /api/auth/signup
app.post("/api/auth/signup", async (c) => {
  const { name, email, password, role } = await c.req.json();
  if (!name || !email || !password || !["buyer","seller"].includes(role)) {
    return c.json({ error: "Invalid input" }, 400);
  }
  const db = c.env.DB;
  const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return c.json({ error: "Email already registered" }, 409);

  const hashed = await hashPassword(password);
  const result = await db.prepare(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id"
  ).bind(name, email, hashed, role).first();

  const user = { id: result.id, name, email, role };
  const token = await sign({ ...user, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }, JWT_SECRET);
  return c.json({ user, token }, 201);
});

// POST /api/auth/signin
app.post("/api/auth/signin", async (c) => {
  const { email, password } = await c.req.json();
  const db = c.env.DB;
  const row = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  if (!row) return c.json({ error: "Invalid credentials" }, 401);

  const hashed = await hashPassword(password);
  if (hashed !== row.password_hash) return c.json({ error: "Invalid credentials" }, 401);

  const user = { id: row.id, name: row.name, email: row.email, role: row.role };
  const token = await sign({ ...user, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }, JWT_SECRET);
  return c.json({ user, token });
});

// ── Product routes ────────────────────────────────────────────────────────────

// GET /api/products
app.get("/api/products", async (c) => {
  const db = c.env.DB;
  const { results } = await db.prepare(`
    SELECT p.*, u.name AS seller_name
    FROM products p
    LEFT JOIN users u ON p.seller_id = u.id
    ORDER BY p.created_at DESC
  `).all();
  return c.json(results);
});

// GET /api/products/:id
app.get("/api/products/:id", async (c) => {
  const db = c.env.DB;
  const row = await db.prepare(`
    SELECT p.*, u.name AS seller_name
    FROM products p LEFT JOIN users u ON p.seller_id = u.id
    WHERE p.id = ?
  `).bind(c.req.param("id")).first();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

// POST /api/products  (seller only)
app.post("/api/products", async (c) => {
  const user = await getUser(c);
  if (!user || user.role !== "seller") return c.json({ error: "Sellers only" }, 403);

  const { name, price, category, stock, description, badge, image } = await c.req.json();
  if (!name || !price || !category) return c.json({ error: "Missing required fields" }, 400);

  const db = c.env.DB;
  const result = await db.prepare(
    "INSERT INTO products (name, price, category, stock, description, badge, image, seller_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id"
  ).bind(name, parseFloat(price), category, parseInt(stock) || 0, description || "", badge || "", image || null, user.id).first();

  return c.json({ id: result.id, message: "Product created" }, 201);
});

// ── Image upload via Cloudflare R2 ───────────────────────────────────────────

// POST /api/upload  (seller only)
app.post("/api/upload", async (c) => {
  const user = await getUser(c);
  if (!user || user.role !== "seller") return c.json({ error: "Sellers only" }, 403);

  const formData = await c.req.formData();
  const file = formData.get("file");
  if (!file) return c.json({ error: "No file provided" }, 400);

  const ext = file.name.split(".").pop() || "jpg";
  const key = `products/${user.id}-${Date.now()}.${ext}`;

  await c.env.R2.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  // Return public R2 URL (enable public access on your R2 bucket)
  const url = `https://pub-YOUR_R2_ACCOUNT_ID.r2.dev/${key}`;
  return c.json({ url, key });
});

// ── Orders ────────────────────────────────────────────────────────────────────

// POST /api/orders  (buyer only)
app.post("/api/orders", async (c) => {
  const user = await getUser(c);
  if (!user || user.role !== "buyer") return c.json({ error: "Buyers only" }, 403);

  const { items, total } = await c.req.json();
  const db = c.env.DB;

  const order = await db.prepare(
    "INSERT INTO orders (user_id, total, status) VALUES (?, ?, 'pending') RETURNING id"
  ).bind(user.id, total).first();

  for (const item of items) {
    await db.prepare(
      "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)"
    ).bind(order.id, item.id, item.qty, item.price).run();

    await db.prepare(
      "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?"
    ).bind(item.qty, item.id, item.qty).run();
  }

  return c.json({ orderId: order.id, message: "Order placed" }, 201);
});

// GET /api/orders  (buyer sees own orders)
app.get("/api/orders", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const db = c.env.DB;
  const { results } = await db.prepare(
    "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(user.id).all();
  return c.json(results);
});

export default app;
