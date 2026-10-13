
import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { enviarMensajeIA } from '../lib/ai'

type Transaccion = {
  tipo: string
  fecha: string
  referencia: string | null
  estado: string
  importe: number
}

type Mensaje = {
  id: number
  tipo: 'usuario' | 'chatty'
  texto: string
  confianza?: number
  intencion?: string
  transacciones?: Transaccion[]
}

type RespuestaIA = {
  ok?: boolean
  mensaje?: string
  respuesta?: {
    ok?: boolean
    mensaje?: string
    resumen?: {
      transacciones_encontradas?: number
    }
    datos?: Transaccion[]
  } | string
  datos?: Transaccion[]
  intencion?: string
  confianza?: number
}

function convertirATexto(valor: unknown): string {
  if (typeof valor === 'string') return valor

  if (typeof valor === 'number' || typeof valor === 'boolean') {
    return String(valor)
  }

  if (valor && typeof valor === 'object') {
    const objeto = valor as Record<string, unknown>

    if (typeof objeto.mensaje === 'string') {
      return objeto.mensaje
    }

    if (typeof objeto.respuesta === 'string') {
      return objeto.respuesta
    }

    return JSON.stringify(valor, null, 2)
  }

  return 'No se recibió una respuesta válida del asistente.'
}

function formatearImporte(importe: number): string {
  return new Intl.NumberFormat('es-SV', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(importe) || 0)
}

export default function Chatty() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      id: 1,
      tipo: 'chatty',
      texto:
        'Hola, soy Chatty. Puedo ayudarte a identificar consultas relacionadas con la gestión de tu negocio.',
    },
  ])

  const [entrada, setEntrada] = useState('')
  const [cargando, setCargando] = useState(false)

  const enviar = async () => {
    const texto = entrada.trim()

    if (!texto || cargando) return

    const mensajeUsuario: Mensaje = {
      id: Date.now(),
      tipo: 'usuario',
      texto,
    }

    setMensajes((actuales) => [...actuales, mensajeUsuario])
    setEntrada('')
    setCargando(true)

    try {
      const resultado = (await enviarMensajeIA(texto)) as RespuestaIA

      // Flask devuelve el contenido dentro de "respuesta".
      const contenido =
        resultado.respuesta &&
        typeof resultado.respuesta === 'object'
          ? resultado.respuesta
          : resultado

      const textoRespuesta = convertirATexto(contenido)

      // Leer los registros de la propiedad datos.
      const transacciones =
        Array.isArray(contenido.datos)
          ? contenido.datos
          : Array.isArray(resultado.datos)
            ? resultado.datos
            : undefined

      const mensajeChatty: Mensaje = {
        id: Date.now() + 1,
        tipo: 'chatty',
        texto: textoRespuesta,
        intencion: resultado.intencion,
        transacciones:
          resultado.intencion === 'ultimas_transacciones'
            ? transacciones
            : undefined,
        confianza:
          typeof resultado.confianza === 'number'
            ? resultado.confianza
            : undefined,
      }

      setMensajes((actuales) => [...actuales, mensajeChatty])
    } catch (error) {
      console.error('Error al comunicarse con Chatty:', error)

      const mensajeError: Mensaje = {
        id: Date.now() + 1,
        tipo: 'chatty',
        texto:
          error instanceof Error
            ? error.message
            : 'No fue posible procesar la consulta. Inténtalo nuevamente.',
      }

      setMensajes((actuales) => [...actuales, mensajeError])
    } finally {
      setCargando(false)
    }
  }

  const manejarTecla = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'Enter') {
      enviar()
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 120px)',
        minHeight: 500,
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700 }}>Chatty</h1>

        <p
          className="muted"
          style={{ marginTop: 5, fontSize: 14 }}
        >
          Asistente de inteligencia artificial de PYMESV
        </p>
      </div>

      <div
        className="card"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <strong>Chatty</strong>

          <div
            style={{
              fontSize: 12,
              color: 'var(--text-dim)',
              marginTop: 3,
            }}
          >
            Clasificación de consultas mediante inteligencia artificial
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {mensajes.map((mensaje) => (
            <div
              key={mensaje.id}
              style={{
                display: 'flex',
                justifyContent:
                  mensaje.tipo === 'usuario' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '100%',
                  minWidth: 0,
                  padding: '11px 14px',
                  borderRadius: 12,
                  background:
                    mensaje.tipo === 'usuario'
                      ? 'var(--primary)'
                      : 'var(--surface-2)',
                  color:
                    mensaje.tipo === 'usuario' ? '#fff' : 'var(--text)',
                  overflowWrap: 'anywhere',
                  fontSize: 14,
                  lineHeight: 1.5,
                  boxSizing: 'border-box',
                }}
              >
                {mensaje.texto}

                {mensaje.tipo === 'chatty' &&
                mensaje.intencion === 'ultimas_transacciones' &&
                mensaje.transacciones &&
                mensaje.transacciones.length > 0 && (
                    <div
                      style={{
                        marginTop: 14,
                        maxWidth: '100%',
                        overflowX: 'auto',
                      }}
                    >
                      <table
                        style={{
                          width: '100%',
                          minWidth: 570,
                          borderCollapse: 'collapse',
                          fontSize: 12,
                          textAlign: 'left',
                        }}
                      >
                        <thead>
                          <tr>
                            {[
                              'Tipo',
                              'Fecha',
                              'Referencia',
                              'Estado',
                              'Importe',
                            ].map((titulo) => (
                              <th
                                key={titulo}
                                style={{
                                  padding: '9px 8px',
                                  borderBottom: '1px solid var(--border)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {titulo}
                              </th>
                            ))}
                          </tr>
                        </thead>

                        <tbody>
                          {mensaje.transacciones.map(
                            (transaccion, indice) => (
                              <tr
                                key={`${transaccion.tipo}-${transaccion.fecha}-${indice}`}
                              >
                                <td
                                  style={{
                                    padding: '9px 8px',
                                    borderBottom: '1px solid var(--border)',
                                  }}
                                >
                                  {transaccion.tipo}
                                </td>

                                <td
                                  style={{
                                    padding: '9px 8px',
                                    borderBottom: '1px solid var(--border)',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {transaccion.fecha || 'Sin fecha'}
                                </td>

                                <td
                                  style={{
                                    padding: '9px 8px',
                                    borderBottom: '1px solid var(--border)',
                                  }}
                                >
                                  {transaccion.referencia || 'Sin referencia'}
                                </td>

                                <td
                                  style={{
                                    padding: '9px 8px',
                                    borderBottom: '1px solid var(--border)',
                                  }}
                                >
                                  {transaccion.estado || 'Sin estado'}
                                </td>

                                <td
                                  style={{
                                    padding: '9px 8px',
                                    borderBottom: '1px solid var(--border)',
                                    whiteSpace: 'nowrap',
                                    fontWeight: 600,
                                  }}
                                >
                                  {formatearImporte(transaccion.importe)}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>

                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 12,
                          color: 'var(--text-dim)',
                        }}
                      >
                        Total de registros: {mensaje.transacciones.length}
                      </div>
                    </div>
                  )}

                {mensaje.confianza !== undefined && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      opacity: 0.65,
                    }}
                  >
                    Confianza: {(mensaje.confianza * 100).toFixed(1)}%
                  </div>
                )}
              </div>
            </div>
          ))}

          {cargando && (
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-dim)',
              }}
            >
              Chatty está procesando la consulta...
            </div>
          )}
        </div>

        <div
          style={{
            padding: 14,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 10,
          }}
        >
          <input
            value={entrada}
            onChange={(evento) => setEntrada(evento.target.value)}
            onKeyDown={manejarTecla}
            placeholder="Escribe una consulta..."
            disabled={cargando}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '11px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              outline: 'none',
            }}
          />

          <button
            className="btn btn-primary"
            onClick={enviar}
            disabled={cargando || !entrada.trim()}
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
