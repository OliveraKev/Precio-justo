/**
 * productos.js — Guardar, listar, editar y eliminar productos (Etapa 7B).
 *
 * Usa:
 *   - ProductModel   (model.js)      para convertir y validar el formulario
 *   - Calculator     (calculator.js) para validar las reglas de negocio
 *   - ProductStorage (storage.js)    para guardar en LocalStorage
 *   - PrecioJusto    (app.js)        para leer y rellenar el formulario
 *
 * Regla de seguridad: el texto del usuario solo se escribe con .textContent
 * y .dataset, nunca con innerHTML.
 */
(function (global) {
  'use strict';

  // ---------- Comprobación de dependencias ----------

  if (!global.Calculator || !global.ProductModel || !global.ProductStorage || !global.PrecioJusto) {
    console.error(
      'Faltan módulos: revisa que index.html cargue calculator, model, storage, app y, al final, productos.js.'
    );
    return;
  }

  const almacen = ProductStorage.predeterminado;
  const app = PrecioJusto;

  // ---------- Referencias a la pantalla ----------

  function $(id) {
    return document.getElementById(id);
  }

  const listaProductos = $('lista-productos');
  const productosVacio = $('productos-vacio');
  const contador = $('contador-productos');
  const plantillaProducto = $('plantilla-producto');

  // ---------- Utilidades ----------

  // Muestra un número con 2 decimales (solo para pantalla).
  function dinero(valor) {
    return Calculator.redondear(valor, 2).toFixed(2);
  }

  // Resume varios errores en una sola frase corta.
  function resumirErrores(errores) {
    if (errores.length === 1) return errores[0];
    const otros = errores.length - 1;
    return errores[0] + ' (y ' + otros + (otros === 1 ? ' error más)' : ' errores más)');
  }

  // ¿El navegador deja usar LocalStorage? (puede estar bloqueado)
  function almacenamientoDisponible() {
    try {
      const clave = 'preciojusto.prueba';
      global.localStorage.setItem(clave, '1');
      global.localStorage.removeItem(clave);
      return true;
    } catch (e) {
      return false;
    }
  }

  function mostrarAvisoSinAlmacenamiento() {
    const aviso = document.createElement('div');
    aviso.className = 'alert alert-warning';
    aviso.setAttribute('role', 'alert');
    aviso.textContent =
      'Tu navegador no permite guardar datos (LocalStorage está bloqueado o desactivado). ' +
      'Puedes calcular precios, pero no podrás guardar productos.';
    document.querySelector('main').prepend(aviso);
  }

  // ---------- Lista de productos guardados ----------

  // Texto de resumen bajo el nombre. Si los datos guardados están dañados, avisa.
  function describirProducto(producto) {
    try {
      const c = Calculator.calcularProducto(producto);
      return (
        'Costo por unidad ' + dinero(c.costoUnitario) +
        ' · Precio sugerido ' + dinero(c.precioSugerido) +
        ' · Margen ' + producto.margen + ' %'
      );
    } catch (e) {
      return 'Datos incompletos o inválidos. Abre el producto con «Editar» para corregirlo.';
    }
  }

  // Redibuja la lista completa a partir de lo que hay en LocalStorage.
  function renderizarLista() {
    const productos = almacen.listar();
    listaProductos.replaceChildren();

    productos.forEach(function (producto) {
      const fragmento = plantillaProducto.content.cloneNode(true);
      const item = fragmento.querySelector('li');
      const nombre = producto.nombre || '(sin nombre)';

      item.dataset.id = producto.id;
      item.querySelector('.producto-nombre').textContent = nombre;
      item.querySelector('.producto-detalle').textContent = describirProducto(producto);
      item.querySelector('[data-accion="editar"]').setAttribute('aria-label', 'Editar ' + nombre);
      item.querySelector('[data-accion="eliminar"]').setAttribute('aria-label', 'Eliminar ' + nombre);

      listaProductos.appendChild(fragmento);
    });

    contador.textContent = String(productos.length);
    productosVacio.classList.toggle('d-none', productos.length > 0);
  }

  // ---------- Guardar ----------

  function guardarProducto() {
    // 1) ¿Todo se entiende como número y hay nombre?
    const normalizado = ProductModel.normalizarProducto(app.leerBorrador());
    if (normalizado.errores.length > 0) {
      app.mostrarEstado(resumirErrores(normalizado.errores), 'error');
      if ($('nombre').value.trim() === '') $('nombre').focus();
      return;
    }
    const producto = normalizado.producto;

    // 2) ¿Los valores tienen sentido? (margen menor que 100, unidades mayores que 0...)
    let calculo;
    try {
      calculo = Calculator.calcularProducto(producto);
    } catch (e) {
      app.mostrarEstado(e.message, 'error');
      return;
    }

    // 3) Sin costos no hay nada que guardar.
    if (calculo.costoLote === 0) {
      app.mostrarEstado('Agrega al menos un insumo o un costo adicional antes de guardar.', 'error');
      return;
    }

    // 4) Guardar (puede fallar si el almacenamiento está lleno o bloqueado).
    let guardado;
    try {
      guardado = almacen.guardar(producto);
    } catch (e) {
      app.mostrarEstado(e.message, 'error');
      return;
    }

    // El producto queda cargado en modo "Editando": guardar otra vez lo actualiza, no lo duplica.
    app.cargarProducto(guardado);
    renderizarLista();
    app.mostrarEstado('Producto «' + guardado.nombre + '» guardado.', 'ok');
  }

  // ---------- Editar y eliminar ----------

  function productoNoExiste() {
    app.mostrarEstado('Ese producto ya no existe.', 'error');
    renderizarLista();
  }

  function editarProducto(id) {
    const producto = almacen.obtener(id);
    if (!producto) {
      productoNoExiste();
      return;
    }

    try {
      app.cargarProducto(producto);
    } catch (e) {
      console.error(e);
      app.reiniciar();
      app.mostrarEstado('No se pudo abrir el producto: sus datos están dañados.', 'error');
      return;
    }

    app.mostrarEstado(
      'Editando «' + producto.nombre + '». Cambia lo que necesites y pulsa «Guardar producto».',
      'info'
    );
    $('form-producto').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('nombre').focus({ preventScroll: true });
  }

  function eliminarProducto(id) {
    const producto = almacen.obtener(id);
    if (!producto) {
      productoNoExiste();
      return;
    }

    const nombre = producto.nombre || '(sin nombre)';
    if (!global.confirm('¿Eliminar «' + nombre + '»? Esta acción no se puede deshacer.')) return;

    try {
      almacen.eliminar(id);
    } catch (e) {
      app.mostrarEstado(e.message, 'error');
      return;
    }

    // Si justo se estaba editando ese producto, limpiamos el formulario.
    if ($('producto-id').value === String(id)) app.reiniciar();

    renderizarLista();
    app.mostrarEstado('Producto «' + nombre + '» eliminado.', 'ok');
  }

  // Un solo escuchador para todos los botones de la lista.
  listaProductos.addEventListener('click', function (evento) {
    const boton = evento.target.closest('[data-accion]');
    if (!boton) return;
    const item = boton.closest('li');
    if (!item) return;

    const id = item.dataset.id;
    if (boton.dataset.accion === 'editar') editarProducto(id);
    else if (boton.dataset.accion === 'eliminar') eliminarProducto(id);
  });

  // ---------- Inicio ----------

  app.alGuardar = guardarProducto;

  if (!almacenamientoDisponible()) mostrarAvisoSinAlmacenamiento();

  renderizarLista();
})(globalThis);