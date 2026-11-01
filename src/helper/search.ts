export type SearchMatcher = {
  test: (value: string) => boolean
  testAny: (values: string[]) => boolean
}

export type SearchTextPart = {
  text: string
  matched: boolean
}

/**
 * NebulaDash: 统一搜索能力。
 *
 * 上游的搜索是“空白分词 + 每段当正则 + 全部命中（AND）”。NebulaDash 在这之上补三层：
 * 1. NFKC 规范化与小写化（全角字符、兼容字符可命中）；
 * 2. 符号容错（`google-com` / `google_com` 可命中 `google.com`）；
 * 3. 域名 label 变体（`google.com` 也能命中只带 `google` 的规则或组名）。
 *
 * 匹配顺序是先按上游正则匹配，再回退到规范化 / 简化匹配，因此上游正则行为保持不变。
 */

/** 域名后缀与常见噪声 label，不参与变体展开，避免“com”命中一切。 */
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

/** 只保留字母与数字，用于符号容错匹配。 */
export const simplifySearchText = (text: string) => {
  return normalizeSearchText(text).replace(/[^\p{L}\p{N}]+/gu, '')
}

/**
 * 关键词分隔：空格 / 逗号 / 顿号。多关键词之间是 AND。
 *
 * 注意：`|` 不作为分隔符，继续沿用上游“每段当正则”的语义
 * （`香港|故转` 是正则 OR）。这样既不破坏上游用法的习惯，
 * 也避免“同一串输入在不同页面被解释成两种意思”。
 */
export const splitSearchTerms = (value: string) => {
  return normalizeSearchText(value)
    .split(/[\s,，、]+/)
    .map((term) => term.trim())
    .filter((term) => simplifySearchText(term).length > 0)
}

/**
 * 把单个关键词展开成变体：原词 + 域名 label 片段。
 * 例：`google.com` → `['google.com', 'google']`
 */
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

/** 单个关键词的匹配器：正则优先，其次规范化包含，最后符号容错包含。 */
const createTermMatcher = (term: string) => {
  let regex: RegExp | null = null

  try {
    regex = new RegExp(term, 'i')
  } catch {
    regex = null
  }

  const normalizedVariants = getSearchTermVariants(term).map((variant) =>
    normalizeSearchText(variant),
  )
  const simplifiedVariants = normalizedVariants
    .map((variant) => variant.replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter(Boolean)

  return (candidate: string) => {
    if (regex?.test(candidate)) {
      return true
    }

    const normalizedCandidate = normalizeSearchText(candidate)

    if (normalizedVariants.some((variant) => variant && normalizedCandidate.includes(variant))) {
      return true
    }

    const simplifiedCandidate = simplifiedVariants.length
      ? normalizedCandidate.replace(/[^\p{L}\p{N}]+/gu, '')
      : ''

    return simplifiedVariants.some((variant) => simplifiedCandidate.includes(variant))
  }
}

/**
 * NebulaDash 智能搜索匹配器：多关键词 AND，每个关键词内部做正则 + 规范化 + 符号容错。
 * 返回 null 表示没有有效关键词（调用方应当展示全部）。
 */
export const toSmartSearchMatcher = (filter: string): SearchMatcher | null => {
  const terms = splitSearchTerms(filter)

  if (!terms.length) {
    return null
  }

  const matchers = terms.map(createTermMatcher)

  return {
    test: (value) => matchers.every((matcher) => matcher(value)),
    testAny: (values) => matchers.every((matcher) => values.some((value) => matcher(value))),
  }
}

export const toSearchRegexes = (filter: string): RegExp[] | null => {
  const normalizedFilter = filter.trim()

  if (!normalizedFilter) {
    return null
  }

  const tokens = normalizedFilter.split(/\s+/).filter(Boolean)
  const regexes: RegExp[] = []

  for (const token of tokens) {
    try {
      regexes.push(new RegExp(token, 'i'))
    } catch {
      return null
    }
  }

  if (!regexes.length) {
    return null
  }

  return regexes
}

/**
 * 严格正则匹配（上游行为）。
 * 用于“快速过滤正则”这类由用户显式提供正则的入口，不做模糊化。
 */
export const toSearchRegex = (filter: string): SearchMatcher | null => {
  const regexes = toSearchRegexes(filter)

  if (!regexes) {
    return null
  }

  return {
    test: (value) => regexes.every((r) => r.test(value)),
    testAny: (values) => regexes.every((r) => values.some((v) => r.test(v))),
  }
}

const mergeRanges = (ranges: Array<[number, number]>) => {
  if (!ranges.length) {
    return []
  }

  const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const merged: Array<[number, number]> = [sorted[0]]

  for (const [start, end] of sorted.slice(1)) {
    const last = merged[merged.length - 1]

    if (start > last[1]) {
      merged.push([start, end])
    } else {
      last[1] = Math.max(last[1], end)
    }
  }

  return merged
}

/**
 * 符号容错命中时，把“简化文本”的位置映射回原文区间，保证高亮与实际匹配一致。
 */
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
        sourceRanges.push([sourceOffset, sourceEnd])
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

const buildPartsFromRanges = (value: string, ranges: Array<[number, number]>) => {
  if (!ranges.length) {
    return [{ text: value, matched: false }]
  }

  const parts: SearchTextPart[] = []
  let cursor = 0

  for (const [start, end] of mergeRanges(ranges)) {
    if (start > cursor) {
      parts.push({ text: value.slice(cursor, start), matched: false })
    }
    parts.push({ text: value.slice(start, end), matched: true })
    cursor = end
  }

  if (cursor < value.length) {
    parts.push({ text: value.slice(cursor), matched: false })
  }

  return parts.filter((part) => part.text.length > 0)
}

/**
 * 高亮分段。先按原文直接匹配（正则 / 规范化），无命中再回退到符号容错映射，
 * 保证“高亮出现的位置”和“实际匹配成立的原因”一致。
 */
export const getSearchTextParts = (value: string, filter: string): SearchTextPart[] => {
  if (!value) {
    return [{ text: value, matched: false }]
  }

  const terms = splitSearchTerms(filter)

  if (!terms.length) {
    return [{ text: value, matched: false }]
  }

  const directRanges: Array<[number, number]> = []
  const lowerValue = value.toLocaleLowerCase()

  terms.forEach((term) => {
    let regex: RegExp | null = null

    try {
      regex = new RegExp(term, 'i')
    } catch {
      regex = null
    }

    if (regex) {
      const globalRegex = new RegExp(regex.source, `${regex.flags.replace('g', '')}g`)
      let match: RegExpExecArray | null

      while ((match = globalRegex.exec(value))) {
        if (match[0].length > 0) {
          directRanges.push([match.index, match.index + match[0].length])
        } else {
          globalRegex.lastIndex += 1
        }
      }
    }

    getSearchTermVariants(term).forEach((variant) => {
      const needle = normalizeSearchText(variant)

      if (!needle) {
        return
      }

      let start = lowerValue.indexOf(needle)

      while (start !== -1) {
        directRanges.push([start, start + needle.length])
        start = lowerValue.indexOf(needle, start + needle.length)
      }
    })
  })

  if (directRanges.length) {
    return buildPartsFromRanges(value, directRanges)
  }

  return buildPartsFromRanges(
    value,
    terms.flatMap((term) => findSimplifiedMatchRanges(value, term)),
  )
}
