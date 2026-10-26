export type Difficulty = 'Easy' | 'Medium' | 'Hard'

/**
 * The imported spreadsheet currently has unverified difficulty labels.
 * Keep this compatibility type while individual problem JSON files are added;
 * curated problem content itself should use the Difficulty union above.
 */
export type CatalogueDifficulty = Difficulty | 'Unknown'

export interface ProblemExample {
  input: string
  output: string
  explanation?: string
}

export interface ProblemTestCase {
  input: string
  expectedOutput: string
  /**
   * This flag is useful for curated content schemas. Hidden cases must remain
   * in Worker-side storage and must never be serialized into browser responses.
   */
  hidden?: boolean
}

export interface Problem {
  /** Stable internal ID used by local progress and saved drafts. */
  id: string
  /** Stable URL-safe identifier for /problems/:slug. */
  slug?: string
  externalId?: string | null
  title: string
  /** Use Difficulty for reviewed content; Unknown is temporary legacy catalogue data. */
  difficulty: CatalogueDifficulty
  topics: string[]
  acceptance?: string
  /** Original problem statement written for SDSAIFAT, in Markdown. */
  statement: string
  examples: ProblemExample[]
  constraints: string[]
  /** Three progressive hints for curated problems. */
  hints?: [string, string, string] | string[]
  /** Java class body / solution method starter; legacy rows are migrated in batches. */
  starterCode: string
  testCases: ProblemTestCase[]
  /** Suggested complexity descriptions shown in the Solution tab. */
  timeComplexity?: string
  spaceComplexity?: string
  patterns?: string[]
  /** LeetCode official problem URL when an original exists. */
  externalUrl?: string | null
  /** Java method used by the Worker wrapper to call the user's Solution class. */
  methodName?: string
  /** Ordered Java parameter types passed by the Worker driver. */
  paramTypes?: string[]
  /** Result formatting contract understood by the Worker Java driver. */
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

/** Local-only history item; accepted results are written only after Worker judging. */
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
