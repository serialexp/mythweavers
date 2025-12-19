import { Request, Response, Router } from 'express'
import { prisma } from '../../lib/prisma'

const router = Router()

// Health check endpoint with session validation
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Check if there's a session token
    const token = req.cookies?.sessionToken
    let authenticated = false
    let sessionValid = false

    if (token) {
      // Find session and check if it's valid
      const session = await prisma.session.findUnique({
        where: { token },
      })

      if (session) {
        sessionValid = session.expiresAt > new Date()
        authenticated = sessionValid

        // If session is expired, clean it up
        if (!sessionValid) {
          await prisma.session
            .delete({
              where: { id: session.id },
            })
            .catch(() => {
              // Ignore deletion errors
            })
        }
      }
    }

    res.json({
      status: 'ok',
      timestamp: new Date(),
      authenticated,
      sessionValid,
    })
  } catch (_error) {
    // Even if session check fails, return health status
    res.json({
      status: 'ok',
      timestamp: new Date(),
      authenticated: false,
      sessionValid: false,
    })
  }
})

export default router
