export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export type StdinFormat = 'line-based' | 'tokenized' | 'json' | 'custom'

/** One visible sample, shown in the problem statement and testcase drawer. */
export interface ProblemExample {
  input: string
  output: string
  explanation: string
}

/** A case consumed by the Java driver. Client-side cases are not secret. */
export interface ProblemTestCase {
  input: string
  expectedOutput: string
  hidden: boolean
}

/** Describes the method contract and how raw stdin is converted to arguments. */
export interface ProblemDriverConfig {
  methodName: string
  /** Java type names in method-parameter order, e.g. ['int[]', 'int']. */
  parameterTypes: string[]
  /** Java return type, e.g. 'int[]', 'boolean', or 'void'. */
  returnType: string
  stdinFormat: StdinFormat
  /** Explicit instructions/schema used by the driver to parse stdin. */
  stdinParsing: string
}

/**
 * Canonical, fully curated problem definition loaded on demand from
 * src/data/problems/<slug>.json.
 */
export interface Problem {
  /** Stable catalogue/progress key. */
  id: string
  slug: string
  title: string
  difficulty: Difficulty
  topics: string[]
  patterns: string[]
  /** Markdown source; render with a Markdown renderer in the UI. */
  statement: string
  examples: ProblemExample[]
  constraints: string[]
  /** Exactly three hints, ordered from a gentle nudge to a near-solution. */
  hints: [string, string, string]
  /** Java starter source; should declare class Solution and the required method. */
  starterCode: string
  driver: ProblemDriverConfig
  testCases: ProblemTestCase[]
  timeComplexity: string
  spaceComplexity: string
  solutionApproach: string
  relatedSlugs: string[]
  externalUrl: string | null
  /** Optional source-platform identifier, e.g. a LeetCode problem number. */
  externalId?: string | null
}

/**
 * Lightweight catalogue entry used to render/search the 350-row index without
 * importing full problem statements, hints, starter code, or test cases.
 *
 * This compatibility type is intentionally separate from canonical Problem.
 * Migrate each catalogue row to src/data/problems/<slug>.json as it is curated.
 */
export interface CatalogueProblem {
  id: string
  slug: string
  externalId?: string | null
  title: string
  difficulty: Difficulty | 'Unknown'
  topics: string[]
  acceptance?: string
  statement: string
  examples: Array<{ input: string; output: string; explanation?: string }>
  constraints: string[]
  hints?: [string, string, string] | string[]
  starterCode: string
  testCases: Array<{ input: string; expectedOutput: string; hidden?: boolean }>
  timeComplexity?: string
  spaceComplexity?: string
  patterns?: string[]
  externalUrl?: string | null
  methodName?: string
  paramTypes?: string[]
  outputMode?: string
  status?: 'Not Started' | 'In Progress' | 'Solved'
  sheetOrder?: number
}

export interface ActivityDay {
  date: string
  solved: number
}

export interface UserProgress {
  solvedProblemIds: string[]
  activity: ActivityDay[]
  currentStreak: number
  longestStreak: number
}

/** Local-only history item; accepted results should only follow server-side judging. */
export interface SubmissionRecord {
  id: string
  problemId: string
  createdAt: string
  verdict: 'Accepted' | 'Wrong Answer' | 'Time Limit Exceeded' | 'Runtime Error' | 'Compile Error' | 'Error'
  timeMs?: number | null
  memoryKb?: number | null
  stdout?: string
  expectedOutput?: string
  actualOutput?: string
}
