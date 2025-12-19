export const detectFirstPerson = (text: string): boolean => {
  const sample = text.slice(0, 100)
  return /\b(I|my|me|mine)\b/i.test(sample)
}
