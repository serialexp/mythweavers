import type { Message } from '../types/core'

/** Flatten the load-story hierarchy into the message shape used by the editor. */
export function messagesFromStoryExport(exportData: any): Message[] {
  const messages: Message[] = []
  for (const book of exportData?.books ?? []) {
    for (const arc of book.arcs ?? []) {
      for (const chapter of arc.chapters ?? []) {
        for (const scene of chapter.scenes ?? []) {
          for (const message of scene.messages ?? []) {
            const revision = message.revision
            if (!revision) continue
            const paragraphs = (revision.paragraphs ?? []).map((paragraph: any) => ({
              id: paragraph.id,
              body: paragraph.revision?.body ?? '',
              contentSchema: paragraph.revision?.contentSchema ?? null,
              state: (paragraph.revision?.state ?? 'draft').toLowerCase(),
              comments: [],
              plotPointActions: paragraph.revision?.plotPointActions ?? [],
              inventoryActions: paragraph.revision?.inventoryActions ?? [],
            }))
            messages.push({
              id: message.id,
              role: 'assistant',
              content: paragraphs.map((paragraph: { body: string }) => paragraph.body).join('\n\n'),
              paragraphs,
              instruction: message.instruction ?? undefined,
              script: message.script ?? undefined,
              timestamp: new Date(message.createdAt),
              order: message.sortOrder,
              sceneId: scene.id,
              currentMessageRevisionId: message.currentMessageRevisionId,
              isQuery: message.isQuery ?? false,
              think: revision.think ?? undefined,
              model: revision.model ?? undefined,
              tokensPerSecond: revision.tokensPerSecond ?? undefined,
              totalTokens: revision.totalTokens ?? undefined,
              promptTokens: revision.promptTokens ?? undefined,
              type: message.type ?? undefined,
              options: message.options ?? undefined,
              backgroundFileId: message.backgroundFileId ?? undefined,
              backgroundFile: message.backgroundFile ?? undefined,
              audioFileId: message.audioFileId ?? undefined,
              audioFile: message.audioFile ?? undefined,
            })
          }
        }
      }
    }
  }
  return messages.sort((a, b) => a.order - b.order)
}
