$(document).ready(function() {
    // Inicializar DataTable
    var table = $('#productos-precios-list').DataTable({
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
        $('#proveedorForm').before(alertDiv);
    }

    // Manejo de eliminación de precio vía AJAX
    $('#productos-precios-list').on('click', '.btn-eliminar', function(event) {
        event.preventDefault();
        var button = $(this);
        var id = button.data('id');
        var row = button.closest('tr');
        if (confirm('¿Estás seguro de que deseas eliminar este precio del proveedor?')) {
            $.ajax({
                url: eliminarPrecioUrlPattern.replace('0', id),
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
                    mostrarMensaje('Ocurrió un error al eliminar el precio del proveedor.', 'alert-error');
                }
            });
        }
    });

    /* Autocomplete para Proveedor (vinculado con productos) */
    var proveedorInput = $('#id_proveedor_autocomplete');
    var proveedorResults = $('#proveedor-autocomplete-results');
    var proveedorIdInput = $('#id_proveedor');
    var currentPage = 1;
    var isLoading = false;
    var hasMore = true;
    var currentTerm = '';

    function fetchProveedores(term, page) {
        console.log("Fetch proveedores:", term, "page:", page);
        if (isLoading) return;
        isLoading = true;
        $.ajax({
            url: proveedorAutocompleteUrl,
            data: { term: term, page: page },
            dataType: "json",
            success: function(data) {
                console.log("Datos recibidos:", data);
                if (page === 1) {
                    proveedorResults.empty();
                }
                if (data.results && data.results.length > 0) {
                    $.each(data.results, function(i, item) {
                        var option = $('<div class="autocomplete-option"></div>')
                            .text(item.text)
                            .attr('data-id', item.id);
                        proveedorResults.append(option);
                    });
                    hasMore = data.has_more;
                } else if (page === 1) {
                    proveedorResults.append('<div class="autocomplete-no-result">No se encontraron resultados</div>');
                    hasMore = false;
                }
                proveedorResults.show();
                isLoading = false;
            },
            error: function() {
                console.error("Error en la petición de proveedores.");
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
    var debouncedFetchProveedores = debounce(function() {
        currentPage = 1;
        currentTerm = proveedorInput.val().trim();
        fetchProveedores(currentTerm, currentPage);
    }, 300);

    proveedorInput.on('input', function() {
        proveedorIdInput.val('');
        hasMore = true;
        debouncedFetchProveedores();
    });

    // Al hacer focus, se muestra el autocomplete incluso si el campo está vacío
    proveedorInput.on('focus', function() {
        currentTerm = proveedorInput.val().trim();
        currentPage = 1;
        fetchProveedores(currentTerm, currentPage);
    });

    proveedorResults.on('click', '.autocomplete-option', function() {
        var selectedText = $(this).text();
        var selectedId = $(this).data('id');
        proveedorInput.val(selectedText);
        proveedorIdInput.val(selectedId);
        proveedorResults.hide();
        $('#proveedorForm').submit();
    });

    $(document).on('click', function(e) {
        if (!$(e.target).closest('#id_proveedor_autocomplete, #proveedor-autocomplete-results').length) {
            proveedorResults.hide();
        }
    });

    proveedorResults.on('scroll', function() {
        if (proveedorResults.scrollTop() + proveedorResults.innerHeight() >= proveedorResults[0].scrollHeight - 5) {
            if (hasMore && !isLoading) {
                currentPage++;
                fetchProveedores(currentTerm, currentPage);
            }
        }
    });
});
