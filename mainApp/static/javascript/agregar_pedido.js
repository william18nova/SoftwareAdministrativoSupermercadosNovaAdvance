$(document).ready(function() {
  "use strict";

  // Inicializar DatePicker (evita fechas anteriores)
  $("#id_fechaestimadaentrega").datepicker({
    minDate: 0,
    dateFormat: "dd/mm/yy"
  });

  // Inicializar DataTable sin barra de búsqueda interna
  const dataTable = $('#detalle-productos').DataTable({
    paging: false,
    info: false,
    searching: true, // Usamos la API de búsqueda externa
    dom: 't',
    language: { emptyTable: "" }
  });

  // Array para almacenar detalles y variable para precio unitario seleccionado
  let detalles = [];
  window.selectedProductPrice = 0;

  // Función para actualizar la tabla y total aproximado
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
    $('#id_detalles').val(JSON.stringify(detalles));
    $('#total-valor').text(new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(total));
  }

  // Agregar producto al pedido
  $('#agregarProductoPedido').on('click', function() {
    const prodId = $('#producto_id').val().trim();
    const prodName = $('#producto_autocomplete').val().trim();
    const cantidad = parseInt($('#cantidad').val(), 10);
    const precioUnit = window.selectedProductPrice || 0;
    if (!prodId) {
      $("#error-message").text("Debe seleccionar un producto.").show();
      return;
    }
    if (isNaN(cantidad) || cantidad < 1) {
      $("#error-message").text("Ingrese una cantidad válida.").show();
      return;
    }
    $("#error-message").hide().text("");

    const prodIdNum = parseInt(prodId, 10);
    const existente = detalles.find(item => item.productoid === prodIdNum);
    if (existente) {
      existente.cantidad += cantidad;
      existente.subtotal = existente.cantidad * existente.precio_unitario;
    } else {
      detalles.push({
        productoid: prodIdNum,
        producto: prodName,
        cantidad: cantidad,
        precio_unitario: precioUnit,
        subtotal: precioUnit * cantidad
      });
    }
    actualizarTabla();
    $('#producto_autocomplete').val('');
    $('#producto_id').val('');
    $('#cantidad').val('1');
    window.selectedProductPrice = 0;
  });

  // Eliminar producto del pedido
  $('#detalle-productos').on('click', '.btn-eliminar', function() {
    const prodId = parseInt($(this).data('id'), 10);
    detalles = detalles.filter(item => item.productoid !== prodId);
    actualizarTabla();
  });

  // Barra de búsqueda externa para filtrar la tabla
  $('#buscador-detalles').on('keyup', function() {
    dataTable.search(this.value).draw();
  });

  // Enviar formulario por AJAX
  $('#pedidoForm').on('submit', function(e) {
    e.preventDefault();
    $("#success-message, #error-message").hide().text("");
    if (detalles.length === 0) {
      $("#error-message").text("Debe agregar al menos un producto al pedido.").show();
      return;
    }
    $('#id_detalles').val(JSON.stringify(detalles));
    $.ajax({
      url: $(this).attr("action"),
      method: "POST",
      data: $(this).serialize(),
      dataType: "json",
      success: function(data) {
        if (data.success) {
          $("#success-message").text(data.message || "Pedido guardado exitosamente.").show();
          detalles = [];
          actualizarTabla();
          $('#pedidoForm')[0].reset();
          $("#id_fechaestimadaentrega").datepicker("setDate", null);
        } else {
          if (data.errors) {
            let msg = "Error al guardar el pedido:\n\n";
            for (let field in data.errors) {
              data.errors[field].forEach(err => {
                msg += `- ${err.message}\n`;
              });
            }
            $("#error-message").text(msg).show();
          } else {
            $("#error-message").text(data.message || "Error desconocido al guardar el pedido.").show();
          }
        }
      },
      error: function() {
        $("#error-message").text("Ocurrió un error al conectar con el servidor.").show();
      }
    });
  });

  // Advertencia: Si se cambia de proveedor, verificar productos incompatibles
  $("#id_proveedor_autocomplete").on("blur", function() {
    if (detalles.length > 0) {
      const newProvId = $("#id_proveedor").val();
      if (!newProvId) return;
      $.ajax({
        url: productoPedidoAutocompleteUrl,
        method: "GET",
        data: { proveedor_id: newProvId, term: "" },
        success: function(data) {
          const newProvIds = data.results.map(r => parseInt(r.id, 10));
          let notBelonging = detalles.filter(d => !newProvIds.includes(d.productoid)).map(d => d.producto);
          if (notBelonging.length > 0) {
            $("#error-message").text(
              "El nuevo proveedor NO vende los siguientes productos:\n" +
              notBelonging.join(", ") +
              "\nPor favor, revise su lista."
            ).show();
          }
        }
      });
    }
  });

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
          response(data.results.map(item => ({ label: item.text, value: item.text, id: item.id })));
        }
      });
    },
    select: function(event, ui) {
      $("#id_proveedor_autocomplete").val(ui.item.label);
      $("#id_proveedor").val(ui.item.id);
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
          response(data.results.map(item => ({ label: item.text, value: item.text, id: item.id })));
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
        data: { term: request.term, proveedor_id: $("#id_proveedor").val() },
        success: function(data) {
          response(data.results.map(item => ({
            label: item.text,
            value: item.text,
            id: item.id,
            precio: item.precio || 0
          })));
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
