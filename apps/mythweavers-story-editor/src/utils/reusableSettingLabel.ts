export interface ReusableSettingLabelInput {
  name: string
  settingPreview?: string
}

export function reusableSettingLabel(adventure: ReusableSettingLabelInput): string {
  const title = adventure.name.trim()
  if (title && title.toLowerCase() !== 'untitled adventure') return title

  const concept = adventure.settingPreview?.replace(/\s+/g, ' ').trim() ?? ''
  if (!concept) return 'Untitled adventure'
  if (concept.length <= 30) return concept

  const prefix = concept.slice(0, 29)
  const lastWordBoundary = prefix.lastIndexOf(' ')
  const shortened = lastWordBoundary >= 20 ? prefix.slice(0, lastWordBoundary) : prefix
  return `${shortened.trimEnd()}…`
}
