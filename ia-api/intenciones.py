import json
import pickle
import random
import string
from supabase_ia import ejecutar_consulta
import nltk
from nltk.stem import WordNetLemmatizer


# Recursos necesarios de NLTK
recursos = [
    ('tokenizers/punkt', 'punkt'),
    ('tokenizers/punkt_tab', 'punkt_tab'),
    ('corpora/stopwords', 'stopwords'),
    ('corpora/wordnet', 'wordnet'),
]

for ruta, nombre in recursos:
    try:
        nltk.data.find(ruta)
    except LookupError:
        nltk.download(nombre)


lematizador = WordNetLemmatizer()


# Cargar el modelo entrenado
with open('model.pkl', 'rb') as archivo:
    vectorizar, le, model = pickle.load(archivo)


# Cargar las intenciones
with open('intenciones.json', 'r', encoding='utf-8') as archivo:
    data = json.load(archivo)


# Cargar stopwords una sola vez
stopwords_espanol = set(
    nltk.corpus.stopwords.words('spanish')
)


def preproceso(oracion):
    """
    Preprocesa el texto antes de enviarlo al modelo.
    """

    oracion = oracion.lower()

    oracion = ''.join(
        char
        for char in oracion
        if char not in string.punctuation
    )

    tokens = nltk.word_tokenize(
        oracion,
        language='spanish'
    )

    tokens = [
        lematizador.lemmatize(word)
        for word in tokens
        if word not in stopwords_espanol
    ]

    return ' '.join(tokens)


def mostrar_menu():
    return """
Puedo ayudarte con las siguientes consultas:

1. Ingresos del mes
2. Gastos del mes
3. Ganancia neta actual
4. Cuentas por cobrar
5. Cuentas por pagar
6. Valor del inventario
7. Productos con stock bajo
8. Productos más vendidos
9. Comparación de ingresos y gastos
10. Utilidad del mes pasado
11. Últimas transacciones

También puedes escribir tu pregunta directamente.
"""

def obtener_respuesta(entrada_usuario, negocio_id=None):
    """Clasifica el mensaje y consulta Supabase cuando corresponde."""
    entrada_procesada = preproceso(entrada_usuario)
    X = vectorizar.transform([entrada_procesada])
    probabilidades = model.predict_proba(X)[0]
    indice = probabilidades.argmax()
    confianza = float(probabilidades[indice])
    etiqueta = le.inverse_transform([indice])[0]

    print(f"Consulta: {entrada_usuario}")
    print(f"Procesado: {entrada_procesada}")
    print(f"Confianza: {confianza:.4f}")
    print(f"Etiqueta: {etiqueta}")

    if confianza < 0.45:
        return {
            "respuesta": (
                "No estoy seguro de haber entendido tu consulta.\n\n"
                + mostrar_menu()
            ),
            "intencion": "desconocida",
            "confianza": confianza,
        }

    intenciones_con_datos = {
        "ingresos_mes",
        "gastos_mes",
        "ganancia_neta",
        "cuentas_por_cobrar",
        "cuentas_por_pagar",
        "valor_inventario",
        "stock_bajo",
        "productos_mas_vendidos",
        "comparacion_ingresos_gastos",
        "utilidad_mes_anterior",
        "ultimas_transacciones",
    }

    if etiqueta in intenciones_con_datos:
        if not negocio_id:
            return {
                "respuesta": "No se pudo identificar el negocio autorizado para esta consulta.",
                "intencion": etiqueta,
                "confianza": confianza,
            }

        try:
            respuesta = ejecutar_consulta(etiqueta, negocio_id)
            return {
                "respuesta": respuesta or "No hay información disponible para esta consulta.",
                "intencion": etiqueta,
                "confianza": confianza,
            }
        except Exception as error:
            print(f"Error consultando Supabase: {error}")
            return {
                "respuesta": "No fue posible consultar la información en este momento. Verifica la conexión y vuelve a intentarlo.",
                "intencion": etiqueta,
                "confianza": confianza,
            }

    for intencion in data["intenciones"]:
        if intencion["etiqueta"] == etiqueta:
            return {
                "respuesta": random.choice(intencion["respuestas"]),
                "intencion": etiqueta,
                "confianza": confianza,
            }

    return {
        "respuesta": "No puedo atender esa consulta.\n\n" + mostrar_menu(),
        "intencion": "desconocida",
        "confianza": confianza,
    }
