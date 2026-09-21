/**
 * calculator.js — Fórmulas de costos y precio de venta de PrecioJusto.
 *
 * Son funciones "puras": reciben números, devuelven números y no tocan
 * la pantalla ni LocalStorage. Por eso son fáciles de probar.
 *
 * IMPORTANTE: todos los valores de entrada deben ser de tipo number.
 * app.js convertirá lo que escriba el usuario con ProductModel antes de llamar aquí.
 *
 * Etapa 8: se agregan límites (errores que bloquean) y mensajes con
 * género y número correctos.
 */
(function (global) {
  'use strict';

  // ---------- Límites (se pueden ajustar aquí) ----------

  const LIMITES = {
    valorMaximo: 1000000000,        // tope para cualquier número que escribe el usuario
    impuestoMaximo: 100,            // en %
    maxInsumos: 50,                 // insumos por producto
    resultadoMaximo: 1000000000000  // si un resultado lo supera, casi seguro hay un error de tipeo
  };

  // ---------- Campos (para que los mensajes concuerden) ----------

  function campo(texto, femenino, plural) {
    return { texto: texto, femenino: femenino, plural: plural };
  }

  const CAMPO = {
    precioCompra: campo('El precio de compra', false, false),
    cantidadComprada: campo('La cantidad comprada', true, false),
    cantidadUsada: campo('La cantidad usada', true, false),
    costosAdicionales: campo('Los costos adicionales', false, true),
    unidadesPorLote: campo('Las unidades por lote', true, true),
    costoLote: campo('El costo del lote', false, false),
    costoPorUnidad: campo('El costo por unidad', false, false),
    margen: campo('El margen', false, false),
    impuesto: campo('El impuesto', false, false),
    precio: campo('El precio', false, false)
  };

  // ---------- Validaciones internas ----------

  // 1000000000 → "1 000 000 000" (con espacios que no se separan al cambiar de línea)
  function formatearLimite(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  }

  // negativo, negativa, negativos, negativas
  function negativo(c) {
    return 'negativ' + (c.femenino ? 'a' : 'o') + (c.plural ? 's' : '');
  }

  function validarNumero(valor, c) {
    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
      throw new Error(c.texto + (c.plural ? ' deben ser números válidos.' : ' debe ser un número válido.'));
    }
  }

  function validarNoNegativo(valor, c) {
    validarNumero(valor, c);
    if (valor < 0) {
      throw new Error(c.texto + (c.plural ? ' no pueden ser ' : ' no puede ser ') + negativo(c) + '.');
    }
  }

  function validarMayorQueCero(valor, c) {
    validarNumero(valor, c);
    if (valor <= 0) {
      throw new Error(c.texto + (c.plural ? ' deben ser mayores que cero.' : ' debe ser mayor que cero.'));
    }
  }

  function validarMaximo(valor, c, maximo, sufijo) {
    if (valor > maximo) {
      throw new Error(
        c.texto + (c.plural ? ' no pueden superar ' : ' no puede superar ') +
        formatearLimite(maximo) + (sufijo || '') + '.'
      );
    }
  }

  // Número válido, no negativo y que no pase el tope general.
  function validarTope(valor, c) {
    validarNoNegativo(valor, c);
    validarMaximo(valor, c, LIMITES.valorMaximo);
  }

  // ---------- Límites de un producto completo ----------

  function validarLimites(producto) {
    const insumos = Array.isArray(producto.insumos) ? producto.insumos : [];

    if (insumos.length > LIMITES.maxInsumos) {
      throw new Error('Un producto puede tener como máximo ' + LIMITES.maxInsumos + ' insumos.');
    }

    insumos.forEach(function (insumo) {
      validarTope(insumo.precioCompra, CAMPO.precioCompra);
      validarTope(insumo.cantidadComprada, CAMPO.cantidadComprada);
      validarTope(insumo.cantidadUsada, CAMPO.cantidadUsada);
    });

    validarTope(producto.costosAdicionales, CAMPO.costosAdicionales);
    validarTope(producto.unidadesPorLote, CAMPO.unidadesPorLote);

    if (producto.impuesto !== undefined) {
      validarNoNegativo(producto.impuesto, CAMPO.impuesto);
      validarMaximo(producto.impuesto, CAMPO.impuesto, LIMITES.impuestoMaximo, ' %');
    }
  }

  // Si algún resultado es infinito o enorme, casi seguro hay un error de tipeo.
  function validarResultado(resultado) {
    Object.keys(resultado).forEach(function (clave) {
      const v = resultado[clave];
      if (!Number.isFinite(v) || Math.abs(v) > LIMITES.resultadoMaximo) {
        throw new Error('El resultado es demasiado grande. Revisa los números que escribiste.');
      }
    });
  }

  // ---------- Fórmulas ----------

  /**
   * Costo de la porción de un insumo que se usa en el lote.
   * costo_insumo = (precio_compra / cantidad_comprada) × cantidad_usada
   */
  function costoInsumo(insumo) {
    validarNoNegativo(insumo.precioCompra, CAMPO.precioCompra);
    validarMayorQueCero(insumo.cantidadComprada, CAMPO.cantidadComprada);
    validarNoNegativo(insumo.cantidadUsada, CAMPO.cantidadUsada);

    return (insumo.precioCompra / insumo.cantidadComprada) * insumo.cantidadUsada;
  }

  /**
   * Costo total del lote: suma de insumos + costos adicionales (gas, empaque...).
   */
  function costoLote(insumos, costosAdicionales) {
    validarNoNegativo(costosAdicionales, CAMPO.costosAdicionales);

    const totalInsumos = insumos.reduce(function (suma, insumo) {
      return suma + costoInsumo(insumo);
    }, 0);

    return totalInsumos + costosAdicionales;
  }

  /**
   * Costo de producir UNA unidad.
   * costo_unitario = costo_lote / unidades_por_lote
   */
  function costoUnitario(costoDelLote, unidadesPorLote) {
    validarNoNegativo(costoDelLote, CAMPO.costoLote);
    validarMayorQueCero(unidadesPorLote, CAMPO.unidadesPorLote);

    return costoDelLote / unidadesPorLote;
  }

  /**
   * Precio de venta para lograr un MARGEN sobre el precio (no es markup).
   * precio_sugerido = costo_unitario / (1 − margen/100)
   * El margen debe ser menor que 100, porque con 100 % habría que dividir entre cero.
   */
  function precioSugerido(costoPorUnidad, margen) {
    validarNoNegativo(costoPorUnidad, CAMPO.costoPorUnidad);
    validarNoNegativo(margen, CAMPO.margen);
    if (margen >= 100) {
      throw new Error('El margen debe ser menor que 100 %.');
    }

    return costoPorUnidad / (1 - margen / 100);
  }

  /**
   * Precio final con impuesto.
   * precio_final = precio_sugerido × (1 + impuesto/100)
   */
  function precioFinal(precio, impuesto) {
    validarNoNegativo(precio, CAMPO.precio);
    validarNoNegativo(impuesto, CAMPO.impuesto);

    return precio * (1 + impuesto / 100);
  }

  /**
   * Ganancia por unidad = precio sugerido − costo unitario.
   */
  function gananciaPorUnidad(precio, costoPorUnidad) {
    return precio - costoPorUnidad;
  }

  /**
   * Redondea SOLO para mostrar en pantalla (los cálculos internos
   * conservan todos los decimales para no acumular errores).
   */
  function redondear(valor, decimales) {
    const cifras = decimales === undefined ? 2 : decimales;
    const factor = Math.pow(10, cifras);
    return Math.round((valor + Number.EPSILON) * factor) / factor;
  }

  /**
   * Calcula todo de una vez a partir de un producto con la forma:
   * { insumos: [...], costosAdicionales, unidadesPorLote, margen, impuesto }
   * Lanza un Error con un mensaje claro si algo no es válido.
   */
  function calcularProducto(producto) {
    const insumos = Array.isArray(producto.insumos) ? producto.insumos : [];
    const impuesto = producto.impuesto === undefined ? 0 : producto.impuesto;

    validarLimites({
      insumos: insumos,
      costosAdicionales: producto.costosAdicionales,
      unidadesPorLote: producto.unidadesPorLote,
      impuesto: impuesto
    });

    const totalLote = costoLote(insumos, producto.costosAdicionales);
    const unitario = costoUnitario(totalLote, producto.unidadesPorLote);
    const sugerido = precioSugerido(unitario, producto.margen);
    const conImpuesto = precioFinal(sugerido, impuesto);
    const ganancia = gananciaPorUnidad(sugerido, unitario);

    const resultado = {
      costoLote: totalLote,
      costoUnitario: unitario,
      precioSugerido: sugerido,
      precioFinal: conImpuesto,
      gananciaUnidad: ganancia
    };

    validarResultado(resultado);
    return resultado;
  }

  // ---------- Exportar ----------
  // En el navegador queda disponible como el objeto global "Calculator".
  global.Calculator = {
    LIMITES: LIMITES,
    costoInsumo: costoInsumo,
    costoLote: costoLote,
    costoUnitario: costoUnitario,
    precioSugerido: precioSugerido,
    precioFinal: precioFinal,
    gananciaPorUnidad: gananciaPorUnidad,
    redondear: redondear,
    validarLimites: validarLimites,
    calcularProducto: calcularProducto
  };
})(globalThis);