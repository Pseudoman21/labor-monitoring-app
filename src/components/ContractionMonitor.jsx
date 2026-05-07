import { useState, useEffect, useRef, useCallback } from 'react'
import EcgLine from './EcgLine'
import './ContractionMonitor.css'

function exportLog(log) {
  const payload = JSON.stringify(log, null, 2)
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const ts = new Date()
  const stamp = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}-${String(ts.getDate()).padStart(2, '0')}_${String(ts.getHours()).padStart(2, '0')}-${String(ts.getMinutes()).padStart(2, '0')}`
  a.href = url
  a.download = `contractions_${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function recomputeIntervals(sorted) {
  // sorted: newest first. interval = gap from previous (older) entry
  return sorted.map((entry, i) => ({
    ...entry,
    interval: i === sorted.length - 1 ? null : entry.timestamp - sorted[i + 1].timestamp,
  }))
}

function mergeAndParse(existing, imported) {
  const parsed = imported.map((e) => ({ ...e, timestamp: new Date(e.timestamp) }))
  const byId = new Map(existing.map((e) => [e.id, e]))
  for (const e of parsed) byId.set(e.id, e)
  const merged = Array.from(byId.values()).sort((a, b) => b.timestamp - a.timestamp)
  return recomputeIntervals(merged)
}

const STORAGE_KEY = 'contraction_log'

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatInterval(ms) {
  if (ms == null) return '--:--'
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function formatIntervalVerbose(ms) {
  if (ms == null) return 'N/A'
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min === 0) return `${sec}s`
  return `${min}m ${sec}s`
}

function loadLog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw).map((entry) => ({
      ...entry,
      timestamp: new Date(entry.timestamp),
    }))
  } catch {
    return []
  }
}

function saveLog(log) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log))
}

export default function ContractionMonitor() {
  const [log, setLog] = useState(loadLog)
  const [now, setNow] = useState(new Date())
  const [flash, setFlash] = useState(false)
  const [importStatus, setImportStatus] = useState(null) // 'ok' | 'error'
  const flashTimer = useRef(null)
  const importStatusTimer = useRef(null)
  const importInputRef = useRef(null)

  // Clock tick — sinceLastSec is derived from `now` so no separate interval needed
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const sinceLastSec = log.length > 0
    ? Math.floor((now - log[0].timestamp) / 1000)
    : null

  const recordContraction = useCallback(() => {
    const ts = new Date()
    setLog((prev) => {
      const interval = prev.length > 0 ? ts - prev[0].timestamp : null
      const entry = { id: ts.getTime(), timestamp: ts, interval }
      const next = [entry, ...prev]
      saveLog(next)
      return next
    })

    // Flash effect
    setFlash(true)
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(false), 600)
  }, [])

  const clearLog = useCallback(() => {
    if (window.confirm('Clear all contraction records?')) {
      setLog([])
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const handleExport = useCallback(() => exportLog(log), [log])

  const handleImportClick = useCallback(() => {
    importInputRef.current?.click()
  }, [])

  const handleImportFile = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result)
        if (!Array.isArray(imported)) throw new Error('Invalid format')
        setLog((prev) => {
          const next = mergeAndParse(prev, imported)
          saveLog(next)
          return next
        })
        setImportStatus('ok')
      } catch {
        setImportStatus('error')
      }
      clearTimeout(importStatusTimer.current)
      importStatusTimer.current = setTimeout(() => setImportStatus(null), 3000)
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [])

  const lastInterval = log.length >= 2 ? log[0].interval : null
  const avgInterval =
    log.length >= 2
      ? log
          .slice(0, -1)
          .reduce((sum, e) => sum + (e.interval || 0), 0) /
        (log.length - 1)
      : null

  const alertLevel =
    lastInterval == null
      ? 'normal'
      : lastInterval < 5 * 60 * 1000
      ? 'critical'
      : lastInterval < 10 * 60 * 1000
      ? 'warning'
      : 'normal'

  const formatSinceLast = (sec) => {
    if (sec == null) return '--:--:--'
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
  }

  return (
    <div className={`monitor ${flash ? 'flash' : ''}`}>
      {/* Header bar */}
      <header className="monitor-header">
        <div className="header-left">
          <span className="blink-dot" />
          <span className="header-label">LABOR MONITOR</span>
        </div>
        <div className="header-center">
          <span className="header-date">{formatDate(now)}</span>
        </div>
        <div className="header-right">
          <span className="status-tag" data-level={alertLevel}>
            {alertLevel === 'critical'
              ? '⚠ CALL DOCTOR'
              : alertLevel === 'warning'
              ? '● ACTIVE LABOR'
              : '● MONITORING'}
          </span>
        </div>
      </header>

      {/* ECG lifeline */}
      <section className="ecg-section">
        <EcgLine color="#00ff88" height={76} />
      </section>

      {/* Main clock */}
      <section className="clock-panel">
        <div className="clock-label">CURRENT TIME</div>
        <div className="clock-display">{formatTime(now)}</div>
      </section>

      {/* Stats row */}
      <section className="stats-row">
        <div className="stat-card">
          <div className="stat-label">CONTRACTIONS</div>
          <div className="stat-value">{log.length}</div>
          <div className="stat-unit">total</div>
        </div>

        <div className="stat-card" data-level={alertLevel}>
          <div className="stat-label">LAST INTERVAL</div>
          <div className="stat-value interval-display">
            {formatInterval(lastInterval)}
          </div>
          <div className="stat-unit">min : sec</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">AVG INTERVAL</div>
          <div className="stat-value interval-display">
            {formatInterval(avgInterval)}
          </div>
          <div className="stat-unit">min : sec</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">SINCE LAST</div>
          <div className="stat-value since-display">
            {formatSinceLast(sinceLastSec)}
          </div>
          <div className="stat-unit">hh : mm : ss</div>
        </div>
      </section>

      {/* Main button */}
      <section className="button-section">
        <button
          className={`contraction-btn ${flash ? 'pressed' : ''}`}
          onClick={recordContraction}
          aria-label="Record contraction"
        >
          <span className="btn-pulse" />
          <span className="btn-label">CONTRACTION</span>
          <span className="btn-sub">TAP WHEN CONTRACTION STARTS</span>
        </button>
      </section>

      {/* History log */}
      <section className="history-panel">
        <div className="history-header">
          <span className="history-title">CONTRACTION LOG</span>
          <div className="history-actions">
            {importStatus && (
              <span className="import-status" data-status={importStatus}>
                {importStatus === 'ok' ? '✓ IMPORTED' : '✗ INVALID FILE'}
              </span>
            )}
            <button className="action-btn export-btn" onClick={handleExport} disabled={log.length === 0} title="Export to file">
              EXPORT
            </button>
            <button className="action-btn import-btn" onClick={handleImportClick} title="Import from file">
              IMPORT
            </button>
            {log.length > 0 && (
              <button className="clear-btn" onClick={clearLog}>
                CLEAR
              </button>
            )}
          </div>
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />

        {log.length === 0 ? (
          <div className="history-empty">
            NO CONTRACTIONS RECORDED YET
          </div>
        ) : (
          <div className="history-table">
            <div className="table-head">
              <span>#</span>
              <span>TIME</span>
              <span>INTERVAL</span>
              <span>STATUS</span>
            </div>
            <div className="table-body">
              {log.map((entry, i) => {
                const lvl =
                  entry.interval == null
                    ? 'normal'
                    : entry.interval < 5 * 60 * 1000
                    ? 'critical'
                    : entry.interval < 10 * 60 * 1000
                    ? 'warning'
                    : 'normal'
                return (
                  <div key={entry.id} className="table-row" data-level={lvl}>
                    <span className="row-num">{log.length - i}</span>
                    <span className="row-time">{formatTime(entry.timestamp)}</span>
                    <span className="row-interval">
                      {entry.interval == null
                        ? 'FIRST'
                        : formatIntervalVerbose(entry.interval)}
                    </span>
                    <span className="row-status" data-level={lvl}>
                      {lvl === 'critical'
                        ? '⚠ CLOSE'
                        : lvl === 'warning'
                        ? '● NEAR'
                        : entry.interval == null
                        ? '● START'
                        : '● OK'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      <footer className="monitor-footer">
        <span>PATIENT LABOR MONITORING SYSTEM</span>
        <span>v1.0 — DATA STORED LOCALLY</span>
      </footer>
    </div>
  )
}
