// static/javascript/generar_venta.js
$(function () {
  "use strict";
  const $ = window.jQuery;

  console.log("⚡ generar_venta.js — autocompletes + cross-fill + qty editable + scanner global");

  /* URLs (inyectadas en la plantilla) */
  const SUCURSAL_URL   = window.sucursalAutocompleteUrl;
  const PUNTOPAGO_URL  = window.puntopagoAutocompleteUrl;
  const CLIENTE_URL    = window.clienteAutocompleteUrl;
  const PRODUCTO_URL   = window.productoAutocompleteUrl;
  const AC_CODIGO_URL  = window.productoAutocompleteCodigoUrl || PRODUCTO_URL;
  const AC_BARRAS_URL  = window.productoAutocompleteBarrasUrl || PRODUCTO_URL;
  const VERIFICAR_URL  = window.verificarProductoUrl;
  const POR_COD_URL    = window.buscarProductoPorCodigoUrl;

  /* selectores cacheados */
  const $nombre   = $("#producto_busqueda_nombre");
  const $codigo   = $("#producto_busqueda_codigo");
  const $barras   = $("#producto_busqueda_codigo_barras");
  const $pid      = $("#producto_id");
  const $cantidad = $("#cantidad");
  const $agregar  = $("#agregar-producto");
  const $tbody    = $("#detalle-productos tbody");
  const $totalEl  = $("#total");

  /* dinero */
  const money = (n) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(Number(n) || 0);

  /* CSRF */
  $.ajaxSetup({
    beforeSend: (xhr, settings) => {
      if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type)) {
        const m = document.cookie.match(/csrftoken=([^;]+)/);
        if (m) xhr.setRequestHeader("X-CSRFToken", m[1]);
      }
    },
    cache: true,
  });

  /* caché GET simple */
  const cache = {};
  function fetchCached(url, params = {}) {
    const key = url + JSON.stringify(params);
    if (cache[key]) return Promise.resolve(cache[key]);
    return $.getJSON(url, params).then((data) => (cache[key] = data));
  }

  /* ===== estado persistido ===== */
  let sucursalID = localStorage.getItem("sucursalID") || "";
  const savedPunto = {
    id:  localStorage.getItem("puntopagoID") || "",
    name:localStorage.getItem("puntopagoName") || "",
    suc: localStorage.getItem("puntopagoSucursalID") || ""
  };

  /* estado de la venta */
  const productos = [];
  const cantidades = [];
  let runningTotal = 0;

  const FRESH_MS = 30000;
  const productCache = new Map();  // pid -> {nombre, barcode, price, stock, ts}
  const barcodeIndex = new Map();  // barcode -> pid
  const nameIndex = new Map();     // nombreLower -> pid
  const now = () => Date.now();
  const isFresh = (ts) => ts && now() - ts < FRESH_MS;

  /* normalizador nombre */
  function onlyName(s) {
    s = String(s || "").trim();
    s = s.replace(/^[\s•·\-\u2013\u2014:|.,;]+/, "");
    let m;
    const rx = /^\s*(?:\[\s*)?([A-Za-z0-9._-]{3,}|\d{6,})(?:\s*\])?\s*(?:-|–|—|:|\|)\s*(.*)$/;
    while ((m = s.match(rx))) s = (m[2] || "").trim();
    const m2 = s.match(/^\s*\d{6,}\s+(.+)$/);
    if (m2) s = m2[1].trim();
    s = s.replace(/^[\s•·\-\u2013\u2014:|.,;]+/, "");
    return s;
  }

  function enableQtyAndAdd(enable) {
    $cantidad.prop("disabled", !enable);
    $agregar.prop("disabled", !enable);
  }

  function maybeFocusQty() {
    if ($pid.val() && $nombre.val() && $codigo.val() && $barras.val()) {
      enableQtyAndAdd(true);
      setTimeout(() => { $cantidad.focus().select(); }, 0);
    }
  }

  function setProductFields({ nombre, pid, barcode }) {
    if (nombre != null) $nombre.val(onlyName(nombre));
    if (pid != null)    $codigo.val(pid);
    if (barcode != null)$barras.val(barcode);
    if (pid != null)    $pid.val(pid);
    maybeFocusQty();
  }

  /* ---------- caché productos + índices ---------- */
  function updateCache(pid, data = {}) {
    const key = String(pid);
    const prev = productCache.get(key) || {};
    const rec = {
      nombre: onlyName(data.nombre ?? prev.nombre ?? ""),
      barcode: data.codigo_de_barras ?? data.barcode ?? prev.barcode ?? "",
      price: data.precio_unitario ?? prev.price,
      stock: data.cantidad_disponible ?? prev.stock,
      ts: data.ts || now(),
    };
    productCache.set(key, rec);
    if (rec.barcode) barcodeIndex.set(rec.barcode, key);
    if (rec.nombre)  nameIndex.set(rec.nombre.toLowerCase(), key);
    return rec;
  }

  /* ✅ cross-fill INSTANTÁNEO */
  function instantFromPid(pid) {
    const rec = productCache.get(String(pid));
    if (!rec) return false;
    if (!$nombre.val()) $nombre.val(rec.nombre || "");
    if (!$barras.val() && rec.barcode) $barras.val(rec.barcode);
    if (!$codigo.val()) $codigo.val(pid);
    $pid.val(pid);
    enableQtyAndAdd(true);
    maybeFocusQty();
    return true;
  }
  function instantFromBarcode(code) {
    const pid = barcodeIndex.get(code);
    const ok = pid ? instantFromPid(pid) : false;
    if (ok) maybeFocusQty();
    return ok;
  }
  function instantFromName(name) {
    const pid = nameIndex.get((onlyName(name) || "").toLowerCase());
    const ok = pid ? instantFromPid(pid) : false;
    if (ok) maybeFocusQty();
    return ok;
  }

  /* ---------- verificación REAL (solo en Enter/selección) ---------- */
  async function fillFromProductId(pid) {
    if (!pid) return;
    try {
      const r = await $.post(VERIFICAR_URL, { producto_id: pid, cantidad: 1, sucursal_id: sucursalID });
      if (!r || !r.exists) return;
      const rec = updateCache(pid, r);
      setProductFields({ nombre: rec.nombre, pid, barcode: rec.barcode });
      enableQtyAndAdd(true);
    } catch (e) { console.error(e); }
  }

  async function fillFromBarcode(barcode) {
    if (!barcode) return;
    try {
      const r = await $.getJSON(POR_COD_URL, { codigo_de_barras: barcode, sucursal_id: sucursalID });
      if (!r || !r.exists) return alert("Código de barras no encontrado.");
      const p = r.producto || {};
      setProductFields({ nombre: p.nombre, pid: p.id, barcode });
      enableQtyAndAdd(true);
      await fillFromProductId(p.id);
    } catch (e) { console.error(e); }
  }

  /* ---------- helper autocompletes ---------- */
  function ingestFromAC(items) {
    items.forEach((it) => {
      if (!it || !it.id) return;
      updateCache(it.id, { nombre: it.name || "", barcode: it.barcode });
    });
  }

  function makeAC({ selector, url, extra = () => ({}), parse, onSel }) {
    const $inp = $(selector);
    $inp
      .autocomplete({
        minLength: 0,
        delay: 0,
        autoFocus: true,
        appendTo: "body",
        position: { my: "left top+6", at: "left bottom", collision: "flipfit" },
        source(req, resp) {
          fetchCached(url, { term: req.term || "", ...extra() })
            .then((d) => {
              const items = parse(d) || [];
              ingestFromAC(items.map((x) => ({ id: x.id, name: x.name, barcode: x.barcode })));
              resp(items);
            })
            .catch(() => resp([]));
        },
        open() { $inp.autocomplete("widget").css("z-index", 3000); },
        select(_e, ui) { onSel(ui.item); return false; },
      })
      .on("focus", function () { $(this).autocomplete("search", ""); });
  }

  /* ---------- Sucursal / Punto / Cliente (con cache) ---------- */

  // Prefill sucursal desde cache
  if (sucursalID) {
    $("#sucursal_autocomplete").val(localStorage.getItem("sucursalName") || "");
    $("#sucursal_id").val(sucursalID);
  }

  // Prefill Punto de Pago desde cache SOLO si pertenece a la misma sucursal guardada
  if (savedPunto.id && savedPunto.suc && savedPunto.suc === sucursalID) {
    $("#puntopago_autocomplete").val(savedPunto.name || "");
    $("#puntopago_id").val(savedPunto.id);
  }

  makeAC({
    selector: "#sucursal_autocomplete",
    url: SUCURSAL_URL,
    parse: (d) => d.results.map((r) => ({ label: r.text, value: r.text, id: r.id, name: r.text })),
    onSel: ({ id, label }) => {
      sucursalID = id;
      $("#sucursal_id").val(id);
      $("#sucursal_autocomplete").val(label);
      localStorage.setItem("sucursalID", id);
      localStorage.setItem("sucursalName", label);

      // Si el Punto de Pago guardado era de otra sucursal, lo limpiamos
      const ppSuc = localStorage.getItem("puntopagoSucursalID");
      if (ppSuc && ppSuc !== String(id)) {
        $("#puntopago_autocomplete").val("");
        $("#puntopago_id").val("");
        localStorage.removeItem("puntopagoID");
        localStorage.removeItem("puntopagoName");
        localStorage.removeItem("puntopagoSucursalID");
      }

      enableQtyAndAdd(false);
    },
  });

  makeAC({
    selector: "#puntopago_autocomplete",
    url: PUNTOPAGO_URL,
    extra: () => ({ sucursal_id: sucursalID }),
    parse: (d) => d.results.map((r) => ({ label: r.text, value: r.text, id: r.id, name: r.text })),
    onSel: ({ id, label }) => {
      $("#puntopago_autocomplete").val(label);
      $("#puntopago_id").val(id);
      // ⬇️ Guardar Punto de Pago en cache, vinculado a la sucursal actual
      localStorage.setItem("puntopagoID", id);
      localStorage.setItem("puntopagoName", label);
      localStorage.setItem("puntopagoSucursalID", sucursalID || "");
    },
  });

  makeAC({
    selector: "#cliente_busqueda",
    url: CLIENTE_URL,
    parse: (d) => d.results.map((c) => ({ label: c.text, value: c.text, id: c.id, name: c.text })),
    onSel: ({ id, label }) => { $("#cliente_busqueda").val(label); $("#cliente_id").val(id); },
  });

  /* ---------- Producto por NOMBRE ---------- */
  makeAC({
    selector: "#producto_busqueda_nombre",
    url: PRODUCTO_URL,
    extra: () => ({ sucursal_id: sucursalID }),
    parse: (d) => d.results.map((p) => ({ label: p.text, value: p.text, id: p.id, name: p.text })),
    onSel: (item) => {
      updateCache(item.id, { nombre: item.name });
      if (!instantFromName(item.name)) setProductFields({ pid: item.id });
      enableQtyAndAdd(true);
      fillFromProductId(item.id);
    },
  });

  /* ---------- Producto por CÓDIGO (ID) ---------- */
  makeAC({
    selector: "#producto_busqueda_codigo",
    url: AC_CODIGO_URL,
    extra: () => ({ sucursal_id: sucursalID }),
    parse: (d) =>
      (d.results || []).map((p) => ({
        label: String(p.id),
        value: String(p.id),
        id: p.id,
        name: p.text || "",
      })),
    onSel: (item) => {
      updateCache(item.id, { nombre: item.name });
      instantFromPid(item.id);
      fillFromProductId(item.id);
    },
  });

  /* ---------- Producto por CÓDIGO DE BARRAS ---------- */
  makeAC({
    selector: "#producto_busqueda_codigo_barras",
    url: AC_BARRAS_URL,
    extra: () => ({ sucursal_id: sucursalID }),
    parse: (d) =>
      (d.results || []).map((p) => ({
        label: p.barcode || p.codigo_de_barras || "",
        value: p.barcode || p.codigo_de_barras || "",
        id: p.id,
        name: p.text || "",
        barcode: p.barcode || p.codigo_de_barras || "",
      })).filter((x) => x.label),
    onSel: (item) => {
      updateCache(item.id, { nombre: item.name, barcode: item.barcode });
      instantFromBarcode(item.barcode) || setProductFields({ nombre: item.name, pid: item.id, barcode: item.barcode });
      enableQtyAndAdd(true);
      fillFromProductId(item.id);
    },
  });

  /* Scanner: no seleccionar primer ítem con Enter */
  (function fixScannerEnter() {
    $barras.autocomplete("option", "autoFocus", false);
    $barras.on("keydown", function (e) {
      if (e.key === "Enter" || e.key === "Tab") {
        const code = $.trim(this.value);
        if (!code) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        $(this).autocomplete("close");
        instantFromBarcode(code);
        fillFromBarcode(code);
      }
    });
  })();

  /* Cross-fill mientras escribes (sin verificar) */
  $codigo.on("input", function () { const v=$.trim(this.value); if (v) instantFromPid(v); });
  $barras.on("input", function () { const bc=$.trim(this.value); if (bc) instantFromBarcode(bc); });
  $nombre.on("input", function () { const nm=$.trim(this.value); if (nm) instantFromName(nm); });

  /* Confirmación con Enter (sin blur) */
  function bindEnterConfirm(selector, handler, instant) {
    $(selector).on("keydown", function (e) {
      if (e.key !== "Enter") return;
      const ac = $(this).data("ui-autocomplete");
      const menuVisible = ac && ac.menu && ac.menu.element.is(":visible");
      if (!menuVisible) {
        e.preventDefault();
        const val = $.trim($(this).val());
        if (!val) return;
        if (instant) instant(val);
        handler(val);
      }
    });
  }
  bindEnterConfirm("#producto_busqueda_codigo", (pid) => fillFromProductId(pid), (pid)=>instantFromPid(pid));
  bindEnterConfirm("#producto_busqueda_codigo_barras", (bc) => fillFromBarcode(bc), (bc)=>instantFromBarcode(bc));
  bindEnterConfirm("#producto_busqueda_nombre", (term) => {
    fetchCached(PRODUCTO_URL, { term, sucursal_id: sucursalID })
      .then((d) => {
        const items = d.results || [];
        if (!items.length) return;
        const m = items.find((x) => onlyName(x.text || "").toLowerCase() === onlyName(term).toLowerCase()) || items[0];
        if (m && m.id) { instantFromPid(m.id); fillFromProductId(m.id); }
      })
      .catch(() => {});
  }, (term)=>instantFromName(term));

  /* Foco a Cantidad cuando los 3 campos están llenos */
  $nombre.add($codigo).add($barras).on("change input", maybeFocusQty);

  /* Quagga (EAN) */
  $("#btnEscanear").click(() => {
    $("#interactive").show();
    Quagga.init(
      { inputStream:{type:"LiveStream",target:"#interactive",constraints:{facingMode:"environment"}},
        decoder:{readers:["ean_reader"]} },
      (err) => (err ? console.error(err) : Quagga.start())
    );
    Quagga.onDetected(async (data) => {
      Quagga.stop(); $("#interactive").hide();
      const code = data.codeResult.code;
      instantFromBarcode(code);
      await fillFromBarcode(code);
    });
  });

  /* total O(1) + serialización */
  function setTotal(v) {
    runningTotal = v;
    $totalEl.text(money(runningTotal));
    $("#productos").val(JSON.stringify(productos));
    $("#cantidades").val(JSON.stringify(cantidades));
  }
  function addToTotal(delta) { setTotal(runningTotal + (Number(delta) || 0)); }

  /* Agregar al carrito */
  $("#agregar-producto").click(async () => {
    const pid = $pid.val();
    const qty = parseInt($cantidad.val(), 10);
    if (!pid || !qty || qty < 1) return alert("Datos inválidos.");

    const cached = productCache.get(String(pid));
    const doAppend = (nombre, price, qtyAdd) => {
      const idx = productos.indexOf(pid);
      if (idx > -1) {
        cantidades[idx] += qtyAdd;
        const $row = $tbody.find(`tr[data-pid='${pid}']`);
        const newQty = cantidades[idx];
        $row.data("qty", newQty);
        $row.find(".qty-input").val(newQty);
        $row.find("td").eq(3).text(money(price * newQty));
        addToTotal(price * qtyAdd);
      } else {
        productos.push(pid);
        cantidades.push(qtyAdd);
        const subtotal = price * qtyAdd;
        $tbody.prepend(`
          <tr data-pid="${pid}" data-price="${price}" data-qty="${qtyAdd}">
            <td data-id="${pid}">${nombre || ""}</td>
            <td>
              <input type="number" class="qty-input" min="1" value="${qtyAdd}" />
            </td>
            <td>${money(price)}</td>
            <td>${money(subtotal)}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm eliminar-producto" title="Eliminar">
                <i class="fas fa-trash-alt"></i>
              </button>
            </td>
          </tr>
        `);
        addToTotal(subtotal);
      }
      // reset
      $nombre.val(""); $codigo.val(""); $barras.val("");
      $pid.val(""); $cantidad.val(1); enableQtyAndAdd(false);
    };

    if (cached && isFresh(cached.ts)) {
      if (cached.stock != null && qty > cached.stock) return alert(`Solo ${cached.stock} disponibles.`);
      const price = Number(cached.price) || 0;
      doAppend(cached.nombre, price, qty);
      return;
    }

    $.post(VERIFICAR_URL, { producto_id: pid, cantidad: qty, sucursal_id: sucursalID }).done((r) => {
      if (!r.exists) return alert("Sin stock/sucursal.");
      if (r.cantidad_disponible < qty) return alert(`Solo ${r.cantidad_disponible} disponibles.`);
      updateCache(pid, r);
      doAppend(onlyName(r.nombre), Number(r.precio_unitario) || 0, qty);
    });
  });

  /* Enter en CANTIDAD agrega al carrito */
  $cantidad.on("keydown", function (e) {
    if (e.key === "Enter" && !$agregar.prop("disabled")) {
      e.preventDefault();
      $agregar.click();
    }
  });

  /* Editar cantidad inline */
  $tbody.on("input change", ".qty-input", function () {
    const $row  = $(this).closest("tr");
    const pid   = $row.data("pid").toString();
    const price = Number($row.data("price")) || 0;

    let newQty  = parseInt(this.value, 10);
    if (!newQty || newQty < 1) newQty = 1;

    const cached = productCache.get(pid);
    if (cached && cached.stock != null && newQty > cached.stock) {
      newQty = cached.stock;
      this.value = newQty;
      alert(`Solo ${cached.stock} disponibles.`);
    }

    const oldQty = Number($row.data("qty")) || 0;
    if (newQty === oldQty) return;

    $row.data("qty", newQty);
    const i = productos.indexOf(pid);
    if (i > -1) cantidades[i] = newQty;

    $row.find("td").eq(3).text(money(price * newQty));
    addToTotal(price * (newQty - oldQty));
  });

  /* eliminar del carrito */
  $tbody.on("click", ".eliminar-producto", function () {
    const $row = $(this).closest("tr");
    const pid = $row.data("pid").toString();
    const idx = productos.indexOf(pid);
    const price = Number($row.data("price")) || 0;
    const qty   = Number($row.data("qty")) || 0;
    addToTotal(-(price * qty));
    if (idx > -1) { productos.splice(idx, 1); cantidades.splice(idx, 1); }
    $row.remove();
  });

  /* ===== Modal de pago ===== */
  const $modal      = $("#myModal");
  const $efOptions  = $("#efectivo-options");
  const $amountIn   = $("#monto-recibido");
  const $changeOut  = $("#cambio");
  const $confirmBtn = $("#confirmar-pago");

  $("#generar-venta").click(() => {
    if (!productos.length) return alert("Agregue productos.");
    if (!sucursalID || !$("#puntopago_id").val()) return alert("Seleccione sucursal y punto de pago.");
    $("input[name='payment_method']").prop("checked", false);
    $efOptions.hide();
    $amountIn.val("");
    $changeOut.text("");
    $modal.show();
  });

  $(".close").click(() => $modal.hide());
  $(window).on("click", (e) => { if (e.target === $modal[0]) $modal.hide(); });

  $(document).on("change", "input[name='payment_method']", function () {
    $efOptions.toggle(this.value === "efectivo");
    $amountIn.val("");
    $changeOut.text("");
  });

  $(document).on("click", ".radio-wrap", function (e) {
    if (e.target.tagName !== "INPUT") {
      $(this).find("input[type=radio]").prop("checked", true).trigger("change");
    }
    $(this).closest(".modal-content").attr("tabindex","-1").focus();
  });

  $amountIn.on("input", function () {
    const received = parseFloat(this.value) || 0;
    const change = received - runningTotal;
    $changeOut.text(change >= 0 ? `Cambio: ${money(change)}` : "");
  }).on("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); $confirmBtn.click(); }
  });

  $confirmBtn.click(() => {
    const m = $("input[name='payment_method']:checked").val();
    if (!m) return alert("Seleccione medio de pago.");
    if (m === "efectivo") {
      const rec = parseFloat($amountIn.val()) || 0;
      if (rec < runningTotal) return alert("Monto recibido insuficiente.");
    }
    $("#medio_pago").val(m);
    $modal.hide();
    $("#venta-form").submit();
  });

  /* submit AJAX — alert positivo en éxito */
  $("#venta-form").submit(function (e) {
    e.preventDefault();
    $.post($(this).attr("action"), $(this).serialize())
      .done((r) => {
        if (r.success) {
          alert("✅ ¡Venta generada correctamente!");
          location.reload();
        } else {
          alert(r.error || "Error");
        }
      })
      .fail(() => alert("Error de red"));
  });

  /* filtro carrito */
  $("#buscar-detalles").on("keyup", function () {
    const t = $(this).val().toLowerCase();
    $tbody.find("tr").each(function () { $(this).toggle($(this).text().toLowerCase().includes(t)); });
  });

  /* init */
  enableQtyAndAdd(false);

  /* 🔦 Detector global de pistola (keyboard-wedge) */
  (function globalScannerDetector() {
    const MIN_CHARS = 8;
    const GAP_MS    = 35;

    let buf = "", first = 0, last = 0, idleTimer = null;
    function reset(){ buf=""; first=0; last=0; if(idleTimer){clearTimeout(idleTimer); idleTimer=null;} }

    document.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.altKey || e.metaKey) { reset(); return; }

      const t = Date.now();
      if (e.key === "Enter" || e.key === "Tab") {
        const fastEnough = buf && (t - first) < buf.length * (GAP_MS + 5) && (t - last) < GAP_MS * 3;
        if (fastEnough && buf.length >= MIN_CHARS) {
          e.preventDefault(); e.stopImmediatePropagation();
          const code = buf; reset();
          const $bc = $("#producto_busqueda_codigo_barras");
          $bc.val(code); try { $bc.autocomplete("close"); } catch (_){}
          instantFromBarcode(code);
          fillFromBarcode(code);
          return;
        }
        reset(); return;
      }

      if (e.key && e.key.length === 1) {
        if (buf && (t - last) > GAP_MS) { buf = ""; first = t; }
        if (!buf) first = t;
        buf += e.key; last = t;
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(reset, GAP_MS * 5);
      } else {
        if (e.key !== "Shift") reset();
      }
    }, true);
  })();

});
