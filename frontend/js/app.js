/* ================= GLOBAL ================= */
let products = [];
const BASE_URL = "http://localhost:3000";

/* ================= DETECT STOCK ================= */
let stockType = "stock1";
const pathName = window.location.pathname.toLowerCase();

if (pathName.includes("stock2")) stockType = "stock2";
else if (pathName.includes("stock3")) stockType = "stock3";
else if (pathName.includes("stock4")) stockType = "stock4";

/* ================= DETECT TYPE ================= */
let type = pathName.includes("dispatch") ? "dispatch" : "receive";

/* ================= DATE AUTO ================= */
window.addEventListener("DOMContentLoaded", () => {
    const dateInput = document.getElementById("transactionDate");
    if (dateInput) {
        dateInput.value = new Date().toISOString().split("T")[0];
    }
});

/* ================= REMOVE DUPLICATES ================= */
function removeDuplicates(data) {
    const map = new Map();

    data.forEach(p => {
        const key = String(p.code || p.loose_code || p.name).trim();
        if (!map.has(key)) map.set(key, p);
    });

    return Array.from(map.values());
}

/* ================= LOAD PRODUCTS ================= */
async function loadProducts() {
    try {
        const res = await fetch(`${BASE_URL}/products`);

        if (!res.ok) throw new Error("API Failed");

        const raw = await res.json();
        const data = Array.isArray(raw) ? raw : raw.data || [];

        products = removeDuplicates(data);

        const codeList = document.getElementById("codeList");
        const nameList = document.getElementById("nameList");
        const looseList = document.getElementById("looseList");

        if (codeList) codeList.innerHTML = "";
        if (nameList) nameList.innerHTML = "";
        if (looseList) looseList.innerHTML = "";

        products.forEach(p => {
            const code = String(p.code ?? "").trim();
            const name = p.name ?? "";
            const loose = String(p.loose_code ?? "").trim();

            if (codeList && code) {
                const opt = document.createElement("option");
                opt.value = code;
                opt.label = name;
                codeList.appendChild(opt);
            }

            if (nameList && name) {
                const opt = document.createElement("option");
                opt.value = name;
                opt.label = code;
                nameList.appendChild(opt);
            }

            if (looseList && loose) {
                const opt = document.createElement("option");
                opt.value = loose;
                opt.label = name;
                looseList.appendChild(opt);
            }
        });

        document.querySelectorAll("#itemTable tbody tr").forEach(autoFillRow);

        const tbody = document.querySelector("#itemTable tbody");
        if (tbody && tbody.rows.length === 0) addRow();

    } catch (err) {
        console.error("❌ Product Load Error:", err);
    }
}

/* ================= FIND PRODUCT ================= */
function findProduct(val, type) {
    val = String(val).trim().toLowerCase();

    return products.find(p => {
        if (type === "code") return String(p.code ?? "").toLowerCase() === val;
        if (type === "name") return String(p.name ?? "").toLowerCase() === val;
        if (type === "loose") return String(p.loose_code ?? "").toLowerCase() === val;
    });
}

/* ================= SUGGEST API ================= */
async function fetchSuggestions(value) {
    if (!value) return;

    const res = await fetch(`${BASE_URL}/suggest?search=${value}`);
    const data = await res.json();

    const codeList = document.getElementById("codeList");
    const nameList = document.getElementById("nameList");
    const looseList = document.getElementById("looseList");

    codeList.innerHTML = "";
    nameList.innerHTML = "";
    looseList.innerHTML = "";

    data.forEach(item => {
        codeList.innerHTML += `<option value="${item.code}">`;
        nameList.innerHTML += `<option value="${item.name}">`;
        looseList.innerHTML += `<option value="${item.loose_code || ''}">`;
    });
}

/* ================= AUTO FILL ================= */
function autoFillRow(row) {
    const code = row.querySelector(".code");
    const name = row.querySelector(".name");
    const loose = row.querySelector(".loose");

    function fill(p) {
        if (!p) return;
        code.value = p.code ?? "";
        name.value = p.name ?? "";
        loose.value = p.loose_code ?? "";
    }

    code.addEventListener("input", () => {
        fetchSuggestions(code.value);
        fill(findProduct(code.value, "code"));
    });

    name.addEventListener("input", () => {
        fetchSuggestions(name.value);
        fill(findProduct(name.value, "name"));
    });

    loose.addEventListener("input", () => {
        fetchSuggestions(loose.value);
        fill(findProduct(loose.value, "loose"));
    });
}

/* ================= ADD ROW ================= */
function addRow() {
    const tbody = document.querySelector("#itemTable tbody");
    if (!tbody) return;

    const row = tbody.insertRow();

    row.innerHTML = `
        <td><input type="text" class="code" list="codeList" placeholder="Code"></td>
        <td><input type="text" class="name" list="nameList" placeholder="Name"></td>
        <td><input type="text" class="loose" list="looseList" placeholder="Loose Code"></td>
        <td><input type="number" class="bags"></td>
        <td><input type="number" class="qty"></td>
        <td><input class="total" readonly></td>
    `;

    autoFillRow(row);

    row.querySelectorAll(".bags,.qty").forEach(i => {
        i.addEventListener("input", calculateRow);
    });

    const inputs = row.querySelectorAll("input");

    inputs.forEach((input, i) => {
        input.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                e.preventDefault();

                if (i < inputs.length - 1) {
                    inputs[i + 1].focus();
                } else {
                    addRow();
                }
            }
        });
    });

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
    let bags = 0;
    let qty = 0;

    document.querySelectorAll("#itemTable tbody tr").forEach(row => {
        bags += parseFloat(row.querySelector(".bags").value) || 0;
        qty += parseFloat(row.querySelector(".total").value) || 0;
    });

    document.getElementById("totalBags").innerText = bags;
    document.getElementById("grandTotalQty").innerText = qty;
}

/* ================= SAVE ================= */
async function saveTransaction() {
    try {
        const invoice = document.getElementById("invoice")?.value || "";
        const party = document.getElementById("party")?.value || "";

        const rows = document.querySelectorAll("#itemTable tbody tr");

        let items = [];

        rows.forEach(row => {
            const code = row.querySelector(".code").value.trim();
            const name = row.querySelector(".name").value.trim();
            const loose = row.querySelector(".loose").value.trim();
            const bags = parseFloat(row.querySelector(".bags").value) || 0;
            const qty = parseFloat(row.querySelector(".qty").value) || 0;

            if (code || name) {
                items.push({
                    code,
                    name,
                    loose_code: loose,
                    bags,
                    qty,
                    totalQty: bags * qty,
                    invoice_no: invoice,
                    party_name: party
                });
            }
        });

        if (!items.length) return alert("❌ No items");

        const res = await fetch(`${BASE_URL}/transactions/${stockType}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, items })
        });

        if (!res.ok) throw new Error(await res.text());

        alert("✅ Saved");

        document.querySelector("#itemTable tbody").innerHTML = "";
        addRow();

    } catch (err) {
        console.error(err);
        alert("❌ Save failed");
    }
}

/* ================= DOWNLOAD ================= */
async function downloadExcel() {
    try {
        const res = await fetch(`${BASE_URL}/final-stock/${stockType}/download`);

        if (!res.ok) throw new Error();

        const blob = await res.blob();

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${stockType}.csv`;
        a.click();

    } catch {
        alert("❌ Download failed");
    }
}

/* ================= INIT ================= */
loadProducts();
addRow();