export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        className="logo-mark"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >P</div>
      <div style={{ lineHeight: 1.1 }}>
        <div style={{ fontWeight: 700, letterSpacing: '0.5px' }}>PYMESV</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Gestión para mipymes</div>
      </div>
    </div>
  )
}
