$(document).ready(function() {
    // Inicializar DataTable para la tabla de puntos de pago
    const table = $('#puntos-pago-list').DataTable({
        paging: false,
        searching: true,
        info: false,
        language: {
            search: "Buscar:",
            zeroRecords: "No se encontraron resultados",
            emptyTable: "No hay puntos de pago para mostrar"
        }
    });

    // Función para mostrar mensajes de alerta
    function mostrarMensaje(mensaje, clase) {
        $('.alert').remove();
        const mensajeDiv = $('<div>').addClass('alert ' + clase).text(mensaje);
        $('#sucursalForm').before(mensajeDiv);
    }

    // Manejo de la eliminación de un punto de pago vía AJAX
    $('#puntos-pago-list').on('click', '.btn-eliminar', function(event) {
        event.preventDefault();
        const button = $(this);
        const id = button.data('id');
        const row = button.closest('tr');
        if (confirm('¿Estás seguro de que deseas eliminar este punto de pago?')) {
            $.ajax({
                url: eliminarPuntoPagoUrlPattern.replace('0', id),
                type: 'POST',
                data: {
                    csrfmiddlewaretoken: $('input[name="csrfmiddlewaretoken"]').val()
                },
                success: function(response) {
                    if (response.success) {
                        table.row(row).remove().draw(false);
                        mostrarMensaje(response.message, 'alert-success');
                    } else {
                        mostrarMensaje(response.message, 'alert-error');
                    }
                },
                error: function(xhr, status, error) {
                    mostrarMensaje('Ocurrió un error al eliminar el punto de pago.', 'alert-error');
                }
            });
        }
    });

    // ---------------------------------------------
    // AUTOCOMPLETE PARA LA SELECCIÓN DE SUCURSAL
    // ---------------------------------------------
    const sucursalInput = $('#id_sucursal_autocomplete');
    const sucursalResults = $('#sucursal-autocomplete-results');
    const sucursalIdInput = $('#id_sucursal');

    let currentPage = 1;
    let isLoading = false;
    let hasMore = true;
    let currentTerm = '';

    // Función que consulta la API de autocomplete
    function fetchSucursales(term, page) {
        if (isLoading) return;
        isLoading = true;
        $.ajax({
            url: sucursalAutocompleteUrl,
            data: { term: term, page: page },
            dataType: "json",
            success: function(data) {
                if (page === 1) {
                    sucursalResults.empty();
                }
                if (data.results && data.results.length > 0) {
                    $.each(data.results, function(i, item) {
                        const option = $('<div class="autocomplete-option"></div>')
                            .text(item.text)
                            .attr('data-id', item.id);
                        sucursalResults.append(option);
                    });
                    hasMore = data.has_more;
                } else if (page === 1) {
                    sucursalResults.html('<div class="autocomplete-no-result">No se encontraron resultados</div>');
                    hasMore = false;
                }
                sucursalResults.show();
                isLoading = false;
            },
            error: function() {
                console.error("Error en la petición de sucursales.");
                isLoading = false;
            }
        });
    }

    // Función debounce para retrasar la petición mientras el usuario escribe
    function debounce(func, delay) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(function() {
                func.apply(context, args);
            }, delay);
        };
    }

    const debouncedFetchSucursales = debounce(function() {
        currentTerm = sucursalInput.val().trim();
        currentPage = 1;
        hasMore = true;
        fetchSucursales(currentTerm, currentPage);
    }, 300);

    // Cuando el usuario escribe en el input, se limpia el hidden y se llama al debounce
    sucursalInput.on('input', function() {
        sucursalIdInput.val('');
        debouncedFetchSucursales();
    });

    // Al hacer focus, se ejecuta la búsqueda, incluso si el input está vacío
    sucursalInput.on('focus', function() {
        currentTerm = sucursalInput.val().trim();
        currentPage = 1;
        hasMore = true;
        fetchSucursales(currentTerm, currentPage);
    });

    // Al hacer clic en una opción del autocomplete, se asigna el valor seleccionado
    sucursalResults.on('click', '.autocomplete-option', function() {
        const selectedText = $(this).text();
        const selectedId = $(this).data('id');
        sucursalInput.val(selectedText);
        sucursalIdInput.val(selectedId);
        sucursalResults.hide();
        $('#sucursalForm').submit();
    });

    // Ocultar el autocomplete si se hace clic fuera
    $(document).on('click', function(e) {
        if (!$(e.target).closest('#id_sucursal_autocomplete, #sucursal-autocomplete-results').length) {
            sucursalResults.hide();
        }
    });

    // Infinite scroll en el contenedor del autocomplete
    sucursalResults.on('scroll', function() {
        if (sucursalResults.scrollTop() + sucursalResults.innerHeight() >= sucursalResults[0].scrollHeight - 5) {
            if (hasMore && !isLoading) {
                currentPage++;
                fetchSucursales(currentTerm, currentPage);
            }
        }
    });
});
