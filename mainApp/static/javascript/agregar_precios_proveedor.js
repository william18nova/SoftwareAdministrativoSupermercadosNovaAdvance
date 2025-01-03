// archivo: agregar_precios_proveedor.js

document.addEventListener('DOMContentLoaded', function() {
  /* ======================
     1. Inicializar DataTable con opciones responsive
  ====================== */
  const dataTable = $('#productos-list').DataTable({
    paging: false,
    searching: true, // Asegura que la barra de búsqueda esté habilitada
    info: false,
    responsive: true,
    language: {
      search: "Buscar:",
      zeroRecords: "No se encontraron resultados",
      emptyTable: "No hay productos para mostrar",
    },
  });

  /* ======================
     2. Variables Generales
  ====================== */
  const form = document.getElementById('preciosForm');

  // ------------------------------
  // Autocomplete de Proveedor
  // ------------------------------
  const proveedorInput    = document.getElementById('id_proveedor_autocomplete');
  const proveedorIdInput  = document.getElementById('id_proveedor');
  const proveedorResults  = document.getElementById('proveedor-autocomplete-results');
  let isLoadingProveedor  = false;
  let hasMoreProveedor    = true;
  let currentPageProveedor= 1;
  let currentTermProveedor= '';

  // ------------------------------
  // Autocomplete de Producto
  // ------------------------------
  const productoInput     = document.getElementById('id_producto_autocomplete');
  const productoIdInput   = document.getElementById('id_productoid');
  const productoResults   = document.getElementById('producto-autocomplete-results');
  let isLoadingProducto   = false;
  let hasMoreProducto     = true;
  let currentPageProducto = 1;
  let currentTermProducto = '';

  // ------------------------------
  // Campo “Precio” y botón agregar
  // ------------------------------
  const precioInput       = document.getElementById('id_precio');
  const btnAgregarProducto= document.getElementById('agregarProductoBtn');

  // Lista temporal: { productId, productName, precio }
  let preciosTemp = [];

  /* ==========================
     3. Variables de Debounce
  ========================== */
  let debounceTimeoutProveedor = null;
  let debounceTimeoutProducto  = null;
  const DEBOUNCE_TIME = 300; // 300 ms

  /* ==============================
     4. Funciones de Autocompletado
  ============================== */

  // Función para buscar proveedores
  function fetchProveedores(term, page = 1) {
    if (isLoadingProveedor || !hasMoreProveedor) return;
    isLoadingProveedor = true;

    const url = `${proveedorAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}`;
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (page === 1) {
          proveedorResults.innerHTML = '';
        }
        if (data.results.length > 0) {
          data.results.forEach(item => {
            const opt = document.createElement('div');
            opt.classList.add('autocomplete-option');
            opt.textContent = item.text;
            opt.dataset.id  = item.id;
            proveedorResults.appendChild(opt);
          });
          hasMoreProveedor = data.has_more;
        } else if (page === 1) {
          const noResult = document.createElement('div');
          noResult.classList.add('autocomplete-no-result');
          noResult.textContent = 'No se encontraron resultados';
          proveedorResults.appendChild(noResult);
          hasMoreProveedor = false;
        }
        proveedorResults.style.display = 'block';
        isLoadingProveedor = false;
      })
      .catch(error => {
        console.error('fetchProveedores error:', error);
        isLoadingProveedor = false;
      });
  }

  // Función para buscar productos
  function fetchProductos(term, page = 1) {
    if (isLoadingProducto || !hasMoreProducto) return;
    isLoadingProducto = true;

    // Excluir productos ya agregados
    const excludedIds = preciosTemp.map(item => item.productId).join(',');
    const url = `${productoPreciosAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}&excluded=${excludedIds}`;

    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (page === 1) {
          productoResults.innerHTML = '';
        }
        if (data.results.length > 0) {
          data.results.forEach(item => {
            const opt = document.createElement('div');
            opt.classList.add('autocomplete-option');
            opt.textContent = item.text;
            opt.dataset.id  = item.id;
            productoResults.appendChild(opt);
          });
          hasMoreProducto = data.has_more;
        } else if (page === 1) {
          const noResult = document.createElement('div');
          noResult.classList.add('autocomplete-no-result');
          noResult.textContent = 'No se encontraron resultados';
          productoResults.appendChild(noResult);
          hasMoreProducto = false;
        }
        productoResults.style.display = 'block';
        isLoadingProducto = false;
      })
      .catch(error => {
        console.error('fetchProductos error:', error);
        isLoadingProducto = false;
      });
  }

  /* ======================
     5. Manejo de Errores
  ====================== */
  function clearErrors() {
    const errorFields = document.querySelectorAll('.field-error');
    errorFields.forEach(e => {
      e.innerHTML = '';
      e.style.display = 'none';
      e.classList.remove('visible');
    });
    const globalError = document.getElementById('error-message');
    if (globalError) {
      globalError.style.display = 'none';
      globalError.innerHTML = '';
    }
    const globalSuccess = document.getElementById('success-message');
    if (globalSuccess) {
      globalSuccess.style.display = 'none';
      globalSuccess.innerHTML = '';
    }
  }

  function showFieldError(field, message) {
    const errorDiv = document.getElementById(`error-id_${field}`);
    if (errorDiv) {
      errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
      errorDiv.classList.add('visible');
      errorDiv.style.display = 'block';
    }
  }

  function showGlobalError(messages) {
    const errorBox = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    if (errorBox && errorText) {
      errorText.innerHTML = messages.join('<br>');
      errorBox.style.display = 'block';
    }
  }

  function showGlobalSuccess(message) {
    const successBox = document.getElementById('success-message');
    const successText = document.getElementById('success-text');
    if (successBox && successText) {
      successText.textContent = message;
      successBox.style.display = 'block';
    }
  }

  /* ==========================
     6. Eventos de Autocomplete
  ========================== */
  // --- Proveedor ---
  proveedorInput.addEventListener('input', function() {
    proveedorIdInput.value = '';
    hasMoreProveedor = true;
    currentPageProveedor = 1;
    currentTermProveedor = proveedorInput.value.trim();

    if (!currentTermProveedor) {
      proveedorResults.innerHTML = '';
      proveedorResults.style.display = 'none';
      return;
    }
    if (debounceTimeoutProveedor) {
      clearTimeout(debounceTimeoutProveedor);
    }
    debounceTimeoutProveedor = setTimeout(function() {
      fetchProveedores(currentTermProveedor, currentPageProveedor);
    }, DEBOUNCE_TIME);
  });

  proveedorInput.addEventListener('focus', function() {
    currentTermProveedor = proveedorInput.value.trim();
    hasMoreProveedor = true;
    currentPageProveedor = 1;
    if (debounceTimeoutProveedor) {
      clearTimeout(debounceTimeoutProveedor);
    }
    debounceTimeoutProveedor = setTimeout(function() {
      fetchProveedores(currentTermProveedor, currentPageProveedor);
    }, DEBOUNCE_TIME);
  });

  proveedorResults.addEventListener('scroll', function() {
    if (proveedorResults.scrollTop + proveedorResults.clientHeight >= proveedorResults.scrollHeight - 5) {
      if (hasMoreProveedor && !isLoadingProveedor) {
        currentPageProveedor += 1;
        fetchProveedores(currentTermProveedor, currentPageProveedor);
      }
    }
  });

  proveedorResults.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('autocomplete-option')) {
      proveedorInput.value    = e.target.textContent;
      proveedorIdInput.value  = e.target.dataset.id;
      proveedorResults.innerHTML = '';
      proveedorResults.style.display = 'none';
      hasMoreProveedor = false;
    }
  });

  // --- Producto ---
  productoInput.addEventListener('input', function() {
    productoIdInput.value = '';
    hasMoreProducto = true;
    currentPageProducto = 1;
    currentTermProducto = productoInput.value.trim();

    if (!currentTermProducto) {
      productoResults.innerHTML = '';
      productoResults.style.display = 'none';
      return;
    }
    if (debounceTimeoutProducto) {
      clearTimeout(debounceTimeoutProducto);
    }
    debounceTimeoutProducto = setTimeout(function() {
      fetchProductos(currentTermProducto, currentPageProducto);
    }, DEBOUNCE_TIME);
  });

  productoInput.addEventListener('focus', function() {
    currentTermProducto = productoInput.value.trim();
    hasMoreProducto = true;
    currentPageProducto = 1;
    if (debounceTimeoutProducto) {
      clearTimeout(debounceTimeoutProducto);
    }
    debounceTimeoutProducto = setTimeout(function() {
      fetchProductos(currentTermProducto, currentPageProducto);
    }, DEBOUNCE_TIME);
  });

  productoResults.addEventListener('scroll', function() {
    if (productoResults.scrollTop + productoResults.clientHeight >= productoResults.scrollHeight - 5) {
      if (hasMoreProducto && !isLoadingProducto) {
        currentPageProducto += 1;
        fetchProductos(currentTermProducto, currentPageProducto);
      }
    }
  });

  productoResults.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('autocomplete-option')) {
      productoInput.value   = e.target.textContent;
      productoIdInput.value = e.target.dataset.id;
      productoResults.innerHTML = '';
      productoResults.style.display = 'none';
      hasMoreProducto = false;
    }
  });

  document.addEventListener('click', function(e) {
    if (!proveedorInput.contains(e.target) && !proveedorResults.contains(e.target)) {
      proveedorResults.innerHTML = '';
      proveedorResults.style.display = 'none';
      hasMoreProveedor = false;
    }

    if (!productoInput.contains(e.target) && !productoResults.contains(e.target)) {
      productoResults.innerHTML = '';
      productoResults.style.display = 'none';
      hasMoreProducto = false;
    }
  });

  /* ========================
     7. Agregar Producto a la Tabla
  ======================== */
  btnAgregarProducto.addEventListener('click', function() {
    clearErrors();

    const provId   = proveedorIdInput.value.trim();
    const prodId   = productoIdInput.value.trim();
    const prodName = productoInput.value.trim();
    const priceVal = precioInput.value.trim();

    let hasLocalErrors = false;

    // Validaciones
    if (!provId) {
      showFieldError('proveedor', 'Debe seleccionar un proveedor.');
      hasLocalErrors = true;
    }
    if (!prodId) {
      showFieldError('productoid', 'Debe seleccionar un producto.');
      hasLocalErrors = true;
    }
    if (!priceVal || parseFloat(priceVal) <= 0) {
      showFieldError('precio', 'El precio debe ser mayor que 0.');
      hasLocalErrors = true;
    }

    if (hasLocalErrors) {
      return; // No agregamos nada
    }

    // Revisar si el producto ya existe en la tabla
    const existe = preciosTemp.some(p => p.productId === prodId);
    if (existe) {
      showFieldError('productoid', 'Este producto ya está en la lista.');
      return;
    }

    // Agregar al array temporal
    preciosTemp.push({
      productId:  prodId,
      productName:prodName,
      precio:      priceVal
    });

    // Insertar fila en DataTable con precio editable
    dataTable.row.add([
      prodName,
      `<input type="number" class="price-input" value="${priceVal}" step="0.01" min="0.01" style="width:80px;">`,
      `<button type="button" class="btn-eliminar" data-id="${prodId}">
         <i class="fas fa-trash-alt"></i>
       </button>`
    ]).draw(false);

    // Limpiar campos de texto
    productoInput.value   = '';
    productoIdInput.value = '';
    precioInput.value     = '';
  });

  /* ======================
     8. Eliminar Producto de la Tabla
  ====================== */
  $('#productos-list tbody').on('click', '.btn-eliminar', function() {
    const productId = $(this).data('id');
    const row = $(this).closest('tr');
    dataTable.row(row).remove().draw(false);
    preciosTemp = preciosTemp.filter(p => p.productId !== productId);
  });

  /* ======================
     9. Submit del Formulario via AJAX
  ====================== */
  form.addEventListener('submit', function(event) {
    event.preventDefault();
    clearErrors();

    // Validar que al menos un producto esté agregado
    if (preciosTemp.length === 0) {
      showGlobalError(['Debe agregar al menos un producto antes de guardar.']);
      return;
    }

    // Actualizar precios según lo editado en la tabla
    const rows = dataTable.rows().nodes();
    preciosTemp.forEach((item, index) => {
      const row = rows[index];
      const priceInputElem = row.querySelector('.price-input');
      if (priceInputElem) {
        const newPrice = priceInputElem.value.trim();
        preciosTemp[index].precio = newPrice;
      }
    });

    // Crear JSON de productos
    const productosJSON = JSON.stringify(preciosTemp);

    // Enviar al servidor mediante fetch
    fetch(form.action, {
      method: 'POST',
      headers: {
        'X-CSRFToken': getCookie('csrftoken'),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        proveedor: proveedorIdInput.value,
        productos: preciosTemp // Enviar el array directamente
      })
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          showGlobalSuccess(data.message);
          // Resetear formulario y tabla
          form.reset();
          dataTable.clear().draw();
          preciosTemp = [];
        } else {
          if (Array.isArray(data.errors)) {
            showGlobalError(data.errors);
          } else {
            showGlobalError(['Ocurrió un error inesperado.']);
          }
        }
      })
      .catch(error => {
        console.error('Error:', error);
        showGlobalError(['Ocurrió un error inesperado al guardar.']);
      });
  });

  /* ======================
     10. Función para Obtener la Cookie CSRF
  ====================== */
  function getCookie(name) {
      let cookieValue = null;
      if (document.cookie && document.cookie !== '') {
          const cookies = document.cookie.split(';');
          for (let cookie of cookies) {
              cookie = cookie.trim();
              if (cookie.substring(0, name.length + 1) === (name + '=')) {
                  cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                  break;
              }
          }
      }
      return cookieValue;
  }
});
