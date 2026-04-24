import { type Browser, type BrowserContext, type Page, firefox } from 'playwright'
import { decryptSecret } from '../crypto.js'
import { prisma } from '../prisma.js'

/**
 * Minimal Playwright driver for Royal Road.
 *
 * Scope: enough surface to let the publishing worker (Phase C) log in, create
 * new chapters, update existing ones, and cache cookies between runs. The
 * public methods treat the browser context as an implementation detail — each
 * one opens a context, does its work, closes the context.
 *
 * Why Firefox: the legacy writer used Playwright + Firefox against RR with
 * no captcha friction. We mirror that until it breaks.
 *
 * Headless policy: the legacy writer ran `headless: false` because it was
 * launched from a desktop Tauri app and gave the user a visual fallback for
 * captchas. The backend worker runs on a server, so we default to headless
 * and let operators override via ROYAL_ROAD_HEADLESS=false when debugging.
 *
 * Session reuse: we persist Playwright `storageState` on `RoyalRoadAccount`
 * so we can skip the login form when cookies are still valid. When the
 * dashboard page redirects us to /account/login, we re-authenticate with the
 * stored password and refresh the cache.
 */

export class RoyalRoadLoginError extends Error {
  override name = 'RoyalRoadLoginError'
}

export class RoyalRoadDomError extends Error {
  override name = 'RoyalRoadDomError'
}

const BASE_URL = 'https://www.royalroad.com'
const LOGIN_URL = `${BASE_URL}/account/login`
const HOME_URL = `${BASE_URL}/home`

/**
 * Create a Royal Road client session for the given user. Callers MUST call
 * `dispose()` when done — preferably via `using` (TC39 explicit resource
 * management is supported in Bun) or in a try/finally.
 */
export async function openSession(userId: number): Promise<RoyalRoadSession> {
  const account = await prisma.royalRoadAccount.findUnique({ where: { userId } })
  if (!account) {
    throw new RoyalRoadLoginError(`No Royal Road account is connected for user ${userId}`)
  }
  const headless = process.env.ROYAL_ROAD_HEADLESS !== 'false'
  const browser = await firefox.launch({ headless })
  let context: BrowserContext
  try {
    const storageState = account.storageStateJson as
      | Parameters<Browser['newContext']>[0] extends infer T
        ? T extends { storageState?: infer S }
          ? S
          : never
        : never
      | undefined
    context = await browser.newContext(
      storageState && typeof storageState === 'object' ? { storageState } : {},
    )
  } catch (err) {
    await browser.close()
    throw err
  }
  return new RoyalRoadSession(userId, account.id, account.email, browser, context)
}

export class RoyalRoadSession {
  constructor(
    private readonly userId: number,
    private readonly accountId: string,
    private readonly email: string,
    private readonly browser: Browser,
    private readonly context: BrowserContext,
  ) {}

  async dispose(): Promise<void> {
    try {
      await this.context.close()
    } catch {
      // Swallow — we're shutting down anyway.
    }
    try {
      await this.browser.close()
    } catch {
      // ibid.
    }
  }

  /**
   * Ensure we have a logged-in session. If the cached cookies are still good
   * we just hit /home; otherwise we fall back to filling the login form with
   * the stored (decrypted) password, then persist the refreshed storageState.
   *
   * Throws `RoyalRoadLoginError` when the password is rejected or we can't
   * determine that we're logged in. On throw, the account's `lastError` is
   * updated in the DB so the worker can surface it to the user.
   */
  async ensureLoggedIn(): Promise<void> {
    const page = await this.context.newPage()
    try {
      const resp = await page.goto(HOME_URL, { waitUntil: 'domcontentloaded' })
      const landedOn = page.url()
      if (resp?.ok() && landedOn.startsWith(HOME_URL)) {
        // Cached session still valid.
        await this.touchLastLogin()
        return
      }
      // Not logged in — fall through to form login.
      await this.loginWithPassword(page)
      await this.persistStorageState()
      await this.touchLastLogin()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await prisma.royalRoadAccount.update({
        where: { id: this.accountId },
        data: { lastError: truncate(message, 500) },
      })
      if (err instanceof RoyalRoadLoginError) throw err
      throw new RoyalRoadLoginError(`Royal Road login failed: ${message}`)
    } finally {
      await page.close()
    }
  }

  private async loginWithPassword(page: Page): Promise<void> {
    const account = await prisma.royalRoadAccount.findUnique({
      where: { id: this.accountId },
      select: { encryptedPassword: true },
    })
    if (!account) throw new RoyalRoadLoginError('Account was disconnected mid-login')
    const password = decryptSecret(account.encryptedPassword)

    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' })
    await page.fill('input#email', this.email)
    await page.fill('input#password', password)
    await page.click('form.form-login-details button[type="submit"]')
    // Royal Road redirects to /home on success. Anything else (still on
    // /account/login, or a captcha challenge page) counts as a failure.
    try {
      await page.waitForURL(HOME_URL, { timeout: 15_000 })
    } catch {
      throw new RoyalRoadLoginError(
        `Login form submission did not land on /home (current URL: ${page.url()}). ` +
          'This usually means the password is wrong or a captcha was triggered.',
      )
    }
  }

  private async persistStorageState(): Promise<void> {
    const state = await this.context.storageState()
    await prisma.royalRoadAccount.update({
      where: { id: this.accountId },
      data: {
        // Cast through unknown because Prisma's Json type is narrower than
        // Playwright's storageState shape, but the values are compatible.
        storageStateJson: state as unknown as Parameters<
          typeof prisma.royalRoadAccount.update
        >[0]['data']['storageStateJson'],
        lastError: null,
      },
    })
  }

  private async touchLastLogin(): Promise<void> {
    await prisma.royalRoadAccount.update({
      where: { id: this.accountId },
      data: { lastLoginAt: new Date(), lastError: null },
    })
  }

  /**
   * Publish (update) an existing Royal Road chapter. Fills Title + pastes
   * the HTML payload into the TinyMCE Source dialog, clicks Save twice.
   *
   * Throws `RoyalRoadDomError` when the expected selectors aren't present.
   * Callers are responsible for writing ChapterPublishing status.
   */
  async updateChapter(
    royalRoadChapterId: number,
    title: string,
    htmlContent: string,
  ): Promise<void> {
    const page = await this.context.newPage()
    try {
      const url = `${BASE_URL}/author-dashboard/chapters/edit/${royalRoadChapterId}`
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded' })
      if (!resp || resp.status() !== 200) {
        throw new RoyalRoadDomError(
          `Chapter edit page returned status ${resp?.status() ?? 'unknown'} at ${url}`,
        )
      }
      await page.waitForSelector('#Title', { timeout: 10_000 })
      await page.fill('#Title', title)
      await this.pasteTinyMceSource(page, htmlContent)
      await page.click('button.btn-primary:has-text("Save Changes")')
      // Give RR a moment to persist; on slow networks the page may still be
      // mid-save when we navigate away. 2s is conservative but cheap.
      await page.waitForTimeout(2_000)
    } finally {
      await page.close()
    }
  }

  /**
   * Create a new chapter on the given Royal Road story. Returns the numeric
   * Royal Road chapter id parsed from the redirect URL so the caller can
   * store it on the Chapter row.
   *
   * Creation UI is at /author-dashboard/chapters/new/{royalRoadStoryId}. The
   * legacy writer never exercised this flow; selectors may drift. Phase 2
   * testing will tell us whether we need a second pass.
   */
  async createChapter(
    royalRoadStoryId: number,
    title: string,
    htmlContent: string,
  ): Promise<number> {
    const page = await this.context.newPage()
    try {
      const url = `${BASE_URL}/author-dashboard/chapters/new/${royalRoadStoryId}`
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded' })
      if (!resp || resp.status() !== 200) {
        throw new RoyalRoadDomError(
          `Chapter create page returned status ${resp?.status() ?? 'unknown'} at ${url}`,
        )
      }
      await page.waitForSelector('#Title', { timeout: 10_000 })
      await page.fill('#Title', title)
      await this.pasteTinyMceSource(page, htmlContent)
      await page.click('button.btn-primary:has-text("Publish"), button.btn-primary:has-text("Save")')
      // After creation RR redirects to the edit page at /edit/{id}. Parse
      // the id out of the URL once we see a URL matching that pattern.
      await page.waitForURL(/\/author-dashboard\/chapters\/edit\/\d+/, { timeout: 15_000 })
      const match = page.url().match(/\/author-dashboard\/chapters\/edit\/(\d+)/)
      if (!match) {
        throw new RoyalRoadDomError(
          `Chapter create succeeded but we could not parse the new chapter id from ${page.url()}`,
        )
      }
      return Number(match[1])
    } finally {
      await page.close()
    }
  }

  /**
   * Common logic for pasting HTML into the TinyMCE Source dialog. Extracted
   * so `updateChapter` and `createChapter` stay in sync.
   *
   * TinyMCE's Source-code button is the second `.tox-tinymce` instance on
   * the page (author notes take the first slot). We open the dialog,
   * replace the textarea content, click the dialog's Save button.
   */
  private async pasteTinyMceSource(page: Page, html: string): Promise<void> {
    const sourceButton = page.locator(
      '(//div[@class="tox tox-tinymce"])[2]//button[@title="Source code"]',
    )
    try {
      await sourceButton.click({ timeout: 10_000 })
    } catch (err) {
      throw new RoyalRoadDomError(
        `Could not open TinyMCE Source dialog — selector may have drifted. ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
    }
    await page.waitForSelector('.tox-dialog-wrap .tox-textarea', { timeout: 5_000 })
    await page.fill('.tox-dialog-wrap .tox-textarea', html)
    await page.click('.tox-dialog__footer button:has-text("Save")')
    // Wait for the dialog to close before clicking the outer Save Changes.
    await page.waitForSelector('.tox-dialog-wrap', { state: 'hidden', timeout: 5_000 })
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}\u2026`
}
