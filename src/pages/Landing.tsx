import { Link } from 'react-router-dom'
import Logo from '../components/Logo'

export default function Landing() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 40px' }}>
        <Logo />
        <Link to="/auth" className="btn btn-ghost">Iniciar sesión</Link>
      </header>
      <main
        style={{
          flex: 1,
          display: 'grid',
          placeItems: 'center',
          padding: '40px 24px',
        }}
      >
        <div style={{ maxWidth: 760, textAlign: 'center' }}>
          <span className="badge">Hecho para El Salvador</span>          <h1 style={{ fontSize: 'clamp(34px, 5vw, 56px)', lineHeight: 1.1, marginTop: 18, fontWeight: 700 }}>
            La plataforma de gestión para <span style={{ color: 'var(--accent)' }}>micro y pequeñas empresas</span>
          </h1>
          <p className="muted" style={{ fontSize: 18, marginTop: 18, maxWidth: 620, marginInline: 'auto' }}>
            PYMESV reúne ventas, compras, inventario, gastos, clientes y un asistente con IA en un solo lugar.
            Registra tu negocio en minutos y empieza a controlar tu flujo de caja.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 28 }}>
            <Link to="/auth" className="btn btn-primary">Crear cuenta gratis</Link>
            <Link to="/auth" className="btn btn-ghost">Ya tengo cuenta</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 48, textAlign: 'left' }}>
            <Feature title="Ventas e inventario" desc="Registra ventas, controla stock y genera facturas automáticamente." />
            <Feature title="Finanzas claras" desc="Flujo de caja, cuentas por cobrar y pagar, y utilidades en tiempo real." />
            <Feature title="Asistente IA" desc="Alertas inteligentes, predicciones y escaneo de documentos." />
          </div>
        </div>
      </main>
      <footer className="muted" style={{ textAlign: 'center', padding: '24px', fontSize: 13 }}>
        © {new Date().getFullYear()} PYMESV · El Salvador
      </footer>
    </div>
  )
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div className="muted" style={{ fontSize: 14 }}>{desc}</div>
    </div>
  )
}
