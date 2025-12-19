import { Router } from 'express'
import { login } from './login'
import { logout } from './logout'
import { register } from './register'
import { requestPasswordReset } from './requestPasswordReset'
import { resetPassword, validateResetToken } from './resetPassword'
import { checkSession } from './session'

const router = Router()

router.post('/auth/register', register)
router.post('/auth/login', login)
router.post('/auth/logout', logout)
router.get('/auth/session', checkSession)
router.post('/auth/request-password-reset', requestPasswordReset)
router.post('/auth/reset-password', resetPassword)
router.get('/auth/validate-reset-token/:token', validateResetToken)

export default router
