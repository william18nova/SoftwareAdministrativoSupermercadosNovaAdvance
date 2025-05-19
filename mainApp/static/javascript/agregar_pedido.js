/* static/javascript/agregar_pedido.js */
$(document).ready(function () {
  "use strict";

  /* ────────────────────  FUNCIÓN CENTRAL DE ALERTAS  ──────────────────── */
  /**
   * Muestra un único mensaje de éxito o error.
   * @param {"success"|"error"} type  Tipo de alerta a mostrar.
   * @param {string} message          Texto que se mostrará en la alerta.
   */
  function showAlert(type, message) {
    // Oculta y limpia ambos contenedores antes de mostrar el nuevo mensaje
    $("#success-message, #error-message").hide().text("");
    if (type === "success") {
      $("#success-message").text(message).show();
    } else {
      $("#error-message").text(message).show();
    }
  }
  /* ────────────────────────────────────────────────────────────────────── */

  /* ---------- DatePicker (bloquea fechas pasadas) ---------- */
  $("#id_fechaestimadaentrega").datepicker({
    minDate: 0,
    dateFormat: "dd/mm/yy",
  });

  /* ---------- DataTable sin barra de búsqueda interna ---------- */
  const dataTable = $("#detalle-productos").DataTable({
    paging: false,
    info: false,
    searching: true, // buscador externo
    dom: "t",
    language: { emptyTable: "" },
  });

  let detalles = [];
  window.selectedProductPrice = 0;

  /* ---------- Refrescar tabla y total ---------- */
  function actualizarTabla() {
    dataTable.clear();
    let total = 0;

    detalles.forEach((det) => {
      total += det.subtotal;
      dataTable.row.add([
        det.producto,
        det.cantidad,
        det.precio_unitario.toFixed(2),
        det.subtotal.toFixed(2),
        `<button type="button" class="btn-eliminar" data-id="${det.productoid}">
           <i class="fas fa-trash-alt"></i>
         </button>`,
      ]);
    });

    dataTable.draw();
    $("#id_detalles").val(JSON.stringify(detalles));
    $("#total-valor").text(
      new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
      }).format(total)
    );
  }

  /* ---------- Agregar producto al pedido ---------- */
  $("#agregarProductoPedido").on("click", function () {
    const prodId = $("#producto_id").val().trim();
    const prodName = $("#producto_autocomplete").val().trim();
    const cantidad = parseInt($("#cantidad").val(), 10);
    const precioUnit = window.selectedProductPrice || 0;

    if (!prodId) {
      showAlert("error", "Debe seleccionar un producto.");
      return;
    }
    if (isNaN(cantidad) || cantidad < 1) {
      showAlert("error", "Ingrese una cantidad válida.");
      return;
    }

    const prodIdNum = parseInt(prodId, 10);
    const existente = detalles.find((item) => item.productoid === prodIdNum);

    if (existente) {
      existente.cantidad += cantidad;
      existente.subtotal = existente.cantidad * existente.precio_unitario;
    } else {
      detalles.push({
        productoid: prodIdNum,
        producto: prodName,
        cantidad: cantidad,
        precio_unitario: precioUnit,
        subtotal: precioUnit * cantidad,
      });
    }

    actualizarTabla();
    $("#producto_autocomplete").val("");
    $("#producto_id").val("");
    $("#cantidad").val("1");
    window.selectedProductPrice = 0;
  });

  /* ---------- Eliminar producto ---------- */
  $("#detalle-productos").on("click", ".btn-eliminar", function () {
    const prodId = parseInt($(this).data("id"), 10);
    detalles = detalles.filter((item) => item.productoid !== prodId);
    actualizarTabla();
  });

  /* ---------- Filtrar tabla desde el buscador externo ---------- */
  $("#buscador-detalles").on("keyup", function () {
    dataTable.search(this.value).draw();
  });

  /* ---------- Enviar formulario ---------- */
  $("#pedidoForm").on("submit", function (e) {
    e.preventDefault();

    if (detalles.length === 0) {
      showAlert("error", "Debe agregar al menos un producto al pedido.");
      return;
    }

    $("#id_detalles").val(JSON.stringify(detalles));

    $.ajax({
      url: $(this).attr("action"),
      method: "POST",
      data: $(this).serialize(),
      dataType: "json",
      success: function (data) {
        if (data.success) {
          showAlert("success", data.message || "Pedido guardado exitosamente.");
          detalles = [];
          actualizarTabla();
          $("#pedidoForm")[0].reset();
          $("#id_fechaestimadaentrega").datepicker("setDate", null);
        } else if (data.errors) {
          let msg = "Error al guardar el pedido:\n\n";
          for (const field in data.errors) {
            data.errors[field].forEach((err) => {
              msg += `- ${err.message}\n`;
            });
          }
          showAlert("error", msg);
        } else {
          showAlert(
            "error",
            data.message || "Error desconocido al guardar el pedido."
          );
        }
      },
      error: function () {
        showAlert("error", "Ocurrió un error al conectar con el servidor.");
      },
    });
  });

  /* ---------- Advertencia al cambiar de proveedor ---------- */
  $("#id_proveedor_autocomplete").on("blur", function () {
    if (detalles.length === 0) return;

    const newProvId = $("#id_proveedor").val();
    if (!newProvId) return;

    $.ajax({
      url: productoPedidoAutocompleteUrl,
      method: "GET",
      data: { proveedor_id: newProvId, term: "" },
      success: function (data) {
        const nuevosIds = data.results.map((r) => parseInt(r.id, 10));
        const noPertenecen = detalles
          .filter((d) => !nuevosIds.includes(d.productoid))
          .map((d) => d.producto);

        if (noPertenecen.length > 0) {
          showAlert(
            "error",
            "El nuevo proveedor NO vende los siguientes productos:\n" +
              noPertenecen.join(", ") +
              "\nPor favor, revise su lista."
          );
        }
      },
    });
  });

  /* ---------- Autocomplete Proveedor ---------- */
  $("#id_proveedor_autocomplete")
    .autocomplete({
      delay: 100,
      minLength: 0,
      source: function (request, response) {
        $.ajax({
          url: proveedorAutocompleteUrl,
          method: "GET",
          data: { term: request.term },
          success: function (data) {
            response(
              data.results.map((item) => ({
                label: item.text,
                value: item.text,
                id: item.id,
              }))
            );
          },
        });
      },
      select: function (event, ui) {
        $("#id_proveedor_autocomplete").val(ui.item.label);
        $("#id_proveedor").val(ui.item.id);
        return false;
      },
    })
    .on("focus", function () {
      $(this).autocomplete("search", "");
    });

  /* ---------- Autocomplete Sucursal ---------- */
  $("#id_sucursal_autocomplete")
    .autocomplete({
      delay: 100,
      minLength: 0,
      source: function (request, response) {
        $.ajax({
          url: sucursalAutocompleteUrl,
          method: "GET",
          data: { term: request.term },
          success: function (data) {
            response(
              data.results.map((item) => ({
                label: item.text,
                value: item.text,
                id: item.id,
              }))
            );
          },
        });
      },
      select: function (event, ui) {
        $("#id_sucursal_autocomplete").val(ui.item.label);
        $("#id_sucursal").val(ui.item.id);
        return false;
      },
    })
    .on("focus", function () {
      $(this).autocomplete("search", "");
    });

  /* ---------- Autocomplete Producto ---------- */
  $("#producto_autocomplete")
    .autocomplete({
      delay: 100,
      minLength: 0,
      source: function (request, response) {
        $.ajax({
          url: productoPedidoAutocompleteUrl,
          method: "GET",
          data: {
            term: request.term,
            proveedor_id: $("#id_proveedor").val(),
          },
          success: function (data) {
            response(
              data.results.map((item) => ({
                label: item.text,
                value: item.text,
                id: item.id,
                precio: item.precio || 0,
              }))
            );
          },
        });
      },
      select: function (event, ui) {
        $("#producto_autocomplete").val(ui.item.label);
        $("#producto_id").val(ui.item.id);
        window.selectedProductPrice = parseFloat(ui.item.precio) || 0;
        return false;
      },
    })
    .on("focus", function () {
      $(this).autocomplete("search", "");
    });
});
