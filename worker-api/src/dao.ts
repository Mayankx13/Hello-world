/**
 * LIQO data-access layer (DAO) — typed, parameterised queries over the D1
 * schema (see schema.sql). Thin async functions + row-shape interfaces, built
 * on the shared D1Like interface so the worker and any tooling share one source
 * of truth for table access.
 *
 * Conventions:
 *   • Row interfaces are snake_case — they mirror the SQL columns verbatim
 *     (handlers map to the camelCase API shapes).
 *   • "*Input" types are the write payloads; field coercion goes through the
 *     shared str/num/boolNum/jstr helpers (null-preserving).
 *   • PURE: never read the clock here. Callers pass `nowISO`
 *     (new Date().toISOString()) for any timestamp the DB doesn't default.
 *   • Parameterised binds ONLY — no string interpolation of values.
 */
import { type D1Like, str, num, boolNum, jstr } from "../../src/shared/d1";

/** Shape of D1's run() meta we rely on for surrogate-key inserts. */
interface RunMeta {
  meta?: { last_row_id?: number };
}
async function insertId(stmt: { run(): Promise<unknown> }): Promise<number> {
  const res = (await stmt.run()) as RunMeta;
  return res.meta?.last_row_id ?? 0;
}

// ===========================================================================
// Row shapes
// ===========================================================================

export interface StoreRow {
  store_id: string;
  name: string;
  label: string | null;
  address: string | null;
  region: string | null;
  phone: string | null;
  pilot: number;
  active: number;
  created_at: string;
}

export interface EmployeeRow {
  employee_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: "admin" | "manager" | "salesperson";
  store_id: string | null;
  title: string | null;
  status: "active" | "inactive";
  pass_hash: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface AttendanceRow {
  id: number;
  employee_id: string;
  store_id: string | null;
  date: string;
  status: "present" | "absent" | "half_day" | "leave" | "week_off" | "holiday";
  check_in: string | null;
  check_out: string | null;
  note: string | null;
  marked_by: string | null;
  created_at: string;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  half_day: number;
  leave: number;
  total: number;
}

export interface LeaveRow {
  id: number;
  employee_id: string;
  type: "casual" | "sick" | "earned" | "unpaid";
  from_date: string;
  to_date: string;
  days: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approver_id: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface MilestoneRow {
  milestone_id: string;
  name: string;
  metric: "items_per_bill" | "bills" | "reco_rate" | "revenue" | "points";
  threshold: number;
  period: "weekly" | "monthly" | "once";
  reward_inr: number;
  active: number;
  created_at: string;
}

export interface IncentiveRow {
  id: number;
  employee_id: string;
  milestone_id: string | null;
  period: string;
  points: number;
  amount_inr: number;
  reason: string | null;
  status: "pending" | "credited" | "settled" | "void";
  created_at: string;
  settled_at: string | null;
}

export interface FeedbackRow {
  id: number;
  employee_id: string | null;
  store_id: string | null;
  category: "store" | "management" | "product" | "customer" | "process" | "other";
  rating: number | null;
  message: string | null;
  anonymous: number;
  status: "open" | "reviewed" | "actioned" | "closed";
  created_at: string;
}

export interface CustomerRow {
  customer_id: string;
  phone: string;
  name: string | null;
  email: string | null;
  consent: number;
  premium_tier: "value" | "mainstream" | "premium" | "luxury" | null;
  preferred_payment: "cash" | "card" | "emi" | "upi" | "exchange" | null;
  home_store_id: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface BrandPrefRow {
  id: number;
  customer_id: string;
  brand: string;
  category: string | null;
  affinity: "likes" | "owns" | "avoid";
  created_at: string;
}

export interface CustomerEventRow {
  event_id: number;
  customer_id: string;
  type: "visit" | "intent" | "quote" | "recommendation" | "whatsapp" | "call" | "exchange_enquiry" | "purchase" | "service";
  category: string | null;
  brand: string | null;
  budget_band: string | null;
  sku: string | null;
  store_id: string | null;
  employee_id: string | null;
  session_id: string | null;
  amount: number | null;
  meta: string | null;
  ts: string;
  created_at: string;
}

export interface SaleRow {
  sale_id: number;
  bill_no: string | null;
  customer_id: string | null;
  employee_id: string | null;
  store_id: string | null;
  session_id: string | null;
  total: number;
  items_count: number;
  payment_method: "cash" | "card" | "emi" | "upi" | "exchange" | null;
  exchange: number;
  source: "assistant" | "walk_in";
  ts: string;
  created_at: string;
}

export interface SaleItemRow {
  id: number;
  sale_id: number;
  sku: string | null;
  brand: string | null;
  category: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
  tier: "good" | "better" | "best" | "stretch" | "attach" | null;
  recommended: number;
}

export interface OfferRow {
  offer_id: string;
  title: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  sku: string | null;
  store_id: string | null;
  discount_pct: number | null;
  offer_price: number | null;
  image: string | null;
  starts_at: string;
  ends_at: string;
  boost_weight: number;
  active: number;
  created_by: string | null;
  created_at: string;
}

/** A live offer with boost_weight>0, reduced to what the engine needs to nudge. */
export interface BoostRow {
  brand: string | null;
  category: string | null;
  sku: string | null;
  weight: number;
}

export interface DemandRequestRow {
  id: number;
  store_id: string | null;
  customer_id: string | null;
  employee_id: string | null;
  category: string | null;
  brand: string | null;
  sku: string | null;
  budget_band: string | null;
  note: string | null;
  status: "open" | "sourced" | "fulfilled" | "dropped";
  ts: string;
  created_at: string;
}

/** v_customer_360 row — the recall rollup. */
export interface Customer360Row {
  customer_id: string;
  phone: string;
  name: string | null;
  premium_tier: string | null;
  preferred_payment: string | null;
  home_store_id: string | null;
  last_seen_at: string | null;
  purchases: number;
  lifetime_value: number;
  touchpoints: number;
  brands: string | null;
}

/** v_store_daily row. */
export interface StoreDailyRow {
  store_id: string;
  day: string;
  bills: number;
  revenue: number;
  items: number;
  items_per_bill: number;
  recommended_rate: number | null;
}

/** v_demand_category row. */
export interface DemandCategoryRow {
  store_id: string | null;
  category: string | null;
  suggested: number;
  sold: number;
  conversion: number | null;
}

/** v_employee_month row. */
export interface EmployeeMonthRow {
  employee_id: string;
  name: string;
  store_id: string | null;
  month: string | null;
  bills: number;
  items_per_bill: number | null;
  incentive_inr: number;
}

// ===========================================================================
// Write payload types  (caller-facing; coerced to binds internally)
// ===========================================================================

export interface EmployeeInput {
  employeeId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: "admin" | "manager" | "salesperson";
  storeId?: string | null;
  title?: string | null;
  status?: "active" | "inactive";
  passHash?: string | null;
  joinedAt?: string | null;
  /** ISO timestamp for updated_at (caller-supplied). */
  nowISO: string;
}

export interface AttendanceInput {
  employeeId: string;
  storeId?: string | null;
  date: string;
  status: AttendanceRow["status"];
  checkIn?: string | null;
  checkOut?: string | null;
  note?: string | null;
  markedBy?: string | null;
}

export interface LeaveInput {
  employeeId: string;
  type: LeaveRow["type"];
  fromDate: string;
  toDate: string;
  days?: number;
  reason?: string | null;
}

export interface IncentiveInput {
  employeeId: string;
  milestoneId?: string | null;
  period: string;
  points?: number;
  amountInr?: number;
  reason?: string | null;
  status?: IncentiveRow["status"];
}

export interface FeedbackInput {
  employeeId?: string | null;
  storeId?: string | null;
  category: FeedbackRow["category"];
  rating?: number | null;
  message?: string | null;
  anonymous?: boolean;
}

export interface CustomerInput {
  phone: string;
  name?: string | null;
  email?: string | null;
  consent?: boolean;
  premiumTier?: CustomerRow["premium_tier"];
  preferredPayment?: CustomerRow["preferred_payment"];
  homeStoreId?: string | null;
  /** ISO timestamp; sets first_seen_at on insert, last_seen_at + updated_at always. */
  nowISO: string;
}

export interface CustomerEventInput {
  customerId: string;
  type: CustomerEventRow["type"];
  category?: string | null;
  brand?: string | null;
  budgetBand?: string | null;
  sku?: string | null;
  storeId?: string | null;
  employeeId?: string | null;
  sessionId?: string | null;
  amount?: number | null;
  meta?: unknown;
  ts: string;
}

export interface BrandPrefInput {
  customerId: string;
  brand: string;
  category?: string | null;
  affinity?: BrandPrefRow["affinity"];
}

export interface OfferInput {
  offerId: string;
  title: string;
  description?: string | null;
  brand?: string | null;
  category?: string | null;
  sku?: string | null;
  storeId?: string | null;
  discountPct?: number | null;
  offerPrice?: number | null;
  image?: string | null;
  startsAt: string;
  endsAt: string;
  boostWeight?: number;
  active?: boolean;
  createdBy?: string | null;
}

export interface SaleHeaderInput {
  billNo?: string | null;
  customerId?: string | null;
  employeeId?: string | null;
  storeId?: string | null;
  sessionId?: string | null;
  paymentMethod?: SaleRow["payment_method"];
  exchange?: boolean;
  source?: SaleRow["source"];
  ts: string;
}

export interface SaleItemInput {
  sku?: string | null;
  brand?: string | null;
  category?: string | null;
  qty?: number;
  unitPrice?: number;
  lineTotal?: number;
  tier?: SaleItemRow["tier"];
  recommended?: boolean;
}

export interface DemandRequestInput {
  storeId?: string | null;
  customerId?: string | null;
  employeeId?: string | null;
  category?: string | null;
  brand?: string | null;
  sku?: string | null;
  budgetBand?: string | null;
  note?: string | null;
  ts: string;
}

/** getCustomerByPhone bundle: the customer plus their tagged context. */
export interface CustomerBundle {
  customer: CustomerRow;
  prefs: BrandPrefRow[];
  recentEvents: CustomerEventRow[];
  purchases: SaleRow[];
}

// ===========================================================================
// stores
// ===========================================================================
export async function listStores(db: D1Like): Promise<StoreRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM stores ORDER BY name")
    .all<StoreRow>();
  return results;
}

// ===========================================================================
// employees
// ===========================================================================
export async function listEmployees(
  db: D1Like,
  where: { storeId?: string; role?: string } = {},
): Promise<EmployeeRow[]> {
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (where.storeId) {
    clauses.push("store_id = ?");
    binds.push(where.storeId);
  }
  if (where.role) {
    clauses.push("role = ?");
    binds.push(where.role);
  }
  const sql =
    "SELECT * FROM employees" +
    (clauses.length ? " WHERE " + clauses.join(" AND ") : "") +
    " ORDER BY name";
  const { results } = await db.prepare(sql).bind(...binds).all<EmployeeRow>();
  return results;
}

export async function getEmployee(db: D1Like, id: string): Promise<EmployeeRow | null> {
  return db
    .prepare("SELECT * FROM employees WHERE employee_id = ?")
    .bind(id)
    .first<EmployeeRow>();
}

/** Look up an ACTIVE employee for login by email (case-insensitive) or phone. */
export async function getEmployeeByLogin(db: D1Like, ident: string): Promise<EmployeeRow | null> {
  const id = ident.trim();
  return db
    .prepare("SELECT * FROM employees WHERE status='active' AND (lower(email)=lower(?) OR phone=?) LIMIT 1")
    .bind(id, id)
    .first<EmployeeRow>();
}

/** Set a new password hash for an employee (used by self-service change-password). */
export async function setEmployeePassword(db: D1Like, employeeId: string, passHash: string): Promise<void> {
  await db
    .prepare("UPDATE employees SET pass_hash = ?, updated_at = ? WHERE employee_id = ?")
    .bind(passHash, new Date().toISOString(), employeeId)
    .run();
}

/** Insert-or-update by employee_id (natural PK). Sets updated_at = nowISO. */
export async function upsertEmployee(db: D1Like, emp: EmployeeInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO employees
         (employee_id, name, email, phone, role, store_id, title, status, pass_hash, joined_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(employee_id) DO UPDATE SET
         name       = excluded.name,
         email      = excluded.email,
         phone      = excluded.phone,
         role       = excluded.role,
         store_id   = excluded.store_id,
         title      = excluded.title,
         status     = excluded.status,
         pass_hash  = COALESCE(excluded.pass_hash, employees.pass_hash),
         joined_at  = COALESCE(excluded.joined_at, employees.joined_at),
         updated_at = excluded.updated_at`,
    )
    .bind(
      emp.employeeId,
      emp.name,
      str(emp.email),
      str(emp.phone),
      emp.role,
      str(emp.storeId),
      str(emp.title),
      emp.status ?? "active",
      str(emp.passHash),
      str(emp.joinedAt),
      emp.nowISO,
    )
    .run();
}

export async function setEmployeeStatus(
  db: D1Like,
  id: string,
  status: "active" | "inactive",
): Promise<void> {
  await db
    .prepare("UPDATE employees SET status = ? WHERE employee_id = ?")
    .bind(status, id)
    .run();
}

// ===========================================================================
// attendance
// ===========================================================================
export async function listAttendance(
  db: D1Like,
  where: { storeId?: string; date?: string; employeeId?: string } = {},
): Promise<AttendanceRow[]> {
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (where.storeId) {
    clauses.push("store_id = ?");
    binds.push(where.storeId);
  }
  if (where.date) {
    clauses.push("date = ?");
    binds.push(where.date);
  }
  if (where.employeeId) {
    clauses.push("employee_id = ?");
    binds.push(where.employeeId);
  }
  const sql =
    "SELECT * FROM attendance" +
    (clauses.length ? " WHERE " + clauses.join(" AND ") : "") +
    " ORDER BY date DESC, employee_id";
  const { results } = await db.prepare(sql).bind(...binds).all<AttendanceRow>();
  return results;
}

/** Upsert one day's attendance (UNIQUE employee_id,date). */
export async function markAttendance(db: D1Like, rec: AttendanceInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO attendance
         (employee_id, store_id, date, status, check_in, check_out, note, marked_by)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(employee_id, date) DO UPDATE SET
         store_id  = excluded.store_id,
         status    = excluded.status,
         check_in  = excluded.check_in,
         check_out = excluded.check_out,
         note      = excluded.note,
         marked_by = excluded.marked_by`,
    )
    .bind(
      rec.employeeId,
      str(rec.storeId),
      rec.date,
      rec.status,
      str(rec.checkIn),
      str(rec.checkOut),
      str(rec.note),
      str(rec.markedBy),
    )
    .run();
}

export async function attendanceSummary(
  db: D1Like,
  storeId: string,
  date: string,
): Promise<AttendanceSummary> {
  const row = await db
    .prepare(
      `SELECT
         SUM(status = 'present')  AS present,
         SUM(status = 'absent')   AS absent,
         SUM(status = 'half_day') AS half_day,
         SUM(status = 'leave')    AS leave,
         COUNT(*)                 AS total
       FROM attendance WHERE store_id = ? AND date = ?`,
    )
    .bind(storeId, date)
    .first<{ present: number | null; absent: number | null; half_day: number | null; leave: number | null; total: number | null }>();
  return {
    present: row?.present ?? 0,
    absent: row?.absent ?? 0,
    half_day: row?.half_day ?? 0,
    leave: row?.leave ?? 0,
    total: row?.total ?? 0,
  };
}

// ===========================================================================
// leaves
// ===========================================================================
export async function listLeaves(
  db: D1Like,
  where: { employeeId?: string; status?: string; storeId?: string } = {},
): Promise<LeaveRow[]> {
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (where.employeeId) {
    clauses.push("l.employee_id = ?");
    binds.push(where.employeeId);
  }
  if (where.status) {
    clauses.push("l.status = ?");
    binds.push(where.status);
  }
  if (where.storeId) {
    // store scope is via the employee (leaves carry no store_id).
    clauses.push("e.store_id = ?");
    binds.push(where.storeId);
  }
  const sql =
    "SELECT l.* FROM leaves l JOIN employees e ON e.employee_id = l.employee_id" +
    (clauses.length ? " WHERE " + clauses.join(" AND ") : "") +
    " ORDER BY l.from_date DESC";
  const { results } = await db.prepare(sql).bind(...binds).all<LeaveRow>();
  return results;
}

export async function createLeave(db: D1Like, rec: LeaveInput): Promise<number> {
  return insertId(
    db
      .prepare(
        `INSERT INTO leaves (employee_id, type, from_date, to_date, days, reason)
         VALUES (?,?,?,?,?,?)`,
      )
      .bind(
        rec.employeeId,
        rec.type,
        rec.fromDate,
        rec.toDate,
        rec.days ?? 1,
        str(rec.reason),
      ),
  );
}

/** Approve / reject a leave; stamps approver + decided_at = nowISO. */
export async function decideLeave(
  db: D1Like,
  id: number,
  status: "approved" | "rejected" | "cancelled",
  approverId: string,
  nowISO: string,
): Promise<void> {
  await db
    .prepare(
      "UPDATE leaves SET status = ?, approver_id = ?, decided_at = ? WHERE id = ?",
    )
    .bind(status, approverId, nowISO, id)
    .run();
}

// ===========================================================================
// milestones
// ===========================================================================
export async function listMilestones(db: D1Like): Promise<MilestoneRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM milestones ORDER BY active DESC, name")
    .all<MilestoneRow>();
  return results;
}

// ===========================================================================
// incentives
// ===========================================================================
export async function listIncentives(
  db: D1Like,
  where: { employeeId?: string; period?: string } = {},
): Promise<IncentiveRow[]> {
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (where.employeeId) {
    clauses.push("employee_id = ?");
    binds.push(where.employeeId);
  }
  if (where.period) {
    clauses.push("period = ?");
    binds.push(where.period);
  }
  const sql =
    "SELECT * FROM incentives" +
    (clauses.length ? " WHERE " + clauses.join(" AND ") : "") +
    " ORDER BY created_at DESC";
  const { results } = await db.prepare(sql).bind(...binds).all<IncentiveRow>();
  return results;
}

export async function addIncentive(db: D1Like, rec: IncentiveInput): Promise<number> {
  return insertId(
    db
      .prepare(
        `INSERT INTO incentives
           (employee_id, milestone_id, period, points, amount_inr, reason, status)
         VALUES (?,?,?,?,?,?,?)`,
      )
      .bind(
        rec.employeeId,
        str(rec.milestoneId),
        rec.period,
        rec.points ?? 0,
        rec.amountInr ?? 0,
        str(rec.reason),
        rec.status ?? "credited",
      ),
  );
}

/** Sum of credited+settled incentive amount for an employee (display credit). */
export async function incentiveTotal(db: D1Like, employeeId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(amount_inr), 0) AS total
       FROM incentives WHERE employee_id = ? AND status IN ('credited','settled')`,
    )
    .bind(employeeId)
    .first<{ total: number }>();
  return row?.total ?? 0;
}

// ===========================================================================
// feedback
// ===========================================================================
export async function listFeedback(
  db: D1Like,
  where: { storeId?: string } = {},
): Promise<FeedbackRow[]> {
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (where.storeId) {
    clauses.push("store_id = ?");
    binds.push(where.storeId);
  }
  const sql =
    "SELECT * FROM feedback" +
    (clauses.length ? " WHERE " + clauses.join(" AND ") : "") +
    " ORDER BY created_at DESC";
  const { results } = await db.prepare(sql).bind(...binds).all<FeedbackRow>();
  return results;
}

/** Add feedback. Anonymous rows force employee_id NULL (schema CHECK). */
export async function addFeedback(db: D1Like, rec: FeedbackInput): Promise<number> {
  const anon = rec.anonymous ? 1 : 0;
  return insertId(
    db
      .prepare(
        `INSERT INTO feedback (employee_id, store_id, category, rating, message, anonymous)
         VALUES (?,?,?,?,?,?)`,
      )
      .bind(
        anon ? null : str(rec.employeeId),
        str(rec.storeId),
        rec.category,
        num(rec.rating),
        str(rec.message),
        anon,
      ),
  );
}

// ===========================================================================
// customers
// ===========================================================================
/** Recall by phone: the customer + brand prefs + last 20 events + purchases. */
export async function getCustomerByPhone(db: D1Like, phone: string): Promise<CustomerBundle | null> {
  const customer = await db
    .prepare("SELECT * FROM customers WHERE phone = ?")
    .bind(phone)
    .first<CustomerRow>();
  if (!customer) return null;

  const [prefs, recentEvents, purchases] = await Promise.all([
    db
      .prepare("SELECT * FROM customer_brand_prefs WHERE customer_id = ? ORDER BY created_at")
      .bind(customer.customer_id)
      .all<BrandPrefRow>(),
    db
      .prepare("SELECT * FROM customer_events WHERE customer_id = ? ORDER BY ts DESC LIMIT 20")
      .bind(customer.customer_id)
      .all<CustomerEventRow>(),
    db
      .prepare("SELECT * FROM sales WHERE customer_id = ? ORDER BY ts DESC")
      .bind(customer.customer_id)
      .all<SaleRow>(),
  ]);

  return {
    customer,
    prefs: prefs.results,
    recentEvents: recentEvents.results,
    purchases: purchases.results,
  };
}

/**
 * Upsert a customer keyed by phone. customer_id is derived 'c-'+phone.
 * first_seen_at is set only on insert; last_seen_at + updated_at always refresh.
 */
export async function upsertCustomer(db: D1Like, rec: CustomerInput): Promise<string> {
  const customerId = "c-" + rec.phone;
  await db
    .prepare(
      `INSERT INTO customers
         (customer_id, phone, name, email, consent, premium_tier, preferred_payment,
          home_store_id, first_seen_at, last_seen_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(phone) DO UPDATE SET
         name              = COALESCE(excluded.name, customers.name),
         email             = COALESCE(excluded.email, customers.email),
         consent           = excluded.consent,
         premium_tier      = COALESCE(excluded.premium_tier, customers.premium_tier),
         preferred_payment = COALESCE(excluded.preferred_payment, customers.preferred_payment),
         home_store_id     = COALESCE(excluded.home_store_id, customers.home_store_id),
         last_seen_at      = excluded.last_seen_at,
         updated_at        = excluded.updated_at`,
    )
    .bind(
      customerId,
      rec.phone,
      str(rec.name),
      str(rec.email),
      boolNum(rec.consent ?? false),
      str(rec.premiumTier),
      str(rec.preferredPayment),
      str(rec.homeStoreId),
      rec.nowISO, // first_seen_at (insert only — preserved by ON CONFLICT)
      rec.nowISO, // last_seen_at
      rec.nowISO, // updated_at
    )
    .run();
  return customerId;
}

export async function addCustomerEvent(db: D1Like, rec: CustomerEventInput): Promise<number> {
  return insertId(
    db
      .prepare(
        `INSERT INTO customer_events
           (customer_id, type, category, brand, budget_band, sku, store_id, employee_id,
            session_id, amount, meta, ts)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        rec.customerId,
        rec.type,
        str(rec.category),
        str(rec.brand),
        str(rec.budgetBand),
        str(rec.sku),
        str(rec.storeId),
        str(rec.employeeId),
        str(rec.sessionId),
        num(rec.amount),
        jstr(rec.meta),
        rec.ts,
      ),
  );
}

/** Tag a brand preference; idempotent on (customer,brand,category,affinity). */
export async function addBrandPref(db: D1Like, rec: BrandPrefInput): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO customer_brand_prefs (customer_id, brand, category, affinity)
       VALUES (?,?,?,?)`,
    )
    .bind(rec.customerId, rec.brand, str(rec.category), rec.affinity ?? "likes")
    .run();
}

/** DPDP erase by phone — cascades to events, brand prefs (sales SET NULL). */
export async function eraseCustomer(db: D1Like, phone: string): Promise<void> {
  await db.prepare("DELETE FROM customers WHERE phone = ?").bind(phone).run();
}

// ===========================================================================
// offers
// ===========================================================================
/** Offers live at nowISO (active, in window) for a store (NULL store = all). */
export async function listLiveOffers(
  db: D1Like,
  where: { storeId?: string; nowISO: string },
): Promise<OfferRow[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM offers
       WHERE active = 1 AND starts_at <= ? AND ends_at >= ?
         AND (store_id IS NULL OR store_id = ?)
       ORDER BY boost_weight DESC, ends_at`,
    )
    .bind(where.nowISO, where.nowISO, where.storeId ?? null)
    .all<OfferRow>();
  return results;
}

export async function listAllOffers(db: D1Like): Promise<OfferRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM offers ORDER BY starts_at DESC")
    .all<OfferRow>();
  return results;
}

export async function createOffer(db: D1Like, rec: OfferInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO offers
         (offer_id, title, description, brand, category, sku, store_id, discount_pct,
          offer_price, image, starts_at, ends_at, boost_weight, active, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      rec.offerId,
      rec.title,
      str(rec.description),
      str(rec.brand),
      str(rec.category),
      str(rec.sku),
      str(rec.storeId),
      num(rec.discountPct),
      num(rec.offerPrice),
      str(rec.image),
      rec.startsAt,
      rec.endsAt,
      rec.boostWeight ?? 0,
      boolNum(rec.active ?? true),
      str(rec.createdBy),
    )
    .run();
}

export async function deleteOffer(db: D1Like, id: string): Promise<void> {
  await db.prepare("DELETE FROM offers WHERE offer_id = ?").bind(id).run();
}

/** Live offers with a positive engine boost, reduced to the nudge tuple. */
export async function activeBoosts(
  db: D1Like,
  where: { storeId: string; nowISO: string },
): Promise<BoostRow[]> {
  const { results } = await db
    .prepare(
      `SELECT brand, category, sku, boost_weight AS weight
       FROM offers
       WHERE active = 1 AND boost_weight > 0
         AND starts_at <= ? AND ends_at >= ?
         AND (store_id IS NULL OR store_id = ?)
       ORDER BY boost_weight DESC`,
    )
    .bind(where.nowISO, where.nowISO, where.storeId)
    .all<BoostRow>();
  return results;
}

// ===========================================================================
// sales
// ===========================================================================
/**
 * Create a bill: insert the header (with derived total/items_count), then
 * batch-insert its lines. Returns the new sale_id.
 */
export async function createSale(
  db: D1Like,
  header: SaleHeaderInput,
  items: SaleItemInput[],
): Promise<number> {
  const itemsCount = items.reduce((n, it) => n + (it.qty ?? 1), 0);
  const total = items.reduce((sum, it) => sum + (it.lineTotal ?? (it.unitPrice ?? 0) * (it.qty ?? 1)), 0);

  const saleId = await insertId(
    db
      .prepare(
        `INSERT INTO sales
           (bill_no, customer_id, employee_id, store_id, session_id, total, items_count,
            payment_method, exchange, source, ts)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        str(header.billNo),
        str(header.customerId),
        str(header.employeeId),
        str(header.storeId),
        str(header.sessionId),
        total,
        itemsCount,
        str(header.paymentMethod),
        boolNum(header.exchange ?? false),
        header.source ?? "assistant",
        header.ts,
      ),
  );

  if (items.length) {
    const stmt = db.prepare(
      `INSERT INTO sale_items
         (sale_id, sku, brand, category, qty, unit_price, line_total, tier, recommended)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    );
    await db.batch(
      items.map((it) => {
        const qty = it.qty ?? 1;
        const unit = it.unitPrice ?? 0;
        return stmt.bind(
          saleId,
          str(it.sku),
          str(it.brand),
          str(it.category),
          qty,
          unit,
          it.lineTotal ?? unit * qty,
          str(it.tier),
          boolNum(it.recommended ?? false),
        );
      }),
    );
  }
  return saleId;
}

export async function salesByCustomer(db: D1Like, customerId: string): Promise<SaleRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM sales WHERE customer_id = ? ORDER BY ts DESC")
    .bind(customerId)
    .all<SaleRow>();
  return results;
}

// ===========================================================================
// demand
// ===========================================================================
export async function listDemand(
  db: D1Like,
  where: { storeId?: string } = {},
): Promise<DemandRequestRow[]> {
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (where.storeId) {
    clauses.push("store_id = ?");
    binds.push(where.storeId);
  }
  const sql =
    "SELECT * FROM demand_requests" +
    (clauses.length ? " WHERE " + clauses.join(" AND ") : "") +
    " ORDER BY ts DESC";
  const { results } = await db.prepare(sql).bind(...binds).all<DemandRequestRow>();
  return results;
}

export async function addDemandRequest(db: D1Like, rec: DemandRequestInput): Promise<number> {
  return insertId(
    db
      .prepare(
        `INSERT INTO demand_requests
           (store_id, customer_id, employee_id, category, brand, sku, budget_band, note, ts)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        str(rec.storeId),
        str(rec.customerId),
        str(rec.employeeId),
        str(rec.category),
        str(rec.brand),
        str(rec.sku),
        str(rec.budgetBand),
        str(rec.note),
        rec.ts,
      ),
  );
}

// ===========================================================================
// analytics  (read-only views)
// ===========================================================================
/** v_store_daily, optionally one store, last N days (by day string). */
export async function storeDaily(
  db: D1Like,
  where: { storeId?: string; days?: number } = {},
): Promise<StoreDailyRow[]> {
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (where.storeId) {
    clauses.push("store_id = ?");
    binds.push(where.storeId);
  }
  let sql =
    "SELECT * FROM v_store_daily" +
    (clauses.length ? " WHERE " + clauses.join(" AND ") : "") +
    " ORDER BY day DESC, store_id";
  if (where.days != null) {
    sql += " LIMIT ?";
    binds.push(where.days);
  }
  const { results } = await db.prepare(sql).bind(...binds).all<StoreDailyRow>();
  return results;
}

export async function demandByCategory(
  db: D1Like,
  where: { storeId?: string } = {},
): Promise<DemandCategoryRow[]> {
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (where.storeId) {
    clauses.push("store_id = ?");
    binds.push(where.storeId);
  }
  const sql =
    "SELECT * FROM v_demand_category" +
    (clauses.length ? " WHERE " + clauses.join(" AND ") : "") +
    " ORDER BY suggested DESC";
  const { results } = await db.prepare(sql).bind(...binds).all<DemandCategoryRow>();
  return results;
}

export async function employeeMonth(
  db: D1Like,
  where: { month?: string; storeId?: string } = {},
): Promise<EmployeeMonthRow[]> {
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (where.month) {
    clauses.push("month = ?");
    binds.push(where.month);
  }
  if (where.storeId) {
    clauses.push("store_id = ?");
    binds.push(where.storeId);
  }
  const sql =
    "SELECT * FROM v_employee_month" +
    (clauses.length ? " WHERE " + clauses.join(" AND ") : "") +
    " ORDER BY bills DESC, name";
  const { results } = await db.prepare(sql).bind(...binds).all<EmployeeMonthRow>();
  return results;
}

// ===========================================================================
// Audit log — write one row per state-changing request; read (admin) to review.
// ===========================================================================
export interface AuditEntry {
  actorId: string | null;
  actorRole: string | null;
  method: string;
  path: string;
  resource: string | null;
  resourceId: string | null;
  status: number;
  outcome: "ok" | "denied" | "error";
  ip: string | null;
  ms: number;
}
export async function writeAudit(db: D1Like, e: AuditEntry): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_log (actor_id, actor_role, method, path, resource, resource_id, status, outcome, ip, ms)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      str(e.actorId), str(e.actorRole), e.method, e.path, str(e.resource),
      str(e.resourceId), e.status, e.outcome, str(e.ip), num(e.ms),
    )
    .run();
}

export interface AuditRow {
  id: number;
  ts: string;
  actor_id: string | null;
  actor_role: string | null;
  method: string;
  path: string;
  resource: string | null;
  resource_id: string | null;
  status: number;
  outcome: string;
  ip: string | null;
  ms: number | null;
}
export async function listAudit(
  db: D1Like,
  opts: { limit?: number; actorId?: string; resource?: string } = {},
): Promise<AuditRow[]> {
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (opts.actorId) { clauses.push("actor_id = ?"); binds.push(opts.actorId); }
  if (opts.resource) { clauses.push("resource = ?"); binds.push(opts.resource); }
  const sql =
    "SELECT id, ts, actor_id, actor_role, method, path, resource, resource_id, status, outcome, ip, ms FROM audit_log" +
    (clauses.length ? " WHERE " + clauses.join(" AND ") : "") +
    " ORDER BY id DESC LIMIT ?";
  binds.push(Math.min(opts.limit ?? 200, 1000));
  const { results } = await db.prepare(sql).bind(...binds).all<AuditRow>();
  return results;
}
