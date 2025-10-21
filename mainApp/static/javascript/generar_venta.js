// static/javascript/generar_venta.js
$(function () {
  "use strict";
  const $ = window.jQuery;

  console.log("⚡ generar_venta.js — AC instantáneos + carrito sin límite de stock + atajos + cambio en efectivo");

  /* ================== URLs inyectadas ================== */
  const SUCURSAL_URL   = window.sucursalAutocompleteUrl;
  const PUNTOPAGO_URL  = window.puntopagoAutocompleteUrl;
  const CLIENTE_URL    = window.clienteAutocompleteUrl;
  const PRODUCTO_URL   = window.productoAutocompleteUrl;
  const AC_CODIGO_URL  = window.productoAutocompleteCodigoUrl || PRODUCTO_URL;
  const AC_BARRAS_URL  = window.productoAutocompleteBarrasUrl || PRODUCTO_URL;
  const VERIFICAR_URL  = window.verificarProductoUrl;
  const POR_COD_URL    = window.buscarProductoPorCodigoUrl;

  /* ================== Agente local ================== */
  const POS_AGENT_URL   = (window.POS_AGENT_URL || "http://127.0.0.1:8787").replace(/\/+$/,'');
  const POS_AGENT_TOKEN = (window.POS_AGENT_TOKEN || "").trim();

  /* ================== Selectores ================== */
  const $inpCliente   = $("#cliente_busqueda");
  const $inpNombre    = $("#producto_busqueda_nombre");
  const $inpCodeOrBar = $("#codigo_o_barras");
  const $pid          = $("#producto_id");
  const $cantidad     = $("#cantidad");
  const $agregar      = $("#agregar-producto");
  const $tbody        = $("#detalle-productos tbody");
  const $totalEl      = $("#total");
  const $buscarCart   = $("#buscar-detalles");
  const $btnVaciar    = $("#vaciar-carrito");

  /* ================== Utilidades ================== */
  const money = (n) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(Number(n) || 0);

  $.ajaxSetup({
    beforeSend: (xhr, settings) => {
      if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type)) {
        const m = document.cookie.match(/csrftoken=([^;]+)/);
        if (m) xhr.setRequestHeader("X-CSRFToken", m[1]);
      }
    },
    cache: true,
  });

  /* ================== Estado persistido ================== */
  let sucursalID = (localStorage.getItem("sucursalID") || "").toString().match(/\d+/)?.[0] || "";
  const savedPunto = {
    id:  localStorage.getItem("puntopagoID") || "",
    name:localStorage.getItem("puntopagoName") || "",
    suc: localStorage.getItem("puntopagoSucursalID") || ""
  };
  const hasSucursal = () => /^\d+$/.test(String(sucursalID || ""));

  /* ================== Estado venta ================== */
  const productos  = [];    // ["123","456",...]
  const cantidades = [];    // [  2 ,  1 , ...]
  let runningTotal = 0;
  let lastAddedPid = null;
  window.runningTotal = runningTotal;

  /* ================== Cache producto ================== */
  const FRESH_MS = 120000; // 2 minutos
  const productCache = new Map(); // pid -> {nombre, barcode, price, stock, ts}
  const barcodeIndex = new Map(); // barcode -> pid
  const nameIndex    = new Map(); // lower(nombre) -> pid
  const now = () => Date.now();
  const isFresh = (ts) => ts && now() - ts < FRESH_MS;

  const onlyName = (s) => {
    s = String(s || "").trim();
    s = s.replace(/^[\s•·\-\u2013\u2014:|.,;]+/, "");
    let m;
    const rx = /^\s*(?:\[\s*)?([A-Za-z0-9._-]{3,}|\d{6,})(?:\s*\])?\s*(?:-|–|—|:|\|)\s*(.*)$/;
    while ((m = s.match(rx))) s = (m[2] || "").trim();
    const m2 = s.match(/^\s*\d{6,}\s+(.+)$/);
    if (m2) s = m2[1].trim();
    s = s.replace(/^[\s•·\-\u2013\u2014:|.,;]+/, "");
    return s;
  };

  function enableQtyAndAdd(enable) {
    $cantidad.prop("disabled", !enable);
    $agregar.prop("disabled", !enable);
  }
  function focusQtyIfPid() {
    if ($pid.val()) {
      enableQtyAndAdd(true);
      setTimeout(() => { $cantidad.focus().select(); }, 0);
    }
  }
  function setProductFields({ nombre, pid, barcode }) {
    if (nombre != null) $inpNombre.val(onlyName(nombre));
    if (pid != null)    $pid.val(pid);
    if (barcode != null) $inpCodeOrBar.val(barcode);
    focusQtyIfPid();
  }

  function updateCache(pid, data = {}) {
    const key = String(pid);
    const prev = productCache.get(key) || {};
    const rec = {
      nombre: onlyName(data.nombre ?? prev.nombre ?? ""),
      barcode: data.codigo_de_barras ?? data.barcode ?? prev.barcode ?? "",
      price: data.precio_unitario ?? data.price ?? prev.price,
      stock: data.cantidad_disponible ?? data.stock ?? prev.stock,
      ts: data.ts || now(),
    };
    productCache.set(key, rec);
    if (rec.barcode) barcodeIndex.set(rec.barcode, key);
    if (rec.nombre)  nameIndex.set(rec.nombre.toLowerCase(), key);
    return rec;
  }
  function instantFromPid(pid) {
    const rec = productCache.get(String(pid));
    if (!rec) return false;
    if (!$inpNombre.val()) $inpNombre.val(rec.nombre || "");
    if (!$inpCodeOrBar.val() && rec.barcode) $inpCodeOrBar.val(rec.barcode);
    $pid.val(pid);
    enableQtyAndAdd(true);
    focusQtyIfPid();
    return true;
  }
  function instantFromBarcode(code) {
    const pid = barcodeIndex.get(code);
    const ok = pid ? instantFromPid(pid) : false;
    if (ok) focusQtyIfPid();
    return ok;
  }
  function instantFromName(name) {
    const pid = nameIndex.get((onlyName(name) || "").toLowerCase());
    const ok = pid ? instantFromPid(pid) : false;
    if (ok) focusQtyIfPid();
    return ok;
  }

  /* ================== Agregar al carrito (SIN tope por stock) ================== */
  function setTotal(v) {
    runningTotal = v;
    window.runningTotal = v;
    $totalEl.text(money(runningTotal));
    $("#productos").val(JSON.stringify(productos));
    $("#cantidades").val(JSON.stringify(cantidades));
  }
  function addToTotal(delta) { setTotal(runningTotal + (Number(delta) || 0)); }

  async function addToCart(pid, qty = 1) {
    if (!pid || !qty || qty < 1) return;
    const key = String(pid);
    const cached = productCache.get(key);

    const doAppend = (nombre, price, qtyAdd) => {
      const idx = productos.indexOf(key);
      lastAddedPid = key;

      if (idx > -1) {
        cantidades[idx] += qtyAdd;
        const $row = $tbody.find(`tr[data-pid='${pid}']`);
        const newQty = cantidades[idx];
        $row.attr("data-qty", newQty);
        $row.find(".qty-input").val(newQty);
        $row.find(".subtotal-cell").text(money(price * newQty));
        addToTotal(price * qtyAdd);
      } else {
        productos.push(key);
        cantidades.push(qtyAdd);
        const subtotal = price * qtyAdd;
        $tbody.prepend(`
          <tr data-pid="${pid}" data-price="${price}" data-qty="${qtyAdd}">
            <td data-id="${pid}">${onlyName(cached?.nombre || nombre || "")}</td>
            <td>
              <input type="number" class="qty-input" min="1" value="${qtyAdd}" />
            </td>
            <td class="price-cell">${money(price)}</td>
            <td class="subtotal-cell">${money(subtotal)}</td>
            <td class="text-center">
              <button class="btn btn-chip-danger eliminar-producto" title="Eliminar">
                <i class="fas fa-trash-alt"></i><span>Eliminar</span>
              </button>
            </td>
          </tr>
        `);
        addToTotal(subtotal);
      }

      // Limpia inputs de producto
      $inpNombre.val("");
      $inpCodeOrBar.val("");
      $pid.val("");
      $cantidad.val(1);
      enableQtyAndAdd(false);
    };

    // 1) Si cache tiene precio fresco → agregar sin revisar stock
    if (cached && isFresh(cached.ts) && (cached.price != null)) {
      const price = Number(cached.price) || 0;
      doAppend(cached.nombre, price, qty);
      // refresh silencioso opcional
      try {
        $.post(VERIFICAR_URL, { producto_id: pid, cantidad: 1, sucursal_id: sucursalID })
          .done(r => { if (r) updateCache(pid, r); });
      } catch(_){}
      return;
    }

    // 2) Verificar datos en backend, PERO no bloquear por stock
    try {
      const r = await $.post(VERIFICAR_URL, { producto_id: pid, cantidad: qty, sucursal_id: sucursalID });
      const rec = updateCache(pid, r || {});
      const price = Number(rec.price) || Number(r?.precio_unitario) || 0;
      doAppend(onlyName(rec.nombre), price, qty);
    } catch (e) {
      console.error(e);
      const price = Number(cached?.price) || 0;
      doAppend(onlyName(cached?.nombre), price, qty);
    }
  }

  /* ================== Resolutores rápidos ================== */
  async function resolveByProductId(pid) {
    if (!pid) return null;
    try {
      const r = await $.post(VERIFICAR_URL, { producto_id: pid, cantidad: 1, sucursal_id: sucursalID });
      if (!r) return null;
      const rec = updateCache(pid, r);
      setProductFields({ nombre: rec.nombre, pid, barcode: rec.barcode });
      return pid;
    } catch { return null; }
  }

  async function resolveByBarcode(code) {
    if (!code) return null;
    try {
      const r = await $.getJSON(POR_COD_URL, { codigo_de_barras: code, sucursal_id: sucursalID });
      if (!r) return null;
      const p = r.producto || {};
      updateCache(p.id, {
        nombre: p.nombre,
        barcode: p.codigo_de_barras,
        precio_unitario: p.precio,
        cantidad_disponible: p.stock
      });
      setProductFields({ nombre: p.nombre, pid: p.id, barcode: p.codigo_de_barras });
      return p.id;
    } catch { return null; }
  }

  /* ================== FAST AC infra ================== */
  const norm   = s => (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
  const tokens = q => norm(q).split(/\s+/).filter(Boolean);
  const matchesAll = (text, q) => { const t=norm(text), toks=tokens(q); for(const k of toks) if(!t.includes(k)) return false; return true; };
  const score = (text, q) => {
    const t=norm(text), s=norm(q); if(!s) return 1;
    if(t===s) return 1e6; let sc=0;
    if(t.startsWith(s)) sc+=800;
    const idx=t.indexOf(s); if(idx>=0) sc += Math.max(0, 500-idx*4);
    sc += Math.max(0, 150 - Math.abs(t.length-s.length)*6);
    return sc;
  };
  const rankFilter = (arr, q, max=40) =>
    arr.filter(r=>matchesAll(r.label||r.text||r.name||"",q))
       .map(r=>({r,sc:score(r.label||r.text||r.name||"",q)}))
       .sort((a,b)=>b.sc-a.sc || String(a.r.label||a.r.text).localeCompare(String(b.r.label||b.r.text)))
       .slice(0,max).map(x=>x.r);

  function createAC({ $inp, sourceFn, onSelect, openIfEmpty=true, enableInstantSearch=true }) {
    $inp.autocomplete({
      minLength: 0,
      delay: 0,
      autoFocus: true,
      appendTo: "body",
      position:{ my:"left top+6", at:"left bottom", collision:"flipfit" },
      source: async (req, resp) => {
        try {
          const items = await sourceFn(req.term || "");
          resp(items || []);
        } catch {
          resp([]);
        }
      },
      open(){ $inp.autocomplete("widget").css("z-index", 3000); },
      select(_e, ui){
        if (!ui || !ui.item) return false;
        onSelect?.(ui.item);
        return false;
      }
    });

    if (openIfEmpty) {
      $inp.on("focus", function(){
        if (($inp.is($inpNombre) || $inp.is($inpCodeOrBar)) && !hasSucursal()) return;
        $inp.autocomplete("search", this.value || "");
      });
    }

    if (enableInstantSearch) {
      $inp.on("input", function(){
        if (($inp.is($inpNombre) || $inp.is($inpCodeOrBar)) && !hasSucursal()) return;
        $inp.autocomplete("search", this.value || "");
      });
    }

    $inp.on("keydown", async function(e){
      if (e.key !== "Enter") return;
      const ac = $inp.data("ui-autocomplete");
      const menuVisible = ac && ac.menu && ac.menu.element.is(":visible");
      e.preventDefault();

      if (menuVisible) {
        const $first = ac.menu.element.find("li:visible .ui-menu-item-wrapper").first();
        if ($first.length) { $first.trigger("mouseenter").trigger("click"); return; }
      }

      const val = $.trim($inp.val());
      if (!val) return;
      if (!hasSucursal() && ($inp.is($inpNombre) || $inp.is($inpCodeOrBar))) {
        alert("Seleccione primero la sucursal.");
        return;
      }

      let pid = null;
      if ($inp.is($inpNombre)) {
        pid = await (async function quickByName(term){
          try{
            const url = PRODUCTO_URL + "?" + new URLSearchParams({ term, sucursal_id: sucursalID });
            const d = await fetch(url).then(r=> r.ok ? r.json() : {results:[]});
            const items = (d.results||[]).map(p=>({ id:p.id, name:p.text, label:p.text, value:p.text, price:p.precio, stock:p.stock }));
            const best = rankFilter(items, term, 1)[0];
            if (!best) return null;
            updateCache(best.id, { nombre:best.name, precio_unitario:best.price, cantidad_disponible:best.stock });
            instantFromPid(best.id);
            return best.id;
          }catch{ return null; }
        })(val);
      } else if ($inp.is($inpCodeOrBar)) {
        if (/^\d{6,}$/.test(val)) {
          pid = await resolveByBarcode(val);
          if (!pid) pid = await resolveByProductId(val);
        } else {
          pid = await resolveByProductId(val);
          if (!pid) pid = await resolveByBarcode(val);
        }
      }

      if (pid) addToCart(pid, 1);
    });
  }

  /* ================== Fuentes para AC ================== */
  // Productos por nombre
  createAC({
    $inp: $inpNombre,
    sourceFn: async (term) => {
      if (!hasSucursal()) return [];
      const url = PRODUCTO_URL + "?" + new URLSearchParams({ term, sucursal_id: sucursalID });
      const d = await fetch(url).then(r=> r.ok ? r.json() : {results:[]});
      const items = (d.results||[]).map(p => ({
        id:p.id, name:p.text, label:p.text, value:p.text, price:p.precio, stock:p.stock
      }));
      return rankFilter(items, term, 40);
    },
    onSelect: (item) => {
      updateCache(item.id, { nombre:item.name, precio_unitario:item.price, cantidad_disponible:item.stock });
      instantFromPid(item.id);
      addToCart(item.id, 1);
    }
  });

  // Unificado código o barras
  createAC({
    $inp: $inpCodeOrBar,
    sourceFn: async (term) => {
      if (!hasSucursal()) return [];
      const wantBarras = /^\d{6,}$/.test(term);

      const [dCod, dBar] = await Promise.all([
        fetch(AC_CODIGO_URL + "?" + new URLSearchParams({ term, sucursal_id: sucursalID })).then(r=> r.ok ? r.json() : {results:[]}),
        fetch(AC_BARRAS_URL + "?" + new URLSearchParams({ term, sucursal_id: sucursalID })).then(r=> r.ok ? r.json() : {results:[]}),
      ]);

      const arr = [];
      const seen = new Set();
      const push = (obj) => {
        const key = String(obj.id) + "::" + (obj.barcode||"");
        if (seen.has(key)) return;
        seen.add(key);
        arr.push(obj);
      };

      (dBar.results||[]).forEach(p=>{
        push({ id:p.id, name:p.text||"", label:(p.barcode||p.codigo_de_barras||p.text||String(p.id)), value:(p.barcode||p.codigo_de_barras||p.text||String(p.id)), barcode:(p.barcode||p.codigo_de_barras||""), price:p.precio, stock:p.stock });
      });
      (dCod.results||[]).forEach(p=>{
        push({ id:p.id, name:p.text||"", label:(p.text||String(p.id)), value:(p.text||String(p.id)), barcode:p.barcode||p.codigo_de_barras||"", price:p.precio, stock:p.stock });
      });

      const ranked = wantBarras
        ? arr.sort((a,b)=> (b.barcode?1:0) - (a.barcode?1:0))
        : rankFilter(arr, term, 40);
      return ranked.slice(0, 40);
    },
    onSelect: (item) => {
      updateCache(item.id, { nombre:item.name, barcode:item.barcode, precio_unitario:item.price, cantidad_disponible:item.stock });
      instantFromPid(item.id);
      addToCart(item.id, 1);
    }
  });

  /* ================== Prefill sucursal/punto ================== */
  if (sucursalID) {
    $("#sucursal_autocomplete").val(localStorage.getItem("sucursalName") || "");
    $("#sucursal_id").val(sucursalID);
  }
  if (savedPunto.id && savedPunto.suc && savedPunto.suc.toString() === sucursalID) {
    $("#puntopago_autocomplete").val(savedPunto.name || "");
    $("#puntopago_id").val(savedPunto.id);
  }

  // Sucursal
  createAC({
    $inp: $("#sucursal_autocomplete"),
    sourceFn: async (term) => {
      const d = await fetch(SUCURSAL_URL + "?" + new URLSearchParams({ term })).then(r=> r.ok ? r.json() : {results:[]});
      return (d.results||[]).map(r=>({ id:r.id, label:r.text, value:r.text, name:r.text }));
    },
    onSelect: ({ id, label }) => {
      sucursalID = String(id).match(/\d+/)?.[0] || "";
      $("#sucursal_id").val(sucursalID);
      $("#sucursal_autocomplete").val(label);
      localStorage.setItem("sucursalID", sucursalID);
      localStorage.setItem("sucursalName", label);

      const ppSuc = localStorage.getItem("puntopagoSucursalID");
      if (ppSuc && ppSuc !== String(sucursalID)) {
        $("#puntopago_autocomplete").val("");
        $("#puntopago_id").val("");
        localStorage.removeItem("puntopagoID");
        localStorage.removeItem("puntopagoName");
        localStorage.removeItem("puntopagoSucursalID");
      }
      enableQtyAndAdd(false);
    }
  });

  // Punto de pago
  createAC({
    $inp: $("#puntopago_autocomplete"),
    sourceFn: async (term) => {
      if (!hasSucursal()) return [];
      const d = await fetch(PUNTOPAGO_URL + "?" + new URLSearchParams({ term, sucursal_id: sucursalID })).then(r=> r.ok ? r.json() : {results:[]});
      return (d.results||[]).map(r=>({ id:r.id, label:r.text, value:r.text, name:r.text }));
    },
    onSelect: ({ id, label }) => {
      $("#puntopago_autocomplete").val(label);
      $("#puntopago_id").val(id);
      localStorage.setItem("puntopagoID", id);
      localStorage.setItem("puntopagoName", label);
      localStorage.setItem("puntopagoSucursalID", sucursalID || "");
    }
  });

  // Cliente
  createAC({
    $inp: $inpCliente,
    sourceFn: async (term) => {
      const d = await fetch(CLIENTE_URL + "?" + new URLSearchParams({ term })).then(r=> r.ok ? r.json() : {results:[]});
      return (d.results||[]).map(c=>({ id:c.id, label:c.text, value:c.text, name:c.text }));
    },
    onSelect: ({ id, label }) => {
      $inpCliente.val(label);
      $("#cliente_id").val(id);
    }
  });

  /* ================== Cross-fill y confirmaciones ================== */
  $inpNombre.on("input", function(){ const nm=$.trim(this.value); if (nm) instantFromName(nm); });
  $inpCodeOrBar.on("input", function(){ const v=$.trim(this.value); if (v) { if (/^\d{6,}$/.test(v)) instantFromBarcode(v); else instantFromPid(v); } });

  // Botón agregar
  $agregar.on("click", async () => {
    const pid = $pid.val();
    const qty = parseInt($cantidad.val(), 10);
    if (!pid || !qty || qty < 1) return alert("Datos inválidos.");
    await addToCart(pid, qty);
  });

  // Enter en cantidad = agregar
  $cantidad.on("keydown", function (e) {
    if (e.key === "Enter" && !$agregar.prop("disabled")) {
      e.preventDefault();
      $agregar.click();
    }
  });

  // Editar cantidad inline (SIN cap por stock)
  $tbody.on("input change", ".qty-input", function () {
    const $row  = $(this).closest("tr");
    const pid   = $row.data("pid").toString();
    const price = Number($row.data("price")) || 0;

    let newQty  = parseInt(this.value, 10);
    if (!newQty || newQty < 1) newQty = 1;

    const oldQty = Number($row.attr("data-qty")) || 0;
    if (newQty === oldQty) return;

    $row.attr("data-qty", newQty);
    const i = productos.indexOf(pid);
    if (i > -1) cantidades[i] = newQty;

    $row.find(".subtotal-cell").text(money(price * newQty));
    addToTotal(price * (newQty - oldQty));
  });

  // Eliminar fila
  $tbody.on("click", ".eliminar-producto", function () {
    const $row = $(this).closest("tr");
    const pid = $row.data("pid").toString();
    const idx = productos.indexOf(pid);
    const price = Number($row.data("price")) || 0;
    const qty   = Number($row.attr("data-qty")) || 0;
    addToTotal(-(price * qty));
    if (idx > -1) { productos.splice(idx, 1); cantidades.splice(idx, 1); }
    $row.remove();
  });

  // Vaciar carrito
  $btnVaciar.on("click", function(){
    if (!productos.length) return;
    if (!confirm("¿Vaciar todo el carrito?")) return;
    productos.length = 0;
    cantidades.length = 0;
    $tbody.empty();
    setTotal(0);
  });

  // Filtro carrito
  $buscarCart.on("keyup", function () {
    const t = $(this).val().toLowerCase();
    $tbody.find("tr").each(function () { $(this).toggle($(this).text().toLowerCase().includes(t)); });
  });

  /* ================== Modal de pago ================== */
  const $modal      = $("#myModal");
  const $efOptions  = $("#efectivo-options");
  const $amountIn   = $("#monto-recibido");
  const $changeOut  = $("#cambio");
  const $confirmBtn = $("#confirmar-pago");

  $("#generar-venta").click(() => {
    if (!productos.length) return alert("Agregue productos.");
    if (!hasSucursal() || !$("#puntopago_id").val()) return alert("Seleccione sucursal y punto de pago.");
    $("input[name='payment_method']").prop("checked", false);
    $efOptions.hide();
    $amountIn.val("");
    $changeOut.text("");

    $("#modal-total").text(money(runningTotal));
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

  /* ================== Agente local helpers ================== */
  async function agentPrint(text) {
    const url = POS_AGENT_URL + "/print";
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pos-Agent-Token": POS_AGENT_TOKEN
      },
      body: JSON.stringify({ text })
    });
    if (!resp.ok) throw new Error("Agente /print devolvió " + resp.status);
    return resp.json().catch(()=>({}));
  }
  async function agentKick() {
    const url = POS_AGENT_URL + "/kick";
    const resp = await fetch(url, {
      method: "POST",
      headers: { "X-Pos-Agent-Token": POS_AGENT_TOKEN }
    });
    if (!resp.ok) throw new Error("Agente /kick devolvió " + resp.status);
    return resp.json().catch(()=>({}));
  }

  /* ================== Submit con CAMBIO en alert final ================== */
  $("#venta-form").submit(function (e) {
    e.preventDefault();

    $.post($(this).attr("action"), $(this).serialize())
      .done(async (r) => {
        if (!r || !r.success) {
          alert((r && r.error) || "Error");
          return;
        }

        const metodo   = ($("#medio_pago").val() || "").toLowerCase();
        const efectivo = metodo === "efectivo";
        const recibido = efectivo ? (parseFloat($("#monto-recibido").val()) || 0) : 0;
        const cambio   = efectivo ? Math.max(0, recibido - (window.runningTotal || runningTotal || 0)) : 0;
        const cambioTxt = efectivo ? `\n\nCambio a entregar: ${money(cambio)}` : "";

        const quiereImprimir = confirm("✅ Venta generada.\n\n¿Desea imprimir la factura?");
        try {
          if (quiereImprimir) {
            await agentPrint(r.receipt_text || "Factura\n\n");
            await new Promise(res => setTimeout(res, 200));
            await agentKick();
            alert(`Factura enviada a la impresora y gaveta abierta.${cambioTxt}`);
          } else {
            await agentKick();
            alert(`Gaveta abierta.${cambioTxt}`);
          }
        } catch (err) {
          console.error(err);
          alert(
            "La venta fue creada, pero no se pudo comunicar con el agente local.\n" +
            "¿Está abierto el agente en este equipo? (127.0.0.1:8787)\n" +
            "Detalle: " + err.message + cambioTxt
          );
        }

        location.reload();
      })
      .fail(() => alert("Error de red"));
  });

  /* ================== Atajos de teclado ================== */
  $(document).on("keydown", function (e) {
    if (!e.ctrlKey || e.altKey || e.metaKey) return;
    const focusAndSelect = ($el) => { $el.focus(); $el[0]?.select?.(); };

    switch (e.key) {
      case "0":
        e.preventDefault(); focusAndSelect($inpCliente); break;
      case "1":
        e.preventDefault(); focusAndSelect($inpNombre); break;
      case "2":
        e.preventDefault(); focusAndSelect($inpCodeOrBar); break;
      case "3":
        e.preventDefault(); focusAndSelect($buscarCart); break;
      case "4":
        e.preventDefault();
        if (lastAddedPid) {
          const $row = $tbody.find(`tr[data-pid='${lastAddedPid}']`);
          const $q = $row.find(".qty-input");
          if ($q.length) focusAndSelect($q);
          else focusAndSelect($cantidad);
        } else {
          focusAndSelect($cantidad);
        }
        break;
      default: break;
    }
  });

  /* ================== Detector global de pistola ================== */
  (function globalScannerDetector() {
    const MIN_CHARS = 8, GAP_MS = 35;
    let buf="", first=0, last=0, idleTimer=null;
    function reset(){ buf=""; first=0; last=0; if(idleTimer){clearTimeout(idleTimer); idleTimer=null;} }

    document.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.altKey || e.metaKey) { reset(); return; }
      const t = Date.now();

      if (e.key === "Enter" || e.key === "Tab") {
        const fastEnough = buf && (t-first) < buf.length * (GAP_MS+5) && (t-last) < GAP_MS*3;
        if (fastEnough && buf.length >= MIN_CHARS) {
          e.preventDefault(); e.stopImmediatePropagation();
          const code = buf; reset();

          $inpCodeOrBar.val(code);
          try { $inpCodeOrBar.autocomplete("close"); } catch (_){}
          if (!hasSucursal()) { alert("Seleccione primero la sucursal."); return; }

          resolveByBarcode(code).then(pid => { if (pid) addToCart(pid, 1); });
          return;
        }
        reset(); return;
      }

      if (e.key && e.key.length === 1) {
        if (buf && (t-last) > GAP_MS) { buf = ""; first = t; }
        if (!buf) first = t;
        buf += e.key; last = t;
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(reset, GAP_MS*5);
      } else {
        if (e.key !== "Shift") reset();
      }
    }, true);
  })();

  /* ================== Init ================== */
  enableQtyAndAdd(false);
  if (!POS_AGENT_TOKEN) {
    console.warn("[POS_AGENT] Token vacío: el agente rechazará la petición (401). Verifica el context_processor y settings.");
  }
});
