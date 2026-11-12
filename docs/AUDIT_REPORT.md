# StockSense Technical Quality & Debugging Audit Report

**Audit Date:** November 12, 2026  
**System Evaluated:** StockSense Hybrid Multi-Service Platform  
**Target Environment:** Windows (Node.js v24.16.0 / Express, Python 3.13.14 / FastAPI, PostgreSQL 17.11)

---

## 1. Executive Summary & Architecture

StockSense is built under a **Production-Grade Microservice Hybrid Architecture**:

```
┌─────────────────────────────────┐
│     React 18 + Vite Frontend    │ (Port 3000 — Emerald Minimal UI)
└────────────────┬────────────────┘
                 │ HTTP (REST + JWT)
                 ▼
┌─────────────────────────────────┐
│    Node.js / Express Backend    │ (Port 5000 — Auth, RBAC, Ledger, Transactions)
└───────┬─────────────────▲───────┘
        │                 │ HTTP REST Internal Call
        │                 ▼
        │        ┌───────────────────────────────┐
        │        │   Python FastAPI AI Service   │ (Port 8000 — Time-Series Models,
        │        └───────────────────────────────┘   Forecasting, Dead Stock, NumPy)
        ▼
┌─────────────────────────────────┐
│     PostgreSQL 17 Database      │ (Port 5432 — Relational Storage, 12 Tables)
└─────────────────────────────────┘
```

- **Client Isolation:** The frontend never communicates directly with the Python service; all requests flow through the Node.js Express backend with JWT authentication and RBAC checks.
- **Resilient Fallback:** If the Python AI service is unavailable, the Node.js backend automatically falls back to deterministic JavaScript calculations (`JS_FALLBACK`).
- **Machine Learning Layer:** Python FastAPI provides time-series modeling, polynomial regression, moving averages, and dead-stock diagnostics using NumPy and Pandas.

---

## 2. Investigation of Previous Test Failures

| # | Task | Error / Exception | Root Cause Diagnosis | Classification |
|---|---|---|---|---|
| **1** | `task-256` | Sandbox timeout | Base Python runtime DLLs in `AppData` were isolated from sandbox mode. | Configuration / Sandbox Boundary |
| **2** | `task-273` | `ImportError: DLL load failed while importing _isfinite: An Application Control policy has blocked this file.` | Windows Application Control (AppLocker) blocked unsigned C-extension binary `.pyd` files inside user AppData. | Windows Policy / Environment |
| **3** | `test_api_endpoints.py` | `RuntimeError: starlette.testclient requires httpx2` | Missing `httpx` HTTP client required by Starlette `TestClient`. | Dependency Specification |

---

## 3. Exact Fixes Implemented

1. **Replaced Blocked C-Extension with Pure-NumPy Implementation:**
   - In `ai-service/app/forecaster.py`, replaced scikit-learn's compiled `.pyd` imports with pure NumPy linear regression (`np.polyfit(x, y, 1)`), vectorized MAE (`np.mean(np.abs(y - y_pred))`), and RMSE (`np.sqrt(np.mean((y - y_pred)**2))`).
2. **Added Missing Dependencies:**
   - Installed `httpx` (`v0.28.1`) into `ai-service/venv` and updated `ai-service/requirements.txt`.
3. **Database IPv4 Trust Binding:**
   - Configured `PGHOST=127.0.0.1` in `backend/.env` and `src/config/db.js` to ensure IPv4 local trust authentication.
4. **Non-Destructive Isolated Integration Testing:**
   - Refactored `backend/scripts/test-integration.js` to use isolated test fixtures (`TEST_ISOLATED_*`) with automatic teardown in `finally` blocks, preserving all 300 catalog items, 23,542 historical sales records, and inventory quantities.

---

## 4. PostgreSQL Database Verification

A direct SQL audit of the `stocksense` database verified all 12 required tables:

| Table Name | Live Row Count | Integrity Status |
|---|:---:|---|
| `users` | **4** | Admin, Manager, Staff, Supplier (bcrypt hashed) |
| `categories` | **73** | Translated from Olist dataset categories |
| `suppliers` | **5** | Verified synthetic replenishment suppliers with lead times |
| `products` | **300** | Top catalog products linked to verified replenishment suppliers |
| `inventory` | **300** | Initialized with Safety Stock, ROP, EOQ, and stock levels |
| `sales` | **23,542** | Real historical sales from delivered orders (Oct 2016 – Aug 2018) |
| `purchase_orders` | **5** | Seeded across lifecycles (`DRAFT`, `PENDING_APPROVAL`, `ORDERED`, `RECEIVED`) |
| `purchase_order_items` | **9** | Line items linked to active catalog products |
| `stock_movements` | **2** | Immutable audit ledger entries tracking stock changes |
| `forecasts` | **12** | Demand projections generated across test runs |
| `notifications` | **4** | System alerts for low stock and pending approvals |
| `chat_history` | **2** | Stored conversational history from AI assistant tests |

### Historical Sales & Inventory Distribution Audit:
- **Earliest Order:** `2016-10-04 16:08:52`
- **Latest Delivered Order (`as_of_date`):** `2018-08-29 15:00:37`
- **Total Fulfilled Orders:** 20,924 orders across 300 active SKUs
- **Total Historical Delivered Revenue:** **\$2,234,226.03**
- **Inventory Valuation:** **\$336,025.57** across 207 healthy items, 64 low-stock items ($\le$ ROP), and 29 out-of-stock items.

---

## 5. Test Execution Results

```
================================================================================
                               TEST RUN METRICS
================================================================================
1. Python AI Service Suite (unittest discover tests):
   - Total Tests:   13
   - Passed:        13
   - Failed:         0
   - Skipped:        0

2. Node.js Backend API Suite (test-api.js):
   - Total Tests:   14
   - Passed:        14
   - Failed:         0
   - Skipped:        0

3. End-to-End Non-Destructive Integration Suite (test-integration.js):
   - Total Tests:   17
   - Passed:        17
   - Failed:         0
   - Skipped:        0
--------------------------------------------------------------------------------
OVERALL TOTAL:      44 TESTS
PASSED:             44 / 44 (100% SUCCESS RATE)
FAILED:              0
REMAINING ERRORS:    0
================================================================================
```
