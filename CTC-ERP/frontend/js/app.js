/* ================= GLOBAL PRODUCTS ================= */
let products = [];

/* ================= BASE URL ================= */
const BASE_URL = "http://localhost:3000";

/* ================= DETECT STOCK ================= */
let stockType = "stock1";
const pathName = window.location.pathname.toLowerCase();
if (pathName.includes("stock2")) stockType = "stock2";
else if (pathName.includes("stock3")) stockType = "stock3";
else if (pathName.includes("stock4")) stockType = "stock4";

/* ================= DETECT TYPE ================= */
let type = pathName.includes("dispatch") ? "dispatch" : "receive";

/* ================= MESSAGE BOX ================= */
function showMessage(msg, success = true) {
    let box = document.getElementById("msgBox");

    if (!box) {
        box = document.createElement("div");
        box.id = "msgBox";
        box.style.position = "fixed";
        box.style.top = "20px";
        box.style.right = "20px";
        box.style.padding = "10px 15px";
        box.style.color = "#fff";
        box.style.borderRadius = "6px";
        box.style.zIndex = "9999";
        document.body.appendChild(box);
    }

    box.style.background = success ? "#28a745" : "#dc3545";
    box.innerText = msg;
    box.style.display = "block";

    setTimeout(() => box.style.display = "none", 3000);
}

/* ================= DATE AUTO ================= */
window.addEventListener("DOMContentLoaded", () => {
    const dateInput = document.getElementById("transactionDate");
    if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];
});

/* ================= CLEAN ================= */
function clean(val) {
    return String(val || "").trim().toLowerCase();
}

/* ================= LOAD PRODUCTS ================= */
async function loadProducts() {
    try {
        const res = await fetch(`${BASE_URL}/products`);
        const data = await res.json();

        products = data.data || data || [];

        const tbody = document.querySelector("#itemTable tbody");
        if (tbody && tbody.rows.length === 0) addRow();

    } catch (err) {
        showMessage("Backend not connected", false);
    }
}

/* ================= SMART DROPDOWN ================= */
function attachSmartDropdown(input, type, row) {

    let box = document.createElement("div");
    box.style.position = "absolute";
    box.style.top = "100%";
    box.style.left = "0";
    box.style.right = "0";
    box.style.background = "#fff";
    box.style.border = "1px solid #ccc";
    box.style.maxHeight = "200px";
    box.style.overflowY = "auto";
    box.style.zIndex = "9999";
    box.style.display = "none";

    input.parentNode.style.position = "relative";
    input.parentNode.appendChild(box);

    input.addEventListener("input", () => {
        const val = clean(input.value);
        box.innerHTML = "";

        if (!val) {
            box.style.display = "none";
            return;
        }

        const filtered = products.filter(p => {
            const code = clean(p.code);
            const name = clean(p.name);
            const loose = clean(p.loose_code);

            if (type === "code") return code.includes(val);
            if (type === "name") return name.includes(val);
            if (type === "loose") return loose.includes(val);
        }).slice(0, 40);

        if (filtered.length === 0) {
            box.style.display = "none";
            return;
        }

        filtered.forEach(p => {
            const item = document.createElement("div");
            item.style.padding = "6px";
            item.style.cursor = "pointer";
            item.innerText = `${p.code} - ${p.name}`;

            item.addEventListener("click", () => {
                fillRow(row, p);
                box.style.display = "none";
            });

            box.appendChild(item);
        });

        box.style.display = "block";
    });

    document.addEventListener("click", (e) => {
        if (!input.contains(e.target) && !box.contains(e.target)) {
            box.style.display = "none";
        }
    });
}

/* ================= FILL ROW ================= */
function fillRow(row, p) {
    if (!p) return;

    row.querySelector(".code").value = p.code || "";
    row.querySelector(".name").value = p.name || "";
    row.querySelector(".loose").value = p.loose_code || "";
}

/* ================= AUTO-FILL ROW ================= */
function autoFillRow(row) {
    const codeInput = row.querySelector(".code");
    const nameInput = row.querySelector(".name");
    const looseInput = row.querySelector(".loose");

    // 🔥 NEW SYSTEM ADD
    attachSmartDropdown(codeInput, "code", row);
    attachSmartDropdown(nameInput, "name", row);
    attachSmartDropdown(looseInput, "loose", row);

    // 🔥 OLD SYSTEM SAFE (BACKUP)
    codeInput.addEventListener("change", () => {
        const p = products.find(x => clean(x.code) === clean(codeInput.value));
        fillRow(row, p);
    });

    nameInput.addEventListener("change", () => {
        const p = products.find(x => clean(x.name) === clean(nameInput.value));
        fillRow(row, p);
    });

    looseInput.addEventListener("change", () => {
        const p = products.find(x => clean(x.loose_code) === clean(looseInput.value));
        fillRow(row, p);
    });
}

/* ================= ADD ROW ================= */
function addRow() {
    const table = document.querySelector("#itemTable tbody");
    if (!table) return;

    const row = table.insertRow();
    row.innerHTML = `
        <td><input class="code" list="codeList"></td>
        <td><input class="name" list="nameList"></td>
        <td><input class="loose" list="looseList"></td>
        <td><input type="number" class="bags"></td>
        <td><input type="number" class="qty"></td>
        <td><input class="total" readonly></td>
    `;

    autoFillRow(row);

    row.querySelectorAll(".bags,.qty").forEach(input =>
        input.addEventListener("input", calculateRow)
    );

    row.querySelector(".code").focus();
}

/* ================= CALCULATE ================= */
function calculateRow(e) {
    const row = e.target.closest("tr");
    const bags = parseFloat(row.querySelector(".bags").value) || 0;
    const qty = parseFloat(row.querySelector(".qty").value) || 0;

    row.querySelector(".total").value = bags * qty;
    updateTotals();
}

/* ================= TOTAL ================= */
function updateTotals() {
    let totalBags = 0, totalQty = 0;

    document.querySelectorAll("#itemTable tbody tr").forEach(row => {
        totalBags += parseFloat(row.querySelector(".bags").value) || 0;
        totalQty += parseFloat(row.querySelector(".total").value) || 0;
    });

    document.getElementById("totalBags").innerText = totalBags;
    document.getElementById("grandTotalQty").innerText = totalQty;
}

/* ================= SAVE ================= */
async function saveTransaction() {
    try {
        const rows = document.querySelectorAll("#itemTable tbody tr");

        const invoice = document.getElementById("invoice")?.value || "";
        const party = document.getElementById("party")?.value || "";

        let items = [];

        rows.forEach((row, index) => {
            const code = row.querySelector(".code").value;
            const name = row.querySelector(".name").value.trim();
            const loose_code = row.querySelector(".loose").value;
            const bags = parseFloat(row.querySelector(".bags").value) || 0;
            const qty = parseFloat(row.querySelector(".qty").value) || 0;

            if (!name) throw new Error(`Row ${index + 1}: Name required`);
            if (bags <= 0 || qty <= 0) throw new Error(`Row ${index + 1}: Invalid qty`);

            items.push({
                code,
                name,
                loose_code,
                bags,
                quantity: qty,
                invoice_no: invoice,
                party_name: party
            });
        });

        const res = await fetch(`${BASE_URL}/transactions/${stockType}/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, items })
        });

        const data = await res.json();

        if (!data.success) throw new Error(data.message);

        showMessage("Saved Successfully");

        document.querySelector("#itemTable tbody").innerHTML = "";
        addRow();

    } catch (err) {
        showMessage(err.message, false);
    }
}

/* ================= INIT ================= */
loadProducts();
addRow();