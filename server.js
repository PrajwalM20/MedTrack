const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static("public"));

// Page Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/pages/index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/pages/login.html')));
app.get('/admin-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public/pages/admin-dashboard.html')));
app.get('/ward-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public/pages/ward-dashboard.html')));
app.get('/medicines', (req, res) => res.sendFile(path.join(__dirname, 'public/pages/medicines.html')));
app.get('/patients', (req, res) => res.sendFile(path.join(__dirname, 'public/pages/patients.html')));
app.get('/orders', (req, res) => res.sendFile(path.join(__dirname, 'public/pages/orders.html')));
app.get('/analytics', (req, res) => res.sendFile(path.join(__dirname, 'public/pages/analytics.html')));

const DATA_FILE = path.join(__dirname, "data.json");

/* DATABASE */
function readDB() {
    if (!fs.existsSync(DATA_FILE)) {
        const initial = { medicines: [], patients: [], sales: [], assignments: [], orders: [] };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
        return initial;
    }
    const db = JSON.parse(fs.readFileSync(DATA_FILE));
    if (!db.orders) db.orders = [];
    return db;
}

function writeDB(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/* AUTHENTICATION */
app.post("/api/login", (req, res) => {
    const { email, password, googleToken } = req.body;

    // Simulate google login or email login
    if (googleToken || (email && password)) {
        const e = email || "google-user@example.com";
        // If the email includes 'admin', treat as admin, else ward
        const role = e.toLowerCase().includes("admin") ? "admin" : "ward";
        const token = "mock-token-" + Date.now();
        res.json({ token, role, email: e });
    } else {
        res.status(401).json({ error: "Invalid credentials" });
    }
});

/* MEDICINES */

app.get("/api/medicines", (req, res) => {
    const db = readDB();
    res.json(db.medicines);
});

app.post("/api/medicines", (req, res) => {
    const db = readDB();
    let { name, expiry, quantity, batch = "", price = 0, discount = 0 } = req.body;

    if (!name || !expiry || !quantity)
        return res.status(400).json({ error: "Missing fields" });

    quantity = parseInt(quantity);
    price = parseFloat(price) || 0;
    discount = parseFloat(discount) || 0;

    const finalPrice = price - (price * discount / 100);

    const newMed = {
        id: Date.now().toString(),
        name,
        expiry,
        quantity,
        batch,
        price,
        discount,
        finalPrice
    };

    db.medicines.push(newMed);
    writeDB(db);
    res.json(newMed);
});

app.put("/api/medicines/:id", (req, res) => {
    const db = readDB();
    const med = db.medicines.find(m => m.id === req.params.id);
    if (!med) return res.status(404).json({ error: "Not found" });

    Object.assign(med, req.body);

    med.quantity = parseInt(med.quantity);
    med.price = parseFloat(med.price) || 0;
    med.discount = parseFloat(med.discount) || 0;
    med.finalPrice = med.price - (med.price * med.discount / 100);

    writeDB(db);
    res.json(med);
});

app.delete("/api/medicines/:id", (req, res) => {
    const db = readDB();
    db.medicines = db.medicines.filter(m => m.id !== req.params.id);
    writeDB(db);
    res.json({ message: "Deleted" });
});

app.post("/api/medicines/:id/reduce", (req, res) => {
    const db = readDB();
    const med = db.medicines.find(m => m.id === req.params.id);
    if (!med) return res.status(404).json({ error: "Not found" });

    const qty = parseInt(req.body.quantity);
    if (!qty || qty <= 0)
        return res.status(400).json({ error: "Invalid quantity" });
    if (med.quantity < qty)
        return res.status(400).json({ error: `Insufficient stock. Only ${med.quantity} available.` });

    med.quantity -= qty;
    writeDB(db);
    res.json({ message: "Reduced", remaining: med.quantity });
});

/* PATIENTS */

app.get("/api/patients", (req, res) => {
    const db = readDB();
    res.json(db.patients);
});

app.post("/api/patients", (req, res) => {
    const db = readDB();
    const { name, age, gender, disease, nextRecheck } = req.body;

    if (!name || !age || !gender || !disease)
        return res.status(400).json({ error: "Missing fields" });

    const newPatient = {
        id: Date.now().toString(),
        name,
        age: parseInt(age),
        gender,
        disease,
        nextRecheck: nextRecheck || null,
        medicines: []
    };

    db.patients.push(newPatient);
    writeDB(db);
    res.json(newPatient);
});

app.put("/api/patients/:id", (req, res) => {
    const db = readDB();
    const p = db.patients.find(x => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: "Not found" });

    Object.assign(p, req.body);
    p.age = parseInt(p.age);
    if (!p.nextRecheck) p.nextRecheck = null;

    writeDB(db);
    res.json(p);
});

app.delete("/api/patients/:id", (req, res) => {
    const db = readDB();
    db.patients = db.patients.filter(p => p.id !== req.params.id);
    writeDB(db);
    res.json({ message: "Deleted" });
});

/* ASSIGN */

app.post("/api/assign", (req, res) => {
    const db = readDB();
    const { patientId, medicineId, quantity, dosage } = req.body;

    const patient = db.patients.find(p => p.id === patientId);
    const med = db.medicines.find(m => m.id === medicineId);

    if (!patient || !med)
        return res.status(404).json({ error: "Not found" });

    const qty = parseInt(quantity);
    if (!qty || med.quantity < qty)
        return res.status(400).json({ error: "Invalid quantity" });

    med.quantity -= qty;

    patient.medicines.push({
        id: Date.now().toString(),
        medicineId,
        medicineName: med.name,
        quantity: qty,
        dosage
    });

    writeDB(db);
    res.json({ message: "Assigned" });
});

/* DASHBOARD */

app.get("/api/dashboard", (req, res) => {
    const db = readDB();

    const totalMedicines = db.medicines.length;
    const totalPatients = db.patients.length;
    const lowStockCount = db.medicines.filter(m => m.quantity <= 10).length;

    const today = new Date().toISOString().split('T')[0];
    const todaySales = db.sales.filter(s => s.date === today);
    const todayRevenue = todaySales.reduce((sum, s) => sum + s.amount, 0);

    res.json({
        totalMedicines,
        totalPatients,
        lowStockCount,
        todayRevenue
    });
});

/* SALES */

app.post("/api/sales", (req, res) => {
    const db = readDB();
    const { medicineId, medicineName, quantity, amount } = req.body;

    if (!medicineId || !quantity || !amount)
        return res.status(400).json({ error: "Missing fields" });

    const sale = {
        id: Date.now().toString(),
        medicineId,
        medicineName,
        quantity: parseInt(quantity),
        amount: parseFloat(amount),
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0]
    };

    db.sales.push(sale);
    writeDB(db);
    res.json(sale);
});

app.get("/api/sales", (req, res) => {
    const db = readDB();
    res.json(db.sales.reverse());
});

app.get("/api/sales/daily-revenue", (req, res) => {
    const db = readDB();
    const revenueByDate = {};

    db.sales.forEach(s => {
        if (!revenueByDate[s.date]) revenueByDate[s.date] = 0;
        revenueByDate[s.date] += s.amount;
    });

    res.json(revenueByDate);
});

/* ANALYTICS */

app.get("/api/analytics/summary", (req, res) => {
    const db = readDB();

    const totalRevenue = db.sales.reduce((sum, s) => sum + s.amount, 0);
    const totalSales = db.sales.length;

    const medicinesSold = {};
    db.sales.forEach(s => {
        if (!medicinesSold[s.medicineName]) medicinesSold[s.medicineName] = 0;
        medicinesSold[s.medicineName] += s.quantity;
    });

    const topMedicine = Object.entries(medicinesSold)
        .sort((a, b) => b[1] - a[1])[0];

    res.json({
        totalRevenue,
        totalSales,
        totalMedicines: db.medicines.length,
        totalPatients: db.patients.length,
        topMedicine: topMedicine ? { name: topMedicine[0], quantity: topMedicine[1] } : null
    });
});

app.get("/api/analytics/medicine-sales", (req, res) => {
    const db = readDB();

    const salesByMedicine = {};
    db.sales.forEach(s => {
        if (!salesByMedicine[s.medicineName]) {
            salesByMedicine[s.medicineName] = { quantity: 0, amount: 0 };
        }
        salesByMedicine[s.medicineName].quantity += s.quantity;
        salesByMedicine[s.medicineName].amount += s.amount;
    });

    res.json(salesByMedicine);
});

/* ORDERS */

// helper to build a detailed bill object
function buildBill({ orderId, ward, room, doctor, date, time, items }) {
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const discountTotal = items.reduce((s, i) => s + ((i.unitPrice * i.discount / 100) * i.quantity), 0);
    const tax = +(subtotal * 0.05).toFixed(2); // 5% GST
    const total = +(subtotal + tax).toFixed(2);
    return { orderId, ward, room, doctor, date, time, items, subtotal, discount: discountTotal, tax, total };
}

app.get("/api/orders", (req, res) => {
    const db = readDB();
    res.json(db.orders.reverse());
});

// single-item order (original behaviour)
app.post("/api/orders", (req, res) => {
    const db = readDB();
    const { medicineId, medicineName, quantity, ward, room, doctor } = req.body;

    if (!medicineId || !quantity || !ward || !room)
        return res.status(400).json({ error: "Missing fields" });

    const med = db.medicines.find(m => m.id === medicineId);
    if (!med) return res.status(404).json({ error: "Medicine not found" });

    const randomId = Math.floor(10000 + Math.random() * 90000);
    const newOrder = {
        id: `MED-${randomId}`,
        medicineId,
        medicineName,
        quantity: parseInt(quantity),
        ward,
        room,
        doctor: doctor || "N/A",
        status: "Pending",
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().substring(0, 5)
    };

    const billRaw = {
        orderId: newOrder.id,
        ward: newOrder.ward,
        room: newOrder.room,
        doctor: newOrder.doctor,
        date: newOrder.date,
        time: newOrder.time,
        items: [{
            name: med.name,
            quantity: newOrder.quantity,
            unitPrice: med.finalPrice,
            discount: med.discount || 0,
            lineTotal: med.finalPrice * newOrder.quantity
        }]
    };
    const bill = buildBill(billRaw);

    db.sales.push({
        id: `SALE-${Date.now()}`,
        medicineId,
        medicineName,
        quantity: newOrder.quantity,
        amount: bill.total,
        date: newOrder.date,
        time: newOrder.time
    });
    db.orders.push(newOrder);
    writeDB(db);
    res.json({ ...newOrder, bill });
});

// cart order with multiple items
app.post("/api/orders/cart", (req, res) => {
    const db = readDB();
    const { ward, room, doctor, items } = req.body;

    if (!ward || !room || !Array.isArray(items) || !items.length) {
        return res.status(400).json({ error: "Missing fields or empty cart" });
    }

    // deduct stock and prepare bill items
    const billItems = [];
    for (const it of items) {
        const med = db.medicines.find(m => m.id === it.medicineId);
        if (!med) return res.status(404).json({ error: `Medicine ${it.medicineId} not found` });
        const qty = parseInt(it.quantity);
        if (!qty || med.quantity < qty) {
            return res.status(400).json({ error: `Invalid quantity for ${med.name}` });
        }
        med.quantity -= qty;
        billItems.push({
            name: med.name,
            quantity: qty,
            unitPrice: med.finalPrice,
            discount: med.discount || 0,
            lineTotal: med.finalPrice * qty
        });
    }

    const today = new Date();
    const orderId = `MED-${Math.floor(10000 + Math.random() * 90000)}`;
    const date = today.toISOString().split('T')[0];
    const time = today.toTimeString().substring(0, 5);

    // record individual orders
    items.forEach(it => {
        db.orders.push({
            id: orderId,
            medicineId: it.medicineId,
            medicineName: it.medicineName || '',
            quantity: parseInt(it.quantity),
            ward,
            room,
            doctor: doctor || 'N/A',
            status: 'Pending',
            date,
            time
        });
    });
    // sales entries
    billItems.forEach(bi => {
        db.sales.push({
            id: `SALE-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            medicineId: items.find(i=>i.medicineName===bi.name)?.medicineId || '',
            medicineName: bi.name,
            quantity: bi.quantity,
            amount: bi.lineTotal,
            date,
            time
        });
    });

    writeDB(db);
    const bill = buildBill({ orderId, ward, room, doctor: doctor || 'N/A', date, time, items: billItems });
    res.json({ bill });
});

// generate bill for existing order id
app.get("/api/orders/:id/bill", (req, res) => {
    const db = readDB();
    const orderId = req.params.id;
    const related = db.orders.filter(o => o.id === orderId);
    if (!related.length) return res.status(404).json({ error: "Order not found" });

    const first = related[0];
    const billItems = related.map(o => {
        const med = db.medicines.find(m => m.id === o.medicineId);
        const price = med ? med.finalPrice : 0;
        return {
            name: o.medicineName,
            quantity: o.quantity,
            unitPrice: price,
            discount: med ? med.discount || 0 : 0,
            lineTotal: price * o.quantity
        };
    });

    const bill = buildBill({
        orderId,
        ward: first.ward,
        room: first.room,
        doctor: first.doctor,
        date: first.date,
        time: first.time,
        items: billItems
    });
    res.json(bill);
});

app.put("/api/orders/:id/status", (req, res) => {
    const db = readDB();
    const order = db.orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Missing status" });

    if (status === "Delivered" && order.status !== "Delivered") {
        const med = db.medicines.find(m => m.id === order.medicineId);
        if (!med) return res.status(404).json({ error: "Linked medicine not found in inventory." });
        if (med.quantity < order.quantity) {
            return res.status(400).json({ error: `Insufficient stock for ${med.name}. Only ${med.quantity} available.` });
        }
        med.quantity -= order.quantity;
    }

    order.status = status;
    writeDB(db);

    if (status === "Delivered") {
        const related = db.orders.filter(o => o.id === order.id);
        const first = related[0];
        const billItems = related.map(o => {
            const med = db.medicines.find(m => m.id === o.medicineId);
            const price = med ? med.finalPrice : 0;
            return {
                name: o.medicineName,
                quantity: o.quantity,
                unitPrice: price,
                discount: med ? med.discount || 0 : 0,
                lineTotal: price * o.quantity
            };
        });
        const bill = buildBill({
            orderId: order.id,
            ward: first.ward,
            room: first.room,
            doctor: first.doctor,
            date: first.date,
            time: first.time,
            items: billItems
        });
        return res.json({ ...order, bill });
    }

    res.json(order);
});

app.listen(5000, () =>
    console.log(" Server running at http://localhost:5000")
);