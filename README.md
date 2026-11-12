# StockSense — AI-Powered Inventory Management & Demand Forecasting Platform

**StockSense** is an enterprise-grade inventory intelligence and replenishment system built with React, Vite, Node.js, PostgreSQL 17, and a Python FastAPI AI microservice.

It turns historical sales trajectories into intelligent, proactive inventory decisions through dynamic safety stock calculations, automated reorder points (ROP), Economic Order Quantity (EOQ), dead-stock detection, and purchase order workflow automation.

---

## 1. System Architecture & Port Allocation

```
┌─────────────────────────────────┐
│     React 18 + Vite Frontend    │ (Port 3000 — Emerald Minimal Design System)
└────────────────┬────────────────┘
                 │ HTTP / REST / Bearer JWT
                 ▼
┌─────────────────────────────────┐
│    Node.js / Express Backend    │ (Port 5000 — Business Logic, Auth, RBAC, Ledger)
└───────┬─────────────────▲───────┘
        │                 │ HTTP Internal Proxy Call
        │                 ▼
        │        ┌───────────────────────────────┐
        │        │   Python FastAPI AI Service   │ (Port 8000 — Time-Series Models,
        │        └───────────────────────────────┘   Forecasting, Dead Stock, NumPy)
        ▼
┌─────────────────────────────────┐
│     PostgreSQL 17 Database      │ (Port 5432 — 12 Relational Tables, 17 Indexes)
└─────────────────────────────────┘
```

### Verified Port Configuration:
- **React Frontend:** `http://localhost:3000` (proxies `/api` to backend `http://127.0.0.1:5000`)
- **Express Backend:** `http://127.0.0.1:5000` (calls AI microservice at `http://127.0.0.1:8000`)
- **FastAPI AI Service:** `http://127.0.0.1:8000` (Interactive API docs at `http://127.0.0.1:8000/docs`)
- **PostgreSQL Database:** `127.0.0.1:5432` (`stocksense` database)

### Architectural Guarantees:
1. **Frontend-to-Backend Security:** The frontend **never** calls the Python AI service directly. All intelligence requests are mediated by the Express backend.
2. **Resilient High Availability:** If the Python AI service is ever stopped or unreachable, the Node.js backend automatically falls back to deterministic internal JavaScript calculations (`source: "JS_FALLBACK"`), ensuring zero user downtime.
3. **Atomic Inventory Receiving:** Receiving purchase orders triggers an atomic database transaction that updates stock levels and writes immutable audit entries to `stock_movements` exactly once, guarded by idempotency checks.

---

## 2. Project Directory Structure

```
StockSense_Complete_Project/
├── backend/                      # Node.js Express REST Backend
│   ├── .env.example              # Safe environment variable configuration template
│   ├── package.json              # Backend dependencies
│   ├── scripts/
│   │   ├── import-dataset.js     # Olist ETL batch importer & seeder
│   │   ├── test-api.js           # 14-point API validation test
│   │   └── test-integration.js   # 17-point non-destructive E2E audit
│   └── src/
│       ├── config/db.js          # PostgreSQL connection pool (IPv4 trust)
│       ├── middleware/auth.js    # JWT verification & RBAC guard
│       ├── routes/               # Modular Express API routers
│       ├── services/
│       │   ├── aiService.js      # FastAPI client with auto JS fallback (Port 8000)
│       │   └── businessLogic.js  # Section 8 inventory mathematical formulas
│       └── server.js             # Express app entrypoint & health probe (Port 5000)
│
├── frontend/                     # React 18 + Vite + Tailwind CSS + Chart.js
│   ├── index.html                # Entry HTML
│   ├── package.json              # Frontend dependencies
│   ├── tailwind.config.js        # Emerald Minimal design tokens
│   ├── vite.config.js            # Vite configuration with port 3000 & API proxy
│   └── src/
│       ├── api/client.js         # Axios client with JWT interceptors
│       ├── components/           # Sidebar, Navbar, StatCard, StockBadge
│       ├── context/AuthContext   # Auth provider & demo role switcher
│       └── pages/                # 8 Complete Functional Screens
│           ├── Dashboard.jsx     # Executive KPIs & revenue charts
│           ├── Inventory.jsx     # Stock catalog & manual audit adjust modal
│           ├── ProductDetails.jsx# SKU drill-down, 52-wk sales & ledger
│           ├── Forecasting.jsx   # 4-week AI projection & confidence bands
│           ├── Reordering.jsx    # ROP queue & atomic PO receiving workflow
│           ├── DeadStock.jsx     # Liquidation & markdown diagnostics
│           ├── Suppliers.jsx     # Certified replenishment vendors
│           ├── AiAssistant.jsx   # Conversational intelligence console
│           └── Login.jsx         # Sign-in & one-click evaluator picker
│
├── ai-service/                   # Python 3.12+ FastAPI Microservice
│   ├── requirements.txt          # Python dependencies (pure-NumPy, FastAPI, Uvicorn)
│   ├── run.py                    # Direct startup helper (Port 8000)
│   ├── app/
│   │   ├── __init__.py           # Package indicator
│   │   ├── assistant_engine.py   # Natural language context processor
│   │   ├── dead_stock_analyzer.py# Stagnation & liquidation rules
│   │   ├── forecaster.py         # Pure-NumPy linear regression & confidence bands
│   │   ├── inventory_math.py     # ADD, Safety Stock, ROP, EOQ
│   │   ├── main.py               # FastAPI application entrypoint (Port 8000)
│   │   └── models.py             # Pydantic validation schemas
│   └── tests/
│       ├── test_ai_service.py    # 10 mathematical formula & engine tests
│       └── test_api_endpoints.py # 3 FastAPI endpoint integration tests
│
├── dataset/                      # Olist E-Commerce Relational Tables
│   ├── olist_customers_dataset.csv
│   ├── olist_geolocation_dataset.csv
│   ├── olist_orders_dataset.csv  # 96,478 delivered orders
│   ├── olist_order_items_dataset.csv # 112,650 order items
│   ├── olist_order_payments_dataset.csv
│   ├── olist_order_reviews_dataset.csv
│   ├── olist_products_dataset.csv# Catalog items
│   ├── olist_sellers_dataset.csv
│   ├── product_category_name_translation.csv
│   ├── DATA_DICTIONARY.txt
│   └── QUALITY_REPORT.txt
│
├── docs/
│   ├── DATABASE_SCHEMA.sql       # PostgreSQL 17 relational definitions (12 tables)
│   └── AUDIT_REPORT.md           # Full technical debugging and test report
│
├── API_CONTRACT.md               # Complete REST API specification
└── README.md                     # Complete project documentation & setup guide
```

---

## 3. Demo Credentials (Role-Based Access)

Use these accounts to test all authorization roles:

| Role | Email Address | Password | Permissions |
|---|---|---|---|
| **Admin** | `admin@stocksense.io` | `Password123!` | Full system control, PO approval, stock adjustments |
| **Manager** | `manager@stocksense.io` | `Password123!` | PO approvals, price markdowns, inventory adjustments |
| **Staff** | `staff@stocksense.io` | `Password123!` | Stock counts, stock adjustments, create draft POs |
| **Supplier** | `supplier@stocksense.io` | `Password123!` | Supplier portal view, lead-time inspections |

*Tip: You can also use the one-click evaluator buttons on the login screen or in the top navigation bar to switch roles instantly without typing passwords.*

---

## 4. Mathematical Inventory Formulations (Section 8)

- **Average Daily Demand ($D_{avg}$):**
  $$D_{avg} = \frac{\text{Mean Weekly Sales}}{7}$$
- **Safety Stock ($SS$):**
  $$SS = Z \times \sigma_{daily} \times \sqrt{L} \quad (Z = 1.65 \text{ for 95\% service level})$$
- **Reorder Point ($ROP$):**
  $$ROP = (D_{avg} \times L) + SS$$
- **Economic Order Quantity ($EOQ$):**
  $$EOQ = \sqrt{\frac{2 \times D_{annual} \times S}{H}} \quad (S = \$50.00, H = 20\% \times \text{Unit Cost})$$
- **Trend Factor:**
  $$\text{Trend Factor} = \text{clamp}\left(\frac{\sum_{w=1}^4 \text{Sales}_w}{\sum_{w=5}^8 \text{Sales}_w}, 0.5, 1.6\right)$$
- **Dead Stock Classification:**
  - **Liquidate:** $\ge 5$ consecutive trailing zero-sale weeks ($\ge 35$ days without sales).
  - **Discount:** $\ge 2$ trailing zero-sale weeks OR sales drop $> 55\%$.
  - **Healthy:** Consistent sales velocity.

---

## 5. Complete Windows PowerShell Startup Instructions (From Fresh ZIP)

Follow these step-by-step instructions to run StockSense from a fresh extraction.

### Step 0: Extract the Archive
```powershell
# Open Windows PowerShell and navigate to your desired directory
cd "C:\Your\Target\Folder"
Expand-Archive -Path "StockSense_Complete_Project.zip" -DestinationPath "StockSense"
cd StockSense
```

---

### Terminal 1: PostgreSQL Database Verification
StockSense requires PostgreSQL 17 running on port 5432.
```powershell
# Check if PostgreSQL service is running
Get-Service postgresql*

# If not running, start it
Start-Service postgresql-x64-17

# Verify the stocksense database exists and is populated
# (If setting up on a brand new machine, execute docs/DATABASE_SCHEMA.sql with psql)
# psql -U postgres -h 127.0.0.1 -d postgres -c "CREATE DATABASE stocksense;"
# psql -U postgres -h 127.0.0.1 -d stocksense -f docs/DATABASE_SCHEMA.sql
```

---

### Terminal 2: Python FastAPI AI Microservice Setup & Startup
The AI service uses pure-NumPy regression and FastAPI (zero C-extension conflicts).
```powershell
cd StockSense\ai-service

# 1. Create a Python virtual environment
python -m venv venv

# 2. Activate the virtual environment
.\venv\Scripts\Activate.ps1
# If PowerShell script execution is restricted on your machine, run:
# Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process

# 3. Install required dependencies
pip install -r requirements.txt

# 4. Verify imports and algorithm tests (13/13 passing)
python -m unittest discover tests

# 5. Start the FastAPI microservice on Port 8000
python run.py
# Or: python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Verified endpoints:
# Health probe: http://127.0.0.1:8000/health
# Swagger Docs: http://127.0.0.1:8000/docs
```

---

### Terminal 3: Node.js Express Backend Setup & Startup
The backend provides REST APIs, JWT authentication, and Section 8 business logic.
```powershell
cd StockSense\backend

# 1. Create .env from the safe template
Copy-Item .env.example .env

# 2. (Optional) Adjust DB credentials in .env if your postgres password is set
# notepad .env

# 3. Install Node.js dependencies
npm install

# 4. (Optional) Run the automated API test suite (14/14 passing)
node scripts/test-api.js

# 5. Start the backend server on Port 5000
npm start

# Verified endpoints:
# Health probe: http://127.0.0.1:5000/health
# API Root:     http://127.0.0.1:5000/api
```

---

### Terminal 4: React Vite Frontend Setup & Startup
The frontend provides the complete Emerald Minimal dashboard and 8 functional screens.
```powershell
cd StockSense\frontend

# 1. Install frontend dependencies
npm install

# 2. Start the Vite development server on Port 3000
npm run dev

# 3. Open StockSense in your browser
# URL: http://localhost:3000
```

---

## 6. Verification and Health Check Endpoints

| Service | Port | Local URL | Health Probe | Purpose |
|---|---|---|---|---|
| **Frontend** | 3000 | `http://localhost:3000` | N/A | React 18 Single Page App |
| **Backend API** | 5000 | `http://127.0.0.1:5000` | `http://127.0.0.1:5000/health` | Express REST, Auth, Business Logic |
| **AI Service** | 8000 | `http://127.0.0.1:8000` | `http://127.0.0.1:8000/health` | FastAPI Forecasting & NLP Assistant |
| **Swagger UI** | 8000 | `http://127.0.0.1:8000/docs` | Interactive OpenAPI Docs | Live Microservice Testing |
| **Database** | 5432 | `127.0.0.1:5432` | `pg_isready -h 127.0.0.1 -p 5432` | PostgreSQL 17 Relational Storage |
