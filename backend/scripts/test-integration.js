/**
 * StockSense Non-Destructive Isolated Integration Test Suite
 * 
 * Strict Isolation Guarantees:
 * 1. Operates EXCLUSIVELY on ephemeral, isolated test entities (TEST-ISOLATED-*)
 * 2. Does NOT modify, update, or delete ANY existing Olist dataset records or StockSense catalog rows.
 * 3. Enforces automated teardown in finally block to ensure zero persistent test artifacts.
 * 4. Verifies live Node.js Backend <-> Python FastAPI AI Service communication and graceful fallback.
 */

const { spawn } = require('child_process');
const path = require('path');
const axios = require('axios');
const app = require('../src/server');
const db = require('../src/config/db');

const AI_DIR = path.resolve(__dirname, '../../ai-service');
const PYTHON_EXEC = path.join(AI_DIR, 'venv/Scripts/python.exe');

let aiProcess = null;
let backendServer = null;

// Unique test execution token to prevent any namespace collision
const TEST_TOKEN = `TEST_${Date.now()}`;
const TEST_PROD_ID = `prod_test_isolated_${Date.now()}`;
const TEST_SKU = `SKU-TEST-ISOLATED-${Date.now().toString().slice(-6)}`;
let testSupplierId = null;
let testPoId = null;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runNonDestructiveIntegrationTest() {
  console.log('================================================================');
  console.log('  StockSense Non-Destructive Isolated Integration Audit        ');
  console.log(`  Session Token: ${TEST_TOKEN}`);
  console.log('================================================================');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const testResults = [];

  function recordResult(name, condition, details = '') {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  [PASS] Test ${totalTests}: ${name} ${details ? `(${details})` : ''}`);
      testResults.push({ id: totalTests, name, status: 'PASSED', details });
    } else {
      failedTests++;
      console.error(`  [FAIL] Test ${totalTests}: ${name} ${details ? `(${details})` : ''}`);
      testResults.push({ id: totalTests, name, status: 'FAILED', details });
    }
  }

  const client = await db.getClient();

  try {
    // PHASE A: Setup Isolated Ephemeral Test Fixture
    console.log('-> Creating isolated ephemeral test fixture in database...');
    
    // 1. Create Isolated Test Supplier
    const supRes = await client.query(`
      INSERT INTO suppliers (name, contact_name, email, lead_time_days, rating)
      VALUES ($1, 'Isolated Fixture Rep', 'test-fixture@stocksense.internal', 7, 5.0)
      RETURNING id
    `, [`SUPPLIER_ISOLATED_${TEST_TOKEN}`]);
    testSupplierId = supRes.rows[0].id;

    // 2. Create Isolated Test Product
    await client.query(`
      INSERT INTO products (id, sku, name, primary_supplier_id, price, cost_price, is_active)
      VALUES ($1, $2, $3, $4, 99.00, 45.00, TRUE)
    `, [TEST_PROD_ID, TEST_SKU, `Isolated Integration Fixture Product (${TEST_TOKEN})`, testSupplierId]);

    // 3. Create Isolated Test Inventory Row
    await client.query(`
      INSERT INTO inventory (product_id, current_stock, reserved_stock, safety_stock, reorder_point, eoq)
      VALUES ($1, 10, 0, 5, 20, 50)
    `, [TEST_PROD_ID]);

    console.log(`   [OK] Test fixture established: Supplier ID=${testSupplierId}, Product ID=${TEST_PROD_ID}`);

    // PHASE B: Start Python FastAPI AI Service Subprocess
    console.log('-> Launching Python FastAPI AI Service on port 8000...');
    aiProcess = spawn(PYTHON_EXEC, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], {
      cwd: AI_DIR,
      stdio: 'pipe'
    });

    // Wait for AI service health
    let aiOnline = false;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const h = await axios.get('http://127.0.0.1:8000/health', { timeout: 1000 });
        if (h.data.status === 'ONLINE') {
          aiOnline = true;
          break;
        }
      } catch (e) {
        // wait
      }
    }
    recordResult('Python FastAPI AI Service Health Endpoint', aiOnline, 'http://127.0.0.1:8000/health');

    // PHASE C: Direct AI Microservice Tests
    console.log('-> Testing Python AI Service microservice algorithms...');
    const directForecast = await axios.post('http://127.0.0.1:8000/ai/forecast/product', {
      product_id: TEST_PROD_ID,
      weekly_sales: [10, 12, 14, 16, 18, 20, 22, 24],
      lead_time_days: 7,
      unit_cost: 45.0
    });
    recordResult('AI Service Demand Forecast Generation',
      directForecast.status === 200 && directForecast.data.forecast.length === 4,
      `Model: ${directForecast.data.model_used}, Forecast Weeks: ${directForecast.data.forecast.length}`
    );

    const directDeadStock = await axios.post('http://127.0.0.1:8000/ai/dead-stock/analyze', {
      product_id: TEST_PROD_ID,
      weekly_sales: [25, 20, 0, 0, 0, 0, 0]
    });
    recordResult('AI Service Dead Stock Analysis',
      directDeadStock.status === 200 && directDeadStock.data.status === 'LIQUIDATE',
      `Status: ${directDeadStock.data.status}, Trailing Zero Weeks: ${directDeadStock.data.trailing_zero_weeks}`
    );

    const directAssistant = await axios.post('http://127.0.0.1:8000/ai/intelligence/assistant', {
      query: 'Show me inventory valuation and reorder items',
      context: { totalProducts: 300, lowStockCount: 64, valuation: 336025.57 }
    });
    recordResult('AI Service Natural Language Query Processing',
      directAssistant.status === 200 && directAssistant.data.reply.length > 20,
      `Actions Returned: ${directAssistant.data.suggested_actions.length}`
    );

    // PHASE D: Launch Express Backend Server on test port 5003
    console.log('-> Launching Node.js Express Backend on port 5003...');
    await new Promise(resolve => {
      backendServer = app.listen(5003, resolve);
    });

    const api = axios.create({
      baseURL: 'http://127.0.0.1:5003',
      validateStatus: () => true
    });

    const backendHealth = await api.get('/health');
    recordResult('Node.js Backend Health Endpoint', backendHealth.status === 200, backendHealth.data.service);

    // PHASE E: Test Authentication & RBAC
    console.log('-> Verifying Authentication & Role Permissions...');
    const adminAuth = await api.post('/api/auth/login', {
      email: 'admin@stocksense.io',
      password: 'Password123!'
    });
    recordResult('Admin JWT Authentication', adminAuth.status === 200 && adminAuth.data.success, `User: ${adminAuth.data.user.email}`);
    const adminToken = adminAuth.data.token;
    api.defaults.headers.common['Authorization'] = `Bearer ${adminToken}`;

    const meCheck = await api.get('/api/auth/me');
    recordResult('Token Verification (/api/auth/me)', meCheck.status === 200 && meCheck.data.user.role === 'Admin');

    // PHASE F: Live Node.js Backend <-> Python AI Service Inter-Service Communication
    console.log('-> Testing Live Inter-Service Communication (Backend -> AI Service)...');
    
    // Express backend calls FastAPI microservice over HTTP (port 5003 -> port 8000)
    const backendForecastRes = await api.get(`/api/forecasts/product/${TEST_PROD_ID}`);
    recordResult('Backend-to-AI Forecast Dispatch',
      backendForecastRes.status === 200 && backendForecastRes.data.data.source === 'AI_SERVICE',
      `Source: ${backendForecastRes.data.data?.source}, Model: ${backendForecastRes.data.data?.model_used}`
    );

    const backendChatRes = await api.post('/api/ai/chat', {
      message: 'Provide summary of low stock items and valuation'
    });
    recordResult('Backend-to-AI Assistant Dispatch',
      backendChatRes.status === 200 && backendChatRes.data.data.source === 'AI_SERVICE',
      `Source: ${backendChatRes.data.data?.source}`
    );

    // PHASE G: Core Workflow & Receiving (Isolated Test Product ONLY)
    console.log('-> Testing Purchase Order Creation & Atomic Receiving on Isolated Fixture...');
    
    // 1. Create Draft Purchase Order using isolated test fixture
    const poCreate = await api.post('/api/purchase-orders', {
      supplier_id: testSupplierId,
      expected_delivery_date: '2026-12-01',
      notes: `Isolated Test Purchase Order (${TEST_TOKEN})`,
      items: [
        { product_id: TEST_PROD_ID, quantity: 30, unit_cost: 45.00 }
      ]
    });
    testPoId = poCreate.data.data.id;
    recordResult('Create Isolated Purchase Order', poCreate.status === 201, `PO ID: ${testPoId}, Status: PENDING_APPROVAL`);

    // 2. Approve Purchase Order
    const poApprove = await api.put(`/api/purchase-orders/${testPoId}/status`, { status: 'APPROVED' });
    recordResult('Approve Purchase Order', poApprove.status === 200 && poApprove.data.data.status === 'APPROVED');

    // 3. Atomically Receive Purchase Order
    const poReceive = await api.post(`/api/purchase-orders/${testPoId}/receive`);
    recordResult('Atomic PO Receiving Transaction', poReceive.status === 200 && poReceive.data.success);

    // 4. Verify Inventory was updated (+30 units on isolated test product)
    const invCheck = await client.query('SELECT current_stock FROM inventory WHERE product_id = $1', [TEST_PROD_ID]);
    const finalStock = invCheck.rows[0]?.current_stock;
    recordResult('Verify Inventory Increment (+30 units)', finalStock === 40, `Initial: 10, Expected: 40, Actual: ${finalStock}`);

    // 5. Verify Stock Movement Ledger Record
    const movCheck = await client.query(`
      SELECT * FROM stock_movements 
      WHERE product_id = $1 AND movement_type = 'PO_RECEIPT'
    `, [TEST_PROD_ID]);
    recordResult('Stock Movement Ledger Audit Entry', movCheck.rows.length === 1 && movCheck.rows[0].quantity_change === 30);

    // 6. Verify Idempotency Protection
    const duplicateReceive = await api.post(`/api/purchase-orders/${testPoId}/receive`);
    recordResult('Idempotency Guard (Reject Double Receiving)', 
      duplicateReceive.status === 400 && duplicateReceive.data.error.code === 'ALREADY_RECEIVED',
      `Error Code: ${duplicateReceive.data.error?.code}`
    );

    // PHASE H: Graceful Fallback When AI Service Is Offline
    console.log('-> Testing Graceful JS Fallback (Simulating AI Service Outage)...');
    aiProcess.kill();
    await sleep(500);

    const fallbackForecast = await api.get(`/api/forecasts/product/${TEST_PROD_ID}`);
    recordResult('Graceful Fallback on Demand Forecast',
      fallbackForecast.status === 200 && fallbackForecast.data.data.source === 'JS_FALLBACK',
      `Source: ${fallbackForecast.data.data?.source}`
    );

    const fallbackChat = await api.post('/api/ai/chat', { message: 'What is our status?' });
    recordResult('Graceful Fallback on AI Assistant Chat',
      fallbackChat.status === 200 && fallbackChat.data.data.source === 'JS_FALLBACK',
      `Source: ${fallbackChat.data.data?.source}`
    );

  } catch (error) {
    console.error('Critical test exception:', error);
    recordResult('Execution without unhandled exception', false, error.message);
  } finally {
    // PHASE I: Guaranteed Non-Destructive Teardown of Test Fixtures ONLY
    console.log('-> Executing non-destructive teardown of isolated test fixtures...');
    try {
      if (testPoId) {
        await client.query('DELETE FROM stock_movements WHERE product_id = $1', [TEST_PROD_ID]);
        await client.query('DELETE FROM purchase_orders WHERE id = $1', [testPoId]);
      }
      await client.query('DELETE FROM inventory WHERE product_id = $1', [TEST_PROD_ID]);
      await client.query('DELETE FROM products WHERE id = $1', [TEST_PROD_ID]);
      if (testSupplierId) {
        await client.query('DELETE FROM suppliers WHERE id = $1', [testSupplierId]);
      }
      console.log('   [CLEANUP COMPLETE] All isolated test entities safely removed.');
    } catch (cleanupErr) {
      console.error('Teardown error:', cleanupErr);
    } finally {
      client.release();
    }

    if (aiProcess && !aiProcess.killed) aiProcess.kill();
    if (backendServer) backendServer.close();

    console.log('================================================================');
    console.log(`  AUDIT RESULTS: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} FAILED)`);
    console.log('================================================================');
    process.exit(failedTests > 0 ? 1 : 0);
  }
}

runNonDestructiveIntegrationTest();
