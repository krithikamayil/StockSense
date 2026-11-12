const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/notifications
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM notifications 
      WHERE user_id = $1 OR user_id IS NULL
      ORDER BY created_at DESC 
      LIMIT 20
    `, [req.user.id]);

    const unreadCountRes = await db.query(`
      SELECT COUNT(*) as unread
      FROM notifications
      WHERE (user_id = $1 OR user_id IS NULL) AND is_read = FALSE
    `, [req.user.id]);

    res.json({
      success: true,
      unread_count: parseInt(unreadCountRes.rows[0].unread, 10),
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to retrieve notifications.' } });
  }
});

/**
 * PUT /api/notifications/mark-all-read
 */
router.put('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    await db.query(`
      UPDATE notifications 
      SET is_read = TRUE 
      WHERE user_id = $1 OR user_id IS NULL
    `, [req.user.id]);

    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

module.exports = router;
