// static/javascript/editar_inventario.js

document.addEventListener('DOMContentLoaded', function() {
    // 1. Inicializar DataTable
    const table = $('#inventario-list').DataTable({
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
  
    // 2. Referencias al DOM
    const form = document.getElementById('inventarioForm');
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');
  
    // Sucursal
    const sucursalInput    = document.getElementById('id_sucursal_autocomplete');
    const sucursalIdInput  = document.getElementById('id_sucursal');  // hidden
    const sucursalResults  = document.getElementById('sucursal-autocomplete-results');
  
    // Producto
    const productoInput    = document.getElementById('id_producto_autocomplete');
    const productoIdInput  = document.getElementById('id_productoid');
    const productoResults  = document.getElementById('producto-autocomplete-results');
  
    // Cantidad
    const cantidadInput    = document.getElementById('id_cantidad');
    const btnAgregar       = document.getElementById('btn-agregar-producto');
  
    // Campo oculto con el JSON final
    const inventariosTempInput = document.getElementById('id_inventarios_temp');
  
    // Array con inventarios (existentes + nuevos)
    let inventarioTemp = [];
  
    // 2A. Cargar filas existentes (productos) en el array 'inventarioTemp'
    const existingRows = table.rows().nodes();
    existingRows.each((row) => {
      const productId   = row.getAttribute('data-product-id');
      const productName = row.cells[0].textContent.trim();
      const qtyInput    = row.cells[1].querySelector('input.qty-input');
      const cantidadVal = qtyInput ? qtyInput.value.trim() : '1';
      inventarioTemp.push({
        productId,
        productName,
        cantidad: cantidadVal
      });
    });
    console.log('inventarioTemp inicial:', inventarioTemp);
  
    // 3. Manejo de Errores
    function clearErrors() {
      document.querySelectorAll('.field-error').forEach(e => {
        e.innerHTML = '';
        e.style.display = 'none';
      });
      errorMessageDiv.style.display = 'none';
      successMessageDiv.style.display = 'none';
    }

    function showFieldError(field, message) {
      const errorDiv = document.getElementById(`error-id_${field}`);
      if (errorDiv) {
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        errorDiv.style.display = 'block';
      }
    }

    function showGlobalError(msg) {
      errorMessageDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
      errorMessageDiv.style.display = 'block';
    }

    function showSuccess(msg) {
      successMessageDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${msg}`;
      successMessageDiv.style.display = 'block';
    }
  
    // 4. Autocomplete Sucursal
    let isLoadingSucursal = false,
        hasMoreSucursal   = true,
        currentPageSucursal = 1,
        currentTermSucursal = '';
  
    function fetchSucursales(term, page=1) {
      if (isLoadingSucursal || !hasMoreSucursal) return;
      isLoadingSucursal = true;
      const url = `${sucursalAutocompleteUrl}&term=${encodeURIComponent(term)}&page=${page}`;
      console.log('Fetch sucursales:', url);
  
      fetch(url)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP error: ${r.status}`);
          return r.json();
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
            const noRes = document.createElement('div');
            noRes.classList.add('autocomplete-no-result');
            noRes.textContent = 'No se encontraron resultados';
            sucursalResults.appendChild(noRes);
            hasMoreSucursal = false;
          }
          sucursalResults.style.display = 'block';
        })
        .catch(e => console.error('Error fetchSucursales:', e))
        .finally(() => {
          isLoadingSucursal = false;
        });
    }
  
    if (sucursalInput) {
      sucursalInput.addEventListener('input', () => {
        clearErrors();
        sucursalIdInput.value = '';
        hasMoreSucursal = true;
        currentPageSucursal = 1;
        currentTermSucursal = sucursalInput.value.trim();
        fetchSucursales(currentTermSucursal, currentPageSucursal);
      });

      sucursalInput.addEventListener('focus', () => {
        clearErrors();
        hasMoreSucursal = true;
        currentPageSucursal = 1;
        currentTermSucursal = sucursalInput.value.trim();
        fetchSucursales(currentTermSucursal, currentPageSucursal);
      });

      sucursalResults.addEventListener('scroll', () => {
        if (sucursalResults.scrollTop + sucursalResults.clientHeight >= sucursalResults.scrollHeight - 5) {
          if (!isLoadingSucursal && hasMoreSucursal) {
            currentPageSucursal++;
            fetchSucursales(currentTermSucursal, currentPageSucursal);
          }
        }
      });

      sucursalResults.addEventListener('click', (e) => {
        if (e.target.classList.contains('autocomplete-option')) {
          sucursalInput.value = e.target.textContent;
          sucursalIdInput.value = e.target.dataset.id;
          sucursalResults.innerHTML = '';
          sucursalResults.style.display = 'none';
          hasMoreSucursal = false;
        }
      });

      document.addEventListener('click', (ev) => {
        if (!sucursalInput.contains(ev.target) && !sucursalResults.contains(ev.target)) {
          sucursalResults.innerHTML = '';
          sucursalResults.style.display = 'none';
          hasMoreSucursal = false;
        }
      });
    }
  
    // 5. Autocomplete Producto
    let isLoadingProducto = false,
        hasMoreProducto   = true,
        currentPageProducto = 1,
        currentTermProducto = '';
  
    function fetchProductos(term, page=1) {
      if (isLoadingProducto || !hasMoreProducto) return;
      isLoadingProducto = true;
  
      // Excluir los productos ya en inventarioTemp
      //  (así se evita que aparezcan repetidos)
      const excludedIds = inventarioTemp.map(i => i.productId).join(',');
      // Armamos la URL con el param 'excluded'
      const url = `${productoAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}&excluded=${excludedIds}`;
      console.log('Fetching productos:', url);

      fetch(url)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP error: ${r.status}`);
          return r.json();
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
            const noRes = document.createElement('div');
            noRes.classList.add('autocomplete-no-result');
            noRes.textContent = 'No se encontraron resultados';
            productoResults.appendChild(noRes);
            hasMoreProducto = false;
          }
          productoResults.style.display = 'block';
        })
        .catch(err => console.error('Error fetchProductos:', err))
        .finally(() => {
          isLoadingProducto = false;
        });
    }
  
    productoInput.addEventListener('input', () => {
      clearErrors();
      productoIdInput.value = '';
      hasMoreProducto = true;
      currentPageProducto = 1;
      currentTermProducto = productoInput.value.trim();
      fetchProductos(currentTermProducto, currentPageProducto);
    });

    productoInput.addEventListener('focus', () => {
      clearErrors();
      hasMoreProducto = true;
      currentPageProducto = 1;
      currentTermProducto = productoInput.value.trim();
      fetchProductos(currentTermProducto, currentPageProducto);
    });

    productoResults.addEventListener('scroll', () => {
      if (productoResults.scrollTop + productoResults.clientHeight >= productoResults.scrollHeight - 5) {
        if (!isLoadingProducto && hasMoreProducto) {
          currentPageProducto++;
          fetchProductos(currentTermProducto, currentPageProducto);
        }
      }
    });

    productoResults.addEventListener('click', (e) => {
      if (e.target.classList.contains('autocomplete-option')) {
        productoInput.value   = e.target.textContent;
        productoIdInput.value = e.target.dataset.id;
        productoResults.innerHTML = '';
        productoResults.style.display = 'none';
        hasMoreProducto = false;
      }
    });

    document.addEventListener('click', (ev) => {
      if (!productoInput.contains(ev.target) && !productoResults.contains(ev.target)) {
        productoResults.innerHTML = '';
        productoResults.style.display = 'none';
        hasMoreProducto = false;
      }
    });
  
    // 6. Agregar producto a la tabla
    btnAgregar.addEventListener('click', () => {
      clearErrors();
      const sId = sucursalIdInput.value.trim();
      const pId = productoIdInput.value.trim();
      const pName = productoInput.value.trim();
      const qty   = cantidadInput.value.trim();
  
      let hasErrors = false;
      if (!sId) {
        showFieldError('sucursal', 'Debe seleccionar una sucursal.');
        hasErrors = true;
      }
      if (!pId) {
        showFieldError('productoid', 'Debe seleccionar un producto.');
        hasErrors = true;
      }
      if (!qty || parseInt(qty) < 1) {
        showFieldError('cantidad', 'La cantidad debe ser mayor que 0.');
        hasErrors = true;
      }
      if (hasErrors) return;
  
      // Verificar duplicado en nuestro array
      if (inventarioTemp.some(x => x.productId === pId)) {
        showFieldError('productoid', 'Este producto ya está en la lista.');
        return;
      }
  
      // Agregar
      inventarioTemp.push({
        productId: pId,
        productName: pName,
        cantidad: qty
      });
      console.log('inventarioTemp =>', inventarioTemp);
  
      // Agregar fila a DataTable
      table.row.add([
        pName,
        `<input type="number" class="qty-input" value="${qty}" min="1" style="width:70px;">`,
        `<button type="button" class="btn-eliminar" data-product-id="${pId}">
           <i class="fas fa-trash"></i>
         </button>`
      ]).draw(false);
  
      // Limpiar campos de producto
      productoInput.value   = '';
      productoIdInput.value = '';
      cantidadInput.value   = '';
    });
  
    // 7. Eliminar fila de la tabla
    document.addEventListener('click', (e) => {
      if (e.target.closest('.btn-eliminar')) {
        const btn = e.target.closest('.btn-eliminar');
        const row = btn.closest('tr');
        const pId = btn.dataset.productId;
  
        // 1) Eliminar del array 'inventarioTemp'
        inventarioTemp = inventarioTemp.filter(x => x.productId !== pId);
        // 2) Eliminar la fila del DataTable
        table.row(row).remove().draw(false);
      }
    });
  
    // 8. Al enviar => Guardar
    form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        clearErrors();
      
        // Validar sucursal
        if (!sucursalIdInput.value.trim()) {
          showFieldError('sucursal', 'Debe seleccionar una sucursal.');
          return;
        }
      
        // Convertimos los nodos de la tabla en un array nativo
        const rowNodes = table.rows().nodes();
        const rowsArray = Array.from(rowNodes);
      
        // Actualizar cantidades en inventarioTemp
        rowsArray.forEach((row) => {
          const pId = row.getAttribute('data-product-id');
          const input = row.querySelector('input.qty-input');
          if (input) {
            const nuevaCant = input.value.trim();
            const idx = inventarioTemp.findIndex(x => x.productId === pId);
            if (idx >= 0) {
              inventarioTemp[idx].cantidad = nuevaCant;
            }
          }
        });
      
        // Poner en JSON
        inventariosTempInput.value = JSON.stringify(inventarioTemp);
        console.log('Inventarios final =>', inventariosTempInput.value);
      
        // Enviar con fetch
        const formData = new FormData(form);
        fetch(form.action, {
          method: 'POST',
          headers: {
            'X-CSRFToken': getCookie('csrftoken'),
            'Accept': 'application/json',
          },
          body: formData
        })
        .then(resp => {
          if (!resp.ok) throw new Error(`HTTP Error: ${resp.status}`);
          return resp.json();
        })
        .then(data => {
          if (data.success) {
            // En lugar de mostrar el mensaje aquí, redirigimos
            // a la URL devuelta en 'redirect_url'
            window.location.href = data.redirect_url;
          } else {
            // Manejo de errores
            if (data.errors) {
              const errs = JSON.parse(data.errors);
              for (let field in errs) {
                errs[field].forEach(e => {
                  showFieldError(field, e.message);
                });
              }
            } else {
              showGlobalError('Error desconocido al actualizar.');
            }
          }
        })
        .catch(err => {
          console.error('Error al guardar:', err);
          showGlobalError('Ocurrió un error inesperado al guardar.');
        });
      });
  
    // 9. getCookie (CSRF)
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
