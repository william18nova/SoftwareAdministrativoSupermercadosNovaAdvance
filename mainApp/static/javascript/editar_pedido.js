/* static/javascript/editar_pedido.js
   ─────────────────────────────────────────────────────────────────────────────────
   · Precarga initialDetalles (desde template)
   · Exponemos `autocomplete()` globalmente antes de usarla inline
   · Inicialización de DataTable
   · Autocompletes: proveedor, sucursal, producto, caja de pago
   · Renderizado de tabla y total
   · Handlers de cambio de cantidad, precio, eliminación, agregar producto
   · Submit vía AJAX con validación y manejo de errores 500
*/

(() => {
  "use strict";

  // ─── expose autocomplete globally ──────────────────────────────────────────────
  function autocomplete({ inp, hidden, box, url, extra = () => ({}), allowEmpty = false, onSelect }) {
    let timer;
    async function render() {
      const term = inp.value.trim();
      if (!allowEmpty && !term) {
        box.style.display = "none";
        return;
      }
      const qs = new URLSearchParams({ term, ...extra() });
      const js  = await (await fetch(`${url}?${qs}`)).json();

      // si estamos autocompletando productos, filtra los ya añadidos
      const used = new Set(detalles.map(d => String(d.productoid)));
      const opts = js.results.filter(r => !used.has(String(r.id)));

      box.innerHTML = opts.map(r =>
        `<div class="autocomplete-option" data-id="${r.id}"${
           r.precio !== undefined ? ` data-precio="${r.precio}"` : ""
         }>
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
      inp.value    = opt.textContent.trim();
      hidden.value = opt.dataset.id;
      box.style.display = "none";
      onSelect?.(opt);
    });
    document.addEventListener("click", e => {
      if (!inp.contains(e.target) && !box.contains(e.target)) {
        box.style.display = "none";
      }
    });
  }
  window.autocomplete = autocomplete;

  // ─── Helpers básicos ─────────────────────────────────────────────────────────
  const $id   = id => document.getElementById(id);
  const money = n  => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(n);

  // ─── UI helpers (flashes + field errors) ────────────────────────────────────
  const ERR_BOX_MAP = {
    proveedor:               "proveedor",
    proveedor_autocomplete:  "proveedor",
    sucursal:                "sucursal",
    sucursal_autocomplete:   "sucursal",
    producto:                "detalles",
    cantidad:                "cantidad",
    detalles:                "detalles",
    estado:                  "estado",
    monto_pagado:            "monto_pagado",
    caja_pagoid:             "caja_pago_autocomplete",
  };
  const INPUT_MAP = {
    proveedor:               $id("id_proveedor_autocomplete"),
    proveedor_autocomplete:  $id("id_proveedor_autocomplete"),
    sucursal:                $id("id_sucursal_autocomplete"),
    sucursal_autocomplete:   $id("id_sucursal_autocomplete"),
    producto:                $id("producto-input"),
    cantidad:                $id("cantidad-input"),
    detalles:                $id("producto-input"),
    estado:                  $id("id_estado"),
    monto_pagado:            $id("id_monto_pagado"),
    caja_pago_autocomplete:  $id("id_caja_pago_autocomplete"),
  };

  const UI = {
    flash(kind, msg) {
      const box = $id(`${kind}-message`);
      box.innerHTML = `<i class="fas fa-${kind==="error"?"exclamation":"check"}-circle"></i> ${msg}`;
      box.style.display = "block";
    },
    clearFlashes() {
      ["success","error"].forEach(k => {
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
      const key   = ERR_BOX_MAP[field] || field;
      const input = INPUT_MAP[field] || INPUT_MAP[key];
      let box     = document.querySelector(`#error-id_${key}`);
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

  // ─── Inicializar DataTable ───────────────────────────────────────────────────
  const HEADERS = ["Producto","Cantidad","Precio U.","Subtotal","Acciones"];
  const dt = $("#detalle-pedido").DataTable({
    paging:    false,
    searching: false,
    info:      false,
    responsive:true,
    columnDefs:[{ targets: 4, orderable: false }],
    rowCallback: row => {
      $("td", row).each((i, td) => td.dataset.label = HEADERS[i]);
    }
  });

  // ─── Estado global de detalles ───────────────────────────────────────────────
  let detalles = (initialDetalles || []).map(d => ({
    ...d,
    proveedorid: d.proveedorid ?? $id("id_proveedor").value,
  }));
  let precioSel       = 0;
  let proveedorActual = $id("id_proveedor").value || null;
  let proveedorNombre = $id("id_proveedor_autocomplete").value || "";

  // ─── Función para dibujar tabla + total ──────────────────────────────────────
  function drawTable() {
    dt.clear();
    let total = 0;
    detalles.forEach(d => {
      total += d.subtotal;
      dt.row.add([
        // Producto
        d.producto,
        // Cantidad (editable)
        `<input type="number" class="qty-input" min="1" step="1"
                data-id="${d.detallepedidoid}" value="${d.cantidad}">`,
        // Precio U. (editable)  ⟵ NUEVO INPUT
        `<input type="number" class="price-input" min="0" step="0.01"
                data-id="${d.detallepedidoid}" value="${Number(d.precio_unitario).toFixed(2)}">`,
        // Subtotal (solo lectura)
        money(d.subtotal),
        // Acciones
        `<button type="button" class="btn-eliminar" data-id="${d.detallepedidoid}">
           <i class="fas fa-trash-alt"></i>
         </button>`
      ]);
    });
    dt.draw(false);
    $id("total-valor").textContent = money(total);
    $id("id_detalles").value       = JSON.stringify(detalles);
  }
  drawTable();

  // ─── Handlers de cambio de cantidad / precio y eliminación ──────────────────
  $("#detalle-pedido tbody")
    // cantidad
    .on("change", ".qty-input", function() {
      const id = String(this.dataset.id);
      const v  = parseInt(this.value,10);
      const row = detalles.find(d => String(d.detallepedidoid)===id);
      if (!row) return;
      if (isNaN(v) || v <= 0) {
        detalles = detalles.filter(d => String(d.detallepedidoid)!==id);
      } else {
        row.cantidad = v;
        row.subtotal = v * Number(row.precio_unitario || 0);
      }
      drawTable();
    })
    // precio unitario  ⟵ NUEVO
    .on("change", ".price-input", function() {
      const id = String(this.dataset.id);
      // normaliza coma por punto si el navegador la deja pasar
      const raw = (this.value || "").replace(",", ".");
      let price = parseFloat(raw);
      if (isNaN(price) || price < 0) {
        price = 0;
      }
      const row = detalles.find(d => String(d.detallepedidoid)===id);
      if (!row) return;
      row.precio_unitario = price;
      row.subtotal        = Number(row.cantidad || 0) * price;
      drawTable();
    })
    // eliminar
    .on("click", ".btn-eliminar", function() {
      const id = String(this.dataset.id);
      detalles = detalles.filter(d => String(d.detallepedidoid)!==id);
      drawTable();
    });

  // ─── Autocomplete Proveedor ─────────────────────────────────────────────────
  autocomplete({
    inp:    $id("id_proveedor_autocomplete"),
    hidden: $id("id_proveedor"),
    box:    $id("proveedor-autocomplete-results"),
    url:    proveedorAutocompleteUrl,
    allowEmpty: true,
    onSelect: async opt => {
      const nuevoID     = opt.dataset.id;
      const nuevoNombre = opt.textContent.trim();
      if (nuevoID === proveedorActual) return;

      // Filtrar detalles que sigan perteneciendo al nuevo proveedor
      const checks = await Promise.all(detalles.map(async d => {
        const qs = new URLSearchParams({ term: d.producto, proveedor_id: nuevoID });
        const js = await (await fetch(`${productoPedidoAutocompleteUrl}?${qs}`)).json();
        return { det: d, ok: js.results.some(r => String(r.id)===String(d.productoid)) };
      }));

      const conservar  = checks.filter(c => c.ok).map(c => c.det);
      const eliminados = checks.length - conservar.length;
      let proceed = true;
      if (eliminados) {
        proceed = confirm(`${eliminados} producto(s) no pertenecen al proveedor seleccionado y se eliminarán. ¿Continuar?`);
      }
      if (!proceed) {
        $id("id_proveedor_autocomplete").value = proveedorNombre;
        $id("id_proveedor").value              = proveedorActual;
        return;
      }
      detalles         = conservar.map(d => ({ ...d, proveedorid: nuevoID }));
      proveedorActual  = nuevoID;
      proveedorNombre  = nuevoNombre;
      $id("producto-input").value = "";
      $id("producto-id").value    = "";
      precioSel                   = 0;
      drawTable();
    }
  });

  // ─── Autocomplete Sucursal ─────────────────────────────────────────────────
  autocomplete({
    inp:    $id("id_sucursal_autocomplete"),
    hidden: $id("id_sucursal"),
    box:    $id("sucursal-autocomplete-results"),
    url:    sucursalAutocompleteUrl
  });

  // ─── Autocomplete Producto ─────────────────────────────────────────────────
  autocomplete({
    inp:    $id("producto-input"),
    hidden: $id("producto-id"),
    box:    $id("producto-autocomplete-results"),
    url:    productoPedidoAutocompleteUrl,
    allowEmpty: true,
    extra: () => ({ proveedor_id: $id("id_proveedor").value }),
    onSelect: opt => { precioSel = parseFloat(opt.dataset.precio) || 0; }
  });

  // ─── Autocomplete Caja de Pago ──────────────────────────────────────────────
  autocomplete({
    inp:    $id("id_caja_pago_autocomplete"),
    hidden: $id("id_caja_pagoid"),
    box:    $id("caja-pago-autocomplete-results"),
    url:    cajaPagoAutocompleteUrl,
    extra:  () => ({ sucursal_id: $id("id_sucursal").value })
  });

  // ─── Agregar producto al arreglo ────────────────────────────────────────────
  $id("agregarDetalleBtn").addEventListener("click", () => {
    UI.clearFlashes();
    UI.clearFieldErrors();
    let valid = true;
    if (!$id("id_proveedor").value.trim()) {
      UI.fieldError("proveedor","Seleccione un proveedor.");
      valid = false;
    }
    if (!$id("id_sucursal").value.trim()) {
      UI.fieldError("sucursal","Seleccione una sucursal.");
      valid = false;
    }
    const pid = $id("producto-id").value.trim();
    if (!pid) {
      UI.fieldError("producto","Seleccione un producto.");
      valid = false;
    }
    const qtyV = $id("cantidad-input").value.trim();
    const qty  = parseInt(qtyV,10);
    if (!qtyV||isNaN(qty)||qty<1) {
      UI.fieldError("cantidad","Cantidad inválida.");
      valid = false;
    }
    if (!valid) return;

    const name = $id("producto-input").value.trim();
    const row  = detalles.find(d=>String(d.productoid)===String(pid));
    if (row) {
      row.cantidad  += qty;
      row.subtotal   = row.cantidad * Number(row.precio_unitario || 0);
    } else {
      const precio = Number(precioSel || 0);
      detalles.push({
        detallepedidoid: `tmp-${Date.now()}`,
        productoid:      pid,
        proveedorid:     proveedorActual,
        producto:        name,
        cantidad:        qty,
        precio_unitario: precio,
        subtotal:        qty * precio
      });
    }
    $id("producto-input").value = "";
    $id("producto-id").value    = "";
    $id("cantidad-input").value = "1";
    precioSel = 0;
    drawTable();
  });

  // ─── Submit del formulario vía AJAX ──────────────────────────────────────────
  $id("pedidoForm").addEventListener("submit", async e => {
    e.preventDefault();
    UI.clearFlashes();
    UI.clearFieldErrors();
    let valid = true;
    if (!$id("id_proveedor").value.trim()) {
      UI.fieldError("proveedor","Seleccione un proveedor.");
      valid = false;
    }
    if (!$id("id_sucursal").value.trim()) {
      UI.fieldError("sucursal","Seleccione una sucursal.");
      valid = false;
    }
    if (!$id("id_estado").value.trim()) {
      UI.fieldError("estado","Seleccione un estado.");
      valid = false;
    }
    if (!detalles.length) {
      UI.fieldError("detalles","Agregue al menos un producto.");
      valid = false;
    }
    if (!valid) return;

    const fd = new FormData(e.target);
    fd.set("detalles", JSON.stringify(detalles));

    try {
      const res = await fetch(e.target.action, {
        method:  "POST",
        headers: {
          "X-CSRFToken": document.cookie.match(/csrftoken=([^;]+)/)[1],
          "Accept":      "application/json"
        },
        body: fd
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Error 500 del servidor:", text);
        UI.flash("error","Error interno del servidor (revisa consola).");
        return;
      }

      const js = await res.json();
      if (js.success) {
        window.location = visualizarPedidosUrl + "?updated=1";
      } else if (js.errors) {
        Object.entries(js.errors).forEach(([f,arr]) =>
          arr.forEach(eo => UI.fieldError(f, eo.message))
        );
        UI.flash("error","Corrige los campos indicados.");
      } else {
        UI.flash("error", js.message || "Error al guardar.");
      }
    } catch(err) {
      console.error(err);
      UI.flash("error","Error de red.");
    }
  });

})();
