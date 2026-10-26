import { useCallback, useEffect, useState } from 'react'
import Editor, { type BeforeMount } from '@monaco-editor/react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight,
  CircleHelp, Clock3, Code2, FileCode2, Lightbulb, Play, RotateCcw, Send,
  Terminal, X,
} from 'lucide-react'
import type { CatalogueProblem } from '../types'
import './WorkspacePage.css'

type RunState = 'idle' | 'running' | 'done' | 'error'
type LeftTab = 'description' | 'hints' | 'submissions'
type DrawerTab = 'testcase' | 'result'

type WorkspacePageProps = {
  problem: CatalogueProblem
  code: string
  stdin: string
  output: string
  runState: RunState
  isRunning: boolean
  status: NonNullable<CatalogueProblem['status']>
  onCodeChange: (value: string) => void
  onStdinChange: (value: string) => void
  onRun: () => void | Promise<void>
  onSubmit: () => void
  onReset: () => void
  onMarkSolved: () => void
  onPrevious: () => void
  onNext: () => void
  onBack: () => void
  hasPrevious: boolean
  hasNext: boolean
}

const editorTheme = 'sdsaifat-dark'

export default function WorkspacePage({
  problem,
  code,
  stdin,
  output,
  runState,
  isRunning,
  status,
  onCodeChange,
  onStdinChange,
  onRun,
  onSubmit,
  onReset,
  onMarkSolved,
  onPrevious,
  onNext,
  onBack,
  hasPrevious,
  hasNext,
}: WorkspacePageProps) {
  const [leftTab, setLeftTab] = useState<LeftTab>('description')
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('testcase')
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const handleEditorBeforeMount: BeforeMount = useCallback((monaco) => {
    monaco.editor.defineTheme(editorTheme, {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'C792EA' },
        { token: 'string', foreground: 'C3E88D' },
        { token: 'number', foreground: 'F78C6C' },
        { token: 'comment', foreground: '697386', fontStyle: 'italic' },
        { token: 'type.identifier', foreground: '82AAFF' },
      ],
      colors: {
        'editor.background': '#0E1117',
        'editor.foreground': '#D8DEE9',
        'editorLineNumber.foreground': '#4B5565',
        'editorLineNumber.activeForeground': '#A7B1C2',
        'editorCursor.foreground': '#34D399',
        'editor.selectionBackground': '#214D43',
        'editor.lineHighlightBackground': '#151B23',
        'editorIndentGuide.background1': '#232B36',
        'editorIndentGuide.activeBackground1': '#3C4858',
        'editorWidget.background': '#151B23',
      },
    })
  }, [])

  const handleSubmit = useCallback(() => {
    setDrawerTab('result')
    onSubmit()
  }, [onSubmit])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        if (!isRunning) {
          setDrawerTab('result')
          void onRun()
        }
      }
    }
    window.addEventListener('keydown', handleShortcut, true)
    return () => window.removeEventListener('keydown', handleShortcut, true)
  }, [isRunning, onRun])

  const examples = problem.examples ?? []
  const hints = problem.hints ?? []
  const statusClass = status.toLowerCase().replace(/\s+/g, '-')

  return (
    <section className="workspace-page-v2" aria-label={`Coding workspace for ${problem.title}`}>
      <header className="workspace-v2-heading">
        <div className="workspace-v2-heading-main">
          <button className="workspace-back-button" onClick={onBack}><ArrowLeft size={15} /> Problem set</button>
          <div className="workspace-v2-title-line">
            <div>
              <div className="workspace-v2-eyebrow">PROBLEM WORKSPACE</div>
              <h1>{problem.title} <small>{problem.externalId ? `#${problem.externalId}` : 'Practice'}</small></h1>
            </div>
            <span className={`workspace-difficulty ${problem.difficulty.toLowerCase()}`}>{problem.difficulty === 'Unknown' ? 'Not tagged' : problem.difficulty}</span>
          </div>
          <div className="workspace-v2-topics">
            {problem.topics.map((topic) => <span key={topic}>{topic}</span>)}
            {problem.externalUrl && <a href={problem.externalUrl} target="_blank" rel="noreferrer">Original problem <ArrowRight size={12} /></a>}
          </div>
        </div>
      </header>

      <div className={`workspace-v2-panels ${isMobile ? 'is-mobile' : ''}`}>
        <PanelGroup direction={isMobile ? 'vertical' : 'horizontal'} autoSaveId={`sdsaifat-workspace-${isMobile ? 'mobile' : 'desktop'}`}>
          <Panel defaultSize={isMobile ? 42 : 40} minSize={isMobile ? 30 : 24} className="workspace-left-panel">
            <section className="workspace-card workspace-description-card">
              <nav className="workspace-tab-bar" aria-label="Problem information tabs">
                <button className={leftTab === 'description' ? 'active' : ''} onClick={() => setLeftTab('description')}><BookOpen size={14} /> Description</button>
                <button className={leftTab === 'hints' ? 'active' : ''} onClick={() => setLeftTab('hints')}><Lightbulb size={14} /> Hints</button>
                <button className={leftTab === 'submissions' ? 'active' : ''} onClick={() => setLeftTab('submissions')}><Clock3 size={14} /> Submissions</button>
              </nav>
              <div className="workspace-left-scroll">
                {leftTab === 'description' && (
                  <article className="workspace-problem-description">
                    <div className="workspace-problem-label">PROBLEM STATEMENT</div>
                    <h2>{problem.title}</h2>
                    {problem.statement.includes('not included in the supplied spreadsheet') ? (
                      <div className="workspace-missing-details">
                        <div><CircleHelp size={16} /> Full statement not available</div>
                        <p>The imported catalogue has the problem title and topic, but not its complete description, examples, constraints, or verified test cases.</p>
                        {problem.externalUrl && <a href={problem.externalUrl} target="_blank" rel="noreferrer">Read the official problem <ArrowRight size={14} /></a>}
                        <p className="workspace-muted-note">Java execution is available. An Accepted/Wrong Answer verdict requires reviewed test cases and a judging integration.</p>
                      </div>
                    ) : <p className="workspace-statement-text">{problem.statement}</p>}
                    {problem.examples.length > 0 && <div className="workspace-examples">
                      <h3>Examples</h3>
                      {problem.examples.map((example, index) => (
                        <div className="workspace-example" key={`${problem.id}-example-${index}`}>
                          <b>Example {index + 1}</b>
                          <code>Input: {example.input || '(empty)'}</code>
                          <code>Output: {example.output}</code>
                          {example.explanation && <p>{example.explanation}</p>}
                        </div>
                      ))}
                    </div>}
                    {problem.constraints.length > 0 && <div className="workspace-constraints"><h3>Constraints</h3><ul>{problem.constraints.map((constraint) => <li key={constraint}><code>{constraint}</code></li>)}</ul></div>}
                  </article>
                )}

                {leftTab === 'hints' && (
                  <article className="workspace-hints-content">
                    <div className="workspace-section-icon"><Lightbulb size={17} /></div>
                    <h2>Hints</h2>
                    <p className="workspace-subtitle">Try to make progress before revealing a hint.</p>
                    {hints.length > 0 ? (
                      <ol className="workspace-hints-list">
                        {hints.map((hint, index) => <li key={`${problem.id}-hint-${index}`}><span>HINT {index + 1}</span><p>{hint}</p></li>)}
                      </ol>
                    ) : (
                      <div className="workspace-empty-state">
                        <Lightbulb size={22} />
                        <b>No curated hints yet</b>
                        <p>Hints will appear here when reviewed learning notes are added for this problem.</p>
                        {problem.externalUrl && <a href={problem.externalUrl} target="_blank" rel="noreferrer">Open official problem <ArrowRight size={13} /></a>}
                      </div>
                    )}
                  </article>
                )}

                {leftTab === 'submissions' && (
                  <article className="workspace-submissions-content">
                    <div className="workspace-section-icon"><Clock3 size={17} /></div>
                    <h2>Practice status</h2>
                    <p className="workspace-subtitle">Progress is stored locally in this browser.</p>
                    <div className="workspace-status-card">
                      <span className={`workspace-status-dot ${statusClass}`} />
                      <div><b>{status}</b><small>{status === 'Solved' ? 'You marked this problem solved.' : status === 'In Progress' ? 'You have started working on this problem.' : 'No saved progress status yet.'}</small></div>
                    </div>
                    <div className="workspace-info-callout"><CircleHelp size={15} /><p>Submission history and Accepted/Wrong Answer verdicts are not available until automated test-case judging is connected.</p></div>
                    <button className="workspace-secondary-button workspace-mark-solved" onClick={onMarkSolved} disabled={status === 'Solved'}><Check size={14} /> {status === 'Solved' ? 'Marked solved' : 'Mark as solved'}</button>
                  </article>
                )}
              </div>
              <footer className="workspace-left-footer">
                <span><BookOpen size={13} /> Problem {problem.sheetOrder ?? '—'} of catalogue</span>
                <span>Java 17</span>
              </footer>
            </section>
          </Panel>

          <PanelResizeHandle className="workspace-resize-handle" aria-label="Resize problem and editor panels"><span /></PanelResizeHandle>

          <Panel defaultSize={isMobile ? 58 : 60} minSize={isMobile ? 42 : 34} className="workspace-right-panel">
            <section className="workspace-card workspace-editor-card">
              <div className="workspace-editor-topbar">
                <div className="workspace-file-tab"><span className="workspace-java-icon">J</span><FileCode2 size={14} /> Main.java <span className="workspace-file-close"><X size={12} /></span></div>
                <div className="workspace-editor-save"><span /> Draft auto-saves</div>
              </div>
              <div className="workspace-monaco-host">
                <Editor
                  height="100%"
                  language="java"
                  theme={editorTheme}
                  beforeMount={handleEditorBeforeMount}
                  value={code}
                  onChange={(value) => onCodeChange(value ?? '')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 4,
                    padding: { top: 16, bottom: 16 },
                    fontFamily: "'JetBrains Mono', monospace",
                    fontLigatures: true,
                    renderLineHighlight: 'line',
                    smoothScrolling: true,
                    wordWrap: 'on',
                    bracketPairColorization: { enabled: true },
                    scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
                  }}
                />
              </div>

              <section className="workspace-drawer" aria-label="Testcases and execution result">
                <div className="workspace-drawer-tabs">
                  <div className="workspace-drawer-tab-list" role="tablist" aria-label="Output tabs">
                    <button role="tab" aria-selected={drawerTab === 'testcase'} className={drawerTab === 'testcase' ? 'active' : ''} onClick={() => setDrawerTab('testcase')}><Terminal size={14} /> Testcase <span>{examples.length}</span></button>
                    <button role="tab" aria-selected={drawerTab === 'result'} className={drawerTab === 'result' ? 'active' : ''} onClick={() => setDrawerTab('result')}><Code2 size={14} /> Result</button>
                  </div>
                  <button className="workspace-drawer-clear" onClick={() => { onStdinChange(''); setDrawerTab('testcase') }} title="Clear standard input"><RotateCcw size={13} /> Clear input</button>
                </div>
                <div className="workspace-drawer-content">
                  {drawerTab === 'testcase' ? (
                    <div className="workspace-testcase-content">
                      {examples.length > 0 ? (
                        <div className="workspace-testcase-list">
                          {examples.map((example, index) => <button className="workspace-testcase-item" key={`${problem.id}-case-${index}`} onClick={() => onStdinChange(example.input)}><span>Case {index + 1}</span><code>{example.input || '(empty input)'}</code><ChevronRight size={13} /></button>)}
                        </div>
                      ) : (
                        <div className="workspace-testcase-empty"><b>No sample testcases provided</b><p>This catalogue entry has no examples yet. Enter custom input below to run your own test.</p></div>
                      )}
                      <label className="workspace-stdin-label" htmlFor="workspace-stdin">Custom standard input <span>Saved per problem</span></label>
                      <textarea id="workspace-stdin" value={stdin} onChange={(event) => onStdinChange(event.target.value)} placeholder="Enter input, one value per line…" rows={2} spellCheck={false} />
                    </div>
                  ) : (
                    <div className={`workspace-result-content ${runState}`}>
                      {runState === 'idle' ? (
                        <div className="workspace-result-empty"><Terminal size={19} /><b>Nothing to show yet</b><p>Run your Java program to see output and execution details here.</p>{output && <pre>{output}</pre>}</div>
                      ) : (
                        <>
                          <div className="workspace-result-heading"><span className={`workspace-result-status ${runState}`} />{runState === 'running' ? 'Running Java 17…' : runState === 'done' ? 'Execution finished' : 'Execution needs attention'}</div>
                          <pre>{output}</pre>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <div className="workspace-editor-footer">
                <div className="workspace-language-status"><span /> Java 17 <span className="workspace-shortcut-hint">Ctrl + Enter to run</span></div>
                <button className="workspace-secondary-button workspace-reset-button" onClick={onReset}><RotateCcw size={14} /> Restore starter</button>
              </div>
            </section>
          </Panel>
        </PanelGroup>
      </div>

      <div className="workspace-sticky-actions">
        <div className="workspace-action-context"><span className="workspace-action-status" /><span>{isRunning ? 'Running…' : status}</span></div>
        <div className="workspace-action-buttons">
          <button className="workspace-secondary-button" onClick={onPrevious} disabled={!hasPrevious}><ArrowLeft size={14} /> Previous</button>
          <button className="workspace-secondary-button workspace-next-button" onClick={onNext} disabled={!hasNext}>Next <ArrowRight size={14} /></button>
          <button className="workspace-secondary-button workspace-submit-button" onClick={handleSubmit}><Send size={14} /> Submit</button>
          <button className="workspace-run-button" onClick={() => { setDrawerTab('result'); void onRun() }} disabled={isRunning}><Play size={14} fill="currentColor" /> {isRunning ? 'Running…' : 'Run'} <kbd>Ctrl ↵</kbd></button>
        </div>
      </div>
    </section>
  )
}
