import { expect, test } from 'playwright/test'

/**
 * This is intentionally a live, opt-in characterization test. It loads the
 * large local story used to investigate lazy hydration, then freezes the
 * initial editor view before the loading protocol changes.
 *
 * It never creates, edits, or deletes data. Supply credentials only through
 * E2E_USERNAME and E2E_PASSWORD; do not commit them or a storage-state file.
 */
const storyId = process.env.E2E_STORY_ID ?? 'tbf4y09mitxjmtvvpavb9us8'
const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD
const sessionToken = process.env.E2E_SESSION_TOKEN

if (!sessionToken && (!username || !password)) {
  test.skip(true, 'Set E2E_SESSION_TOKEN or E2E_USERNAME and E2E_PASSWORD to run the live story characterization test.')
}

test.describe('server story initial load', () => {
  test('hydrates the current story editor view without errors', async ({ page }) => {
    const browserErrors: string[] = []
    const requests: string[] = []
    const sceneIds: string[] = []
    page.on('request', (request) => requests.push(request.url()))
    page.on('response', async (response) => {
      if (!response.url().includes(`/my/stories/${storyId}/outline`)) return
      const body = await response.json()
      sceneIds.push(
        ...body.nodes.filter((node: { kind: string }) => node.kind === 'scene').map((node: { id: string }) => node.id),
      )
    })
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text())
    })
    page.on('pageerror', (error) => browserErrors.push(error.message))

    if (sessionToken) {
      await page.context().addCookies([
        {
          name: 'sessionToken',
          value: sessionToken,
          url: process.env.E2E_EDITOR_URL ?? 'http://localhost:3203',
        },
      ])
      await page.goto(`/story/${storyId}`)
    } else {
      await page.goto(`/login?redirect=${encodeURIComponent(`/story/${storyId}`)}`)
      await page.getByPlaceholder('johndoe or you@example.com').fill(username!)
      await page.getByPlaceholder('••••••••').fill(password!)
      await page.getByRole('button', { name: 'Login' }).click()
    }

    await expect(page).toHaveURL(new RegExp(`/story/${storyId}$`), { timeout: 30_000 })
    await expect(page.getByText('Loading story...')).toBeHidden({ timeout: 120_000 })

    // The selected node and its messages are the visible proof that the full
    // current load path has populated the editor, rather than merely drawing
    // the shell. Keep this structural assertion alongside the screenshot so
    // copy/layout changes do not weaken the regression signal.
    await expect(page.locator('main, [role="main"]').first()).toBeVisible()
    await expect(page.locator('body')).toContainText('Ahsoka - Broken Chains')
    await expect(page.getByText('Book 1', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Life and Death', { exact: true }).first()).toBeVisible()
    expect(requests.some((url) => url.includes(`/my/stories/${storyId}/load-story`))).toBe(false)
    expect(requests.some((url) => url.includes(`/my/stories/${storyId}/outline`))).toBe(true)
    expect(requests.some((url) => /\/my\/nodes\/[^/]+\/content/.test(url))).toBe(true)

    // Capture the initial viewport, not a full-page image: a full story can be
    // tens of thousands of paragraphs tall and would make a brittle, enormous
    // fixture. This is the exact first view a writer gets after selecting it.
    await expect(page).toHaveScreenshot('story-initial-load.png', {
      mask: [page.locator('canvas')],
    })

    await page.getByRole('button', { name: 'Close modal' }).click()
    const firstSceneId = requests
      .find((url) => /\/my\/nodes\/[^/]+\/content/.test(url))
      ?.match(/\/my\/nodes\/([^/]+)\/content/)?.[1]
    const secondSceneId = sceneIds.find((id) => id !== firstSceneId)
    expect(secondSceneId).toBeTruthy()
    const contentRequestsBeforeSceneChange = requests.filter((url) => /\/my\/nodes\/[^/]+\/content/.test(url)).length
    await page.evaluate((sceneId) => {
      document.querySelector(`[title*="Scene ID: ${sceneId}"]`)?.parentElement?.click()
    }, secondSceneId)
    await expect
      .poll(() => requests.filter((url) => /\/my\/nodes\/[^/]+\/content/.test(url)).length)
      .toBeGreaterThan(contentRequestsBeforeSceneChange)
    expect(requests.some((url) => url.includes(`/my/stories/${storyId}/load-story`))).toBe(false)

    // A server-backed story is intentionally absent from IndexedDB after load;
    // that cleanup path logs this harmless message today.
    expect(browserErrors.filter((error) => !error.includes(`Story with id ${storyId} not found in storage`))).toEqual(
      [],
    )
  })
})
