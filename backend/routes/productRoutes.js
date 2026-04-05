const express = require("express");
const router = express.Router();
const db = require("../db");

/* ================= GET ALL PRODUCTS ================= */
router.get("/", async (req, res) => {
    try {
        let { search, page = 1, limit = 50, simple } = req.query;

        page = Number(page) || 1;
        limit = Number(limit) || 50;

        let where = "WHERE 1=1";
        let params = [];

        if (search) {
            where += ` AND (code LIKE ? OR name LIKE ? OR loose_code LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        /* 🔥 SIMPLE MODE */
        if (simple === "true") {
            const [rows] = await db.query(
                `SELECT code, name, loose_code 
                 FROM products_master 
                 ${where}
                 ORDER BY name ASC`,
                params
            );

            return res.json(Array.isArray(rows) ? rows : []);
        }

        const offset = (page - 1) * limit;

        /* TOTAL COUNT */
        const [[countResult]] = await db.query(
            `SELECT COUNT(*) as total FROM products_master ${where}`,
            params
        );

        /* DATA */
        const [rows] = await db.query(
            `SELECT code, name, loose_code 
             FROM products_master 
             ${where}
             ORDER BY code ASC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        res.json({
            data: Array.isArray(rows) ? rows : [],
            total: countResult?.total || 0,
            page,
            limit
        });

    } catch (err) {
        console.log("🔥 Product Fetch Error:", err);

        res.status(500).json({
            message: "Database Error",
            error: err.message
        });
    }
});

/* ================= ADD PRODUCT ================= */
router.post("/", async (req, res) => {
    try {
        let { code, name, loose_code } = req.body;

        name = name?.trim();
        code = code?.toString().trim();

        if (!name) {
            return res.status(400).json({ message: "Name is required" });
        }

        if (code) {
            const [exists] = await db.query(
                "SELECT code FROM products_master WHERE code = ?",
                [code]
            );

            if (exists.length > 0) {
                return res.status(400).json({ message: "Code already exists" });
            }
        }

        await db.query(
            `INSERT INTO products_master(code, name, loose_code)
             VALUES (?, ?, ?)`,
            [code || null, name, loose_code || null]
        );

        res.json({ message: "✅ Product Added Successfully" });

    } catch (err) {
        console.log("🔥 Insert Error:", err);

        res.status(500).json({
            message: "Insert Failed",
            error: err.message
        });
    }
});

/* ================= BULK INSERT ================= */
router.post("/bulk", async (req, res) => {
    try {
        const { products } = req.body;

        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ message: "Invalid data" });
        }

        const values = products.map(p => [
            p.code?.toString().trim() || null,
            p.name?.trim() || "",
            p.loose_code || null
        ]);

        await db.query(
            `INSERT IGNORE INTO products_master(code, name, loose_code) VALUES ?`,
            [values]
        );

        res.json({ message: "✅ Bulk Insert Success" });

    } catch (err) {
        console.log("🔥 Bulk Insert Error:", err);

        res.status(500).json({
            message: "Bulk Insert Failed",
            error: err.message
        });
    }
});

/* ================= UPDATE ================= */
router.put("/", async (req, res) => {
    try {
        const { code, name, loose_code } = req.body;

        if (!code) {
            return res.status(400).json({ message: "Code required" });
        }

        const [existing] = await db.query(
            "SELECT * FROM products_master WHERE code = ?",
            [code]
        );

        if (existing.length === 0) {
            return res.status(404).json({ message: "Product Not Found" });
        }

        const old = existing[0];

        await db.query(
            `UPDATE products_master 
             SET name = ?, loose_code = ?
             WHERE code = ?`,
            [
                name?.trim() || old.name,
                loose_code || old.loose_code,
                code
            ]
        );

        res.json({ message: "✅ Product Updated" });

    } catch (err) {
        console.log("🔥 Update Error:", err);

        res.status(500).json({
            message: "Update Failed",
            error: err.message
        });
    }
});

/* ================= DELETE ================= */
router.delete("/:code", async (req, res) => {
    try {
        const code = req.params.code;

        await db.query(
            "DELETE FROM products_master WHERE code = ?",
            [code]
        );

        res.json({ message: "✅ Product Deleted" });

    } catch (err) {
        console.log("🔥 Delete Error:", err);

        res.status(500).json({
            message: "Delete Failed",
            error: err.message
        });
    }
});

/* ================= CHECK EXIST ================= */
router.get("/check/:code", async (req, res) => {
    try {
        const code = req.params.code;

        const [rows] = await db.query(
            "SELECT code FROM products_master WHERE code = ?",
            [code]
        );

        res.json({ exists: rows.length > 0 });

    } catch (err) {
        console.log("🔥 Check Exist Error:", err);

        res.status(500).json({
            message: "Error",
            error: err.message
        });
    }
});

/* ================= GET SINGLE ================= */
router.get("/:code", async (req, res) => {
    try {
        const code = req.params.code;

        const [rows] = await db.query(
            "SELECT * FROM products_master WHERE code = ?",
            [code]
        );

        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(404).json({ message: "Not Found" });
        }

        res.json(rows[0]);

    } catch (err) {
        console.log("🔥 Fetch One Error:", err);

        res.status(500).json({
            message: "Error",
            error: err.message
        });
    }
});

module.exports = router;