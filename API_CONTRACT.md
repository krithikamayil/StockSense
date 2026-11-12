# StockSense API & System Contract

**Version:** 1.0.0  
**Design Architecture:**  
React Frontend (Vite) ↔ Node.js Express Backend (Port 5000) ↔ PostgreSQL Database (Port 5432)  
Node.js Express Backend ↔ Python FastAPI AI Service (Port 8000)

> **Important Architecture Constraint:** The Frontend NEVER communicates directly with the Python AI Service. All AI requests are mediated by the Express Backend. If the AI Service is temporarily offline or unreachable, the Express Backend transparently falls back to internal deterministic JavaScript calculations without failing the client request.

---

## 1. Authentication & Role-Based Access Control (RBAC)

### Roles
- `Admin`: Full system control, user management, configuration, database imports.
- `Manager`: Product CRUD, PO approval, inventory adjustments, forecast generation.
- `Staff`: View inventory, record manual stock counts, create draft POs.
- `Supplier`: Portal access to view assigned POs and update delivery status.

### Headers
All authenticated endpoints require:
```http
Authorization: Bearer <JWT_TOKEN>
```

### Endpoints
#### `POST /api/auth/login`
- **Request:**
  ```json
  {
    "email": "admin@stocksense.io",
    "password": "Password123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOi...",
    "user": {
      "id": "usr_01",
      "name": "System Administrator",
      "email": "admin@stocksense.io",
      "role": "Admin"
    }
  }
  ```

#### `GET /api/auth/me`
- **Response (200 OK):** User profile corresponding to JWT token.

---

## 2. Inventory & Products

#### `GET /api/products`
- **Query Params:** `page`, `limit`, `search`, `category_id`, `stock_status` (`ALL`, `LOW_STOCK`, `OUT_OF_STOCK`, `HEALTHY`)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "prod_101",
        "sku": "SKU-BEAUTY-001",
        "name": "perfumery_luxury_eau_de_parfum",
        "category": "beleza_saude",
        "price": 129.90,
        "cost_price": 64.95,
        "current_stock": 24,
        "reserved_stock": 2,
        "available_stock": 22,
        "safety_stock": 18,
        "reorder_point": 35,
        "eoq": 85,
        "stock_status": "LOW_STOCK",
        "primary_supplier": {
          "id": "sup_01",
          "name": "Apex Supply Logistics",
          "lead_time_days": 10
        }
      }
    ],
    "pagination": { "total": 120, "page": 1, "limit": 20, "pages": 6 }
  }
  ```

#### `GET /api/products/:id`
- Returns detailed SKU data, 52-week historical sales aggregations, current stock breakdown, active POs, supplier info, and latest demand forecast.

#### `POST /api/products` & `PUT /api/products/:id`
- Create / update product definitions, unit costs, pricing, and supplier link.

#### `POST /api/inventory/adjust`
- **Request:**
  ```json
  {
    "product_id": "prod_101",
    "quantity_change": -5,
    "reason": "Damaged in transit inspection",
    "movement_type": "DAMAGE"
  }
  ```
- **Response (200 OK):** Updates `inventory` row and writes immutable ledger entry to `stock_movements`.

---

## 3. Demand Forecasting & Business Logic

### Mathematical Formulations
- **Average Daily Demand ($D_{avg}$):**
  $$D_{avg} = \frac{\text{Mean Weekly Sales}}{7}$$
- **Safety Stock ($SS$):**
  $$SS = Z \times \sigma_{daily} \times \sqrt{L}$$
  *Where $Z = 1.65$ (95% service level), $\sigma_{daily}$ is daily demand standard deviation, and $L$ is supplier lead time in days.*
- **Reorder Point ($ROP$):**
  $$ROP = (D_{avg} \times L) + SS$$
- **Economic Order Quantity ($EOQ$):**
  $$EOQ = \sqrt{\frac{2 \times D_{annual} \times S}{H}}$$
  *Where $D_{annual} = D_{avg} \times 365$, $S = \text{Order Cost}$ (default \$50.00), $H = \text{Annual Holding Cost}$ (default 20% of unit cost).*
- **Demand Forecast ($F_t$):**
  $$F_t = \text{SMA}_{4} \times \text{Trend Factor}$$
  $$\text{Trend Factor} = \text{clamp}\left(\frac{\sum_{w=1}^4 \text{Sales}_w}{\sum_{w=5}^8 \text{Sales}_w}, 0.5, 1.6\right)$$

#### `GET /api/forecasts/product/:id`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "product_id": "prod_101",
    "as_of_date": "2018-09-03",
    "metrics": {
      "avg_daily_demand": 3.42,
      "daily_std_dev": 1.15,
      "lead_time_days": 10,
      "safety_stock": 6,
      "reorder_point": 40,
      "eoq": 85,
      "trend_factor": 1.12
    },
    "history": [
      { "week_start": "2018-08-06", "units_sold": 22 },
      { "week_start": "2018-08-13", "units_sold": 26 },
      { "week_start": "2018-08-20", "units_sold": 24 },
      { "week_start": "2018-08-27", "units_sold": 28 }
    ],
    "forecast": [
      { "week_start": "2018-09-03", "predicted_units": 28, "lower_bound": 23, "upper_bound": 33 },
      { "week_start": "2018-09-10", "predicted_units": 29, "lower_bound": 24, "upper_bound": 34 },
      { "week_start": "2018-09-17", "predicted_units": 30, "lower_bound": 24, "upper_bound": 36 },
      { "week_start": "2018-09-24", "predicted_units": 30, "lower_bound": 25, "upper_bound": 36 }
    ],
    "source": "AI_SERVICE" // or "JS_FALLBACK"
  }
  ```

---

## 4. Reordering & Purchase Orders

#### `GET /api/reorder/recommendations`
- Returns all items where `current_stock + incoming_po_stock <= reorder_point`.
- Recommends quantity: $\max(EOQ, ROP - \text{current\_stock})$.

#### `POST /api/purchase-orders`
- Creates draft purchase order with item rows.

#### `POST /api/purchase-orders/:id/receive`
- **Lifecycle:** `DRAFT` → `APPROVED` → `ORDERED` → `RECEIVED`.
- **Atomic Execution:**
  1. Validates status is `ORDERED` or `APPROVED`.
  2. Updates `inventory.quantity = inventory.quantity + item.received_quantity`.
  3. Records entries into `stock_movements` with `movement_type = 'PO_RECEIPT'`.
  4. Sets `purchase_orders.status = 'RECEIVED'` and `received_at = NOW()`.
  5. Guaranteed idempotent: cannot be received multiple times.

---

## 5. Dead Stock Detection

### Rules
- **Liquidate:** 5 or more trailing zero-sale weeks ($\ge 35$ days without sales).
- **Discount:** 2 or more trailing zero-sale weeks OR sales drop $> 55\%$ compared to preceding 4-week window.
- **Healthy:** Consistent sales velocity.

#### `GET /api/dead-stock`
- Returns dead-stock classification, dormant inventory value, capital tied up, and suggested discount/liquidation actions.

---

## 6. AI Assistant Endpoint

#### `POST /api/ai/chat`
- **Request:**
  ```json
  {
    "message": "Which products need immediate reordering this week?",
    "conversation_id": "conv_992"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "reply": "Based on current inventory levels and lead times, 3 products are below their reorder points: 1) Perfumery Luxury (Stock: 24, ROP: 40), 2) Watch Classic (Stock: 8, ROP: 25)...",
    "suggested_actions": [
      { "label": "Review Reorder Queue", "route": "/reorder" },
      { "label": "Generate Batch POs", "action": "CREATE_BATCH_PO" }
    ],
    "timestamp": "2026-11-12T13:00:00Z"
  }
  ```

---

## 7. Python FastAPI AI Service Interface (Internal Port 8000)

1. `POST /ai/forecast/product` — Computes ARIMA/Exponential Smoothing & Moving Average trend forecast.
2. `POST /ai/inventory/metrics` — Computes statistical safety stock, ROP, EOQ, daily std dev.
3. `POST /ai/dead-stock/analyze` — Evaluates trailing zero-demand windows and demand degradation.
4. `POST /ai/assistant/query` — Intelligent reasoning engine parsing query over structured inventory data.
5. `GET /health` — Health status ping.

---

## 8. Standard Error Format
All errors return consistent HTTP status codes with the payload:
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Cannot reduce stock below 0 units.",
    "details": null
  }
}
```
