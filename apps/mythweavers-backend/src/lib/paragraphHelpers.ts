import type { ParagraphState, Prisma, PrismaClient } from '@prisma/client'

export interface BulkParagraphInput {
  id?: string
  body: string
  contentSchema?: string | null
  state?: string | null
  sortOrder?: number
  script?: string | null
  plotPointActions?: any
  inventoryActions?: any
}

// Type for Prisma transaction client
type TransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

/**
 * Create multiple paragraphs in a message revision within a transaction.
 * This is the shared logic used by both messages-batch and paragraphs-batch endpoints.
 *
 * @param tx - Prisma transaction client
 * @param messageRevisionId - The revision to attach paragraphs to
 * @param paragraphs - Array of paragraph data to create
 * @returns Array of created paragraph IDs
 */
export async function createParagraphsBulk(
  tx: TransactionClient,
  messageRevisionId: string,
  paragraphs: BulkParagraphInput[],
): Promise<string[]> {
  const createdIds: string[] = []

  for (let i = 0; i < paragraphs.length; i++) {
    const paraData = paragraphs[i]
    const sortOrder = paraData.sortOrder ?? i

    // Create paragraph with initial revision
    // Note: We intentionally don't pass client-provided IDs to avoid duplicate key errors
    // The server always generates paragraph IDs for bulk operations
    const paragraph = await tx.paragraph.create({
      data: {
        messageRevisionId,
        sortOrder,
        paragraphRevisions: {
          create: {
            version: 1,
            body: paraData.body,
            contentSchema: paraData.contentSchema || null,
            state: (paraData.state as ParagraphState) || null,
            script: paraData.script || null,
            plotPointActions: (paraData.plotPointActions || null) as Prisma.InputJsonValue,
            inventoryActions: (paraData.inventoryActions || null) as Prisma.InputJsonValue,
          },
        },
      },
    })

    // Get the created revision ID
    const revision = await tx.paragraphRevision.findFirst({
      where: { paragraphId: paragraph.id },
      orderBy: { version: 'desc' },
    })

    if (revision) {
      // Update paragraph with currentParagraphRevisionId
      await tx.paragraph.update({
        where: { id: paragraph.id },
        data: { currentParagraphRevisionId: revision.id },
      })
    }

    createdIds.push(paragraph.id)
  }

  return createdIds
}
