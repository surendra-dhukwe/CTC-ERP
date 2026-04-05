const express = require('express');
const router = express.Router();
const db = require('../db');
const XLSX = require('xlsx');

/* ================= COMMON EXPORT FUNCTION ================= */
async function exportStock(stockTable, stockName, req, res){
    try {

        const { from, to, type, party, invoice } = req.query;

        let where = "WHERE 1=1";
        let params = [];

        if (from && to) {
            where += " AND DATE(entry_date) BETWEEN ? AND ?";
            params.push(from, to);
        }

        if (type) {
            where += " AND type = ?";
            params.push(type);
        }

        if (party) {
            where += " AND party_name LIKE ?";
            params.push(`%${party}%`);
        }

        if (invoice) {
            where += " AND invoice_no LIKE ?";
            params.push(`%${invoice}%`);
        }

        /* ================= QUERY ================= */
        const [result] = await db.query(`
            SELECT 
                code,
                name,
                loose_code,
                bags,
                quantity,
                total_quantity,
                type,
                invoice_no,
                party_name,
                entry_date
            FROM ${stockTable}
            ${where}
            ORDER BY entry_date DESC
        `, params);

        if (!Array.isArray(result) || result.length === 0) {
            return res.status(404).json({ message: "No Data Found" });
        }

        /* ================= FORMAT ================= */
        const formatted = result.map(row => ({
            Code: row.code || "",
            Name: row.name || "",
            Loose_Code: row.loose_code || "",
            Bags: row.bags || 0,
            Per_Bag_Qty: row.quantity || 0,
            Total_Qty: row.total_quantity || 0,
            Type: row.type || "",
            Invoice: row.invoice_no || "",
            Party: row.party_name || "",
            Date: row.entry_date 
                ? new Date(row.entry_date).toLocaleString()
                : ""
        }));

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

    } catch(err){
        console.log("🔥 Export Error:", err);

        res.status(500).json({ 
            message: "Export Failed", 
            error: err.message 
        });
    }
}

/* ================= 🔥 COMBINED EXPORT (ALL 4 STOCKS) ================= */
router.get('/combined/export', async (req, res) => {
    try {

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
                ) as stock1
                FROM transactions_stock1 GROUP BY code
            ) s1 ON p.code = s1.code

            LEFT JOIN (
                SELECT code,
                SUM(CASE 
                    WHEN type='receive' THEN total_quantity
                    WHEN type='dispatch' THEN -total_quantity
                    ELSE 0 END
                ) as stock2
                FROM transactions_stock2 GROUP BY code
            ) s2 ON p.code = s2.code

            LEFT JOIN (
                SELECT code,
                SUM(CASE 
                    WHEN type='receive' THEN total_quantity
                    WHEN type='dispatch' THEN -total_quantity
                    ELSE 0 END
                ) as stock3
                FROM transactions_stock3 GROUP BY code
            ) s3 ON p.code = s3.code

            LEFT JOIN (
                SELECT code,
                SUM(CASE 
                    WHEN type='receive' THEN total_quantity
                    WHEN type='dispatch' THEN -total_quantity
                    ELSE 0 END
                ) as stock4
                FROM transactions_stock4 GROUP BY code
            ) s4 ON p.code = s4.code

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

        const ws = XLSX.utils.json_to_sheet(formatted);
        const wb = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(wb, ws, "Combined Stock");

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
        console.log("🔥 Combined Export Error:", err);

        res.status(500).json({ 
            message: "Export Failed", 
            error: err.message 
        });
    }
});

/* ================= STOCK EXPORT ROUTES ================= */
router.get('/stock1/export', (req, res)=>{
    exportStock("transactions_stock1", "Stock1", req, res);
});

router.get('/stock2/export', (req, res)=>{
    exportStock("transactions_stock2", "Stock2", req, res);
});

router.get('/stock3/export', (req, res)=>{
    exportStock("transactions_stock3", "Stock3", req, res);
});

router.get('/stock4/export', (req, res)=>{
    exportStock("transactions_stock4", "Stock4", req, res);
});

/* ================= DYNAMIC EXPORT ================= */
router.get('/:stock', (req, res)=>{
    try {
        const stock = req.params.stock.toLowerCase();
        const validStocks = ["stock1","stock2","stock3","stock4"];

        if (!validStocks.includes(stock)) {
            return res.status(400).json({ message: "Invalid Stock" });
        }

        const table = `transactions_${stock}`;
        const stockName = stock.toUpperCase();

        exportStock(table, stockName, req, res);

    } catch (err) {
        console.log("🔥 Route Error:", err);

        res.status(500).json({ 
            message: "Server Error", 
            error: err.message 
        });
    }
});

module.exports = router;