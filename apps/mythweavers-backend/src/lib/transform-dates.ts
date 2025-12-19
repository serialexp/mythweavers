/**
 * Helper to transform Prisma Date objects to ISO strings for Zod schema validation
 *
 * Prisma returns Date objects for DateTime fields, but our Zod schemas expect
 * ISO string format (z.string().datetime()). This helper transforms the dates
 * to strings before validation.
 */
export function transformDates<T extends { createdAt: Date; updatedAt: Date }>(
  obj: T,
): Omit<T, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string } {
  return {
    ...obj,
    createdAt: obj.createdAt.toISOString(),
    updatedAt: obj.updatedAt.toISOString(),
  }
}

/**
 * Helper to transform only createdAt (for models that don't have updatedAt)
 */
export function transformCreatedAt<T extends { createdAt: Date }>(
  obj: T,
): Omit<T, 'createdAt'> & { createdAt: string } {
  return {
    ...obj,
    createdAt: obj.createdAt.toISOString(),
  }
}
