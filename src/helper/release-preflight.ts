const NEBULA_VERSION_PATTERN = /^\d+\.\d+\.\d+-nebula\.\d+(?:\.\d+)*$/
const NEBULA_TAG_PATTERN = /^v\d+\.\d+\.\d+-nebula\.\d+(?:\.\d+)*$/

export type ReleasePreflightInput = {
  packageName: string
  version: string
  tagName?: string
}

export type ReleasePreflightResult = {
  expectedTag: string
  errors: string[]
  warnings: string[]
}

export const getExpectedReleaseTag = (version: string) => `v${version}`

/**
 * 发布前检查。
 *
 * 版本号的唯一真相是 Release tag：自动发版由工作流按上一个 tag 递增并在构建时注入
 * `APP_VERSION`，不会把版本号提交回仓库（避免本地与远端分叉）。
 * 因此 `package.json` 的版本与 tag 不一致时，仅输出警告，不会直接失败。
 */
export const validateReleasePreflight = ({
  packageName,
  version,
  tagName,
}: ReleasePreflightInput): ReleasePreflightResult => {
  const expectedTag = tagName ?? getExpectedReleaseTag(version)
  const errors: string[] = []
  const warnings: string[] = []

  if (packageName !== 'nebuladash') {
    errors.push('package.json name must be nebuladash')
  }

  if (tagName) {
    if (!NEBULA_TAG_PATTERN.test(tagName)) {
      errors.push(`release tag ${tagName} must match v<x.y.z>-nebula.a[.b[.c]]`)
    }
  } else if (!NEBULA_VERSION_PATTERN.test(version)) {
    errors.push('package.json version must use the Nebula release format: x.y.z-nebula.a[.b[.c]]')
  }

  if (tagName && NEBULA_VERSION_PATTERN.test(version) && tagName !== `v${version}`) {
    warnings.push(
      `package.json version ${version} differs from release tag ${tagName}; ` +
        'shipping the tag version via APP_VERSION',
    )
  }

  return { expectedTag, errors, warnings }
}
