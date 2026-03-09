// ============================================================
//  MedTrack — Express + MongoDB Atlas Backend
//  File: server.js  (place this in your project ROOT)
// ============================================================

const express  = require('express');
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const cors     = require('cors');
const path     = require('path');
require('dotenv').config();          // loads .env file

const app = express();

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve CSS, JS and static assets from public/
app.use(express.static(path.join(__dirname, 'public')));
// NOTE: HTML files live under public/pages not a top-level "pages" folder.
// The second static middleware was pointing at a non-existent directory
// and caused 404 errors when the frontend tried to load pages. Remove it.

// ── MongoDB Connection ───────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Atlas connected successfully'))
  .catch(err => { console.error('❌ MongoDB connection error:', err.message); process.exit(1); });

// ============================================================
//  SCHEMAS & MODELS
// ============================================================

// ── User (Admin / Ward) ──────────────────────────────────────
const userSchema = new mongoose.Schema({
    email:     { type: String, required: true, unique: true, lowercase: true },
    password:  { type: String },                      // null for SSO users
    role:      { type: String, enum: ['admin','ward'], default: 'ward' },
    ward:      { type: String },                      // e.g. "ICU", "Pediatrics"
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// ── Medicine ─────────────────────────────────────────────────
const medicineSchema = new mongoose.Schema({
    name:       { type: String, required: true },
    expiry:     { type: String, required: true },     // "YYYY-MM-DD"
    quantity:   { type: Number, required: true, min: 0 },
    batch:      { type: String },
    price:      { type: Number, default: 0 },
    discount:   { type: Number, default: 0 },
    finalPrice: { type: Number, default: 0 },
    createdAt:  { type: Date, default: Date.now }
});
const Medicine = mongoose.model('Medicine', medicineSchema);

// ── Patient ──────────────────────────────────────────────────
const patientSchema = new mongoose.Schema({
    name:        { type: String, required: true },
    age:         { type: Number, required: true },
    gender:      { type: String, enum: ['Male','Female','Other'] },
    disease:     { type: String, required: true },
    nextRecheck: { type: String },
    medicines:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' }],
    createdAt:   { type: Date, default: Date.now }
});
const Patient = mongoose.model('Patient', patientSchema);

// ── Order ────────────────────────────────────────────────────
const orderItemSchema = new mongoose.Schema({
    medicineId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
    medicineName: String,
    quantity:     Number,
    unitPrice:    Number,
    discount:     Number,
    lineTotal:    Number
}, { _id: false });

const orderSchema = new mongoose.Schema({
    ward:        { type: String, required: true },
    room:        { type: String, required: true },
    doctor:      { type: String, default: 'Ward Staff' },
    items:       [orderItemSchema],
    // Legacy single-item support
    medicineId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
    medicineName: String,
    quantity:     Number,
    // Bill totals
    subtotal:    { type: Number, default: 0 },
    discount:    { type: Number, default: 0 },
    tax:         { type: Number, default: 0 },
    total:       { type: Number, default: 0 },
    status:      { type: String, enum: ['Pending','Processing','Delivered'], default: 'Pending' },
    date:        { type: String },
    time:        { type: String },
    createdAt:   { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// ============================================================
//  HELPERS
// ============================================================

// Verify JWT — used as middleware on protected routes
function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: 'No token provided' });
    const token = header.split(' ')[1];
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// Admin-only gate
function adminOnly(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access only' });
    next();
}

// Calculate bill from items array
function calcBill(items) {
    let subtotal = 0;
    let totalDiscount = 0;
    const processedItems = items.map(it => {
        const unit   = Number(it.unitPrice  || 0);
        const disc   = Number(it.discount   || 0);
        const qty    = Number(it.quantity   || 1);
        const discAmt  = unit * (disc / 100);
        const lineTotal = (unit - discAmt) * qty;
        subtotal      += unit * qty;
        totalDiscount += discAmt * qty;
        return { ...it, unitPrice: unit, discount: disc, lineTotal };
    });
    const afterDiscount = subtotal - totalDiscount;
    const tax   = parseFloat((afterDiscount * 0.05).toFixed(2));
    const total = parseFloat((afterDiscount + tax).toFixed(2));
    return { processedItems, subtotal, discount: totalDiscount, tax, total };
}

function nowStrings() {
    const now = new Date();
    return {
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0]
    };
}

// ============================================================
//  AUTH ROUTES
// ============================================================

// POST /api/login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password, googleToken } = req.body;

        let user = await User.findOne({ email });

        // --- Dev / demo shortcut: auto-create if not found ---
        // Remove this block in production!
        if (!user) {
            const isAdmin = email.includes('admin');
            const hashed  = password ? await bcrypt.hash(password, 10) : null;
            user = await User.create({
                email,
                password: hashed,
                role: isAdmin ? 'admin' : 'ward'
            });
        }
        // -----------------------------------------------------

        // Password check (skip for SSO token logins)
        if (!googleToken && password) {
            const valid = user.password && await bcrypt.compare(password, user.password);
            if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user._id, role: user.role, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({ token, role: user.role, email: user.email });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ============================================================
//  MEDICINE ROUTES  (admin: full CRUD | ward: read only)
// ============================================================

// GET /api/medicines — all roles
app.get('/api/medicines', authMiddleware, async (req, res) => {
    try {
        const medicines = await Medicine.find().sort({ createdAt: -1 });
        // normalize _id → id for frontend compatibility
        res.json(medicines.map(m => ({ ...m.toObject(), id: m._id })));
    } catch { res.status(500).json({ error: 'Failed to fetch medicines' }); }
});

// POST /api/medicines — admin only
app.post('/api/medicines', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { name, expiry, quantity, batch, price, discount } = req.body;
        const p = Number(price    || 0);
        const d = Number(discount || 0);
        const finalPrice = parseFloat((p - p * d / 100).toFixed(2));
        const med = await Medicine.create({ name, expiry, quantity: Number(quantity), batch, price: p, discount: d, finalPrice });
        res.status(201).json({ ...med.toObject(), id: med._id });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// PUT /api/medicines/:id — admin only
app.put('/api/medicines/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { name, expiry, quantity, batch, price, discount } = req.body;
        const p = Number(price    || 0);
        const d = Number(discount || 0);
        const finalPrice = parseFloat((p - p * d / 100).toFixed(2));
        const med = await Medicine.findByIdAndUpdate(
            req.params.id,
            { name, expiry, quantity: Number(quantity), batch, price: p, discount: d, finalPrice },
            { new: true }
        );
        if (!med) return res.status(404).json({ error: 'Medicine not found' });
        res.json({ ...med.toObject(), id: med._id });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/medicines/:id — admin only
app.delete('/api/medicines/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        await Medicine.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Delete failed' }); }
});

// POST /api/medicines/:id/reduce — reduce stock (used internally)
app.post('/api/medicines/:id/reduce', authMiddleware, async (req, res) => {
    try {
        const { quantity } = req.body;
        const med = await Medicine.findById(req.params.id);
        if (!med) return res.status(404).json({ error: 'Not found' });
        if (med.quantity < quantity) return res.status(400).json({ error: 'Insufficient stock' });
        med.quantity -= Number(quantity);
        await med.save();
        res.json({ ...med.toObject(), id: med._id });
    } catch { res.status(500).json({ error: 'Failed to reduce stock' }); }
});

// ============================================================
//  PATIENT ROUTES  (admin only)
// ============================================================

app.get('/api/patients', authMiddleware, adminOnly, async (req, res) => {
    try {
        const patients = await Patient.find().sort({ createdAt: -1 });
        res.json(patients.map(p => ({ ...p.toObject(), id: p._id })));
    } catch { res.status(500).json({ error: 'Failed to fetch patients' }); }
});

app.post('/api/patients', authMiddleware, adminOnly, async (req, res) => {
    try {
        const p = await Patient.create(req.body);
        res.status(201).json({ ...p.toObject(), id: p._id });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/patients/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const p = await Patient.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!p) return res.status(404).json({ error: 'Patient not found' });
        res.json({ ...p.toObject(), id: p._id });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/patients/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        await Patient.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Delete failed' }); }
});

// ============================================================
//  ORDER ROUTES
// ============================================================

// GET /api/orders
// Admin sees all; ward user sees only their ward's orders
app.get('/api/orders', authMiddleware, async (req, res) => {
    try {
        const filter = req.user.role === 'ward' ? { ward: req.user.ward } : {};
        const orders = await Order.find(filter).sort({ createdAt: -1 });
        res.json(orders.map(o => ({ ...o.toObject(), id: o._id })));
    } catch { res.status(500).json({ error: 'Failed to fetch orders' }); }
});

// POST /api/orders  (single-item legacy)
app.post('/api/orders', authMiddleware, async (req, res) => {
    try {
        const { medicineId, medicineName, quantity, ward, room, doctor } = req.body;
        const med = await Medicine.findById(medicineId);
        if (!med) return res.status(404).json({ error: 'Medicine not found' });
        if (med.quantity < quantity) return res.status(400).json({ error: 'Insufficient stock' });

        const item = { medicineId, medicineName, quantity: Number(quantity), unitPrice: med.price, discount: med.discount };
        const { processedItems, subtotal, discount, tax, total } = calcBill([item]);
        const { date, time } = nowStrings();

        const order = await Order.create({
            ward, room, doctor,
            items:        processedItems,
            medicineId,   medicineName,  quantity: Number(quantity),
            subtotal, discount, tax, total, date, time
        });

        // Reduce stock
        med.quantity -= Number(quantity);
        await med.save();

        res.status(201).json({
            ...order.toObject(), id: order._id,
            billAmount: total
        });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST /api/orders/cart  (multi-item — NEW)
app.post('/api/orders/cart', authMiddleware, async (req, res) => {
    try {
        const { ward, room, doctor, items } = req.body;
        if (!items || !items.length) return res.status(400).json({ error: 'No items in cart' });

        // Validate stock for each item
        for (const it of items) {
            const med = await Medicine.findById(it.medicineId);
            if (!med) return res.status(404).json({ error: `Medicine ${it.medicineName} not found` });
            if (med.quantity < it.quantity) return res.status(400).json({ error: `Insufficient stock for ${med.name}` });
        }

        const { processedItems, subtotal, discount, tax, total } = calcBill(items);
        const { date, time } = nowStrings();

        const order = await Order.create({
            ward, room, doctor,
            items: processedItems,
            subtotal, discount, tax, total, date, time
        });

        // Deduct stock for all items
        for (const it of items) {
            await Medicine.findByIdAndUpdate(it.medicineId, { $inc: { quantity: -Number(it.quantity) } });
        }

        const bill = {
            orderId:  order._id.toString().slice(-8).toUpperCase(),
            ward, room, doctor, date, time,
            items:    processedItems,
            subtotal, discount, tax, total
        };

        res.status(201).json({ ...order.toObject(), id: order._id, bill });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// PUT /api/orders/:id/status — admin only
app.put('/api/orders/:id/status', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        let bill = null;
        if (status === 'Delivered') {
            bill = {
                orderId:  order._id.toString().slice(-8).toUpperCase(),
                ward:     order.ward,
                room:     order.room,
                doctor:   order.doctor,
                date:     order.date,
                time:     order.time,
                items:    order.items,
                subtotal: order.subtotal,
                discount: order.discount,
                tax:      order.tax,
                total:    order.total
            };
        }

        res.json({ ...order.toObject(), id: order._id, bill });
    } catch { res.status(500).json({ error: 'Failed to update status' }); }
});

// GET /api/orders/:id/bill
app.get('/api/orders/:id/bill', authMiddleware, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json({
            orderId:  order._id.toString().slice(-8).toUpperCase(),
            ward:     order.ward,
            room:     order.room,
            doctor:   order.doctor,
            date:     order.date,
            time:     order.time,
            items:    order.items,
            subtotal: order.subtotal,
            discount: order.discount,
            tax:      order.tax,
            total:    order.total
        });
    } catch { res.status(500).json({ error: 'Failed to fetch bill' }); }
});

// ============================================================
//  DASHBOARD & ANALYTICS  (admin only)
// ============================================================

app.get('/api/dashboard', authMiddleware, adminOnly, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const [medicines, patients, todayOrders] = await Promise.all([
            Medicine.find(),
            Patient.countDocuments(),
            Order.find({ date: today })
        ]);

        const lowStockCount  = medicines.filter(m => m.quantity <= 10).length;
        const todayRevenue   = todayOrders.reduce((s, o) => s + (o.total || 0), 0);

        res.json({
            totalMedicines: medicines.length,
            totalPatients:  patients,
            lowStockCount,
            todayRevenue
        });
    } catch { res.status(500).json({ error: 'Dashboard error' }); }
});

app.get('/api/analytics/summary', authMiddleware, adminOnly, async (req, res) => {
    try {
        const orders = await Order.find({ status: 'Delivered' });
        const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);

        // Find top medicine by quantity sold
        const medMap = {};
        orders.forEach(o => {
            (o.items || []).forEach(it => {
                if (!medMap[it.medicineName]) medMap[it.medicineName] = 0;
                medMap[it.medicineName] += Number(it.quantity || 0);
            });
        });
        const topEntry = Object.entries(medMap).sort((a, b) => b[1] - a[1])[0];

        res.json({
            totalRevenue,
            totalSales:   orders.length,
            topMedicine:  topEntry ? { name: topEntry[0], quantity: topEntry[1] } : null
        });
    } catch { res.status(500).json({ error: 'Analytics error' }); }
});

app.get('/api/analytics/medicine-sales', authMiddleware, adminOnly, async (req, res) => {
    try {
        const orders = await Order.find({ status: 'Delivered' });
        const sales = {};
        orders.forEach(o => {
            (o.items || []).forEach(it => {
                if (!sales[it.medicineName]) sales[it.medicineName] = { qty: 0, amount: 0 };
                sales[it.medicineName].qty    += Number(it.quantity  || 0);
                sales[it.medicineName].amount += Number(it.lineTotal || 0);
            });
        });
        res.json(sales);
    } catch { res.status(500).json({ error: 'Sales data error' }); }
});

// ============================================================
//  FRONTEND ROUTING — serve HTML pages
// ============================================================

// HTML templates are located under public/pages. Build a base path
// once so it's easy to reference in the route handlers.
const pagesDir = path.join(__dirname, 'public', 'pages');
const pages = ['admin-dashboard','ward-dashboard','medicines','patients','orders','analytics','login'];
pages.forEach(page => {
    app.get(`/${page}`, (req, res) => {
        res.sendFile(path.join(pagesDir, `${page}.html`));
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(pagesDir, 'index.html'));
});

// ── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 MedTrack running at http://localhost:${PORT}`);
});