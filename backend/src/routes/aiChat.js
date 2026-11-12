const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const aiService = require('../services/aiService');

/**
 * POST /api/ai/chat
 */
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message, conversation_id = 'default_session' } = req.body;
    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, error: { code: 'EMPTY_MESSAGE', message: 'Message cannot be empty.' } });
    }

    // Record user message
    await db.query(`
      INSERT INTO chat_history (conversation_id, user_id, role, content)
      VALUES ($1, $2, 'user', $3)
    `, [conversation_id, req.user.id, message.trim()]);

    // Fetch live inventory context for contextual intelligence
    const contextRes = await db.query(`
      SELECT 
        COUNT(p.id) as total_products,
        COUNT(CASE WHEN i.current_stock <= i.reorder_point THEN 1 END) as low_stock_count,
        COUNT(CASE WHEN i.current_stock = 0 THEN 1 END) as out_of_stock_count,
        COALESCE(SUM(i.current_stock * p.cost_price), 0) as total_inventory_valuation
      FROM products p
      JOIN inventory i ON p.id = i.product_id
      WHERE p.is_active = TRUE
    `);

    const poRes = await db.query(`
      SELECT COUNT(id) as pending_pos FROM purchase_orders WHERE status IN ('PENDING_APPROVAL', 'APPROVED')
    `);

    // Top 3 urgent low stock items
    const lowStockItems = await db.query(`
      SELECT p.name, p.sku, i.current_stock, i.reorder_point, s.lead_time_days
      FROM products p
      JOIN inventory i ON p.id = i.product_id
      LEFT JOIN suppliers s ON p.primary_supplier_id = s.id
      WHERE p.is_active = TRUE AND i.current_stock <= i.reorder_point
      LIMIT 3
    `);

    const contextData = {
      totalProducts: parseInt(contextRes.rows[0].total_products, 10),
      lowStockCount: parseInt(contextRes.rows[0].low_stock_count, 10),
      outOfStockCount: parseInt(contextRes.rows[0].out_of_stock_count, 10),
      valuation: parseFloat(contextRes.rows[0].total_inventory_valuation),
      pendingPOs: parseInt(poRes.rows[0].pending_pos, 10),
      sampleLowStock: lowStockItems.rows
    };

    // Ask AI Service (or fallback)
    const aiResponse = await aiService.askAiAssistant(message, contextData);

    // Save assistant reply to chat_history
    await db.query(`
      INSERT INTO chat_history (conversation_id, user_id, role, content, metadata)
      VALUES ($1, $2, 'assistant', $3, $4)
    `, [conversation_id, req.user.id, aiResponse.reply, JSON.stringify({ suggested_actions: aiResponse.suggested_actions, source: aiResponse.source })]);

    res.json({
      success: true,
      data: {
        conversation_id,
        reply: aiResponse.reply,
        suggested_actions: aiResponse.suggested_actions,
        source: aiResponse.source,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error handling AI chat:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to process AI chat query.' } });
  }
});

/**
 * GET /api/ai/history
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { conversation_id = 'default_session' } = req.query;
    const result = await db.query(`
      SELECT id, role, content, metadata, created_at
      FROM chat_history
      WHERE conversation_id = $1
      ORDER BY created_at ASC
      LIMIT 50
    `, [conversation_id]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to retrieve chat history.' } });
  }
});

module.exports = router;
