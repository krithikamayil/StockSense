import math
from typing import List, Tuple
import numpy as np

Z_SCORE = 1.65  # 95% service level

def calculate_daily_demand_metrics(weekly_sales: List[float]) -> Tuple[float, float]:
    """
    Returns (avg_daily_demand, daily_std_dev)
    Average daily demand = Mean weekly sales / 7
    """
    if not weekly_sales:
        return 0.0, 0.0
    
    clean_series = [max(float(x), 0.0) for x in weekly_sales]
    mean_weekly = float(np.mean(clean_series))
    avg_daily = round(mean_weekly / 7.0, 2)
    
    # Calculate daily standard deviation from daily distribution
    daily_values = [w / 7.0 for w in clean_series]
    if len(daily_values) > 1:
        daily_std = round(float(np.std(daily_values, ddof=1)), 2)
    else:
        daily_std = 0.0
        
    return avg_daily, daily_std

def calculate_safety_stock(daily_std: float, lead_time_days: int) -> int:
    """
    Safety stock = Z * Daily demand standard deviation * sqrt(Lead time)
    """
    if daily_std <= 0 or lead_time_days <= 0:
        return 0
    raw = Z_SCORE * daily_std * math.sqrt(lead_time_days)
    return int(math.ceil(raw))

def calculate_reorder_point(avg_daily: float, lead_time_days: int, safety_stock: int) -> int:
    """
    Reorder point = Average daily demand * Lead time + Safety stock
    """
    raw = (avg_daily * lead_time_days) + safety_stock
    return int(math.ceil(raw))

def calculate_eoq(avg_daily: float, unit_cost: float, order_cost: float = 50.0, holding_rate: float = 0.20) -> int:
    """
    EOQ = sqrt((2 * Annual demand * Order cost) / Holding cost)
    """
    if avg_daily <= 0:
        return 10
    annual_demand = avg_daily * 365.0
    effective_unit_cost = max(unit_cost, 1.0)
    holding_cost = max(effective_unit_cost * holding_rate, 0.5)
    
    eoq = math.sqrt((2.0 * annual_demand * order_cost) / holding_cost)
    return max(int(math.ceil(eoq)), 5)

def calculate_trend_factor(weekly_sales: List[float]) -> Tuple[float, float]:
    """
    Calculates 4-week SMA and trend factor = Last 4 weeks / Previous 4 weeks clamped in [0.5, 1.6]
    """
    if len(weekly_sales) < 4:
        avg = float(np.mean(weekly_sales)) if weekly_sales else 0.0
        return 1.0, round(avg, 2)
        
    last_4 = weekly_sales[-4:]
    last_4_sum = float(sum(last_4))
    baseline_sma = round(last_4_sum / 4.0, 2)
    
    trend_factor = 1.0
    if len(weekly_sales) >= 8:
        prev_4 = weekly_sales[-8:-4]
        prev_4_sum = float(sum(prev_4))
        if prev_4_sum > 0:
            raw_ratio = last_4_sum / prev_4_sum
            trend_factor = max(min(raw_ratio, 1.6), 0.5)
            
    return round(trend_factor, 4), baseline_sma
