import { prisma } from '../../lib/prisma'

export async function saveMessageVersion(
  storyId: string,
  messageId: string,
  versionType: 'regeneration' | 'edit' | 'rewrite' | 'cli_edit',
  content: string,
  instruction?: string | null,
  model?: string | null,
) {
  try {
    // Get the current highest version number for this message
    const latestVersion = await prisma.messageVersion.findFirst({
      where: {
        storyId,
        messageId,
      },
      orderBy: {
        version: 'desc',
      },
      select: {
        version: true,
      },
    })

    const nextVersion = (latestVersion?.version ?? 0) + 1

    // Create the new version
    await prisma.messageVersion.create({
      data: {
        storyId,
        messageId,
        versionType,
        content,
        instruction: instruction ?? null,
        model: model ?? null,
        version: nextVersion,
      },
    })

    return nextVersion
  } catch (error) {
    console.error('Error saving message version:', error)
    throw error
  }
}
