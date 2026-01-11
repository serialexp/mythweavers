import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { getUserFromSession } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'

// Simple HTML template for the device page
function renderDevicePage(options: {
  loggedIn: boolean
  username?: string
  error?: string
  success?: string
  userCode?: string
  loginUrl: string
}) {
  const { loggedIn, username, error, success, userCode, loginUrl } = options

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize Device - MythWeavers</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #e0e0e0;
    }
    .container {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 40px;
      max-width: 400px;
      width: 100%;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    h1 {
      font-size: 24px;
      margin-bottom: 8px;
      color: #fff;
    }
    .subtitle {
      color: #888;
      margin-bottom: 24px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
    }
    input[type="text"] {
      width: 100%;
      padding: 14px 16px;
      font-size: 20px;
      font-family: monospace;
      letter-spacing: 2px;
      text-align: center;
      text-transform: uppercase;
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.3);
      color: #fff;
      outline: none;
      transition: border-color 0.2s;
    }
    input[type="text"]:focus {
      border-color: #6366f1;
    }
    input[type="text"]::placeholder {
      color: #666;
      letter-spacing: 4px;
    }
    button {
      width: 100%;
      padding: 14px;
      font-size: 16px;
      font-weight: 600;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: transform 0.1s, box-shadow 0.2s;
    }
    button:hover {
      transform: translateY(-1px);
    }
    button:active {
      transform: translateY(0);
    }
    .btn-primary {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: #fff;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .error {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.5);
      color: #fca5a5;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .success {
      background: rgba(34, 197, 94, 0.2);
      border: 1px solid rgba(34, 197, 94, 0.5);
      color: #86efac;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .user-info {
      background: rgba(99, 102, 241, 0.1);
      border: 1px solid rgba(99, 102, 241, 0.3);
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #6366f1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
    }
    .login-prompt {
      text-align: center;
    }
    .login-prompt p {
      margin-bottom: 16px;
      color: #aaa;
    }
    .instructions {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 14px;
      color: #888;
    }
    .instructions ol {
      margin-left: 20px;
      margin-top: 8px;
    }
    .instructions li {
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Authorize Device</h1>
    <p class="subtitle">Connect a Claude Artifact to your account</p>

    ${error ? `<div class="error">${error}</div>` : ''}
    ${success ? `<div class="success">${success}</div>` : ''}

    ${loggedIn ? `
      <div class="user-info">
        <div class="user-avatar">${(username || 'U').charAt(0).toUpperCase()}</div>
        <span>Logged in as <strong>${username}</strong></span>
      </div>

      ${!success ? `
        <form method="POST" action="/device">
          <div class="form-group">
            <label for="user_code">Enter the code from your artifact:</label>
            <input
              type="text"
              id="user_code"
              name="user_code"
              placeholder="ABCD-1234"
              value="${userCode || ''}"
              maxlength="9"
              autocomplete="off"
              autofocus
              required
            >
          </div>
          <button type="submit" class="btn-primary">Authorize Device</button>
        </form>
      ` : `
        <p style="text-align: center; color: #86efac;">
          You can close this page and return to Claude.
        </p>
      `}
    ` : `
      <div class="login-prompt">
        <p>Please log in to authorize this device.</p>
        <a href="${loginUrl}">
          <button type="button" class="btn-primary">Log in to MythWeavers</button>
        </a>
      </div>
    `}

    <div class="instructions">
      <strong>How it works:</strong>
      <ol>
        <li>The Claude Artifact shows you a code</li>
        <li>Enter that code above</li>
        <li>Click Authorize to connect</li>
        <li>Return to Claude - you're connected!</li>
      </ol>
    </div>
  </div>
</body>
</html>`
}

const devicePageRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /device - Show the device authorization page
  fastify.get(
    '/',
    {
      schema: {
        description: 'Device authorization page',
        tags: ['oauth'],
        querystring: z.object({
          code: z.string().optional().meta({
            description: 'Pre-filled user code',
            example: 'ABCD-1234',
          }),
        }),
        produces: ['text/html'],
      },
    },
    async (request, reply) => {
      const user = await getUserFromSession(request)
      const { code } = request.query as { code?: string }

      const editorUrl = process.env.EDITOR_URL || 'http://localhost:3200'
      const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3201}`
      const loginUrl = `${editorUrl}/login?redirect=${encodeURIComponent(`${apiUrl}/device${code ? `?code=${code}` : ''}`)}`

      reply.type('text/html')
      return renderDevicePage({
        loggedIn: !!user,
        username: user?.username,
        userCode: code,
        loginUrl,
      })
    },
  )

  // POST /device - Handle device authorization form submission
  fastify.post(
    '/',
    {
      schema: {
        description: 'Authorize a device code',
        tags: ['oauth'],
        consumes: ['application/x-www-form-urlencoded'],
        produces: ['text/html'],
      },
    },
    async (request, reply) => {
      const user = await getUserFromSession(request)
      const body = request.body as { user_code?: string }

      const editorUrl = process.env.EDITOR_URL || 'http://localhost:3200'
      const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3201}`
      const loginUrl = `${editorUrl}/login?redirect=${encodeURIComponent(`${apiUrl}/device`)}`

      reply.type('text/html')

      if (!user) {
        return renderDevicePage({
          loggedIn: false,
          loginUrl,
          error: 'Please log in first',
        })
      }

      const userCode = body.user_code?.trim()
      if (!userCode) {
        return renderDevicePage({
          loggedIn: true,
          username: user.username,
          loginUrl,
          error: 'Please enter the code from your artifact',
        })
      }

      // Normalize user code
      const normalizedCode = userCode.toUpperCase().replace(/\s+/g, '')
      const formattedCode = normalizedCode.includes('-')
        ? normalizedCode
        : `${normalizedCode.slice(0, 4)}-${normalizedCode.slice(4)}`

      // Find and validate device code
      const deviceCodeRecord = await prisma.deviceCode.findUnique({
        where: { userCode: formattedCode },
      })

      if (!deviceCodeRecord) {
        return renderDevicePage({
          loggedIn: true,
          username: user.username,
          userCode: userCode,
          loginUrl,
          error: 'Invalid code. Please check and try again.',
        })
      }

      if (deviceCodeRecord.expiresAt < new Date()) {
        await prisma.deviceCode.delete({
          where: { id: deviceCodeRecord.id },
        })
        return renderDevicePage({
          loggedIn: true,
          username: user.username,
          loginUrl,
          error: 'This code has expired. Please request a new one from your artifact.',
        })
      }

      if (deviceCodeRecord.approved) {
        return renderDevicePage({
          loggedIn: true,
          username: user.username,
          loginUrl,
          error: 'This code has already been used.',
        })
      }

      // Approve the device code
      await prisma.deviceCode.update({
        where: { id: deviceCodeRecord.id },
        data: {
          approved: true,
          userId: user.id,
        },
      })

      return renderDevicePage({
        loggedIn: true,
        username: user.username,
        loginUrl,
        success: 'Device authorized! You can now close this page and return to Claude.',
      })
    },
  )
}

export default devicePageRoutes
