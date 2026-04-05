const express = require("express");
const router = express.Router();
const db = require("../db");

/* ================= COMBINED (STOCK1 vs STOCK2) ================= */
router.get("/", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                p.code,
                p.name,
                p.loose_code,

                COALESCE(s1.stock1, 0) AS stock1,
                COALESCE(s2.stock2, 0) AS stock2,

                (COALESCE(s1.stock1, 0) - COALESCE(s2.stock2, 0)) AS difference

            FROM products_master p

            LEFT JOIN (
                SELECT 
                    code,
                    SUM(
                        CASE 
                            WHEN type='receive' THEN total_quantity
                            WHEN type='dispatch' THEN -total_quantity
                            ELSE 0
                        END
                    ) AS stock1
                FROM transactions_stock1
                GROUP BY code
            ) s1 ON p.code = s1.code

            LEFT JOIN (
                SELECT 
                    code,
                    SUM(
                        CASE 
                            WHEN type='receive' THEN total_quantity
                            WHEN type='dispatch' THEN -total_quantity
                            ELSE 0
                        END
                    ) AS stock2
                FROM transactions_stock2
                GROUP BY code
            ) s2 ON p.code = s2.code

            ORDER BY p.name ASC
        `);

        res.json(Array.isArray(rows) ? rows : []);

    } catch (err) {
        console.log("🔥 Combined Stock Error:", err);

        res.status(500).json({
            message: "Database Error",
            error: err.message
        });
    }
});


/* ================= ALL 4 STOCK SUMMARY ================= */
router.get("/all", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                p.code,
                p.name,

                COALESCE(s1.stock1,0) AS stock1,
                COALESCE(s2.stock2,0) AS stock2,
                COALESCE(s3.stock3,0) AS stock3,
                COALESCE(s4.stock4,0) AS stock4,

                (
                    COALESCE(s1.stock1,0)+
                    COALESCE(s2.stock2,0)+
                    COALESCE(s3.stock3,0)+
                    COALESCE(s4.stock4,0)
                ) AS total

            FROM products_master p

            LEFT JOIN (
                SELECT code,
                SUM(CASE 
                    WHEN type='receive' THEN total_quantity
                    WHEN type='dispatch' THEN -total_quantity
                    ELSE 0 END
                ) stock1
                FROM transactions_stock1 GROUP BY code
            ) s1 ON p.code=s1.code

            LEFT JOIN (
                SELECT code,
                SUM(CASE 
                    WHEN type='receive' THEN total_quantity
                    WHEN type='dispatch' THEN -total_quantity
                    ELSE 0 END
                ) stock2
                FROM transactions_stock2 GROUP BY code
            ) s2 ON p.code=s2.code

            LEFT JOIN (
                SELECT code,
                SUM(CASE 
                    WHEN type='receive' THEN total_quantity
                    WHEN type='dispatch' THEN -total_quantity
                    ELSE 0 END
                ) stock3
                FROM transactions_stock3 GROUP BY code
            ) s3 ON p.code=s3.code

            LEFT JOIN (
                SELECT code,
                SUM(CASE 
                    WHEN type='receive' THEN total_quantity
                    WHEN type='dispatch' THEN -total_quantity
                    ELSE 0 END
                ) stock4
                FROM transactions_stock4 GROUP BY code
            ) s4 ON p.code=s4.code
        `);

        res.json(Array.isArray(rows) ? rows : []);

    } catch (err) {
        console.log("🔥 ALL STOCK ERROR:", err);

        res.status(500).json({
            message: "Database Error",
            error: err.message
        });
    }
});


/* ================= 🔥 ALL TRANSACTIONS (MAIN FIX) ================= */
router.get("/all-transactions/:stock", async (req, res) => {
    try {
        const stock = req.params.stock.toLowerCase();

        const validStocks = ["stock1", "stock2", "stock3", "stock4"];
        if (!validStocks.includes(stock)) {
            return res.status(400).json({ message: "Invalid stock" });
        }

        const table = `transactions_${stock}`;

        const [rows] = await db.query(`
            SELECT *
            FROM ${table}
            ORDER BY entry_date DESC
        `);

        res.json(Array.isArray(rows) ? rows : []);

    } catch (err) {
        console.log("🔥 ALL TRANSACTIONS ERROR:", err);

        res.status(500).json({
            message: "Database Error",
            error: err.message
        });
    }
});


/* ================= CSV ================= */
router.get("/download", async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT * FROM products_master`);

        let csv = "Code,Name\n";

        rows.forEach(r => {
            csv += `${r.code || ""},${r.name || ""}\n`;
        });

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=products.csv");

        res.send(csv);

    } catch (err) {
        console.log("🔥 CSV ERROR:", err);
        res.status(500).send("CSV Error");
    }
});

module.exports = router;