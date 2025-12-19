export function getSection(base: string, url?: string) {
  if (url) {
    const parts = url.replace(base, '').split('/')
    return {
      chapter: parts[0],
      chapterNr: Number.parseInt(parts[0]?.replace(/[^0-9]/g, '') || ''),
      pageNr: parts[1] ? Number.parseInt(parts[1]?.replace(/[^0-9]/g, '') || '') : undefined,
    }
  }
  return {
    chapter: '',
    chapterNr: 0,
    pageNr: undefined,
  }
}

export function arrayBufferToBase64(buffer: Uint8Array) {
  let binary = ''
  const len = buffer.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i])
  }
  return window.btoa(binary)
}
