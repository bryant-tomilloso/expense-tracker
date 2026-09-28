# Expense Tracker — Phase 1

A working CRUD app: add income/expense transactions, view them in a table, see a running balance.

## Setup

```bash
npm install
node server.js
```

Then open **http://localhost:3000** in your browser.

## What's here

- `server.js` — Express API with 4 routes:
  - `GET /transactions` — list all transactions
  - `POST /transactions` — add a new transaction
  - `DELETE /transactions/:id` — remove a transaction
  - `GET /summary` — total income, total expense, balance
- `expenses.db` — SQLite database file (created automatically on first run)
- `public/` — plain HTML/CSS/JS frontend (no build step needed)

## Try it

1. Add a few transactions (e.g. "Salary" income, "Food" expense)
2. Watch the summary cards update
3. Delete one and watch it recalculate
4. Open `expenses.db` with a SQLite viewer (like DB Browser for SQLite) to see your data directly

## Next steps (Phase 2+)

- Add filtering by month/category
- Add monthly bar chart + category pie chart (Chart.js or Recharts)
- Add user accounts (JWT auth) so data isn't shared globally
- Smart categorization: send the `description` field to an AI API and auto-suggest a category
