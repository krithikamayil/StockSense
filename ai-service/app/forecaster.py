from typing import List, Dict, Any, Tuple
import numpy as np
from app.inventory_math import (
    calculate_daily_demand_metrics,
    calculate_safety_stock,
    calculate_reorder_point,
    calculate_eoq,
    calculate_trend_factor,
)
from app.models import ForecastWeekPoint, InventoryMetrics, ForecastResponse

def generate_demand_forecast(
    product_id: str,
    weekly_sales: List[float],
    lead_time_days: int = 7,
    unit_cost: float = 50.0,
    order_cost: float = 50.0,
    holding_rate: float = 0.20,
    forecast_horizon: int = 4
) -> ForecastResponse:
    """
    Generates 4-week demand forecast with moving-average baseline, trend analysis,
    and evaluation metrics using NumPy for robust numerical stability.
    """
    clean_series = [max(float(x), 0.0) for x in weekly_sales]
    n = len(clean_series)
    
    avg_daily, daily_std = calculate_daily_demand_metrics(clean_series)
    safety_stock = calculate_safety_stock(daily_std, lead_time_days)
    reorder_point = calculate_reorder_point(avg_daily, lead_time_days, safety_stock)
    eoq = calculate_eoq(avg_daily, unit_cost, order_cost, holding_rate)
    trend_factor, baseline_sma = calculate_trend_factor(clean_series)
    
    # Handle insufficient data honestly
    if n < 4:
        baseline_pred = max(int(round(baseline_sma)), 1)
        forecast_points = [
            ForecastWeekPoint(
                week_number=i,
                predicted_units=baseline_pred,
                lower_bound=max(int(round(baseline_pred * 0.7)), 0),
                upper_bound=int(round(baseline_pred * 1.35))
            )
            for i in range(1, forecast_horizon + 1)
        ]
        
        metrics = InventoryMetrics(
            avg_daily_demand=avg_daily,
            daily_std_dev=daily_std,
            lead_time_days=lead_time_days,
            safety_stock=safety_stock,
            reorder_point=reorder_point,
            eoq=eoq,
            trend_factor=trend_factor,
            baseline_sma=baseline_sma,
            mae=None,
            rmse=None
        )
        
        return ForecastResponse(
            product_id=product_id,
            metrics=metrics,
            forecast=forecast_points,
            model_used="MOVING_AVERAGE_BASELINE (Sparse Data)",
            notes="Insufficient historical observations (< 4 weeks); default baseline moving average applied."
        )

    # Time series modeling with trend & linear regression via NumPy
    x = np.arange(n, dtype=float)
    y = np.array(clean_series, dtype=float)
    
    # Fit linear polynomial degree 1: y = slope * x + intercept
    poly = np.polyfit(x, y, 1)
    slope, intercept = poly[0], poly[1]
    
    y_pred_in_sample = slope * x + intercept
    mae = float(round(np.mean(np.abs(y - y_pred_in_sample)), 2))
    rmse = float(round(np.sqrt(np.mean((y - y_pred_in_sample) ** 2)), 2))
    
    # Out of sample predictions for next 4 weeks
    forecast_points: List[ForecastWeekPoint] = []
    base_forecast = baseline_sma * trend_factor
    
    for w in range(1, forecast_horizon + 1):
        future_x = n + w - 1
        reg_pred = float(slope * future_x + intercept)
        
        # Ensemble blended forecast between trend-adjusted SMA and linear projection
        blended = (0.6 * base_forecast) + (0.4 * max(reg_pred, 0.0))
        predicted_units = max(int(round(blended)), 1)
        
        # Uncertainty bounds based on standard error / daily std
        bound_margin = max(int(round(1.65 * daily_std * np.sqrt(7))), int(round(predicted_units * 0.2)))
        lower_bound = max(predicted_units - bound_margin, 0)
        upper_bound = predicted_units + bound_margin
        
        forecast_points.append(
            ForecastWeekPoint(
                week_number=w,
                predicted_units=predicted_units,
                lower_bound=lower_bound,
                upper_bound=upper_bound
            )
        )
        
    metrics = InventoryMetrics(
        avg_daily_demand=avg_daily,
        daily_std_dev=daily_std,
        lead_time_days=lead_time_days,
        safety_stock=safety_stock,
        reorder_point=reorder_point,
        eoq=eoq,
        trend_factor=trend_factor,
        baseline_sma=baseline_sma,
        mae=mae,
        rmse=rmse
    )
    
    return ForecastResponse(
        product_id=product_id,
        metrics=metrics,
        forecast=forecast_points,
        model_used="ENSEMBLE_TREND_REGRESSION",
        notes="Model fitted on chronological weekly sales with trend decomposition."
    )
