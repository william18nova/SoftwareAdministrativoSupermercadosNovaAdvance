$(document).ready(function() {
  "use strict";

  // Inicializar DatePicker de jQuery UI en el campo de fecha, evitando fechas pasadas
  $("#id_fechaestimadaentrega").datepicker({
    minDate: 0,
    dateFormat: "dd/mm/yy"
  });

  // 1) Inicializar DataTable SIN el mensaje por defecto cuando no hay datos
  //    y SIN la barra "Search:" interna.
  const dataTable = $('#detalle-productos').DataTable({
    paging: false,
    info: false,
    searching: true,  // Para usar la API de búsqueda, pero sin la barra nativa
    dom: 't',         // Solo la tabla
    language: {
      emptyTable: ""  // No mostrar texto cuando está vacía
    }
  });

  // 2) Array para almacenar los detalles
  let detalles = [];

  // 3) Variable global para almacenar el precio unitario del producto seleccionado
  window.selectedProductPrice = 0;

  // 4) Función para recalcular y mostrar la tabla + total
  function actualizarTabla() {
    dataTable.clear();

    let total = 0;
    detalles.forEach(det => {
      total += det.subtotal;
      dataTable.row.add([
        det.producto,
        det.cantidad,
        det.precio_unitario.toFixed(2),
        det.subtotal.toFixed(2),
        `<button type="button" class="btn-eliminar" data-id="${det.productoid}">
           <i class="fas fa-trash-alt"></i>
         </button>`
      ]);
    });

    dataTable.draw();
    // Actualizar el input hidden con JSON
    $('#id_detalles').val(JSON.stringify(detalles));

    // Mostrar total aproximado
    $('#total-valor').text(
      new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(total)
    );
  }

  // 5) Agregar producto al pedido
  $('#agregarProductoPedido').on('click', function() {
    const prodId     = $('#producto_id').val().trim();
    const prodName   = $('#producto_autocomplete').val().trim();
    const cantidad   = parseInt($('#cantidad').val());
    const precioUnit = window.selectedProductPrice || 0;

    if (!prodId) {
      alert("Debe seleccionar un producto.");
      return;
    }
    if (isNaN(cantidad) || cantidad < 1) {
      alert("Ingrese una cantidad válida.");
      return;
    }

    // Convertir a entero si viene como string
    const prodIdNum = parseInt(prodId, 10);

    // Verificar si ya existe en 'detalles'
    const existente = detalles.find(item => item.productoid === prodIdNum);
    if (existente) {
      // Sumar cantidad
      existente.cantidad += cantidad;
      existente.subtotal = existente.cantidad * existente.precio_unitario;
    } else {
      detalles.push({
        productoid:      prodIdNum,           // guardarlo como número
        producto:        prodName,
        cantidad:        cantidad,
        precio_unitario: precioUnit,
        subtotal:        precioUnit * cantidad
      });
    }

    // Actualizar tabla
    actualizarTabla();

    // Limpiar campos
    $('#producto_autocomplete').val('');
    $('#producto_id').val('');
    $('#cantidad').val('1');
    window.selectedProductPrice = 0;
  });

  // 6) Eliminar producto de la lista
  $('#detalle-productos').on('click', '.btn-eliminar', function() {
    // Convertir a entero el data-id
    const prodId = parseInt($(this).data('id'), 10);
    // Filtrar y quitar
    detalles = detalles.filter(item => item.productoid !== prodId);
    actualizarTabla();
  });

  // 7) Barra de búsqueda EXTERNA
  $('#buscador-detalles').on('keyup', function() {
    dataTable.search(this.value).draw();
  });

  // 8) Al enviar formulario, verificar que haya productos
  //    y enviar por AJAX en vez de un submit normal
  $('#pedidoForm').on('submit', function(e) {
    e.preventDefault();

    // Limpiar mensajes previos
    $("#success-message").hide().text("");
    $("#error-message").hide().text("");

    if (detalles.length === 0) {
      alert("Debe agregar al menos un producto al pedido.");
      return;
    }
    $('#id_detalles').val(JSON.stringify(detalles));

    // Enviar por AJAX
    $.ajax({
      url: $(this).attr("action"),
      method: "POST",
      data: $(this).serialize(),  // Enviar todos los campos del form
      dataType: "json",
      success: function(data) {
        if (data.success) {
          // Mostrar mensaje de éxito en #success-message
          $("#success-message").text(data.message || "Pedido guardado exitosamente.").show();
          // Opcional: reiniciar la tabla y el formulario
          detalles = [];
          actualizarTabla();
          $('#pedidoForm')[0].reset();
        } else {
          // Mostrar errores
          if (data.errors) {
            // data.errors puede ser un objeto con los campos y sus mensajes
            // Ejemplo: { "fechaestimadaentrega": [{"message": "Enter a valid date.", "code": "invalid"}], ... }
            let msg = "Error al guardar el pedido:\n\n";
            for (let field in data.errors) {
              data.errors[field].forEach(err => {
                msg += `- ${err.message}\n`;
              });
            }
            $("#error-message").text(msg).show();
          } else {
            // Si no hay 'errors' pero success=false
            $("#error-message").text(data.message || "Error desconocido al guardar el pedido.").show();
          }
        }
      },
      error: function() {
        $("#error-message").text("Ocurrió un error al conectar con el servidor.").show();
      }
    });
  });

  // ---------------------------------------
  // FUNCIONES DE AUTOCOMPLETE
  // ---------------------------------------

  // Autocomplete de Proveedor
  $("#id_proveedor_autocomplete").autocomplete({
    delay: 100,
    minLength: 0,
    source: function(request, response) {
      $.ajax({
        url: proveedorAutocompleteUrl,
        method: "GET",
        data: { term: request.term },
        success: function(data) {
          response(data.results.map(function(item) {
            return { label: item.text, value: item.text, id: item.id };
          }));
        }
      });
    },
    select: function(event, ui) {
      $("#id_proveedor_autocomplete").val(ui.item.label);
      $("#id_proveedor").val(ui.item.id);

      // Si ya hay productos en 'detalles', verificar cuáles no pertenecen al nuevo proveedor
      if (detalles.length > 0) {
        $.ajax({
          url: productoPedidoAutocompleteUrl,
          method: "GET",
          data: {
            proveedor_id: ui.item.id,
            term: ""  // para obtener TODOS los productos del nuevo proveedor
          },
          success: function(data) {
            // data.results es un array de {id, text, precio...}
            const newProvIds = data.results.map(r => parseInt(r.id, 10));
            let notBelonging = [];

            detalles.forEach(d => {
              if (!newProvIds.includes(d.productoid)) {
                notBelonging.push(d.producto);
              }
            });

            if (notBelonging.length > 0) {
              alert(
                "El nuevo proveedor NO vende los siguientes productos que ya están en tu pedido:\n\n" +
                notBelonging.join(", ") +
                "\n\nPor favor, revisa tu lista si deseas continuar."
              );
            }
          }
        });
      }

      return false;
    }
  }).on("focus", function() {
    $(this).autocomplete("search", "");
  });

  // Autocomplete de Sucursal
  $("#id_sucursal_autocomplete").autocomplete({
    delay: 100,
    minLength: 0,
    source: function(request, response) {
      $.ajax({
        url: sucursalAutocompleteUrl,
        method: "GET",
        data: { term: request.term },
        success: function(data) {
          response(data.results.map(function(item) {
            return { label: item.text, value: item.text, id: item.id };
          }));
        }
      });
    },
    select: function(event, ui) {
      $("#id_sucursal_autocomplete").val(ui.item.label);
      $("#id_sucursal").val(ui.item.id);
      return false;
    }
  }).on("focus", function() {
    $(this).autocomplete("search", "");
  });

  // Autocomplete de Producto
  $("#producto_autocomplete").autocomplete({
    delay: 100,
    minLength: 0,
    source: function(request, response) {
      $.ajax({
        url: productoPedidoAutocompleteUrl,
        method: "GET",
        data: {
          term: request.term,
          proveedor_id: $("#id_proveedor").val() // para filtrar según el proveedor
        },
        success: function(data) {
          response(data.results.map(function(item) {
            return {
              label:  item.text,
              value:  item.text,
              id:     item.id,
              precio: item.precio || 0
            };
          }));
        }
      });
    },
    select: function(event, ui) {
      $("#producto_autocomplete").val(ui.item.label);
      $("#producto_id").val(ui.item.id);
      window.selectedProductPrice = parseFloat(ui.item.precio) || 0;
      return false;
    }
  }).on("focus", function() {
    $(this).autocomplete("search", "");
  });
});