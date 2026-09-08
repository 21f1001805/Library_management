// Mirrors backend/src/app/db/pagination.py's paginate() — count + find_many, returned
// together so callers building a `{ items, total, page, page_size }` response never
// forget one half. Untyped args: Prisma's per-model delegate arg types are too strict to
// unify generically here — callers still get full type checking on the args object they
// build (bookRepo.listBooks's where/orderBy are still Prisma.BookWhereInput etc.), this
// wrapper just isn't the thing enforcing it.
interface Paginatable<T> {
  count: (args: { where: any }) => Promise<number>; // eslint-disable-line @typescript-eslint/no-explicit-any
  findMany: (args: any) => Promise<T[]>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export async function paginate<T>(
  model: Paginatable<T>,
  args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, unknown>;
    skip: number;
    take: number;
    include?: Record<string, unknown>;
  },
): Promise<[T[], number]> {
  const total = await model.count({ where: args.where });
  const items = await model.findMany(args);
  return [items, total];
}
