const API_BASE = '/api';

const state = {
  products: [],
  cart: JSON.parse(localStorage.getItem('flashsell-cart') || '[]'),
  token: localStorage.getItem('flashsell-token') || '',
  user: JSON.parse(localStorage.getItem('flashsell-user') || 'null'),
  networkFilter: 'All',
  cateFilter: 'all',
  authMode: 'login',
};

const els = {
  productGrid: document.getElementById('productGrid'),
  cartItems: document.getElementById('cartItems'),
  cartCount: document.getElementById('cartCount'),
  subtotalValue: document.getElementById('subtotalValue'),
  feeValue: document.getElementById('feeValue'),
  totalValue: document.getElementById('totalValue'),
  checkoutTotal: document.getElementById('checkoutTotal'),
  authModal: document.getElementById('authModal'),
  authForm: document.getElementById('authForm'),
  showAuthBtn: document.getElementById('showAuthBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  signupNameGroup: document.getElementById('signupNameGroup'),
  authTabs: document.querySelectorAll('.auth-tab'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  checkoutModal: document.getElementById('checkoutModal'),
  checkoutBtn: document.getElementById('checkoutBtn'),
  closeCheckoutBtn: document.getElementById('closeCheckoutBtn'),
  checkoutForm: document.getElementById('checkoutForm'),
  dashboardSection: document.getElementById('dashboard'),
  ordersSection: document.getElementById('orders'),
  userOrdersList: document.getElementById('userOrdersList'),
  revenueStat: document.getElementById('revenueStat'),
  ordersStat: document.getElementById('ordersStat'),
  usersStat: document.getElementById('usersStat'),
  pendingStat: document.getElementById('pendingStat'),
  topProductsList: document.getElementById('topProductsList'),
  recentOrdersList: document.getElementById('recentOrdersList'),
};

function saveCart() { localStorage.setItem('flashsell-cart', JSON.stringify(state.cart)); }
function saveUser() { localStorage.setItem('flashsell-token', state.token || ''); localStorage.setItem('flashsell-user', JSON.stringify(state.user || null)); }

async function apiRequest(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(Number(value) || 0);
}

function renderProducts() {
  const filtered = state.products.filter((p) => {
    const networkOk = state.networkFilter === 'All' || p.network === state.networkFilter;
    const categoryOk = state.cateFilter === 'all' || p.category === state.cateFilter;
    return networkOk && categoryOk;
  });

  if (!filtered.length) {
    els.productGrid.innerHTML = '<div class="empty-cart">No products available for this filter.</div>';
    return;
  }

  els.productGrid.innerHTML = filtered.map(product => `
    <article class="product-card">
      <div class="product-badge">${product.image || '📦'}</div>
      <div class="product-top">
        <span class="product-network">${product.network}</span>
        <span class="product-network">${product.category}</span>
      </div>
      <h3>${product.name}</h3>
      <p>${product.description}</p>
      <div class="product-footer">
        <div class="price">${formatMoney(product.price)}</div>
        <button class="add-btn" data-product-id="${product.id}">Add</button>
      </div>
    </article>
  `).join('');

  document.querySelectorAll('.add-btn').forEach((btn) => btn.addEventListener('click', () => addToCart(btn.dataset.productId)));
}

async function loadProducts() {
  const data = await apiRequest('/products');
  state.products = data.products;
  renderProducts();
}

function addToCart(productId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;

  const existing = state.cart.find((item) => item.productId === productId);
  if (existing) existing.quantity += 1;
  else state.cart.push({ productId, quantity: 1 });

  saveCart();
  renderCart();
}

function updateCartItem(productId, delta) {
  const item = state.cart.find((entry) => entry.productId === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) state.cart = state.cart.filter((entry) => entry.productId !== productId);

  saveCart();
  renderCart();
}

function renderCart() {
  if (!state.cart.length) {
    els.cartItems.innerHTML = '<div class="empty-cart">Your cart is empty. Add a product to continue.</div>';
    updateTotals();
    return;
  }

  els.cartItems.innerHTML = state.cart.map((entry) => {
    const product = state.products.find((item) => item.id === entry.productId);
    if (!product) return '';
    return `
      <div class="cart-item">
        <div>
          <h4>${product.name}</h4>
          <div class="cart-meta">${product.network} • ${formatMoney(product.price)}</div>
          <div class="cart-controls">
            <button class="qty-btn" data-action="minus" data-product-id="${product.id}">−</button>
            <span>${entry.quantity}</span>
            <button class="qty-btn" data-action="plus" data-product-id="${product.id}">+</button>
          </div>
        </div>
        <strong>${formatMoney(product.price * entry.quantity)}</strong>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.qty-btn').forEach((btn) => btn.addEventListener('click', () => {
    updateCartItem(btn.dataset.productId, btn.dataset.action === 'plus' ? 1 : -1);
  }));

  updateTotals();
}

function updateTotals() {
  const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = state.cart.reduce((sum, item) => {
    const product = state.products.find((entry) => entry.id === item.productId);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);

  const fee = subtotal * 0.015;
  const total = subtotal + fee;

  els.cartCount.textContent = `${totalItems} item${totalItems === 1 ? '' : 's'}`;
  els.subtotalValue.textContent = formatMoney(subtotal);
  els.feeValue.textContent = formatMoney(fee);
  els.totalValue.textContent = formatMoney(total);
  els.checkoutTotal.textContent = formatMoney(total);
}

function showAuthModal() {
  els.authModal.classList.remove('hidden');
}

function hideAuthModal() {
  els.authModal.classList.add('hidden');
}

function toggleAuthMode(mode) {
  state.authMode = mode;
  els.authTabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.mode === mode));
  const isSignup = mode === 'signup';
  document.getElementById('signupNameGroup').classList.toggle('hidden', !isSignup);
  const submitBtn = els.authForm.querySelector('button[type="submit"]');
  submitBtn.textContent = isSignup ? 'Create Account' : 'Login';
}

async function handleAuth(event) {
  event.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const name = document.getElementById('signupName')?.value.trim();

  if (!email || !password) {
    alert('Please fill all required fields.');
    return;
  }

  try {
    const endpoint = state.authMode === 'signup' ? '/auth/signup' : '/auth/login';
    const payload = state.authMode === 'signup' ? { name, email, password } : { email, password };
    const data = await apiRequest(endpoint, { method: 'POST', body: JSON.stringify(payload) });

    state.token = data.token;
    state.user = data.user;
    saveUser();
    hideAuthModal();
    renderUserStatus();
    loadOrders();
    if (state.user.role === 'admin') loadAdminStats();
    alert(data.message || 'Authentication successful');
  } catch (error) {
    alert(error.message);
  }
}

function renderUserStatus() {
  const loggedIn = !!state.user;
  els.logoutBtn.classList.toggle('hidden', !loggedIn);
  els.showAuthBtn.textContent = loggedIn ? `Hi, ${state.user.name.split(' ')[0]}` : 'Login / Signup';

  if (loggedIn) {
    els.ordersSection.classList.remove('hidden');
    if (state.user.role === 'admin') els.dashboardSection.classList.remove('hidden');
  } else {
    els.ordersSection.classList.add('hidden');
    els.dashboardSection.classList.add('hidden');
  }
}

async function logout() {
  state.token = '';
  state.user = null;
  saveUser();
  renderUserStatus();
  alert('You have been logged out.');
}

async function loadOrders() {
  if (!state.user) {
    els.userOrdersList.innerHTML = '<div class="empty-cart">Login to view your orders.</div>';
    return;
  }

  try {
    const data = await apiRequest('/orders');
    const orders = data.orders || [];
    if (!orders.length) {
      els.userOrdersList.innerHTML = '<div class="empty-cart">No orders yet.</div>';
      return;
    }

    els.userOrdersList.innerHTML = orders.slice(0, 5).map(order => `
      <div class="order-row">
        <div>
          <strong>#${order.id}</strong>
          <div>${order.items.length} products</div>
        </div>
        <div>
          <strong>${formatMoney(order.total)}</strong>
          <div class="status-pill">${order.status}</div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error(error);
  }
}

async function loadAdminStats() {
  if (!state.user || state.user.role !== 'admin') return;

  try {
    const data = await apiRequest('/admin/stats');
    els.revenueStat.textContent = formatMoney(data.totals.revenue);
    els.ordersStat.textContent = data.totals.orders;
    els.usersStat.textContent = data.totals.users;
    els.pendingStat.textContent = data.totals.pending;
    els.topProductsList.innerHTML = (data.topProducts || []).map(product => `
      <div class="product-row"><span>${product.name}</span><strong>${product.sales} sales</strong></div>
    `).join('');

    els.recentOrdersList.innerHTML = state.products.slice(0, 4).map(product => `
      <div class="activity-row"><div><strong>${product.name}</strong><span>${product.network}</span></div><span class="status-pill">Live</span></div>
    `).join('');
  } catch (error) {
    console.error(error);
  }
}

function showCheckoutModal() {
  if (!state.cart.length) {
    alert('Your cart is empty.');
    return;
  }
  if (!state.user) {
    alert('Please login or create an account before checkout.');
    showAuthModal();
    return;
  }
  els.checkoutModal.classList.remove('hidden');
}

function hideCheckoutModal() {
  els.checkoutModal.classList.add('hidden');
}

async function handleCheckout(event) {
  event.preventDefault();
  const name = document.getElementById('checkoutName').value.trim();
  const contact = document.getElementById('checkoutContact').value.trim();

  if (!name || !contact) {
    alert('Complete the checkout form.');
    return;
  }

  try {
    await apiRequest('/orders', {
      method: 'POST',
      body: JSON.stringify({
        customerName: name,
        contact,
        items: state.cart.map((item) => ({ productId: item.productId, quantity: item.quantity }))
      })
    });

    state.cart = [];
    saveCart();
    renderCart();
    hideCheckoutModal();
    loadOrders();
    loadAdminStats();
    alert('Order submitted successfully.');
  } catch (error) {
    alert(error.message);
  }
}

function bindEvents() {
  els.showAuthBtn.addEventListener('click', showAuthModal);
  els.closeModalBtn.addEventListener('click', hideAuthModal);
  els.closeCheckoutBtn.addEventListener('click', hideCheckoutModal);
  els.checkoutBtn.addEventListener('click', showCheckoutModal);
  els.logoutBtn.addEventListener('click', logout);
  els.authForm.addEventListener('submit', handleAuth);
  els.checkoutForm.addEventListener('submit', handleCheckout);

  document.querySelectorAll('.chip[data-network]').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.networkFilter = chip.dataset.network;
      document.querySelectorAll('.chip[data-network]').forEach((item) => item.classList.toggle('active', item === chip));
      renderProducts();
    });
  });

  document.querySelectorAll('.chip[data-category]').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.cateFilter = chip.dataset.category;
      document.querySelectorAll('.chip[data-category]').forEach((item) => item.classList.toggle('active', item === chip));
      renderProducts();
    });
  });

  els.authTabs.forEach((tab) => tab.addEventListener('click', () => toggleAuthMode(tab.dataset.mode)));
  document.querySelectorAll('.pay-option').forEach((option) => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.pay-option').forEach((item) => item.classList.toggle('active', item === option));
      option.querySelector('input').checked = true;
    });
  });

  document.getElementById('refreshStatsBtn').addEventListener('click', loadAdminStats);
}

async function init() {
  bindEvents();
  renderCart();
  renderUserStatus();

  try {
    await loadProducts();
    if (state.user) {
      await loadOrders();
      if (state.user.role === 'admin') await loadAdminStats();
    }
  } catch (error) {
    console.error(error);
  }
}

document.addEventListener('DOMContentLoaded', init);
