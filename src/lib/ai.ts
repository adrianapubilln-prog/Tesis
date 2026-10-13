
import { supabase } from './supabase'

const AI_API_URL =
  import.meta.env.VITE_AI_API_URL || 'http://127.0.0.1:5000'

// Estructura de cada transacción.
export interface Transaccion {
  tipo: string
  fecha: string
  referencia: string | null
  estado: string
  importe: number
}

// Contenido que devuelve obtener_respuesta() en Flask.
export interface ContenidoIA {
  ok?: boolean
  mensaje: string
  resumen?: {
    transacciones_encontradas?: number
  }
  datos?: Transaccion[]
}

// Respuesta completa del backend.
export interface AIResponse {
  respuesta: ContenidoIA
  intencion: string
  confianza: number
}

export async function enviarMensajeIA(
  mensaje: string
): Promise<AIResponse> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error || !session?.access_token) {
    throw new Error('Debes iniciar sesión para utilizar Chatty.')
  }

  const response = await fetch(`${AI_API_URL}/api/ia/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ mensaje }),
  })

  const resultado = await response.json()

  if (!response.ok) {
    throw new Error(
      resultado.error || 'No fue posible comunicarse con Chatty.'
    )
  }

  return resultado as AIResponse
}
