import type { User } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { prisma } from '@/server/db';
import { env } from '@/server/env';
import { Role } from '@/server/constants';
import { hashPassword } from '@/server/auth/security';
import { ExpenseCategory } from '@/server/admin/constants';
import { FINE_PER_DAY, LOAN_PERIOD_DAYS, RESERVATION_DURATION_CHOICES } from '@/server/loans/constants';
import { SEAT_LABELS } from '@/server/seatBooking/constants';
import { SeededRandom } from '@/server/seed/random';
import {
  COMMENT_TEMPLATES,
  FIRST_NAMES,
  LAST_NAMES,
  PERMISSION_REASONS,
  POST_TEMPLATES,
  PRICING_PLANS,
  REVIEW_TEMPLATES,
  SUPPORT_DESCRIPTIONS,
} from '@/server/seed/constants';

// Mirrors backend/scripts/seed_demo_data.py. Generates realistic historical demo data
// (April of the current year through today) exercising every feature of the app: staff
// + salaries, guardians + linked children, 100-110 new members per month, membership/
// renewal/fine payments, coupons, loans, reservations, reviews, reading progress/goals,
// login activity, seat bookings + notify requests, events + registrations, community
// posts/comments/likes/saves, notifications, expenses, billing/permission requests,
// support tickets, book records, and an announcement.
//
// Idempotent at the batch level: if any @seed-demo.example.com user already exists, the
// run skips rather than inserting a second batch — safe to invoke on every job-runner
// boot. The seeded randomness below is NOT bit-for-bit identical to Python's — CPython's
// Mersenne Twister has no faithful JS port — so re-running this against a fresh database
// produces equally-plausible but not byte-identical demo data. Accepted, deliberate
// divergence (see the migration plan), not a bug to chase.

const SEED_DOMAIN = 'seed-demo.example.com';
const SEEDABLE_ENVIRONMENTS = new Set(['development', 'test', 'e2e']);

function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function daysBetweenUtc(a: Date, b: Date): number {
  const aUtc = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bUtc = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((aUtc - bUtc) / DAY);
}

function monthStart(moment: Date): Date {
  return new Date(Date.UTC(moment.getUTCFullYear(), moment.getUTCMonth(), 1));
}

function addMonths(moment: Date, delta: number): Date {
  const monthIndex = moment.getUTCMonth() + delta;
  const year = moment.getUTCFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  return new Date(Date.UTC(year, month, 1));
}

const _DECISION_ACTIONS: Record<string, string> = {
  'refund:approved': 'refundIssued',
  'refund:rejected': 'refundRejected',
  'fee_waiver:approved': 'feeWaived',
  'fee_waiver:rejected': 'feeWaiverRejected',
};

export async function seedDemoData(): Promise<string> {
  if (!SEEDABLE_ENVIRONMENTS.has(env.APP_ENV)) {
    throw new Error(
      `refusing to seed known-password accounts with APP_ENV=${JSON.stringify(env.APP_ENV)} — ` +
        `allowed only in ${[...SEEDABLE_ENVIRONMENTS].sort().join(', ')}`,
    );
  }

  const existing = await prisma.user.findFirst({ where: { email: { endsWith: `@${SEED_DOMAIN}` } } });
  if (existing) {
    const line = `Demo data already seeded (found ${existing.email}) — skipping.`;
    console.log(line);
    return line;
  }

  const RNG = new SeededRandom(20260803);
  const DEV_PASSWORD_HASH = await hashPassword(process.env.DEV_SEED_PASSWORD ?? 'SeedDemo123!');
  const NOW = new Date();
  const THIS_MONTH_START = monthStart(NOW);

  // "Since April" — if run before April, fall back to last year's so the range is never
  // empty (an empty MONTH_STARTS would break the first MONTH_STARTS[0] use below).
  const seedStartYear = NOW.getUTCMonth() >= 3 ? NOW.getUTCFullYear() : NOW.getUTCFullYear() - 1;
  const MONTH_STARTS: Date[] = [];
  let cursor = new Date(Date.UTC(seedStartYear, 3, 1));
  while (cursor <= THIS_MONTH_START) {
    MONTH_STARTS.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  const MONTH_ENDS = MONTH_STARTS.map((start) => addMonths(start, 1));

  console.log(`Seeding demo data for ${MONTH_STARTS.map((m) => m.toISOString().slice(0, 7))}...`);

  let emailCounter = 0;
  function nextEmail(prefix: string): string {
    emailCounter += 1;
    return `${prefix}${String(emailCounter).padStart(4, '0')}@${SEED_DOMAIN}`;
  }

  function randomName(): string {
    return `${RNG.choice(FIRST_NAMES)} ${RNG.choice(LAST_NAMES)}`;
  }

  function randomDtBetween(start: Date, end: Date): Date {
    const span = Math.floor((end.getTime() - start.getTime()) / SECOND);
    if (span <= 0) return start;
    return addMs(start, RNG.randint(0, span) * SECOND);
  }

  async function createUser(opts: {
    email: string;
    fullName: string;
    roleId: string;
    createdAt: Date;
  }): Promise<User> {
    return prisma.user.create({
      data: {
        email: opts.email,
        passwordHash: DEV_PASSWORD_HASH,
        fullName: opts.fullName,
        roleId: opts.roleId,
        createdAt: opts.createdAt,
      },
    });
  }

  async function seedRoles(): Promise<Record<string, string>> {
    const roleIds: Record<string, string> = {};
    const roleNames = [Role.ADMIN, Role.MANAGER, Role.LIBRARIAN, Role.IT_HEAD, Role.MEMBER, Role.GUARDIAN];
    for (const roleName of roleNames) {
      const role = await prisma.role.upsert({
        where: { name: roleName },
        create: { name: roleName },
        update: {},
      });
      roleIds[roleName] = role.id;
    }
    return roleIds;
  }

  async function seedStaff(roleIds: Record<string, string>): Promise<Record<string, User[]>> {
    const roster: [string, string, number][] = [
      [Role.ADMIN, 'admin', 1],
      [Role.MANAGER, 'manager', 3],
      [Role.LIBRARIAN, 'librarian', 2],
      [Role.IT_HEAD, 'ithead', 2],
    ];
    const staffStartedAt = addMonths(MONTH_STARTS[0], -3);
    const staff: Record<string, User[]> = {};
    for (const [roleName, prefix, count] of roster) {
      staff[roleName] = [];
      for (let i = 0; i < count; i++) {
        const user = await createUser({
          email: nextEmail(prefix),
          fullName: randomName(),
          roleId: roleIds[roleName],
          createdAt: staffStartedAt,
        });
        staff[roleName].push(user);
      }
    }
    const line = `Seeded ${Object.values(staff).reduce((sum, v) => sum + v.length, 0)} staff accounts.`;
    console.log(line);
    return staff;
  }

  async function seedGuardiansAndChildren(
    roleIds: Record<string, string>,
    members: User[],
  ): Promise<[User[], User[]]> {
    const guardians: User[] = [];
    const children: User[] = [];
    const pool = [...members];
    RNG.shuffle(pool);
    const guardianCount = 10;
    for (let i = 0; i < guardianCount; i++) {
      if (pool.length === 0) break;
      const createdAt = randomDtBetween(MONTH_STARTS[0], NOW);
      const guardian = await createUser({
        email: nextEmail('guardian'),
        fullName: randomName(),
        roleId: roleIds[Role.GUARDIAN],
        createdAt,
      });
      guardians.push(guardian);
      const childCount = RNG.choice([1, 1, 2]);
      for (let c = 0; c < childCount; c++) {
        if (pool.length === 0) break;
        const child = pool.pop()!;
        await prisma.guardianLink.create({ data: { guardianId: guardian.id, memberId: child.id } });
        children.push(child);
      }
    }
    const line = `Seeded ${guardians.length} guardians linked to ${children.length} children.`;
    console.log(line);
    return [guardians, children];
  }

  async function seedMembers(roleIds: Record<string, string>): Promise<User[]> {
    const members: User[] = [];
    for (let i = 0; i < MONTH_STARTS.length; i++) {
      const [monthStartD, monthEndD] = [MONTH_STARTS[i], MONTH_ENDS[i]];
      const count = RNG.randint(100, 110);
      for (let n = 0; n < count; n++) {
        const createdAt = randomDtBetween(monthStartD, monthEndD < NOW ? monthEndD : NOW);
        const member = await createUser({
          email: nextEmail('member'),
          fullName: randomName(),
          roleId: roleIds[Role.MEMBER],
          createdAt,
        });
        members.push(member);
      }
      console.log(`Seeded ${count} members for ${monthStartD.toISOString().slice(0, 7)}.`);
    }
    return members;
  }

  async function seedCoupons(adminId: string) {
    const coupons = [];
    const specs: [number, number][] = [[10, 50], [15, 30], [20, 20], [25, 10], [50, 5]];
    for (const [discount, maxUses] of specs) {
      const code = `SEED${discount}${maxUses}`;
      const createdAt = randomDtBetween(MONTH_STARTS[0], NOW);
      const coupon = await prisma.coupon.create({
        data: { code, discountPercent: discount, maxUses, createdById: adminId, createdAt },
      });
      await prisma.auditLogEntry.create({
        data: {
          actorId: adminId,
          action: 'couponGenerated',
          metadata: { code: coupon.code, discountPercent: discount, maxUses } as Prisma.InputJsonValue,
          createdAt: coupon.createdAt,
        },
      });
      coupons.push(coupon);
    }
    console.log(`Seeded ${coupons.length} coupons.`);
    return coupons;
  }

  const PLAN_WEIGHTS: [string, number][] = [['1m', 60], ['3m', 20], ['6m', 12], ['12m', 8]];
  const planIds = PLAN_WEIGHTS.map(([id]) => id);
  const planWeights = PLAN_WEIGHTS.map(([, w]) => w);

  // Matches the exact format the real app generates (see guardian/service.ts's
  // renewChildSubscription) so seeded payments read the same as real ones.
  function planLabel(plan: { months: number; price: number }): string {
    return `${plan.months} Month — ₹${plan.price}`;
  }

  async function seedMembershipPayments(
    members: User[],
    plans: Record<string, { planId: string; months: number; price: number }>,
    coupons: { id: string; discountPercent: number; maxUses: number; usesCount: number }[],
  ): Promise<void> {
    let created = 0;
    for (const member of members) {
      const planId = RNG.choices(planIds, planWeights, 1)[0];
      const plan = plans[planId];
      let amount = plan.price;
      let coupon: (typeof coupons)[number] | null = null;
      if (RNG.random() < 0.12) {
        const candidate = RNG.choice(coupons);
        if (candidate.usesCount < candidate.maxUses) {
          coupon = candidate;
          amount = Math.round((plan.price * (100 - coupon.discountPercent)) / 100);
        }
      }

      const paymentAt = addMs(member.createdAt, RNG.randint(0, 36) * HOUR);
      await prisma.payment.create({
        data: {
          userId: member.id,
          amount,
          label: planLabel(plan),
          planMonths: plan.months,
          createdAt: paymentAt,
        },
      });
      await prisma.notification.create({
        data: {
          userId: member.id,
          type: 'payment-received',
          message: `Payment of ₹${amount} received for ${planLabel(plan)}.`,
          createdAt: paymentAt,
        },
      });
      if (coupon) {
        await prisma.coupon.update({ where: { id: coupon.id }, data: { usesCount: { increment: 1 } } });
      }
      created += 1;

      // A later renewal for members who joined early enough that a renewal would
      // plausibly be due by now.
      if (member.createdAt.getTime() < NOW.getTime() - 45 * DAY && RNG.random() < 0.3) {
        const renewalPlanId = RNG.choices(planIds, planWeights, 1)[0];
        const renewalPlan = plans[renewalPlanId];
        const renewalAt = randomDtBetween(addMs(paymentAt, 30 * DAY), NOW);
        await prisma.payment.create({
          data: {
            userId: member.id,
            amount: renewalPlan.price,
            label: planLabel(renewalPlan),
            planMonths: renewalPlan.months,
            createdAt: renewalAt,
          },
        });
        await prisma.notification.create({
          data: {
            userId: member.id,
            type: 'payment-received',
            message: `Payment of ₹${renewalPlan.price} received for ${planLabel(renewalPlan)}.`,
            createdAt: renewalAt,
          },
        });
        created += 1;
      }
    }
    console.log(`Seeded ${created} membership/renewal payments.`);
  }

  interface LoanEntry {
    loan: { id: string; returnedAt: Date | null; borrowedAt: Date };
    member: User;
    book: { id: string; title: string; category: string };
    outcome: string;
    fineAmount: number;
  }

  async function seedLoans(
    members: User[],
    books: { id: string; title: string; category: string }[],
    staff: Record<string, User[]>,
  ): Promise<LoanEntry[]> {
    const issuers = [...staff[Role.MANAGER], ...staff[Role.LIBRARIAN]];
    const loans: LoanEntry[] = [];
    const usedPairs = new Set<string>();
    for (const member of members) {
      if (RNG.random() >= 0.5) continue;
      const loanCount = RNG.choices([1, 2, 3], [55, 30, 15], 1)[0];
      for (let n = 0; n < loanCount; n++) {
        const book = RNG.choice(books);
        const pairKey = `${member.id}:${book.id}`;
        if (usedPairs.has(pairKey)) continue;
        usedPairs.add(pairKey);

        const earliest = addMs(member.createdAt, RNG.randint(1, 72) * HOUR);
        if (earliest >= NOW) continue;
        const borrowedAt = randomDtBetween(earliest, NOW);
        const dueDate = addMs(borrowedAt, LOAN_PERIOD_DAYS * DAY);
        const issuer = RNG.choice(issuers);

        let returnedAt: Date | null = null;
        let finePaid = false;
        let fineAmount = 0;
        let outcome: string;
        if (dueDate <= NOW) {
          outcome = RNG.choices(['on_time', 'late', 'overdue_unreturned'], [55, 25, 20], 1)[0];
        } else {
          outcome = 'active';
        }

        if (outcome === 'on_time') {
          returnedAt = randomDtBetween(addMs(borrowedAt, DAY), dueDate);
        } else if (outcome === 'late') {
          returnedAt = randomDtBetween(addMs(dueDate, DAY), new Date(Math.min(addMs(dueDate, 10 * DAY).getTime(), NOW.getTime())));
          const daysLate = Math.max(1, daysBetweenUtc(returnedAt, dueDate));
          fineAmount = daysLate * FINE_PER_DAY;
          finePaid = RNG.random() < 0.6;
        } else if (outcome === 'overdue_unreturned') {
          const daysLate = Math.max(1, daysBetweenUtc(NOW, dueDate));
          fineAmount = daysLate * FINE_PER_DAY;
          finePaid = false;
        }
        // "active": returnedAt stays unset, no fine yet.

        const loan = await prisma.loan.create({
          data: {
            bookId: book.id,
            memberId: member.id,
            borrowedAt,
            dueDate,
            createdById: issuer.id,
            createdAt: borrowedAt,
            ...(returnedAt ? { returnedAt } : {}),
            ...(outcome === 'late' || outcome === 'overdue_unreturned' ? { finePaid } : {}),
          },
        });
        loans.push({ loan, member, book, outcome, fineAmount });

        if (outcome === 'late' && finePaid) {
          const label = RNG.random() < 0.2 ? 'Fines cleared by guardian' : 'Overdue fine';
          await prisma.payment.create({
            data: {
              userId: member.id,
              amount: fineAmount,
              label,
              createdAt: addMs(returnedAt!, HOUR),
            },
          });
        }
        if (outcome === 'overdue_unreturned') {
          await prisma.notification.create({
            data: {
              userId: member.id,
              type: 'fine-reminder',
              message: `Your fine of ₹${fineAmount} for '${book.title}' is overdue.`,
              createdAt: addMs(dueDate, DAY),
            },
          });
        }
      }
    }
    console.log(`Seeded ${loans.length} loans.`);
    return loans;
  }

  async function seedReservations(
    members: User[],
    books: { id: string; title: string }[],
    staff: Record<string, User[]>,
  ): Promise<void> {
    const issuers = [...staff[Role.MANAGER], ...staff[Role.LIBRARIAN]];
    let count = 0;
    let approved = 0;
    const sampleSize = Math.min(members.length, Math.max(1, Math.floor((members.length * 15) / 100)));
    const sample = RNG.sample(members, sampleSize);
    for (const member of sample) {
      const book = RNG.choice(books);
      const createdAt = randomDtBetween(
        member.createdAt > MONTH_STARTS[0] ? member.createdAt : MONTH_STARTS[0],
        addMs(NOW, -HOUR),
      );
      const status = RNG.choices(['pending', 'approved', 'rejected', 'cancelled'], [30, 40, 15, 15], 1)[0];

      let loanId: string | null = null;
      if (status === 'approved') {
        const issuer = RNG.choice(issuers);
        const borrowedAt = addMs(createdAt, RNG.randint(2, 48) * HOUR);
        if (borrowedAt < NOW) {
          const duration = RNG.choice(RESERVATION_DURATION_CHOICES);
          const dueDate = addMs(borrowedAt, duration * DAY);
          const returnedAt =
            dueDate <= NOW && RNG.random() < 0.6
              ? randomDtBetween(addMs(borrowedAt, 6 * HOUR), dueDate)
              : null;
          const loan = await prisma.loan.create({
            data: {
              bookId: book.id,
              memberId: member.id,
              borrowedAt,
              dueDate,
              createdById: issuer.id,
              createdAt: borrowedAt,
              ...(returnedAt ? { returnedAt } : {}),
            },
          });
          loanId = loan.id;
          approved += 1;
          await prisma.notification.create({
            data: {
              userId: member.id,
              type: 'reservation-approved',
              message: `Your reservation for '${book.title}' was approved.`,
              createdAt: borrowedAt,
            },
          });
        }
      } else if (status === 'rejected') {
        await prisma.notification.create({
          data: {
            userId: member.id,
            type: 'reservation-rejected',
            message: `Your reservation for '${book.title}' was rejected.`,
            createdAt: addMs(createdAt, 6 * HOUR),
          },
        });
      }

      await prisma.reservation.create({
        data: { memberId: member.id, bookId: book.id, status, loanId, createdAt },
      });
      count += 1;
    }
    console.log(`Seeded ${count} reservations (${approved} approved into loans).`);
  }

  async function seedReviewsAndProgress(loans: LoanEntry[]): Promise<void> {
    const progressSeen = new Set<string>();
    let progressCount = 0;
    let reviewCount = 0;
    for (const entry of loans) {
      const { member, book, outcome, loan } = entry;
      const pairKey = `${member.id}:${book.id}`;
      if (progressSeen.has(pairKey)) continue;
      progressSeen.add(pairKey);

      const status = outcome === 'on_time' || outcome === 'late' ? 'completed' : 'reading';
      const percent = status === 'completed' ? 100 : RNG.randint(10, 90);
      const updatedAt = loan.returnedAt ?? addMs(loan.borrowedAt, RNG.randint(1, 5) * DAY);
      await prisma.readingProgress.create({
        data: { memberId: member.id, bookId: book.id, status, percentComplete: percent, updatedAt },
      });
      progressCount += 1;

      if (status === 'completed' && RNG.random() < 0.35) {
        await prisma.review.create({
          data: {
            bookId: book.id,
            memberId: member.id,
            rating: RNG.choices([3, 4, 5, 2, 1], [30, 35, 20, 10, 5], 1)[0],
            comment: RNG.choice(REVIEW_TEMPLATES),
            images: [],
            createdAt: addMs(loan.returnedAt!, RNG.randint(1, 48) * HOUR),
          },
        });
        reviewCount += 1;
      }
    }
    console.log(`Seeded ${progressCount} reading-progress rows and ${reviewCount} reviews.`);
  }

  async function seedReadingGoals(members: User[]): Promise<void> {
    let count = 0;
    const sample = RNG.sample(members, Math.max(1, Math.floor((members.length * 30) / 100)));
    for (const member of sample) {
      const monthly = RNG.choice([1, 2, 3, 4]);
      // create-if-absent, never overwrite — matches Python's find_unique-then-create,
      // NOT membersService.upsertReadingGoal() (which overwrites on conflict).
      const alreadyExists = await prisma.readingGoal.findUnique({ where: { memberId: member.id } });
      if (!alreadyExists) {
        await prisma.readingGoal.create({
          data: { memberId: member.id, yearlyGoal: monthly * 12, monthlyGoal: monthly },
        });
      }
      count += 1;
    }
    console.log(`Seeded ${count} reading goals.`);
  }

  async function seedLoginActivity(members: User[]): Promise<void> {
    let count = 0;
    const sample = RNG.sample(members, Math.max(1, Math.floor((members.length * 30) / 100)));
    for (const member of sample) {
      const spanDays = Math.max(1, daysBetweenUtc(NOW < MONTH_ENDS[MONTH_ENDS.length - 1] ? NOW : MONTH_ENDS[MONTH_ENDS.length - 1], member.createdAt));
      const daysActive = Math.min(spanDays, RNG.randint(3, 8));
      const usedDays = new Set<number>();
      for (let n = 0; n < daysActive; n++) {
        const offset = RNG.randint(0, spanDays);
        if (usedDays.has(offset)) continue;
        usedDays.add(offset);
        const day = addMs(member.createdAt, offset * DAY);
        const dayStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
        try {
          await prisma.loginActivity.create({ data: { memberId: member.id, date: dayStart } });
          count += 1;
        } catch (err) {
          if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
        }
      }
    }
    console.log(`Seeded ${count} login-activity rows.`);
  }

  async function seedSeatActivity(members: User[]): Promise<void> {
    const usedSlots = new Set<string>();
    let bookingCount = 0;
    let notifyCount = 0;
    const sample = RNG.sample(members, Math.max(1, Math.floor((members.length * 20) / 100)));
    for (const member of sample) {
      const bookingsForMember = RNG.choice([1, 1, 2]);
      for (let n = 0; n < bookingsForMember; n++) {
        for (let attempt = 0; attempt < 5; attempt++) {
          const seat = RNG.choice(SEAT_LABELS);
          const day = randomDtBetween(member.createdAt > MONTH_STARTS[0] ? member.createdAt : MONTH_STARTS[0], NOW);
          const dayOnly = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
          const hour = RNG.randint(9, 20);
          const key = `${seat}:${dayOnly.toISOString().slice(0, 10)}:${hour}`;
          if (usedSlots.has(key)) continue;
          usedSlots.add(key);
          await prisma.seatBooking.create({
            data: {
              memberId: member.id,
              seatLabel: seat,
              date: dayOnly,
              hour,
              createdAt: addMs(dayOnly, -DAY),
            },
          });
          bookingCount += 1;
          break;
        }
      }
    }

    const notifySample = RNG.sample(members, Math.min(members.length, 10));
    for (const member of notifySample) {
      const seat = RNG.choice(SEAT_LABELS);
      const day = randomDtBetween(MONTH_STARTS[MONTH_STARTS.length - 1], NOW);
      const dayOnly = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
      const hour = RNG.randint(9, 20);
      try {
        await prisma.seatNotifyRequest.create({
          data: { memberId: member.id, seatLabel: seat, date: dayOnly, hour },
        });
        notifyCount += 1;
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
      }
    }
    console.log(`Seeded ${bookingCount} seat bookings and ${notifyCount} seat-notify requests.`);
  }

  const EVENT_TITLES = [
    'Monthly Book Club Meetup',
    'Author Talk & Q&A',
    "Kids' Storytime Hour",
    'Poetry Reading Evening',
    'Genre Spotlight: Mystery & Thrillers',
    'Reading Marathon Kickoff',
  ];

  async function seedEvents(
    staff: Record<string, User[]>,
    members: User[],
    guardians: User[],
    books: { id: string; title: string }[],
  ): Promise<void> {
    const creators = [...staff[Role.MANAGER], ...staff[Role.ADMIN]];
    const attendeesPool = [...members, ...guardians];
    let eventCount = 0;
    let registrationCount = 0;
    let titleIndex = 0;
    for (let i = 0; i < MONTH_STARTS.length; i++) {
      for (let n = 0; n < 2; n++) {
        const title = titleIndex < EVENT_TITLES.length ? EVENT_TITLES[titleIndex++] : `Community Event ${eventCount + 1}`;
        const creator = RNG.choice(creators);
        const capacity = RNG.choice([15, 20, 25, 30]);
        const isLastMonth = i === MONTH_STARTS.length - 1;
        let eventDate = randomDtBetween(MONTH_STARTS[i], MONTH_ENDS[i]);
        if (isLastMonth && RNG.random() < 0.3) {
          eventDate = addMs(NOW, RNG.randint(3, 20) * DAY);
        }
        const book = RNG.choice(books);
        // Events created "for" a future date must themselves have been created in the
        // past — clamp so createdAt never lands after now.
        const eventCreatedAt = new Date(
          Math.min(addMs(eventDate, -RNG.randint(5, 15) * DAY).getTime(), addMs(NOW, -HOUR).getTime()),
        );
        const event = await prisma.event.create({
          data: {
            title,
            description: `Join us to discuss ${book.title} and connect with fellow readers.`,
            location: 'Main Reading Hall',
            date: eventDate,
            capacity,
            createdBy: creator.id,
            createdAt: eventCreatedAt,
          },
        });
        eventCount += 1;

        const managerSample = RNG.sample(
          staff[Role.MANAGER],
          Math.min(staff[Role.MANAGER].length, RNG.choice([1, 2])),
        );
        for (const manager of managerSample) {
          await prisma.eventManagerAssignment.create({
            data: { eventId: event.id, managerId: manager.id },
          });
        }

        const registrantCount = Math.min(capacity, RNG.randint(Math.floor(capacity / 2), capacity));
        const registrants = RNG.sample(attendeesPool, Math.min(attendeesPool.length, registrantCount));
        for (const registrant of registrants) {
          if (registrant.createdAt > event.createdAt) continue;
          try {
            await prisma.eventRegistration.create({
              data: {
                eventId: event.id,
                memberId: registrant.id,
                createdAt: new Date(Math.min(addMs(event.createdAt, RNG.randint(1, 100) * HOUR).getTime(), NOW.getTime())),
              },
            });
            registrationCount += 1;
          } catch (err) {
            if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
          }
        }
      }
    }
    console.log(`Seeded ${eventCount} events with ${registrationCount} registrations.`);
  }

  async function seedCommunity(members: User[], guardians: User[], books: { id: string; title: string }[]): Promise<void> {
    const authorsPool = [...members, ...guardians];
    const posts = [];
    for (let n = 0; n < 40; n++) {
      const author = RNG.choice(authorsPool);
      const book = RNG.choice(books);
      const createdAt = randomDtBetween(author.createdAt > MONTH_STARTS[0] ? author.createdAt : MONTH_STARTS[0], NOW);
      const post = await prisma.communityPost.create({
        data: {
          authorId: author.id,
          bookTitle: book.title,
          content: RNG.choice(POST_TEMPLATES).replace('{title}', book.title),
          images: [],
          reported: RNG.random() < 0.07,
          createdAt,
        },
      });
      posts.push(post);
    }

    let commentCount = 0;
    let likeCount = 0;
    let saveCount = 0;
    for (const post of posts) {
      const commenters = RNG.sample(authorsPool, Math.min(authorsPool.length, RNG.randint(0, 4)));
      const topLevelComments = [];
      for (const commenter of commenters) {
        const comment = await prisma.communityComment.create({
          data: {
            postId: post.id,
            authorId: commenter.id,
            content: RNG.choice(COMMENT_TEMPLATES),
            reported: RNG.random() < 0.03,
            createdAt: new Date(Math.min(addMs(post.createdAt, RNG.randint(1, 72) * HOUR).getTime(), NOW.getTime())),
          },
        });
        topLevelComments.push(comment);
        commentCount += 1;
        if (commenter.id !== post.authorId) {
          await prisma.notification.create({
            data: {
              userId: post.authorId,
              type: 'post-comment',
              message: `${commenter.fullName} commented on your post.`,
              createdAt: comment.createdAt,
            },
          });
        }
      }
      if (topLevelComments.length > 0 && RNG.random() < 0.4) {
        const parent = RNG.choice(topLevelComments);
        const replier = RNG.choice(authorsPool);
        await prisma.communityComment.create({
          data: {
            postId: post.id,
            authorId: replier.id,
            parentId: parent.id,
            content: RNG.choice(COMMENT_TEMPLATES),
            createdAt: new Date(Math.min(addMs(parent.createdAt, RNG.randint(1, 24) * HOUR).getTime(), NOW.getTime())),
          },
        });
        commentCount += 1;
      }

      const likers = RNG.sample(authorsPool, Math.min(authorsPool.length, RNG.randint(0, 10)));
      const likedIds = new Set<string>();
      for (const liker of likers) {
        if (likedIds.has(liker.id)) continue;
        likedIds.add(liker.id);
        const likeCreatedAt = new Date(Math.min(addMs(post.createdAt, RNG.randint(1, 96) * HOUR).getTime(), NOW.getTime()));
        await prisma.communityPostLike.create({
          data: { postId: post.id, userId: liker.id, createdAt: likeCreatedAt },
        });
        likeCount += 1;
        if (liker.id !== post.authorId && RNG.random() < 0.3) {
          await prisma.notification.create({
            data: {
              userId: post.authorId,
              type: 'post-like',
              message: `${liker.fullName} liked your post.`,
              createdAt: likeCreatedAt,
            },
          });
        }
      }

      const savers = RNG.sample(authorsPool, Math.min(authorsPool.length, RNG.randint(0, 5)));
      const savedIds = new Set<string>();
      for (const saver of savers) {
        if (savedIds.has(saver.id)) continue;
        savedIds.add(saver.id);
        await prisma.communityPostSave.create({
          data: {
            postId: post.id,
            userId: saver.id,
            createdAt: new Date(Math.min(addMs(post.createdAt, RNG.randint(1, 96) * HOUR).getTime(), NOW.getTime())),
          },
        });
        saveCount += 1;
      }
    }

    const banned = RNG.choice(members);
    await prisma.communityBan.create({ data: { userId: banned.id } });

    console.log(
      `Seeded ${posts.length} community posts, ${commentCount} comments, ${likeCount} likes, ` +
        `${saveCount} saves, 1 ban.`,
    );
  }

  async function seedExpenses(staff: Record<string, User[]>): Promise<void> {
    const admin = staff[Role.ADMIN][0];
    const salaryByRole: [string, number][] = [
      [Role.ADMIN, 2500],
      [Role.MANAGER, 1800],
      [Role.LIBRARIAN, 1500],
      [Role.IT_HEAD, 1600],
    ];
    let expenseCount = 0;
    for (let i = 0; i < MONTH_STARTS.length; i++) {
      const monthStartD = MONTH_STARTS[i];
      const payDay = addMs(monthStartD, DAY);
      for (const [roleName, amount] of salaryByRole) {
        for (const _staffMember of staff[roleName]) {
          const expense = await prisma.expense.create({
            data: { category: ExpenseCategory.STAFF_SALARIES, amount, loggedById: admin.id, createdAt: payDay },
          });
          await prisma.auditLogEntry.create({
            data: {
              actorId: admin.id,
              action: 'expenseApproved',
              metadata: { category: expense.category, amount: expense.amount } as Prisma.InputJsonValue,
              createdAt: payDay,
            },
          });
          expenseCount += 1;
        }
      }

      const categoryBases: [string, number][] = [
        [ExpenseCategory.BOOK_PROCUREMENT, 1200],
        [ExpenseCategory.UTILITIES, 450],
        [ExpenseCategory.MARKETING, 350],
      ];
      for (const [category, baseAmount] of categoryBases) {
        const iterations = RNG.choice([1, 2]);
        for (let n = 0; n < iterations; n++) {
          const amount = baseAmount + RNG.randint(-100, 300);
          const createdAt = randomDtBetween(monthStartD, MONTH_ENDS[MONTH_ENDS.length - 1] < NOW ? MONTH_ENDS[MONTH_ENDS.length - 1] : NOW);
          const expense = await prisma.expense.create({
            data: { category, amount, loggedById: admin.id, createdAt },
          });
          await prisma.auditLogEntry.create({
            data: {
              actorId: admin.id,
              action: 'expenseApproved',
              metadata: { category: expense.category, amount: expense.amount } as Prisma.InputJsonValue,
              createdAt,
            },
          });
          expenseCount += 1;
        }
      }
    }
    console.log(`Seeded ${expenseCount} expenses (incl. staff salaries), with matching audit log entries.`);
  }

  async function seedBillingRequests(members: User[], staff: Record<string, User[]>): Promise<void> {
    const manager = staff[Role.MANAGER][0];
    const admin = staff[Role.ADMIN][0];
    let count = 0;
    let decided = 0;
    const sample = RNG.sample(members, Math.min(members.length, 10));
    for (const member of sample) {
      const reqType = RNG.choice(['refund', 'fee_waiver']);
      const amount = RNG.choice([50, 100, 150, 200]);
      const createdAt = randomDtBetween(member.createdAt > MONTH_STARTS[0] ? member.createdAt : MONTH_STARTS[0], NOW);
      const status = RNG.choices(['pending', 'approved', 'rejected'], [35, 45, 20], 1)[0];
      const decidedAt = status !== 'pending' ? addMs(createdAt, RNG.randint(1, 4) * DAY) : null;
      await prisma.billingRequest.create({
        data: {
          memberId: member.id,
          createdById: manager.id,
          type: reqType,
          amount,
          reason: 'Requesting review of a recent charge discrepancy.',
          status,
          decidedById: status !== 'pending' ? admin.id : null,
          decidedAt,
          createdAt,
        },
      });
      count += 1;
      if (status !== 'pending') {
        await prisma.auditLogEntry.create({
          data: {
            actorId: admin.id,
            action: _DECISION_ACTIONS[`${reqType}:${status}`],
            metadata: { amount, memberName: member.fullName } as Prisma.InputJsonValue,
            createdAt: decidedAt!,
          },
        });
        decided += 1;
      }
      await prisma.notification.create({
        data: {
          userId: manager.id,
          type: 'pending-request',
          message: `New ${reqType.replace('_', ' ')} request filed for ${member.fullName}.`,
          createdAt,
        },
      });
    }
    console.log(`Seeded ${count} billing requests (${decided} decided).`);
  }

  async function seedPermissionRequests(staff: Record<string, User[]>): Promise<void> {
    const requesters = [...staff[Role.MANAGER], ...staff[Role.LIBRARIAN]];
    const itHead = staff[Role.IT_HEAD][0];
    let count = 0;
    for (let n = 0; n < 8; n++) {
      const requester = RNG.choice(requesters);
      const createdAt = randomDtBetween(MONTH_STARTS[0], NOW);
      const status = RNG.choices(['pending', 'granted', 'denied'], [25, 55, 20], 1)[0];
      const decidedAt = status !== 'pending' ? addMs(createdAt, RNG.randint(1, 3) * DAY) : null;
      await prisma.permissionRequest.create({
        data: {
          requestedById: requester.id,
          permission: RNG.choice(['Approve fine waivers', 'Override seat booking limit', 'Manage book procurement']),
          reason: RNG.choice(PERMISSION_REASONS),
          status,
          decidedById: status !== 'pending' ? itHead.id : null,
          decidedAt,
          createdAt,
        },
      });
      count += 1;
    }
    console.log(`Seeded ${count} permission requests.`);
  }

  async function seedSupportTickets(members: User[], guardians: User[], staff: Record<string, User[]>): Promise<void> {
    const staffPool = [...staff[Role.ADMIN], ...staff[Role.MANAGER], ...staff[Role.IT_HEAD]];
    const memberCategories = ['book_reservation', 'payment', 'seat_booking', 'harassment', 'offline_library', 'other'];
    const guardianCategories = ['attendance', 'seat_booking', 'payment', 'other'];
    let count = 0;
    let resolved = 0;
    for (let n = 0; n < 20; n++) {
      const isGuardian = RNG.random() < 0.3 && guardians.length > 0;
      const raiser = isGuardian ? RNG.choice(guardians) : RNG.choice(members);
      const category = RNG.choice(isGuardian ? guardianCategories : memberCategories);
      const createdAt = randomDtBetween(raiser.createdAt > MONTH_STARTS[0] ? raiser.createdAt : MONTH_STARTS[0], NOW);
      const status = RNG.choices(['open', 'resolved', 'closed'], [40, 35, 25], 1)[0];
      const resolver = RNG.choice(staffPool);
      const resolvedAt = status !== 'open' ? addMs(createdAt, RNG.randint(1, 5) * DAY) : null;
      const closedAt = status === 'closed' && resolvedAt ? addMs(resolvedAt, DAY) : null;
      await prisma.supportTicket.create({
        data: {
          raisedById: raiser.id,
          category,
          description: SUPPORT_DESCRIPTIONS[category],
          status,
          resolutionNote: status !== 'open' ? 'Resolved after reviewing account activity.' : null,
          resolvedById: status !== 'open' ? resolver.id : null,
          resolvedAt,
          closedAt,
          createdAt,
        },
      });
      count += 1;
      if (status !== 'open') resolved += 1;
      await prisma.notification.create({
        data: { userId: resolver.id, type: 'support-ticket', message: `New support ticket raised: ${category}.`, createdAt },
      });
    }
    console.log(`Seeded ${count} support tickets (${resolved} resolved/closed).`);
  }

  async function seedBookRecords(books: { id: string }[], staff: Record<string, User[]>): Promise<void> {
    const itHead = staff[Role.IT_HEAD][0];
    const notes: Record<string, string> = {
      lost: 'Reported missing during annual stock check.',
      donated: 'Donated by a community member.',
      purchased: 'New copy purchased to meet demand.',
    };
    let count = 0;
    for (let n = 0; n < 10; n++) {
      const book = RNG.choice(books);
      const recordType = RNG.choice(['lost', 'donated', 'purchased']);
      const createdAt = randomDtBetween(MONTH_STARTS[0], NOW);
      await prisma.bookRecord.create({
        data: { bookId: book.id, type: recordType, note: notes[recordType], loggedById: itHead.id, createdAt },
      });
      count += 1;
    }
    console.log(`Seeded ${count} book records.`);
  }

  async function seedAnnouncement(staff: Record<string, User[]>, members: User[]): Promise<void> {
    const admin = staff[Role.ADMIN][0];
    const message = "This month's featured collection is now live — check out the new arrivals shelf!";
    const sentAt = randomDtBetween(MONTH_STARTS[MONTH_STARTS.length - 1], NOW);
    for (const member of members) {
      await prisma.notification.create({
        data: {
          userId: member.id,
          type: 'announcement',
          message,
          createdAt: sentAt,
          // Seeded as already-acknowledged. AnnouncementPopup treats an unread
          // announcement as one the member still has to cross, so leaving these unread
          // would greet every seeded member with a blocking modal for an announcement
          // no admin sent in their session.
          read: true,
        },
      });
    }
    await prisma.auditLogEntry.create({
      data: {
        actorId: admin.id,
        action: 'announcementSent',
        metadata: { message, recipientCount: members.length } as Prisma.InputJsonValue,
        createdAt: sentAt,
      },
    });
    console.log(`Seeded 1 announcement to ${members.length} members.`);
  }

  async function seedContactMessages(staff: Record<string, User[]>): Promise<void> {
    const recipients = [...staff[Role.ADMIN], ...staff[Role.IT_HEAD]];
    for (let i = 0; i < 5; i++) {
      const message =
        `Demo Contact ${i + 1} (demo${i + 1}@example.com, +910000000${i}) at Demo Org — General inquiry\n\n` +
        'Just exploring what the library platform offers.';
      const createdAt = randomDtBetween(MONTH_STARTS[0], NOW);
      for (const recipient of recipients) {
        await prisma.notification.create({
          data: { userId: recipient.id, type: 'contact-message', message, createdAt },
        });
      }
    }
    console.log('Seeded 5 contact messages.');
  }

  // seed_pricing_plans.py's own upsert leaves admin-edited price/savePercent untouched
  // on re-run — this is deliberately different, force-resetting to the baseline every
  // time this batch runs (matches Python's seed_demo_data.py exactly; don't unify the
  // two upsert shapes into one helper).
  for (const plan of PRICING_PLANS) {
    await prisma.pricingPlan.upsert({
      where: { planId: plan.planId },
      create: plan,
      update: plan,
    });
  }
  console.log('Updated pricing plans (1m=₹999 base).');

  const roleIds = await seedRoles();
  const staff = await seedStaff(roleIds);
  const books = await prisma.book.findMany();
  if (books.length === 0) {
    throw new Error('No books found — run seedBooks() first.');
  }

  const members = await seedMembers(roleIds);
  const [guardians] = await seedGuardiansAndChildren(roleIds, members);

  const coupons = await seedCoupons(staff[Role.ADMIN][0].id);
  const plansRows = await prisma.pricingPlan.findMany();
  const plans: Record<string, { planId: string; months: number; price: number }> = {};
  for (const p of plansRows) plans[p.planId] = p;
  await seedMembershipPayments(members, plans, coupons);

  const loans = await seedLoans(members, books, staff);
  await seedReservations(members, books, staff);
  await seedReviewsAndProgress(loans);
  await seedReadingGoals(members);
  await seedLoginActivity(members);
  await seedSeatActivity(members);
  await seedEvents(staff, members, guardians, books);
  await seedCommunity(members, guardians, books);
  await seedExpenses(staff);
  await seedBillingRequests(members, staff);
  await seedPermissionRequests(staff);
  await seedSupportTickets(members, guardians, staff);
  await seedBookRecords(books, staff);
  await seedAnnouncement(staff, members);
  await seedContactMessages(staff);

  const line =
    `\nDone. ${members.length} members, ${guardians.length} guardians, ` +
    `${Object.values(staff).reduce((sum, v) => sum + v.length, 0)} staff created under @${SEED_DOMAIN}.`;
  console.log(line);
  return line;
}
