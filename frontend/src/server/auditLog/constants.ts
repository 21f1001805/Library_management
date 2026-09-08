// Mirrors backend/src/app/modules/audit_log/constants.py's AuditAction enum — same
// stored string values (existing rows and the admin log UI's filter tabs match on them).
export const AuditAction = {
  EXPENSE_LOGGED: 'expenseApproved',
  REFUND_ISSUED: 'refundIssued',
  REFUND_REJECTED: 'refundRejected',
  FEE_WAIVED: 'feeWaived',
  FEE_WAIVER_REJECTED: 'feeWaiverRejected',
  PRICING_PLAN_UPDATED: 'pricingPlanUpdated',
  ANNOUNCEMENT_SENT: 'announcementSent',
  COUPON_GENERATED: 'couponGenerated',
  MEMBER_ROLE_CHANGED: 'memberRoleChanged',
  MEMBER_ACTIVATION_CHANGED: 'memberActivationChanged',
  PERMISSION_REQUEST_GRANTED: 'permissionRequestGranted',
  PERMISSION_REQUEST_DENIED: 'permissionRequestDenied',
  FINE_MARKED_PAID: 'fineMarkedPaid',
  COMMUNITY_USER_BANNED: 'communityUserBanned',
  COMMUNITY_USER_UNBANNED: 'communityUserUnbanned',
  LIBRARY_REVIEW_APPROVED: 'libraryReviewApproved',
  LIBRARY_REVIEW_REJECTED: 'libraryReviewRejected',
} as const;

export type AuditActionValue = (typeof AuditAction)[keyof typeof AuditAction];
