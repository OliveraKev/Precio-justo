/**
 * validaciones.js — Avisos que NO bloquean (Etapa 8).
 *
 * Un aviso no es un error: el dato puede ser correcto, pero conviene mirarlo.
 * Los errores que sí bloquean viven en calculator.js.
 *
 * Se usa así:
 *   const avisos = Validations.advertencias(productoNormalizado);
 *   // → lista de textos (vacía si no hay nada que avisar)
 */
(function (global) {
  'use strict';

  // Por encima de este margen (%) avisamos. Es un valor arbitrario: ajústalo si quieres.
  const UMBRAL_MARGEN_ALTO = 80;

  function esNumero(valor) {
    return typeof valor === 'number' && Number.isFinite(valor);
  }

  // "  Azúcar " y "azucar" cuentan como el mismo nombre.
  function clave(nombre) {
    return nombre
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  function advertencias(producto) {
    const avisos = [];
    if (producto === null || typeof producto !== 'object') return avisos;

    // ----- Margen -----
    const margen = producto.margen;
    if (esNumero(margen)) {
      if (margen === 0) {
        avisos.push('Con un margen de 0 % vendes al costo: no ganas nada.');
      } else if (margen > UMBRAL_MARGEN_ALTO && margen < 100) {
        const veces = 1 / (1 - margen / 100);
        avisos.push(
          'Un margen de ' + margen + ' % significa vender a ' + veces.toFixed(2) +
          ' veces el costo. ¿Es lo que quieres?'
        );
      }
    }

    const insumos = Array.isArray(producto.insumos) ? producto.insumos : [];

    // ----- Insumos repetidos (los nombres vacíos no cuentan) -----
    const vistos = new Map();
    insumos.forEach(function (insumo) {
      if (insumo === null || typeof insumo !== 'object') return;
      if (typeof insumo.nombre !== 'string') return;

      const visible = insumo.nombre.trim();
      if (visible === '') return;

      const k = clave(visible);
      const registro = vistos.get(k);
      if (registro) {
        registro.veces += 1;
      } else {
        vistos.set(k, { nombre: visible, veces: 1 });
      }
    });

    const repetidos = [];
    vistos.forEach(function (registro) {
      if (registro.veces > 1) repetidos.push('«' + registro.nombre + '»');
    });
    if (repetidos.length > 0) {
      avisos.push(
        'Hay insumos repetidos: ' + repetidos.join(', ') +
        '. Si son compras distintas, está bien; si no, cuéntalos una sola vez para no duplicar el costo.'
      );
    }

    // ----- Cantidad usada mayor que la comprada (¿mezcla de unidades?) -----
    insumos.forEach(function (insumo, i) {
      if (insumo === null || typeof insumo !== 'object') return;
      if (!esNumero(insumo.cantidadUsada) || !esNumero(insumo.cantidadComprada)) return;

      if (insumo.cantidadUsada > insumo.cantidadComprada) {
        const nombre =
          typeof insumo.nombre === 'string' && insumo.nombre.trim() !== ''
            ? insumo.nombre.trim()
            : 'Insumo ' + (i + 1);
        avisos.push(
          '«' + nombre + '»: la cantidad usada (' + insumo.cantidadUsada +
          ') es mayor que la comprada (' + insumo.cantidadComprada +
          '). Si compraste en una unidad y usas otra (por ejemplo, kg y g), revisa que sean la misma.'
        );
      }
    });

    return avisos;
  }

  global.Validations = {
    UMBRAL_MARGEN_ALTO: UMBRAL_MARGEN_ALTO,
    advertencias: advertencias
  };
})(globalThis);