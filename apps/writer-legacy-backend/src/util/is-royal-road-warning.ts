export const isRoyalRoadWarning = (text: string) =>
  text.match(/If you [a-zA-Z]+ this [a-zA-Z]+ on Amazon/i) ||
  text.match(/Read [a-zA-Z ]+ on Royal Road/i) ||
  text.match(/If you [a-zA-Z ]+ this [a-zA-Z ]+ on Amazon/i) ||
  text.includes("Stolen from it's rightful place, this narrativ") ||
  text.match(/Stolen content (alert|warning):/i) ||
  text.match(/This [a-zA-Z]+ has been [a-zA-Z ]+ from Royal Road/i) ||
  text.match(/(This|The) [a-zA-Z]+ has been taken without permission/i) ||
  text.includes('author gets credit') ||
  text.includes('Find the genuine version on the author') ||
  text.match(/(This|The) author's tale has been [a-zA-Z ]+/i) ||
  text.includes('Find this and other great novels') ||
  text.match(/This [a-zA-Z]+ is [a-zA-Z]+ elsewhere/i)
