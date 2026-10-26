import type { ActivityDay } from '../types'

const toLocalDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const fromDateKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function calculateStreaks(activity: ActivityDay[], now = new Date()) {
  const solvedDates = new Set(activity.filter((day) => day.solved > 0).map((day) => day.date))
  const today = toLocalDateKey(now)
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = toLocalDateKey(yesterdayDate)

  let currentStreak = 0
  const cursor = fromDateKey(solvedDates.has(today) ? today : yesterday)
  while (solvedDates.has(toLocalDateKey(cursor))) {
    currentStreak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  let longestStreak = 0
  let run = 0
  const sorted = [...solvedDates].sort()
  let previous: Date | null = null
  for (const key of sorted) {
    const date = fromDateKey(key)
    if (previous) {
      const diff = Math.round((date.getTime() - previous.getTime()) / 86400000)
      run = diff === 1 ? run + 1 : 1
    } else {
      run = 1
    }
    longestStreak = Math.max(longestStreak, run)
    previous = date
  }

  return { currentStreak, longestStreak, solvedToday: solvedDates.has(today) }
}

export function buildActivityGrid(activity: ActivityDay[], weeks = 20, now = new Date()) {
  const byDate = new Map(activity.map((day) => [day.date, day.solved]))
  const end = new Date(now)
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - (weeks * 7 - 1))

  return Array.from({ length: weeks * 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const key = toLocalDateKey(date)
    return { date: key, count: byDate.get(key) ?? 0, future: date > end }
  })
}