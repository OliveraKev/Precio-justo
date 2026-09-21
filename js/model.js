/**
 * model.js — Modelo de datos de PrecioJusto.
 *
 * - Crea productos e insumos vacíos.
 * - Agrega/quita insumos SIN modificar el original (devuelve copias).
 * - Convierte lo que escribe el usuario (texto) en números seguros.
 *
 * Se usa así:
 *   const r = ProductModel.normalizarProducto(borradorDelFormulario);
 *   if (r.errores.length === 0) { Calculator.calcularProducto(r.producto); }
 */
(function (global) {
  'use strict';

  const UNIDAD_PREDETERMINADA = 'g';

  // Miles con punto (1.234.567) o con coma (1,234,567).
  const MILES_PUNTO = /^\d{1,3}(\.\d{3})+$/;
  const MILES_COMA = /^\d{1,3}(,\d{3})+$/;

  // Copia profunda de datos simples (JSON).
  function copiar(objeto) {
    return JSON.parse(JSON.stringify(objeto));
  }

  // ---------- Conversión de texto a número ----------

  /**
   * Convierte lo que escribe el usuario en un número.
   * Devuelve null si el texto no es un número válido (nunca NaN ni Infinity).
   *
   * Reglas:
   *  - Se ignoran los espacios: "1 000" → 1000
   *  - Si aparecen punto y coma, el ÚLTIMO es el decimal: "1.234,56" y "1,234.56" → 1234.56
   *  - Si un separador se repite, es de miles: "1.234.567" → 1234567
   *  - Si aparece una sola vez, es decimal: "4,5" → 4.5 y "1.234" → 1.234
   */
  function convertirNumero(entrada) {
    if (typeof entrada === 'number') {
      return Number.isFinite(entrada) ? entrada : null;
    }
    if (typeof entrada !== 'string') return null;

    let texto = entrada.replace(/[\s\u00A0]/g, '');
    let signo = 1;
    if (texto.charAt(0) === '-') {
      signo = -1;
      texto = texto.slice(1);
    } else if (texto.charAt(0) === '+') {
      texto = texto.slice(1);
    }

    // Solo dígitos, puntos y comas, y al menos un dígito.
    if (!/^[\d.,]+$/.test(texto) || !/\d/.test(texto)) return null;

    const ultimoPunto = texto.lastIndexOf('.');
    const ultimaComa = texto.lastIndexOf(',');

    // 1) Decidir cuál es el separador decimal (si lo hay).
    let decimal = null;
    if (ultimoPunto !== -1 && ultimaComa !== -1) {
      decimal = ultimoPunto > ultimaComa ? '.' : ',';
    } else if (ultimoPunto !== -1 || ultimaComa !== -1) {
      const sep = ultimoPunto !== -1 ? '.' : ',';
      if (texto.split(sep).length - 1 === 1) decimal = sep;
    }

    // 2) Separar parte entera y parte decimal.
    let parteEntera = texto;
    let parteDecimal = '';
    let separadorMiles = null;

    if (decimal !== null) {
      const pos = texto.lastIndexOf(decimal);
      parteEntera = texto.slice(0, pos);
      parteDecimal = texto.slice(pos + 1);
      separadorMiles = decimal === ',' ? '.' : ',';
    } else if (ultimoPunto !== -1) {
      separadorMiles = '.';
    } else if (ultimaComa !== -1) {
      separadorMiles = ',';
    }

    // 3) La parte entera solo puede tener separadores de miles bien colocados.
    if (!/^\d*$/.test(parteEntera)) {
      const patron = separadorMiles === '.' ? MILES_PUNTO : MILES_COMA;
      if (separadorMiles === null || !patron.test(parteEntera)) return null;
      parteEntera = parteEntera.replace(/[.,]/g, '');
    }

    const cadena =
      (parteEntera === '' ? '0' : parteEntera) +
      (parteDecimal === '' ? '' : '.' + parteDecimal);
    const valor = Number(cadena);

    if (!Number.isFinite(valor)) return null;
    return valor === 0 ? 0 : signo * valor; // evita devolver -0
  }

  // ---------- Productos e insumos ----------

  function crearInsumoVacio() {
    return {
      nombre: '',
      precioCompra: 0,
      cantidadComprada: 1,
      cantidadUsada: 0,
      unidad: UNIDAD_PREDETERMINADA
    };
  }

  function crearProductoVacio() {
    return {
      nombre: '',
      unidadesPorLote: 1,
      costosAdicionales: 0,
      margen: 30,
      impuesto: 0,
      insumos: []
    };
  }

  // Devuelve una copia del producto con un insumo más al final.
  function agregarInsumo(producto, insumo) {
    const nuevo = copiar(producto);
    if (!Array.isArray(nuevo.insumos)) nuevo.insumos = [];
    nuevo.insumos.push(insumo === undefined ? crearInsumoVacio() : copiar(insumo));
    return nuevo;
  }

  // Devuelve una copia del producto sin el insumo de esa posición (empieza en 0).
  // Si la posición no es válida, devuelve la copia sin cambios.
  function quitarInsumo(producto, indice) {
    const nuevo = copiar(producto);
    if (!Array.isArray(nuevo.insumos)) {
      nuevo.insumos = [];
      return nuevo;
    }
    if (Number.isInteger(indice) && indice >= 0 && indice < nuevo.insumos.length) {
      nuevo.insumos.splice(indice, 1);
    }
    return nuevo;
  }

  // ---------- Normalizar un borrador del formulario ----------

  /**
   * Recibe un borrador (con textos) y devuelve { producto, errores }.
   * Si hay errores, producto es null y errores trae los mensajes.
   * Aquí solo revisamos el FORMATO (¿es un número?). Las reglas de negocio
   * (margen menor que 100, unidades mayores que 0...) las valida Calculator.
   */
  function normalizarProducto(borrador) {
    const errores = [];
    const origen = borrador !== null && typeof borrador === 'object' ? borrador : {};

    function estaVacio(valor) {
      return (
        valor === undefined ||
        valor === null ||
        (typeof valor === 'string' && valor.trim() === '')
      );
    }

    function texto(valor) {
      return typeof valor === 'string' ? valor.trim() : '';
    }

    // Si es opcional y viene vacío, vale 0. Si no se entiende, anota el error.
    function numero(valor, mensaje, opcional) {
      if (opcional && estaVacio(valor)) return 0;
      const n = convertirNumero(valor);
      if (n === null) errores.push(mensaje);
      return n;
    }

    const nombre = texto(origen.nombre);
    if (nombre === '') errores.push('El nombre del producto es obligatorio.');

    const unidadesPorLote = numero(
      origen.unidadesPorLote,
      'Las unidades por lote no son un número válido.',
      false
    );
    const costosAdicionales = numero(
      origen.costosAdicionales,
      'Los costos adicionales no son un número válido.',
      true
    );
    const margen = numero(origen.margen, 'El margen no es un número válido.', false);
    const impuesto = numero(origen.impuesto, 'El impuesto no es un número válido.', true);

    const insumosOrigen = Array.isArray(origen.insumos) ? origen.insumos : [];
    const insumos = insumosOrigen.map(function (item, i) {
      const fila = item !== null && typeof item === 'object' ? item : {};
      const etiqueta = 'Insumo ' + (i + 1) + ': ';

      const nombreInsumo = texto(fila.nombre);
      if (nombreInsumo === '') errores.push(etiqueta + 'falta el nombre.');

      return {
        nombre: nombreInsumo,
        precioCompra: numero(
          fila.precioCompra,
          etiqueta + 'el precio de compra no es un número válido.',
          false
        ),
        cantidadComprada: numero(
          fila.cantidadComprada,
          etiqueta + 'la cantidad comprada no es un número válido.',
          false
        ),
        cantidadUsada: numero(
          fila.cantidadUsada,
          etiqueta + 'la cantidad usada no es un número válido.',
          false
        ),
        unidad: texto(fila.unidad)
      };
    });

    const producto = {
      nombre: nombre,
      unidadesPorLote: unidadesPorLote,
      costosAdicionales: costosAdicionales,
      margen: margen,
      impuesto: impuesto,
      insumos: insumos
    };
    // Si el producto ya existía (se está editando), conservamos su id.
    if (!estaVacio(origen.id)) producto.id = String(origen.id);

    return {
      producto: errores.length === 0 ? producto : null,
      errores: errores
    };
  }

  global.ProductModel = {
    convertirNumero: convertirNumero,
    crearInsumoVacio: crearInsumoVacio,
    crearProductoVacio: crearProductoVacio,
    agregarInsumo: agregarInsumo,
    quitarInsumo: quitarInsumo,
    normalizarProducto: normalizarProducto
  };
})(globalThis);