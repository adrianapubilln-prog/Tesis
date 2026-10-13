from flask import Flask, request, jsonify
from flask_cors import CORS
import traceback
from intenciones import obtener_respuesta
from supabase_ia import verificar_usuario, obtener_negocio_usuario
app = Flask(__name__)

CORS(app)


@app.route("/api/ia/chat", methods=["POST"])
def chat_ia():
    try:
        autorizacion = request.headers.get("Authorization", "")

        if not autorizacion.startswith("Bearer "):
            return jsonify({
                "error": "Debes iniciar sesión para utilizar Chatty."
            }), 401

        token = autorizacion.split(" ", 1)[1].strip()
        usuario = verificar_usuario(token)

        if not usuario or not usuario.get("id"):
            return jsonify({
                "error": "La sesión no es válida o ha expirado."
            }), 401

        negocio = obtener_negocio_usuario(usuario["id"])

        if not negocio:
            return jsonify({
                "error": "No se encontró un negocio autorizado o no tienes permiso para utilizar el módulo IA."
            }), 403

        datos = request.get_json(silent=True) or {}
        mensaje = datos.get("mensaje", "").strip()

        if not mensaje:
            return jsonify({
                "error": "El mensaje no puede estar vacío."
            }), 400

        resultado = obtener_respuesta(mensaje, negocio)

        print("RESPUESTA COMPLETA DE CHATTY:")
        print(resultado)

        return jsonify(resultado)

    except Exception as error:
        print(f"Error en Chatty: {error}")
        traceback.print_exc()

        return jsonify({
            "error": "Ocurrió un error al procesar la consulta."
        }), 500


@app.route("/api/ia/estado", methods=["GET"])
def estado_ia():
    return jsonify({
        "estado": "activo",
        "servicio": "Chatty",
        "mensaje": "El servicio de inteligencia artificial está funcionando."
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)