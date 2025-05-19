/* static/javascript/visualizar_pedidos.js */
$(document).ready(function () {
  "use strict";

  /* ───────────────  MOSTRAR / OCULTAR ALERTA DE ÉXITO  ─────────────── */
  if ($("#success-message").is(":visible")) {
    // El template la dejó visible (just_updated=True)
    setTimeout(() => $("#success-message").fadeOut(), 3000);
  }

  /* ───────────────  DATA-TABLE + BUSCADOR EXTERNO  ─────────────── */
  const table = $("#pedidos-table").DataTable({
    paging: false,
    info: false,
    searching: true,
    dom: "t",
    language: { emptyTable: "" },
  });

  $("#buscador-pedidos").on("keyup", function () {
    table.search(this.value).draw();
  });

  /* ───────────────  CSRF HELPER  ─────────────── */
  function getCookie(name) {
    let cv = null;
    if (document.cookie && document.cookie !== "") {
      document.cookie.split(";").forEach((c) => {
        c = c.trim();
        if (c.substring(0, name.length + 1) === name + "=") {
          cv = decodeURIComponent(c.substring(name.length + 1));
        }
      });
    }
    return cv;
  }
  const csrftoken = getCookie("csrftoken");

  /* ───────────────  FLASH DE MENSAJES  ─────────────── */
  function flash(msg, isError = false) {
    $("#success-message, #error-message").hide();
    const $el = isError ? $("#error-message") : $("#success-message");
    $el.text(msg).fadeIn();
    setTimeout(() => $el.fadeOut(), 3000);
  }

  /* ───────────────  ELIMINAR  ─────────────── */
  $("#pedidos-table").on("click", ".btn-eliminar-pedido", function (e) {
    e.stopPropagation();
    const id = $(this).data("id");
    if (!confirm("¿Está seguro de eliminar este pedido?")) return;

    $.post({
      url: eliminarPedidoUrl.replace("0", id),
      headers: { "X-CSRFToken": csrftoken },
      success: (data) => {
        if (data.success) {
          table.row($(`tr[data-id="${id}"]`)).remove().draw();
          flash("Pedido eliminado exitosamente.");
        } else flash(data.message || "Error al eliminar.", true);
      },
      error: () => flash("Error al eliminar.", true),
    });
  });

  /* ───────────────  IGNORAR PROPAGACIÓN EN EDITAR  ─────────────── */
  $("#pedidos-table").on("click", ".btn-editar-pedido", (e) => e.stopPropagation());

  /* ───────────────  DETALLE (clic de fila)  ─────────────── */
  $("#pedidos-table tbody").on("click", "tr", function (e) {
    if ($(e.target).closest(".btn-eliminar-pedido,.btn-editar-pedido").length) return;
    const id = $(this).data("id");
    window.location.href = verPedidoUrl.replace("0", id);
  });
});
