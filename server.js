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

app.get("/api/orders", (req, res) => {
    const db = readDB();
    res.json(db.orders.reverse());
});

app.post("/api/orders", (req, res) => {
    const db = readDB();
    const { medicineId, medicineName, quantity, ward, room, doctor } = req.body;

    if (!medicineId || !quantity || !ward || !room)
        return res.status(400).json({ error: "Missing fields" });

    const med = db.medicines.find(m => m.id === medicineId);
    if (!med) return res.status(404).json({ error: "Medicine not found" });

    // Generate MED-XXXXX order ID
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
        time: new Date().toTimeString().substring(0, 5) // HH:MM
    };

    const billAmount = med.finalPrice * newOrder.quantity;
    const newBill = {
        id: `BILL-${Date.now()}`,
        medicineId,
        medicineName,
        quantity: newOrder.quantity,
        amount: parseFloat(billAmount),
        date: newOrder.date,
        time: newOrder.time
    };

    db.sales.push(newBill);
    db.orders.push(newOrder);
    writeDB(db);
    res.json({ ...newOrder, billAmount });
});

app.put("/api/orders/:id/status", (req, res) => {
    const db = readDB();
    const order = db.orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Missing status" });

    // If changing to delivered
    if (status === "Delivered" && order.status !== "Delivered") {
        const med = db.medicines.find(m => m.id === order.medicineId);
        if (!med) return res.status(404).json({ error: "Linked medicine not found in inventory." });

        if (med.quantity < order.quantity) {
            return res.status(400).json({ error: `Insufficient stock for ${med.name}. Only ${med.quantity} available.` });
        }

        med.quantity -= order.quantity;
    }

    // Optionally handle reverse status changes if needed, but typically standard flow is pending -> processing -> delivered

    order.status = status;
    writeDB(db);
    res.json(order);
});

app.listen(5000, () =>
    console.log(" Server running at http://localhost:5000")
);