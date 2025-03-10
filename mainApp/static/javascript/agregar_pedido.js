$(document).ready(function() {
    "use strict";
  
    // CSRF Token & Ajax Setup
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
    const csrftoken = getCookie("csrftoken");
    $.ajaxSetup({
      beforeSend: function(xhr, settings) {
        if (!(/^GET|HEAD|OPTIONS|TRACE$/.test(settings.type)) && !this.crossDomain) {
          xhr.setRequestHeader("X-CSRFToken", csrftoken);
        }
      }
    });
  
    // Inicializar DataTable
    var dataTable = $('#productos-pedido').DataTable({
      paging: false,
      searching: false,
      info: false,
      responsive: true,
      language: {
        zeroRecords: "No se encontraron productos",
        emptyTable: "No hay productos agregados",
      }
    });
  
    // Array temporal para los detalles del pedido
    var detallesPedido = [];
  
    // Autocomplete para Proveedor
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
        return false;
      }
    }).on("focus", function() {
      $(this).autocomplete("search", "");
    });
  
    // Autocomplete para Producto
    $("#producto_autocomplete").autocomplete({
      delay: 100,
      minLength: 0,
      source: function(request, response) {
        $.ajax({
          url: productoAutocompleteUrl,
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
        $("#producto_autocomplete").val(ui.item.label);
        $("#producto_id").val(ui.item.id);
        return false;
      }
    }).on("focus", function() {
      $(this).autocomplete("search", "");
    });
  
    // Funciones para manejar errores
    function clearErrors() {
      $(".field-error").each(function() {
        $(this).html("").removeClass("visible").hide();
      });
      $("#error-message").html("").hide();
    }
  
    function showFieldError(field, message) {
      $("#error-id_" + field).html('<i class="fas fa-exclamation-circle"></i> ' + message).addClass("visible").show();
    }
  
    function showGlobalError(message) {
      $("#error-message").html('<i class="fas fa-exclamation-circle"></i> ' + message).show();
    }
  
    function showSuccess(message) {
      $("#success-message").html('<i class="fas fa-check-circle"></i> ' + message).show();
    }
  
    // Agregar producto al pedido
    $("#agregarProductoPedido").on("click", function() {
      clearErrors();
      var prodId = $("#producto_id").val().trim();
      var prodName = $("#producto_autocomplete").val().trim();
      var cantidad = parseInt($("#cantidad").val());
      // Para este ejemplo, asumiremos que el precio unitario se obtiene desde otro proceso; lo dejamos en 0
      var precioUnitario = 0;
  
      if (!prodId) {
        showFieldError("producto", "Debe seleccionar un producto.");
        return;
      }
      if (isNaN(cantidad) || cantidad < 1) {
        showFieldError("cantidad", "Ingrese una cantidad válida.");
        return;
      }
  
      // Si ya existe el producto, se suma la cantidad
      var existente = detallesPedido.find(item => item.productId === prodId);
      if (existente) {
        existente.cantidad += cantidad;
      } else {
        detallesPedido.push({
          productId: prodId,
          productName: prodName,
          cantidad: cantidad,
          preciounitario: precioUnitario
        });
      }
      actualizarTablaPedido();
      // Limpiar campos de producto
      $("#producto_autocomplete").val("");
      $("#producto_id").val("");
      $("#cantidad").val("1");
    });
  
    // Actualizar la tabla de pedido
    function actualizarTablaPedido() {
      dataTable.clear().draw();
      detallesPedido.forEach(function(item) {
        var subtotal = item.cantidad * item.preciounitario;
        dataTable.row.add([
          item.productName,
          item.cantidad,
          item.preciounitario.toFixed(2),
          subtotal.toFixed(2),
          `<button type="button" class="btn btn-danger btn-sm eliminar-producto" data-product-id="${item.productId}"><i class="fas fa-trash-alt"></i></button>`
        ]).draw(false);
      });
      $("#id_detalles").val(JSON.stringify(detallesPedido));
    }
  
    // Eliminar producto de la tabla
    $("#productos-pedido tbody").on("click", ".eliminar-producto", function() {
      var prodId = $(this).data("product-id");
      detallesPedido = detallesPedido.filter(item => item.productId !== prodId);
      actualizarTablaPedido();
    });
  
    // Submit del formulario de pedido
    $("#pedidoForm").on("submit", function(e) {
      e.preventDefault();
      clearErrors();
      if (detallesPedido.length === 0) {
        showGlobalError("Debe agregar al menos un producto al pedido.");
        return;
      }
      var formData = new FormData(this);
      fetch(this.action, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "X-CSRFToken": getCookie("csrftoken")
        },
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          showSuccess("Pedido guardado exitosamente.");
          $("#pedidoForm")[0].reset();
          detallesPedido = [];
          dataTable.clear().draw();
        } else {
          const errors = data.errors;
          for (let field in errors) {
            errors[field].forEach(err => {
              showFieldError(field, err.message);
            });
          }
        }
      })
      .catch(error => {
        console.error("Error:", error);
        showGlobalError("Ocurrió un error al guardar el pedido.");
      });
    });
  
    // Función para obtener cookie (ya definida antes)
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
  