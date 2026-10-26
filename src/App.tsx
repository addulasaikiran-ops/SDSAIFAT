import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDownUp, ArrowRight, BookOpen, Check, ChevronDown, CircleHelp, Code2, Command, Flame, Gauge, ListFilter, LogOut, Menu, Search, Settings2, ShieldCheck, Sparkles, Trophy, X, Zap
} from 'lucide-react'
import { problems } from './data/problems'
import WorkspacePage from './components/WorkspacePage'
import { buildActivityGrid, calculateStreaks } from './lib/streak'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { ActivityDay, Problem } from './types'

type View = 'dashboard' | 'problems' | 'workspace' | 'progress'
type RunState = 'idle' | 'running' | 'done' | 'error'

type PracticeStatus = NonNullable<Problem['status']>
type SavedPracticeState = {
  statuses: Record<string, PracticeStatus>
  drafts: Record<string, string>
  stdinByProblem: Record<string, string>
  activity: ActivityDay[]
}

const PRACTICE_STORAGE_KEY = 'sdsaifat-practice-v1'
const emptyPracticeState: SavedPracticeState = { statuses: {}, drafts: {}, stdinByProblem: {}, activity: [] }

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return [year, month, day].join('-')
}

function readPracticeState(): SavedPracticeState {
  if (typeof window === 'undefined') return emptyPracticeState
  try {
    const raw = window.localStorage.getItem(PRACTICE_STORAGE_KEY)
    if (!raw) return emptyPracticeState
    const parsed = JSON.parse(raw) as Partial<SavedPracticeState>
    const allowedStatuses: PracticeStatus[] = ['Not Started', 'In Progress', 'Solved']
    const statuses: Record<string, PracticeStatus> = {}
    const drafts: Record<string, string> = {}
    const stdinByProblem: Record<string, string> = {}
    if (parsed.statuses && typeof parsed.statuses === 'object') {
      for (const [id, status] of Object.entries(parsed.statuses)) {
        if (allowedStatuses.includes(status as PracticeStatus)) statuses[id] = status as PracticeStatus
      }
    }
    if (parsed.drafts && typeof parsed.drafts === 'object') {
      for (const [id, draft] of Object.entries(parsed.drafts)) {
        if (typeof draft === 'string') drafts[id] = draft
      }
    }
    if (parsed.stdinByProblem && typeof parsed.stdinByProblem === 'object') {
      for (const [id, input] of Object.entries(parsed.stdinByProblem)) {
        if (typeof input === 'string') stdinByProblem[id] = input
      }
    }
    const activity = Array.isArray(parsed.activity)
      ? parsed.activity.filter((day) => day && typeof day.date === 'string' && Number.isFinite(day.solved) && day.solved > 0)
      : []
    return { statuses, drafts, stdinByProblem, activity }
  } catch {
    return emptyPracticeState
  }
}

const starterCode = 'public class Main {\n    public static void main(String[] args) {\n        // Write your Java code here\n        System.out.println("Hello, SDSAIFAT!");\n    }\n}'

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [difficulty, setDifficulty] = useState('All')
  const [topicFilter, setTopicFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [practiceState, setPracticeState] = useState<SavedPracticeState>(readPracticeState)
  const [code, setCode] = useState(starterCode)
  const [stdin, setStdin] = useState('')
  const [output, setOutput] = useState('')
  const [runState, setRunState] = useState<RunState>('idle')
  const [isRunning, setIsRunning] = useState(false)
  const [user, setUser] = useState<{ email?: string; name?: string; avatar?: string } | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [showAuthNotice, setShowAuthNotice] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      const current = data.session?.user
      if (current) {
        setUser({
          email: current.email,
          name: current.user_metadata?.full_name ?? current.email?.split('@')[0],
          avatar: current.user_metadata?.avatar_url,
        })
      }
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const current = session?.user
      setUser(current ? {
        email: current.email,
        name: current.user_metadata?.full_name ?? current.email?.split('@')[0],
        avatar: current.user_metadata?.avatar_url,
      } : null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(practiceState))
    } catch {
      // Keep the session usable if browser storage is unavailable.
    }
  }, [practiceState])

  const streaks = useMemo(() => calculateStreaks(practiceState.activity), [practiceState.activity])
  const activityGrid = useMemo(() => buildActivityGrid(practiceState.activity, 20), [practiceState.activity])
  const solvedCount = useMemo(() => problems.filter((problem) => practiceState.statuses[problem.id] === 'Solved').length, [practiceState.statuses])
  const inProgressCount = useMemo(() => problems.filter((problem) => practiceState.statuses[problem.id] === 'In Progress').length, [practiceState.statuses])
  const completionPercent = Math.round((solvedCount / problems.length) * 100)
  const activeDays = practiceState.activity.filter((day) => day.solved > 0).length
  const hasWrittenCode = Object.entries(practiceState.drafts).some(([id, draft]) => {
    const problem = problems.find((item) => item.id === id)
    return Boolean(problem && draft.trim() && draft.trim() !== problem.starterCode.trim())
  })
  const getProblemStatus = (problemId: string): PracticeStatus => practiceState.statuses[problemId] ?? 'Not Started'

  const filteredProblems = useMemo(() => problems.filter((problem) => {
    const query = searchQuery.toLowerCase()
    const status = practiceState.statuses[problem.id] ?? 'Not Started'
    return (problem.title.toLowerCase().includes(query) || problem.topics.some((topic) => topic.toLowerCase().includes(query)))
      && (difficulty === 'All' || problem.difficulty === difficulty)
      && (topicFilter === 'All' || problem.topics.includes(topicFilter))
      && (statusFilter === 'All' || status === statusFilter)
  }), [searchQuery, difficulty, topicFilter, statusFilter, practiceState.statuses])

  const signIn = async () => {
    if (!supabase) {
      setShowAuthNotice(true)
      return
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setOutput(`Google sign-in failed: ${error.message}`)
  }

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut()
    setUser(null)
  }

  const openProblem = (problem: Problem) => {
    setSelectedProblem(problem)
    setCode(practiceState.drafts[problem.id] ?? problem.starterCode)
    setStdin(practiceState.stdinByProblem[problem.id] ?? '')
    setOutput('')
    setView('workspace')
  }

  const handleStdinChange = (value: string) => {
    setStdin(value)
    if (!selectedProblem) return
    setPracticeState((previous) => ({
      ...previous,
      stdinByProblem: { ...previous.stdinByProblem, [selectedProblem.id]: value },
    }))
  }

  const handleCodeChange = (value: string) => {
    setCode(value)
    if (!selectedProblem) return
    setPracticeState((previous) => {
      const currentStatus = previous.statuses[selectedProblem.id] ?? 'Not Started'
      const nextStatus: PracticeStatus = currentStatus === 'Solved' ? 'Solved' : value.trim() ? 'In Progress' : 'Not Started'
      return {
        ...previous,
        drafts: { ...previous.drafts, [selectedProblem.id]: value },
        statuses: { ...previous.statuses, [selectedProblem.id]: nextStatus },
      }
    })
  }

  const markProblemSolved = (problem: Problem) => {
    setPracticeState((previous) => {
      if (previous.statuses[problem.id] === 'Solved') return previous
      const today = localDateKey()
      const existingDay = previous.activity.find((day) => day.date === today)
      const activity = existingDay
        ? previous.activity.map((day) => day.date === today ? { ...day, solved: day.solved + 1 } : day)
        : [...previous.activity, { date: today, solved: 1 }]
      return {
        ...previous,
        statuses: { ...previous.statuses, [problem.id]: 'Solved' },
        activity,
      }
    })
    setOutput('Marked as solved in your local tracker. This is self-reported; the app has not automatically judged this problem against verified test cases.')
    setRunState('idle')
  }

  const resetCurrentCode = () => {
    if (!selectedProblem) return
    setCode(selectedProblem.starterCode)
    setPracticeState((previous) => {
      const drafts = { ...previous.drafts }
      delete drafts[selectedProblem.id]
      return {
        ...previous,
        drafts,
        statuses: previous.statuses[selectedProblem.id] === 'Solved'
          ? previous.statuses
          : { ...previous.statuses, [selectedProblem.id]: 'Not Started' },
      }
    })
    setOutput('Starter code restored. Your edited draft was cleared.')
    setRunState('idle')
  }
  const moveProblem = (direction: -1 | 1) => {
    if (!selectedProblem) return
    const currentIndex = problems.findIndex((problem) => problem.id === selectedProblem.id)
    const nextProblem = problems[currentIndex + direction]
    if (nextProblem) openProblem(nextProblem)
  }

  const runCode = async () => {
    setIsRunning(true)
    setRunState('running')
    setOutput('Compiling and running Java 17…')
    if (selectedProblem) {
      setPracticeState((previous) => ({
        ...previous,
        drafts: { ...previous.drafts, [selectedProblem.id]: code },
        statuses: previous.statuses[selectedProblem.id] === 'Solved'
          ? previous.statuses
          : { ...previous.statuses, [selectedProblem.id]: 'In Progress' },
      }))
    }
    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ source_code: code, stdin }),
      })
      const result = await response.json() as {
        stdout?: string | null
        stderr?: string | null
        compile_output?: string | null
        message?: string | null
        error?: string
        detail?: string
        status?: { id?: number; description?: string } | null
        time?: string | null
        memory?: number | null
      }
      if (!response.ok) throw new Error([result.error, result.detail].filter(Boolean).join(': ') || `Execution request failed (${response.status}).`)
      const details = result.stderr || result.compile_output || result.message
      const statusText = result.status?.description
      const stdout = result.stdout?.trimEnd()
      const metrics = [result.time ? `Time: ${result.time}s` : '', result.memory ? `Memory: ${result.memory} KB` : ''].filter(Boolean).join(' · ')
      setOutput([statusText, details, stdout, metrics].filter(Boolean).join('\n\n') || 'Execution completed with no output.')
      setRunState(result.status && result.status.id !== 3 ? 'error' : details ? 'error' : 'done')
    } catch (error) {
      setOutput(error instanceof Error ? error.message : 'Could not run code.')
      setRunState('error')
    } finally {
      setIsRunning(false)
    }
  }

  const submitCode = () => {
    if (!selectedProblem) return
    if (!selectedProblem.testCases.length) {
      setOutput('Not submitted for judging: this catalogue entry has no verified test cases yet. Run code to check compilation/output, and add official or reviewed test cases before enabling Accepted/Wrong Answer results.')
      setRunState('idle')
      return
    }
    setOutput('Automated multi-test judging is not enabled yet. The test cases need to be wired to the execution service before a submission can receive an accepted verdict.')
    setRunState('idle')
  }

  const navItems: { id: View; label: string; icon: typeof Gauge }[] = [
    { id: 'dashboard', label: 'Overview', icon: Gauge },
    { id: 'problems', label: 'Problem set', icon: Code2 },
    { id: 'progress', label: 'Activity', icon: Activity },
  ]

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <button className="brand" onClick={() => setView('dashboard')} aria-label="SDSAIFAT home">
          <span className="brand-mark"><Code2 size={19} /></span>
          <span className="brand-copy"><strong>sdsaifat<span>.</span></strong><small>DSA PRACTICE STUDIO</small></span>
        </button>
        <div className="workspace-switcher">
          <div className="switcher-icon"><Command size={16} /></div>
          <div><b>Personal workspace</b><small>Free plan</small></div>
          <ChevronDown size={15} className="muted-icon" />
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="side-nav">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${view === id || (id === 'problems' && view === 'workspace') ? 'active' : ''}`} onClick={() => { setView(id); setMobileNav(false) }}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
              {id === 'problems' && <span className="nav-count">{problems.length}</span>}
            </button>
          ))}
        </nav>
        <div className="nav-caption nav-caption-spaced">YOUR ROUTINE</div>
        <div className="routine-card">
          <div className="routine-icon"><Flame size={17} /></div>
          <div className="routine-copy"><strong>{streaks.currentStreak} day streak</strong><small>Keep your momentum</small></div>
          <span className="routine-dot" />
        </div>
        <div className="sidebar-bottom">
          <div className="help-card"><CircleHelp size={16} /><span><b>Need a hand?</b><small>Make every session count.</small></span><ArrowRight size={14} /></div>
          <div className="profile-row">
            {user?.avatar ? <img src={user.avatar} alt="" className="avatar" /> : <div className="avatar avatar-placeholder">{user ? (user.name ?? 'U').charAt(0).toUpperCase() : 'G'}</div>}
            <div className="profile-meta"><b>{user?.name ?? 'Guest learner'}</b><small>{user?.email ?? 'Sign in to save progress'}</small></div>
            {user ? <button className="icon-button" onClick={signOut} title="Sign out"><LogOut size={16} /></button> : <button className="icon-button" onClick={signIn} title="Sign in with Google"><ArrowRight size={16} /></button>}
          </div>
        </div>
      </aside>

      {mobileNav && <button aria-label="Close navigation" className="mobile-scrim" onClick={() => setMobileNav(false)} />}
      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={18} /></button>
            <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><b>{view === 'dashboard' ? 'Overview' : view === 'problems' ? 'Problem set' : view === 'progress' ? 'Activity' : selectedProblem?.title ?? 'Workspace'}</b></div>
          </div>
          <div className="topbar-actions">
            <div className="online-status"><span /> Drafts save on this device</div>
            <button className="icon-button topbar-bell" title="Open problem set" onClick={() => setView('problems')}><BookOpen size={17} /></button>
            <button className="topbar-avatar" onClick={user ? signOut : signIn} title={user ? 'Sign out' : 'Sign in with Google'}>
              {user?.avatar ? <img src={user.avatar} alt="" /> : user ? (user.name ?? 'U').charAt(0).toUpperCase() : <span>G</span>}
            </button>
          </div>
        </header>

        {view === 'workspace' && selectedProblem ? (
          <WorkspacePage
            problem={selectedProblem}
            code={code}
            stdin={stdin}
            output={output}
            runState={runState}
            isRunning={isRunning}
            status={getProblemStatus(selectedProblem.id)}
            onCodeChange={handleCodeChange}
            onStdinChange={handleStdinChange}
            onRun={runCode}
            onSubmit={submitCode}
            onReset={resetCurrentCode}
            onMarkSolved={() => markProblemSolved(selectedProblem)}
            onPrevious={() => moveProblem(-1)}
            onNext={() => moveProblem(1)}
            onBack={() => setView('problems')}
            hasPrevious={problems.findIndex((p) => p.id === selectedProblem.id) > 0}
            hasNext={problems.findIndex((p) => p.id === selectedProblem.id) < problems.length - 1}
          ) : view === 'problems' ? (
          <section className="content-page">
            <div className="page-heading"><div><div className="eyebrow">BUILD YOUR FOUNDATION</div><h1>Problem set<span>.</span></h1><p>A deliberate set of problems, one good solution at a time.</p></div><div className="heading-stamp"><Code2 size={16} /> JAVA TRACK</div></div>
            <div className="problem-summary-row"><div className="mini-stat"><span>Total problems</span><b>{problems.length}</b></div><div className="mini-stat"><span>In progress</span><b>{inProgressCount}</b></div><div className="mini-stat"><span>Completion</span><b>{completionPercent}%</b></div></div>
            <div className="panel table-panel">
              <div className="table-toolbar"><div className="search-box"><Search size={16} /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search problems or topics..." /></div><div className="filter-controls"><label><ListFilter size={15} />{problems.some((problem) => problem.difficulty !== 'Unknown') && <select aria-label="Filter by difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="All">All difficulties</option><option>Easy</option><option>Medium</option><option>Hard</option><option>Unknown</option></select>}<select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="All">All statuses</option><option>Not Started</option><option>In Progress</option><option>Solved</option></select><select aria-label="Filter by topic" value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}><option value="All">All topics</option>{Array.from(new Set(problems.flatMap((problem) => problem.topics))).sort().map((topic) => <option key={topic} value={topic}>{topic}</option>)}</select></label><button className="button-secondary compact-button" onClick={() => { setSearchQuery(''); setDifficulty('All'); setTopicFilter('All'); setStatusFilter('All') }}><ArrowDownUp size={14} /> Reset</button></div></div>
              {filteredProblems.length ? <div className="problem-table"><div className="problem-table-head"><span>STATUS</span><span>TITLE</span><span>DIFFICULTY</span><span>TOPICS</span><span /></div>{filteredProblems.map((problem) => { const status = getProblemStatus(problem.id); const statusClass = status.toLowerCase().replace(' ', '-'); return <button className="problem-table-row" key={problem.id} onClick={() => openProblem(problem)}><span className="problem-status"><span className={"status-dot status-" + statusClass} title={status} aria-label={status} /></span><b>{problem.externalId && <span className="problem-number">#{problem.externalId}</span>}{problem.title}</b><span><i className={"difficulty-text " + problem.difficulty.toLowerCase()}>{problem.difficulty === 'Unknown' ? 'Not tagged' : problem.difficulty}</i>{problem.externalUrl && <a className="problem-external-link" href={problem.externalUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>LeetCode ↗</a>}</span><span className="topic-cell">{problem.topics.slice(0, 2).join(' · ')}</span><ArrowRight size={15} /></button>})}</div> : <div className="empty-problems"><div className="empty-icon"><BookOpen size={22} /></div><h3>No matching problems</h3><p>Try another search or clear your filters to see the full catalogue.</p><button className="button-secondary" onClick={() => { setSearchQuery(''); setDifficulty('All'); setTopicFilter('All'); setStatusFilter('All') }}>Clear filters <ArrowDownUp size={14} /></button></div>}
            </div>
            <div className="footnote"><ShieldCheck size={15} /> Your practice list stays focused on the problems you choose.</div>
          </section>
        ) : view === 'progress' ? (
          <section className="content-page">
            <div className="page-heading"><div><div className="eyebrow">CONSISTENCY OVER INTENSITY</div><h1>Your activity<span>.</span></h1><p>Small sessions add up. Keep showing up.</p></div><div className="heading-stamp"><Flame size={16} /> DAILY ROUTINE</div></div>
            <div className="stats-grid"><StatCard icon={<Flame size={17} />} label="Current streak" value={String(streaks.currentStreak)} unit="days" tint="orange" detail="Consecutive days with a solve" /><StatCard icon={<Trophy size={17} />} label="Longest streak" value={String(streaks.longestStreak)} unit="days" tint="purple" detail="Your personal best" /><StatCard icon={<Check size={17} />} label="Problems solved" value={String(solvedCount)} unit="total" tint="green" detail="Self-reported completions" /><StatCard icon={<Activity size={17} />} label="Active days" value={String(activeDays)} unit="days" tint="blue" detail="Days you marked a solve" /></div>
            <ActivityPanel grid={activityGrid} />
          </section>
        ) : (
          <section className="content-page">
            <div className="welcome-row"><div><div className="eyebrow"><Sparkles size={13} /> YOUR PERSONAL DSA SPACE</div><h1>Make progress,<br /><span>one problem at a time.</span></h1><p>A focused place to practice, learn patterns, and build a habit that sticks.</p><div className="welcome-actions"><button className="button-primary" onClick={() => setView('problems')}>Explore problems <ArrowRight size={15} /></button><button className="button-secondary" onClick={user ? signOut : signIn}>{user ? <LogOut size={15} /> : <ArrowRight size={15} />}{user ? 'Sign out' : 'Continue with Google'}</button></div></div><div className="hero-art"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-center"><Code2 size={44} strokeWidth={1.35} /><span>DSA</span></div><div className="float-chip chip-top"><Zap size={14} /> Keep building</div><div className="float-chip chip-bottom"><Check size={14} /> Every day counts</div></div></div>
            <div className="stats-grid"><StatCard icon={<Check size={17} />} label="Problems solved" value={String(solvedCount)} unit="problems" tint="green" detail="Self-reported completions" /><StatCard icon={<Flame size={17} />} label="Current streak" value={String(streaks.currentStreak)} unit="days" tint="orange" detail="Make today count" /><StatCard icon={<Trophy size={17} />} label="Longest streak" value={String(streaks.longestStreak)} unit="days" tint="purple" detail="Your personal record" /><StatCard icon={<Gauge size={17} />} label="Your completion" value={String(completionPercent)} unit="%" tint="blue" detail={"Of " + problems.length + " catalogued problems"} /></div>
            <div className="dashboard-lower"><ActivityPanel grid={activityGrid} /><section className="panel getting-started"><div className="section-heading"><div><div className="eyebrow">A SIMPLE ROUTINE</div><h2>Your next steps</h2></div><span className="heading-icon"><ArrowRight size={16} /></span></div><div className="steps-list"><Step number="01" title="Choose a question" description="Browse the imported 350-problem catalogue." done={solvedCount > 0 || inProgressCount > 0} /><Step number="02" title="Write your solution" description="Code drafts save automatically in this browser." done={hasWrittenCode} /><Step number="03" title="Track a completion" description="Mark a question solved to update your personal stats." done={solvedCount > 0} /></div><button className="text-link" onClick={() => setView('problems')}>Go to problem set <ArrowRight size={14} /></button></section></div>
            <div className="bottom-banner"><div className="banner-icon"><Zap size={19} /></div><div><b>Consistency beats intensity.</b><p>Even 20 focused minutes can move you forward.</p></div><button onClick={() => setView('progress')}>View activity <ArrowRight size={15} /></button></div>
          </section>
        )}

        <footer className="footer"><span>© 2026 SDSAIFAT</span><span><i /> Built for focused practice</span><button onClick={() => setShowAuthNotice(true)}>Setup guide</button></footer>
      </main>

      {showAuthNotice && <div className="modal-backdrop" onClick={() => setShowAuthNotice(false)}><div className="setup-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close icon-button" onClick={() => setShowAuthNotice(false)}><X size={17} /></button><div className="modal-emblem"><Settings2 size={22} /></div><div className="eyebrow">CONFIGURATION</div><h2>Connect your services</h2><p>Your code drafts and self-reported progress save in this browser today. Cross-device sync requires a database and sync integration that are not connected yet.</p><ol><li>Create a Supabase project and add its URL and anon key to <code>.env.local</code> to enable sign-in.</li><li>Enable Google as an Auth provider in Supabase and configure the OAuth redirect URLs.</li><li>The Cloudflare Worker has the Java execution route. A Judge0 API key may be required depending on the provider you use.</li></ol><div className="config-status"><span className={isSupabaseConfigured ? 'status-on' : ''} /> Supabase {isSupabaseConfigured ? 'configured' : 'awaiting credentials'}</div><button className="button-primary modal-action" onClick={() => { setShowAuthNotice(false); if (!user) void signIn() }}>Continue with Google <ArrowRight size={15} /></button></div></div>}
    </div>
  )
}

function StatCard({ icon, label, value, unit, tint, detail }: { icon: React.ReactNode; label: string; value: string; unit: string; tint: string; detail: string }) {
  return <div className="panel stat-card"><div className={`stat-icon ${tint}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}<small>{unit}</small></div><div className="stat-detail">{detail}</div></div>
}

function ActivityPanel({ grid }: { grid: { date: string; count: number; future: boolean }[] }) {
  return <section className="panel activity-panel"><div className="section-heading"><div><div className="eyebrow">YOUR CONSISTENCY</div><h2>Activity overview</h2></div><span className="activity-range">Last 20 weeks <ChevronDown size={13} /></span></div><div className="activity-summary"><b>Stay in the rhythm.</b><span>Each square is a day of practice.</span></div><div className="activity-chart"><div className="weekday-labels"><span>Mon</span><span>Wed</span><span>Fri</span></div><div className="activity-grid">{grid.map((day) => <div key={day.date} className={`activity-cell level-${Math.min(day.count, 4)} ${day.future ? 'future-day' : ''}`} title={`${day.date}: ${day.count} solved`} />)}</div></div><div className="activity-legend"><span>Less</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} className={`activity-cell level-${level}`} />)}<span>More</span></div></section>
}

function Step({ number, title, description, done }: { number: string; title: string; description: string; done: boolean }) {
  return <div className="step-row"><span className={`step-number ${done ? 'complete' : ''}`}>{done ? <Check size={13} /> : number}</span><div><b>{title}</b><p>{description}</p></div><span className={`step-status ${done ? 'complete' : ''}`}>{done ? 'DONE' : 'NEXT'}</span></div>
}