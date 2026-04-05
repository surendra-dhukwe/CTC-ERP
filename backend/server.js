/* ================= IMPORTS ================= */
const express = require("express");
const cors = require("cors");
const path = require("path");

/* ================= DB ================= */
const db = require("./db");

/* ================= ROUTES ================= */
const productRoutes = require("./routes/productRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const exportRoutes = require("./routes/exportRoutes");
const stockRoutes = require("./routes/stockRoutes");

/* ================= APP ================= */
const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= LOGGER ================= */
app.use((req, res, next) => {
    console.log(`➡️ ${req.method} ${req.url}`);
    next();
});

/* ================= STATIC ================= */
app.use(express.static(path.join(__dirname, "../frontend")));

/* ================= API ROUTES ================= */
app.use("/products", productRoutes);
app.use("/transactions", transactionRoutes);
app.use("/export", exportRoutes);
app.use("/final-stock", stockRoutes);

/* ================= VALID STOCK ================= */
const VALID_STOCKS = ["stock1", "stock2", "stock3", "stock4"];

/* ================= COMMON STOCK QUERY ================= */
const stockQuery = (table) => `
    SELECT 
        code,
        name,
        SUM(
            CASE 
                WHEN type='receive' THEN total_quantity
                WHEN type='dispatch' THEN -total_quantity
                ELSE 0
            END
        ) AS stock
    FROM ${table}
    GROUP BY code, name
`;

/* ================= PRODUCT STOCK ================= */
app.get("/products-stock/:stock", async (req, res) => {
    try {
        const stock = req.params.stock.toLowerCase();

        if (!VALID_STOCKS.includes(stock)) {
            return res.status(400).json({ message: "Invalid Stock" });
        }

        const [rows] = await db.query(stockQuery(`transactions_${stock}`));

        res.json(rows || []);

    } catch (err) {
        console.log("🔥 Stock Error:", err);
        res.status(500).json([]);
    }
});

/* ================= DAY-WISE ================= */
app.get("/day-wise-stock/:stock", async (req, res) => {
    try {
        const stock = req.params.stock.toLowerCase();

        if (!VALID_STOCKS.includes(stock)) {
            return res.status(400).json({ message: "Invalid Stock" });
        }

        const table = `transactions_${stock}`;

        const [rows] = await db.query(`
            SELECT 
                DATE(entry_date) AS date,
                code,
                name,
                SUM(
                    CASE 
                        WHEN type='receive' THEN total_quantity
                        WHEN type='dispatch' THEN -total_quantity
                        ELSE 0
                    END
                ) AS total_stock
            FROM ${table}
            GROUP BY DATE(entry_date), code, name
            ORDER BY date DESC
        `);

        res.json(rows || []);

    } catch (err) {
        console.log("🔥 DayWise Error:", err);
        res.status(500).json([]);
    }
});

/* ================= 🔥 COMBINED STOCK OPTIMIZED ================= */
app.get("/combined-stock", async (req, res) => {
    try {

        const [rows] = await db.query(`
            SELECT 
                p.code,
                p.name,
                p.loose_code,

                SUM(CASE WHEN t.stock='stock1' THEN qty ELSE 0 END) stock1,
                SUM(CASE WHEN t.stock='stock2' THEN qty ELSE 0 END) stock2,
                SUM(CASE WHEN t.stock='stock3' THEN qty ELSE 0 END) stock3,
                SUM(CASE WHEN t.stock='stock4' THEN qty ELSE 0 END) stock4,

                SUM(qty) AS total

            FROM products_master p

            LEFT JOIN (
                SELECT 'stock1' stock, code,
                    SUM(CASE WHEN type='receive' THEN total_quantity ELSE -total_quantity END) qty
                FROM transactions_stock1 GROUP BY code

                UNION ALL

                SELECT 'stock2', code,
                    SUM(CASE WHEN type='receive' THEN total_quantity ELSE -total_quantity END)
                FROM transactions_stock2 GROUP BY code

                UNION ALL

                SELECT 'stock3', code,
                    SUM(CASE WHEN type='receive' THEN total_quantity ELSE -total_quantity END)
                FROM transactions_stock3 GROUP BY code

                UNION ALL

                SELECT 'stock4', code,
                    SUM(CASE WHEN type='receive' THEN total_quantity ELSE -total_quantity END)
                FROM transactions_stock4 GROUP BY code

            ) t ON p.code = t.code

            GROUP BY p.code, p.name, p.loose_code
            ORDER BY p.code ASC
        `);

        res.json(rows || []);

    } catch (err) {
        console.log("🔥 Combined Error:", err);
        res.status(500).json([]);
    }
});

/* ================= 🔥 AUTO SUGGEST ================= */
app.get("/suggest", async (req, res) => {
    try {
        const { search = "" } = req.query;

        const [rows] = await db.query(`
            SELECT code, name 
            FROM products_master
            WHERE code LIKE ? OR name LIKE ?
            LIMIT 10
        `, [`%${search}%`, `%${search}%`]);

        res.json(rows || []);

    } catch (err) {
        console.log("🔥 Suggest Error:", err);
        res.status(500).json([]);
    }
});

/* ================= SEARCH ================= */
app.get("/search", async (req, res) => {
    try {
        const { invoice, party } = req.query;

        let where = "WHERE 1=1";
        let params = [];

        if (invoice) {
            where += " AND invoice_no LIKE ?";
            params.push(`%${invoice}%`);
        }

        if (party) {
            where += " AND party_name LIKE ?";
            params.push(`%${party}%`);
        }

        const [rows] = await db.query(`
            SELECT * FROM (
                SELECT 'stock1' stock, * FROM transactions_stock1
                UNION ALL
                SELECT 'stock2', * FROM transactions_stock2
                UNION ALL
                SELECT 'stock3', * FROM transactions_stock3
                UNION ALL
                SELECT 'stock4', * FROM transactions_stock4
            ) t
            ${where}
            ORDER BY entry_date DESC
        `, params);

        res.json(rows || []);

    } catch (err) {
        console.log("🔥 Search Error:", err);
        res.status(500).json([]);
    }
});

/* ================= HEALTH ================= */
app.get("/api/health", (req, res) => {
    res.json({ status: "OK 🚀" });
});

/* ================= HOME ================= */
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/login.html"));
});

/* ================= 404 ================= */
app.use((req, res) => {
    res.status(404).json({ message: "Route Not Found ❌" });
});

/* ================= ERROR ================= */
app.use((err, req, res, next) => {
    console.log("🔥 Global Error:", err);
    res.status(500).json([]);
});

/* ================= SERVER ================= */
const PORT = 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server Running: http://localhost:${PORT}`);
});