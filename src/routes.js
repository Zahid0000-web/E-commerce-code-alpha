const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { signToken, requireAuth } = require('./auth');

const router = express.Router();

/* ---------- Auth ---------- */
router.post('/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Invalid email address' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const normalized = String(email).trim().toLowerCase();
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(normalized)) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }
  const hash = bcrypt.hashSync(String(password), 10);
  const info = db
    .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(String(name).trim(), normalized, hash);
  const user = { id: info.lastInsertRowid, name: String(name).trim(), email: normalized };
  res.status(201).json({ token: signToken(user), user });
});

router.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim().toLowerCase());
  if (!row || !bcrypt.compareSync(String(password), row.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  const user = { id: row.id, name: row.name, email: row.email };
  res.json({ token: signToken(user), user });
});

router.get('/auth/me', requireAuth, (req, res) => {
  res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email } });
});

/* ---------- Products ---------- */
router.get('/products', (req, res) => {
  const { q, category } = req.query;
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  if (category && category !== 'All') {
    sql += ' AND category = ?';
    params.push(category);
  }
  sql += ' ORDER BY id';
  res.json(db.prepare(sql).all(...params));
});

router.get('/categories', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all();
  res.json(rows.map((r) => r.category));
});

router.get('/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

/* ---------- Orders ---------- */
router.post('/orders', requireAuth, (req, res) => {
  const { items, shippingName, shippingAddress } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Your cart is empty' });
  if (!shippingName || !shippingAddress) return res.status(400).json({ error: 'Shipping name and address are required' });

  const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
  const decrement = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');

  try {
    const orderId = db.transaction(() => {
      let total = 0;
      const lines = [];
      for (const item of items) {
        const qty = Number(item.quantity);
        if (!Number.isInteger(qty) || qty < 1) throw new Error('Invalid quantity');
        const product = getProduct.get(item.productId);
        if (!product) throw new Error('A product in your cart no longer exists');
        if (decrement.run(qty, product.id, qty).changes === 0) {
          throw new Error(`Not enough stock for "${product.name}"`);
        }
        total += product.price_cents * qty;
        lines.push({ product, qty });
      }
      const info = db
        .prepare('INSERT INTO orders (user_id, total_cents, shipping_name, shipping_address) VALUES (?, ?, ?, ?)')
        .run(req.user.id, total, String(shippingName).trim(), String(shippingAddress).trim());
      const insertItem = db.prepare(
        'INSERT INTO order_items (order_id, product_id, name, price_cents, quantity) VALUES (?, ?, ?, ?, ?)'
      );
      for (const { product, qty } of lines) {
        insertItem.run(info.lastInsertRowid, product.id, product.name, product.price_cents, qty);
      }
      return info.lastInsertRowid;
    })();
    res.status(201).json({ orderId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/orders', requireAuth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  const itemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  res.json(orders.map((o) => ({ ...o, items: itemsStmt.all(o.id) })));
});

module.exports = router;
