const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'flashsell-secret-key';
const DB_PATH = path.join(__dirname, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

function readDB() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { users: [], products: [], orders: [] };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  next();
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'FlashSell API is live' });
});

app.get('/api/products', (req, res) => {
  const db = readDB();
  res.json({ products: db.products || [] });
});

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  const db = readDB();
  if (db.users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ message: 'User already exists.' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = {
    id: `user-${Date.now()}`,
    name,
    email,
    password: hashedPassword,
    role: 'customer',
    createdAt: new Date().toISOString(),
  };

  db.users.push(user);
  writeDB(db);

  return res.status(201).json({
    message: 'Account created successfully.',
    token: generateToken(user),
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required.' });

  const db = readDB();
  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return res.status(401).json({ message: 'Invalid credentials.' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });

  return res.json({
    message: 'Login successful.',
    token: generateToken(user),
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

app.get('/api/orders', authMiddleware, (req, res) => {
  const db = readDB();
  const orders = req.user.role === 'admin' ? db.orders : db.orders.filter((o) => o.customerId === req.user.id);
  res.json({ orders });
});

app.post('/api/orders', authMiddleware, (req, res) => {
  const { items, customerName, contact } = req.body;
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: 'Cart is empty.' });
  }

  const db = readDB();
  const productMap = Object.fromEntries(db.products.map((p) => [p.id, p]));

  const normalizedItems = items.map((item) => {
    const product = productMap[item.productId];
    if (!product) throw new Error(`Product not found: ${item.productId}`);
    const quantity = Number(item.quantity) || 1;
    return {
      productId: product.id,
      name: product.name,
      network: product.network,
      quantity,
      unitPrice: product.price,
      total: product.price * quantity,
    };
  });

  const total = normalizedItems.reduce((sum, item) => sum + item.total, 0);
  const order = {
    id: `ord-${Date.now()}`,
    customerId: req.user.id,
    customerName: customerName || req.user.name,
    contact: contact || req.user.email,
    items: normalizedItems,
    total,
    status: 'completed',
    createdAt: new Date().toISOString(),
  };

  db.orders.unshift(order);
  writeDB(db);

  res.status(201).json({ message: 'Order placed successfully.', order });
});

app.get('/api/admin/stats', authMiddleware, adminOnly, (req, res) => {
  const db = readDB();
  const totalRevenue = db.orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const orders = db.orders.length;
  const users = db.users.length;

  const topProducts = db.products.slice(0, 4).map((product, index) => ({
    name: product.name,
    sales: index + 5,
    revenue: product.price * (index + 5),
  }));

  res.json({
    totals: { revenue: totalRevenue, orders, users, pending: 0 },
    topProducts,
  });
});

async function seedData() {
  const db = readDB();

  if (!db.users.length) {
    const adminPassword = await bcrypt.hash('Admin@123', 10);
    db.users.push({
      id: 'admin-001',
      name: 'System Admin',
      email: 'admin@flashsell.com',
      password: adminPassword,
      role: 'admin',
      createdAt: new Date().toISOString(),
    });
  }

  if (!db.products.length) {
    db.products = [
      { id: 'mtn-1', network: 'MTN', category: 'data', name: '1.5GB Daily', price: 300, validity: '1 day', description: 'Fast daily internet', image: '📶' },
      { id: 'mtn-2', network: 'MTN', category: 'data', name: '2GB Weekly', price: 500, validity: '3 days', description: 'Smooth browser and social use', image: '📶' },
      { id: 'mtn-3', network: 'MTN', category: 'data', name: '5GB Monthly', price: 1200, validity: '7 days', description: 'Reliable monthly internet bundle', image: '📶' },
      { id: 'glo-1', network: 'Glo', category: 'data', name: '1GB Flex', price: 280, validity: '1 day', description: 'Affordable browsing plan', image: '📡' },
      { id: 'airtel-1', network: 'Airtel', category: 'data', name: '2GB Special', price: 500, validity: '3 days', description: 'Daily streaming and calls', image: '📲' },
      { id: 'airtime-1', network: 'MTN', category: 'airtime', name: 'MTN Airtime Top-up', price: 1000, validity: 'Instant', description: 'Instant airtime recharge', image: '💰' },
      { id: 'airtime-2', network: 'Airtel', category: 'airtime', name: 'Airtel Airtime Top-up', price: 1500, validity: 'Instant', description: 'Instant airtime recharge', image: '💰' }
    ];
  }

  writeDB(db);
}

app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

seedData().then(() => {
  app.listen(PORT, () => console.log(`FlashSell app running on http://localhost:${PORT}`));
});
