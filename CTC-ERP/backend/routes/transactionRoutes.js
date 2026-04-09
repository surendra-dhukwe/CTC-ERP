const express = require("express");
const router = express.Router();
const db = require("../db");

/* ================= VALID STOCK ================= */
const validStocks = ["stock1", "stock2", "stock3", "stock4"];

/* ================= AUTO CREATE MASTER TABLES ================= */
async function createMasterTables() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS party_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            party_name VARCHAR(255) UNIQUE
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS invoice_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            invoice_no VARCHAR(255) UNIQUE
        )
    `);
}

/* ================= COMMON VALIDATOR ================= */
function checkStock(stock, res) {
    if (!validStocks.includes(stock)) {
        res.status(400).json({ success: false, message: "Invalid Stock" });
        return false;
    }
    return true;
}

/* ================= SAFE NUMBER ================= */
function toNumber(val) {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
}

/* ================= SAVE TRANSACTION ================= */
async function saveTransaction(stockTable, type, items, res) {
    const conn = await db.getConnection();

    try {
        await createMasterTables();
        await conn.beginTransaction();

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            if (!item.name || item.name.trim() === "") {
                throw new Error(`Row ${i + 1}: Name required`);
            }

            const bags = toNumber(item.bags);
            const qty = toNumber(item.quantity);

            if (bags <= 0 || qty <= 0) {
                throw new Error(`Row ${i + 1}: Invalid Bags or Quantity`);
            }

            const totalQty = bags * qty;

            /* PARTY */
            if (item.party_name) {
                await conn.query(
                    `INSERT IGNORE INTO party_master (party_name) VALUES (?)`,
                    [item.party_name]
                );
            }

            /* INVOICE */
            if (item.invoice_no) {
                await conn.query(
                    `INSERT IGNORE INTO invoice_master (invoice_no) VALUES (?)`,
                    [item.invoice_no]
                );
            }

            /* INSERT */
            await conn.query(
                `INSERT INTO ${stockTable} 
                (code, name, loose_code, bags, quantity, total_quantity, type, invoice_no, party_name, entry_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    item.code || null,
                    item.name.trim(),
                    item.loose_code || null,
                    bags,
                    qty,
                    totalQty,
                    type,
                    item.invoice_no || "",
                    item.party_name || ""
                ]
            );
        }

        await conn.commit();

        res.json({
            success: true,
            message: "✅ Transaction Saved Successfully",
            count: items.length
        });

    } catch (err) {
        await conn.rollback();
        console.log("🔥 SAVE ERROR:", err);

        res.status(500).json({
            success: false,
            message: err.message || "Transaction Failed"
        });

    } finally {
        conn.release();
    }
}

// 🔥 GET ALL PRODUCTS (NO LIMIT)
router.get("/products/all", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT code,name,loose_code FROM products");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/* ================= SAVE ================= */
router.post("/:stock/save", async (req, res) => {
    try {
        const stock = req.params.stock.toLowerCase();
        if (!checkStock(stock, res)) return;

        const { type, items } = req.body;

        if (!type || !["receive", "dispatch"].includes(type)) {
            return res.status(400).json({ success: false, message: "Invalid type" });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "No items provided" });
        }

        const table = `transactions_${stock}`;
        await saveTransaction(table, type, items, res);

    } catch (err) {
        console.log("🔥 SAVE ROUTE ERROR:", err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

/* ================= ALL ================= */
router.get("/:stock/all", async (req, res) => {
    try {
        const stock = req.params.stock.toLowerCase();
        if (!checkStock(stock, res)) return;

        const table = `transactions_${stock}`;
        const { from, to, party, invoice } = req.query;

        let where = "WHERE 1=1";
        let params = [];

        if (from && to) {
            where += " AND DATE(entry_date) BETWEEN ? AND ?";
            params.push(from, to);
        }

        if (party) {
            where += " AND party_name LIKE ?";
            params.push(`%${party}%`);
        }

        if (invoice) {
            where += " AND invoice_no LIKE ?";
            params.push(`%${invoice}%`);
        }

        const [rows] = await db.query(`
            SELECT * FROM ${table}
            ${where}
            ORDER BY entry_date DESC
        `, params);

        res.json(rows); // ✅ frontend fix

    } catch (err) {
        console.log("🔥 FETCH ERROR:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
});

/* ================= FINAL STOCK ================= */
router.get("/:stock/final", async (req, res) => {
    try {
        const stock = req.params.stock.toLowerCase();
        if (!checkStock(stock, res)) return;

        const table = `transactions_${stock}`;

        const [rows] = await db.query(`
            SELECT 
                code,
                name,
                SUM(
                    CASE 
                        WHEN type='receive' THEN total_quantity
                        WHEN type='dispatch' THEN -total_quantity
                        ELSE 0
                    END
                ) AS final_stock
            FROM ${table}
            GROUP BY code, name
        `);

        res.json(rows);

    } catch (err) {
        console.log("🔥 FINAL ERROR:", err);
        res.status(500).json({ success: false, message: "Final Stock Error" });
    }
});

/* ================= DELETE ================= */
router.delete("/:stock/:id", async (req, res) => {
    try {
        const stock = req.params.stock.toLowerCase();
        if (!checkStock(stock, res)) return;

        const table = `transactions_${stock}`;
        const id = req.params.id;

        const [result] = await db.query(`DELETE FROM ${table} WHERE id=?`, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Record not found" });
        }

        res.json({ success: true, message: "Deleted Successfully" });

    } catch (err) {
        console.log("🔥 DELETE ERROR:", err);
        res.status(500).json({ success: false, message: "Delete Error" });
    }
});

/* ================= GLOBAL 404 ================= */
router.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route Not Found",
        url: req.originalUrl
    });
});

module.exports = router;