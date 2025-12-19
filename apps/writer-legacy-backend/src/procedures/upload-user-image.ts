import { createHash } from 'node:crypto'
import sharp from 'sharp'
import z from 'zod'
import { prisma } from '../prisma.js'
import { protectedProcedure } from '../trpc.js'
import { uploadFile } from '../util/file-storage.js'

export const uploadUserImage = protectedProcedure
  .input(
    z.object({
      path: z.string(),
      dataBase64: z.string(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const data = Buffer.from(input.dataBase64, 'base64')
    const sha256 = createHash('sha256').update(data).digest('hex')

    // Save the image to a database
    const meta = await sharp(data).metadata()
    const imageType = meta.format
    if (!['png', 'jpeg', 'webp'].includes(imageType ?? 'asdf89')) {
      throw new Error('Invalid image type')
    }

    const pathHash = createHash('sha256').update(input.path).digest('hex')
    const storagePath = `upload/${ctx.authenticatedUser.id}/${pathHash}.${imageType}`

    const existingFile = await prisma.file.findFirst({
      where: {
        ownerId: ctx.authenticatedUser.id,
        path: storagePath,
      },
    })

    if (!existingFile || existingFile.sha256 !== sha256) {
      await uploadFile(data, storagePath, `image/${imageType}`)
    }
    const result = await prisma.file.upsert({
      where: {
        path: storagePath,
        ownerId: ctx.authenticatedUser.id,
      },
      create: {
        ownerId: ctx.authenticatedUser.id,
        path: storagePath,
        localPath: input.path,
        mimeType: `image/${imageType}`,
        width: meta.width,
        height: meta.height,
        bytes: meta.size,
        sha256,
      },
      update: {
        mimeType: `image/${imageType}`,
        localPath: input.path,
        width: meta.width,
        height: meta.height,
        bytes: meta.size,
        sha256,
      },
    })
    return {
      ...result,
      fullUrl: `https://team.wtf/${storagePath}`,
    }
  })
