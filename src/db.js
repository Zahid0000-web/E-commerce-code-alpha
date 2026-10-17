const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(process.env.DB_FILE || path.join(__dirname, '..', 'store.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  category TEXT NOT NULL,
  image_url TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  total_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  shipping_name TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);
`);

function seed() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  const productImages = {
    'Wireless Headphones': '/images/headphones.jpg',
    'Mechanical Keyboard': '/images/keyboard.jpg',
    'Smart Watch': '/images/smartwatch.jpg',
    'Portable Speaker': '/images/speaker.jpg',
    'Canvas Backpack': '/images/backpack.jpg',
    'Classic Sunglasses': '/images/sunglasses.jpg',
    'Running Shoes': '/images/sneakers.jpg',
    'Leather Wallet': '/images/wallet.jpg',
    'Ceramic Coffee Mug Set': '/images/mugs.jpg',
    'Desk Lamp': '/images/desklamp.jpg',
    'Scented Candle Trio': '/images/candles.jpg',
    'Yoga Mat': '/images/yogamat.jpg',
  };

  if (count > 0) {
    const updateImage = db.prepare(
      "UPDATE products SET image_url = ? WHERE name = ? AND image_url LIKE 'https://picsum.photos/%'"
    );
    const migrateImages = db.transaction(() => {
      Object.entries(productImages).forEach(([name, imageUrl]) => updateImage.run(imageUrl, name));
    });
    migrateImages();
    return;
  }

  const insert = db.prepare(
    'INSERT INTO products (name, description, price_cents, category, image_url, stock) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const items = [
    ['Wireless Headphones', 'Over-ear Bluetooth headphones with active noise cancellation and 30-hour battery life.', 8999, 'Electronics', productImages['Wireless Headphones'], 25],
    ['Mechanical Keyboard', 'Compact 75% mechanical keyboard with hot-swappable switches and RGB backlight.', 6499, 'Electronics', productImages['Mechanical Keyboard'], 40],
    ['Smart Watch', 'Fitness tracking, heart-rate monitor, and 7-day battery in a slim aluminium case.', 12999, 'Electronics', productImages['Smart Watch'], 15],
    ['Portable Speaker', 'Waterproof Bluetooth speaker with deep bass and 12 hours of playtime.', 3999, 'Electronics', productImages['Portable Speaker'], 50],
    ['Canvas Backpack', 'Durable 20L water-resistant backpack with padded laptop sleeve.', 4599, 'Fashion', productImages['Canvas Backpack'], 35],
    ['Classic Sunglasses', 'UV400 polarized sunglasses with a lightweight acetate frame.', 2499, 'Fashion', productImages['Classic Sunglasses'], 60],
    ['Running Shoes', 'Breathable mesh running shoes with responsive cushioning.', 7999, 'Fashion', productImages['Running Shoes'], 30],
    ['Leather Wallet', 'Slim genuine-leather bifold wallet with RFID protection.', 2999, 'Fashion', productImages['Leather Wallet'], 45],
    ['Ceramic Coffee Mug Set', 'Set of four handmade 350ml ceramic mugs in assorted glazes.', 2899, 'Home', productImages['Ceramic Coffee Mug Set'], 55],
    ['Desk Lamp', 'Dimmable LED desk lamp with USB charging port and three colour modes.', 3499, 'Home', productImages['Desk Lamp'], 28],
    ['Scented Candle Trio', 'Soy wax candles in lavender, vanilla, and cedar with 40-hour burn time.', 1899, 'Home', productImages['Scented Candle Trio'], 70],
    ['Yoga Mat', 'Non-slip 6mm eco-friendly yoga mat with carrying strap.', 2699, 'Sports', productImages['Yoga Mat'], 42],
  ];
  const tx = db.transaction(() => items.forEach((i) => insert.run(...i)));
  tx();
}
seed();

module.exports = db;
