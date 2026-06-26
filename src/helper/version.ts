export const NEBULADASH_REPOSITORY = 'boostemotion/NebulaDash'

export const getLatestReleaseApiUrl = () =>
  `https://api.github.com/repos/${NEBULADASH_REPOSITORY}/releases/latest`

type ReleaseFetcher = (input: string) => Promise<Response>

export const fetchLatestReleaseTag = async (
  fetcher: ReleaseFetcher = fetch,
): Promise<string | null> => {
  const response = await fetcher(getLatestReleaseApiUrl())

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Release check failed: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as { tag_name?: string }

  return data.tag_name ?? null
}

type ParsedVersion = {
  core: [number, number, number]
  prerelease: string[]
}

const parseVersion = (value: string): ParsedVersion | null => {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(value.trim())

  if (!match) {
    return null
  }

  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4]?.split('.') ?? [],
  }
}

const comparePrereleaseIdentifier = (left: string, right: string) => {
  const leftNumber = /^\d+$/.test(left) ? Number(left) : null
  const rightNumber = /^\d+$/.test(right) ? Number(right) : null

  if (leftNumber !== null && rightNumber !== null) {
    return leftNumber - rightNumber
  }

  if (leftNumber !== null) {
    return -1
  }

  if (rightNumber !== null) {
    return 1
  }

  return left.localeCompare(right)
}

export const isNewerReleaseVersion = (releaseTag: string, currentVersion: string) => {
  const release = parseVersion(releaseTag)
  const current = parseVersion(currentVersion)

  if (!release || !current) {
    return false
  }

  for (let index = 0; index < release.core.length; index++) {
    if (release.core[index] !== current.core[index]) {
      return release.core[index] > current.core[index]
    }
  }

  if (release.prerelease.length === 0 || current.prerelease.length === 0) {
    return release.prerelease.length === 0 && current.prerelease.length > 0
  }

  const maxLength = Math.max(release.prerelease.length, current.prerelease.length)

  for (let index = 0; index < maxLength; index++) {
    const releaseIdentifier = release.prerelease[index]
    const currentIdentifier = current.prerelease[index]

    if (releaseIdentifier === undefined || currentIdentifier === undefined) {
      return releaseIdentifier !== undefined
    }

    const comparison = comparePrereleaseIdentifier(releaseIdentifier, currentIdentifier)

    if (comparison !== 0) {
      return comparison > 0
    }
  }

  return false
}
