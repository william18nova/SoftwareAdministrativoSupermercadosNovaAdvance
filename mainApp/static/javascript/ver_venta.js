(function () {
  "use strict";

  /* =========================
     Helpers
     ========================= */
  function parseMoney(v) {
    const s = String(v ?? "").trim().replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  function to2(n) { return (Math.round(n * 100) / 100).toFixed(2); }

  function hydratePaymentMethodLabels() {
    const dataNode = document.getElementById("payment-method-labels-data");
    let labels = {};
    try {
      labels = JSON.parse(dataNode?.textContent || "{}") || {};
    } catch (_) {
      labels = {};
    }

    document.querySelectorAll("[data-payment-method-code]").forEach((element) => {
      const code = String(element.dataset.paymentMethodCode || "").trim().toLowerCase();
      const label = String(labels[code] || "").trim();
      if (!label) return;

      if (element instanceof HTMLInputElement) {
        element.value = label;
      } else {
        element.textContent = label;
      }
    });
  }

  hydratePaymentMethodLabels();

  function getCSRFToken() {
    return document.querySelector("input[name='csrfmiddlewaretoken']")?.value || "";
  }

  /* =========================
     DOM
     ========================= */
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

  const btnPrint = document.getElementById("btn-imprimir-factura");
  const reintegroLedgerReady = window.REINTEGRO_LEDGER_READY !== false;

  /* =========================
     Mixto UI
     ========================= */
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
    const totalVenta = parseMoney(window.VENTA_TOTAL || (totalVentaEl ? totalVentaEl.textContent : "0"));
    let subtotalActual = 0;
    let totalBruto = 0;

    rows.forEach(tr => {
      const precio = parseMoney(tr.getAttribute("data-precio"));
      const cantidadActual = parseInt(tr.getAttribute("data-cantidad") || "0", 10);
      const inputDev = tr.querySelector("input[name^='dev-'][name$='-devolver']");
      const cant = inputDev ? parseInt(inputDev.value || "0", 10) : 0;
      if (cantidadActual > 0) subtotalActual += cantidadActual * precio;
      if (cant > 0) totalBruto += cant * precio;
    });

    let total = totalBruto;
    if (subtotalActual > 0 && totalVenta >= 0 && totalVenta < subtotalActual) {
      total = totalBruto * (totalVenta / subtotalActual);
    }

    return Math.min(Math.max(0, total), Math.max(0, totalVenta));
  }

  function setReintegroInputsEnabled(enabled) {
    if (!bloqueReint) return;
    const inputs = bloqueReint.querySelectorAll("input[name$='-monto']");
    inputs.forEach(i => {
      i.disabled = !enabled;
      if (!enabled) i.value = "";
    });
    bloqueReint.querySelectorAll(".reintegro-todo").forEach((button) => {
      button.disabled = !enabled;
    });
  }

  function refundRows() {
    if (!bloqueReint) return [];
    return Array.from(bloqueReint.querySelectorAll(".mixto-row")).map((row) => ({
      medio: (row.querySelector("input[name$='-medio_pago']")?.value || "").trim().toLowerCase(),
      monto: row.querySelector("input[name$='-monto']"),
    })).filter((row) => row.monto);
  }

  function applyDefaultCashRefund(totalDev, previousTotalDev) {
    if (totalDev <= 0) return;

    const rows = refundRows();
    const cash = rows.find((row) => row.medio === "efectivo");
    if (!cash) return;

    const currentCash = parseMoney(cash.monto.value);
    const nonCashTotal = rows
      .filter((row) => row.medio !== "efectivo")
      .reduce((sum, row) => sum + parseMoney(row.monto.value), 0);
    const currentTotal = currentCash + nonCashTotal;

    const isEmpty = currentTotal < 0.009;
    const wasAllCashForPreviousTotal = (
      previousTotalDev > 0 &&
      nonCashTotal < 0.009 &&
      Math.abs(currentCash - previousTotalDev) < 0.009
    );

    if (!isEmpty && !wasAllCashForPreviousTotal) return;

    rows.forEach((row) => {
      row.monto.value = row.medio === "efectivo" ? to2(totalDev) : "0.00";
    });
  }

  function validateUI() {
    const mixto = esMixto();

    if (bloquePagos) bloquePagos.style.display = mixto ? "" : "none";

    if (mixto) {
      const totalCobrado = parseMoney(
        window.VENTA_TOTAL_COBRADO ||
        window.VENTA_TOTAL ||
        (totalVentaEl ? totalVentaEl.textContent : "0")
      );
      if (totalVentaEl) totalVentaEl.textContent = to2(totalCobrado);

      const sumaPagos = sumInputsWithin(bloquePagos);
      if (sumaPagosEl) sumaPagosEl.textContent = to2(sumaPagos);

      if (errPagosEl) {
        if (Math.abs(sumaPagos - totalCobrado) > 0.009) {
          errPagosEl.style.display = "";
          errPagosEl.textContent = `La suma de pagos (${to2(sumaPagos)}) debe ser igual al total originalmente pagado (${to2(totalCobrado)}).`;
        } else {
          errPagosEl.style.display = "none";
          errPagosEl.textContent = "";
        }
      }
    } else if (errPagosEl) {
      errPagosEl.style.display = "none";
      errPagosEl.textContent = "";
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

  // ✅ Autofill al cambiar a mixto (para que puedas guardar el cambio sin que te bloquee suma=0)
  let prevMixto = esMixto();

  selectMedio?.addEventListener("change", () => {
    const nowMixto = esMixto();

    if (nowMixto && !prevMixto && bloquePagos) {
      const totalVenta = parseMoney(window.VENTA_TOTAL_COBRADO || window.VENTA_TOTAL || "0");
      const inputs = bloquePagos.querySelectorAll("input[name$='-monto']");

      let sum = 0;
      inputs.forEach(i => sum += parseMoney(i.value));

      // Si estaba todo en 0, poner el total en el primer input
      if (sum < 0.009 && inputs.length) {
        inputs.forEach((i, idx) => i.value = (idx === 0 ? to2(totalVenta) : "0.00"));
      }
    }

    prevMixto = nowMixto;
    validateUI();
  });

  let previousRefundTotal = calcTotalDevolucion();

  document.addEventListener("input", (e) => {
    const t = e.target;
    if (!t) return;

    if (t.matches("input[name^='dev-'][name$='-devolver']")) {
      const totalDev = calcTotalDevolucion();
      applyDefaultCashRefund(totalDev, previousRefundTotal);
      previousRefundTotal = totalDev;
      validateUI();
    }
    if (t.matches("input[name$='-monto']")) validateUI();
  });

  form?.addEventListener("submit", (e) => {
    if (e.submitter?.value === "volver_lista") return;

    if (esMixto()) {
      const totalCobrado = parseMoney(window.VENTA_TOTAL_COBRADO || window.VENTA_TOTAL || "0");
      const sumaPagos = sumInputsWithin(bloquePagos);

      if (Math.abs(sumaPagos - totalCobrado) > 0.009) {
        e.preventDefault();
        alert(`⚠️ La suma de pagos (${to2(sumaPagos)}) debe ser igual al total originalmente pagado (${to2(totalCobrado)}).`);
        return;
      }
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

  bloqueReint?.addEventListener("click", (event) => {
    const button = event.target.closest(".reintegro-todo");
    if (!button || button.disabled) return;

    const totalDev = calcTotalDevolucion();
    const targetId = button.getAttribute("data-reintegro-target");
    const inputs = bloqueReint.querySelectorAll("input[name$='-monto']");
    inputs.forEach((input) => {
      input.value = input.id === targetId ? to2(totalDev) : "0.00";
    });
    validateUI();
  });

  /* =========================================================================
     IMPRESIÓN SEGÚN EL PERFIL AUTORITATIVO DEL SERVIDOR
     - Windows: POS Agent local con POS_AGENT_TOKEN.
     - Linux: POS Agent local legacy con POS_AGENT_TOKEN_LINUX.
     - PythonAnywhere NO intenta imprimir por USB/CUPS en esta reimpresión.
     ========================================================================= */
  const POS_AGENT_URL = (
    window.POS_AGENT_URL || "http://127.0.0.1:8787"
  ).replace(/\/+$/, "");

  const POS_AGENT_TOKEN = String(
    window.POS_AGENT_TOKEN || ""
  ).trim();

  const POS_AGENT_TOKEN_LINUX = String(
    window.POS_AGENT_TOKEN_LINUX || ""
  ).trim();

  function normalizePrintOperatingSystem(value) {
    return String(value || "").trim().toLowerCase() === "linux"
      ? "linux"
      : "windows";
  }

  function normalizePrintPaperSize(value) {
    return String(value || "").trim().toLowerCase() === "pequena"
      ? "pequena"
      : "grande";
  }

  const ESCPOS_FULL_CUT_COMMAND = "\x1d\x56\x41\x00";

  function normalizePrintAutoCut(value) {
    if (value === undefined || value === null || value === "") return true;
    if (typeof value === "boolean") return value;
    return ["1", "true", "yes", "on"].includes(
      String(value).trim().toLowerCase()
    );
  }

  // Windows conserva el payload actual con soporte de corte.
  function buildWindowsPrintPayload(text, autoCut = true) {
    const shouldCut = normalizePrintAutoCut(autoCut);
    let printableText = String(text || "");

    if (
      shouldCut &&
      !printableText.endsWith(ESCPOS_FULL_CUT_COMMAND)
    ) {
      printableText += ESCPOS_FULL_CUT_COMMAND;
    }

    return {
      text: printableText,
      cut: shouldCut,
      cut_command_embedded: shouldCut,
    };
  }

  async function agentPrintWindows(
    text,
    { timeout = 850, autoCut = true } = {}
  ) {
    if (!POS_AGENT_TOKEN) {
      throw new Error(
        "POS Agent Windows no configurado (POS_AGENT_TOKEN vacío)."
      );
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);

    try {
      const response = await fetch(
        POS_AGENT_URL + "/print",
        {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            "X-Pos-Agent-Token": POS_AGENT_TOKEN,
          },
          body: JSON.stringify(
            buildWindowsPrintPayload(text, autoCut)
          ),
          signal: ctrl.signal,
        }
      );

      if (!response.ok) {
        throw new Error(
          `El POS Agent Windows rechazó la impresión (HTTP ${response.status}).`
        );
      }

      return true;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(
          "El POS Agent Windows no respondió a tiempo al imprimir."
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  // Linux usa EXACTAMENTE el protocolo legacy que ya funcionaba:
  // POST /print
  // X-Pos-Agent-Token: POS_AGENT_TOKEN_LINUX
  // JSON: { text: "..." }
  async function agentPrintLinux(
    text,
    { timeout = 2000 } = {}
  ) {
    if (!POS_AGENT_TOKEN_LINUX) {
      throw new Error(
        "POS Agent Linux no configurado (POS_AGENT_TOKEN_LINUX vacío)."
      );
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);

    try {
      const response = await fetch(
        POS_AGENT_URL + "/print",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Pos-Agent-Token": POS_AGENT_TOKEN_LINUX,
          },
          body: JSON.stringify({
            text: String(text || ""),
          }),
          signal: ctrl.signal,
        }
      );

      if (!response.ok) {
        throw new Error(
          `El POS Agent Linux rechazó la impresión (HTTP ${response.status}).`
        );
      }

      return true;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(
          "El POS Agent Linux no respondió a tiempo al imprimir."
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  // Warmup independiente. Un fallo aquí no bloquea la página.
  function warmupPosAgent(token) {
    if (!token) return;
    fetch(POS_AGENT_URL + "/ping", {
      method: "GET",
      keepalive: true,
      headers: {
        "X-Pos-Agent-Token": token,
      },
    }).catch(() => {});
  }

  (function agentWarmup() {
    warmupPosAgent(POS_AGENT_TOKEN);
    if (POS_AGENT_TOKEN_LINUX !== POS_AGENT_TOKEN) {
      warmupPosAgent(POS_AGENT_TOKEN_LINUX);
    }
  })();

  async function fetchTicketText(ventaId) {
    const csrf = getCSRFToken();
    const fd = new FormData();

    fd.append("csrfmiddlewaretoken", csrf);
    fd.append("venta_id", String(ventaId));

    const response = await fetch(
      window.ticketTextoUrl,
      {
        method: "POST",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
        body: fd,
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(
        data.error || "No se pudo generar el texto del ticket."
      );
    }

    return {
      receiptText: String(data.receipt_text || ""),
      operatingSystem: normalizePrintOperatingSystem(
        data.print_operating_system
      ),
      paperSize: normalizePrintPaperSize(
        data.print_paper_size
      ),
      autoCut: normalizePrintAutoCut(
        data.print_auto_cut
      ),
    };
  }

  btnPrint?.addEventListener("click", async (event) => {
    event.preventDefault();

    const ventaId =
      btnPrint.getAttribute("data-venta-id");

    try {
      btnPrint.disabled = true;

      if (!ventaId) {
        throw new Error(
          "No encontré el ID de la venta."
        );
      }

      // Django solo genera el ticket y devuelve el perfil del punto de pago.
      const ticket = await fetchTicketText(ventaId);

      // El ancho ya viene aplicado por Django al receipt_text.
      // Solo agregamos alimentación final según el tamaño configurado.
      const feedLines =
        ticket.paperSize === "pequena" ? 4 : 13;

      const receiptText =
        (ticket.receiptText || "Factura\n\n") +
        "\n".repeat(feedLines);

      if (ticket.operatingSystem === "linux") {
        // Linux imprime en EL EQUIPO LOCAL, nunca mediante CUPS de PythonAnywhere.
        await agentPrintLinux(
          receiptText,
          { timeout: 2000 }
        );
      } else {
        // Windows mantiene su flujo actual y su corte automático.
        await agentPrintWindows(
          receiptText,
          {
            timeout: 850,
            autoCut: ticket.autoCut,
          }
        );
      }

    } catch (err) {
      alert(
        "⚠️ " +
        (err?.message || "Error al imprimir.")
      );
      console.error(err);
    } finally {
      btnPrint.disabled = false;
    }
  });

  // Init
  if (!reintegroLedgerReady) {
    document.querySelectorAll("input[name^='dev-'][name$='-devolver']").forEach((input) => {
      input.disabled = true;
      input.title = "Falta aplicar la migración 0021 para habilitar devoluciones.";
    });
  }
  validateUI();
})();
