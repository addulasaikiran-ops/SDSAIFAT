import { useEffect, useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import {
  Activity, ArrowDownUp, ArrowLeft, ArrowRight, Bell, BookOpen, Check,
  ChevronDown, CircleHelp, Code2, Command, Flame, Gauge, Github, ListFilter,
  LogOut, Menu, Play, Search, Settings2, ShieldCheck, Sparkles, Terminal,
  Trophy, X, Zap,
} from 'lucide-react'
import { problems } from './data/problems'
import { buildActivityGrid, calculateStreaks } from './lib/streak'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { Problem } from './types'

type View = 'dashboard' | 'problems' | 'workspace' | 'progress'
type RunState = 'idle' | 'running' | 'done' | 'error'

// Temporary visual preview data only; it is not real user activity.
const sampleActivity = [] as { date: string; solved: number }[]

const starterCode = `class Solution {
    public int solve() {
        // Write your solution here
        return 0;
    }
}`

function App() {
  const [view, setView] = useState<View>('dashboard')
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [difficulty, setDifficulty] = useState('All')
  const [topicFilter, setTopicFilter] = useState('All')
  const [code, setCode] = useState(starterCode)
  const [output, setOutput] = useState('Run your code to see output here.')
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

  const streaks = useMemo(() => calculateStreaks(sampleActivity), [])
  const activityGrid = useMemo(() => buildActivityGrid(sampleActivity, 20), [])
  const filteredProblems = useMemo(() => problems.filter((problem) => {
    const query = searchQuery.toLowerCase()
    return (problem.title.toLowerCase().includes(query) || problem.topics.some((topic) => topic.toLowerCase().includes(query)))
      && (difficulty === 'All' || problem.difficulty === difficulty)
      && (topicFilter === 'All' || problem.topics.includes(topicFilter))
  }), [searchQuery, difficulty, topicFilter])

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
    setCode(problem.starterCode)
    setOutput('Run your code to see output here.')
    setView('workspace')
  }

  const moveProblem = (direction: -1 | 1) => {
    if (!selectedProblem) return
    const currentIndex = problems.findIndex((problem) => problem.id === selectedProblem.id)
    const nextProblem = problems[currentIndex + direction]
    if (nextProblem) openProblem(nextProblem)
  }

  const runCode = async () => {
    const apiUrl = (import.meta.env.VITE_JUDGE0_API_URL as string | undefined)?.trim()
    if (!apiUrl) {
      setOutput('Java execution is not configured. Set VITE_JUDGE0_API_URL to your Judge0 /submissions endpoint. If your provider requires an API key, route requests through a server-side proxy; never put secret keys in VITE_ variables.')
      setRunState('error')
      return
    }
    setIsRunning(true)
    setRunState('running')
    setOutput('Compiling and running Java 17…')
    try {
      const baseUrl = apiUrl.replace(/\\/$/, '')
      const submitUrl = baseUrl.includes('?') ? baseUrl : baseUrl + '?base64_encoded=false&wait=true'
      const response = await fetch(submitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          language_id: 62,
          source_code: code,
          stdin: '',
          cpu_time_limit: 2,
          wall_time_limit: 5,
        }),
      })
      if (!response.ok) throw new Error(`Execution request failed (${response.status}). Check your Judge0 endpoint, CORS settings, and provider limits.`)
      let result = await response.json() as { token?: string; stdout?: string | null; stderr?: string | null; compile_output?: string | null; message?: string; status?: { id?: number; description?: string } }
      if (result.token && !result.status?.id) {
        for (let attempt = 0; attempt < 15; attempt++) {
          await new Promise((resolve) => window.setTimeout(resolve, 1000))
          const pollResponse = await fetch(`${baseUrl}/${encodeURIComponent(result.token)}?base64_encoded=false`, { headers: { Accept: 'application/json' } })
          if (!pollResponse.ok) throw new Error(`Could not retrieve execution result (${pollResponse.status}).`)
          result = await pollResponse.json() as typeof result
          if (result.status && result.status.id > 2) break
        }
      }
      const outputText = result.stdout?.trimEnd()
      const details = result.stderr || result.compile_output || result.message
      const statusText = result.status?.description
      setOutput([statusText, details, outputText].filter(Boolean).join('\\n\\n') || 'Execution completed with no output.')
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
      setRunState('error')
      return
    }
    setOutput('Automated multi-test judging is not enabled yet. The test cases need to be wired to the execution service before a submission can receive an accepted verdict.')
    setRunState('error')
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
            <div className="online-status"><span /> All systems normal</div>
            <button className="icon-button topbar-bell" title="Notifications"><Bell size={17} /></button>
            <button className="topbar-avatar" onClick={user ? signOut : signIn} title={user ? 'Sign out' : 'Sign in with Google'}>
              {user?.avatar ? <img src={user.avatar} alt="" /> : user ? (user.name ?? 'U').charAt(0).toUpperCase() : <span>G</span>}
            </button>
          </div>
        </header>

        {view === 'workspace' && selectedProblem ? (
          <section className="workspace-page">
            <div className="workspace-heading">
              <button className="back-link" onClick={() => setView('problems')}><ArrowLeft size={15} /> All problems</button>
              <div className="workspace-title-row"><div><div className="eyebrow">PROBLEM WORKSPACE</div><h1>{selectedProblem.title}</h1></div><span className={`difficulty-pill ${selectedProblem.difficulty.toLowerCase()}`}>{selectedProblem.difficulty}</span></div>
              <div className="problem-topics">{selectedProblem.topics.map((topic) => <span key={topic}>{topic}</span>)}{selectedProblem.externalUrl && <a href={selectedProblem.externalUrl} target="_blank" rel="noreferrer">Open original problem ↗</a>}</div>
            </div>
            <div className="coding-layout">
              <section className="panel statement-panel">
                <div className="panel-header"><div className="panel-title"><BookOpen size={16} /><b>Description</b></div><span className="panel-menu">•••</span></div>
                <div className="statement-content"><h2>{selectedProblem.title}</h2><p>{selectedProblem.statement}</p>{selectedProblem.statement.includes('not included in the supplied spreadsheet') && selectedProblem.externalUrl && <p><a href={selectedProblem.externalUrl} target="_blank" rel="noreferrer">View the official statement, examples, and constraints ↗</a></p>}
                  <h3>Examples</h3>
                  {selectedProblem.examples.map((example, index) => <div className="example-box" key={index}><b>Example {index + 1}</b><code>Input: {example.input}</code><code>Output: {example.output}</code>{example.explanation && <p>{example.explanation}</p>}</div>)}
                  <h3>Constraints</h3><ul>{selectedProblem.constraints.map((constraint) => <li key={constraint}><code>{constraint}</code></li>)}</ul>
                </div>
                <div className="statement-footer"><span><BookOpen size={14} /> Problem {selectedProblem.sheetOrder ?? problems.findIndex((p) => p.id === selectedProblem.id) + 1} of {problems.length}</span><span>Java 17</span></div><div className="problem-navigation"><button className="button-secondary" onClick={() => moveProblem(-1)} disabled={problems.findIndex((p) => p.id === selectedProblem.id) <= 0}><ArrowLeft size={14} /> Previous</button><button className="button-secondary" onClick={() => moveProblem(1)} disabled={problems.findIndex((p) => p.id === selectedProblem.id) >= problems.length - 1}>Next problem <ArrowRight size={14} /></button></div>
              </section>
              <section className="panel editor-panel">
                <div className="editor-toolbar"><div className="editor-tab"><span className="java-badge">J</span> Solution.java <X size={13} /></div><button className="editor-setting"><Settings2 size={15} /> Settings <ChevronDown size={13} /></button></div>
                <div className="editor-host"><Editor height="100%" language="java" theme="vs-dark" value={code} onChange={(value) => setCode(value ?? '')} options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: 'on', scrollBeyondLastLine: false, automaticLayout: true, tabSize: 4, padding: { top: 18 }, fontFamily: "'JetBrains Mono', monospace" }} /></div>
                <div className="console-panel"><div className="console-heading"><div><Terminal size={15} /><b>Console</b><span className={`run-indicator ${runState}`} /></div><button className="icon-button" title="Clear console" onClick={() => { setOutput('Run your code to see output here.'); setRunState('idle') }}><X size={15} /></button></div><pre className={`console-output ${runState}`}>{output}</pre></div>
                <div className="editor-footer"><span className="language-label"><span className="language-dot" /> Java 17</span><div><button className="button-secondary" onClick={() => { setCode(selectedProblem.starterCode); setOutput('Code reset.'); setRunState('idle') }}>Reset</button><button className="button-primary run-button" onClick={runCode} disabled={isRunning}><Play size={14} fill="currentColor" /> {isRunning ? 'Running…' : 'Run code'}</button><button className="button-submit" onClick={submitCode}><Zap size={14} /> Submit</button></div></div>
              </section>
            </div>
          </section>
        ) : view === 'problems' ? (
          <section className="content-page">
            <div className="page-heading"><div><div className="eyebrow">BUILD YOUR FOUNDATION</div><h1>Problem set<span>.</span></h1><p>A deliberate set of problems, one good solution at a time.</p></div><div className="heading-stamp"><Code2 size={16} /> JAVA TRACK</div></div>
            <div className="problem-summary-row"><div className="mini-stat"><span>Total problems</span><b>{problems.length}</b></div><div className="mini-stat"><span>Topics</span><b>{new Set(problems.flatMap((problem) => problem.topics)).size}</b></div><div className="mini-stat"><span>Completion</span><b>0%</b></div></div>
            <div className="panel table-panel">
              <div className="table-toolbar"><div className="search-box"><Search size={16} /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search problems or topics..." /></div><div className="filter-controls"><label><ListFilter size={15} /><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="All">All difficulties</option><option>Easy</option><option>Medium</option><option>Hard</option><option>Unknown</option></select><select aria-label="Filter by topic" value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}><option value="All">All topics</option>{Array.from(new Set(problems.flatMap((problem) => problem.topics))).sort().map((topic) => <option key={topic} value={topic}>{topic}</option>)}</select></label><button className="button-secondary compact-button" onClick={() => { setSearchQuery(''); setDifficulty('All'); setTopicFilter('All') }}><ArrowDownUp size={14} /> Reset</button></div></div>
              {filteredProblems.length ? <div className="problem-table"><div className="problem-table-head"><span>STATUS</span><span>TITLE</span><span>DIFFICULTY</span><span>TOPICS</span><span /></div>{filteredProblems.map((problem) => <button className="problem-table-row" key={problem.id} onClick={() => openProblem(problem)}><span className="problem-status"><span className="status-empty" /></span><b>{problem.title}</b><span><i className={`difficulty-text ${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</i>{problem.externalUrl && <a className="problem-external-link" href={problem.externalUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>LeetCode ↗</a>}</span><span className="topic-cell">{problem.topics.slice(0, 2).join(' · ')}</span><ArrowRight size={15} /></button>)}</div> : <div className="empty-problems"><div className="empty-icon"><BookOpen size={22} /></div><h3>No matching problems</h3><p>Try another search or clear the filters to see the full catalogue.</p><button className="button-secondary" onClick={() => setShowAuthNotice(true)}>How to add problems <ArrowRight size={14} /></button></div>}
            </div>
            <div className="footnote"><ShieldCheck size={15} /> Your practice list stays focused on the problems you choose.</div>
          </section>
        ) : view === 'progress' ? (
          <section className="content-page">
            <div className="page-heading"><div><div className="eyebrow">CONSISTENCY OVER INTENSITY</div><h1>Your activity<span>.</span></h1><p>Small sessions add up. Keep showing up.</p></div><div className="heading-stamp"><Flame size={16} /> DAILY ROUTINE</div></div>
            <div className="stats-grid"><StatCard icon={<Flame size={17} />} label="Current streak" value={String(streaks.currentStreak)} unit="days" tint="orange" detail="Consecutive days with a solve" /><StatCard icon={<Trophy size={17} />} label="Longest streak" value={String(streaks.longestStreak)} unit="days" tint="purple" detail="Your personal best" /><StatCard icon={<Check size={17} />} label="Problems solved" value="0" unit="total" tint="green" detail="Accepted solutions" /><StatCard icon={<Activity size={17} />} label="Active days" value={String(sampleActivity.length)} unit="days" tint="blue" detail="Days you practiced" /></div>
            <ActivityPanel grid={activityGrid} />
          </section>
        ) : (
          <section className="content-page">
            <div className="welcome-row"><div><div className="eyebrow"><Sparkles size={13} /> YOUR PERSONAL DSA SPACE</div><h1>Make progress,<br /><span>one problem at a time.</span></h1><p>A focused place to practice, learn patterns, and build a habit that sticks.</p><div className="welcome-actions"><button className="button-primary" onClick={() => setView('problems')}>Explore problems <ArrowRight size={15} /></button><button className="button-secondary" onClick={user ? signOut : signIn}>{user ? <LogOut size={15} /> : <Github size={15} />}{user ? 'Sign out' : 'Continue with Google'}</button></div></div><div className="hero-art"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-center"><Code2 size={44} strokeWidth={1.35} /><span>DSA</span></div><div className="float-chip chip-top"><Zap size={14} /> Keep building</div><div className="float-chip chip-bottom"><Check size={14} /> Every day counts</div></div></div>
            <div className="stats-grid"><StatCard icon={<Check size={17} />} label="Problems solved" value="0" unit="problems" tint="green" detail="Your accepted solutions" /><StatCard icon={<Flame size={17} />} label="Current streak" value={String(streaks.currentStreak)} unit="days" tint="orange" detail="Make today count" /><StatCard icon={<Trophy size={17} />} label="Longest streak" value={String(streaks.longestStreak)} unit="days" tint="purple" detail="Your personal record" /><StatCard icon={<Gauge size={17} />} label="Your completion" value="0" unit="%" tint="blue" detail="Of your selected problems" /></div>
            <div className="dashboard-lower"><ActivityPanel grid={activityGrid} /><section className="panel getting-started"><div className="section-heading"><div><div className="eyebrow">A SIMPLE ROUTINE</div><h2>Your next steps</h2></div><span className="heading-icon"><ArrowRight size={16} /></span></div><div className="steps-list"><Step number="01" title="Add your problem list" description="Start with the exact problems you want to practice." done={false} /><Step number="02" title="Write your first solution" description="Use the Java workspace and run your code." done={false} /><Step number="03" title="Build a daily habit" description="Solve a problem each day to build your streak." done={false} /></div><button className="text-link" onClick={() => setView('problems')}>Go to problem set <ArrowRight size={14} /></button></section></div>
            <div className="bottom-banner"><div className="banner-icon"><Zap size={19} /></div><div><b>Consistency beats intensity.</b><p>Even 20 focused minutes can move you forward.</p></div><button onClick={() => setView('progress')}>View activity <ArrowRight size={15} /></button></div>
          </section>
        )}

        <footer className="footer"><span>© 2026 SDSAIFAT</span><span><i /> Built for focused practice</span><button onClick={() => setShowAuthNotice(true)}>Setup guide</button></footer>
      </main>

      {showAuthNotice && <div className="modal-backdrop" onClick={() => setShowAuthNotice(false)}><div className="setup-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close icon-button" onClick={() => setShowAuthNotice(false)}><X size={17} /></button><div className="modal-emblem"><Settings2 size={22} /></div><div className="eyebrow">CONFIGURATION</div><h2>Connect your services</h2><p>The UI is ready for configuration. To enable account sign-in and persistent progress:</p><ol><li>Create a Supabase project and add its URL and anon key to <code>.env.local</code>.</li><li>Enable Google as an Auth provider in Supabase and configure the OAuth redirect URLs.</li><li>Configure a server-side Judge0 endpoint for safe Java execution.</li></ol><div className="config-status"><span className={isSupabaseConfigured ? 'status-on' : ''} /> Supabase {isSupabaseConfigured ? 'configured' : 'awaiting credentials'}</div><button className="button-primary modal-action" onClick={() => { setShowAuthNotice(false); if (!user) void signIn() }}>Continue with Google <ArrowRight size={15} /></button></div></div>}
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