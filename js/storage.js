/**
 * storage.js — Guarda y lee productos en LocalStorage.
 *
 * Se usa así en la app:
 *   const productos = ProductStorage.predeterminado.listar();
 *
 * Para pruebas se puede crear otro almacén con un almacenamiento falso:
 *   const s = ProductStorage.crear(almacenFalso, 'clave.de.prueba');
 */
(function (global) {
  'use strict';

  const CLAVE_PRODUCTOS = 'preciojusto.productos';
  const ERROR_GUARDAR =
    'No se pudieron guardar los datos: el almacenamiento del navegador está lleno o desactivado.';
  const ERROR_BORRAR =
    'No se pudieron borrar los datos: el almacenamiento del navegador no está disponible.';

  function generarId() {
    // Fecha en base 36 + texto aleatorio: único para el uso de esta app.
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Copia profunda: así nadie modifica por accidente lo que hay guardado.
  function copiar(objeto) {
    return JSON.parse(JSON.stringify(objeto));
  }

  function esProductoValido(item) {
    return (
      item !== null &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      typeof item.id === 'string' &&
      item.id !== ''
    );
  }

  /**
   * Crea un almacén de productos.
   * @param almacen objeto con getItem/setItem/removeItem (localStorage o uno falso), o null
   * @param clave   nombre bajo el cual se guarda la lista
   */
  function crear(almacen, clave) {
    const claveRespaldo = clave + '.respaldo';

    // Lee la lista completa. Nunca lanza error: si algo falla, devuelve [].
    function leerTodo() {
      if (!almacen) return [];

      let crudo;
      try {
        crudo = almacen.getItem(clave);
      } catch (e) {
        return [];
      }
      if (crudo === null || crudo === undefined) return [];

      let datos;
      try {
        datos = JSON.parse(crudo);
      } catch (e) {
        datos = null;
      }

      // Si no es una lista, está dañado: guardamos copia y empezamos limpio.
      if (!Array.isArray(datos)) {
        try {
          almacen.setItem(claveRespaldo, crudo);
        } catch (e) {
          /* si ni siquiera se puede respaldar, seguimos igual */
        }
        return [];
      }

      // Ignoramos elementos que no parecen productos.
      return datos.filter(esProductoValido);
    }

    function escribirTodo(lista) {
      if (!almacen) throw new Error(ERROR_GUARDAR);
      try {
        almacen.setItem(clave, JSON.stringify(lista));
      } catch (e) {
        throw new Error(ERROR_GUARDAR);
      }
    }

    // Lista los productos, el modificado más recientemente primero.
    function listar() {
      return leerTodo().sort(function (a, b) {
        const fa = String(a.actualizado || '');
        const fb = String(b.actualizado || '');
        if (fb > fa) return 1;
        if (fb < fa) return -1;
        return 0;
      });
    }

    // Devuelve el producto con ese id, o null si no existe.
    function obtener(id) {
      const encontrado = leerTodo().find(function (p) {
        return p.id === String(id);
      });
      return encontrado || null;
    }

    // Crea el producto si no tiene id (o no existe), o lo actualiza si ya existe.
    function guardar(producto) {
      if (!producto || typeof producto !== 'object') {
        throw new Error('El producto no es válido.');
      }
      if (typeof producto.nombre !== 'string' || producto.nombre.trim() === '') {
        throw new Error('El producto necesita un nombre.');
      }

      const copia = copiar(producto); // no modificamos el objeto original
      copia.nombre = copia.nombre.trim();
      copia.id =
        copia.id !== undefined && copia.id !== null && copia.id !== ''
          ? String(copia.id)
          : generarId();
      copia.actualizado = new Date().toISOString();

      const lista = leerTodo();
      const posicion = lista.findIndex(function (p) {
        return p.id === copia.id;
      });

      if (posicion === -1) {
        lista.push(copia);
      } else {
        lista[posicion] = copia;
      }

      escribirTodo(lista);
      return copiar(copia);
    }

    // Elimina un producto. Devuelve true si existía, false si no.
    function eliminar(id) {
      const lista = leerTodo();
      const restantes = lista.filter(function (p) {
        return p.id !== String(id);
      });
      if (restantes.length === lista.length) return false;

      escribirTodo(restantes);
      return true;
    }

    // Borra todos los productos.
    function limpiar() {
      if (!almacen) return;
      try {
        almacen.removeItem(clave);
      } catch (e) {
        throw new Error(ERROR_BORRAR);
      }
    }

    return {
      listar: listar,
      obtener: obtener,
      guardar: guardar,
      eliminar: eliminar,
      limpiar: limpiar
    };
  }

  // Acceder a localStorage puede lanzar error si el navegador lo bloquea.
  function obtenerLocalStorage() {
    try {
      return global.localStorage || null;
    } catch (e) {
      return null;
    }
  }

  global.ProductStorage = {
    CLAVE_PRODUCTOS: CLAVE_PRODUCTOS,
    crear: crear,
    predeterminado: crear(obtenerLocalStorage(), CLAVE_PRODUCTOS)
  };
})(globalThis);