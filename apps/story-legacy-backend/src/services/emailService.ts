import * as postmark from 'postmark'
import { logger } from '../lib/logger'

const log = logger.child({ module: 'email-service' })

// Initialize Postmark client
const postmarkClient = process.env.POSTMARK_API_KEY ? new postmark.ServerClient(process.env.POSTMARK_API_KEY) : null

export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  if (!postmarkClient) {
    log.warn('Postmark API key not configured, skipping email send')
    return
  }

  try {
    const result = await postmarkClient.sendEmail({
      From: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
      To: email,
      Subject: 'Password Reset Request',
      HtmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>You requested a password reset for your account. Click the link below to reset your password:</p>
          <p>
            <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
              Reset Password
            </a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all;">${resetLink}</p>
          <p>This link will expire in 30 minutes.</p>
          <p>If you did not request this password reset, please ignore this email.</p>
        </div>
      `,
      TextBody: `Password Reset Request

You requested a password reset for your account. Visit the following link to reset your password:

${resetLink}

This link will expire in 30 minutes.

If you did not request this password reset, please ignore this email.`,
    })

    log.info({ email, messageId: result.MessageID }, 'Password reset email sent successfully')
  } catch (error: any) {
    // Log the full error details from Postmark
    log.error(
      {
        error: {
          message: error.message,
          statusCode: error.statusCode,
          code: error.code,
          name: error.name,
          ErrorCode: error.ErrorCode,
          Message: error.Message,
          // Include the full error object for debugging
          fullError: JSON.stringify(error, null, 2),
        },
        email,
        fromEmail: process.env.FROM_EMAIL,
        resetLink,
      },
      'Failed to send password reset email - Full Postmark error details',
    )
    throw new Error('Failed to send password reset email')
  }
}

export async function sendPasswordChangedEmail(email: string): Promise<void> {
  if (!postmarkClient) {
    log.warn('Postmark API key not configured, skipping email send')
    return
  }

  try {
    const result = await postmarkClient.sendEmail({
      From: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
      To: email,
      Subject: 'Password Changed',
      HtmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Changed</h2>
          <p>Your password has been successfully changed.</p>
          <p>If you did not make this change, please contact support immediately.</p>
        </div>
      `,
      TextBody: `Password Changed

Your password has been successfully changed.

If you did not make this change, please contact support immediately.`,
    })

    log.info({ email, messageId: result.MessageID }, 'Password changed email sent successfully')
  } catch (error: any) {
    // Log the full error details from Postmark
    log.error(
      {
        error: {
          message: error.message,
          statusCode: error.statusCode,
          code: error.code,
          name: error.name,
          ErrorCode: error.ErrorCode,
          Message: error.Message,
          fullError: JSON.stringify(error, null, 2),
        },
        email,
        fromEmail: process.env.FROM_EMAIL,
      },
      'Failed to send password changed email - Full Postmark error details',
    )
    // Don't throw here - password was successfully changed, email is just a notification
  }
}
