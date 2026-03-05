export function countryCodeToFlag(countryCode: string): string {
  const code = countryCode.toUpperCase()
  const offset = 127397
  return [...code].map((c) => String.fromCodePoint(c.charCodeAt(0) + offset)).join('')
}
