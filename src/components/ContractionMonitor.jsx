import { useState, useEffect, useRef, useCallback } from 'react'
import './ContractionMonitor.css'

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
  const [sinceLastSec, setSinceLastSec] = useState(null)
  const flashTimer = useRef(null)

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Time-since-last ticker
  useEffect(() => {
    if (log.length === 0) {
      setSinceLastSec(null)
      return
    }
    const last = log[0].timestamp
    const update = () => setSinceLastSec(Math.floor((Date.now() - last.getTime()) / 1000))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [log])

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
          {log.length > 0 && (
            <button className="clear-btn" onClick={clearLog}>
              CLEAR ALL
            </button>
          )}
        </div>

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
