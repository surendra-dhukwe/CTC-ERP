const express = require('express');
const router = express.Router();
const db = require('../db');
const XLSX = require('xlsx');

/* ================= COMMON FUNCTION ================= */
async function downloadStock(stockTable, stockName, req, res, format = "csv") {
    try {

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

        const sql = `
        SELECT 
            code,
            name,
            loose_code,
            SUM(
                CASE
                    WHEN type='receive' THEN total_quantity
                    WHEN type='dispatch' THEN -total_quantity
                    ELSE 0
                END
            ) AS total_quantity
        FROM ${stockTable}
        ${where}
        GROUP BY code, name, loose_code
        ORDER BY name
        `;

        const [results] = await db.query(sql, params);

        if (!Array.isArray(results) || results.length === 0) {
            return res.status(404).json({ message: "No Data Found" });
        }

        const formatted = results.map(r => ({
            Code: r.code || "",
            Name: r.name || "",
            Loose_Code: r.loose_code || "",
            Final_Stock: r.total_quantity || 0
        }));

        /* ================= CSV ================= */
        if (format === "csv") {

            const escapeCSV = (val) => {
                if (val == null) return "";
                val = val.toString();
                if (val.includes(",") || val.includes('"')) {
                    return `"${val.replace(/"/g, '""')}"`;
                }
                return val;
            };

            let csv = "Code,Name,Loose Code,Final Stock\n";

            formatted.forEach(row => {
                csv += `${escapeCSV(row.Code)},${escapeCSV(row.Name)},${escapeCSV(row.Loose_Code)},${row.Final_Stock}\n`;
            });

            const today = new Date().toISOString().split("T")[0];

            res.setHeader(
                'Content-Disposition',
                `attachment; filename=${stockName.toLowerCase()}_${today}.csv`
            );
            res.setHeader('Content-Type', 'text/csv');

            return res.send(csv);
        }

        /* ================= EXCEL ================= */
        const ws = XLSX.utils.json_to_sheet(formatted);

        const colWidths = Object.keys(formatted[0]).map(key => {
            let maxLength = key.length;
            formatted.forEach(row => {
                const val = row[key] ? row[key].toString() : "";
                if (val.length > maxLength) maxLength = val.length;
            });
            return { wch: maxLength + 2 };
        });

        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, stockName);

        const buffer = XLSX.write(wb, {
            type: "buffer",
            bookType: "xlsx"
        });

        const today = new Date().toISOString().split("T")[0];

        res.setHeader(
            "Content-Disposition",
            `attachment; filename=${stockName.toLowerCase()}_${today}.xlsx`
        );

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        res.send(buffer);

    } catch (err) {
        console.log("🔥 Stock Download Error:", err);

        res.status(500).json({
            message: "Download Error",
            error: err.message
        });
    }
}

/* ================= 🔥 COMBINED ALL STOCK DOWNLOAD ================= */
router.get('/combined/download', async (req, res) => {
    try {

        const format = req.query.format === "excel" ? "excel" : "csv";

        const [rows] = await db.query(`
            SELECT 
                p.code,
                p.name,
                p.loose_code,

                COALESCE(s1.stock1,0) as stock1,
                COALESCE(s2.stock2,0) as stock2,
                COALESCE(s3.stock3,0) as stock3,
                COALESCE(s4.stock4,0) as stock4,

                (
                    COALESCE(s1.stock1,0) +
                    COALESCE(s2.stock2,0) +
                    COALESCE(s3.stock3,0) +
                    COALESCE(s4.stock4,0)
                ) as total

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

            ORDER BY p.name ASC
        `);

        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(404).json({ message: "No Data Found" });
        }

        const formatted = rows.map(r => ({
            Code: r.code || "",
            Name: r.name || "",
            Loose_Code: r.loose_code || "",
            Stock1: r.stock1 || 0,
            Stock2: r.stock2 || 0,
            Stock3: r.stock3 || 0,
            Stock4: r.stock4 || 0,
            Total: r.total || 0
        }));

        /* ===== CSV ===== */
        if (format === "csv") {
            let csv = "Code,Name,Loose Code,Stock1,Stock2,Stock3,Stock4,Total\n";

            formatted.forEach(r => {
                csv += `${r.Code},${r.Name},${r.Loose_Code},${r.Stock1},${r.Stock2},${r.Stock3},${r.Stock4},${r.Total}\n`;
            });

            res.setHeader(
                "Content-Disposition",
                "attachment; filename=combined_stock.csv"
            );
            res.setHeader("Content-Type", "text/csv");

            return res.send(csv);
        }

        /* ===== EXCEL ===== */
        const ws = XLSX.utils.json_to_sheet(formatted);
        const wb = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(wb, ws, "Combined");

        const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        res.setHeader(
            "Content-Disposition",
            "attachment; filename=combined_stock.xlsx"
        );

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        res.send(buffer);

    } catch (err) {
        console.log("🔥 Combined Download Error:", err);

        res.status(500).json({
            message: "Download Error",
            error: err.message
        });
    }
});

/* ================= STOCK ROUTES ================= */
router.get('/stock1/download', (req, res) => {
    downloadStock('transactions_stock1', 'Stock1', req, res);
});

router.get('/stock2/download', (req, res) => {
    downloadStock('transactions_stock2', 'Stock2', req, res);
});

router.get('/stock3/download', (req, res) => {
    downloadStock('transactions_stock3', 'Stock3', req, res);
});

router.get('/stock4/download', (req, res) => {
    downloadStock('transactions_stock4', 'Stock4', req, res);
});

/* ================= DYNAMIC ROUTE ================= */
router.get('/:stock', (req, res) => {
    try {
        const stock = req.params.stock.toLowerCase();
        const validStocks = ["stock1","stock2","stock3","stock4"];

        if (!validStocks.includes(stock)) {
            return res.status(400).json({ message: "Invalid Stock" });
        }

        const format = req.query.format === "excel" ? "excel" : "csv";

        const table = `transactions_${stock}`;
        const stockName = stock.toUpperCase();

        downloadStock(table, stockName, req, res, format);

    } catch (err) {
        console.log("🔥 Route Error:", err);

        res.status(500).json({
            message: "Server Error",
            error: err.message
        });
    }
});

module.exports = router;