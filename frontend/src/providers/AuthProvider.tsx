/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, type ReactNode } from 'react';

import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  registerRefreshHandler,
  type TokenResponse,
} from '@/lib/api';
import { useLocalStorageState } from '@/lib/useLocalStorageState';

export type Role = 'admin' | 'member' | 'manager' | 'it-head' | 'guardian' | 'librarian';

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}

export interface CompleteProfilePayload {
  full_name: string;
  phone: string;
  password: string;
}

export interface UpdateProfilePayload {
  full_name?: string;
  phone?: string;
  password?: string;
  avatar_url?: string;
}

export interface PaymentPayload {
  amount: number;
  label: string;
  plan_months?: number;
  coupon_code?: string;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  label: string;
  status: string;
  created_at: string;
}

export interface Membership {
  plan_label: string;
  purchased_at: string;
  expires_at: string;
  is_active: boolean;
}

export interface ReadingProgressEntry {
  id: string;
  book_id: string;
  book_title: string;
  status: 'reading' | 'completed';
  percent_complete: number;
  updated_at: string;
}

export interface GuardianChild {
  id: string;
  full_name: string;
  email: string;
  currently_reading: ReadingProgressEntry[];
  completed: ReadingProgressEntry[];
  outstanding_fine: number;
  fine_book_title: string | null;
  fine_due_date: string | null;
  subscription_expires_on: string | null;
}

export interface ReadingGoalPayload {
  yearly_goal: number;
  monthly_goal: number;
}

export interface ReadingGoal {
  yearly_goal: number;
  monthly_goal: number;
  books_completed_this_year: number;
  books_completed_this_month: number;
  updated_at: string;
}

export interface ReadingStreak {
  current_streak_days: number;
  longest_streak_days: number;
}

export interface LeaderboardEntry {
  rank: number;
  member_id: string;
  full_name: string;
  books_completed: number;
  is_current_user: boolean;
}

export interface Reservation {
  id: string;
  book_id: string;
  book_title: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  due_date: string | null;
  created_at: string;
  queue_position: number | null;
  eta_days: number | null;
}

export interface PostComment {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar_url: string | null;
  content: string;
  created_at: string;
  reported: boolean;
  replies: PostComment[];
}

export interface CommunityPost {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar_url: string | null;
  book_title: string | null;
  content: string;
  images: string[];
  created_at: string;
  like_count: number;
  is_liked: boolean;
  is_saved: boolean;
  is_own: boolean;
  reported: boolean;
  comments: PostComment[];
}

export interface CommunityPostPayload {
  book_title?: string | null;
  content: string;
  images: string[];
}

export interface AddCommentPayload {
  content: string;
  parent_id?: string | null;
}

export interface BannedAuthor {
  user_id: string;
  full_name: string;
}

export type SeatSlotStatus = 'available' | 'reserved' | 'booked_by_me';

export interface SeatSlot {
  seat_label: string;
  status: SeatSlotStatus;
  booking_id: string | null;
}

export interface SeatSchedule {
  date: string;
  hour: number;
  seats: SeatSlot[];
}

export interface SeatSlotPayload {
  seat_label: string;
  date: string;
  hour: number;
}

export interface SeatBookingRecord {
  id: string;
  seat_label: string;
  date: string;
  hour: number;
  created_at: string;
}

export interface AppNotificationRecord {
  id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface ReviewPayload {
  rating: number;
  comment: string;
  images: string[];
}

export interface Review {
  id: string;
  book_id: string;
  book_title: string;
  book_author: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_avatar_url: string | null;
  rating: number;
  comment: string;
  images: string[];
  created_at: string;
  is_own: boolean;
}

export interface RatingBreakdownEntry {
  stars: number;
  percent: number;
}

export interface BookReviews {
  items: Review[];
  average_rating: number;
  total_reviews: number;
  breakdown: RatingBreakdownEntry[];
}

export type ExpenseCategory = 'staffSalaries' | 'bookProcurement' | 'utilities' | 'marketing';

export interface AdminTrend {
  direction: 'up' | 'down';
  percent: number;
}

export interface AdminStats {
  revenue_mtd: number;
  revenue_trend: AdminTrend;
  expenses_mtd: number;
  expenses_trend: AdminTrend;
  net_profit_mtd: number;
  net_profit_trend: AdminTrend;
  total_members: number;
  total_members_trend: AdminTrend;
}

export interface RevenueSource {
  source: 'membershipFees' | 'eventTickets' | 'finesCollected' | 'donationsValue';
  amount: number;
}

export interface BudgetCategory {
  category: ExpenseCategory;
  budgeted: number;
  spent: number;
}

export interface AdminSeatStatus {
  available: number;
  booked: number;
  total: number;
}

export interface AdminSeatOccupancySlot {
  hour: number;
  percent_filled: number;
}

export interface AdminDashboard {
  stats: AdminStats;
  cash_flow: RevenueSource[];
  budget: BudgetCategory[];
  seat_status: AdminSeatStatus;
  seat_occupancy: AdminSeatOccupancySlot[];
}

export interface AuditLogEntry {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_role: Role;
  action: string;
  params: Record<string, string | number>;
  created_at: string;
}

export interface AdminMemberRecord {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  joined_at: string;
  last_payment_amount: number | null;
  last_payment_label: string | null;
  last_payment_at: string | null;
  plan_label: string | null;
  plan_expires_at: string | null;
  plan_is_active: boolean;
  books_reading: number;
  books_completed: number;
  reported: boolean;
  event_registrations: number;
}

export interface AdminMemberUpdatePayload {
  role_name?: string;
  is_active?: boolean;
}

export interface AdminMemberListResponse {
  items: AdminMemberRecord[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminMemberQuery {
  search?: string;
  page?: number;
  page_size?: number;
}

export interface AdminPaymentRecord {
  id: string;
  member_id: string;
  member_name: string;
  member_email: string;
  amount: number;
  label: string;
  status: string;
  plan_months: number | null;
  created_at: string;
}

export interface AdminPaymentListResponse {
  items: AdminPaymentRecord[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminPaymentQuery {
  search?: string;
  page?: number;
  page_size?: number;
}

export type SupportTicketCategory =
  | 'book_reservation'
  | 'payment'
  | 'seat_booking'
  | 'harassment'
  | 'offline_library'
  | 'attendance'
  | 'other';

export type SupportTicketStatus = 'open' | 'resolved' | 'closed';

export interface SupportTicketRecord {
  id: string;
  category: SupportTicketCategory;
  description: string;
  status: SupportTicketStatus;
  raised_by_id: string;
  raised_by_name: string;
  raised_by_role: Role;
  resolution_note: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type BookRecordType = 'lost' | 'donated' | 'purchased';

export interface BookRecordEntry {
  id: string;
  book_id: string;
  book_title: string;
  type: BookRecordType;
  note: string | null;
  logged_by_name: string;
  created_at: string;
}

export interface BookRecordPayload {
  book_id: string;
  type: BookRecordType;
  note?: string;
}

export interface SupportTicketPayload {
  category: SupportTicketCategory;
  description: string;
}

export interface ResolveTicketPayload {
  resolution_note: string;
}

export interface MemberRole {
  id: string;
  name: string;
}

export interface MemberRecord {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: MemberRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberListResponse {
  items: MemberRecord[];
  total: number;
  page: number;
  page_size: number;
}

export interface MemberListQuery {
  search?: string;
  role?: string;
  active_only?: boolean;
  page?: number;
  page_size?: number;
}

export interface PermissionRequestPayload {
  permission: string;
  reason: string;
}

export interface PermissionRequestRecord {
  id: string;
  permission: string;
  reason: string;
  status: string;
  requested_by_id: string;
  requested_by_name: string;
  decided_by_name: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface LoanPayload {
  book_id: string;
  member_id: string;
}

export interface LoanRecord {
  id: string;
  book_id: string;
  book_title: string;
  member_id: string;
  member_name: string;
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  days_late: number;
  fine_amount: number;
  fine_paid: boolean;
  status: 'active' | 'overdue' | 'returned';
}

export interface ITHeadStats {
  active_members: number;
  open_issues: number;
  pending_permissions: number;
  fees_outstanding: number;
  late_fines_outstanding: number;
}

export interface FeeStatusEntryRecord {
  member_id: string;
  member_name: string;
  amount_due: number;
  status: 'paid' | 'due' | 'overdue';
  due_date: string | null;
}

export interface ITHeadDashboard {
  stats: ITHeadStats;
  fee_status: FeeStatusEntryRecord[];
}

export interface ExpensePayload {
  category: ExpenseCategory;
  amount: number;
}

export interface PricingPlan {
  id: string;
  plan_id: string;
  months: number;
  price: number;
  save_percent: number;
  badge: 'mostPopular' | 'bestValue' | null;
  updated_at: string;
}

export interface PricingPlanUpdatePayload {
  price: number;
  save_percent: number;
}

export interface Coupon {
  id: string;
  code: string;
  discount_percent: number;
  max_uses: number;
  uses_count: number;
  created_at: string;
}

export interface CouponPayload {
  discount_percent: number;
  max_uses: number;
}

export interface CouponValidation {
  code: string;
  discount_percent: number;
}

export interface CreateMemberPayload {
  full_name: string;
  email: string;
  phone?: string;
  password: string;
}

export interface CreatedMember {
  id: string;
  full_name: string;
  email: string;
}

export interface AnnouncementPayload {
  message: string;
}

export interface AnnouncementResult {
  recipient_count: number;
}

export interface RevenueByPlanItem {
  label: string;
  amount: number;
  count: number;
}

export interface RevenueByPlanReport {
  items: RevenueByPlanItem[];
  total: number;
}

export interface MonthlyFigure {
  month: string;
  revenue: number;
  expenses: number;
  net_profit: number;
}

export interface ProfitAndLossReport {
  months: MonthlyFigure[];
  total_revenue: number;
  total_expenses: number;
  total_net_profit: number;
}

export interface ExpenseBreakdownItem {
  category: ExpenseCategory;
  amount: number;
  percent: number;
}

export interface ExpenseBreakdownReport {
  items: ExpenseBreakdownItem[];
  total: number;
}

export interface MembershipGrowthMonth {
  month: string;
  new_members: number;
  total_members: number;
}

export interface MembershipGrowthReport {
  months: MembershipGrowthMonth[];
}

export type BillingRequestType = 'refund' | 'fee_waiver';

export interface BillingRequestPayload {
  member_id: string;
  type: BillingRequestType;
  amount: number;
  reason: string;
}

export interface WaiveFinePayload {
  member_id: string;
  amount: number;
  reason: string;
}

export interface BillingRequestRecord {
  id: string;
  type: BillingRequestType;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  member_id: string;
  member_name: string;
  created_by_name: string;
  created_at: string;
  decided_at: string | null;
}

export interface MemberSummary {
  id: string;
  full_name: string;
  email: string;
}

export interface MemberSearchOptions {
  /** Exact role name match, e.g. 'member' or 'guardian'. */
  role?: string;
  /** Only return active accounts. */
  activeOnly?: boolean;
}

export interface ManagerDashboardStats {
  seats_booked_today: number;
  books_issued_today: number;
  new_registrations_today: number;
  pending_tasks: number;
}

export interface ManagerSeatBookingPayload {
  member_id: string;
  seat_label: string;
  date: string;
  hour: number;
}

export type LoanDurationDays = 3 | 5 | 7 | 10;

export interface ManagerLoanPayload {
  member_id: string;
  book_id: string;
  duration_days: LoanDurationDays;
}

export interface ManagerGuardianLinkPayload {
  student_email: string;
  guardian_email: string;
}

export interface PendingReservationRequest {
  id: string;
  book_id: string;
  book_title: string;
  member_id: string;
  member_name: string;
  member_email: string;
  requested_at: string;
}

export interface ManagerBookAvailability {
  id: string;
  title: string;
  author: string;
  category: string;
  total_copies: number;
  available_copies: number;
  is_available: boolean;
  /** Earliest due date among this book's active loans; set only when unavailable. */
  expected_available_at: string | null;
}

export interface ManagerBookListResponse {
  items: ManagerBookAvailability[];
  total: number;
  page: number;
  page_size: number;
}

export interface ManagerBookQuery {
  search?: string;
  page?: number;
  page_size?: number;
}

interface AuthState {
  isAuthenticated: boolean;
  role: Role | null;
  token: string | null;
  refreshToken: string | null;
  userId: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  /** True right after a first-time Google sign-in, until completeProfile() runs. */
  needsProfileCompletion: boolean;
  /**
   * Set right after registerAccount() so PublicRoute's auth-state redirect (see Login.tsx's
   * comment on that race) sends the new user to Payment instead of its usual role home.
   */
  postAuthRedirect: string | null;
}

interface AuthContextValue extends AuthState {
  /** ponytail: dev-only role preview — logs into a seeded per-role dev account (see seed_dev_accounts.py), drop the buttons using this before production. */
  login: (role: Role) => Promise<void>;
  loginWithCredentials: (email: string, password: string) => Promise<void>;
  loginWithGoogleToken: (idToken: string) => Promise<void>;
  registerAccount: (payload: RegisterPayload, postAuthRedirect: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (payload: { token: string; password: string }) => Promise<void>;
  completeProfile: (payload: CompleteProfilePayload) => Promise<void>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<void>;
  createPayment: (payload: PaymentPayload) => Promise<void>;
  payAtLibrary: (payload: PaymentPayload) => Promise<void>;
  deleteAccount: () => Promise<void>;
  getMembership: () => Promise<Membership | null>;
  getMyPayments: () => Promise<PaymentRecord[]>;
  getGuardianChildren: () => Promise<GuardianChild[]>;
  payChildFines: (childId: string) => Promise<void>;
  renewChildSubscription: (childId: string) => Promise<void>;
  bookSeatForChild: (childId: string, payload: SeatSlotPayload) => Promise<SeatBookingRecord>;
  requestSeatNotifyForChild: (childId: string, payload: SeatSlotPayload) => Promise<void>;
  getMyReadingProgress: () => Promise<ReadingProgressEntry[]>;
  getReadingGoal: () => Promise<ReadingGoal | null>;
  setReadingGoal: (payload: ReadingGoalPayload) => Promise<ReadingGoal>;
  getReadingStreak: () => Promise<ReadingStreak>;
  getLeaderboard: () => Promise<LeaderboardEntry[]>;
  getMyReservations: () => Promise<Reservation[]>;
  reserveBook: (bookId: string) => Promise<Reservation>;
  cancelReservation: (reservationId: string) => Promise<void>;
  getCommunityPosts: () => Promise<CommunityPost[]>;
  createCommunityPost: (payload: CommunityPostPayload) => Promise<CommunityPost>;
  updateCommunityPost: (postId: string, payload: CommunityPostPayload) => Promise<CommunityPost>;
  deleteCommunityPost: (postId: string) => Promise<void>;
  toggleCommunityLike: (postId: string) => Promise<CommunityPost>;
  toggleCommunitySave: (postId: string) => Promise<CommunityPost>;
  reportCommunityPost: (postId: string) => Promise<CommunityPost>;
  addCommunityComment: (postId: string, payload: AddCommentPayload) => Promise<CommunityPost>;
  deleteCommunityComment: (commentId: string) => Promise<void>;
  reportCommunityComment: (commentId: string) => Promise<void>;
  getBannedAuthors: () => Promise<BannedAuthor[]>;
  banCommunityAuthor: (userId: string) => Promise<void>;
  unbanCommunityAuthor: (userId: string) => Promise<void>;
  getSeatSchedule: (date: string, hour: number) => Promise<SeatSchedule>;
  bookSeat: (payload: SeatSlotPayload) => Promise<SeatBookingRecord>;
  getMySeatBookings: () => Promise<SeatBookingRecord[]>;
  cancelSeatBooking: (bookingId: string) => Promise<void>;
  requestSeatNotify: (payload: SeatSlotPayload) => Promise<void>;
  getMyNotifications: () => Promise<AppNotificationRecord[]>;
  markNotificationRead: (notificationId: string) => Promise<AppNotificationRecord>;
  markAllNotificationsRead: () => Promise<AppNotificationRecord[]>;
  getBookReviews: (bookId: string) => Promise<BookReviews>;
  createReview: (bookId: string, payload: ReviewPayload) => Promise<Review>;
  updateReview: (reviewId: string, payload: ReviewPayload) => Promise<Review>;
  deleteReview: (reviewId: string) => Promise<void>;
  getAllReviews: () => Promise<Review[]>;
  getAdminDashboard: () => Promise<AdminDashboard>;
  logExpense: (payload: ExpensePayload) => Promise<void>;
  getAuditLog: () => Promise<AuditLogEntry[]>;
  getRevenueByPlanReport: () => Promise<RevenueByPlanReport>;
  getProfitAndLossReport: () => Promise<ProfitAndLossReport>;
  getExpenseBreakdownReport: () => Promise<ExpenseBreakdownReport>;
  getMembershipGrowthReport: () => Promise<MembershipGrowthReport>;
  getAdminMembers: (query?: AdminMemberQuery) => Promise<AdminMemberListResponse>;
  updateAdminMember: (memberId: string, payload: AdminMemberUpdatePayload) => Promise<void>;
  getAdminPayments: (query?: AdminPaymentQuery) => Promise<AdminPaymentListResponse>;
  createSupportTicket: (payload: SupportTicketPayload) => Promise<SupportTicketRecord>;
  getMySupportTickets: () => Promise<SupportTicketRecord[]>;
  getStaffSupportTickets: (status?: SupportTicketStatus) => Promise<SupportTicketRecord[]>;
  resolveSupportTicket: (
    ticketId: string,
    payload: ResolveTicketPayload,
  ) => Promise<SupportTicketRecord>;
  confirmSupportTicket: (ticketId: string) => Promise<SupportTicketRecord>;
  reopenSupportTicket: (ticketId: string) => Promise<SupportTicketRecord>;
  searchMembers: (query: string, options?: MemberSearchOptions) => Promise<MemberSummary[]>;
  getManagerDashboard: () => Promise<ManagerDashboardStats>;
  bookSeatForMember: (payload: ManagerSeatBookingPayload) => Promise<SeatBookingRecord>;
  issueLoanForMember: (payload: ManagerLoanPayload) => Promise<LoanRecord>;
  linkGuardian: (payload: ManagerGuardianLinkPayload) => Promise<void>;
  getManagerBooks: (query?: ManagerBookQuery) => Promise<ManagerBookListResponse>;
  getPendingReservations: () => Promise<PendingReservationRequest[]>;
  approveReservation: (id: string, durationDays: LoanDurationDays) => Promise<Reservation>;
  rejectReservation: (id: string) => Promise<Reservation>;
  getActiveLoans: () => Promise<LoanRecord[]>;
  getLoanHistory: () => Promise<LoanRecord[]>;
  getMyLoans: () => Promise<LoanRecord[]>;
  getBillingRequests: () => Promise<BillingRequestRecord[]>;
  createBillingRequest: (payload: BillingRequestPayload) => Promise<BillingRequestRecord>;
  approveBillingRequest: (requestId: string) => Promise<BillingRequestRecord>;
  rejectBillingRequest: (requestId: string) => Promise<BillingRequestRecord>;
  waiveFine: (payload: WaiveFinePayload) => Promise<BillingRequestRecord>;
  getPricingPlans: () => Promise<PricingPlan[]>;
  updatePricingPlan: (id: string, payload: PricingPlanUpdatePayload) => Promise<PricingPlan>;
  createMember: (payload: CreateMemberPayload) => Promise<CreatedMember>;
  sendAnnouncement: (payload: AnnouncementPayload) => Promise<AnnouncementResult>;
  getCoupons: () => Promise<Coupon[]>;
  generateCoupon: (payload: CouponPayload) => Promise<Coupon>;
  validateCoupon: (code: string) => Promise<CouponValidation>;
  getMembers: (query?: MemberListQuery) => Promise<MemberListResponse>;
  getPermissionRequests: () => Promise<PermissionRequestRecord[]>;
  createPermissionRequest: (payload: PermissionRequestPayload) => Promise<PermissionRequestRecord>;
  grantPermissionRequest: (id: string) => Promise<PermissionRequestRecord>;
  denyPermissionRequest: (id: string) => Promise<PermissionRequestRecord>;
  createLoan: (payload: LoanPayload) => Promise<LoanRecord>;
  getLoanFines: () => Promise<LoanRecord[]>;
  returnLoan: (id: string) => Promise<LoanRecord>;
  markFinePaid: (id: string) => Promise<LoanRecord>;
  sendFineReminder: (id: string) => Promise<void>;
  getITHeadDashboard: () => Promise<ITHeadDashboard>;
  getBookRecords: () => Promise<BookRecordEntry[]>;
  createBookRecord: (payload: BookRecordPayload) => Promise<BookRecordEntry>;
  clearPostAuthRedirect: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SIGNED_OUT: AuthState = {
  isAuthenticated: false,
  role: null,
  token: null,
  refreshToken: null,
  userId: null,
  fullName: null,
  email: null,
  phone: null,
  avatarUrl: null,
  needsProfileCompletion: false,
  postAuthRedirect: null,
};

// Matches backend/scripts/seed_dev_accounts.py — one real, loggable-in account per
// role so the Login page's "Continue as <role>" preview buttons get a real token
// (and therefore real data) instead of faking local auth state.
const DEV_PREVIEW_EMAIL_DOMAIN = 'devpreview.internal';
const DEV_PREVIEW_PASSWORD = 'DevPreview123!';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useLocalStorageState<AuthState>('mock-auth', SIGNED_OUT);

  // A real session always sets isAuthenticated and token together (see applySession) — the
  // only way to see one without the other is a session cached by the old role-preview login,
  // which faked isAuthenticated/role locally with no real token. Clear it so ProtectedRoute
  // sends the tab back to Login instead of silently showing empty data everywhere.
  useEffect(() => {
    if (state.isAuthenticated && !state.token) setState(SIGNED_OUT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(role: Role): Promise<void> {
    applySession(
      await apiPost<TokenResponse>('/auth/login', {
        email: `${role}@${DEV_PREVIEW_EMAIL_DOMAIN}`,
        password: DEV_PREVIEW_PASSWORD,
      }),
    );
  }

  function applySession(
    data: TokenResponse,
    needsProfileCompletion = false,
    postAuthRedirect: string | null = null,
  ) {
    setState({
      isAuthenticated: true,
      role: data.user.role.name as Role,
      token: data.access_token,
      refreshToken: data.refresh_token,
      userId: data.user.id,
      fullName: data.user.full_name,
      email: data.user.email,
      phone: data.user.phone,
      avatarUrl: data.user.avatar_url,
      needsProfileCompletion,
      postAuthRedirect,
    });
  }

  function clearPostAuthRedirect() {
    setState({ ...state, postAuthRedirect: null });
  }

  async function loginWithCredentials(email: string, password: string) {
    applySession(await apiPost<TokenResponse>('/auth/login', { email, password }));
  }

  async function loginWithGoogleToken(idToken: string) {
    const data = await apiPost<TokenResponse>('/auth/google', { id_token: idToken });
    applySession(data, data.is_new_user);
  }

  async function registerAccount(payload: RegisterPayload, postAuthRedirect: string) {
    applySession(await apiPost<TokenResponse>('/auth/register', payload), false, postAuthRedirect);
  }

  async function forgotPassword(email: string) {
    await apiPost<undefined>('/auth/forgot-password', { email });
  }

  async function resetPassword(payload: { token: string; password: string }) {
    await apiPost<undefined>('/auth/reset-password', payload);
  }

  async function completeProfile(payload: CompleteProfilePayload) {
    if (!state.token) throw new Error('Not authenticated');
    applySession(await apiPatch<TokenResponse>('/auth/me', payload, state.token));
  }

  async function updateProfile(payload: UpdateProfilePayload) {
    if (!state.token) throw new Error('Not authenticated');
    applySession(
      await apiPatch<TokenResponse>('/auth/me', payload, state.token),
      state.needsProfileCompletion,
    );
  }

  async function createPayment(payload: PaymentPayload) {
    if (!state.token) throw new Error('Not authenticated');
    await apiPost('/payments', payload, state.token);
  }

  async function payAtLibrary(payload: PaymentPayload) {
    if (!state.token) throw new Error('Not authenticated');
    await apiPost('/payments/pay-at-library', payload, state.token);
  }

  async function deleteAccount() {
    if (!state.token) throw new Error('Not authenticated');
    await apiDelete('/auth/me', state.token);
    setState(SIGNED_OUT);
  }

  async function getMembership(): Promise<Membership | null> {
    if (!state.token) return null;
    return apiGet<Membership | null>('/payments/me/membership', state.token);
  }

  async function getMyPayments(): Promise<PaymentRecord[]> {
    if (!state.token) return [];
    return apiGet<PaymentRecord[]>('/payments/me', state.token);
  }

  async function getGuardianChildren(): Promise<GuardianChild[]> {
    if (!state.token) return [];
    return apiGet<GuardianChild[]>('/guardian/children', state.token);
  }

  async function payChildFines(childId: string): Promise<void> {
    if (!state.token) throw new Error('Not authenticated');
    await apiPost(`/guardian/children/${childId}/pay-fines`, undefined, state.token);
  }

  async function renewChildSubscription(childId: string): Promise<void> {
    if (!state.token) throw new Error('Not authenticated');
    await apiPost(`/guardian/children/${childId}/renew`, undefined, state.token);
  }

  async function bookSeatForChild(
    childId: string,
    payload: SeatSlotPayload,
  ): Promise<SeatBookingRecord> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<SeatBookingRecord>(
      `/guardian/children/${childId}/seat-bookings`,
      payload,
      state.token,
    );
  }

  async function requestSeatNotifyForChild(
    childId: string,
    payload: SeatSlotPayload,
  ): Promise<void> {
    if (!state.token) throw new Error('Not authenticated');
    await apiPost(`/guardian/children/${childId}/seat-notify`, payload, state.token);
  }

  async function getMyReadingProgress(): Promise<ReadingProgressEntry[]> {
    if (!state.token) return [];
    return apiGet<ReadingProgressEntry[]>('/members/me/reading-progress', state.token);
  }

  async function getReadingGoal(): Promise<ReadingGoal | null> {
    if (!state.token) return null;
    return apiGet<ReadingGoal | null>('/members/me/reading-goal', state.token);
  }

  async function setReadingGoal(payload: ReadingGoalPayload): Promise<ReadingGoal> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPut<ReadingGoal>('/members/me/reading-goal', payload, state.token);
  }

  async function getReadingStreak(): Promise<ReadingStreak> {
    if (!state.token) return { current_streak_days: 0, longest_streak_days: 0 };
    return apiGet<ReadingStreak>('/members/me/reading-streak', state.token);
  }

  async function getLeaderboard(): Promise<LeaderboardEntry[]> {
    if (!state.token) return [];
    return apiGet<LeaderboardEntry[]>('/leaderboard', state.token);
  }

  async function getMyReservations(): Promise<Reservation[]> {
    if (!state.token) return [];
    return apiGet<Reservation[]>('/reservations/me', state.token);
  }

  async function reserveBook(bookId: string): Promise<Reservation> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<Reservation>('/reservations', { book_id: bookId }, state.token);
  }

  async function cancelReservation(reservationId: string): Promise<void> {
    if (!state.token) throw new Error('Not authenticated');
    await apiDelete(`/reservations/${reservationId}`, state.token);
  }

  async function getCommunityPosts(): Promise<CommunityPost[]> {
    if (!state.token) return [];
    return apiGet<CommunityPost[]>('/community/posts', state.token);
  }

  async function createCommunityPost(payload: CommunityPostPayload): Promise<CommunityPost> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<CommunityPost>('/community/posts', payload, state.token);
  }

  async function updateCommunityPost(
    postId: string,
    payload: CommunityPostPayload,
  ): Promise<CommunityPost> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPut<CommunityPost>(`/community/posts/${postId}`, payload, state.token);
  }

  async function deleteCommunityPost(postId: string): Promise<void> {
    if (!state.token) throw new Error('Not authenticated');
    await apiDelete(`/community/posts/${postId}`, state.token);
  }

  async function toggleCommunityLike(postId: string): Promise<CommunityPost> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<CommunityPost>(`/community/posts/${postId}/like`, undefined, state.token);
  }

  async function toggleCommunitySave(postId: string): Promise<CommunityPost> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<CommunityPost>(`/community/posts/${postId}/save`, undefined, state.token);
  }

  async function reportCommunityPost(postId: string): Promise<CommunityPost> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<CommunityPost>(`/community/posts/${postId}/report`, undefined, state.token);
  }

  async function addCommunityComment(
    postId: string,
    payload: AddCommentPayload,
  ): Promise<CommunityPost> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<CommunityPost>(`/community/posts/${postId}/comments`, payload, state.token);
  }

  async function deleteCommunityComment(commentId: string): Promise<void> {
    if (!state.token) throw new Error('Not authenticated');
    await apiDelete(`/community/comments/${commentId}`, state.token);
  }

  async function reportCommunityComment(commentId: string): Promise<void> {
    if (!state.token) throw new Error('Not authenticated');
    await apiPost(`/community/comments/${commentId}/report`, undefined, state.token);
  }

  async function getBannedAuthors(): Promise<BannedAuthor[]> {
    if (!state.token) return [];
    return apiGet<BannedAuthor[]>('/community/banned-authors', state.token);
  }

  async function banCommunityAuthor(userId: string): Promise<void> {
    if (!state.token) throw new Error('Not authenticated');
    await apiPost(`/community/banned-authors/${userId}`, undefined, state.token);
  }

  async function unbanCommunityAuthor(userId: string): Promise<void> {
    if (!state.token) throw new Error('Not authenticated');
    await apiDelete(`/community/banned-authors/${userId}`, state.token);
  }

  async function getSeatSchedule(date: string, hour: number): Promise<SeatSchedule> {
    if (!state.token) throw new Error('Not authenticated');
    return apiGet<SeatSchedule>(
      `/seat-booking/schedule?date=${date}&hour=${hour}`,
      state.token,
    );
  }

  async function bookSeat(payload: SeatSlotPayload): Promise<SeatBookingRecord> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<SeatBookingRecord>('/seat-booking', payload, state.token);
  }

  async function getMySeatBookings(): Promise<SeatBookingRecord[]> {
    if (!state.token) return [];
    return apiGet<SeatBookingRecord[]>('/seat-booking/me', state.token);
  }

  async function cancelSeatBooking(bookingId: string): Promise<void> {
    if (!state.token) throw new Error('Not authenticated');
    await apiDelete(`/seat-booking/${bookingId}`, state.token);
  }

  async function requestSeatNotify(payload: SeatSlotPayload): Promise<void> {
    if (!state.token) throw new Error('Not authenticated');
    await apiPost('/seat-booking/notify', payload, state.token);
  }

  async function getMyNotifications(): Promise<AppNotificationRecord[]> {
    if (!state.token) return [];
    return apiGet<AppNotificationRecord[]>('/notifications/me', state.token);
  }

  async function markNotificationRead(notificationId: string): Promise<AppNotificationRecord> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<AppNotificationRecord>(`/notifications/${notificationId}/read`, undefined, state.token);
  }

  async function markAllNotificationsRead(): Promise<AppNotificationRecord[]> {
    if (!state.token) return [];
    return apiPost<AppNotificationRecord[]>('/notifications/read-all', undefined, state.token);
  }

  async function getBookReviews(bookId: string): Promise<BookReviews> {
    if (!state.token) return { items: [], average_rating: 0, total_reviews: 0, breakdown: [] };
    return apiGet<BookReviews>(`/books/${bookId}/reviews`, state.token);
  }

  async function createReview(bookId: string, payload: ReviewPayload): Promise<Review> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<Review>(`/books/${bookId}/reviews`, payload, state.token);
  }

  async function updateReview(reviewId: string, payload: ReviewPayload): Promise<Review> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPut<Review>(`/reviews/${reviewId}`, payload, state.token);
  }

  async function deleteReview(reviewId: string): Promise<void> {
    if (!state.token) throw new Error('Not authenticated');
    await apiDelete(`/reviews/${reviewId}`, state.token);
  }

  async function getAllReviews(): Promise<Review[]> {
    if (!state.token) return [];
    return apiGet<Review[]>('/reviews', state.token);
  }

  async function getAdminDashboard(): Promise<AdminDashboard> {
    if (!state.token) throw new Error('Not authenticated');
    return apiGet<AdminDashboard>('/admin/dashboard', state.token);
  }

  async function logExpense(payload: ExpensePayload): Promise<void> {
    if (!state.token) throw new Error('Not authenticated');
    await apiPost('/admin/expenses', payload, state.token);
  }

  async function getAuditLog(): Promise<AuditLogEntry[]> {
    if (!state.token) return [];
    return apiGet<AuditLogEntry[]>('/admin/audit-log', state.token);
  }

  async function getRevenueByPlanReport(): Promise<RevenueByPlanReport> {
    if (!state.token) throw new Error('Not authenticated');
    return apiGet<RevenueByPlanReport>('/admin/reports/revenue-by-plan', state.token);
  }

  async function getProfitAndLossReport(): Promise<ProfitAndLossReport> {
    if (!state.token) throw new Error('Not authenticated');
    return apiGet<ProfitAndLossReport>('/admin/reports/profit-and-loss', state.token);
  }

  async function getExpenseBreakdownReport(): Promise<ExpenseBreakdownReport> {
    if (!state.token) throw new Error('Not authenticated');
    return apiGet<ExpenseBreakdownReport>('/admin/reports/expense-breakdown', state.token);
  }

  async function getMembershipGrowthReport(): Promise<MembershipGrowthReport> {
    if (!state.token) throw new Error('Not authenticated');
    return apiGet<MembershipGrowthReport>('/admin/reports/membership-growth', state.token);
  }

  async function getAdminMembers(query: AdminMemberQuery = {}): Promise<AdminMemberListResponse> {
    if (!state.token) return { items: [], total: 0, page: 1, page_size: 20 };
    const params = new URLSearchParams({
      page: String(query.page ?? 1),
      page_size: String(query.page_size ?? 20),
    });
    if (query.search?.trim()) params.set('search', query.search.trim());
    return apiGet<AdminMemberListResponse>(`/admin/members?${params}`, state.token);
  }

  async function getAdminPayments(query: AdminPaymentQuery = {}): Promise<AdminPaymentListResponse> {
    if (!state.token) return { items: [], total: 0, page: 1, page_size: 20 };
    const params = new URLSearchParams({
      page: String(query.page ?? 1),
      page_size: String(query.page_size ?? 20),
    });
    if (query.search?.trim()) params.set('search', query.search.trim());
    return apiGet<AdminPaymentListResponse>(`/admin/payments?${params}`, state.token);
  }

  async function updateAdminMember(
    memberId: string,
    payload: AdminMemberUpdatePayload,
  ): Promise<void> {
    if (!state.token) throw new Error('Not authenticated');
    await apiPut(`/members/${memberId}`, payload, state.token);
  }

  async function createSupportTicket(payload: SupportTicketPayload): Promise<SupportTicketRecord> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<SupportTicketRecord>('/support-tickets', payload, state.token);
  }

  async function getMySupportTickets(): Promise<SupportTicketRecord[]> {
    if (!state.token) return [];
    return apiGet<SupportTicketRecord[]>('/support-tickets/me', state.token);
  }

  async function getStaffSupportTickets(
    ticketStatus?: SupportTicketStatus,
  ): Promise<SupportTicketRecord[]> {
    if (!state.token) return [];
    const query = ticketStatus ? `?status=${ticketStatus}` : '';
    return apiGet<SupportTicketRecord[]>(`/support-tickets${query}`, state.token);
  }

  async function resolveSupportTicket(
    ticketId: string,
    payload: ResolveTicketPayload,
  ): Promise<SupportTicketRecord> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<SupportTicketRecord>(`/support-tickets/${ticketId}/resolve`, payload, state.token);
  }

  async function confirmSupportTicket(ticketId: string): Promise<SupportTicketRecord> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<SupportTicketRecord>(
      `/support-tickets/${ticketId}/confirm`,
      undefined,
      state.token,
    );
  }

  async function reopenSupportTicket(ticketId: string): Promise<SupportTicketRecord> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<SupportTicketRecord>(
      `/support-tickets/${ticketId}/reopen`,
      undefined,
      state.token,
    );
  }

  async function searchMembers(
    query: string,
    options?: MemberSearchOptions,
  ): Promise<MemberSummary[]> {
    if (!state.token || query.trim().length === 0) return [];
    const params = new URLSearchParams({ search: query.trim(), page_size: '6' });
    if (options?.role) params.set('role', options.role);
    if (options?.activeOnly) params.set('active_only', 'true');
    const data = await apiGet<{ items: MemberSummary[] }>(`/members?${params}`, state.token);
    return data.items;
  }

  async function getManagerDashboard(): Promise<ManagerDashboardStats> {
    if (!state.token) throw new Error('Not authenticated');
    return apiGet<ManagerDashboardStats>('/manager/dashboard', state.token);
  }

  async function bookSeatForMember(payload: ManagerSeatBookingPayload): Promise<SeatBookingRecord> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<SeatBookingRecord>('/manager/seat-bookings', payload, state.token);
  }

  async function issueLoanForMember(payload: ManagerLoanPayload): Promise<LoanRecord> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<LoanRecord>('/manager/loans', payload, state.token);
  }

  async function linkGuardian(payload: ManagerGuardianLinkPayload): Promise<void> {
    if (!state.token) throw new Error('Not authenticated');
    await apiPost<undefined>('/manager/guardian-links', payload, state.token);
  }

  async function getPendingReservations(): Promise<PendingReservationRequest[]> {
    if (!state.token) return [];
    return apiGet<PendingReservationRequest[]>('/manager/reservations/pending', state.token);
  }

  async function approveReservation(
    id: string,
    durationDays: LoanDurationDays,
  ): Promise<Reservation> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<Reservation>(
      `/manager/reservations/${id}/approve`,
      { duration_days: durationDays },
      state.token,
    );
  }

  async function rejectReservation(id: string): Promise<Reservation> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<Reservation>(`/manager/reservations/${id}/reject`, undefined, state.token);
  }

  async function getActiveLoans(): Promise<LoanRecord[]> {
    if (!state.token) return [];
    return apiGet<LoanRecord[]>('/loans', state.token);
  }

  async function getLoanHistory(): Promise<LoanRecord[]> {
    if (!state.token) return [];
    return apiGet<LoanRecord[]>('/loans/history', state.token);
  }

  async function getMyLoans(): Promise<LoanRecord[]> {
    if (!state.token) return [];
    return apiGet<LoanRecord[]>('/loans/me', state.token);
  }

  async function getManagerBooks(query: ManagerBookQuery = {}): Promise<ManagerBookListResponse> {
    if (!state.token) throw new Error('Not authenticated');
    const params = new URLSearchParams();
    if (query.search) params.set('search', query.search);
    if (query.page) params.set('page', String(query.page));
    if (query.page_size) params.set('page_size', String(query.page_size));
    return apiGet<ManagerBookListResponse>(`/manager/books?${params}`, state.token);
  }

  async function getBillingRequests(): Promise<BillingRequestRecord[]> {
    if (!state.token) return [];
    return apiGet<BillingRequestRecord[]>('/billing-requests', state.token);
  }

  async function createBillingRequest(
    payload: BillingRequestPayload,
  ): Promise<BillingRequestRecord> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<BillingRequestRecord>('/billing-requests', payload, state.token);
  }

  async function approveBillingRequest(requestId: string): Promise<BillingRequestRecord> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<BillingRequestRecord>(
      `/billing-requests/${requestId}/approve`,
      undefined,
      state.token,
    );
  }

  async function rejectBillingRequest(requestId: string): Promise<BillingRequestRecord> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<BillingRequestRecord>(
      `/billing-requests/${requestId}/reject`,
      undefined,
      state.token,
    );
  }

  async function waiveFine(payload: WaiveFinePayload): Promise<BillingRequestRecord> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<BillingRequestRecord>('/billing-requests/waive-fine', payload, state.token);
  }

  // Public — the Pricing page and Payment page read prices here without needing a session.
  async function getPricingPlans(): Promise<PricingPlan[]> {
    return apiGet<PricingPlan[]>('/pricing-plans', state.token ?? undefined);
  }

  async function updatePricingPlan(
    id: string,
    payload: PricingPlanUpdatePayload,
  ): Promise<PricingPlan> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPatch<PricingPlan>(`/pricing-plans/${id}`, payload, state.token);
  }

  async function createMember(payload: CreateMemberPayload): Promise<CreatedMember> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<CreatedMember>('/members', payload, state.token);
  }

  async function sendAnnouncement(payload: AnnouncementPayload): Promise<AnnouncementResult> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<AnnouncementResult>('/admin/announcements', payload, state.token);
  }

  async function getCoupons(): Promise<Coupon[]> {
    if (!state.token) throw new Error('Not authenticated');
    return apiGet<Coupon[]>('/coupons', state.token);
  }

  async function generateCoupon(payload: CouponPayload): Promise<Coupon> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<Coupon>('/coupons', payload, state.token);
  }

  async function validateCoupon(code: string): Promise<CouponValidation> {
    if (!state.token) throw new Error('Not authenticated');
    return apiGet<CouponValidation>(`/coupons/${encodeURIComponent(code)}/validate`, state.token);
  }

  async function getMembers(query: MemberListQuery = {}): Promise<MemberListResponse> {
    if (!state.token) return { items: [], total: 0, page: 1, page_size: 20 };
    const params = new URLSearchParams({
      page: String(query.page ?? 1),
      page_size: String(query.page_size ?? 20),
    });
    if (query.search?.trim()) params.set('search', query.search.trim());
    if (query.role) params.set('role', query.role);
    if (query.active_only) params.set('active_only', 'true');
    return apiGet<MemberListResponse>(`/members?${params}`, state.token);
  }

  async function getPermissionRequests(): Promise<PermissionRequestRecord[]> {
    if (!state.token) return [];
    return apiGet<PermissionRequestRecord[]>('/permission-requests', state.token);
  }

  async function createPermissionRequest(
    payload: PermissionRequestPayload,
  ): Promise<PermissionRequestRecord> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<PermissionRequestRecord>('/permission-requests', payload, state.token);
  }

  async function grantPermissionRequest(id: string): Promise<PermissionRequestRecord> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<PermissionRequestRecord>(`/permission-requests/${id}/grant`, undefined, state.token);
  }

  async function denyPermissionRequest(id: string): Promise<PermissionRequestRecord> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<PermissionRequestRecord>(`/permission-requests/${id}/deny`, undefined, state.token);
  }

  async function createLoan(payload: LoanPayload): Promise<LoanRecord> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<LoanRecord>('/loans', payload, state.token);
  }

  async function getLoanFines(): Promise<LoanRecord[]> {
    if (!state.token) return [];
    return apiGet<LoanRecord[]>('/loans/fines', state.token);
  }

  async function returnLoan(id: string): Promise<LoanRecord> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<LoanRecord>(`/loans/${id}/return`, undefined, state.token);
  }

  async function markFinePaid(id: string): Promise<LoanRecord> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<LoanRecord>(`/loans/${id}/mark-fine-paid`, undefined, state.token);
  }

  async function sendFineReminder(id: string): Promise<void> {
    if (!state.token) throw new Error('Not authenticated');
    await apiPost(`/loans/${id}/remind`, undefined, state.token);
  }

  async function getBookRecords(): Promise<BookRecordEntry[]> {
    if (!state.token) return [];
    return apiGet<BookRecordEntry[]>('/book-records', state.token);
  }

  async function createBookRecord(payload: BookRecordPayload): Promise<BookRecordEntry> {
    if (!state.token) throw new Error('Not authenticated');
    return apiPost<BookRecordEntry>('/book-records', payload, state.token);
  }

  async function getITHeadDashboard(): Promise<ITHeadDashboard> {
    if (!state.token) throw new Error('Not authenticated');
    return apiGet<ITHeadDashboard>('/it-head/dashboard', state.token);
  }

  async function refreshAccessToken(): Promise<string | null> {
    if (!state.refreshToken) return null;
    try {
      const data = await apiPost<TokenResponse>('/auth/refresh', {
        refresh_token: state.refreshToken,
      });
      applySession(data, state.needsProfileCompletion, state.postAuthRedirect);
      return data.access_token;
    } catch {
      setState(SIGNED_OUT);
      return null;
    }
  }

  // Re-registers whenever the tokens change so the handler api.ts calls always closes
  // over the current refreshToken, not a stale one from an earlier render.
  useEffect(() => {
    registerRefreshHandler(refreshAccessToken);
    return () => registerRefreshHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.token, state.refreshToken]);

  function logout() {
    if (state.token) {
      apiPost('/auth/logout', undefined, state.token).catch(() => {});
    }
    setState(SIGNED_OUT);
  }

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        loginWithCredentials,
        loginWithGoogleToken,
        registerAccount,
        forgotPassword,
        resetPassword,
        completeProfile,
        updateProfile,
        createPayment,
        payAtLibrary,
        deleteAccount,
        getMembership,
        getMyPayments,
        getGuardianChildren,
        payChildFines,
        renewChildSubscription,
        bookSeatForChild,
        requestSeatNotifyForChild,
        getMyReadingProgress,
        getReadingGoal,
        setReadingGoal,
        getReadingStreak,
        getLeaderboard,
        getMyReservations,
        reserveBook,
        cancelReservation,
        getCommunityPosts,
        createCommunityPost,
        updateCommunityPost,
        deleteCommunityPost,
        toggleCommunityLike,
        toggleCommunitySave,
        reportCommunityPost,
        addCommunityComment,
        deleteCommunityComment,
        reportCommunityComment,
        getBannedAuthors,
        banCommunityAuthor,
        unbanCommunityAuthor,
        getSeatSchedule,
        bookSeat,
        getMySeatBookings,
        cancelSeatBooking,
        requestSeatNotify,
        getMyNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        getBookReviews,
        createReview,
        updateReview,
        deleteReview,
        getAllReviews,
        getAdminDashboard,
        logExpense,
        getAuditLog,
        getRevenueByPlanReport,
        getProfitAndLossReport,
        getExpenseBreakdownReport,
        getMembershipGrowthReport,
        getAdminMembers,
        updateAdminMember,
        getAdminPayments,
        createSupportTicket,
        getMySupportTickets,
        getStaffSupportTickets,
        resolveSupportTicket,
        confirmSupportTicket,
        reopenSupportTicket,
        searchMembers,
        getManagerDashboard,
        bookSeatForMember,
        issueLoanForMember,
        getPendingReservations,
        approveReservation,
        rejectReservation,
        getActiveLoans,
        getLoanHistory,
        getMyLoans,
        linkGuardian,
        getManagerBooks,
        getBillingRequests,
        createBillingRequest,
        approveBillingRequest,
        rejectBillingRequest,
        waiveFine,
        getPricingPlans,
        updatePricingPlan,
        createMember,
        sendAnnouncement,
        getCoupons,
        generateCoupon,
        validateCoupon,
        getMembers,
        getPermissionRequests,
        createPermissionRequest,
        grantPermissionRequest,
        denyPermissionRequest,
        createLoan,
        getLoanFines,
        returnLoan,
        markFinePaid,
        sendFineReminder,
        getITHeadDashboard,
        getBookRecords,
        createBookRecord,
        clearPostAuthRedirect,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
