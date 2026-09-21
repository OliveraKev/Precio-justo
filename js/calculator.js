/**
 * calculator.js — Fórmulas de costos y precio de venta de PrecioJusto.
 *
 * Son funciones "puras": reciben números, devuelven números y no tocan
 * la pantalla ni LocalStorage. Por eso son fáciles de probar.
 *
 * IMPORTANTE: todos los valores de entrada deben ser de tipo number.
 * app.js convertirá lo que escriba el usuario con Number() antes de llamar aquí.
 */
(function (global) {
  'use strict';

  // ---------- Validaciones internas ----------

  function validarNumero(valor, nombre) {
    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
      throw new Error(nombre + ' debe ser un número válido.');
    }
  }

  function validarNoNegativo(valor, nombre) {
    validarNumero(valor, nombre);
    if (valor < 0) {
      throw new Error(nombre + ' no puede ser negativo.');
    }
  }

  function validarMayorQueCero(valor, nombre) {
    validarNumero(valor, nombre);
    if (valor <= 0) {
      throw new Error(nombre + ' debe ser mayor que cero.');
    }
  }

  // ---------- Fórmulas ----------

  /**
   * Costo de la porción de un insumo que se usa en el lote.
   * costo_insumo = (precio_compra / cantidad_comprada) × cantidad_usada
   */
  function costoInsumo(insumo) {
    validarNoNegativo(insumo.precioCompra, 'El precio de compra');
    validarMayorQueCero(insumo.cantidadComprada, 'La cantidad comprada');
    validarNoNegativo(insumo.cantidadUsada, 'La cantidad usada');

    return (insumo.precioCompra / insumo.cantidadComprada) * insumo.cantidadUsada;
  }

  /**
   * Costo total del lote: suma de insumos + costos adicionales (gas, empaque...).
   */
  function costoLote(insumos, costosAdicionales) {
    validarNoNegativo(costosAdicionales, 'Los costos adicionales');

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
    validarNoNegativo(costoDelLote, 'El costo del lote');
    validarMayorQueCero(unidadesPorLote, 'Las unidades por lote');

    return costoDelLote / unidadesPorLote;
  }

  /**
   * Precio de venta para lograr un MARGEN sobre el precio (no es markup).
   * precio_sugerido = costo_unitario / (1 − margen/100)
   * El margen debe ser menor que 100, porque con 100 % habría que dividir entre cero.
   */
  function precioSugerido(costoPorUnidad, margen) {
    validarNoNegativo(costoPorUnidad, 'El costo por unidad');
    validarNoNegativo(margen, 'El margen');
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
    validarNoNegativo(precio, 'El precio');
    validarNoNegativo(impuesto, 'El impuesto');

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
   */
  function calcularProducto(producto) {
    const insumos = Array.isArray(producto.insumos) ? producto.insumos : [];
    const impuesto = producto.impuesto === undefined ? 0 : producto.impuesto;

    const totalLote = costoLote(insumos, producto.costosAdicionales);
    const unitario = costoUnitario(totalLote, producto.unidadesPorLote);
    const sugerido = precioSugerido(unitario, producto.margen);
    const conImpuesto = precioFinal(sugerido, impuesto);
    const ganancia = gananciaPorUnidad(sugerido, unitario);

    return {
      costoLote: totalLote,
      costoUnitario: unitario,
      precioSugerido: sugerido,
      precioFinal: conImpuesto,
      gananciaUnidad: ganancia
    };
  }

  // ---------- Exportar ----------
  // En el navegador queda disponible como el objeto global "Calculator".
  const API = {
    costoInsumo: costoInsumo,
    costoLote: costoLote,
    costoUnitario: costoUnitario,
    precioSugerido: precioSugerido,
    precioFinal: precioFinal,
    gananciaPorUnidad: gananciaPorUnidad,
    redondear: redondear,
    calcularProducto: calcularProducto
  };

  global.Calculator = API;
})(globalThis);