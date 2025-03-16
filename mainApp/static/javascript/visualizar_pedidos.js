$(document).ready(function() {
    "use strict";
  
    // Inicializar DataTable sin la barra de búsqueda interna
    const table = $('#pedidos-table').DataTable({
      paging: false,
      info: false,
      searching: true,
      dom: 't',
      language: {
        emptyTable: ""
      }
    });
  
    // Búsqueda externa
    $('#buscador-pedidos').on('keyup', function() {
      table.search(this.value).draw();
    });
  
    // Obtener CSRF token
    function getCookie(name) {
      let cookieValue = null;
      if (document.cookie && document.cookie !== "") {
        const cookies = document.cookie.split(";");
        for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i].trim();
          if (cookie.substring(0, name.length + 1) === (name + '=')) {
            cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
            break;
          }
        }
      }
      return cookieValue;
    }
    const csrftoken = getCookie('csrftoken');
  
    // 1. Eliminar pedido (cuando se hace clic en el botón)
    $('#pedidos-table tbody').on('click', '.btn-eliminar-pedido', function(e) {
      e.stopPropagation(); // Evita que se dispare el click de la fila
      const pedidoId = $(this).data('id');
      const url = eliminarPedidoUrl.replace('0', pedidoId);
  
      if (!confirm("¿Está seguro de eliminar este pedido?")) {
        return;
      }
  
      $.ajax({
        url: url,
        type: 'POST',
        headers: { 'X-CSRFToken': csrftoken },
        success: function(data) {
          if (data.success) {
            // Eliminar la fila en DataTables
            table.row($('tr[data-id="' + pedidoId + '"]')).remove().draw();
            // Mostrar alerta de éxito
            $("#success-message").text("Pedido eliminado exitosamente.").fadeIn();
            setTimeout(() => {
              $("#success-message").fadeOut();
            }, 3000);
          } else {
            // Mostrar alerta de error
            $("#error-message").text(data.message || "Error al eliminar el pedido.").fadeIn();
            setTimeout(() => {
              $("#error-message").fadeOut();
            }, 3000);
          }
        },
        error: function() {
          // Mostrar alerta de error
          $("#error-message").text("Error al eliminar el pedido.").fadeIn();
          setTimeout(() => {
            $("#error-message").fadeOut();
          }, 3000);
        }
      });
    });
  
    // 2. Redirigir a la vista de detalle (cuando se hace clic en la fila, excepto en el botón eliminar)
    $('#pedidos-table tbody').on('click', 'tr', function(e) {
      // Verificamos si el click fue en el botón de eliminar (o su icono)
      if ($(e.target).closest('.btn-eliminar-pedido').length) {
        // Si fue el botón, ya se manejó arriba, no hacemos nada
        return;
      }
      const pedidoId = $(this).data('id');
      if (!pedidoId) return; // Por seguridad
  
      // Redirigir a la página de detalles
      const urlDetalle = verPedidoUrl.replace('0', pedidoId);
      window.location.href = urlDetalle;
    });
  });
  