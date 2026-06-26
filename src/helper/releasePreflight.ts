const NEBULA_VERSION_PATTERN = /^\d+\.\d+\.\d+-nebula\.\d+$/

export type ReleasePreflightInput = {
  packageName: string
  version: string
  tagName?: string
}

export type ReleasePreflightResult = {
  expectedTag: string
  errors: string[]
}

export const getExpectedReleaseTag = (version: string) => `v${version}`

export const validateReleasePreflight = ({
  packageName,
  version,
  tagName,
}: ReleasePreflightInput): ReleasePreflightResult => {
  const expectedTag = getExpectedReleaseTag(version)
  const errors: string[] = []

  if (packageName !== 'nebuladash') {
    errors.push('package.json name must be nebuladash')
  }

  if (!NEBULA_VERSION_PATTERN.test(version)) {
    errors.push('package.json version must use the Nebula release format: x.y.z-nebula.n')
  }

  if (tagName && tagName !== expectedTag) {
    errors.push(`release tag ${tagName} must match package.json version tag ${expectedTag}`)
  }

  return { expectedTag, errors }
}
