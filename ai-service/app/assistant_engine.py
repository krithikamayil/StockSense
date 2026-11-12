from typing import Dict, Any, List
from app.models import AssistantQueryResponse, ActionItem

def process_assistant_query(query: str, context: Dict[str, Any] = None) -> AssistantQueryResponse:
    """
    Intelligent Assistant Engine that evaluates user inquiries against structured inventory state.
    """
    q = query.lower()
    ctx = context or {}
    
    total_products = ctx.get("totalProducts", 0)
    low_stock = ctx.get("lowStockCount", 0)
    out_of_stock = ctx.get("outOfStockCount", 0)
    valuation = ctx.get("valuation", 0.0)
    pending_pos = ctx.get("pendingPOs", 0)
    sample_items = ctx.get("sampleLowStock", [])

    actions: List[ActionItem] = []

    if any(k in q for k in ["reorder", "low stock", "urgent", "replenish", "stockout", "out of stock"]):
        if low_stock > 0 or out_of_stock > 0:
            item_details = ""
            if sample_items:
                item_details = " Priority SKUs include: " + ", ".join([f"{item.get('name', 'Product')} (Stock: {item.get('current_stock', 0)}, ROP: {item.get('reorder_point', 0)})" for item in sample_items[:3]]) + "."
            reply = f"🚨 Action Required: You have {low_stock} items currently below their designated Reorder Point (ROP), including {out_of_stock} out-of-stock items.{item_details} I recommend generating batch purchase orders based on calculated EOQ."
            actions.append(ActionItem(label="Open Reordering Screen", route="/reordering"))
            actions.append(ActionItem(label="Inspect Low Stock", route="/inventory?status=LOW_STOCK"))
        else:
            reply = "✅ Great news! All monitored SKUs are currently operating above their safety stock and reorder point thresholds."
            actions.append(ActionItem(label="View Inventory", route="/inventory"))

    elif any(k in q for k in ["dead stock", "stagnant", "slow", "liquidate", "discount", "clearance"]):
        reply = "📦 Dead Stock Audit: Items with 5+ trailing weeks of zero sales are queued for liquidation write-off, while items with a >55% demand drop are eligible for clearance discounts to recover working capital."
        actions.append(ActionItem(label="Review Dead Stock", route="/dead-stock"))

    elif any(k in q for k in ["valuation", "value", "worth", "capital", "kpi", "summary", "overview"]):
        reply = f"📊 Financial Summary: Your warehouse is currently holding {total_products} distinct SKUs with a total inventory valuation of ${valuation:,.2f}. There are {pending_pos} purchase orders pending workflow approval."
        actions.append(ActionItem(label="Open Executive Dashboard", route="/dashboard"))

    elif any(k in q for k in ["forecast", "demand", "predict", "trend", "sales"]):
        reply = "📈 AI Forecasting Engine uses an ensemble of 4-week trend-factored moving averages and linear regression to generate weekly demand predictions and calculate dynamic safety stock (Z=1.65)."
        actions.append(ActionItem(label="View Forecasting Screen", route="/forecasting"))

    elif any(k in q for k in ["supplier", "vendor", "lead time", "po", "purchase order"]):
        reply = f"🚚 Replenishment Status: Purchase orders are tracked through full lifecycle (DRAFT → PENDING_APPROVAL → APPROVED → ORDERED → RECEIVED). You currently have {pending_pos} active/pending POs."
        actions.append(ActionItem(label="Manage Purchase Orders", route="/reordering"))
        actions.append(ActionItem(label="View Suppliers", route="/suppliers"))

    else:
        reply = f"Hello! I am StockSense AI Assistant. I can assist you with demand forecasting, reorder recommendations ({low_stock} items pending), dead-stock clearance actions, and supplier purchase orders. What would you like to examine?"
        actions.append(ActionItem(label="Reorder Queue", route="/reordering"))
        actions.append(ActionItem(label="Inventory Audit", route="/inventory"))
        actions.append(ActionItem(label="Demand Forecasts", route="/forecasting"))

    return AssistantQueryResponse(
        reply=reply,
        suggested_actions=actions,
        confidence=0.96
    )
