jQuery(document).ready(function($) {
  console.log("jQuery version:", $.fn.jquery);
  console.log("DataTable type:", typeof $.fn.DataTable); // Debe ser "function"

  // Inicializar DataTable para la tabla de horarios (si existe)
  if ($('#horarios-list').length) {
    if (typeof $.fn.DataTable === "function") {
      $('#horarios-list').DataTable({
        paging: false,
        searching: true,
        info: false,
        ordering: false,  // Deshabilita el ordenamiento (y sus flechitas)
        language: {
          search: "Buscar:",
          zeroRecords: "No se encontraron resultados",
          emptyTable: "No hay horarios para mostrar"
        }
      });
    } else {
      console.error("La función DataTable no está definida.");
    }
  } else {
    console.warn("El elemento #horarios-list no se encontró en el DOM.");
  }

  // Obtener el formulario
  const form = document.getElementById('sucursalForm');

  /* =========================
     Autocomplete de Sucursal
  ========================= */
  const sucursalInput = document.getElementById('id_sucursal_autocomplete');
  const sucursalIdInput = document.getElementById('id_sucursal');
  const sucursalResults = document.getElementById('sucursal-autocomplete-results');

  let isLoadingSucursal = false;
  let hasMoreSucursal = true;
  let currentPageSucursal = 1;
  let currentTermSucursal = '';

  function fetchSucursales(term, page = 1) {
    if (isLoadingSucursal || !hasMoreSucursal) return;
    isLoadingSucursal = true;
    const url = `${sucursalAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}`;
    fetch(url)
      .then(response => {
        if (!response.ok) { throw new Error(`HTTP Error: ${response.status}`); }
        return response.json();
      })
      .then(data => {
        if (page === 1) { sucursalResults.innerHTML = ""; }
        if (data.results && data.results.length > 0) {
          data.results.forEach(item => {
            const opt = document.createElement("div");
            opt.classList.add("autocomplete-option");
            opt.textContent = item.text;
            opt.dataset.id = item.id;
            sucursalResults.appendChild(opt);
          });
          hasMoreSucursal = data.has_more;
        } else if (page === 1) {
          const noResult = document.createElement("div");
          noResult.classList.add("autocomplete-no-result");
          noResult.textContent = "No se encontraron resultados";
          sucursalResults.appendChild(noResult);
          hasMoreSucursal = false;
        }
        sucursalResults.style.display = "block";
        isLoadingSucursal = false;
      })
      .catch(error => {
        console.error("Error en fetchSucursales:", error);
        isLoadingSucursal = false;
      });
  }

  function debounce(fn, delay) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    };
  }
  const debouncedFetchSucursales = debounce(() => {
    fetchSucursales(currentTermSucursal, currentPageSucursal);
  }, 300);

  if (sucursalInput) {
    sucursalInput.addEventListener("input", function() {
      sucursalIdInput.value = "";
      hasMoreSucursal = true;
      currentPageSucursal = 1;
      currentTermSucursal = sucursalInput.value.trim();
      debouncedFetchSucursales();
    });
    sucursalInput.addEventListener("focus", function() {
      hasMoreSucursal = true;
      currentPageSucursal = 1;
      currentTermSucursal = sucursalInput.value.trim();
      debouncedFetchSucursales();
    });
  }

  if (sucursalResults) {
    sucursalResults.addEventListener("scroll", function() {
      if (sucursalResults.scrollTop + sucursalResults.clientHeight >= sucursalResults.scrollHeight - 5) {
        if (hasMoreSucursal && !isLoadingSucursal) {
          currentPageSucursal += 1;
          fetchSucursales(currentTermSucursal, currentPageSucursal);
        }
      }
    });

    sucursalResults.addEventListener("click", function(e) {
      if (e.target && e.target.classList.contains("autocomplete-option")) {
        sucursalInput.value = e.target.textContent;
        sucursalIdInput.value = e.target.dataset.id;
        sucursalResults.innerHTML = "";
        sucursalResults.style.display = "none";
        hasMoreSucursal = false;
        // Habilitar el autocomplete del punto de pago
        const puntoInput = document.getElementById("id_punto_pago_autocomplete");
        if (puntoInput) {
          puntoInput.disabled = false;
          puntoInput.value = "";
          document.getElementById("id_punto_pago").value = "";
        }
      }
    });
  }

  document.addEventListener("click", function(e) {
    if (sucursalInput && !sucursalInput.contains(e.target) && !sucursalResults.contains(e.target)) {
      sucursalResults.innerHTML = "";
      sucursalResults.style.display = "none";
      hasMoreSucursal = false;
    }
  });

  /* ===============================
     Autocomplete de Punto de Pago
  =============================== */
  const puntoInput = document.getElementById("id_punto_pago_autocomplete");
  const puntoIdInput = document.getElementById("id_punto_pago");
  const puntoResults = document.getElementById("punto-pago-autocomplete-results");

  let isLoadingPunto = false;
  let hasMorePunto = true;
  let currentPagePunto = 1;
  let currentTermPunto = "";

  function fetchPuntos(term, page = 1) {
    if (isLoadingPunto || !hasMorePunto) return;
    isLoadingPunto = true;
    const url = `${puntoPagoAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}`;
    fetch(url)
      .then(response => {
        if (!response.ok) { throw new Error(`HTTP Error: ${response.status}`); }
        return response.json();
      })
      .then(data => {
        if (page === 1) { puntoResults.innerHTML = ""; }
        if (data.results && data.results.length > 0) {
          data.results.forEach(item => {
            const opt = document.createElement("div");
            opt.classList.add("autocomplete-option");
            opt.textContent = item.text;
            opt.dataset.id = item.id;
            puntoResults.appendChild(opt);
          });
          hasMorePunto = data.has_more;
        } else if (page === 1) {
          const noResult = document.createElement("div");
          noResult.classList.add("autocomplete-no-result");
          noResult.textContent = "No se encontraron resultados";
          puntoResults.appendChild(noResult);
          hasMorePunto = false;
        }
        puntoResults.style.display = "block";
        isLoadingPunto = false;
      })
      .catch(error => {
        console.error("Error en fetchPuntos:", error);
        isLoadingPunto = false;
      });
  }

  const debouncedFetchPuntos = debounce(() => {
    fetchPuntos(currentTermPunto, currentPagePunto);
  }, 300);

  if (puntoInput) {
    puntoInput.addEventListener("input", function() {
      puntoIdInput.value = "";
      hasMorePunto = true;
      currentPagePunto = 1;
      currentTermPunto = puntoInput.value.trim();
      debouncedFetchPuntos();
    });
    puntoInput.addEventListener("focus", function() {
      hasMorePunto = true;
      currentPagePunto = 1;
      currentTermPunto = puntoInput.value.trim();
      debouncedFetchPuntos();
    });
  }

  if (puntoResults) {
    puntoResults.addEventListener("scroll", function() {
      if (puntoResults.scrollTop + puntoResults.clientHeight >= puntoResults.scrollHeight - 5) {
        if (hasMorePunto && !isLoadingPunto) {
          currentPagePunto += 1;
          fetchPuntos(currentTermPunto, currentPagePunto);
        }
      }
    });

    puntoResults.addEventListener("click", function(e) {
      if (e.target && e.target.classList.contains("autocomplete-option")) {
        puntoInput.value = e.target.textContent;
        puntoIdInput.value = e.target.dataset.id;
        puntoResults.innerHTML = "";
        puntoResults.style.display = "none";
        hasMorePunto = false;
        // Enviar el formulario para cargar horarios
        form.submit();
      }
    });
  }

  document.addEventListener("click", function(e) {
    if (puntoInput && !puntoInput.contains(e.target) && !puntoResults.contains(e.target)) {
      puntoResults.innerHTML = "";
      puntoResults.style.display = "none";
      hasMorePunto = false;
    }
  });

  /* ---------------------------
     Binding para el Botón de Eliminar Horario
     (Delegación de eventos con jQuery)
  --------------------------- */
  $(document).on('click', '.btn-eliminar', function(e) {
    e.preventDefault();
    const btn = $(this);
    const horarioId = btn.data('id');
    const row = btn.closest('tr');
    if (confirm('¿Estás seguro de que deseas eliminar este horario?')) {
      const csrfToken = getCookie('csrftoken');
      // Reemplazar "999999" en la URL patrón por el id real
      const deleteUrl = eliminarHorarioUrlPattern.replace('999999', horarioId);
      $.ajax({
        url: deleteUrl,
        type: 'POST',
        headers: { 'X-CSRFToken': csrfToken },
        success: function(response) {
          if (response.success) {
            if ($.fn.DataTable) {
              $('#horarios-list').DataTable().row(row).remove().draw(false);
            }
          } else {
            alert('Error: ' + response.message);
          }
        },
        error: function(xhr, status, error) {
          alert('Ocurrió un error al eliminar el horario.');
        }
      });
    }
  });

  /* ---------------------------
     Función para Obtener la Cookie CSRF
  --------------------------- */
  function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== "") {
      const cookies = document.cookie.split(";");
      for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.startsWith(name + "=")) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }
});
