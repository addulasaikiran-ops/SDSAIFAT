import type { Problem } from '../types'

type ProblemModule = () => Promise<Problem>

/**
 * Vite turns each JSON file into its own async chunk. Only the requested
 * problem's JSON is downloaded when loadProblem(slug) is called.
 *
 * IMPORTANT: JSON imported by browser code is public. Do not put genuinely
 * secret hidden test cases in these files; keep those on the server/Judge0
 * judging service. The hidden flag is metadata, not access control.
 */
const problemModules = import.meta.glob<Problem>('./problems/*.json', {
  import: 'default',
}) as Record<string, ProblemModule>

const cache = new Map<string, Promise<Problem>>()
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function validateProblem(value: Problem, requestedSlug: string): Problem {
  if (!value || typeof value !== 'object') {
    throw new Error(`Problem "${requestedSlug}" has an invalid JSON payload.`)
  }

  const errors: string[] = []
  if (value.slug !== requestedSlug) errors.push('slug must match the filename')
  if (!value.id || typeof value.id !== 'string') errors.push('id is required')
  if (!value.title || typeof value.title !== 'string') errors.push('title is required')
  if (!['Easy', 'Medium', 'Hard'].includes(value.difficulty)) errors.push('difficulty must be Easy, Medium, or Hard')
  for (const field of ['topics', 'patterns', 'constraints', 'examples', 'testCases', 'relatedSlugs'] as const) {
    if (!Array.isArray(value[field])) errors.push(`${field} must be an array`)
  }
  if (typeof value.statement !== 'string') errors.push('statement must be a Markdown string')
  if (typeof value.starterCode !== 'string' || !value.starterCode.includes('class Solution')) {
    errors.push('starterCode must declare class Solution')
  }
  if (!Array.isArray(value.hints) || value.hints.length !== 3 || value.hints.some((hint) => typeof hint !== 'string' || !hint.trim())) {
    errors.push('hints must contain exactly three non-empty progressive hints')
  }
  if (!value.driver || typeof value.driver.methodName !== 'string' ||
      !Array.isArray(value.driver.parameterTypes) ||
      typeof value.driver.returnType !== 'string' ||
      typeof value.driver.stdinParsing !== 'string' ||
      !['line-based', 'tokenized', 'json', 'custom'].includes(value.driver.stdinFormat)) {
    errors.push('driver must define methodName, parameterTypes, returnType, stdinFormat, and stdinParsing')
  }
  if (typeof value.timeComplexity !== 'string') errors.push('timeComplexity is required')
  if (typeof value.spaceComplexity !== 'string') errors.push('spaceComplexity is required')
  if (typeof value.solutionApproach !== 'string') errors.push('solutionApproach is required')
  if (!Array.isArray(value.examples) || value.examples.some((item) =>
    typeof item?.input !== 'string' || typeof item?.output !== 'string' || typeof item?.explanation !== 'string')) {
    errors.push('each example must define input, output, and explanation strings')
  }
  if (!Array.isArray(value.testCases) || value.testCases.some((item) =>
    typeof item?.input !== 'string' || typeof item?.expectedOutput !== 'string' || typeof item?.hidden !== 'boolean')) {
    errors.push('each test case must define input, expectedOutput, and hidden')
  }
  if (!Array.isArray(value.relatedSlugs) || value.relatedSlugs.some((slug) => typeof slug !== 'string')) {
    errors.push('relatedSlugs must contain strings')
  }
  if (value.externalUrl !== null && typeof value.externalUrl !== 'string') errors.push('externalUrl must be a string or null')

  if (errors.length) {
    throw new Error(`Invalid problem JSON "${requestedSlug}": ${errors.join('; ')}.`)
  }
  return value
}

/** Return slugs for JSON files present at build time, without loading their contents. */
export function listAvailableProblemSlugs(): string[] {
  return Object.keys(problemModules)
    .map((path) => path.slice('./problems/'.length, -'.json'.length))
    .sort()
}

/** Load and validate one problem JSON file on demand. Successful loads are cached. */
export function loadProblem(slug: string): Promise<Problem> {
  if (!slugPattern.test(slug)) {
    return Promise.reject(new Error(`Invalid problem slug "${slug}". Use lowercase letters, numbers, and hyphens.`))
  }

  const cached = cache.get(slug)
  if (cached) return cached

  const path = `./problems/${slug}.json`
  const importer = problemModules[path]
  if (!importer) {
    return Promise.reject(new Error(`No problem data found for "${slug}". Add src/data/problems/${slug}.json.`))
  }

  const pending = importer()
    .then((problem) => validateProblem(problem, slug))
    .catch((error: unknown) => {
      cache.delete(slug)
      throw error
    })

  cache.set(slug, pending)
  return pending
}

/** Start loading a problem without awaiting it (for hover/next-problem prefetch). */
export function preloadProblem(slug: string): void {
  void loadProblem(slug).catch(() => {
    // Preloading is best-effort; loadProblem reports missing or invalid data when awaited.
  })
}
