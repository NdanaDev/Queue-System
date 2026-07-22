import { Prisma } from "../generated/prisma/client";

// Prisma only recognizes P2002's `meta.target` as field names for
// constraints declared in schema.prisma. The partial unique index behind
// "one active ticket per customer" was hand-written into the migration
// (schema DSL can't express a WHERE clause), so it isn't in Prisma's DMMF —
// meta.target falls back to the raw constraint name string instead.
export function isUniqueConstraintViolation(
  err: unknown,
  constraintName: string,
): boolean {
  if (
    !(err instanceof Prisma.PrismaClientKnownRequestError) ||
    err.code !== "P2002"
  ) {
    return false;
  }

  return JSON.stringify(err.meta?.target ?? "").includes(constraintName);
}
