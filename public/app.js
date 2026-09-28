const API_URL = 'http://localhost:3000';

const form = document.getElementById('transactionForm');
const listEl = document.getElementById('transactionList');

document.getElementById('date').valueAsDate = new Date();

// ---------- Filters ----------
const filterMonth = document.getElementById('filterMonth');
const filterCategory = document.getElementById('filterCategory');
const filterType = document.getElementById('filterType');

// Fill the category filter from the form's own category list (stays in sync)
document.querySelectorAll('#category option').forEach((opt) => {
  filterCategory.add(new Option(opt.textContent, opt.value));
});

// Turns the current filter values into "?month=2026-09&category=Food"
function getFilterQuery() {
  const params = new URLSearchParams();
  if (filterMonth.value) params.set('month', filterMonth.value);
  if (filterCategory.value) params.set('category', filterCategory.value);
  if (filterType.value) params.set('type', filterType.value);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function refresh() {
  loadTransactions();
  loadSummary();
}

[filterMonth, filterCategory, filterType].forEach((el) =>
  el.addEventListener('change', refresh)
);

document.getElementById('clearFilters').addEventListener('click', () => {
  filterMonth.value = '';
  filterCategory.value = '';
  filterType.value = '';
  refresh();
});

// Prevents description text like "<b>hi</b>" from being treated as HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ---------- Replaces your old loadTransactions ----------
async function loadTransactions() {
  const res = await fetch(`${API_URL}/transactions${getFilterQuery()}`);
  const transactions = await res.json();

  listEl.innerHTML = '';

  if (transactions.length === 0) {
    listEl.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#9ca3af;">No transactions found</td></tr>';
    return;
  }

  transactions.forEach((t) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${t.date}</td>
      <td>${escapeHtml(t.category)}</td>
      <td>${t.description ? escapeHtml(t.description) : '-'}</td>
      <td>${t.type}</td>
      <td class="amount-${t.type}">${t.type === 'expense' ? '-' : '+'}₱${t.amount.toFixed(2)}</td>
      <td><button class="delete-btn" data-id="${t.id}">✕</button></td>
    `;
    listEl.appendChild(row);
  });

  document.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await fetch(`${API_URL}/transactions/${btn.dataset.id}`, { method: 'DELETE' });
      refresh();
    });
  });
}

// ---------- Replaces your old loadSummary ----------
async function loadSummary() {
  const res = await fetch(`${API_URL}/summary${getFilterQuery()}`);
  const summary = await res.json();

  document.getElementById('totalIncome').textContent = `₱${summary.totalIncome.toFixed(2)}`;
  document.getElementById('totalExpense').textContent = `₱${summary.totalExpense.toFixed(2)}`;
  document.getElementById('balance').textContent = `₱${summary.balance.toFixed(2)}`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    amount: parseFloat(document.getElementById('amount').value),
    type: document.getElementById('type').value,
    category: document.getElementById('category').value,
    description: document.getElementById('description').value,
    date: document.getElementById('date').value
  };

  await fetch(`${API_URL}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  form.reset();
  document.getElementById('date').valueAsDate = new Date();
  loadTransactions();
  loadSummary();
});

function exportRange(format) {
  const from = document.getElementById('exportFrom').value;
  const to = document.getElementById('exportTo').value;
  if (!from || !to) return alert('Please pick both a From and a To date.');
  if (from > to) return alert('"From" must be earlier than "To".');
  window.location.href = `${API_URL}/export/${format}?from=${from}&to=${to}`;
}

document.getElementById('exportExcel').addEventListener('click', () => exportRange('excel'));
document.getElementById('exportPdf').addEventListener('click', () => exportRange('pdf'));

// default the range to the current month
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
document.getElementById('exportFrom').value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
document.getElementById('exportTo').value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(lastDay)}`;

loadTransactions();
loadSummary();
