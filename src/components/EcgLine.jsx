import { useRef, useEffect } from 'react'

const gauss = (x, mu, sig) => Math.exp(-0.5 * ((x - mu) / sig) ** 2)

const N = 500
const ECG_LUT = (() => {
  const lut = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const t = i / N
    lut[i] =
      gauss(t, 0.12, 0.025) * 0.18 -   // P wave
      gauss(t, 0.285, 0.010) * 0.12 +  // Q dip
      gauss(t, 0.315, 0.013) * 1.0 -   // R spike
      gauss(t, 0.345, 0.013) * 0.22 +  // S dip
      gauss(t, 0.55, 0.050) * 0.30     // T wave
  }
  return lut
})()

export default function EcgLine({ color = '#00ff88', height = 76 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let raf
    let stopAnimation = false

    const start = () => {
      const W = canvas.offsetWidth
      if (!W) { raf = requestAnimationFrame(start); return }

      const dpr = window.devicePixelRatio || 1
      canvas.width = W * dpr
      canvas.height = height * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)

      const SPEED = 85                           // px/sec scroll speed
      const BEATS_VISIBLE = 2.8                  // beats shown across full width
      const LUT_PER_PIX = (N * BEATS_VISIBLE) / W

      const buf = new Float32Array(W).fill(0)
      let lutPos = 0
      let accumPx = 0
      let lastT = null

      const frame = (t) => {
        if (stopAnimation) return

        if (lastT !== null) {
          const dt = Math.min((t - lastT) / 1000, 0.05) // clamp to avoid jumps on tab focus
          accumPx += SPEED * dt
          const steps = Math.floor(accumPx)
          accumPx -= steps
          for (let s = 0; s < steps; s++) {
            buf.copyWithin(0, 1)
            buf[W - 1] = ECG_LUT[Math.floor(lutPos) % N]
            lutPos = (lutPos + LUT_PER_PIX) % N
          }
        }
        lastT = t

        ctx.clearRect(0, 0, W, height)

        // ECG paper grid — minor squares every 5px, major every 5
        const MINOR = 5
        const MAJOR = MINOR * 5

        ctx.lineWidth = 0.5
        ctx.strokeStyle = color + '14'
        ctx.beginPath()
        for (let gx = 0; gx <= W; gx += MINOR) { ctx.moveTo(gx, 0); ctx.lineTo(gx, height) }
        for (let gy = 0; gy <= height; gy += MINOR) { ctx.moveTo(0, gy); ctx.lineTo(W, gy) }
        ctx.stroke()

        ctx.lineWidth = 0.75
        ctx.strokeStyle = color + '32'
        ctx.beginPath()
        for (let gx = 0; gx <= W; gx += MAJOR) { ctx.moveTo(gx, 0); ctx.lineTo(gx, height) }
        for (let gy = 0; gy <= height; gy += MAJOR) { ctx.moveTo(0, gy); ctx.lineTo(W, gy) }
        ctx.stroke()

        // Waveform
        const baseline = height * 0.64
        const amp = height * 0.50

        const grad = ctx.createLinearGradient(0, 0, W, 0)
        grad.addColorStop(0, color + '1a')
        grad.addColorStop(0.45, color + '88')
        grad.addColorStop(0.85, color + 'dd')
        grad.addColorStop(1, color)
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.6
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.beginPath()
        for (let x = 0; x < W; x++) {
          const y = baseline - buf[x] * amp
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()

        // Writing-head glow
        const hy = baseline - buf[W - 1] * amp
        const grd = ctx.createRadialGradient(W - 1, hy, 0, W - 1, hy, 12)
        grd.addColorStop(0, 'rgba(255,255,255,0.95)')
        grd.addColorStop(0.25, color + 'ee')
        grd.addColorStop(1, 'transparent')
        ctx.beginPath()
        ctx.arc(W - 1, hy, 12, 0, Math.PI * 2)
        ctx.fillStyle = grd
        ctx.fill()

        raf = requestAnimationFrame(frame)
      }

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(start)
    return () => {
      stopAnimation = true
      cancelAnimationFrame(raf)
    }
  }, [color, height])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: `${height}px`, display: 'block' }}
    />
  )
}
