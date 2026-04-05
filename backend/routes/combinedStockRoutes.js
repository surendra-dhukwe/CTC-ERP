const express = require("express");
const router = express.Router();
const db = require("../db");

/* ================= ITEM-WISE COMBINED STOCK ================= */
router.get("/", async (req, res) => {
    try {

        const [rows] = await db.query(`
            SELECT 
                p.code,
                p.name,
                p.loose_code,

                COALESCE(s1.stock1, 0) AS stock1,
                COALESCE(s2.stock2, 0) AS stock2,
                COALESCE(s3.stock3, 0) AS stock3,
                COALESCE(s4.stock4, 0) AS stock4,

                (
                    COALESCE(s1.stock1, 0)
                    + COALESCE(s2.stock2, 0)
                    + COALESCE(s3.stock3, 0)
                    + COALESCE(s4.stock4, 0)
                ) AS total_stock

            FROM products_master p

            /* STOCK 1 */
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

            /* STOCK 2 */
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

            /* STOCK 3 */
            LEFT JOIN (
                SELECT 
                    code,
                    SUM(
                        CASE 
                            WHEN type='receive' THEN total_quantity
                            WHEN type='dispatch' THEN -total_quantity
                            ELSE 0
                        END
                    ) AS stock3
                FROM transactions_stock3
                GROUP BY code
            ) s3 ON p.code = s3.code

            /* STOCK 4 */
            LEFT JOIN (
                SELECT 
                    code,
                    SUM(
                        CASE 
                            WHEN type='receive' THEN total_quantity
                            WHEN type='dispatch' THEN -total_quantity
                            ELSE 0
                        END
                    ) AS stock4
                FROM transactions_stock4
                GROUP BY code
            ) s4 ON p.code = s4.code

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


/* ================= DOWNLOAD CSV ================= */
router.get("/download", async (req, res) => {
    try {

        const [rows] = await db.query(`
            SELECT 
                p.code,
                p.name,
                p.loose_code,

                COALESCE(s1.stock1, 0) AS stock1,
                COALESCE(s2.stock2, 0) AS stock2,
                COALESCE(s3.stock3, 0) AS stock3,
                COALESCE(s4.stock4, 0) AS stock4,

                (
                    COALESCE(s1.stock1, 0)
                    + COALESCE(s2.stock2, 0)
                    + COALESCE(s3.stock3, 0)
                    + COALESCE(s4.stock4, 0)
                ) AS total_stock

            FROM products_master p

            LEFT JOIN (
                SELECT code,
                SUM(CASE 
                    WHEN type='receive' THEN total_quantity
                    WHEN type='dispatch' THEN -total_quantity
                    ELSE 0 END
                ) AS stock1
                FROM transactions_stock1
                GROUP BY code
            ) s1 ON p.code = s1.code

            LEFT JOIN (
                SELECT code,
                SUM(CASE 
                    WHEN type='receive' THEN total_quantity
                    WHEN type='dispatch' THEN -total_quantity
                    ELSE 0 END
                ) AS stock2
                FROM transactions_stock2
                GROUP BY code
            ) s2 ON p.code = s2.code

            LEFT JOIN (
                SELECT code,
                SUM(CASE 
                    WHEN type='receive' THEN total_quantity
                    WHEN type='dispatch' THEN -total_quantity
                    ELSE 0 END
                ) AS stock3
                FROM transactions_stock3
                GROUP BY code
            ) s3 ON p.code = s3.code

            LEFT JOIN (
                SELECT code,
                SUM(CASE 
                    WHEN type='receive' THEN total_quantity
                    WHEN type='dispatch' THEN -total_quantity
                    ELSE 0 END
                ) AS stock4
                FROM transactions_stock4
                GROUP BY code
            ) s4 ON p.code = s4.code
        `);

        let csv = "Code,Name,Loose Code,Stock1,Stock2,Stock3,Stock4,Total\n";

        rows.forEach(r => {
            csv += `${r.code || ""},${r.name || ""},${r.loose_code || ""},${r.stock1},${r.stock2},${r.stock3},${r.stock4},${r.total_stock}\n`;
        });

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=combined_stock.csv");

        res.send(csv);

    } catch (err) {
        console.log("🔥 CSV Error:", err);

        res.status(500).send("Error generating CSV");
    }
});

module.exports = router;