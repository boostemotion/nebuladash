const DOMAIN_LABEL_IGNORE = new Set([
  'com',
  'net',
  'org',
  'cn',
  'top',
  'xyz',
  'cc',
  'co',
  'io',
  'gov',
  'edu',
  'www',
])

export const normalizeSearchText = (text: string) => {
  return text.normalize('NFKC').toLowerCase().trim()
}

export const simplifySearchText = (text: string) => {
  return normalizeSearchText(text).replace(/[^\p{L}\p{N}]+/gu, '')
}

export const splitSearchTerms = (value: string) => {
  return normalizeSearchText(value)
    .split(/[\s,|，、]+/)
    .map((term) => term.trim())
    .filter((term) => simplifySearchText(term).length > 0)
}

export const matchesSearchTerm = (candidate: string, term: string) => {
  const normalizedCandidate = normalizeSearchText(candidate)

  if (normalizedCandidate.includes(term)) {
    return true
  }

  const simplifiedTerm = simplifySearchText(term)

  if (!simplifiedTerm) {
    return false
  }

  return simplifySearchText(candidate).includes(simplifiedTerm)
}

export const getSearchTermVariants = (term: string) => {
  const variants = new Set<string>([term])
  const normalized = normalizeSearchText(term)

  if (normalized.includes('.')) {
    normalized
      .split('.')
      .map((label) => label.trim())
      .filter((label) => label.length >= 2)
      .filter((label) => !DOMAIN_LABEL_IGNORE.has(label))
      .filter((label) => !/^\d+$/.test(label))
      .forEach((label) => variants.add(label))
  }

  return [...variants]
}

export const matchesSearchTarget = (candidate: string, terms: string[]) => {
  if (terms.length === 0) {
    return true
  }

  return terms.every((term) => {
    const variants = getSearchTermVariants(term)

    return variants.some((variant) => matchesSearchTerm(candidate, variant))
  })
}

export const matchesSearchTargets = (parentName: string, childNames: string[], terms: string[]) => {
  if (terms.length === 0) {
    return true
  }

  return [parentName, ...childNames].some((target) => matchesSearchTarget(target, terms))
}

type HighlightPart = {
  text: string
  matched: boolean
}

const mergeRanges = (ranges: Array<[number, number]>) => {
  if (ranges.length === 0) {
    return []
  }

  const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const merged: Array<[number, number]> = [sorted[0]]

  for (const [start, end] of sorted.slice(1)) {
    const lastRange = merged[merged.length - 1]

    if (start <= lastRange[1]) {
      lastRange[1] = Math.max(lastRange[1], end)
    } else {
      merged.push([start, end])
    }
  }

  return merged
}

const findSimplifiedMatchRanges = (text: string, term: string) => {
  const simplifiedTerm = simplifySearchText(term)

  if (!simplifiedTerm) {
    return []
  }

  let simplifiedText = ''
  const sourceRanges: Array<[number, number]> = []
  let sourceOffset = 0

  for (const sourceChar of text) {
    const sourceEnd = sourceOffset + sourceChar.length
    const normalizedChar = sourceChar.normalize('NFKC').toLocaleLowerCase()

    for (const normalizedCodePoint of normalizedChar) {
      if (/[\p{L}\p{N}]/u.test(normalizedCodePoint)) {
        simplifiedText += normalizedCodePoint
        sourceRanges.push(
          ...Array.from(
            { length: normalizedCodePoint.length },
            () => [sourceOffset, sourceEnd] as [number, number],
          ),
        )
      }
    }

    sourceOffset = sourceEnd
  }

  const ranges: Array<[number, number]> = []
  let matchStart = simplifiedText.indexOf(simplifiedTerm)

  while (matchStart !== -1) {
    ranges.push(...sourceRanges.slice(matchStart, matchStart + simplifiedTerm.length))
    matchStart = simplifiedText.indexOf(simplifiedTerm, matchStart + simplifiedTerm.length)
  }

  return ranges
}

export const buildHighlightedParts = (text: string, query: string): HighlightPart[] => {
  if (!text) {
    return [{ text: '', matched: false }]
  }

  const terms = [...new Set(splitSearchTerms(query).flatMap((term) => getSearchTermVariants(term)))]

  if (terms.length === 0) {
    return [{ text, matched: false }]
  }

  const lowerText = text.toLocaleLowerCase()
  const ranges: Array<[number, number]> = []

  for (const term of terms.sort((a, b) => b.length - a.length)) {
    const needle = term.toLocaleLowerCase()

    if (!needle) {
      continue
    }

    let start = lowerText.indexOf(needle)

    while (start !== -1) {
      ranges.push([start, start + needle.length])
      start = lowerText.indexOf(needle, start + needle.length)
    }
  }

  if (ranges.length === 0) {
    ranges.push(...terms.flatMap((term) => findSimplifiedMatchRanges(text, term)))
  }

  if (ranges.length === 0) {
    return [{ text, matched: false }]
  }

  const mergedRanges = mergeRanges(ranges)
  const parts: HighlightPart[] = []
  let cursor = 0

  for (const [start, end] of mergedRanges) {
    if (start > cursor) {
      parts.push({ text: text.slice(cursor, start), matched: false })
    }

    parts.push({ text: text.slice(start, end), matched: true })
    cursor = end
  }

  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), matched: false })
  }

  return parts.filter((part) => part.text.length > 0)
}
