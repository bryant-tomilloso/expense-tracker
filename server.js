const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Database setup ---
const db = new sqlite3.Database('./expenses.db', (err) => {
  if (err) console.error('Failed to connect to database', err);
  else console.log('Connected to SQLite database');
});

db.run(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    category TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL
  )
`);

// --- Routes ---

// Build a WHERE clause from optional ?month=YYYY-MM&category=Food&type=expense
function buildFilters(query) {
  const conditions = [];
  const params = [];

  if (/^\d{4}-\d{2}$/.test(query.month || '')) {
    conditions.push('substr(date, 1, 7) = ?');
    params.push(query.month);
  }
  if (query.category) {
    conditions.push('category = ?');
    params.push(query.category);
  }
  if (['income', 'expense'].includes(query.type)) {
    conditions.push('type = ?');
    params.push(query.type);
  }

  return {
    where: conditions.length ? 'WHERE ' + conditions.join(' AND ') : '',
    params
  };
}

// GET transactions (newest first), optionally filtered
app.get('/transactions', (req, res) => {
  const { where, params } = buildFilters(req.query);
  db.all(
    `SELECT * FROM transactions ${where} ORDER BY date DESC, id DESC`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// GET summary (total income, total expenses, balance), optionally filtered
app.get('/summary', (req, res) => {
  const { where, params } = buildFilters(req.query);
  db.get(
    `SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as totalIncome,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as totalExpense
    FROM transactions ${where}`,
    params,
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        totalIncome: row.totalIncome,
        totalExpense: row.totalExpense,
        balance: row.totalIncome - row.totalExpense
      });
    }
  );
});

// POST a new transaction
app.post('/transactions', (req, res) => {
  const { amount, type, category, description, date } = req.body;

  if (!amount || !type || !category || !date) {
    return res.status(400).json({ error: 'amount, type, category, and date are required' });
  }
  if (!['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: 'type must be "income" or "expense"' });
  }

  db.run(
    'INSERT INTO transactions (amount, type, category, description, date) VALUES (?, ?, ?, ?, ?)',
    [amount, type, category, description || '', date],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, amount, type, category, description, date });
    }
  );
});

// PUT (edit) an existing transaction
app.put('/transactions/:id', (req, res) => {
  const { amount, type, category, description, date } = req.body;

  if (!amount || !type || !category || !date) {
    return res.status(400).json({ error: 'amount, type, category, and date are required' });
  }
  if (!['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: 'type must be "income" or "expense"' });
  }

  db.run(
    'UPDATE transactions SET amount = ?, type = ?, category = ?, description = ?, date = ? WHERE id = ?',
    [amount, type, category, description || '', date, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Transaction not found' });
      res.json({ id: Number(req.params.id), amount, type, category, description, date });
    }
  );
});

// DELETE a transaction
app.delete('/transactions/:id', (req, res) => {
  db.run('DELETE FROM transactions WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ deleted: req.params.id });
  });
});


// --- Export helpers & routes ---

function getTransactionsInRange(from, to) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM transactions WHERE date BETWEEN ? AND ? ORDER BY date ASC, id ASC',
      [from, to],
      (err, rows) => (err ? reject(err) : resolve(rows))
    );
  });
}

function validRange(req, res) {
  const { from, to } = req.query;
  const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
  if (!isDate(from) || !isDate(to)) {
    res.status(400).json({ error: 'from and to are required (YYYY-MM-DD)' });
    return null;
  }
  if (from > to) {
    res.status(400).json({ error: '"from" date must be before "to" date' });
    return null;
  }
  return { from, to };
}

function totalsOf(rows) {
  const income = rows.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const expense = rows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  return { income, expense, balance: income - expense };
}

// GET /export/excel?from=2026-09-01&to=2026-09-30
app.get('/export/excel', async (req, res) => {
  const range = validRange(req, res);
  if (!range) return;

  try {
    const rows = await getTransactionsInRange(range.from, range.to);
    const totals = totalsOf(rows);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Transactions');

    sheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Description', key: 'description', width: 32 },
      { header: 'Amount', key: 'amount', width: 14, style: { numFmt: '#,##0.00' } }
    ];
    sheet.getRow(1).font = { bold: true };

    rows.forEach((r) => sheet.addRow(r));

    sheet.addRow({});
    sheet.addRow({ description: 'Total income', amount: totals.income }).font = { bold: true };
    sheet.addRow({ description: 'Total expenses', amount: totals.expense }).font = { bold: true };
    sheet.addRow({ description: 'Balance', amount: totals.balance }).font = { bold: true };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="expenses_${range.from}_to_${range.to}.xlsx"`
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /export/pdf?from=2026-09-01&to=2026-09-30
app.get('/export/pdf', async (req, res) => {
  const range = validRange(req, res);
  if (!range) return;

  try {
    const rows = await getTransactionsInRange(range.from, range.to);
    const totals = totalsOf(rows);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="expenses_${range.from}_to_${range.to}.pdf"`
    );

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    doc.fontSize(18).text('Expense Report', { align: 'center' });
    doc.fontSize(10).fillColor('#555').text(`${range.from} to ${range.to}`, { align: 'center' });
    doc.moveDown(1.5).fillColor('#000');

    const cols = { date: 40, type: 115, category: 180, description: 260, amount: 470 };

    const drawHeader = () => {
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('Date', cols.date, y);
      doc.text('Type', cols.type, y);
      doc.text('Category', cols.category, y);
      doc.text('Description', cols.description, y);
      doc.text('Amount', cols.amount, y, { width: 85, align: 'right' });
      doc.moveTo(40, y + 14).lineTo(555, y + 14).stroke();
      doc.y = y + 20;
      doc.font('Helvetica');
    };

    drawHeader();

    rows.forEach((r) => {
      if (doc.y > 760) {
        doc.addPage();
        drawHeader();
      }
      const y = doc.y;
      doc.fontSize(9);
      doc.text(r.date, cols.date, y);
      doc.text(r.type, cols.type, y);
      doc.text(r.category, cols.category, y, { width: 75 });
      doc.text(r.description || '-', cols.description, y, { width: 200, height: 12, ellipsis: true });
      doc.text(r.amount.toFixed(2), cols.amount, y, { width: 85, align: 'right' });
      doc.y = y + 16;
    });

    if (rows.length === 0) {
      doc.fontSize(10).text('No transactions in this date range.', 40, doc.y);
    }

    if (doc.y > 700) doc.addPage();
    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text(`Total income:   ${totals.income.toFixed(2)}`, 40);
    doc.text(`Total expenses: ${totals.expense.toFixed(2)}`);
    doc.text(`Balance:        ${totals.balance.toFixed(2)}`);

    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
