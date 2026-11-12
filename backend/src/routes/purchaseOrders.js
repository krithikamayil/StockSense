const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

/**
 * GET /api/purchase-orders
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let whereClause = '';

    if (status && status !== 'ALL') {
      params.push(status);
      whereClause = 'WHERE po.status = $1';
    }

    const query = `
      SELECT 
        po.*,
        s.name as supplier_name,
        s.email as supplier_email,
        s.lead_time_days,
        u_create.name as created_by_name,
        u_appr.name as approved_by_name,
        COUNT(poi.id) as item_count,
        COALESCE(SUM(poi.quantity), 0) as total_units
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN users u_create ON po.created_by = u_create.id
      LEFT JOIN users u_appr ON po.approved_by = u_appr.id
      LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
      ${whereClause}
      GROUP BY po.id, s.name, s.email, s.lead_time_days, u_create.name, u_appr.name
      ORDER BY 
        CASE 
          WHEN po.status = 'PENDING_APPROVAL' THEN 1
          WHEN po.status = 'APPROVED' THEN 2
          WHEN po.status = 'ORDERED' THEN 3
          WHEN po.status = 'DRAFT' THEN 4
          ELSE 5
        END,
        po.created_at DESC
    `;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to retrieve purchase orders.' } });
  }
});

/**
 * GET /api/purchase-orders/:id
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const poRes = await db.query(`
      SELECT 
        po.*,
        s.name as supplier_name,
        s.email as supplier_email,
        s.phone as supplier_phone,
        s.address as supplier_address,
        u_create.name as created_by_name,
        u_appr.name as approved_by_name
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN users u_create ON po.created_by = u_create.id
      LEFT JOIN users u_appr ON po.approved_by = u_appr.id
      WHERE po.id = $1
    `, [id]);

    if (poRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Purchase order not found.' } });
    }

    const itemsRes = await db.query(`
      SELECT 
        poi.*,
        p.sku,
        p.name as product_name,
        i.current_stock
      FROM purchase_order_items poi
      JOIN products p ON poi.product_id = p.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE poi.purchase_order_id = $1
      ORDER BY poi.id ASC
    `, [id]);

    res.json({
      success: true,
      data: {
        purchase_order: poRes.rows[0],
        items: itemsRes.rows
      }
    });
  } catch (error) {
    console.error('Error fetching purchase order details:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to retrieve PO details.' } });
  }
});

/**
 * POST /api/purchase-orders
 */
router.post('/', authenticateToken, requireRoles('Admin', 'Manager', 'Staff'), async (req, res) => {
  const client = await db.getClient();
  try {
    const { supplier_id, expected_delivery_date, notes, items } = req.body;

    if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Supplier and at least one item required.' }
      });
    }

    await client.query('BEGIN');

    const poNumber = `PO-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const totalAmount = items.reduce((acc, it) => acc + (Number(it.quantity) * Number(it.unit_cost)), 0);

    const poRes = await client.query(`
      INSERT INTO purchase_orders (po_number, supplier_id, status, total_amount, expected_delivery_date, created_by, notes)
      VALUES ($1, $2, 'PENDING_APPROVAL', $3, $4, $5, $6)
      RETURNING *
    `, [poNumber, supplier_id, totalAmount, expected_delivery_date || null, req.user.id, notes || null]);

    const po = poRes.rows[0];

    for (const item of items) {
      const lineTotal = Number(item.quantity) * Number(item.unit_cost);
      await client.query(`
        INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_cost, total_cost)
        VALUES ($1, $2, $3, $4, $5)
      `, [po.id, item.product_id, item.quantity, item.unit_cost, lineTotal]);
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: po });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating purchase order:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/purchase-orders/:id/status
 * Transitions status: DRAFT -> PENDING_APPROVAL -> APPROVED -> ORDERED -> CANCELLED
 */
router.put('/:id/status', authenticateToken, requireRoles('Admin', 'Manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ORDERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Status must be one of: ${validStatuses.join(', ')}` }
      });
    }

    const currentPo = await db.query('SELECT status FROM purchase_orders WHERE id = $1', [id]);
    if (currentPo.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'PO not found.' } });
    }

    if (currentPo.rows[0].status === 'RECEIVED') {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_RECEIVED', message: 'Cannot change status of an already received PO.' }
      });
    }

    let updateQuery = 'UPDATE purchase_orders SET status = $1, updated_at = CURRENT_TIMESTAMP';
    const params = [status];

    if (status === 'APPROVED') {
      updateQuery += `, approved_by = $${params.length + 1}`;
      params.push(req.user.id);
    } else if (status === 'ORDERED') {
      updateQuery += `, ordered_at = CURRENT_TIMESTAMP`;
    }

    updateQuery += ` WHERE id = $${params.length + 1} RETURNING *`;
    params.push(id);

    const result = await db.query(updateQuery, params);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating PO status:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

/**
 * POST /api/purchase-orders/:id/receive
 * ATOMIC RECEIVING WORKFLOW:
 * Updates inventory levels and records stock movements exactly once in an atomic transaction.
 */
router.post('/:id/receive', authenticateToken, requireRoles('Admin', 'Manager', 'Staff'), async (req, res) => {
  const client = await db.getClient();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Lock purchase order record FOR UPDATE
    const poRes = await client.query('SELECT * FROM purchase_orders WHERE id = $1 FOR UPDATE', [id]);
    if (poRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Purchase order not found.' } });
    }

    const po = poRes.rows[0];

    // Guarantee receiving happens exactly once
    if (po.status === 'RECEIVED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_RECEIVED', message: `PO ${po.po_number} was already received at ${po.received_at}.` }
      });
    }

    if (po.status === 'CANCELLED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: { code: 'PO_CANCELLED', message: 'Cannot receive a cancelled purchase order.' }
      });
    }

    // Fetch PO items
    const itemsRes = await client.query('SELECT * FROM purchase_order_items WHERE purchase_order_id = $1', [id]);
    const items = itemsRes.rows;

    if (items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: { code: 'NO_ITEMS', message: 'Purchase order has no items to receive.' }
      });
    }

    const receiptRecords = [];

    // Atomically update inventory and insert stock movements
    for (const item of items) {
      const receivedQty = item.quantity; // receive full PO quantity

      // Lock inventory row
      const invRes = await client.query('SELECT current_stock FROM inventory WHERE product_id = $1 FOR UPDATE', [item.product_id]);
      const prevStock = invRes.rows[0]?.current_stock || 0;
      const newStock = prevStock + receivedQty;

      // Update inventory stock
      await client.query(`
        UPDATE inventory 
        SET current_stock = $1, last_counted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE product_id = $2
      `, [newStock, item.product_id]);

      // Record immutable stock movement ledger entry
      const movRes = await client.query(`
        INSERT INTO stock_movements (product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, user_id)
        VALUES ($1, 'PO_RECEIPT', $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        item.product_id,
        receivedQty,
        prevStock,
        newStock,
        po.po_number,
        `Goods received from PO ${po.po_number}`,
        req.user.id
      ]);

      // Mark item row as received
      await client.query(`
        UPDATE purchase_order_items 
        SET received_quantity = $1 
        WHERE id = $2
      `, [receivedQty, item.id]);

      receiptRecords.push({
        product_id: item.product_id,
        quantity_received: receivedQty,
        previous_stock: prevStock,
        new_stock: newStock,
        movement_id: movRes.rows[0].id
      });
    }

    // Mark PO as RECEIVED with current timestamp
    const updatedPoRes = await client.query(`
      UPDATE purchase_orders 
      SET status = 'RECEIVED', received_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
      RETURNING *
    `, [id]);

    // Insert system notification
    await client.query(`
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES ($1, 'SYSTEM', 'Purchase Order Received', $2, $3)
    `, [req.user.id, `PO ${po.po_number} received. ${items.length} product inventories updated.`, `/inventory`]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Purchase order ${po.po_number} received successfully. Inventory updated and stock movements recorded.`,
      data: {
        purchase_order: updatedPoRes.rows[0],
        items_received: receiptRecords
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during PO receiving workflow:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  } finally {
    client.release();
  }
});

module.exports = router;
