/* Shared helpers: API client, auth state, cart (localStorage), header rendering */
const Store = (() => {
  const TOKEN_KEY = 'shop_token';
  const USER_KEY = 'shop_user';
  const CART_KEY = 'shop_cart';

  const money = (cents) => `$${(cents / 100).toFixed(2)}`;

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const getUser = () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
  };
  const setSession = (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  };
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    location.href = '/';
  };

  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`/api${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token && !path.startsWith('/auth/')) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  /* ----- Cart: [{ productId, name, price_cents, image_url, quantity, stock }] ----- */
  const getCart = () => {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
  };
  const saveCart = (cart) => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    renderCartCount();
  };
  const cartCount = () => getCart().reduce((n, i) => n + i.quantity, 0);
  const cartTotal = () => getCart().reduce((n, i) => n + i.price_cents * i.quantity, 0);

  function addToCart(product, qty = 1) {
    const cart = getCart();
    const existing = cart.find((i) => i.productId === product.id);
    const nextQty = (existing ? existing.quantity : 0) + qty;
    if (nextQty > product.stock) {
      toast(`Only ${product.stock} in stock`);
      return false;
    }
    if (existing) existing.quantity = nextQty;
    else cart.push({ productId: product.id, name: product.name, price_cents: product.price_cents, image_url: product.image_url, quantity: qty, stock: product.stock });
    saveCart(cart);
    toast(`Added "${product.name}" to cart`);
    return true;
  }
  const setQuantity = (productId, qty) => {
    let cart = getCart();
    if (qty <= 0) cart = cart.filter((i) => i.productId !== productId);
    else cart = cart.map((i) => (i.productId === productId ? { ...i, quantity: Math.min(qty, i.stock) } : i));
    saveCart(cart);
  };
  const clearCart = () => saveCart([]);

  /* ----- UI ----- */
  function toast(message) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function renderCartCount() {
    const el = document.getElementById('cart-count');
    if (el) {
      const count = cartCount();
      el.textContent = count;
      el.parentElement.setAttribute('aria-label', `Shopping bag, ${count} items`);
    }
  }

  function renderHeader() {
    const user = getUser();
    const host = document.getElementById('site-header');
    if (!host) return;
    const currentPage = location.pathname;
    const activeLink = (href) => (currentPage === href ? ' aria-current="page"' : '');
    host.innerHTML = `
      <div class="announcement"><span class="announcement-star" aria-hidden="true">✳</span> GOOD THINGS, THOUGHTFULLY CHOSEN <span class="announcement-divider" aria-hidden="true">·</span> YOUR EVERYDAY, A LITTLE MORE LOVELY</div>
      <header class="site"><div class="nav">
        <a class="logo" href="/" aria-label="ShopHub home"><span class="logo-mark" aria-hidden="true">s</span><span class="logo-word">shop<span>hub</span></span></a>
        <span class="spacer"></span>
        <a class="link" href="/"${activeLink('/')}>Discover</a>
        ${user
          ? `<a class="link" href="/orders.html"${activeLink('/orders.html')}>My orders</a>
             <span class="user-greeting">Hi, ${escapeHtml(user.name.split(' ')[0])}</span>
             <button class="link" id="logout-btn">Sign out</button>`
          : `<a class="link" href="/login.html"${activeLink('/login.html')}>Log in</a>
             <a class="link join-link" href="/register.html"${activeLink('/register.html')}>Join us <span aria-hidden="true">↗</span></a>`}
        <a class="cart-link${activeLink('/cart.html')}" href="/cart.html" aria-label="Shopping bag, 0 items">Bag<span class="badge" id="cart-count">0</span></a>
      </div></header>`;
    host.querySelector('.cart-link').setAttribute('aria-label', `Shopping bag, ${cartCount()} items`);
    const btn = document.getElementById('logout-btn');
    if (btn) btn.addEventListener('click', logout);
    renderCartCount();
  }

  document.addEventListener('DOMContentLoaded', renderHeader);

  return { money, escapeHtml, api, getUser, getToken, setSession, logout, getCart, cartTotal, addToCart, setQuantity, clearCart, toast };
})();
