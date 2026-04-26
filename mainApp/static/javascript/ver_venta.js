(function () {
  "use strict";

  function parseMoney(v) {
    const s = String(v ?? "").trim().replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  function to2(n) { return (Math.round(n * 100) / 100).toFixed(2); }

  const form = document.getElementById("venta-form");
  const selectMedio = document.getElementById("id_mediopago");

  const bloquePagos = document.getElementById("bloque-mixto-pagos");
  const bloqueReint = document.getElementById("bloque-mixto-reintegro");

  const totalVentaEl = document.getElementById("mixto-total-venta");
  const sumaPagosEl = document.getElementById("mixto-suma-pagos");
  const errPagosEl = document.getElementById("mixto-error-pagos");

  const reintTotalEl = document.getElementById("reintegro-total");
  const reintSumaEl = document.getElementById("reintegro-suma");
  const errReintEl = document.getElementById("mixto-error-reintegro");

  function esMixto() {
    return ((selectMedio?.value || "").trim().toLowerCase() === "mixto");
  }

  function sumInputsWithin(container) {
    if (!container) return 0;
    const inputs = container.querySelectorAll("input[name$='-monto']");
    let s = 0;
    inputs.forEach(i => s += parseMoney(i.value));
    return Math.max(0, s);
  }

  function calcTotalDevolucion() {
    const rows = document.querySelectorAll("#tabla-detalles tbody tr");
    let total = 0;

    rows.forEach(tr => {
      const precio = parseMoney(tr.getAttribute("data-precio"));
      const inputDev = tr.querySelector("input[name^='dev-'][name$='-devolver']");
      const cant = inputDev ? parseInt(inputDev.value || "0", 10) : 0;
      if (cant > 0) total += cant * precio;
    });

    return Math.max(0, total);
  }

  function setReintegroInputsEnabled(enabled) {
    if (!bloqueReint) return;
    const inputs = bloqueReint.querySelectorAll("input[name$='-monto']");
    inputs.forEach(i => {
      i.disabled = !enabled;
      if (!enabled) i.value = "";
    });
  }

  function validateUI() {
    const mixto = esMixto();

    if (bloquePagos) bloquePagos.style.display = mixto ? "" : "none";
    // bloqueReint se muestra solo si mixto y hay devolución
    if (!mixto) {
      if (bloqueReint) bloqueReint.style.display = "none";
      return;
    }

    const totalVenta = parseMoney(window.VENTA_TOTAL || (totalVentaEl ? totalVentaEl.textContent : "0"));
    if (totalVentaEl) totalVentaEl.textContent = to2(totalVenta);

    const sumaPagos = sumInputsWithin(bloquePagos);
    if (sumaPagosEl) sumaPagosEl.textContent = to2(sumaPagos);

    if (errPagosEl) {
      if (Math.abs(sumaPagos - totalVenta) > 0.009) {
        errPagosEl.style.display = "";
        errPagosEl.textContent = `La suma de pagos (${to2(sumaPagos)}) debe ser igual al total (${to2(totalVenta)}).`;
      } else {
        errPagosEl.style.display = "none";
        errPagosEl.textContent = "";
      }
    }

    const totalDev = calcTotalDevolucion();
    if (reintTotalEl) reintTotalEl.textContent = to2(totalDev);

    if (totalDev > 0) {
      if (bloqueReint) bloqueReint.style.display = "";
      setReintegroInputsEnabled(true);
    } else {
      if (bloqueReint) bloqueReint.style.display = "none";
      setReintegroInputsEnabled(false);
    }

    const sumaReint = sumInputsWithin(bloqueReint);
    if (reintSumaEl) reintSumaEl.textContent = to2(sumaReint);

    if (errReintEl) {
      if (totalDev > 0 && Math.abs(sumaReint - totalDev) > 0.009) {
        errReintEl.style.display = "";
        errReintEl.textContent = `La suma (${to2(sumaReint)}) debe ser igual al total a devolver (${to2(totalDev)}).`;
      } else {
        errReintEl.style.display = "none";
        errReintEl.textContent = "";
      }
    }
  }

  selectMedio?.addEventListener("change", validateUI);

  document.addEventListener("input", (e) => {
    const t = e.target;
    if (!t) return;

    if (t.matches("input[name^='dev-'][name$='-devolver']")) validateUI();
    if (t.matches("input[name$='-monto']")) validateUI();
  });

  form?.addEventListener("submit", (e) => {
    if (!esMixto()) return;

    const totalVenta = parseMoney(window.VENTA_TOTAL || "0");
    const sumaPagos = sumInputsWithin(bloquePagos);

    if (Math.abs(sumaPagos - totalVenta) > 0.009) {
      e.preventDefault();
      alert(`⚠️ La suma de pagos (${to2(sumaPagos)}) debe ser igual al total (${to2(totalVenta)}).`);
      return;
    }

    const totalDev = calcTotalDevolucion();
    if (totalDev > 0) {
      const sumaReint = sumInputsWithin(bloqueReint);
      if (Math.abs(sumaReint - totalDev) > 0.009) {
        e.preventDefault();
        alert(`⚠️ La suma de la devolución (${to2(sumaReint)}) debe ser igual al total a devolver (${to2(totalDev)}).`);
        return;
      }
    }
  });

  /* ================== CSRF helper ================== */
  function getCSRF() {
    const m = document.cookie.match(/csrftoken=([^;]+)/);
    return m ? m[1] : "";
  }

  /* ================== Agente local helpers (igual que generar_venta) ================== */
  async function agentPrintSafe(text, { timeout = 800 } = {}) {
    const POS_AGENT_URL   = (window.POS_AGENT_URL || "").trim();
    const POS_AGENT_TOKEN = (window.POS_AGENT_TOKEN || "").trim();
    if (!POS_AGENT_URL || !POS_AGENT_TOKEN) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      await fetch(POS_AGENT_URL + "/print", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Pos-Agent-Token": POS_AGENT_TOKEN },
        body: JSON.stringify({ text }),
        signal: ctrl.signal
      });
    } catch (_) {}
    finally { clearTimeout(t); }
  }

  async function agentKickSafe({ timeout = 600 } = {}) {
    const POS_AGENT_URL   = (window.POS_AGENT_URL || "").trim();
    const POS_AGENT_TOKEN = (window.POS_AGENT_TOKEN || "").trim();
    if (!POS_AGENT_URL || !POS_AGENT_TOKEN) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      await fetch(POS_AGENT_URL + "/kick", {
        method: "POST",
        headers: { "X-Pos-Agent-Token": POS_AGENT_TOKEN },
        signal: ctrl.signal
      });
    } catch (_) {}
    finally { clearTimeout(t); }
  }

  /* ================== Imprimir factura (mismo flujo que generar_venta) ================== */
  const btnImprimir = document.getElementById("btn-imprimir-factura");
  if (btnImprimir) {
    btnImprimir.addEventListener("click", async function (e) {
      e.preventDefault();

      const ventaId = btnImprimir.getAttribute("data-venta-id");
      if (!ventaId) { alert("Venta inválida."); return; }

      const ticketUrl = window.ticketTextoUrl;
      if (!ticketUrl) { alert("URL de ticket no configurada."); return; }

      // Evitar doble clic
      btnImprimir.disabled = true;
      const originalHtml = btnImprimir.innerHTML;
      btnImprimir.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Generando ticket...';

      try {
        const fd = new URLSearchParams();
        fd.append("venta_id", ventaId);

        const resp = await fetch(ticketUrl, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-CSRFToken": getCSRF(),
            "X-Requested-With": "XMLHttpRequest"
          },
          body: fd
        });

        if (!resp.ok) throw new Error("HTTP " + resp.status);
        const data = await resp.json();

        if (!data || !data.success) {
          alert((data && data.error) || "No fue posible generar el ticket.");
          return;
        }

        const omitirImpresion = confirm(
          [
            "🧾 Listo para imprimir la factura.",
            "",
            "¿Desea OMITIR la impresión de la factura?",
            "— Aceptar: NO imprimir (solo abrir gaveta).",
            "— Cancelar: Imprimir (y abrir gaveta)."
          ].join("\n")
        );

        try {
          if (omitirImpresion) {
            await agentKickSafe({ timeout: 600 });
          } else {
            await agentPrintSafe(data.receipt_text || "Factura\n\n", { timeout: 800 });
            await agentKickSafe({ timeout: 600 });
          }
        } catch (_) {}
      } catch (err) {
        alert("Error al imprimir la factura: " + (err && err.message ? err.message : err));
      } finally {
        btnImprimir.disabled = false;
        btnImprimir.innerHTML = originalHtml;
      }
    });
  }

  // Init
  validateUI();
})();
