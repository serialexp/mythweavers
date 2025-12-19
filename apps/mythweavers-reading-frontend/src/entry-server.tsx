// @refresh reload
import { chronicleTheme, starlightTheme } from '@mythweavers/ui/theme'
import { StartServer, createHandler } from '@solidjs/start/server'
import { getCookie } from 'vinxi/http'

function getThemeClass(): string {
  try {
    const themeCookie = getCookie('writer-ui-theme')
    if (themeCookie === 'chronicle') {
      return chronicleTheme
    }
    if (themeCookie === 'starlight') {
      return starlightTheme
    }
    // Default to starlight for 'system' or undefined
    return starlightTheme
  } catch {
    return starlightTheme
  }
}

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en" class={getThemeClass()}>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
))
