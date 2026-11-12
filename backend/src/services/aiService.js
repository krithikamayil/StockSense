const axios = require('axios');
const businessLogic = require('./businessLogic');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_TIMEOUT_MS = 3000;

/**
 * Calls FastAPI AI Service for product forecast, falling back to JS logic if unreachable
 */
async function getProductForecast(productId, weeklySales, leadTimeDays = 7, unitCost = 50) {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/ai/forecast/product`,
      {
        product_id: productId,
        weekly_sales: weeklySales,
        lead_time_days: leadTimeDays,
        unit_cost: unitCost,
      },
      { timeout: AI_TIMEOUT_MS }
    );
    return {
      ...response.data,
      source: 'AI_SERVICE'
    };
  } catch (error) {
    // Graceful fallback to deterministic JS calculations
    const avgDaily = businessLogic.calculateAverageDailyDemand(weeklySales);
    const dailyStd = businessLogic.calculateDailyStdDev(weeklySales);
    const ss = businessLogic.calculateSafetyStock(dailyStd, leadTimeDays);
    const rop = businessLogic.calculateReorderPoint(avgDaily, leadTimeDays, ss);
    const eoq = businessLogic.calculateEOQ(avgDaily, unitCost);
    const trendRes = businessLogic.calculateForecastAndTrend(weeklySales);

    // Generate 4 weeks of forecast based on SMA & trend
    const forecastWeeks = [];
    for (let i = 1; i <= 4; i++) {
      const pred = Math.max(Math.round(trendRes.forecastWeekly * (1 + (i - 1) * 0.02)), 1);
      forecastWeeks.push({
        week_number: i,
        predicted_units: pred,
        lower_bound: Math.max(Math.round(pred * 0.8), 0),
        upper_bound: Math.round(pred * 1.25),
      });
    }

    return {
      product_id: productId,
      metrics: {
        avg_daily_demand: avgDaily,
        daily_std_dev: dailyStd,
        lead_time_days: leadTimeDays,
        safety_stock: ss,
        reorder_point: rop,
        eoq: eoq,
        trend_factor: trendRes.trendFactor,
        baseline_sma: trendRes.baselineSma
      },
      forecast: forecastWeeks,
      model_used: 'MOVING_AVG_TREND_JS_FALLBACK',
      source: 'JS_FALLBACK'
    };
  }
}

/**
 * Calls FastAPI AI Service to evaluate dead stock
 */
async function analyzeDeadStock(productId, weeklySales) {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/ai/dead-stock/analyze`,
      { product_id: productId, weekly_sales: weeklySales },
      { timeout: AI_TIMEOUT_MS }
    );
    return { ...response.data, source: 'AI_SERVICE' };
  } catch (error) {
    const fallback = businessLogic.evaluateDeadStockStatus(weeklySales);
    return {
      product_id: productId,
      ...fallback,
      source: 'JS_FALLBACK'
    };
  }
}

/**
 * Calls FastAPI AI Service for intelligent assistant queries
 */
async function askAiAssistant(message, contextData) {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/ai/intelligence/assistant`,
      { query: message, context: contextData },
      { timeout: AI_TIMEOUT_MS }
    );
    return {
      reply: response.data.reply,
      suggested_actions: response.data.suggested_actions || [],
      source: 'AI_SERVICE'
    };
  } catch (error) {
    // Contextual deterministic response generator based on inventory state
    const { lowStockCount = 0, deadStockCount = 0, totalProducts = 0, pendingPOs = 0 } = contextData || {};
    let reply = `Here is your inventory snapshot: There are ${totalProducts} total SKUs tracked. `;
    if (lowStockCount > 0) {
      reply += `⚠️ ${lowStockCount} items have breached their Reorder Point (ROP) and need immediate purchase orders. `;
    } else {
      reply += `✅ Stock levels are healthy across core product lines. `;
    }
    if (deadStockCount > 0) {
      reply += `📦 ${deadStockCount} items meet dead-stock criteria (trailing zero sales or >55% velocity decline) and require discount or liquidation actions. `;
    }
    if (pendingPOs > 0) {
      reply += `📋 You currently have ${pendingPOs} purchase orders pending approval.`;
    }

    const suggested_actions = [];
    if (lowStockCount > 0) {
      suggested_actions.push({ label: 'Review Reorder Queue', route: '/reorder' });
    }
    if (deadStockCount > 0) {
      suggested_actions.push({ label: 'View Dead Stock', route: '/dead-stock' });
    }
    suggested_actions.push({ label: 'Go to Inventory', route: '/inventory' });

    return {
      reply,
      suggested_actions,
      source: 'JS_FALLBACK'
    };
  }
}

module.exports = {
  getProductForecast,
  analyzeDeadStock,
  askAiAssistant,
};
