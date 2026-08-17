from enum import StrEnum


class AuditAction(StrEnum):
    EXPENSE_LOGGED = "expenseApproved"
    REFUND_ISSUED = "refundIssued"
    REFUND_REJECTED = "refundRejected"
    FEE_WAIVED = "feeWaived"
    FEE_WAIVER_REJECTED = "feeWaiverRejected"
    PRICING_PLAN_UPDATED = "pricingPlanUpdated"
    ANNOUNCEMENT_SENT = "announcementSent"
    COUPON_GENERATED = "couponGenerated"
