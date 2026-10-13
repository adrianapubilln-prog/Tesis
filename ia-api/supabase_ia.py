
import os
import requests
from dotenv import load_dotenv
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

# Carga las variables de entorno del archivo .env.
load_dotenv()

# Configuración de Supabase.
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

# Tiempo máximo de espera para las peticiones HTTP.
TIMEOUT_SUPABASE = 20

# Tablas que consulta el módulo de inteligencia artificial.
TABLAS_NEGOCIO = {
    "ventas": "sales",
    "compras": "purchases",
    "gastos": "expenses",
    "productos": "products",
    "clientes": "clients",
    "proveedores": "suppliers",
}


def validar_configuracion():
    """Comprueba que las variables de conexión estén configuradas."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError(
            "Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el archivo .env."
        )


def encabezados_supabase(token_usuario=None):
    """Construye los encabezados para consultar Supabase."""
    validar_configuracion()

    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Accept-Profile": "public",
    }


def consultar_tabla(tabla, parametros=None):
    """
    Consulta una tabla mediante la API REST de Supabase.
    Los filtros se reciben como un diccionario de parámetros.
    """
    validar_configuracion()

    url = f"{SUPABASE_URL}/rest/v1/{tabla}"
    parametros = parametros or {}

    try:
        respuesta = requests.get(
            url,
            headers=encabezados_supabase(),
            params=parametros,
            timeout=TIMEOUT_SUPABASE,
        )

        print(f"\nTabla consultada: {tabla}")
        print(f"Estado HTTP: {respuesta.status_code}")

        if not respuesta.ok:
            print(
                "Error REST:",
                respuesta.text[:1000]
            )
            respuesta.raise_for_status()

        datos = respuesta.json()

        if not isinstance(datos, list):
            print("La API no devolvió una lista de registros.")
            return []

        print(f"Registros encontrados: {len(datos)}")
        return datos

    except requests.exceptions.Timeout:
        print(f"Tiempo de espera agotado al consultar {tabla}.")
        return []

    except requests.exceptions.RequestException as error:
        print(f"Error al consultar {tabla}: {error}")
        return []

    except ValueError as error:
        print(f"Error al interpretar la respuesta de {tabla}: {error}")
        return []


def verificar_usuario(token_usuario):
    """
    Verifica el token de autenticación con Supabase Auth.
    El token del usuario se utiliza únicamente para validar su identidad.
    """
    validar_configuracion()

    if not token_usuario:
        print("No se recibió el token del usuario.")
        return None

    try:
        respuesta = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {token_usuario}",
            },
            timeout=TIMEOUT_SUPABASE,
        )

        if respuesta.status_code != 200:
            print(
                "No se pudo verificar el usuario. "
                f"Estado HTTP: {respuesta.status_code}"
            )
            return None

        usuario = respuesta.json()
        usuario_id = usuario.get("id")

        if not usuario_id:
            print("La respuesta de autenticación no contiene un ID.")
            return None

        print(f"Usuario autenticado correctamente: {usuario_id}")
        return usuario

    except requests.exceptions.RequestException as error:
        print(f"Error al verificar el usuario: {error}")
        return None


def obtener_negocio_usuario(usuario_id):
    """
    Busca el negocio asociado al usuario autenticado.
    La relación principal se obtiene desde business_users.auth_user_id.
    """
    if not usuario_id:
        print("No se recibió el ID del usuario.")
        return None

    print(f"\nBuscando negocio para el usuario: {usuario_id}")

    membresias = consultar_tabla(
        "business_users",
        {
            "select": "business_id,auth_user_id,name,email,role",
            "auth_user_id": f"eq.{usuario_id}",
            "limit": "1",
        },
    )

    if not membresias:
        print(
            "No se encontró la membresía. "
            "Comprueba el acceso REST y que auth_user_id coincida con el usuario."
        )
        return None

    membresia = membresias[0]
    negocio_id = membresia.get("business_id")

    if not negocio_id:
        print("La membresía no tiene un business_id.")
        return None

    print(f"Negocio encontrado: {negocio_id}")
    print(f"Rol del usuario: {membresia.get('role', 'Sin rol')}")
    return negocio_id


def obtener_membresia_usuario(usuario_id):
    """Devuelve los datos de la membresía del usuario autenticado."""
    if not usuario_id:
        return None

    membresias = consultar_tabla(
        "business_users",
        {
            "select": "id,business_id,auth_user_id,name,email,role,permissions",
            "auth_user_id": f"eq.{usuario_id}",
            "limit": "1",
        },
    )

    return membresias[0] if membresias else None


def consultar_datos_negocio(tabla, negocio_id, limite=100):
    """
    Consulta registros de una tabla pertenecientes a un negocio.
    Se asume que la tabla tiene una columna business_id.
    """
    if not negocio_id:
        print(f"No se puede consultar {tabla}: falta el negocio.")
        return []

    return consultar_tabla(
        tabla,
        {
            "select": "*",
            "business_id": f"eq.{negocio_id}",
            "limit": str(limite),
            "order": "created_at.desc",
        },
    )


def convertir_numero(valor):
    """Convierte un valor numérico a Decimal; devuelve cero si no es válido."""
    if valor is None or isinstance(valor, bool):
        return Decimal("0")

    try:
        if isinstance(valor, str):
            valor = valor.strip().replace(",", "")

            if not valor:
                return Decimal("0")

        return Decimal(str(valor))

    except (InvalidOperation, ValueError, TypeError):
        return Decimal("0")


def obtener_valor_numerico(registro, posibles_campos):
    """Obtiene el primer importe disponible entre los campos indicados."""
    for campo in posibles_campos:
        if campo in registro and registro[campo] is not None:
            return convertir_numero(registro[campo])

    return Decimal("0")


def sumar_importes(registros, posibles_campos):
    """Suma importes de una lista de registros."""
    return sum(
        (
            obtener_valor_numerico(registro, posibles_campos)
            for registro in registros
        ),
        Decimal("0"),
    )


def formatear_importe(valor):
    """Formatea un importe con dos decimales."""
    return f"{valor:,.2f}"


def resumir_registros(registros, campos_importe=None):
    """Genera un resumen básico sin asumir un único nombre de columna monetaria."""
    resumen = {
        "cantidad": len(registros),
    }

    if campos_importe:
        total = sumar_importes(registros, campos_importe)
        resumen["total"] = formatear_importe(total)

    return resumen

from datetime import date, datetime


from datetime import date, datetime
from calendar import monthrange


def numero(valor):
    """Convierte un importe a número de forma segura."""
    try:
        return float(valor or 0)
    except (TypeError, ValueError):
        return 0.0


def normalizar_texto(valor):
    """Normaliza textos para comparar estados."""
    return str(valor or "").strip().lower()


def obtener_registros(tabla, negocio_id):
    """Consulta registros usando el filtro de negocio existente."""
    resultado = consultar_datos_negocio(tabla, negocio_id)
    return resultado if isinstance(resultado, list) else []


def obtener_fecha_registro(registro, campos):
    """Devuelve la primera fecha válida de los campos indicados."""
    for campo in campos:
        fecha = convertir_fecha(registro.get(campo))
        if fecha:
            return fecha
    return None


def pertenece_a_mes(registro, campos_fecha, anio, mes):
    fecha = obtener_fecha_registro(registro, campos_fecha)
    return fecha is not None and fecha.year == anio and fecha.month == mes


def excluir_anuladas(registros):
    """Excluye operaciones cuyo estado indica cancelación o anulación."""
    estados_excluidos = {
        "anulada", "anulado", "cancelada", "cancelado",
        "void", "cancelled"
    }

    return [
        r for r in registros
        if normalizar_texto(r.get("status")) not in estados_excluidos
    ]


def dinero(valor):
    return f"${numero(valor):,.2f}"


def obtener_detalles_de_ventas(ids_ventas):
    """Obtiene detalles solo de las ventas previamente autorizadas."""
    detalles = []

    for id_venta in ids_ventas:
        resultado = consultar_tabla(
            "sale_items",
            {"sale_id": f"eq.{id_venta}"}
        )

        if isinstance(resultado, list):
            detalles.extend(resultado)

    return detalles


def ejecutar_consulta(etiqueta, negocio_id, parametros=None):
    """Ejecuta consultas específicas para cada intención de Chatty."""

    if not negocio_id:
        return {
            "ok": False,
            "mensaje": "No se identificó el negocio del usuario.",
            "datos": []
        }

    clave = normalizar_texto(etiqueta)
    hoy = date.today()

    # Operaciones de escritura: necesitan datos explícitos.
    operaciones = {
        "registrar_venta": "venta",
        "registrar_compra": "compra",
        "registrar_gasto": "gasto"
    }

    if clave in operaciones:
        return {
            "ok": False,
            "accion_requerida": operaciones[clave],
            "mensaje": (
                "Para registrar esta operación necesito los datos "
                "correspondientes. Todavía no se ha guardado ningún registro."
            ),
            "datos": parametros or {}
        }

    # Obtener únicamente registros pertenecientes al negocio.
    ventas = obtener_registros("sales", negocio_id)
    gastos = obtener_registros("expenses", negocio_id)
    compras = obtener_registros("purchases", negocio_id)
    productos = obtener_registros("products", negocio_id)
    clientes = obtener_registros("clients", negocio_id)
    proveedores = obtener_registros("suppliers", negocio_id)

    ventas = excluir_anuladas(ventas)
    compras = excluir_anuladas(compras)
    gastos = excluir_anuladas(gastos)

    ventas_mes = [
        r for r in ventas
        if pertenece_a_mes(r, ("sale_date", "created_at"),
                           hoy.year, hoy.month)
    ]

    gastos_mes = [
        r for r in gastos
        if pertenece_a_mes(r, ("expense_date", "created_at"),
                           hoy.year, hoy.month)
    ]

    if clave == "ingresos_mes":
        total = sum(numero(r.get("total")) for r in ventas_mes)

        return {
            "ok": True,
            "mensaje": f"Los ingresos del mes son {dinero(total)}.",
            "resumen": {"ingresos_mes": total},
            "datos": ventas_mes
        }

    elif clave == "gastos_mes":
        total = sum(numero(r.get("amount")) for r in gastos_mes)

        return {
            "ok": True,
            "mensaje": f"Los gastos del mes son {dinero(total)}.",
            "resumen": {"gastos_mes": total},
            "datos": gastos_mes
        }

    elif clave == "ganancia_neta":
        ingresos = sum(numero(r.get("total")) for r in ventas_mes)
        utilidad_ventas = sum(numero(r.get("profit")) for r in ventas_mes)
        total_gastos = sum(numero(r.get("amount")) for r in gastos_mes)
        ganancia = utilidad_ventas - total_gastos

        return {
            "ok": True,
            "mensaje": (
                f"Ingresos: {dinero(ingresos)}. "
                f"Utilidad de ventas: {dinero(utilidad_ventas)}. "
                f"Gastos: {dinero(total_gastos)}. "
                f"Ganancia neta estimada: {dinero(ganancia)}."
            ),
            "resumen": {
                "ingresos": ingresos,
                "utilidad_ventas": utilidad_ventas,
                "gastos": total_gastos,
                "ganancia_neta": ganancia
            },
            "datos": []
        }

    elif clave == "cuentas_por_cobrar":
        # Se utiliza el saldo de cada cliente como fuente principal
        # para evitar sumar también las ventas pendientes y duplicar deuda.
        pendientes = [
            c for c in clientes
            if numero(c.get("balance")) > 0
        ]
        total = sum(numero(c.get("balance")) for c in pendientes)

        return {
            "ok": True,
            "mensaje": (
                f"Tienes {len(pendientes)} clientes con saldo pendiente, "
                f"por un total de {dinero(total)}."
            ),
            "resumen": {
                "clientes_con_saldo": len(pendientes),
                "total_por_cobrar": total
            },
            "datos": pendientes
        }

    elif clave == "cuentas_por_pagar":
        pendientes = [
            p for p in proveedores
            if numero(p.get("balance")) > 0
        ]
        total = sum(numero(p.get("balance")) for p in pendientes)

        return {
            "ok": True,
            "mensaje": (
                f"Tienes {len(pendientes)} proveedores con saldo pendiente, "
                f"por un total de {dinero(total)}."
            ),
            "resumen": {
                "proveedores_con_saldo": len(pendientes),
                "total_por_pagar": total
            },
            "datos": pendientes
        }

    elif clave == "valor_inventario":
        costo = sum(
            numero(p.get("stock")) * numero(p.get("cost"))
            for p in productos
        )
        precio_venta = sum(
            numero(p.get("stock")) * numero(p.get("sale_price"))
            for p in productos
        )
        unidades = sum(numero(p.get("stock")) for p in productos)

        return {
            "ok": True,
            "mensaje": (
                f"El inventario tiene {unidades:,.2f} unidades. "
                f"Valor al costo: {dinero(costo)}. "
                f"Valor potencial al precio de venta: {dinero(precio_venta)}."
            ),
            "resumen": {
                "unidades": unidades,
                "valor_costo": costo,
                "valor_potencial_venta": precio_venta
            },
            "datos": productos
        }

    elif clave == "stock_bajo":
        bajos = [
            p for p in productos
            if numero(p.get("stock")) <= numero(p.get("min_stock"))
        ]

        return {
            "ok": True,
            "mensaje": (
                f"Encontré {len(bajos)} productos con stock igual o inferior "
                "al mínimo establecido."
            ),
            "resumen": {"productos_stock_bajo": len(bajos)},
            "datos": bajos
        }

    elif clave == "productos_mas_vendidos":
        # sale_items no tiene business_id. Primero se filtran las ventas
        # del negocio y después se usan sus IDs para filtrar los detalles.
        ids_ventas = {str(v.get("id")) for v in ventas}
        detalles = obtener_detalles_de_ventas("sale_items")

        acumulado = {}

        for detalle in detalles:
            if str(detalle.get("sale_id")) not in ids_ventas:
                continue

            nombre = detalle.get("name") or "Producto sin nombre"
            clave_producto = str(
                detalle.get("product_id") or nombre
            )

            if clave_producto not in acumulado:
                acumulado[clave_producto] = {
                    "producto": nombre,
                    "cantidad_vendida": 0,
                    "total_vendido": 0
                }

            acumulado[clave_producto]["cantidad_vendida"] += numero(
                detalle.get("quantity")
            )
            acumulado[clave_producto]["total_vendido"] += numero(
                detalle.get("total")
            )

        ranking = sorted(
            acumulado.values(),
            key=lambda x: x["cantidad_vendida"],
            reverse=True
        )[:10]

        return {
            "ok": True,
            "mensaje": (
                "Estos son los productos con mayor cantidad de unidades "
                "vendidas."
            ),
            "resumen": {"cantidad_productos": len(ranking)},
            "datos": ranking
        }

    elif clave == "comparacion_ingresos_gastos":
        ingresos = sum(numero(r.get("total")) for r in ventas_mes)
        total_gastos = sum(numero(r.get("amount")) for r in gastos_mes)

        return {
            "ok": True,
            "mensaje": (
                f"Este mes: ingresos de {dinero(ingresos)} y gastos de "
                f"{dinero(total_gastos)}. Diferencia: "
                f"{dinero(ingresos - total_gastos)}."
            ),
            "resumen": {
                "ingresos": ingresos,
                "gastos": total_gastos,
                "diferencia": ingresos - total_gastos
            },
            "datos": []
        }

    elif clave == "utilidad_mes_anterior":
        if hoy.month == 1:
            anio_anterior, mes_anterior = hoy.year - 1, 12
        else:
            anio_anterior, mes_anterior = hoy.year, hoy.month - 1

        ventas_anteriores = [
            r for r in ventas
            if pertenece_a_mes(r, ("sale_date", "created_at"),
                               anio_anterior, mes_anterior)
        ]
        gastos_anteriores = [
            r for r in gastos
            if pertenece_a_mes(r, ("expense_date", "created_at"),
                               anio_anterior, mes_anterior)
        ]

        ingresos = sum(numero(r.get("total")) for r in ventas_anteriores)
        utilidad = sum(numero(r.get("profit")) for r in ventas_anteriores)
        total_gastos = sum(numero(r.get("amount")) for r in gastos_anteriores)
        ganancia = utilidad - total_gastos

        return {
            "ok": True,
            "mensaje": (
                f"Resumen de {mes_anterior:02d}/{anio_anterior}: "
                f"ingresos {dinero(ingresos)}, utilidad de ventas "
                f"{dinero(utilidad)}, gastos {dinero(total_gastos)} "
                f"y ganancia neta estimada {dinero(ganancia)}."
            ),
            "resumen": {
                "anio": anio_anterior,
                "mes": mes_anterior,
                "ingresos": ingresos,
                "utilidad_ventas": utilidad,
                "gastos": total_gastos,
                "ganancia_neta": ganancia
            },
            "datos": []
        }

    elif clave == "ultimas_transacciones":
        transacciones = []
        print("VENTAS:", len(ventas), ventas)
        print("COMPRAS:", len(compras), compras)
        print("GASTOS:", len(gastos), gastos)

        for registro in ventas:
            transacciones.append({
                "tipo": "Venta",
                "fecha": registro.get("sale_date") or registro.get("created_at"),
                "referencia": registro.get("invoice_number"),
                "estado": registro.get("status"),
                "importe": numero(registro.get("total"))
            })

        for registro in compras:
            transacciones.append({
                "tipo": "Compra",
                "fecha": registro.get("purchase_date") or registro.get("created_at"),
                "referencia": registro.get("invoice_number"),
                "estado": registro.get("status"),
                "importe": numero(registro.get("total"))
            })

        for registro in gastos:
            transacciones.append({
                "tipo": "Gasto",
                "fecha": registro.get("expense_date") or registro.get("created_at"),
                "referencia": registro.get("description"),
                "estado": registro.get("status"),
                "importe": numero(registro.get("amount"))
            })

        transacciones.sort(
            key=lambda r: str(r.get("fecha") or ""),
            reverse=True
        )

        ultimas = transacciones[:10]

        return {
            "ok": True,
            "mensaje": f"Estas son las últimas {len(ultimas)} transacciones.",
            "resumen": {"transacciones_encontradas": len(ultimas)},
            "datos": ultimas
        }

    return {
        "ok": False,
        "mensaje": f"No se reconoce la consulta: {etiqueta}",
        "datos": []
    }


def convertir_fecha(valor):
    """Convierte fechas ISO a date; devuelve None si no son válidas."""
    if not valor:
        return None

    try:
        return datetime.fromisoformat(
            str(valor).replace("Z", "+00:00")
        ).date()
    except (ValueError, TypeError):
        return None


def obtener_resumen_negocio(negocio_id):
    """Obtiene un resumen general de las tablas principales del negocio."""
    if not negocio_id:
        return {
            "ok": False,
            "mensaje": "No se identificó el negocio.",
            "tablas": {},
        }

    resultados = {}

    for categoria, tabla in TABLAS_NEGOCIO.items():
        registros = consultar_datos_negocio(tabla, negocio_id)

        campos_importe = {
            "ventas": ("total", "amount", "monto", "total_amount"),
            "compras": ("total", "amount", "monto", "total_amount"),
            "gastos": ("amount", "monto", "total", "total_amount"),
        }.get(categoria)

        resultados[categoria] = {
            "tabla": tabla,
            "resumen": resumir_registros(registros, campos_importe),
            "datos": registros,
        }

    return {
        "ok": True,
        "negocio_id": negocio_id,
        "tablas": resultados,
    }


def probar_acceso_supabase():
    """Comprueba el acceso REST sin imprimir información personal."""
    print("\n========== PRUEBA DE SUPABASE ==========")
    print(f"URL configurada: {SUPABASE_URL}")
    print(f"Clave configurada: {bool(SUPABASE_SERVICE_ROLE_KEY)}")

    for tabla in ("businesses", "business_users"):
        try:
            respuesta = requests.get(
                f"{SUPABASE_URL}/rest/v1/{tabla}",
                headers=encabezados_supabase(),
                params={"select": "*", "limit": "1"},
                timeout=TIMEOUT_SUPABASE,
            )

            print(f"\nTabla: {tabla}")
            print(f"Estado HTTP: {respuesta.status_code}")

            if respuesta.ok:
                datos = respuesta.json()
                print(f"Filas recibidas: {len(datos) if isinstance(datos, list) else 0}")
            else:
                print("Respuesta de error:", respuesta.text[:500])

        except requests.exceptions.RequestException as error:
            print(f"Error de conexión con {tabla}: {error}")


def probar_membresia_usuario(usuario_id):
    """Comprueba si REST encuentra una membresía sin mostrar datos personales."""
    print("\n========== PRUEBA DE MEMBRESÍA ==========")

    membresia = obtener_membresia_usuario(usuario_id)

    if not membresia:
        print("No se encontró la membresía mediante REST.")
        return False

    print("Membresía encontrada: Sí")
    print(f"Negocio asociado: {membresia.get('business_id')}")
    print(f"Rol: {membresia.get('role')}")
    return True
