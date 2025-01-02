// agregar_inventario.js

document.addEventListener('DOMContentLoaded', function() {

    /* ======================
       1. Inicializar DataTable
    ====================== */
    const dataTable = $('#productos-list').DataTable({
      paging: false,
      searching: true,
      info: false,
      language: {
        search: "Buscar:",
        zeroRecords: "No se encontraron resultados",
        emptyTable: "No hay productos para mostrar",
      },
    });
  
    /* =====================
       2. Variables Generales
    ===================== */
    const form = document.getElementById('inventarioForm');
  
    // Autocompletado de Sucursal
    const sucursalInput = document.getElementById('id_sucursal_autocomplete');
    const sucursalIdInput = document.getElementById('id_sucursalid');
    const sucursalResults = document.getElementById('sucursal-autocomplete-results');
    let isLoadingSucursal = false;
    let hasMoreSucursal = true;
    let currentPageSucursal = 1;
    let currentTermSucursal = '';
  
    // Autocompletado de Producto
    const productoInput = document.getElementById('id_producto_autocomplete');
    const productoIdInput = document.getElementById('id_producto_id');
    const productoResults = document.getElementById('producto-autocomplete-results');
    let isLoadingProducto = false;
    let hasMoreProducto = true;
    let currentPageProducto = 1;
    let currentTermProducto = '';
  
    // Campo Cantidad
    const cantidadInput = document.getElementById('id_cantidad');
    // Botón “Agregar Producto”
    const btnAgregarProducto = document.getElementById('agregarProductoBtn');
  
    // Array para la tabla temporal: { productId, productName, cantidad }
    let inventarioTemp = [];
  
    /* =========================
       3. Variables de Debounce
    ========================= */
    let debounceTimeoutSucursal = null;
    let debounceTimeoutProducto = null;
    const DEBOUNCE_TIME = 150; // 150 ms => más rápido que los 300 ms habituales
  
    /* ===================================
       4. Funciones de Autocompletado AJAX
    =================================== */
    function fetchSucursales(term, page = 1) {
      if (isLoadingSucursal || !hasMoreSucursal) return;
      isLoadingSucursal = true;
  
      // Endpoint sin cambios (solo Sucursales sin inventario)
      const url = `${sucursalAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}`;
  
      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
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
              opt.dataset.id = item.id;
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
        })
        .catch(error => {
          console.error('fetchSucursales error:', error);
          isLoadingSucursal = false;
        });
    }
  
    function fetchProductos(term, page = 1) {
      if (isLoadingProducto || !hasMoreProducto) return;
      isLoadingProducto = true;
  
      // Construimos lista de productos ya listados:
      const excludedIds = inventarioTemp.map(item => item.productId).join(',');
  
      // Enviamos 'excluded' como query param para que el backend excluya esos IDs
      const url = `${productoAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}&excluded=${excludedIds}`;
  
      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
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
              opt.dataset.id = item.id;
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
  
    /* =========================
       5. Manejo de Errores
    ========================= */
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
    }
  
    function showFieldError(field, message) {
      const errorDiv = document.getElementById(`error-id_${field}`);
      if (errorDiv) {
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        errorDiv.classList.add('visible');
      }
    }
  
    /* =========================
       6. Eventos de Autocomplete
    ========================= */
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
      if (sucursalInput.value.trim().length === 0) {
        currentTermSucursal = '';
      } else {
        currentTermSucursal = sucursalInput.value.trim();
      }
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
      if (
        sucursalResults.scrollTop + sucursalResults.clientHeight >=
        sucursalResults.scrollHeight - 5
      ) {
        if (hasMoreSucursal && !isLoadingSucursal) {
          currentPageSucursal += 1;
          fetchSucursales(currentTermSucursal, currentPageSucursal);
        }
      }
    });
  
    sucursalResults.addEventListener('click', function(e) {
      if (e.target && e.target.classList.contains('autocomplete-option')) {
        sucursalInput.value = e.target.textContent;
        sucursalIdInput.value = e.target.dataset.id;
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
      if (productoInput.value.trim().length === 0) {
        currentTermProducto = '';
      } else {
        currentTermProducto = productoInput.value.trim();
      }
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
      if (
        productoResults.scrollTop + productoResults.clientHeight >=
        productoResults.scrollHeight - 5
      ) {
        if (hasMoreProducto && !isLoadingProducto) {
          currentPageProducto += 1;
          fetchProductos(currentTermProducto, currentPageProducto);
        }
      }
    });
  
    productoResults.addEventListener('click', function(e) {
      if (e.target && e.target.classList.contains('autocomplete-option')) {
        productoInput.value = e.target.textContent;
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
      const cant = cantidadInput.value.trim();
  
      let hasLocalErrors = false;
      if (!sucursalId) {
        showFieldError('sucursalid', 'Debe seleccionar una sucursal.');
        hasLocalErrors = true;
      }
      if (!productId) {
        showFieldError('producto_id', 'Debe seleccionar un producto.');
        hasLocalErrors = true;
      }
      if (!cant || parseInt(cant) <= 0) {
        showFieldError('cantidad', 'La cantidad debe ser mayor que 0.');
        hasLocalErrors = true;
      }
      if (hasLocalErrors) return;
  
      // Revisar si el producto ya existe
      const existe = inventarioTemp.some(item => item.productId === productId);
      if (existe) {
        showFieldError('producto_id', 'Este producto ya está en la lista.');
        return;
      }
  
      // Agregar al array temporal
      inventarioTemp.push({
        productId: productId,
        productName: productName,
        cantidad: cant
      });
  
      // Agregar fila a DataTable con campo editable:
      dataTable.row.add([
        productName,
        `<input type="number" class="qty-input" value="${cant}" min="1" style="width: 70px;">`,
        `<button type="button" class="btn-eliminar" onclick="eliminarProductoDT(this, '${productId}')">
           <i class="fas fa-trash-alt"></i>
         </button>`
      ]).draw(false);
  
      // Limpiar los campos
      productoInput.value = '';
      productoIdInput.value = '';
      cantidadInput.value = '';
    });
  
    // Eliminar fila => define una función global para invocarla desde onclick
    window.eliminarProductoDT = function(button, productId) {
      const row = $(button).closest('tr');
      dataTable.row(row).remove().draw(false);
  
      // Remover también del array
      inventarioTemp = inventarioTemp.filter(item => item.productId !== productId);
    };
  
    /* =========================
       8. Submit del Formulario
    ========================= */
    form.addEventListener('submit', function(event) {
      clearErrors();
  
      // Validar que al menos haya un producto
      if (inventarioTemp.length === 0) {
        showFieldError('producto_id', 'Debe agregar al menos un producto antes de guardar.');
        event.preventDefault();
        return;
      }
  
      // Antes de crear los <input hidden>, 
      // actualizamos 'inventarioTemp' con las cantidades editadas en la tabla
      const rows = dataTable.rows().indexes();
      rows.each(function(idx) {
        const rowNode = dataTable.row(idx).node();
        const cells = rowNode.querySelectorAll('td');
        if (cells.length >= 2) {
          const productNameCell = cells[0].textContent.trim();
          const qtyInput = cells[1].querySelector('.qty-input');
          if (qtyInput) {
            const newQty = qtyInput.value.trim();
            // Buscar en el array "inventarioTemp" el item con productName:
            const itemIndex = inventarioTemp.findIndex(i => i.productName === productNameCell);
            if (itemIndex >= 0) {
              inventarioTemp[itemIndex].cantidad = newQty;
            }
          }
        }
      });
  
      // Crear <input hidden> para cada (productId, cantidad)
      inventarioTemp.forEach(item => {
        const pInput = document.createElement('input');
        pInput.type = 'hidden';
        pInput.name = 'producto[]';
        pInput.value = item.productId;
        form.appendChild(pInput);
  
        const cInput = document.createElement('input');
        cInput.type = 'hidden';
        cInput.name = 'cantidad[]';
        cInput.value = item.cantidad;
        form.appendChild(cInput);
      });
      // Se envía el formulario de forma normal
    });
  
    /* ==========================================================
       9. Manejo de Mensaje de Éxito con Icono “Chulito” Inline
    ========================================================== */
    // Ejemplo: Si deseas mostrar mensaje de éxito programáticamente:
    // successMessage('<i class="fas fa-check-circle"></i> Inventario creado exitosamente.');
    function successMessage(htmlText) {
      const successDiv = document.getElementById('success-message');
      if (successDiv) {
        successDiv.innerHTML = htmlText;
        successDiv.style.display = 'block';
      }
    }
  
  });
  