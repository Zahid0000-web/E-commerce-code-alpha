// End-to-end API smoke test. Run with: npm test
process.env.DB_FILE = ':memory:';
const assert = require('assert');
const app = require('./server');

const server = app.listen(0, async () => {
  const base = `http://localhost:${server.address().port}`;
  const call = async (path, opts = {}, token) => {
    const res = await fetch(base + path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };

  try {
    let r = await call('/api/products');
    assert.strictEqual(r.status, 200);
    assert.ok(r.body.length >= 10, 'products seeded');

    r = await call('/api/products?q=keyboard');
    assert.strictEqual(r.body.length, 1, 'search works');

    r = await call('/api/products?category=Home');
    assert.ok(r.body.every((p) => p.category === 'Home'), 'category filter works');

    r = await call('/api/products/1');
    assert.strictEqual(r.body.id, 1);
    const stockBefore = r.body.stock;

    r = await call('/api/products/9999');
    assert.strictEqual(r.status, 404);

    r = await call('/api/orders', { method: 'POST', body: JSON.stringify({}) });
    assert.strictEqual(r.status, 401, 'orders need auth');

    r = await call('/api/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Test', email: 'a@b.co', password: '123' }) });
    assert.strictEqual(r.status, 400, 'short password rejected');

    r = await call('/api/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Test User', email: 'Test@Example.com', password: 'secret123' }) });
    assert.strictEqual(r.status, 201);
    const token = r.body.token;

    r = await call('/api/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Dup', email: 'test@example.com', password: 'secret123' }) });
    assert.strictEqual(r.status, 409, 'duplicate email rejected');

    r = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'test@example.com', password: 'wrong' }) });
    assert.strictEqual(r.status, 401);

    r = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'test@example.com', password: 'secret123' }) });
    assert.strictEqual(r.status, 200);

    r = await call('/api/orders', { method: 'POST', body: JSON.stringify({ items: [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }], shippingName: 'Test User', shippingAddress: '1 Main St' }) }, token);
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));

    r = await call('/api/products/1');
    assert.strictEqual(r.body.stock, stockBefore - 2, 'stock decremented');

    r = await call('/api/orders', { method: 'POST', body: JSON.stringify({ items: [{ productId: 1, quantity: 99999 }], shippingName: 'T', shippingAddress: 'X' }) }, token);
    assert.strictEqual(r.status, 400, 'over-stock rejected');

    r = await call('/api/orders', {}, token);
    assert.strictEqual(r.body.length, 1);
    assert.strictEqual(r.body[0].items.length, 2);
    assert.strictEqual(r.body[0].total_cents, 8999 * 2 + 6499, 'total computed server-side');

    console.log('All API tests passed');
    server.close();
  } catch (err) {
    console.error('TEST FAILED:', err.message);
    server.close();
    process.exit(1);
  }
});
