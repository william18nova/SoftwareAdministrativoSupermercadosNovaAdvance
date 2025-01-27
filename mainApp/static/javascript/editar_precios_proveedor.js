// static/javascript/editar_precios_proveedor.js

document.addEventListener('DOMContentLoaded', function() {
    // 1. Inicializar DataTable
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
  
    // 2. Referencias al DOM
    const form = document.getElementById('preciosForm');
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');
  
    // Proveedor
    const proveedorInput    = document.getElementById('id_proveedor_autocomplete');
    const proveedorIdInput  = document.getElementById('id_proveedor');
    const proveedorResults  = document.getElementById('proveedor-autocomplete-results');
  
    // Producto
    const productoInput     = document.getElementById('id_producto_autocomplete');
    const productoIdInput   = document.getElementById('id_productoid');
    const productoResults   = document.getElementById('producto-autocomplete-results');
  
    // Precio
    const precioInput       = document.getElementById('id_precio');
    const btnAgregar        = document.getElementById('agregarProductoBtn');
  
    // Campo oculto con el JSON final
    const preciosTempInput  = document.getElementById('id_precios_temp');
  
    // Array con los productos (existentes + nuevos)
    let preciosTemp = [];
  
    // 2A. Cargar productos existentes (del template) en la tabla
    if (typeof existingProducts !== 'undefined' && Array.isArray(existingProducts)) {
      existingProducts.forEach(item => {
        // item: { productId, productName, price }
        preciosTemp.push({
          productId:   String(item.productId),
          productName: item.productName,
          price:       String(item.price)
        });
        // Insertar fila en DataTable
        dataTable.row.add([
          item.productName,
          `<input type="number" class="price-input" value="${item.price}" step="0.01" min="0.01" style="width:80px;">`,
          `<button type="button" class="btn-eliminar" data-product-id="${item.productId}">
             <i class="fas fa-trash"></i>
           </button>`
        ]).draw(false);
      });
      console.log('Productos existentes cargados en preciosTemp:', preciosTemp);
    }
  
    // 3. Manejo de Errores
    function clearErrors() {
      document.querySelectorAll('.field-error').forEach(e => {
        e.innerHTML = '';
        e.style.display = 'none';
        e.classList.remove('visible');
      });
      errorMessageDiv.style.display = 'none';
      successMessageDiv.style.display = 'none';
      errorMessageDiv.innerHTML = '';
      successMessageDiv.innerHTML = '';
    }
    function showFieldError(field, message) {
      const errorDiv = document.getElementById(`error-id_${field}`);
      if (errorDiv) {
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        errorDiv.classList.add('visible');
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
  
    // 4. Autocomplete Proveedor
    let isLoadingProveedor = false,
        hasMoreProveedor   = true,
        currentPageProveedor = 1,
        currentTermProveedor = '';
  
    function fetchProveedores(term, page=1) {
      if (isLoadingProveedor || !hasMoreProveedor) return;
      isLoadingProveedor = true;
      const url = `${proveedorAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}`;
      console.log('Fetch proveedores:', url);
  
      fetch(url)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP error: ${r.status}`);
          return r.json();
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
            const noRes = document.createElement('div');
            noRes.classList.add('autocomplete-no-result');
            noRes.textContent = 'No se encontraron resultados';
            proveedorResults.appendChild(noRes);
            hasMoreProveedor = false;
          }
          proveedorResults.style.display = 'block';
          isLoadingProveedor = false;
        })
        .catch(e => {
          console.error('Error fetchProveedores:', e);
          isLoadingProveedor = false;
        });
    }
  
    proveedorInput.addEventListener('input', () => {
      clearErrors();
      proveedorIdInput.value = '';
      hasMoreProveedor = true;
      currentPageProveedor = 1;
      currentTermProveedor = proveedorInput.value.trim();
      if (!currentTermProveedor) {
        proveedorResults.innerHTML = '';
        proveedorResults.style.display = 'none';
        return;
      }
      fetchProveedores(currentTermProveedor, currentPageProveedor);
    });
  
    proveedorInput.addEventListener('focus', () => {
      clearErrors();
      hasMoreProveedor = true;
      currentPageProveedor = 1;
      currentTermProveedor = proveedorInput.value.trim();
      fetchProveedores(currentTermProveedor, currentPageProveedor);
    });
  
    proveedorResults.addEventListener('scroll', () => {
      if (proveedorResults.scrollTop + proveedorResults.clientHeight >= proveedorResults.scrollHeight - 5) {
        if (!isLoadingProveedor && hasMoreProveedor) {
          currentPageProveedor++;
          fetchProveedores(currentTermProveedor, currentPageProveedor);
        }
      }
    });
  
    proveedorResults.addEventListener('click', (e) => {
      if (e.target.classList.contains('autocomplete-option')) {
        proveedorInput.value   = e.target.textContent;
        proveedorIdInput.value = e.target.dataset.id;
        proveedorResults.innerHTML = '';
        proveedorResults.style.display = 'none';
        hasMoreProveedor = false;
      }
    });
  
    document.addEventListener('click', (e) => {
      if (!proveedorInput.contains(e.target) && !proveedorResults.contains(e.target)) {
        proveedorResults.innerHTML = '';
        proveedorResults.style.display = 'none';
        hasMoreProveedor = false;
      }
    });
  
    // 5. Autocomplete Producto
    let isLoadingProducto = false,
        hasMoreProducto   = true,
        currentPageProducto = 1,
        currentTermProducto = '';
  
    function fetchProductos(term, page=1) {
      if (isLoadingProducto || !hasMoreProducto) return;
      isLoadingProducto = true;
      // Excluir IDs ya listados
      const excludedIds = preciosTemp.map(i => i.productId).join(',');
      const url = `${productoPreciosAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}&excluded=${excludedIds}`;
      console.log('Fetch productos:', url);
  
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
          isLoadingProducto = false;
        })
        .catch(e => {
          console.error('Error fetchProductos:', e);
          isLoadingProducto = false;
        });
    }
  
    productoInput.addEventListener('input', () => {
      clearErrors();
      productoIdInput.value = '';
      hasMoreProducto = true;
      currentPageProducto = 1;
      currentTermProducto = productoInput.value.trim();
      if (!currentTermProducto) {
        productoResults.innerHTML = '';
        productoResults.style.display = 'none';
        return;
      }
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
  
    document.addEventListener('click', (e) => {
      if (!productoInput.contains(e.target) && !productoResults.contains(e.target)) {
        productoResults.innerHTML = '';
        productoResults.style.display = 'none';
        hasMoreProducto = false;
      }
    });
  
    // 6. Agregar o Actualizar producto
    btnAgregar.addEventListener('click', () => {
      clearErrors();
      const pvrId   = proveedorIdInput.value.trim();
      const pdtId   = productoIdInput.value.trim();
      const pdtName = productoInput.value.trim();
      const pPrice  = precioInput.value.trim();
  
      let hasLocalErrors = false;
      if (!pvrId) {
        showFieldError('proveedor', 'Debe seleccionar un proveedor.');
        hasLocalErrors = true;
      }
      if (!pdtId) {
        showFieldError('productoid', 'Debe seleccionar un producto.');
        hasLocalErrors = true;
      }
      if (!pPrice || parseFloat(pPrice) <= 0) {
        showFieldError('precio', 'El precio debe ser mayor que 0.');
        hasLocalErrors = true;
      }
      if (hasLocalErrors) return;
  
      // Revisar si ya existe => en ese caso, actualizamos su precio
      const index = preciosTemp.findIndex(x => x.productId === pdtId);
      if (index >= 0) {
        // Actualizar
        preciosTemp[index].price = pPrice;
        
        // Actualizar la fila en DataTable
        const rowNodesObj = dataTable.rows().nodes();        // NodeList (objeto DataTables)
        const rowNodesArr = Array.from(rowNodesObj);         // Convertir a array nativo
        rowNodesArr.forEach((row) => {
          const btnEliminar = row.querySelector('.btn-eliminar');
          if (btnEliminar && btnEliminar.dataset.productId === pdtId) {
            // Hallamos la celda de precio
            const priceCell = row.cells[1].querySelector('.price-input');
            if (priceCell) {
              priceCell.value = pPrice;
            }
          }
        });
      } else {
        // Agregar
        preciosTemp.push({
          productId: pdtId,
          productName: pdtName,
          price: pPrice
        });
        dataTable.row.add([
          pdtName,
          `<input type="number" class="price-input" value="${pPrice}" step="0.01" min="0.01" style="width:80px;">`,
          `<button type="button" class="btn-eliminar" data-product-id="${pdtId}">
             <i class="fas fa-trash"></i>
           </button>`
        ]).draw(false);
      }
  
      // Limpiar campos
      productoInput.value   = '';
      productoIdInput.value = '';
      precioInput.value     = '';
    });
  
    // 7. Eliminar de la Tabla
    document.getElementById('productos-body').addEventListener('click', (e) => {
      if (e.target.closest('.btn-eliminar')) {
        const btn = e.target.closest('.btn-eliminar');
        const row = btn.closest('tr');
        const pId = btn.dataset.productId;
        dataTable.row(row).remove().draw(false);
        preciosTemp = preciosTemp.filter(x => x.productId !== pId);
      }
    });
  
    // 8. Submit => Guardar Cambios
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      clearErrors();
  
      // (Opcional) forzar que haya al menos un producto
      // if (preciosTemp.length === 0) {
      //   showGlobalError('Debe agregar al menos un producto antes de guardar.');
      //   return;
      // }
  
      // Actualizar precios según lo editado en el DataTable
      const rowNodesObj = dataTable.rows().nodes();    // NodeList (objeto DataTables)
      const rowNodesArr = Array.from(rowNodesObj);     // Convertir a array nativo
      rowNodesArr.forEach((row) => {
        const btnEliminar = row.querySelector('.btn-eliminar');
        if (!btnEliminar) return;

        const productId = btnEliminar.dataset.productId;
        const priceInputElem = row.cells[1].querySelector('.price-input');
        if (priceInputElem) {
          const nuevaCant = priceInputElem.value.trim();
          const idx = preciosTemp.findIndex(x => x.productId === productId);
          if (idx >= 0) {
            preciosTemp[idx].price = nuevaCant;
          }
        }
      });
  
      // Poner el JSON en el hidden
      preciosTempInput.value = JSON.stringify(preciosTemp);
      console.log('preciosTemp final =>', preciosTempInput.value);
  
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
          showSuccess('Productos y precios actualizados correctamente.');
          // Redirigir
          window.location.href = data.redirect_url;
        } else {
          // Manejar errores
          const errors = JSON.parse(data.errors);
          for (let field in errors) {
            errors[field].forEach(e => {
              showFieldError(field, e.message);
            });
          }
        }
      })
      .catch(err => {
        console.error('Error al guardar:', err);
        showGlobalError('Ocurrió un error inesperado al guardar.');
      });
    });
  
    // 9. Función para obtener la cookie (CSRF)
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
