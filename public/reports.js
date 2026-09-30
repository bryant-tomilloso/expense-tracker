// ---------- Reports ----------
const CATEGORY_COLORS = {
  Food: '#a78bfa',
  Rent: '#f97316',
  Transport: '#4ade80',
  Other: '#9ca3af'
};
const FALLBACK_COLORS = ['#7F77DD', '#1D9E75', '#D85A30', '#888780', '#2563eb', '#dc2626'];
function colorFor(category, index) {
  return CATEGORY_COLORS[category] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

let barChart = null;
let donutChart = null;

async function loadMonthlyChart() {
  const res = await fetch(`${API_URL}/reports/monthly?months=6`);
  const data = await res.json();

  const labels = data.map((d) => {
    const [y, m] = d.month.split('-');
    return new Date(y, m - 1, 1).toLocaleString('default', { month: 'short' });
  });

  const ctx = document.getElementById('monthlyChart').getContext('2d');
  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Income', data: data.map((d) => d.income), backgroundColor: '#16a34a', borderRadius: 3 },
        { label: 'Expenses', data: data.map((d) => d.expense), backgroundColor: '#dc2626', borderRadius: 3 }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

async function loadCategoryChart(month) {
  const qs = month ? `?month=${month}` : '';
  const res = await fetch(`${API_URL}/reports/by-category${qs}`);
  const data = await res.json();

  const labels = data.categories.map((c) => c.category);
  const values = data.categories.map((c) => c.total);
  const colors = data.categories.map((c, i) => colorFor(c.category, i));

  const ctx = document.getElementById('categoryChart').getContext('2d');
  if (donutChart) donutChart.destroy();
  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
    options: { responsive: true, cutout: '65%', plugins: { legend: { position: 'bottom' } } }
  });

  const listEl = document.getElementById('topCategoriesList');
  listEl.innerHTML = '';

  if (data.categories.length === 0) {
    listEl.innerHTML = '<p style="color:#9ca3af;text-align:center;">No expenses this month</p>';
    return;
  }

  const max = Math.max(...values);
  data.categories.forEach((c, i) => {
    const row = document.createElement('div');
    row.className = 'top-cat-row';
    const pct = max ? (c.total / max) * 100 : 0;
    row.innerHTML = `
      <span class="top-cat-name">${escapeHtml(c.category)}</span>
      <div class="top-cat-bar-track"><div class="top-cat-bar-fill" style="width:${pct}%;background:${colorFor(c.category, i)}"></div></div>
      <span class="top-cat-amount">₱${c.total.toFixed(2)}</span>
    `;
    listEl.appendChild(row);
  });
}

async function loadReports() {
  const month = document.getElementById('reportMonth').value || undefined;
  await Promise.all([loadMonthlyChart(), loadCategoryChart(month), loadReportSummary(month)]);
}



document.getElementById('reportMonth').addEventListener('change', loadReports);

const reportsNow = new Date();
document.getElementById('reportMonth').value =
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
loadReports();

async function loadReportSummary(month) {
  const res = await fetch(`${API_URL}/summary?month=${month}`);
  const summary = await res.json();

  document.getElementById('reportIncome').textContent = `₱${summary.totalIncome.toFixed(2)}`;
  document.getElementById('reportExpense').textContent = `₱${summary.totalExpense.toFixed(2)}`;
  document.getElementById('reportBalance').textContent = `₱${summary.balance.toFixed(2)}`;
}