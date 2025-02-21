$(document).ready(function() {
    // Inicializar DataTable
    var table = $('#inventarios-list').DataTable({
        paging: false,
        searching: true,
        info: false,
        language: {
            search: "Buscar:",
            zeroRecords: "No se encontraron resultados",
            emptyTable: "No hay productos para mostrar"
        }
    });

    // Función para mostrar mensajes de alerta
    function mostrarMensaje(mensaje, clase) {
        $('.alert').remove();
        var alertDiv = $('<div class="alert ' + clase + '">' + mensaje + '</div>');
        $('h2').after(alertDiv);
    }

    // Manejo de eliminación de inventario vía AJAX
    $('#inventarios-list').on('click', '.btn-eliminar', function(event) {
        event.preventDefault();
        var button = $(this);
        var inventarioId = button.data('inventario-id');
        var row = button.closest('tr');
        if (confirm('¿Estás seguro de que deseas eliminar este producto?')) {
            $.ajax({
                url: eliminarInventarioUrlPattern.replace('0', inventarioId),
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
                    mostrarMensaje('Ocurrió un error al eliminar el producto.', 'alert-error');
                }
            });
        }
    });

    /* Autocomplete para Sucursal (con inventario) */
    var sucursalInput = $('#id_sucursal_autocomplete');
    var sucursalResults = $('#sucursal-autocomplete-results');
    var sucursalIdInput = $('#id_sucursal');
    var currentPage = 1;
    var isLoading = false;
    var hasMore = true;
    var currentTerm = '';

    function fetchSucursales(term, page) {
        console.log("Fetch sucursales:", term, "page:", page);
        if (isLoading) return;
        isLoading = true;
        $.ajax({
            url: sucursalAutocompleteUrl,
            data: { term: term, page: page },
            dataType: "json",
            success: function(data) {
                console.log("Datos recibidos:", data);
                if (page === 1) {
                    sucursalResults.empty();
                }
                if (data.results && data.results.length > 0) {
                    $.each(data.results, function(i, item) {
                        var option = $('<div class="autocomplete-option"></div>')
                            .text(item.text)
                            .attr('data-id', item.id);
                        sucursalResults.append(option);
                    });
                    hasMore = data.has_more;
                } else if (page === 1) {
                    sucursalResults.append('<div class="autocomplete-no-result">No se encontraron resultados</div>');
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

    function debounce(func, delay) {
        var timeout;
        return function() {
            var context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(function() {
                func.apply(context, args);
            }, delay);
        };
    }
    var debouncedFetchSucursales = debounce(function() {
        currentPage = 1;
        currentTerm = sucursalInput.val().trim();
        fetchSucursales(currentTerm, currentPage);
    }, 300);

    sucursalInput.on('input', function() {
        sucursalIdInput.val('');
        hasMore = true;
        debouncedFetchSucursales();
    });

    // Al hacer focus, se muestra el autocomplete (incluso si el campo está vacío)
    sucursalInput.on('focus', function() {
        currentTerm = sucursalInput.val().trim();
        currentPage = 1;
        fetchSucursales(currentTerm, currentPage);
    });

    sucursalResults.on('click', '.autocomplete-option', function() {
        var selectedText = $(this).text();
        var selectedId = $(this).data('id');
        sucursalInput.val(selectedText);
        sucursalIdInput.val(selectedId);
        sucursalResults.hide();
        $('#sucursalForm').submit();
    });

    $(document).on('click', function(e) {
        if (!$(e.target).closest('#id_sucursal_autocomplete, #sucursal-autocomplete-results').length) {
            sucursalResults.hide();
        }
    });

    sucursalResults.on('scroll', function() {
        if (sucursalResults.scrollTop() + sucursalResults.innerHeight() >= sucursalResults[0].scrollHeight - 5) {
            if (hasMore && !isLoading) {
                currentPage++;
                fetchSucursales(currentTerm, currentPage);
            }
        }
    });
});
