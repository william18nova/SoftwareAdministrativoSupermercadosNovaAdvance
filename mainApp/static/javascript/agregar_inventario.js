// agregar_inventario.js

document.addEventListener('DOMContentLoaded', function() {

  /* ======================
     1. Inicializar DataTable con opciones responsive
  ====================== */
  const dataTable = $('#productos-list').DataTable({
    paging: false,
    searching: true,
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
  const form = document.getElementById('inventarioForm');

  // ------------------------------
  // Autocomplete de Sucursal
  // ------------------------------
  const sucursalInput    = document.getElementById('id_sucursal_autocomplete');
  const sucursalIdInput  = document.getElementById('id_sucursal');
  const sucursalResults  = document.getElementById('sucursal-autocomplete-results');
  let isLoadingSucursal  = false;
  let hasMoreSucursal    = true;
  let currentPageSucursal= 1;
  let currentTermSucursal= '';

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
  // Campo “Cantidad” y botón agregar
  // ------------------------------
  const cantidadInput       = document.getElementById('id_cantidad');
  const btnAgregarProducto  = document.getElementById('agregarProductoBtn');

  // Lista temporal: { productId, productName, cantidad }
  let inventarioTemp = [];

  /* ==========================
     3. Variables de Debounce
  ========================== */
  let debounceTimeoutSucursal = null;
  let debounceTimeoutProducto  = null;
  const DEBOUNCE_TIME = 150; // 150 ms => más rápido que los 300 ms habituales

  /* ===================================
     4. Funciones de Autocompletado
  =================================== */
  function fetchSucursales(term, page = 1) {
    if (isLoadingSucursal || !hasMoreSucursal) return;
    isLoadingSucursal = true;
    console.log(`Fetching sucursales: term='${term}', page=${page}`);

    const url = `${sucursalAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}`;
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (page === 1) {
          sucursalResults.innerHTML = '';
        }
        if (data.results.length > 0) {
          data.results.forEach(item => {
            const opt = document.createElement('div');
            opt.classList.add('autocomplete-option');
            opt.textContent = item.text;
            opt.dataset.id  = item.id;
            sucursalResults.appendChild(opt);
          });
          hasMoreSucursal = data.has_more;
        } else if (page === 1) {
          const noResult = document.createElement('div');
          noResult.classList.add('autocomplete-no-result');
          noResult.textContent = 'No se encontraron resultados';
          sucursalResults.appendChild(noResult);
          hasMoreSucursal = false;
        }
        sucursalResults.style.display = 'block';
        isLoadingSucursal = false;
        console.log('Sucursales fetch completado:', data);
      })
      .catch(error => {
        console.error('fetchSucursales error:', error);
        isLoadingSucursal = false;
      });
  }

  function fetchProductos(term, page = 1) {
    if (isLoadingProducto || !hasMoreProducto) return;
    isLoadingProducto = true;
    console.log(`Fetching productos: term='${term}', page=${page}`);

    // Excluir IDs ya listados en inventarioTemp
    const excludedIds = inventarioTemp.map(item => item.productId).join(',');
    const url = `${productoAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}&excluded=${excludedIds}`;
    console.log('Productos excluidos:', excludedIds);

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
        console.log('Productos fetch completado:', data);
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
    // Ocultar alert global
    const globalError = document.getElementById('error-message');
    if (globalError) {
      globalError.style.display = 'none';
      globalError.innerHTML = '';
    }
    const successMessage = document.getElementById('success-message');
    if (successMessage) {
      successMessage.style.display = 'none';
      successMessage.innerHTML = '';
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

  function showGlobalError(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
      errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
      errorDiv.style.display = 'block';
    }
  }

  function showSuccess(message) {
    const successDiv = document.getElementById('success-message');
    if (successDiv) {
      successDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
      successDiv.style.display = 'block';
    }
  }

  /* ==========================
     6. Eventos de Autocomplete
  ========================== */
  // --- Sucursal ---
  sucursalInput.addEventListener('input', function() {
    sucursalIdInput.value = '';
    hasMoreSucursal = true;
    currentPageSucursal = 1;
    currentTermSucursal = sucursalInput.value.trim();

    if (!currentTermSucursal) {
      sucursalResults.innerHTML = '';
      sucursalResults.style.display = 'none';
      return;
    }
    if (debounceTimeoutSucursal) {
      clearTimeout(debounceTimeoutSucursal);
    }
    debounceTimeoutSucursal = setTimeout(function() {
      fetchSucursales(currentTermSucursal, currentPageSucursal);
    }, DEBOUNCE_TIME);
  });

  sucursalInput.addEventListener('focus', function() {
    currentTermSucursal = sucursalInput.value.trim();
    hasMoreSucursal = true;
    currentPageSucursal = 1;
    if (debounceTimeoutSucursal) {
      clearTimeout(debounceTimeoutSucursal);
    }
    debounceTimeoutSucursal = setTimeout(function() {
      fetchSucursales(currentTermSucursal, currentPageSucursal);
    }, DEBOUNCE_TIME);
  });

  sucursalResults.addEventListener('scroll', function() {
    if (sucursalResults.scrollTop + sucursalResults.clientHeight >= sucursalResults.scrollHeight - 5) {
      if (hasMoreSucursal && !isLoadingSucursal) {
        currentPageSucursal += 1;
        fetchSucursales(currentTermSucursal, currentPageSucursal);
      }
    }
  });

  sucursalResults.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('autocomplete-option')) {
      sucursalInput.value    = e.target.textContent;
      sucursalIdInput.value  = e.target.dataset.id;
      sucursalResults.innerHTML = '';
      sucursalResults.style.display = 'none';
      hasMoreSucursal = false;
    }
  });

  document.addEventListener('click', function(e) {
    if (!sucursalInput.contains(e.target) && !sucursalResults.contains(e.target)) {
      sucursalResults.innerHTML = '';
      sucursalResults.style.display = 'none';
      hasMoreSucursal = false;
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
    if (!productoInput.contains(e.target) && !productoResults.contains(e.target)) {
      productoResults.innerHTML = '';
      productoResults.style.display = 'none';
      hasMoreProducto = false;
    }
  });

  /* =================================================
     7. Agregar Producto (con campo editable de Cantidad)
  ================================================= */
  btnAgregarProducto.addEventListener('click', function() {
    clearErrors();

    const sucursalId = sucursalIdInput.value.trim();
    const productId = productoIdInput.value.trim();
    const productName = productoInput.value.trim();
    const cantidad = cantidadInput.value.trim();

    let hasLocalErrors = false;
    if (!sucursalId) {
      showFieldError('sucursal', 'Debe seleccionar una sucursal.');
      hasLocalErrors = true;
    }
    if (!productId) {
      showFieldError('productoid', 'Debe seleccionar un producto.');
      hasLocalErrors = true;
    }
    if (!cantidad || parseInt(cantidad) <= 0) {
      showFieldError('cantidad', 'La cantidad debe ser mayor que 0.');
      hasLocalErrors = true;
    }
    if (hasLocalErrors) return;

    // Revisar si el producto ya existe
    const existe = inventarioTemp.some(item => item.productId === productId);
    if (existe) {
      showFieldError('productoid', 'Este producto ya está en la lista.');
      return;
    }

    // Agregar al array temporal
    inventarioTemp.push({
      productId:  productId,
      productName: productName,
      cantidad:    cantidad
    });
    console.log('inventarioTemp después de agregar:', inventarioTemp);

    // Insertar fila en DataTable con cantidad editable
    dataTable.row.add([
      productName,
      `<input type="number" class="qty-input" value="${cantidad}" min="1" style="width: 70px;">`,
      `<button type="button" class="btn-eliminar" data-product-id="${productId}">
         <i class="fas fa-trash-alt"></i>
       </button>`
    ]).draw(false);

    // Limpiar campos de texto
    productoInput.value   = '';
    productoIdInput.value = '';
    cantidadInput.value   = '';
  });

  /* ======================
     8. Eliminar de la tabla
  ====================== */
  // Manejar el evento de eliminar utilizando delegación de eventos
  document.getElementById('productos-body').addEventListener('click', function(e) {
    if (e.target.closest('.btn-eliminar')) {
      const button = e.target.closest('.btn-eliminar');
      const productId = button.getAttribute('data-product-id');
      const row = button.closest('tr');
      dataTable.row(row).remove().draw(false);
      inventarioTemp = inventarioTemp.filter(p => p.productId !== productId);
      console.log('inventarioTemp después de eliminar:', inventarioTemp);
    }
  });

  /* =========================
     9. Submit del Formulario
  ========================= */
  form.addEventListener('submit', function(event) {
    event.preventDefault();
    clearErrors();

    // Validar que al menos haya un producto
    if (inventarioTemp.length === 0) {
      showGlobalError('Debe agregar al menos un producto antes de guardar.');
      return;
    }

    // Actualizar inventarioTemp según lo editado en la tabla
    const rows = dataTable.rows().indexes();
    rows.each(function(idx) {
      const rowNode = dataTable.row(idx).node();
      const cells = rowNode.querySelectorAll('td');
      if (cells.length >= 2) {
        const productNameCell = cells[0].textContent.trim();
        const qtyInput = cells[1].querySelector('.qty-input');
        if (qtyInput) {
          const newQty = qtyInput.value.trim();
          const itemIndex = inventarioTemp.findIndex(i => i.productName === productNameCell);
          if (itemIndex >= 0) {
            inventarioTemp[itemIndex].cantidad = newQty;
          }
        }
      }
    });

    console.log('inventarioTemp antes de enviar:', inventarioTemp);

    // Poner inventariosTemp en el campo oculto como JSON
    const inventariosTempInput = document.getElementById('id_inventarios_temp');
    inventariosTempInput.value = JSON.stringify(inventarioTemp);
    console.log('inventarios_temp enviado:', inventariosTempInput.value);

    // Enviar el formulario vía AJAX
    const formData = new FormData(form);
    fetch(form.action, {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCookie('csrftoken'),
            'Accept': 'application/json',
        },
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Respuesta del servidor:', data);
        if (data.success) {
            // Éxito: mostrar mensaje, resetear formulario y tabla
            showSuccess('Inventario creado exitosamente.');
            form.reset();
            inventarioTemp = [];
            dataTable.clear().draw();
            sucursalResults.innerHTML = '';
            sucursalResults.style.display = 'none';
            productoResults.innerHTML = '';
            productoResults.style.display = 'none';
        } else {
            // Mostrar errores devueltos por el backend
            const errors = JSON.parse(data.errors);
            for (let field in errors) {
                const fieldErrors = errors[field];
                fieldErrors.forEach(error => {
                    showFieldError(field, error.message);
                });
            }
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showGlobalError('Ocurrió un error inesperado al guardar.');
    });
  });

  /* ================================
     10. Función para Obtener la Cookie
  ================================= */
  function getCookie(name) {
      let cookieValue = null;
      if (document.cookie && document.cookie !== '') {
          const cookies = document.cookie.split(';');
          for (let cookie of cookies) {
              cookie = cookie.trim();
              if (cookie.startsWith(name + '=')) {
                  cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                  break;
              }
          }
      }
      return cookieValue;
  }

});
