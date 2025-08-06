/*  static/javascript/editar_pedido.js
    ——————————————————————————————————————————————————————————
    · Precarga initialDetalles
    · Autocompletados (proveedor, sucursal, producto)
    · Cambio de proveedor ⇒ conserva líneas válidas, confirma antes de descartar
    · Cantidad editable + botón 🗑️ con delegación
    · Validaciones con mensajes de error por campo (incl. Estado)
    · Gestión de errores 500 mostrando el body en consola
----------------------------------------------------------------*/
(() => {
  "use strict";

  /* ═════ helpers básicos ══════════════════════════════════════ */
  const $id = id => document.getElementById(id);
  const money = n =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(n);

  /* ═════ UI helpers (flashes + errors) ════════════════════════ */
  const ERR_BOX_MAP = {
    proveedor: "proveedor",
    proveedor_autocomplete: "proveedor",
    sucursal: "sucursal",
    sucursal_autocomplete: "sucursal",
    producto: "detalles",
    cantidad: "cantidad",
    detalles: "detalles",
    estado: "estado",            // ← añadido
  };
  const INPUT_MAP = {
    proveedor: $id("id_proveedor_autocomplete"),
    proveedor_autocomplete: $id("id_proveedor_autocomplete"),
    sucursal: $id("id_sucursal_autocomplete"),
    sucursal_autocomplete: $id("id_sucursal_autocomplete"),
    producto: $id("producto-input"),
    cantidad: $id("cantidad-input"),
    detalles: $id("producto-input"),
    estado: $id("id_estado"),    // ← añadido
  };

  const UI = {
    flash(kind, msg) {
      const box = $id(`${kind}-message`);
      box.innerHTML = `<i class="fas fa-${kind === "error" ? "exclamation" : "check"}-circle"></i> ${msg}`;
      box.style.display = "block";
    },
    clearFlashes() {
      ["success", "error"].forEach(k => {
        const b = $id(`${k}-message`);
        b.style.display = "none";
        b.innerHTML = "";
      });
    },
    clearFieldErrors() {
      document.querySelectorAll(".field-error.visible").forEach(b => {
        b.classList.remove("visible");
        b.innerHTML = "";
      });
      document.querySelectorAll(".input-error").forEach(i =>
        i.classList.remove("input-error")
      );
    },
    fieldError(field, msg) {
      const key = ERR_BOX_MAP[field] || field;
      const input = INPUT_MAP[field] || INPUT_MAP[key];
      let box = document.querySelector(`#error-id_${key}`);
      if (!box && input) {
        box = document.createElement("div");
        box.id = `error-id_${key}`;
        box.className = "field-error";
        input.parentNode.insertBefore(box, input.nextSibling);
      }
      if (box) {
        box.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
        box.classList.add("visible");
      }
      input?.classList.add("input-error");
    },
  };

  /* ═════ DataTable ════════════════════════════════════════════ */
  const HEADERS = ["Producto", "Cantidad", "Precio U.", "Subtotal", "Acciones"];
  const dt = $("#detalle-pedido").DataTable({
    paging: false,
    searching: false,
    info: false,
    responsive: true,
    columnDefs: [{ targets: 4, orderable: false }],
    rowCallback: row =>
      $("td", row).each((i, td) => (td.dataset.label = HEADERS[i])),
  });

  /* ═════ estado global ════════════════════════════════════════ */
  let detalles = (initialDetalles || []).map(d => ({
    ...d,
    proveedorid: d.proveedorid ?? $id("id_proveedor").value,
  }));
  let precioSel = 0;
  let proveedorActual = $id("id_proveedor").value || null;
  let proveedorNombre = $id("id_proveedor_autocomplete").value || "";

  /* ═════ render tabla + total ═════════════════════════════════ */
  function drawTable() {
    dt.clear();
    let total = 0;
    detalles.forEach(d => {
      total += d.subtotal;
      dt.row.add([
        d.producto,
        `<input type="number" class="qty-input" min="0" step="1"
                data-id="${d.detallepedidoid}" value="${d.cantidad}">`,
        money(d.precio_unitario),
        money(d.subtotal),
        `<button type="button" class="btn-eliminar" data-id="${d.detallepedidoid}">
           <i class="fas fa-trash-alt"></i>
         </button>`,
      ]);
    });
    dt.draw(false);
    $id("total-valor").textContent = money(total);
    $id("id_detalles").value = JSON.stringify(detalles);
  }
  drawTable();

  /* ═════ qty / eliminar (delegación) ══════════════════════════ */
  $("#detalle-pedido tbody")
    .on("change", ".qty-input", function () {
      const id = String(this.dataset.id);
      const v = parseInt(this.value, 10);
      const row = detalles.find(d => String(d.detallepedidoid) === id);
      if (!row) return;
      if (isNaN(v) || v <= 0) {
        detalles = detalles.filter(d => String(d.detallepedidoid) !== id);
      } else {
        row.cantidad = v;
        row.subtotal = v * row.precio_unitario;
      }
      drawTable();
    })
    .on("click", ".btn-eliminar", function () {
      const id = String(this.dataset.id);
      detalles = detalles.filter(d => String(d.detallepedidoid) !== id);
      drawTable();
    });

  /* ═════ autocomplete mini-factory ════════════════════════════ */
  function autocomplete({ inp, hidden, box, url, extra = () => ({}), allowEmpty = false, onSelect }) {
    let timer;
    async function render() {
      const term = inp.value.trim();
      if (!allowEmpty && !term) {
        box.style.display = "none";
        return;
      }
      const qs = new URLSearchParams({ term, ...extra() });
      const js = await (await fetch(`${url}?${qs}`)).json();
      const used = new Set(detalles.map(d => String(d.productoid)));
      const opts = js.results.filter(r => !used.has(String(r.id)));
      box.innerHTML = opts.map(r =>
        `<div class="autocomplete-option" data-id="${r.id}"
             ${r.precio !== undefined ? `data-precio="${r.precio}"` : ""}>
           ${r.text}
         </div>`
      ).join("");
      box.style.display = opts.length ? "block" : "none";
    }
    inp.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(render, 200);
      hidden.value = "";
    });
    inp.addEventListener("focus", render);
    box.addEventListener("click", e => {
      const opt = e.target.closest(".autocomplete-option");
      if (!opt) return;
      inp.value = opt.textContent.trim();
      hidden.value = opt.dataset.id;
      box.style.display = "none";
      onSelect?.(opt);
    });
    document.addEventListener("click", e => {
      if (!inp.contains(e.target) && !box.contains(e.target))
        box.style.display = "none";
    });
  }

  /* ═════ util: comprobar si un producto pertenece a un proveedor ═*/
  async function productoPerteneceAProveedor(prodId, prodName, provId) {
    const qs = new URLSearchParams({ term: prodName, proveedor_id: provId });
    const js = await (await fetch(`${productoPedidoAutocompleteUrl}?${qs}`)).json();
    return js.results.some(r => String(r.id) === String(prodId));
  }

  /* ═════ inicializa autocompletes ═══════════════════════════════ */
  autocomplete({
    inp: $id("id_proveedor_autocomplete"),
    hidden: $id("id_proveedor"),
    box: $id("proveedor-autocomplete-results"),
    url: proveedorAutocompleteUrl,
    allowEmpty: true,
    onSelect: async opt => {
      const nuevoID = opt.dataset.id;
      const nuevoNombre = opt.textContent.trim();
      if (nuevoID === proveedorActual) return;
      const checks = await Promise.all(detalles.map(async d => ({
        det: d,
        ok: await productoPerteneceAProveedor(d.productoid, d.producto, nuevoID),
      })));
      const conservar = checks.filter(c => c.ok).map(c => c.det);
      const eliminados = checks.length - conservar.length;
      let proceed = true;
      if (eliminados) {
        proceed = confirm(
          `${eliminados} producto(s) no pertenecen al proveedor seleccionado y se eliminarán. ¿Continuar?`
        );
      }
      if (!proceed) {
        $id("id_proveedor_autocomplete").value = proveedorNombre;
        $id("id_proveedor").value = proveedorActual;
        return;
      }
      detalles = conservar.map(d => ({ ...d, proveedorid: nuevoID }));
      proveedorActual = nuevoID;
      proveedorNombre = nuevoNombre;
      $id("producto-input").value = "";
      $id("producto-id").value = "";
      precioSel = 0;
      drawTable();
    },
  });

  autocomplete({
    inp: $id("id_sucursal_autocomplete"),
    hidden: $id("id_sucursal"),
    box: $id("sucursal-autocomplete-results"),
    url: sucursalAutocompleteUrl,
  });

  autocomplete({
    inp: $id("producto-input"),
    hidden: $id("producto-id"),
    box: $id("producto-autocomplete-results"),
    url: productoPedidoAutocompleteUrl,
    allowEmpty: true,
    extra: () => ({ proveedor_id: $id("id_proveedor").value }),
    onSelect: opt => {
      precioSel = parseFloat(opt.dataset.precio) || 0;
    },
  });

  /* ═════ Agregar producto ══════════════════════════════════════ */
  $id("agregarDetalleBtn").addEventListener("click", () => {
    UI.clearFlashes();
    UI.clearFieldErrors();
    let valid = true;
    if (!$id("id_proveedor").value.trim()) {
      UI.fieldError("proveedor", "Seleccione un proveedor.");
      valid = false;
    }
    if (!$id("id_sucursal").value.trim()) {
      UI.fieldError("sucursal", "Seleccione una sucursal.");
      valid = false;
    }
    const pid = $id("producto-id").value.trim();
    if (!pid) {
      UI.fieldError("producto", "Seleccione un producto.");
      valid = false;
    }
    const qtyV = $id("cantidad-input").value.trim();
    const qty = parseInt(qtyV, 10);
    if (!qtyV || isNaN(qty) || qty < 1) {
      UI.fieldError("cantidad", "Cantidad inválida.");
      valid = false;
    }
    if (!valid) return;
    const name = $id("producto-input").value.trim();
    const row = detalles.find(d => d.productoid === pid);
    if (row) {
      row.cantidad += qty;
      row.subtotal = row.cantidad * row.precio_unitario;
    } else {
      detalles.push({
        detallepedidoid: `tmp-${Date.now()}`,
        productoid: pid,
        proveedorid: proveedorActual,
        producto: name,
        cantidad: qty,
        precio_unitario: precioSel,
        subtotal: qty * precioSel,
      });
    }
    $id("producto-input").value = "";
    $id("producto-id").value = "";
    $id("cantidad-input").value = "1";
    precioSel = 0;
    drawTable();
  });

  /* ═════ Submit AJAX ══════════════════════════════════════════ */
  $id("pedidoForm").addEventListener("submit", e => {
    e.preventDefault();
    UI.clearFlashes();
    UI.clearFieldErrors();
    let valid = true;
    if (!$id("id_proveedor").value.trim()) {
      UI.fieldError("proveedor", "Seleccione un proveedor.");
      valid = false;
    }
    if (!$id("id_sucursal").value.trim()) {
      UI.fieldError("sucursal", "Seleccione una sucursal.");
      valid = false;
    }
    // ─── VALIDACIÓN NUEVA: estado ───────────────────────────────
    if (!$id("id_estado").value.trim()) {
      UI.fieldError("estado", "Seleccione un estado.");
      valid = false;
    }
    if (!detalles.length) {
      UI.fieldError("detalles", "Agregue al menos un producto.");
      valid = false;
    }
    if (!valid) return;

    const fd = new FormData(e.target);
    fd.set("detalles", JSON.stringify(detalles));

    fetch(e.target.action, {
      method: "POST",
      headers: {
        "X-CSRFToken": document.cookie.match(/csrftoken=([^;]+)/)[1],
        Accept: "application/json",
      },
      body: fd,
    })
      .then(async res => {
        if (!res.ok) {
          const text = await res.text();
          console.error("Error 500 del servidor:", text);
          UI.flash("error", "Error interno del servidor (mira la consola).");
          throw new Error("Server error");
        }
        return res.json();
      })
      .then(js => {
        if (js.success) {
          window.location = visualizarPedidosUrl + "?updated=1";
        } else if (js.errors) {
          Object.entries(js.errors).forEach(([f, arr]) =>
            arr.forEach(eo => UI.fieldError(f, eo.message))
          );
          UI.flash("error", "Corrija los campos indicados.");
        } else {
          UI.flash("error", js.message || "Error al guardar.");
        }
      })
      .catch(err => console.error(err));
  });
})();
