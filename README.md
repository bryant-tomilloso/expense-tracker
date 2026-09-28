# Expense Tracker

A full-stack personal finance app for logging income and expenses, tracking your balance, and exporting reports for any date range.

## Features

- Add income and expense transactions with category, description and date
- Live summary of total income, total expenses and balance
- Scrollable transaction list with delete
- Export transactions in a date range to **PDF** or **Excel**

## Tech Stack

- **Backend:** Node.js, Express
- **Database:** SQLite
- **Frontend:** HTML, CSS, vanilla JavaScript
- **Exports:** PDFKit, ExcelJS

## Getting Started

```bash
npm install
node server.js
```

Then open http://localhost:3000. The SQLite database (`expenses.db`) is created automatically on first run.

## API

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/transactions` | List all transactions |
| POST | `/transactions` | Add a transaction |
| DELETE | `/transactions/:id` | Delete a transaction |
| GET | `/summary` | Total income, expenses and balance |
| GET | `/export/excel?from=&to=` | Download Excel report for a date range |
| GET | `/export/pdf?from=&to=` | Download PDF report for a date range |

## Roadmap

- [ ] Filter by month and category
- [ ] Edit transactions
- [ ] Charts (monthly income vs. expenses, spending by category)
- [ ] User accounts (login and signup)
- [ ] AI-powered category suggestions