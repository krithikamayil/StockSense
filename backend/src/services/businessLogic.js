/**
 * StockSense Core Inventory Business Logic
 * Implements Section 8 mathematical formulations
 */

const Z_SCORE = 1.65; // 95% service level
const DEFAULT_ORDER_COST = 50.0; // S in EOQ
const DEFAULT_HOLDING_RATE = 0.20; // 20% annual holding cost rate

/**
 * Calculates average daily demand from weekly sales history
 * Average daily demand = Mean weekly sales / 7
 */
function calculateAverageDailyDemand(weeklySales) {
  if (!weeklySales || weeklySales.length === 0) return 0;
  const total = weeklySales.reduce((acc, v) => acc + (Number(v) || 0), 0);
  const meanWeekly = total / weeklySales.length;
  return Number((meanWeekly / 7).toFixed(2));
}

/**
 * Calculates daily demand standard deviation from weekly variance or daily records
 */
function calculateDailyStdDev(weeklySales) {
  if (!weeklySales || weeklySales.length < 2) return 0;
  const dailyValues = weeklySales.map(w => (Number(w) || 0) / 7);
  const mean = dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;
  const variance = dailyValues.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (dailyValues.length - 1);
  return Number(Math.sqrt(variance).toFixed(2));
}

/**
 * Safety stock = Z * Daily demand standard deviation * sqrt(Lead time)
 */
function calculateSafetyStock(dailyStdDev, leadTimeDays) {
  if (dailyStdDev <= 0 || leadTimeDays <= 0) return 0;
  const raw = Z_SCORE * dailyStdDev * Math.sqrt(leadTimeDays);
  return Math.ceil(raw);
}

/**
 * Reorder point = Average daily demand * Lead time + Safety stock
 */
function calculateReorderPoint(avgDailyDemand, leadTimeDays, safetyStock) {
  const raw = (avgDailyDemand * leadTimeDays) + safetyStock;
  return Math.ceil(raw);
}

/**
 * EOQ = sqrt((2 * Annual demand * Order cost) / Holding cost)
 * Annual demand = Average daily demand * 365
 * Holding cost = Unit cost * Holding cost rate
 */
function calculateEOQ(avgDailyDemand, unitCost, orderCost = DEFAULT_ORDER_COST, holdingRate = DEFAULT_HOLDING_RATE) {
  if (avgDailyDemand <= 0) return 10;
  const annualDemand = avgDailyDemand * 365;
  const effectiveCost = Math.max(unitCost || 20, 1);
  const annualHoldingCostPerUnit = Math.max(effectiveCost * holdingRate, 0.5);
  const eoq = Math.sqrt((2 * annualDemand * orderCost) / annualHoldingCostPerUnit);
  return Math.max(Math.ceil(eoq), 5);
}

/**
 * Forecast = Last four-week average * Trend factor
 * Trend factor = Last four weeks / Previous four weeks, clamped [0.5, 1.6]
 */
function calculateForecastAndTrend(weeklySalesChronological) {
  // expects chronological weekly sales [w1, w2, ..., wN] where wN is most recent
  const n = weeklySalesChronological.length;
  if (n < 4) {
    const avg = n > 0 ? weeklySalesChronological.reduce((a, b) => a + b, 0) / n : 0;
    return {
      forecastWeekly: Math.round(avg),
      trendFactor: 1.0,
      baselineSma: Math.round(avg),
      model: 'MOVING_AVG_BASELINE'
    };
  }

  const last4 = weeklySalesChronological.slice(-4);
  const last4Sum = last4.reduce((a, b) => a + (Number(b) || 0), 0);
  const last4Avg = last4Sum / 4;

  let trendFactor = 1.0;
  if (n >= 8) {
    const prev4 = weeklySalesChronological.slice(-8, -4);
    const prev4Sum = prev4.reduce((a, b) => a + (Number(b) || 0), 0);
    if (prev4Sum > 0) {
      const rawTrend = last4Sum / prev4Sum;
      trendFactor = Math.min(Math.max(rawTrend, 0.5), 1.6);
    }
  }

  const forecast = Math.round(last4Avg * trendFactor);
  return {
    forecastWeekly: Math.max(forecast, 0),
    trendFactor: Number(trendFactor.toFixed(4)),
    baselineSma: Number(last4Avg.toFixed(2)),
    model: 'MOVING_AVG_TREND_JS_FALLBACK'
  };
}

/**
 * Dead stock logic:
 * - 5 or more trailing zero-sale weeks: Liquidate
 * - 2 or more zero-sale weeks OR sales drop > 55%: Discount
 * - Otherwise: Healthy
 */
function evaluateDeadStockStatus(weeklySalesChronological) {
  if (!weeklySalesChronological || weeklySalesChronological.length === 0) {
    return { status: 'LIQUIDATE', reason: 'No recorded sales in history', trailingZeroWeeks: 5 };
  }

  // Count trailing zero-sale weeks
  let trailingZeroWeeks = 0;
  for (let i = weeklySalesChronological.length - 1; i >= 0; i--) {
    if (Number(weeklySalesChronological[i]) === 0) {
      trailingZeroWeeks++;
    } else {
      break;
    }
  }

  if (trailingZeroWeeks >= 5) {
    return {
      status: 'LIQUIDATE',
      reason: `${trailingZeroWeeks} consecutive trailing weeks with zero sales`,
      trailingZeroWeeks,
      action: 'Liquidate inventory or write down asset value'
    };
  }

  // Check sales drop > 55% comparing last 4 weeks to prior 4 weeks
  let salesDropPct = 0;
  if (weeklySalesChronological.length >= 8) {
    const last4Sum = weeklySalesChronological.slice(-4).reduce((a, b) => a + Number(b), 0);
    const prev4Sum = weeklySalesChronological.slice(-8, -4).reduce((a, b) => a + Number(b), 0);
    if (prev4Sum > 0) {
      salesDropPct = ((prev4Sum - last4Sum) / prev4Sum) * 100;
    }
  }

  if (trailingZeroWeeks >= 2 || salesDropPct > 55) {
    return {
      status: 'DISCOUNT',
      reason: trailingZeroWeeks >= 2 
        ? `${trailingZeroWeeks} trailing zero-sale weeks detected` 
        : `Sales velocity dropped by ${salesDropPct.toFixed(1)}% (> 55% threshold)`,
      trailingZeroWeeks,
      salesDropPct: Number(salesDropPct.toFixed(1)),
      action: 'Apply promotional clearance discount (15% - 30%) to restore velocity'
    };
  }

  return {
    status: 'HEALTHY',
    reason: 'Normal sales velocity and ongoing demand',
    trailingZeroWeeks,
    salesDropPct: Number(salesDropPct.toFixed(1)),
    action: 'Maintain standard replenishment schedule'
  };
}

module.exports = {
  Z_SCORE,
  DEFAULT_ORDER_COST,
  DEFAULT_HOLDING_RATE,
  calculateAverageDailyDemand,
  calculateDailyStdDev,
  calculateSafetyStock,
  calculateReorderPoint,
  calculateEOQ,
  calculateForecastAndTrend,
  evaluateDeadStockStatus,
};
