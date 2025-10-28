// static/js/ver_venta.js
(function(){
  "use strict";

  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(^|;)\\s*' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[2]) : '';
  }

  const btn = document.getElementById("btn-imprimir-factura");
  if (!btn) return;

  const url = (window.imprimirFacturaUrl || "").trim();
  const ventaId = btn.getAttribute("data-venta-id");
  const csrftoken = getCookie("csrftoken");

  async function postPrint() {
    if (!url || !ventaId) {
      alert("No se pudo determinar la venta a imprimir.");
      return;
    }
    btn.disabled = true;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Imprimiendo...';

    try {
      const body = new URLSearchParams({ venta_id: String(ventaId) });
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "X-CSRFToken": csrftoken,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      });

      const data = await resp.json().catch(()=>({ success:false, error:"Respuesta inválida" }));
      if (!resp.ok || !data.success) {
        const msg = (data && data.error) ? data.error : "Error al imprimir.";
        alert("⚠️ " + msg);
      } else {
        alert("✅ Ticket enviado a la impresora (y gaveta abierta).");
      }
    } catch (e) {
      alert("⚠️ Error de red al imprimir.");
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }

  btn.addEventListener("click", postPrint);
})();
