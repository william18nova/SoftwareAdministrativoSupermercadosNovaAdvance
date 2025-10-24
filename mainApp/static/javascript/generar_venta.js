// static/javascript/generar_venta.js
$(function () {
  "use strict";
  const $ = window.jQuery;

  console.log("⚡ generar_venta.js — AC instantáneos + agregado inmediato + atajos (Ctrl & Alt) + modal pagos + SNAPSHOT L1 cache");

  /* ================== URLs inyectadas ================== */
  const SUCURSAL_URL   = window.sucursalAutocompleteUrl;
  const PUNTOPAGO_URL  = window.puntopagoAutocompleteUrl;
  const CLIENTE_URL    = window.clienteAutocompleteUrl;
  const PRODUCTO_URL   = window.productoAutocompleteUrl;
  const AC_CODIGO_URL  = window.productoAutocompleteCodigoUrl || PRODUCTO_URL;
  const AC_BARRAS_URL  = window.productoAutocompleteBarrasUrl || PRODUCTO_URL;
  const VERIFICAR_URL  = window.verificarProductoUrl;
  const POR_COD_URL    = window.buscarProductoPorCodigoUrl;

  // 🔥 endpoint súper rápido con catálogo de la sucursal
  const SNAPSHOT_URL   = (window.productoSnapshotUrl || "/api/productos/snapshot/");

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

  /* ================== Util ================== */
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
  const productos  = [];
  const cantidades = [];
  let runningTotal = 0;
  let lastAddedPid = null;
  window.runningTotal = runningTotal;

  /* ================== Cache producto / índices ================== */
  const FRESH_MS = 120000;
  const productCache = new Map();
  const barcodeIndex = new Map();
  const nameIndex    = new Map();

  // 🔥 catálogo local (snapshot) por sucursal
  const catalogBySucursal = new Map();
  const catalogTS         = new Map();
  const CATALOG_TTL_MS    = 5 * 60 * 1000;

  let inflightNameAC = null;
  let inflightCodeAC = null;

  // foco post-agregado
  let nextFocusTarget = "code"; // 'code' | 'product'

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

  function focusAfterAdd() {
    setTimeout(() => {
      if (nextFocusTarget === "product") {
        $inpNombre.focus(); $inpNombre[0]?.select?.();
        try { $inpNombre.autocomplete("search", $inpNombre.val() || ""); } catch {}
      } else {
        $inpCodeOrBar.focus(); $inpCodeOrBar[0]?.select?.();
      }
      nextFocusTarget = "code";
    }, 0);
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

  /* ============ SNAPSHOT L1 ============ */
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

  function hydrateIndicesFromCatalog(sid, items) {
    for (const p of items) {
      updateCache(p.id, {
        nombre: p.name,
        barcode: p.barcode,
        precio_unitario: p.price,
        cantidad_disponible: p.stock,
      });
    }
  }
  function loadCatalogFromLocalStorage(sid) {
    try {
      const raw = localStorage.getItem(`catalog_${sid}`);
      const ts  = Number(localStorage.getItem(`catalog_${sid}_ts`)||0);
      if (!raw) return false;
      if (now()-ts > CATALOG_TTL_MS) return false;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return false;
      catalogBySucursal.set(sid, arr);
      catalogTS.set(sid, ts);
      hydrateIndicesFromCatalog(sid, arr);
      return true;
    } catch { return false; }
  }
  async function fetchCatalogSnapshot(sid) {
    const url = SNAPSHOT_URL + "?" + new URLSearchParams({ sucursal_id: sid });
    const r = await fetch(url);
    if (!r.ok) throw new Error("snapshot HTTP " + r.status);
    const d = await r.json();
    const items = Array.isArray(d.results) ? d.results : [];
    catalogBySucursal.set(sid, items);
    catalogTS.set(sid, now());
    try {
      localStorage.setItem(`catalog_${sid}`, JSON.stringify(items));
      localStorage.setItem(`catalog_${sid}_ts`, String(now()));
    } catch {}
    hydrateIndicesFromCatalog(sid, items);
    return items;
  }
  async function ensureCatalog(sid, {force=false}={}) {
    if (!sid) return [];
    if (!force && catalogBySucursal.has(sid)) return catalogBySucursal.get(sid) || [];
    if (!force && loadCatalogFromLocalStorage(sid)) return catalogBySucursal.get(sid) || [];
    try { return await fetchCatalogSnapshot(sid); }
    catch { return catalogBySucursal.get(sid) || []; }
  }

  /* ================== Agregar al carrito ================== */
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
            <td><input type="number" class="qty-input" min="1" value="${qtyAdd}" /></td>
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

      $inpNombre.val("");
      $inpCodeOrBar.val("");
      $pid.val("");
      $cantidad.val(1);
      enableQtyAndAdd(false);

      focusAfterAdd();
    };

    if (cached && isFresh(cached.ts) && (cached.price != null)) {
      if (cached.stock != null && qty > cached.stock) return alert(`Solo ${cached.stock} disponibles.`);
      const price = Number(cached.price) || 0;
      doAppend(cached.nombre, price, qty);
      try {
        $.post(VERIFICAR_URL, { producto_id: pid, cantidad: 1, sucursal_id: sucursalID })
          .done(r => { if (r && r.exists) updateCache(pid, r); });
      } catch(_){}
      return;
    }

    try {
      const r = await $.post(VERIFICAR_URL, { producto_id: pid, cantidad: qty, sucursal_id: sucursalID });
      if (!r.exists) return alert("Sin stock/sucursal.");
      if (r.cantidad_disponible < qty) return alert(`Solo ${r.cantidad_disponible} disponibles.`);
      const rec = updateCache(pid, r);
      doAppend(onlyName(rec.nombre), Number(rec.precio_unitario) || 0, qty);
    } catch (e) {
      console.error(e);
      alert("No se pudo verificar el producto.");
    }
  }

  /* ================== Resolutores rápidos ================== */
  async function resolveByProductId(pid) {
    if (!pid) return null;
    try {
      const r = await $.post(VERIFICAR_URL, { producto_id: pid, cantidad: 1, sucursal_id: sucursalID });
      if (!r || !r.exists) return null;
      const rec = updateCache(pid, r);
      setProductFields({ nombre: rec.nombre, pid, barcode: rec.barcode });
      return pid;
    } catch { return null; }
  }
  async function resolveByBarcode(code) {
    if (!code) return null;
    if (instantFromBarcode(code)) return $pid.val() || null;

    try {
      const r = await $.getJSON(POR_COD_URL, { codigo_de_barras: code, sucursal_id: sucursalID });
      if (!r || !r.exists) return null;
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

  /* ================== Autocomplete infra ================== */
  function createAC({ $inp, sourceFn, onSelect, openIfEmpty=true, enableInstantSearch=true }) {
    $inp.autocomplete({
      minLength: 0,
      delay: 0,
      autoFocus: true,
      appendTo: "body",
      position:{ my:"left top+6", at:"left bottom", collision:"flipfit" },
      source: async (req, resp) => {
        try { resp(await sourceFn(req.term || "")); }
        catch { resp([]); }
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
      let raf = null;
      $inp.on("input", function(){
        if (($inp.is($inpNombre) || $inp.is($inpCodeOrBar)) && !hasSucursal()) return;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(()=> $inp.autocomplete("search", this.value || ""));
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
        const cat = await ensureCatalog(sucursalID);
        const items = cat.map(p=>({ id:p.id, name:p.name, label:p.name, value:p.name, price:p.price, stock:p.stock }));
        const best = rankFilter(items, val, 1)[0];
        if (best) {
          updateCache(best.id, { nombre:best.name, precio_unitario:best.price, cantidad_disponible:best.stock });
          instantFromPid(best.id);
          pid = best.id;
        } else {
          pid = await (async function quickByName(term){
            try{
              inflightNameAC?.abort?.();
              inflightNameAC = new AbortController();
              const url = PRODUCTO_URL + "?" + new URLSearchParams({ term, sucursal_id: sucursalID, limit: 15 });
              const d = await fetch(url, { signal: inflightNameAC.signal }).then(r=> r.ok ? r.json() : {results:[]});
              const items = (d.results||[]).map(p=>({ id:p.id, name:p.text, label:p.text, value:p.text, price:p.precio, stock:p.stock }));
              const best = rankFilter(items, term, 1)[0];
              if (!best) return null;
              updateCache(best.id, { nombre:best.name, precio_unitario:best.price, cantidad_disponible:best.stock });
              instantFromPid(best.id);
              return best.id;
            }catch{ return null; }
          })(val);
        }
      } else if ($inp.is($inpCodeOrBar)) {
        if (/^\d{6,}$/.test(val)) {
          pid = await resolveByBarcode(val);
          if (!pid) pid = await resolveByProductId(val);
        } else {
          const cat = await ensureCatalog(sucursalID);
          const items = cat.map(p=>({ id:p.id, name:p.name, label:p.name, value:p.name, price:p.price, stock:p.stock }));
          const best = rankFilter(items, val, 1)[0];
          if (best) {
            updateCache(best.id, { nombre:best.name, precio_unitario:best.price, cantidad_disponible:best.stock });
            instantFromPid(best.id);
            pid = best.id;
          } else {
            pid = await resolveByProductId(val) || await resolveByBarcode(val);
          }
        }
      }
      if (pid) addToCart(pid, 1);
    });
  }

  /* ================== AC por nombre ================== */
  createAC({
    $inp: $inpNombre,
    sourceFn: async (term) => {
      if (!hasSucursal()) return [];
      const cat = await ensureCatalog(sucursalID);
      const itemsLocal = cat.map(p => ({
        id:p.id, name:p.name, label:p.name, value:p.name, price:p.price, stock:p.stock
      }));
      const locals = rankFilter(itemsLocal, term, 40);

      try {
        inflightNameAC?.abort?.();
        inflightNameAC = new AbortController();
        const url = PRODUCTO_URL + "?" + new URLSearchParams({ term, sucursal_id: sucursalID, limit: 40 });
        const d = await fetch(url, { signal: inflightNameAC.signal }).then(r=> r.ok ? r.json() : {results:[]});
        const fromNet = (d.results||[]).map(p => ({
          id:p.id, name:p.text, label:p.text, value:p.text, price:p.precio, stock:p.stock
        }));
        fromNet.forEach(p => updateCache(p.id, { nombre:p.name, precio_unitario:p.price, cantidad_disponible:p.stock }));
        const seen = new Set(locals.map(x=>String(x.id)));
        for (const r of fromNet) { if (!seen.has(String(r.id))) locals.push(r); if (locals.length>=40) break; }
      } catch {}
      return locals.slice(0,40);
    },
    onSelect: (item) => {
      updateCache(item.id, { nombre:item.name, precio_unitario:item.price, cantidad_disponible:item.stock });
      instantFromPid(item.id);
      addToCart(item.id, 1);
    }
  });

  /* ================== AC código/barras ================== */
  createAC({
    $inp: $inpCodeOrBar,
    sourceFn: async (term) => {
      if (!hasSucursal()) return [];
      const wantBarras = /^\d{6,}$/.test(term);
      const cat = await ensureCatalog(sucursalID);
      const base = [];
      const push = (o) => { if (!o) return; base.push(o); };
      for (const p of cat) {
        const bLabel = p.barcode || "";
        if (wantBarras && bLabel) {
          push({ id:p.id, name:p.name, label:bLabel, value:bLabel, barcode:bLabel, price:p.price, stock:p.stock });
        } else {
          push({ id:p.id, name:p.name, label:p.name, value:p.name, barcode:p.barcode||"", price:p.price, stock:p.stock });
        }
      }
      let locals = wantBarras
        ? base.filter(x => (x.label||"").includes(term)).slice(0, 40)
        : rankFilter(base, term, 40);

      try {
        inflightCodeAC?.abort?.();
        inflightCodeAC = new AbortController();
        const [dCod, dBar] = await Promise.all([
          fetch(AC_CODIGO_URL + "?" + new URLSearchParams({ term, sucursal_id: sucursalID, limit: 25 }), { signal: inflightCodeAC.signal }).then(r=> r.ok ? r.json() : {results:[]}),
          fetch(AC_BARRAS_URL + "?" + new URLSearchParams({ term, sucursal_id: sucursalID, limit: 25 }), { signal: inflightCodeAC.signal }).then(r=> r.ok ? r.json() : {results:[]}),
        ]);
        const net = [];
        const seenKV = new Set();
        const add = (p, preferBarcode=false) => {
          const lbl = preferBarcode ? (p.barcode||p.codigo_de_barras||p.text||String(p.id)) : (p.text||String(p.id));
          const key = String(p.id) + "::" + (p.barcode||p.codigo_de_barras||"");
          if (seenKV.has(key)) return;
          seenKV.add(key);
          net.push({ id:p.id, name:p.text||"", label:lbl, value:lbl, barcode:(p.barcode||p.codigo_de_barras||""), price:p.precio, stock:p.stock });
        };
        (dBar.results||[]).forEach(p=> add(p, true));
        (dCod.results||[]).forEach(p=> add(p, false));

        net.forEach(p => updateCache(p.id, { nombre:p.name||p.value, barcode:p.barcode, precio_unitario:p.price, cantidad_disponible:p.stock }));
        const already = new Set(locals.map(x=>String(x.id)+"::"+(x.barcode||"")));
        for (const r of net) {
          const k=String(r.id)+"::"+(r.barcode||"");
          if (!already.has(k)) locals.push(r);
          if (locals.length>=40) break;
        }
      } catch {}

      if (wantBarras) locals.sort((a,b)=> (b.barcode?1:0) - (a.barcode?1:0));
      return locals.slice(0, 40);
    },
    onSelect: (item) => {
      updateCache(item.id, { nombre:item.name||item.value, barcode:item.barcode, precio_unitario:item.price, cantidad_disponible:item.stock });
      instantFromPid(item.id);
      addToCart(item.id, 1);
    }
  });

  /* ================== Prefill & precarga ================== */
  if (sucursalID) {
    $("#sucursal_autocomplete").val(localStorage.getItem("sucursalName") || "");
    $("#sucursal_id").val(sucursalID);
    ensureCatalog(sucursalID);
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
    onSelect: async ({ id, label }) => {
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
      await ensureCatalog(sucursalID, { force:true });
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

  /* ================== UX inputs ================== */
  $inpNombre.on("input", function(){ const nm=$.trim(this.value); if (nm) instantFromName(nm); });
  $inpCodeOrBar.on("input", function(){ const v=$.trim(this.value); if (v) { if (/^\d{6,}$/.test(v)) instantFromBarcode(v); else instantFromPid(v); } });

  $agregar.off("click").on("click", async () => {
    const pid = $pid.val();
    const qty = parseInt($cantidad.val(), 10);
    if (!pid || !qty || qty < 1) { alert("Datos inválidos."); return; }
    nextFocusTarget = "code";
    await addToCart(pid, qty);
  });

  // Enter en cantidad global: agregar → volver a PRODUCTO
  $cantidad.off("keydown").on("keydown", async function (e) {
    if (e.key === "Enter" && !$agregar.prop("disabled")) {
      e.preventDefault();
      const pid = $pid.val();
      const qty = parseInt($cantidad.val(), 10);
      if (!pid || !qty || qty < 1) { alert("Datos inválidos."); return; }
      nextFocusTarget = "product";
      await addToCart(pid, qty);
      $cantidad.blur();
      setTimeout(() => {
        $inpNombre.focus(); $inpNombre[0]?.select?.();
        try { $inpNombre.autocomplete("search", $inpNombre.val() || ""); } catch {}
      }, 0);
    }
  });

  // Editar cantidad inline
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

    const oldQty = Number($row.attr("data-qty")) || 0;
    if (newQty === oldQty) return;

    $row.attr("data-qty", newQty);
    const i = productos.indexOf(pid);
    if (i > -1) cantidades[i] = newQty;

    $row.find(".subtotal-cell").text(money(price * newQty));
    addToTotal(price * (newQty - oldQty));
  });

  // Enter en cualquier qty-input del carrito → ir a PRODUCTO (nombre)
  $tbody.on("keydown", ".qty-input", function (e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    this.blur();
    setTimeout(() => {
      $inpNombre.focus();
      $inpNombre[0]?.select?.();
      try { $inpNombre.autocomplete("search", $inpNombre.val() || ""); } catch {}
    }, 0);
  });

  // Eliminar fila con botón
  $tbody.on("click", ".eliminar-producto", function () {
    const $row = $(this).closest("tr");
    const pid = $row.data("pid").toString();
    const idx = productos.indexOf(pid);
    const price = Number($row.data("price")) || 0;
    const qty   = Number($row.attr("data-qty")) || Number($row.find(".qty-input").val()) || 0;
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

  function setCashPlaceholderToTotal() {
    $amountIn.attr("placeholder", money(runningTotal));
  }

  // ABRIR MODAL: por defecto EFECTIVO seleccionado y enfocado
  $("#generar-venta").off("click").on("click", () => {
    if (!productos.length) return alert("Agregue productos.");
    if (!hasSucursal() || !$("#puntopago_id").val()) return alert("Seleccione sucursal y punto de pago.");

    $amountIn.val("");
    $changeOut.text("");
    $("#modal-total").text(money(runningTotal));

    $("input[name='payment_method']").prop("checked", false);
    $("#efectivo").prop("checked", true);
    $efOptions.show();
    setCashPlaceholderToTotal();

    $modal.show();
    setTimeout(() => { $amountIn.focus().select(); }, 0);
  });

  // Botón cerrar / clic fuera
  $(".close").click(() => $modal.hide());
  $(window).on("click", (e) => { if (e.target === $modal[0]) $modal.hide(); });

  // ESC dentro del MODAL → cerrar
  $(document).on("keydown", function (e) {
    if (!$modal.is(":visible")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      $modal.hide();
    }
  });

  // Mostrar/Ocultar efectivo
  $(document).on("change", "input[name='payment_method']", function () {
    const isCash = this.value === "efectivo";
    $efOptions.toggle(isCash);
    $amountIn.val("");
    $changeOut.text("");
    if (isCash) {
      setCashPlaceholderToTotal();
      setTimeout(() => { $amountIn.focus().select(); }, 0);
    } else {
      $amountIn.attr("placeholder", "");
    }
  });

  // Click en contenedor radio = seleccionar
  $(document).on("click", ".radio-wrap", function (e) {
    if (e.target.tagName !== "INPUT") {
      $(this).find("input[type=radio]").prop("checked", true).trigger("change");
    }
    $(this).closest(".modal-content").attr("tabindex","-1").focus();
  });

  // Calcular cambio live
  $amountIn.on("input", function () {
    const val = (this.value || "").trim();
    const received = val === "" ? runningTotal : (parseFloat(val) || 0);
    const change = received - runningTotal;
    $changeOut.text(change >= 0 ? `Cambio: ${money(change)}` : "");
  });

  // Enter en monto → confirmar
  $amountIn.on("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); $confirmBtn.click(); }
  });

  // Atajos Alt+1/2/3 SOLO para el MODAL
  $(document).on("keydown", function (e) {
    const modalVisible = $modal.length && $modal.is(":visible");
    if (!modalVisible) return;
    if (!e.altKey || e.ctrlKey || e.metaKey) return;

    if (e.key === "1" || e.key === "2" || e.key === "3") {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (e.key === "1") { $("#nequi").prop("checked", true).trigger("change"); }
      if (e.key === "2") { $("#daviplata").prop("checked", true).trigger("change"); }
      if (e.key === "3") { $("#efectivo").prop("checked", true).trigger("change"); setTimeout(()=>{$amountIn.focus().select();},0); }
    }
  });
  $amountIn.on("keydown", function (e) {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "1" || e.key === "2" || e.key === "3") {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (e.key === "1") { $("#nequi").prop("checked", true).trigger("change"); }
      if (e.key === "2") { $("#daviplata").prop("checked", true).trigger("change"); }
      if (e.key === "3") { $("#efectivo").prop("checked", true).trigger("change"); setTimeout(()=>{$amountIn.focus().select();},0); }
    }
  });

  // ✅ Alt+Enter: si modal abierto → confirmar; si no, abrir modal
  $(document).on("keydown", function (e) {
    if (e.key === "Enter" && e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if ($modal.is(":visible")) {
        $confirmBtn.click();
      } else {
        $("#generar-venta").trigger("click");
      }
    }
  });

  // Confirmar pago (con confirm invertido para imprimir)
  $confirmBtn.click(() => {
    const m = $("input[name='payment_method']:checked").val();
    if (!m) return alert("Seleccione medio de pago.");

    if (m === "efectivo") {
      const raw = ($amountIn.val() || "").trim();
      const received = raw === "" ? runningTotal : (parseFloat(raw) || 0);
      if (raw !== "" && received < runningTotal) return alert("Monto recibido insuficiente.");
      if (raw === "") $amountIn.val(String(received));
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

  /* ================== Submit con CAMBIO + confirm invertido ================== */
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
        const raw = ($("#monto-recibido").val() || "").trim();
        const recibido = efectivo ? (raw === "" ? (window.runningTotal || runningTotal || 0) : (parseFloat(raw) || 0)) : 0;
        const cambio   = efectivo ? Math.max(0, recibido - (window.runningTotal || runningTotal || 0)) : 0;
        const cambioTxt = efectivo ? `\n\nCambio a entregar: ${money(cambio)}` : "";

        // ⬇️ Mensaje y lógica invertida:
        // Aceptar => NO imprimir
        // Cancelar => SÍ imprimir
        const quiereNoImprimir = confirm(
          "✅ Venta generada.\n\n" +
          "Para IMPRIMIR la factura elija «Cancelar».\n" +
          "Para NO imprimir, elija «Aceptar»."
        );

        try {
          if (!quiereNoImprimir) { // Cancelar → imprimir
            await agentPrint(r.receipt_text || "Factura\n\n");
            await new Promise(res => setTimeout(res, 200));
            await agentKick();
            alert(`Factura enviada a la impresora y gaveta abierta.${cambioTxt}`);
          } else { // Aceptar → no imprimir
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

  /* ================== Atajos Ctrl + 0..4 ================== */
  $(document).on("keydown", function (e) {
    if ($("#myModal").is(":visible")) return;
    if (!e.ctrlKey || e.altKey || e.metaKey) return;
    const focusAndSelect = ($el) => { $el.focus(); $el[0]?.select?.(); };
    switch (e.key) {
      case "0": e.preventDefault(); focusAndSelect($inpCliente); break;
      case "1": e.preventDefault(); focusAndSelect($inpNombre); break;
      case "2": e.preventDefault(); focusAndSelect($inpCodeOrBar); break;
      case "3": e.preventDefault(); focusAndSelect($buscarCart); break;
      case "4":
        e.preventDefault();
        if (lastAddedPid) {
          const $row = $tbody.find(`tr[data-pid='${lastAddedPid}']`);
          const $q = $row.find(".qty-input");
          if ($q.length) { focusAndSelect($q); break; }
        }
        focusAndSelect($cantidad);
        break;
      default: break;
    }
  });

  /* ================== Atajos Alt + 0..4 (página) ================== */
  (function setupAltShortcuts(){
    const focusAndSelect = ($el) => { if ($el && $el.length) { $el.focus(); $el[0]?.select?.(); } };
    $(document).on("keydown", function (e) {
      if ($("#myModal").is(":visible")) return;
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key;
      if (!/^[0-4]$/.test(k)) return;
      e.preventDefault(); e.stopPropagation();
      switch (k) {
        case "0": focusAndSelect($inpCliente); break;
        case "1": focusAndSelect($inpNombre); break;
        case "2": focusAndSelect($inpCodeOrBar); break;
        case "3": focusAndSelect($buscarCart); break;
        case "4":
          if (lastAddedPid) {
            const $row = $tbody.find(`tr[data-pid='${lastAddedPid}']`);
            const $q = $row.find(".qty-input");
            if ($q.length) { focusAndSelect($q); break; }
          }
          focusAndSelect($cantidad);
          break;
        default: break;
      }
    });
  })();

  /* ================== ESC: eliminar primer item del carrito ================== */
  $(document).on("keydown", function (e) {
    if ($("#myModal").is(":visible")) return; // no borrar si modal visible
    if (e.key !== "Escape") return;

    const $first = $tbody.find("tr:visible").first();
    if (!$first.length) return;

    e.preventDefault(); e.stopPropagation();
    const pid   = String($first.data("pid") || "");
    const price = Number($first.data("price")) || 0;
    const qty   = Number($first.attr("data-qty")) || Number($first.find(".qty-input").val()) || 0;
    addToTotal(-(price * qty));
    const idx = productos.indexOf(pid);
    if (idx > -1) { productos.splice(idx, 1); cantidades.splice(idx, 1); }
    $first.remove();
  });

  /* ================== Detector de pistola (escáner) ================== */
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
