from typing import List
from app.models import DeadStockResponse

def analyze_dead_stock(product_id: str, weekly_sales: List[float]) -> DeadStockResponse:
    """
    Evaluates dead stock based on Section 8 rules:
    - 5 or more trailing zero-sale weeks: Liquidate
    - 2 or more zero-sale weeks OR sales drop > 55%: Discount
    - Otherwise: Healthy
    """
    clean_series = [max(float(x), 0.0) for x in weekly_sales]
    n = len(clean_series)
    
    if n == 0:
        return DeadStockResponse(
            product_id=product_id,
            status="LIQUIDATE",
            reason="No recorded sales activity found in dataset.",
            action="Liquidate remaining inventory or write down asset value.",
            trailing_zero_weeks=5,
            sales_drop_pct=100.0
        )
        
    # Count trailing zero-sale weeks
    trailing_zeros = 0
    for val in reversed(clean_series):
        if val == 0.0:
            trailing_zeros += 1
        else:
            break
            
    if trailing_zeros >= 5:
        return DeadStockResponse(
            product_id=product_id,
            status="LIQUIDATE",
            reason=f"{trailing_zeros} consecutive trailing weeks with zero recorded sales.",
            action="Mark for salvage liquidation or vendor return to eliminate holding costs.",
            trailing_zero_weeks=trailing_zeros,
            sales_drop_pct=100.0
        )
        
    # Check for drop > 55% comparing last 4 weeks to preceding 4 weeks
    sales_drop_pct = 0.0
    if n >= 8:
        last_4_sum = sum(clean_series[-4:])
        prev_4_sum = sum(clean_series[-8:-4])
        if prev_4_sum > 0:
            sales_drop_pct = max(round(((prev_4_sum - last_4_sum) / prev_4_sum) * 100.0, 1), 0.0)
            
    if trailing_zeros >= 2 or sales_drop_pct > 55.0:
        reason = (
            f"{trailing_zeros} trailing weeks without sales."
            if trailing_zeros >= 2
            else f"Sales velocity declined by {sales_drop_pct}% (> 55% threshold) over past 8 weeks."
        )
        return DeadStockResponse(
            product_id=product_id,
            status="DISCOUNT",
            reason=reason,
            action="Apply promotional clearance discount (20% - 30%) to stimulate inventory turnover.",
            trailing_zero_weeks=trailing_zeros,
            sales_drop_pct=sales_drop_pct
        )
        
    return DeadStockResponse(
        product_id=product_id,
        status="HEALTHY",
        reason="Consistent sales frequency and steady turnover velocity.",
        action="Maintain standard replenishment cycle without price intervention.",
        trailing_zero_weeks=trailing_zeros,
        sales_drop_pct=sales_drop_pct
    )
