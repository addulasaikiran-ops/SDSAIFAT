export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export interface Problem {
  id: string
  title: string
  difficulty: Difficulty
  topics: string[]
  acceptance?: string
  statement: string
  examples: { input: string; output: string; explanation?: string }[]
  constraints: string[]
  starterCode: string
  testCases: { input: string; expectedOutput: string }[]
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