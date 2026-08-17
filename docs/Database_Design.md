# Community Reading Club & Library Management Platform
## Database Design — v1 Core Subset (12 Tables)

This document describes the 12-table core subset of the v1 database design, matching `database-design-v1-core.dbml`. It covers the minimum tables needed for Authentication, Membership, Catalogue, Borrowing, Reservations, Seat Booking, Payments, and Reviews — everything needed to replace the paper-register/spreadsheet workflow.

Two simplifications versus the full v1 design (since this subset stands alone, without the tables that would normally support them):
- **`Book.publisher_id` is omitted** — the `Publisher` table isn't part of this subset.
- **`Seat` is flattened** — no `Branch`/`SeatZone` hierarchy; zone is a plain `zone_label` string on `Seat` itself.

---

## Step 1 — Tables in This Subset

| # | Table | Module |
|---|---|---|
| 1 | `User` | Authentication & Access |
| 2 | `Role` | Authentication & Access |
| 3 | `MembershipPlan` | Membership |
| 4 | `Membership` | Membership |
| 5 | `Book` | Library / Catalogue |
| 6 | `BookCopy` | Library / Catalogue |
| 7 | `Loan` | Borrowing |
| 8 | `Reservation` | Reservations |
| 9 | `Seat` | Seat Management |
| 10 | `SeatBooking` | Seat Management |
| 11 | `Payment` | Payments |
| 12 | `Review` | Community |

---

## Step 2 — Relationships

| Relationship | Type | Reason |
|---|---|---|
| User → Role | Many-to-One | Dynamic RBAC — role is a row, not a fixed enum, so new roles are a data insert. |
| Membership → User, Membership → MembershipPlan | Many-to-One each | A member holds one plan at a time, renewed as a new/updated membership record. |
| BookCopy → Book | Many-to-One | Multiple physical copies per title. |
| Loan → BookCopy | Many-to-One | A copy is loaned and returned repeatedly over its lifetime. |
| Loan → User (`member_id`) | Many-to-One | Who borrowed it. |
| Loan → User (`issued_by`) | Many-to-One | Staff member who checked it out. |
| Reservation → Book, Reservation → User | Many-to-One each | Single-queue reservation per book, `queue_position` orders the line. |
| SeatBooking → Seat, SeatBooking → User | Many-to-One each | A seat is booked repeatedly across dates/times. |
| Payment → User | Many-to-One | Membership fees and fine payments, distinguished by `type`. |
| Review → Book, Review → User | Many-to-One each | One review per member per book (`UNIQUE(book_id, member_id)`). |

---

## Step 3 — Table Design

Legend: **PK** primary key · **FK** foreign key · **NN** not null · **N** nullable.

### `User`
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | UUID | NN | `gen_random_uuid()` | PK |
| email | VARCHAR(255) | NN | — | UNIQUE |
| password_hash | VARCHAR(255) | NN | — | — |
| full_name | VARCHAR(150) | NN | — | — |
| phone | VARCHAR(20) | N | NULL | — |
| avatar_url | TEXT | N | NULL | — |
| role_id | UUID | NN | — | FK → Role.id |
| is_active | BOOLEAN | NN | `true` | — |
| last_login_at | TIMESTAMPTZ | N | NULL | — |
| created_at | TIMESTAMPTZ | NN | `now()` | — |
| updated_at | TIMESTAMPTZ | NN | `now()` | — |
| deleted_at | TIMESTAMPTZ | N | NULL | soft delete |

### `Role`
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | UUID | NN | `gen_random_uuid()` | PK |
| name | VARCHAR(40) | NN | — | UNIQUE (`admin`, `staff`, `member`) |
| description | TEXT | N | NULL | — |

### `MembershipPlan`
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | UUID | NN | `gen_random_uuid()` | PK |
| name | VARCHAR(80) | NN | — | UNIQUE |
| description | TEXT | N | NULL | — |
| duration_days | INTEGER | NN | — | — |
| max_active_loans | INTEGER | NN | — | — |
| fee_amount | NUMERIC(10,2) | NN | — | — |
| is_active | BOOLEAN | NN | `true` | — |

### `Membership`
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | UUID | NN | `gen_random_uuid()` | PK |
| member_id | UUID | NN | — | FK → User.id |
| plan_id | UUID | NN | — | FK → MembershipPlan.id |
| start_date | DATE | NN | — | — |
| end_date | DATE | NN | — | — |
| status | ENUM | NN | `'active'` | (`active`,`expired`,`cancelled`) |
| auto_renew | BOOLEAN | NN | `false` | — |
| created_at | TIMESTAMPTZ | NN | `now()` | — |

### `Book`
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | UUID | NN | `gen_random_uuid()` | PK |
| title | VARCHAR(255) | NN | — | full-text indexed (GIN) |
| isbn | VARCHAR(20) | N | NULL | UNIQUE |
| description | TEXT | N | NULL | full-text indexed (GIN) |
| published_year | SMALLINT | N | NULL | — |
| language | VARCHAR(40) | N | NULL | — |
| cover_image_url | TEXT | N | NULL | — |
| created_at | TIMESTAMPTZ | NN | `now()` | — |
| updated_at | TIMESTAMPTZ | NN | `now()` | — |
| deleted_at | TIMESTAMPTZ | N | NULL | soft delete |

### `BookCopy`
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | UUID | NN | `gen_random_uuid()` | PK |
| book_id | UUID | NN | — | FK → Book.id |
| copy_number | INTEGER | NN | — | UNIQUE with book_id |
| scan_token | VARCHAR(64) | NN | — | UNIQUE |
| condition | ENUM | NN | `'good'` | (`good`,`damaged`,`lost`) |
| replacement_cost | NUMERIC(10,2) | N | NULL | set when damaged/lost |
| status | ENUM | NN | `'available'` | (`available`,`loaned`,`reserved`,`written_off`) |
| acquired_at | DATE | N | NULL | — |
| created_at | TIMESTAMPTZ | NN | `now()` | — |

### `Loan`
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | UUID | NN | `gen_random_uuid()` | PK |
| book_copy_id | UUID | NN | — | FK → BookCopy.id |
| member_id | UUID | NN | — | FK → User.id |
| issued_by | UUID | NN | — | FK → User.id |
| issued_at | TIMESTAMPTZ | NN | `now()` | — |
| due_at | TIMESTAMPTZ | NN | — | — |
| returned_at | TIMESTAMPTZ | N | NULL | — |
| renewed_count | INTEGER | NN | `0` | — |
| status | ENUM | NN | `'active'` | (`active`,`returned`,`overdue`,`lost`) |
| created_at | TIMESTAMPTZ | NN | `now()` | — |

### `Reservation`
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | UUID | NN | `gen_random_uuid()` | PK |
| book_id | UUID | NN | — | FK → Book.id |
| member_id | UUID | NN | — | FK → User.id |
| queue_position | INTEGER | NN | — | — |
| status | ENUM | NN | `'pending'` | (`pending`,`ready`,`fulfilled`,`cancelled`,`expired`) |
| requested_at | TIMESTAMPTZ | NN | `now()` | — |
| ready_expires_at | TIMESTAMPTZ | N | NULL | auto-expiry/queue promotion |

### `Seat`
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | UUID | NN | `gen_random_uuid()` | PK |
| seat_number | VARCHAR(20) | NN | — | UNIQUE |
| zone_label | VARCHAR(80) | N | NULL | e.g. "Silent Room", "Group Study" |
| scan_token | VARCHAR(64) | NN | — | UNIQUE |
| status | ENUM | NN | `'active'` | (`active`,`maintenance`) |

### `SeatBooking`
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | UUID | NN | `gen_random_uuid()` | PK |
| seat_id | UUID | NN | — | FK → Seat.id |
| member_id | UUID | NN | — | FK → User.id |
| booking_date | DATE | NN | — | — |
| start_time | TIME | NN | — | — |
| end_time | TIME | NN | — | — |
| status | ENUM | NN | `'booked'` | (`booked`,`checked_in`,`completed`,`cancelled`,`no_show`) |
| checked_in_at | TIMESTAMPTZ | N | NULL | — |
| created_at | TIMESTAMPTZ | NN | `now()` | — |

### `Payment`
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | UUID | NN | `gen_random_uuid()` | PK |
| member_id | UUID | NN | — | FK → User.id |
| type | ENUM | NN | — | (`membership_fee`,`fine`) |
| amount | NUMERIC(10,2) | NN | — | — |
| status | ENUM | NN | `'pending'` | (`pending`,`completed`,`failed`,`refunded`) |
| provider | VARCHAR(60) | N | NULL | — |
| provider_reference | VARCHAR(120) | N | NULL | — |
| related_entity_type | VARCHAR(40) | N | NULL | e.g. `'membership'`, `'loan'` |
| related_entity_id | UUID | N | NULL | — |
| paid_at | TIMESTAMPTZ | N | NULL | — |
| created_at | TIMESTAMPTZ | NN | `now()` | — |

### `Review`
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | UUID | NN | `gen_random_uuid()` | PK |
| book_id | UUID | NN | — | FK → Book.id |
| member_id | UUID | NN | — | FK → User.id |
| rating | SMALLINT | NN | — | 1–5 |
| body | TEXT | N | NULL | — |
| created_at | TIMESTAMPTZ | NN | `now()` | — |
| — | — | — | — | UNIQUE (`book_id`, `member_id`) |

---

## Step 4 — Indexing Strategy

| Index | Table | Purpose |
|---|---|---|
| UNIQUE btree | User.email | Login lookup |
| GIN (full-text) | Book.title, Book.description | Full-text book search |
| UNIQUE btree | Book.isbn, BookCopy.scan_token, Seat.scan_token | Catalogue and QR-scan lookups |
| UNIQUE btree | (BookCopy.book_id, copy_number) | Per-book copy numbering |
| Composite btree | (Loan.status, Loan.due_at) | Overdue-loan queries |
| Composite btree | (Reservation.book_id, status) | Queue lookups per book |
| Composite btree | (SeatBooking.seat_id, booking_date) | Live availability checks |
| Composite btree | (Payment.status, paid_at) | Revenue reporting |
| UNIQUE btree | (Review.book_id, member_id) | One review per member per book |

---

## Step 5 — Soft Delete & Audit

- **Soft delete (`deleted_at`)**: `User`, `Book` — preserved because historical `Loan`/`Review` rows must remain valid.
- **Soft delete via status**: `BookCopy` (`status = 'written_off'`).
- **Actor columns**: `Loan.issued_by` (who checked the book out), `Payment` (implicitly `member_id` as the paying party) — track who acted on each transactional row without needing a separate audit table for this subset.

---

Corresponding schema: [`database-design-v1-core.dbml`](./database-design-v1-core.dbml)
