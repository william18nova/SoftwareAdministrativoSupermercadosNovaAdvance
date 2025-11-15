// static/javascript/ver_venta.js
(function(){
  "use strict";

  const POS_AGENT_URL   = (window.POS_AGENT_URL || "http://127.0.0.1:8787").replace(/\/+$/,'');
  const POS_AGENT_TOKEN = (window.POS_AGENT_TOKEN || "").trim();

  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(^|;)\\s*' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[2]) : '';
  }
  const csrftoken = getCookie("csrftoken");

  const btn = document.getElementById("btn-imprimir-factura");
  if (!btn) return;

  const ventaId = btn.getAttribute("data-venta-id");
  const urlServerPrint = (window.imprimirFacturaUrl || "").trim(); // imprime en el servidor
  const urlTicketTexto = (window.ticketTextoUrl || "").trim();     // devuelve receipt_text

  async function agentPrintSafe(text, { timeout = 1000 } = {}) {
    if (!POS_AGENT_TOKEN) throw new Error("SIN_TOKEN");
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeout);
    try {
      await fetch(POS_AGENT_URL + "/print", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Pos-Agent-Token": POS_AGENT_TOKEN
        },
        body: JSON.stringify({ text }),
        signal: ctrl.signal
      });
    } finally {
      clearTimeout(to);
    }
  }

  async function agentKickSafe({ timeout = 800 } = {}) {
    if (!POS_AGENT_TOKEN) return;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeout);
    try {
      await fetch(POS_AGENT_URL + "/kick", {
        method: "POST",
        headers: { "X-Pos-Agent-Token": POS_AGENT_TOKEN },
        signal: ctrl.signal
      });
    } finally {
      clearTimeout(to);
    }
  }

  async function fetchTicketText() {
    if (!urlTicketTexto || !ventaId) throw new Error("NO_URL_TICKET");
    const body = new URLSearchParams({ venta_id: String(ventaId) });
    const resp = await fetch(urlTicketTexto, {
      method: "POST",
      headers: {
        "X-CSRFToken": csrftoken,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });
    const data = await resp.json().catch(()=>({ success:false }));
    if (!resp.ok || !data.success || !data.receipt_text) {
      throw new Error(data && data.error ? data.error : "Error obteniendo ticket");
    }
    return data.receipt_text;
  }

  async function serverFallbackPrint() {
    if (!urlServerPrint || !ventaId) throw new Error("NO_URL_PRINT");
    const body = new URLSearchParams({ venta_id: String(ventaId) });
    const resp = await fetch(urlServerPrint, {
      method: "POST",
      headers: {
        "X-CSRFToken": csrftoken,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });
    const data = await resp.json().catch(()=>({ success:false, error:"Respuesta inválida" }));
    if (!resp.ok || !data.success) {
      const msg = (data && data.error) ? data.error : "Error al imprimir (servidor).";
      throw new Error(msg);
    }
  }

  async function postPrint() {
    if (!ventaId) {
      alert("No se pudo determinar la venta a imprimir.");
      return;
    }
    btn.disabled = true;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Imprimiendo...';

    try {
      // 1) Intento POS Agent (rápido/local)
      if (POS_AGENT_TOKEN && urlTicketTexto) {
        const text = await fetchTicketText();
        await agentPrintSafe(text, { timeout: 1000 });
        await agentKickSafe({ timeout: 800 });
        alert("✅ Ticket enviado al POS Agent (y gaveta abierta).");
        return;
      }

      // 2) Fallback: impresión en servidor
      await serverFallbackPrint();
      alert("✅ Ticket enviado a la impresora (servidor) y gaveta abierta.");
    } catch (e) {
      // Si falló Agent, caemos a servidor una vez
      try {
        await serverFallbackPrint();
        alert("✅ Ticket enviado a la impresora (servidor) y gaveta abierta.");
      } catch (e2) {
        alert("⚠️ No se pudo imprimir. " + (e2 && e2.message ? e2.message : ""));
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }

  btn.addEventListener("click", postPrint);
})();
