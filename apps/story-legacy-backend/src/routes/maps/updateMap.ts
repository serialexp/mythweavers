import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function updateMap(req: Request, res: Response): Promise<void> {
  try {
    const { storyId, mapId } = req.params
    const { name, imageData, borderColor, landmarks } = req.body

    // Check if map exists
    const existingMap = await prisma.map.findFirst({
      where: { id: mapId, storyId },
    })

    if (!existingMap) {
      res.status(404).json({ error: 'Map not found' })
    }

    let fileId = existingMap.fileId

    // If new imageData is provided, update or create file
    if (imageData) {
      const matches = imageData.match(/^data:([^;]+);base64,(.+)$/)
      if (matches) {
        const mimeType = matches[1]
        const base64Data = matches[2]
        const buffer = Buffer.from(base64Data, 'base64')

        if (fileId) {
          // Update existing file
          await prisma.file.update({
            where: { id: fileId },
            data: {
              mimeType,
              data: buffer,
            },
          })
        } else {
          // Create new file
          const file = await prisma.file.create({
            data: {
              storyId,
              filename: `map_${mapId}.${mimeType.split('/')[1]}`,
              mimeType,
              data: buffer,
            },
          })
          fileId = file.id
        }
      }
    }

    // Update map
    await prisma.map.update({
      where: { id: mapId },
      data: {
        name: name || undefined,
        fileId: fileId || undefined,
        borderColor: borderColor !== undefined ? borderColor : undefined,
      },
    })

    // Update landmarks if provided
    if (landmarks) {
      // Delete existing landmarks
      await prisma.landmark.deleteMany({
        where: { mapId },
      })

      // Create new landmarks
      if (landmarks.length > 0) {
        await prisma.landmark.createMany({
          data: landmarks.map((landmark: any) => ({
            id: landmark.id,
            mapId,
            x: landmark.x,
            y: landmark.y,
            name: landmark.name,
            description: landmark.description,
            type: landmark.type || 'system',
            population: landmark.population,
            industry: landmark.industry,
            color: landmark.color,
            size: landmark.size,
          })),
        })
      }
    }

    // Fetch updated map with landmarks
    const updatedMap = await prisma.map.findUnique({
      where: { id: mapId },
      include: {
        landmarks: true,
      },
    })

    // Return with image data if requested
    let response: any = updatedMap
    if (imageData) {
      response = { ...updatedMap, imageData }
    }

    res.json(response)
  } catch (error: any) {
    console.error('Error updating map:', error)
    console.error('Error stack:', error.stack)

    // Provide more detailed error information
    const errorMessage = error.message || 'Failed to update map'
    const errorDetails = {
      error: errorMessage,
      type: error.constructor.name,
      code: error.code,
      // Include Prisma-specific error details if available
      ...(error.code === 'P2002' && { detail: 'Unique constraint violation' }),
      ...(error.code === 'P2025' && { detail: 'Record not found' }),
    }

    res.status(500).json(errorDetails)
  }
}
