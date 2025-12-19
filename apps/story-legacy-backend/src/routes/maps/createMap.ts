import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function createMap(req: Request, res: Response): Promise<void> {
  try {
    const { storyId } = req.params
    const { id, name, imageData, borderColor, landmarks = [] } = req.body

    // Validate story exists
    const story = await prisma.story.findUnique({
      where: { id: storyId },
    })

    if (!story) {
      res.status(404).json({ error: 'Story not found' })
    }

    let fileId = null

    // If imageData is provided, save it as a file
    if (imageData) {
      // Extract mime type from data URL
      const matches = imageData.match(/^data:([^;]+);base64,(.+)$/)
      if (matches) {
        const mimeType = matches[1]
        const base64Data = matches[2]
        const buffer = Buffer.from(base64Data, 'base64')

        // Create file record
        const file = await prisma.file.create({
          data: {
            storyId,
            filename: `map_${id}.${mimeType.split('/')[1]}`,
            mimeType,
            data: buffer,
          },
        })

        fileId = file.id
      }
    }

    // Create map with landmarks
    const map = await prisma.map.create({
      data: {
        id,
        storyId,
        name,
        fileId,
        borderColor,
        landmarks: {
          create: landmarks.map((landmark: any) => ({
            id: landmark.id,
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
        },
      },
      include: {
        landmarks: true,
      },
    })

    // Return map with image data
    const response = {
      ...map,
      imageData: imageData || null,
    }

    res.json(response)
  } catch (error: any) {
    console.error('Error creating map:', error)
    console.error('Error stack:', error.stack)

    // Provide more detailed error information
    const errorMessage = error.message || 'Failed to create map'
    const errorDetails = {
      error: errorMessage,
      type: error.constructor.name,
      code: error.code,
      // Include Prisma-specific error details if available
      ...(error.code === 'P2002' && { detail: 'Map with this ID already exists' }),
      ...(error.code === 'P2003' && { detail: 'Foreign key constraint failed' }),
    }

    res.status(500).json(errorDetails)
  }
}
