// agregar_precios_proveedor.js

document.addEventListener('DOMContentLoaded', function() {
  /* =======================
     1. Inicializar DataTable con opciones responsive
  ======================= */
  const dataTable = $('#productos-list').DataTable({
    paging: false,
    searching: true,
    info: false,
    responsive: true, // Activar modo responsive
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

  // Lista temporal: { productId, productName, price }
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

  function fetchProductos(term, page = 1) {
    if (isLoadingProducto || !hasMoreProducto) return;
    isLoadingProducto = true;

    // Excluimos IDs ya listados en “preciosTemp”
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

  document.addEventListener('click', function(e) {
    if (!proveedorInput.contains(e.target) && !proveedorResults.contains(e.target)) {
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
    if (!productoInput.contains(e.target) && !productoResults.contains(e.target)) {
      productoResults.innerHTML = '';
      productoResults.style.display = 'none';
      hasMoreProducto = false;
    }
  });

  /* =======================
     7. Agregar Producto
  ======================= */
  btnAgregarProducto.addEventListener('click', function() {
    clearErrors();

    const provId   = proveedorIdInput.value.trim();
    const prodId   = productoIdInput.value.trim();
    const prodName = productoInput.value.trim();
    const priceVal = precioInput.value.trim();

    let hasLocalErrors = false;

    // REGLA: SE REQUIEREN los 3 campos para agregar un producto
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

    // Agregar al array
    preciosTemp.push({
      productId:  prodId,
      productName:prodName,
      price:      priceVal
    });

    // Insertar fila en DataTable con precio editable y placeholder
    dataTable.row.add([
      prodName,
      `<input type="number" class="price-input" value="${priceVal}" step="0.01" min="0.01" placeholder="Ingrese el precio" style="width:80px;">`,
      `<button type="button" class="btn-eliminar" data-product-id="${prodId}">
         <i class="fas fa-trash-alt"></i>
       </button>`
    ]).draw(false);

    // Limpiar campos de texto
    productoInput.value   = '';
    productoIdInput.value = '';
    precioInput.value     = '';
  });

  /* ======================
     8. Eliminar de la tabla
  ====================== */
  document.getElementById('productos-body').addEventListener('click', function(e) {
    if (e.target.closest('.btn-eliminar')) {
      const button = e.target.closest('.btn-eliminar');
      const productId = button.getAttribute('data-product-id');
      const row = button.closest('tr');
      dataTable.row(row).remove().draw(false);
      preciosTemp = preciosTemp.filter(p => p.productId !== productId);
    }
  });

  /* =========================
     9. Submit del Formulario
  ========================= */
  form.addEventListener('submit', function(event) {
    event.preventDefault();
    clearErrors();

    // Validar al menos un producto en preciosTemp
    if (preciosTemp.length === 0) {
      showGlobalError('Debe agregar al menos un producto antes de guardar.');
      return;
    }

    // Actualizar precios según lo editado en la tabla
    const rows = dataTable.rows().indexes();
    rows.each(function(idx) {
      const rowNode = dataTable.row(idx).node();
      const cells = rowNode.querySelectorAll('td');
      if (cells.length >= 2) {
        const productNameCell = cells[0].textContent.trim();
        const priceInputElem = cells[1].querySelector('.price-input');
        if (priceInputElem) {
          const newPrice = priceInputElem.value.trim();
          const itemIndex = preciosTemp.findIndex(i => i.productName === productNameCell);
          if (itemIndex >= 0) {
            preciosTemp[itemIndex].price = newPrice;
          }
        }
      }
    });

    // Poner preciosTemp en el campo oculto como JSON
    const preciosTempInput = document.getElementById('id_precios_temp');
    preciosTempInput.value = JSON.stringify(preciosTemp);

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
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Éxito: mostrar mensaje, resetear formulario y tabla
            showSuccess('Productos y precios agregados exitosamente al proveedor.');
            form.reset();
            preciosTemp = [];
            dataTable.clear().draw();
            proveedorResults.innerHTML = '';
            proveedorResults.style.display = 'none';
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
