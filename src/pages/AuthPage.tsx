import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import Logo from '../components/Logo'

export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'in' | 'up'>('up')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const fn = mode === 'up' ? signUp : signIn
    const { error } = await fn(email.trim(), password)
    setBusy(false)
    if (error) {
      setError(error)
      return
    }
    if (mode === 'up') {
      // after signup, session is created; onboarding or dashboard will handle routing
      navigate('/onboarding')
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <Logo size={48} />
        </div>
        <h1 style={{ fontSize: 24, textAlign: 'center' }}>
          {mode === 'up' ? 'Crear tu cuenta' : 'Iniciar sesión'}
        </h1>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 22, fontSize: 14 }}>
          {mode === 'up'
            ? 'Registra tu correo y contraseña para empezar.'
            : 'Accede a la plataforma de tu negocio.'}
        </p>
        <form onSubmit={submit}>
          <div className="field">
            <label>Correo electrónico</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tu@correo.com" />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres" />
          </div>
          {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Procesando…' : mode === 'up' ? 'Registrarme' : 'Entrar'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 14 }} className="muted">
          {mode === 'up' ? (
            <>¿Ya tienes cuenta? <button className="link-btn" onClick={() => setMode('in')}>Inicia sesión</button></>
          ) : (
            <>¿No tienes cuenta? <button className="link-btn" onClick={() => setMode('up')}>Regístrate</button></>
          )}
        </div>
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to="/" className="muted" style={{ fontSize: 13 }}>Volver al inicio</Link>
        </div>
      </div>
    </div>
  )
}
