const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const path = require('path');
const twilio = require('twilio');

// Twilio Configuration
const TWILIO_ACCOUNT_SID = 'AC56733acf25a8df8b233e9ffe8b41edcd';
const TWILIO_AUTH_TOKEN = 'b10fab4798a065aa37815c7113cc4e76';
const TWILIO_PHONE_NUMBER = '+12297159583'; // Valid Twilio Virtual Number
const client = new twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// In-memory OTP storage for demo
const otps = {};

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(express.static('.')); // Serve static files from current directory

// Database Setup
const dbPath = process.env.NODE_ENV === 'production'
    ? '/data/database.sqlite'
    : './database.sqlite';

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err);
    } else {
        console.log(`Connected to SQLite database at ${dbPath}`);
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            phone TEXT UNIQUE,
            role TEXT DEFAULT 'user'
        )`, (err) => {
            if (!err) {
                // Try to add phone column if it doesn't exist (for existing databases)
                db.run("ALTER TABLE users ADD COLUMN phone TEXT UNIQUE", (err) => {
                    if (err) {
                        // Probably already exists
                    }
                });
            }
        });

        // Rates Table
        db.run(`CREATE TABLE IF NOT EXISTS rates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            unit TEXT,
            price INTEGER
        )`);

        // Rate History Table
        db.run(`CREATE TABLE IF NOT EXISTS rate_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            item_name TEXT,
            old_price INTEGER,
            new_price INTEGER,
            admin_username TEXT
        )`);

        // Bookings/Inquiries Table
        db.run(`CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            item_name TEXT,
            price TEXT,
            phone TEXT,
            place TEXT,
            customer_name TEXT
        )`);

        // Products Table
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            rateId INTEGER,
            type TEXT,
            name TEXT,
            description TEXT,
            price TEXT,
            unit TEXT,
            image TEXT,
            category TEXT,
            badge_text TEXT,
            badge_color TEXT
        )`);

        // Seed Products if empty
        db.get("SELECT count(*) as count FROM products", (err, row) => {
            if (row && row.count === 0) {
                const initialProducts = [
                    {
                        id: 'p1',
                        rateId: 1,
                        type: 'material',
                        name: 'Quality River Sand',
                        description: 'Premium filtered sand for construction foundations.',
                        price: '₹4,500',
                        unit: '/ Unit',
                        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBqvw2mM46N37gZmFMXVmL8EmXi8pLMB_vWwzjA1K7Hp9FW8dJcUf2Ww3oZpcSIaNLS4NOAaQYV2_q-C8LRy3xqjZUdo3NQT6nafjYvhQ14gPlBSaIpXirD94L68AbqQTCzn0_T9SSpfnyvpkJ_PYgwEgN3hhf7EWjrfAy2lTFUBP15Mt987f_4UJMGgYhsHEA-QtHaKokSQf43rqC6TnzkorgQZ2dKq1BoCzp3o6i_pJsFncjDcbbcng3Lq5Z7RoiLmTguDf4bd1w',
                        category: 'River Sand',
                        badge_text: 'Best Seller',
                        badge_color: 'bg-green-500'
                    },
                    {
                        id: 'p2',
                        rateId: 5,
                        type: 'material',
                        name: '20mm Blue Metal',
                        description: 'High-grade crushed stone aggregates for concrete.',
                        price: '₹3,200',
                        unit: '/ Unit',
                        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDlJdluCHzwV8kCPY7XP06B6bWbPtOCSYry36lIII6_j89JaiR0AWzhLyTXt9kq-RK7LU2o0_EsiIXMg-bBJLj1Yu5Wvtl3jRZfFQXMxMQy7NOC85tnhj-ruz7oq5PWJnNX2kree3xYUASarGB5kQcfPbahPrTwjq-wkwqnZlksggpgbZQblr8h67Qb1m5zdbytkO2VldYgRlQCbzdF703fjVccNpf_E19m_58SLufFIsmAHg4dmW0vD_ghlherdYq-B06kPeCOcK4',
                        category: 'Aggregates',
                        badge_text: '',
                        badge_color: ''
                    },
                    {
                        id: 'p3',
                        rateId: 2,
                        type: 'material',
                        name: 'Premium M-Sand',
                        description: 'High-quality manufactured sand for masonry works.',
                        price: '₹3,800',
                        unit: '/ Unit',
                        image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop',
                        category: 'River Sand',
                        badge_text: 'Eco Friendly',
                        badge_color: 'bg-blue-500'
                    },
                    {
                        id: 'p4',
                        rateId: 3,
                        type: 'material',
                        name: 'Red Bricks',
                        description: 'Standard size burnt clay bricks for walls.',
                        price: '₹8,500',
                        unit: '/ 1000 Pcs',
                        image: 'https://images.unsplash.com/photo-1582201942988-13e60e4556ee?q=80&w=800&auto=format&fit=crop',
                        category: 'Cement',
                        badge_text: '',
                        badge_color: ''
                    }
                ];
                const stmt = db.prepare("INSERT INTO products (id, rateId, type, name, description, price, unit, image, category, badge_text, badge_color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                initialProducts.forEach(p => {
                    stmt.run(p.id, p.rateId, p.type, p.name, p.description, p.price, p.unit, p.image, p.category, p.badge_text, p.badge_color);
                });
                stmt.finalize();
                console.log('Products seeded.');
            }
        });

        // Seed Rates if empty
        db.get("SELECT count(*) as count FROM rates", (err, row) => {
            if (row.count === 0) {
                const initialRates = [
                    { name: "River Sand", unit: "Unit (Load)", price: 4500 },
                    { name: "M-Sand", unit: "Unit (Load)", price: 3800 },
                    { name: "Red Bricks (Standard)", unit: "1000 Pcs", price: 8500 },
                    { name: "Red Bricks (Chamber)", unit: "1000 Pcs", price: 9200 },
                    { name: "Blue Metal (20mm)", unit: "Unit", price: 3200 },
                    { name: "Cement (Ramco)", unit: "Bag (50kg)", price: 420 },
                    { name: "Solid Blocks (4-inch)", unit: "Piece", price: 32 },
                    { name: "Solid Blocks (6-inch)", unit: "Piece", price: 42 },
                ];
                const stmt = db.prepare("INSERT INTO rates (name, unit, price) VALUES (?, ?, ?)");
                initialRates.forEach(rate => {
                    stmt.run(rate.name, rate.unit, rate.price);
                });
                stmt.finalize();
                console.log('Rates seeded.');
            }
        });

        // Seed Admin if empty
        db.get("SELECT count(*) as count FROM users WHERE role = 'admin'", (err, row) => {
            if (row && row.count === 0) {
                bcrypt.hash('admin123', 10, (err, hash) => {
                    db.run("INSERT INTO users (username, password, phone, role) VALUES (?, ?, ?, ?)", ['admin', hash, '9944748140', 'admin']);
                    console.log('Admin seeded: admin / admin123');
                });
            }
        });

        // Seed Default User if empty
        db.get("SELECT count(*) as count FROM users WHERE username = 'tester'", (err, row) => {
            if (row && row.count === 0) {
                bcrypt.hash('tester123', 10, (err, hash) => {
                    db.run("INSERT INTO users (username, password, phone, role) VALUES (?, ?, ?, ?)", ['tester', hash, '9994932660', 'user']);
                    console.log('User seeded: tester / tester123');
                });
            }
        });
    });
}

// Routes

// Register
app.post('/api/register', (req, res) => {
    const { username, password, phone } = req.body;
    if (!username || !password || !phone) return res.status(400).json({ error: 'Missing fields' });

    const saltRounds = 10;
    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) return res.status(500).json({ error: 'Server error' });

        db.run("INSERT INTO users (username, password, phone) VALUES (?, ?, ?)", [username, hash, phone], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    if (err.message.includes('username')) return res.status(400).json({ error: 'Username already exists' });
                    if (err.message.includes('phone')) return res.status(400).json({ error: 'Phone number already registered' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'User registered successfully', userId: this.lastID });
        });
    });
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body; // username can be username or phone
    db.get("SELECT * FROM users WHERE username = ? OR phone = ?", [username, username], (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Invalid credentials' });

        bcrypt.compare(password, user.password, (err, result) => {
            if (result) {
                res.json({
                    message: 'Login successful',
                    username: user.username,
                    phone: user.phone,
                    role: user.role,
                    token: 'dummy-token-' + Date.now()
                });
            } else {
                res.status(401).json({ error: 'Invalid credentials' });
            }
        });
    });
});

// Get Rates
app.get('/api/rates', (req, res) => {
    db.all("SELECT * FROM rates", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Update Rates
app.post('/api/rates', (req, res) => {
    // In a real app, use auth tokens. 
    // For this implementation, we check the role provided in the request body (or dummy check)
    const { updates, username, role } = req.body;

    // Server-side role check
    if (role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized: Admin role required' });
    }

    if (!Array.isArray(updates)) return res.status(400).json({ error: 'Invalid format' });

    db.serialize(() => {
        const stmt = db.prepare("UPDATE rates SET price = ? WHERE id = ?");
        const histStmt = db.prepare("INSERT INTO rate_history (date, item_name, old_price, new_price, admin_username) VALUES (?, ?, ?, ?, ?)");
        const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const user = username || 'admin';

        updates.forEach(item => {
            db.get("SELECT * FROM rates WHERE id = ?", [item.id], (err, row) => {
                if (row && row.price !== item.price) {
                    histStmt.run(dateStr, row.name, row.price, item.price, user);
                    stmt.run(item.price, item.id);
                }
            });
        });

        setTimeout(() => {
            stmt.finalize();
            histStmt.finalize();
            res.json({ message: 'Rates updated' });
        }, 100);
    });
});

// Get History (Rate Changes)
app.get('/api/history', (req, res) => {
    // Check if user is admin (simplistic check for this setup)
    const role = req.query.role;
    if (role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    db.all("SELECT * FROM rate_history ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Create Booking
app.post('/api/bookings', (req, res) => {
    const { item_name, price, phone, place, customer_name } = req.body;
    const dateStr = new Date().toLocaleString(); // Date and Time

    console.log(`[ORDER] New order received for: ${item_name} from ${customer_name}`);

    db.run("INSERT INTO bookings (date, item_name, price, phone, place, customer_name) VALUES (?, ?, ?, ?, ?, ?)",
        [dateStr, item_name, price, phone, place, customer_name || 'Guest'],
        function (err) {
            if (err) {
                console.error("[ORDER ERROR] Database Error:", err.message);
                return res.status(500).json({ error: "Order database error", details: err.message });
            }
            console.log(`[ORDER SUCCESS] Order saved with ID: ${this.lastID}`);
            res.json({ message: 'Booking successful', id: this.lastID });
        }
    );
});

// Get Bookings
app.get('/api/bookings', (req, res) => {
    const { role, username } = req.query;

    if (role === 'admin') {
        db.all("SELECT * FROM bookings ORDER BY id DESC", [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    } else {
        if (!username) {
            return res.status(400).json({ error: 'Username required for tracking' });
        }
        db.all("SELECT * FROM bookings WHERE customer_name = ? ORDER BY id DESC", [username], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    }
});

// Get Products
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Create/Update Product
app.post('/api/products', (req, res) => {
    const { product, role } = req.body;
    if (role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

    const { id, rateId, type, name, description, price, unit, image, category, badge_text, badge_color } = product;

    db.run(`INSERT OR REPLACE INTO products (id, rateId, type, name, description, price, unit, image, category, badge_text, badge_color) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, rateId, type, name, description, price, unit, image, category, badge_text, badge_color],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Product saved', id });
        }
    );
});

// Delete Product
app.delete('/api/products/:id', (req, res) => {
    const { role } = req.query;
    const { id } = req.params;
    if (role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

    db.run("DELETE FROM products WHERE id = ?", [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Product deleted' });
    });
});

// OTP Generation
app.post('/api/otp/send', (req, res) => {
    const { phone: rawPhone } = req.body;
    if (!rawPhone) return res.status(400).json({ error: 'Phone number required' });

    let phone = rawPhone.replace(/\D/g, ''); // Sanitize: keep only digits
    if (phone.length < 10) return res.status(400).json({ error: 'Invalid phone number format' });

    // Ensure E.164 format for India (Default to +91 if missing)
    if (phone.length === 10) {
        phone = '+91' + phone;
    } else if (!phone.startsWith('+')) {
        phone = '+' + phone;
    }

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    otps[phone] = code;

    console.log(`\n==================================================`);
    console.log(`[SENDING REAL SMS VIA TWILIO]`);
    console.log(`TO: ${rawPhone}`);
    console.log(`CODE: [ ${code} ]`);
    console.log(`==================================================\n`);

    // Send Real SMS via Twilio
    client.messages.create({
        body: `Your KRG Building Materials verification code is: ${code}`,
        to: rawPhone,
        from: TWILIO_PHONE_NUMBER,
    })
        .then((message) => {
            console.log(`[TWILIO SUCCESS] Message SID: ${message.sid}`);
            res.json({ message: 'OTP sent successfully to your phone!' });
        })
        .catch((error) => {
            console.error(`[TWILIO ERROR]`, error);
            res.status(500).json({ error: 'SMS Delivery Error', details: error.message });
        });
});

// OTP Verification
app.post('/api/otp/verify', (req, res) => {
    const { phone: rawPhone, code } = req.body;
    if (!rawPhone || !code) return res.status(400).json({ error: 'Phone and code required' });

    const phone = rawPhone.replace(/\D/g, ''); // Sanitize: keep only digits
    if (otps[phone] === code) {
        delete otps[phone]; // Clear after use
        res.json({ message: 'OTP verified successfully' });
    } else {
        res.status(400).json({ error: 'Invalid OTP code' });
    }
});

// Admin Stats
app.get('/api/admin/stats', (req, res) => {
    const { role } = req.query;
    // Simple role check
    if (role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

    const stats = {};

    db.serialize(() => {
        db.get("SELECT count(*) as count FROM users", (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            stats.userCount = row.count;

            db.get("SELECT count(*) as count FROM bookings", (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                stats.orderCount = row.count;
                res.json(stats);
            });
        });
    });
});

// Admin: Get All Users
app.get('/api/admin/users', (req, res) => {
    const { role } = req.query;
    if (role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

    db.all("SELECT id, username, phone, role FROM users", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Admin: Add User
app.post('/api/admin/users', (req, res) => {
    const { username, password, phone, role: newRole, adminRole } = req.body;

    if (adminRole !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    if (!username || !password || !phone) return res.status(400).json({ error: 'Missing fields' });

    const saltRounds = 10;
    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) return res.status(500).json({ error: 'Server error' });

        db.run("INSERT INTO users (username, password, phone, role) VALUES (?, ?, ?, ?)",
            [username, hash, phone, newRole || 'user'],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        if (err.message.includes('username')) return res.status(400).json({ error: 'Username already exists' });
                        if (err.message.includes('phone')) return res.status(400).json({ error: 'Phone number already registered' });
                    }
                    return res.status(500).json({ error: err.message });
                }
                res.json({ message: 'User created successfully', id: this.lastID });
            }
        );
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
