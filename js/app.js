/**
 * app.js — Conecta la pantalla (index.html) con la lógica de PrecioJusto.
 *
 * Etapa 7A: formulario, insumos, valores interpretados y cálculo en vivo.
 * Etapa 7B (productos.js) agregará guardar, listar, editar y eliminar.
 *
 * Regla de seguridad: el texto del usuario solo se escribe con .value y
 * .textContent, nunca con innerHTML.
 */
(function (global) {
  'use strict';

  // ---------- Comprobación de dependencias ----------

  if (!global.Calculator || !global.ProductModel) {
    console.error('Faltan calculator.js o model.js: revisa las etiquetas <script> de index.html.');
    const aviso = document.getElementById('mensaje-resultado');
    if (aviso) {
      aviso.className = 'alert alert-danger';
      aviso.textContent = 'Error al cargar la aplicación. Revisa la consola del navegador (F12).';
    }
    return;
  }

  // ---------- Referencias a la pantalla ----------

  function $(id) {
    return document.getElementById(id);
  }

  const formulario = $('form-producto');
  const insumosBody = $('insumos-body');
  const insumosVacio = $('insumos-vacio');
  const plantillaInsumo = $('plantilla-insumo');
  const mensajeResultado = $('mensaje-resultado');
  const mensajeEstado = $('mensaje-estado');
  const badgeEdicion = $('badge-edicion');

  const CAMPOS_NUMERICOS_PRODUCTO = ['unidadesPorLote', 'costosAdicionales', 'margen', 'impuesto'];
  const CAMPOS_INSUMO = ['nombre', 'precioCompra', 'cantidadComprada', 'unidad', 'cantidadUsada'];
  const CAMPOS_NUMERICOS_INSUMO = ['precioCompra', 'cantidadComprada', 'cantidadUsada'];

  // ---------- Utilidades ----------

  // Muestra un número con 2 decimales (solo para pantalla).
  function formatearDinero(valor) {
    return Calculator.redondear(valor, 2).toFixed(2);
  }

  function filasInsumos() {
    return Array.prototype.slice.call(insumosBody.querySelectorAll('tr.fila-insumo'));
  }

  function campoDeFila(fila, campo) {
    return fila.querySelector('[data-campo="' + campo + '"]');
  }

  // ---------- Leer el formulario ----------

  // Devuelve un borrador con TODO como texto, tal como está escrito en pantalla.
  function leerBorrador() {
    return {
      id: $('producto-id').value,
      nombre: $('nombre').value,
      unidadesPorLote: $('unidadesPorLote').value,
      costosAdicionales: $('costosAdicionales').value,
      margen: $('margen').value,
      impuesto: $('impuesto').value,
      insumos: filasInsumos().map(function (fila) {
        const insumo = {};
        CAMPOS_INSUMO.forEach(function (campo) {
          insumo[campo] = campoDeFila(fila, campo).value;
        });
        return insumo;
      })
    };
  }

  // Para la vista previa, un nombre vacío no debe tapar los resultados.
  function borradorParaVista(borrador) {
    const copia = JSON.parse(JSON.stringify(borrador));
    if (copia.nombre.trim() === '') copia.nombre = 'Sin nombre';
    copia.insumos.forEach(function (insumo) {
      if (insumo.nombre.trim() === '') insumo.nombre = 'Sin nombre';
    });
    return copia;
  }

  // ---------- Filas de insumos ----------

  // Crea una fila nueva (vacía o con datos) y la agrega a la tabla.
  function agregarFila(datos) {
    const base = datos || ProductModel.crearInsumoVacio();
    const fragmento = plantillaInsumo.content.cloneNode(true);
    const fila = fragmento.querySelector('tr');

    CAMPOS_INSUMO.forEach(function (campo) {
      campoDeFila(fila, campo).value = base[campo] === undefined ? '' : String(base[campo]);
    });

    insumosBody.appendChild(fragmento);
    return fila;
  }

  function actualizarEstadoVacio() {
    insumosVacio.classList.toggle('d-none', filasInsumos().length > 0);
  }

  // ---------- "Se leerá como..." bajo cada número ----------

  // Devuelve { texto, tipo } donde tipo es '', 'aviso' o 'error'.
  function describirInterpretacion(crudo) {
    const texto = crudo.replace(/[\s\u00A0]/g, '');
    if (texto === '') return { texto: '', tipo: '' };

    const n = ProductModel.convertirNumero(crudo);
    if (n === null) return { texto: 'No se entiende este número.', tipo: 'error' };

    // Caso ambiguo: 1.234 o 1,234 (un separador y 3 decimales).
    if (/^[1-9]\d{0,2}[.,]\d{3}$/.test(texto)) {
      const sinSeparador = texto.replace(/[.,]/, '');
      return {
        texto:
          'Se leerá como ' + n + '. Si querías ' + sinSeparador +
          ', escríbelo sin punto ni coma.',
        tipo: 'aviso'
      };
    }

    if (texto.indexOf(',') !== -1) {
      return { texto: 'Se leerá como ' + n + '.', tipo: '' };
    }

    return { texto: '', tipo: '' };
  }

  function pintarInterpretacion(entrada, salida) {
    if (!entrada || !salida) return;
    const r = describirInterpretacion(entrada.value);
    salida.textContent = r.texto;
    salida.classList.toggle('text-danger', r.tipo === 'error');
    salida.classList.toggle('text-warning-emphasis', r.tipo === 'aviso');
    entrada.classList.toggle('is-invalid', r.tipo === 'error');
  }

  function actualizarInterpretados() {
    CAMPOS_NUMERICOS_PRODUCTO.forEach(function (campo) {
      pintarInterpretacion($(campo), $('interp-' + campo));
    });

    filasInsumos().forEach(function (fila) {
      CAMPOS_NUMERICOS_INSUMO.forEach(function (campo) {
        pintarInterpretacion(
          campoDeFila(fila, campo),
          fila.querySelector('[data-interpretado="' + campo + '"]')
        );
      });
    });
  }

  // ---------- Costo de cada insumo ----------

  function actualizarCostosFilas() {
    filasInsumos().forEach(function (fila) {
      const precio = ProductModel.convertirNumero(campoDeFila(fila, 'precioCompra').value);
      const comprada = ProductModel.convertirNumero(campoDeFila(fila, 'cantidadComprada').value);
      const usada = ProductModel.convertirNumero(campoDeFila(fila, 'cantidadUsada').value);

      let texto = '—';
      if (precio !== null && comprada !== null && usada !== null) {
        try {
          texto = formatearDinero(
            Calculator.costoInsumo({
              precioCompra: precio,
              cantidadComprada: comprada,
              cantidadUsada: usada
            })
          );
        } catch (e) {
          texto = '—'; // valores imposibles (negativos, cantidad comprada 0...)
        }
      }
      fila.querySelector('.costo-insumo').textContent = texto;
    });
  }

  // ---------- Panel de resultados ----------

  // tipo: 'info', 'aviso' u 'ok'. mensajes: lista de textos.
  function mostrarMensajeResultado(tipo, mensajes) {
    const clases = {
      info: 'alert alert-secondary',
      aviso: 'alert alert-warning',
      ok: 'alert alert-success'
    };
    mensajeResultado.className = clases[tipo] || clases.info;
    mensajeResultado.replaceChildren();

    if (mensajes.length === 1) {
      mensajeResultado.textContent = mensajes[0];
      return;
    }

    const lista = document.createElement('ul');
    lista.className = 'mb-0 ps-3';
    mensajes.forEach(function (mensaje) {
      const item = document.createElement('li');
      item.textContent = mensaje;
      lista.appendChild(item);
    });
    mensajeResultado.appendChild(lista);
  }

  function limpiarResultados() {
    ['res-precio-sugerido', 'res-costo-lote', 'res-costo-unitario', 'res-ganancia', 'res-precio-final']
      .forEach(function (id) {
        $(id).textContent = '—';
      });
  }

  function mostrarResultados(c) {
    $('res-precio-sugerido').textContent = formatearDinero(c.precioSugerido);
    $('res-costo-lote').textContent = formatearDinero(c.costoLote);
    $('res-costo-unitario').textContent = formatearDinero(c.costoUnitario);
    $('res-ganancia').textContent = formatearDinero(c.gananciaUnidad);
    $('res-precio-final').textContent = formatearDinero(c.precioFinal);
  }

  // ---------- Recalcular todo ----------

  function recalcular() {
    actualizarInterpretados();
    actualizarCostosFilas();
    actualizarEstadoVacio();

    // 1) ¿Todos los campos se entienden como números?
    const normalizado = ProductModel.normalizarProducto(borradorParaVista(leerBorrador()));
    if (normalizado.errores.length > 0) {
      limpiarResultados();
      mostrarMensajeResultado('aviso', normalizado.errores);
      return;
    }

    // 2) ¿Los valores tienen sentido? (margen menor que 100, unidades mayores que 0...)
    let calculo;
    try {
      calculo = Calculator.calcularProducto(normalizado.producto);
    } catch (e) {
      limpiarResultados();
      mostrarMensajeResultado('aviso', [e.message]);
      return;
    }

    // 3) Sin costos todavía no hay precio que sugerir.
    if (calculo.costoLote === 0) {
      limpiarResultados();
      mostrarMensajeResultado('info', [
        'Agrega al menos un insumo o un costo adicional para ver el precio sugerido.'
      ]);
      return;
    }

    mostrarResultados(calculo);
    mostrarMensajeResultado('ok', ['Cálculo actualizado.']);
  }

  // ---------- Mensaje de estado (bajo los botones) ----------

  let temporizadorEstado = null;

  // tipo: 'ok', 'error' o 'info'. Los mensajes 'ok' se borran solos a los 4 segundos.
  function mostrarEstado(texto, tipo) {
    const clases = { ok: 'text-success', error: 'text-danger', info: 'text-body-secondary' };
    clearTimeout(temporizadorEstado);
    mensajeEstado.className = 'small ' + (clases[tipo] || clases.info);
    mensajeEstado.textContent = texto || '';

    if (texto && tipo === 'ok') {
      temporizadorEstado = setTimeout(function () {
        mensajeEstado.textContent = '';
      }, 4000);
    }
  }

  // ---------- Rellenar o reiniciar el formulario ----------

  // editando = true cuando se carga un producto guardado (Etapa 7B).
  function rellenarFormulario(producto, editando) {
    $('producto-id').value = editando && producto.id ? String(producto.id) : '';
    $('nombre').value = producto.nombre || '';

    CAMPOS_NUMERICOS_PRODUCTO.forEach(function (campo) {
      $(campo).value = producto[campo] === undefined ? '' : String(producto[campo]);
    });

    insumosBody.replaceChildren();
    (producto.insumos || []).forEach(function (insumo) {
      agregarFila(insumo);
    });

    badgeEdicion.classList.toggle('d-none', !editando);
    recalcular();
  }

  function cargarProducto(producto) {
    rellenarFormulario(producto, true);
  }

  function reiniciar() {
    rellenarFormulario(ProductModel.crearProductoVacio(), false);
    mostrarEstado('');
  }

  // ---------- Eventos ----------

  // Cualquier cambio en un campo recalcula al instante.
  formulario.addEventListener('input', recalcular);

  // Botón "+ Agregar insumo".
  $('btn-agregar-insumo').addEventListener('click', function () {
    const fila = agregarFila();
    recalcular();
    campoDeFila(fila, 'nombre').focus();
  });

  // Botón ✕ de cada fila (un solo escuchador para todas las filas).
  insumosBody.addEventListener('click', function (evento) {
    const boton = evento.target.closest('[data-accion="quitar-insumo"]');
    if (!boton) return;
    const fila = boton.closest('tr');
    if (fila) fila.remove();
    recalcular();
  });

  // Botón "Nuevo producto".
  $('btn-nuevo').addEventListener('click', function () {
    reiniciar();
    $('nombre').focus();
  });

  // Guardar: evita que la página se recargue. El guardado real lo conecta productos.js (7B).
  formulario.addEventListener('submit', function (evento) {
    evento.preventDefault();
    if (typeof PrecioJusto.alGuardar === 'function') {
      PrecioJusto.alGuardar();
    } else {
      mostrarEstado('El guardado se activa en la Etapa 7B.', 'info');
    }
  });

  // ---------- Exponer lo que usará productos.js ----------

  const PrecioJusto = {
    leerBorrador: leerBorrador,
    cargarProducto: cargarProducto,
    reiniciar: reiniciar,
    mostrarEstado: mostrarEstado,
    alGuardar: null // productos.js lo completa en la Etapa 7B
  };
  global.PrecioJusto = PrecioJusto;

  // ---------- Inicio ----------

  recalcular();
})(globalThis);