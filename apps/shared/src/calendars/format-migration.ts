import type { CalendarConfig } from './types.js'

/**
 * Convert the former `{variable}` date-format syntax to EJS output tags.
 *
 * Calendar display templates used to be interpolated by a bespoke formatter.
 * They are now rendered by EJS, whose equivalent interpolation syntax is
 * `<%= variable %>`. This intentionally applies only to `display`: braces in
 * subdivision `labelFormat` values (such as `Week {n}`) retain their original
 * meaning.
 */
function migrateLegacyFormat(format: string): string {
  return format.replace(/\{([A-Za-z_$][\w$]*)\}/g, '<%= $1 %>')
}

/**
 * Return a calendar configuration whose legacy display placeholders use EJS.
 *
 * The input is left untouched because calendar configurations are also held in
 * Solid stores and passed to editor props. Current templates are returned by
 * reference to avoid needless reactive updates.
 */
export function normalizeCalendarConfigFormats(config: CalendarConfig): CalendarConfig {
  const defaultFormat = migrateLegacyFormat(config.display.defaultFormat)
  const shortFormat = migrateLegacyFormat(config.display.shortFormat)

  if (defaultFormat === config.display.defaultFormat && shortFormat === config.display.shortFormat) {
    return config
  }

  return {
    ...config,
    display: {
      ...config.display,
      defaultFormat,
      shortFormat,
    },
  }
}
