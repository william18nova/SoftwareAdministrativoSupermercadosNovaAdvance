// node --test mainApp/test_sale_barcode_scanner.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const script = fs.readFileSync(path.join(__dirname, "static/javascript/generar_venta.js"), "utf8");
const start = script.indexOf("  (function scannerDetectorWithQtyGuard() {");
const end = script.indexOf("  /* ================== Init ================== */", start);
assert.ok(start >= 0 && end > start);
const detectorCode = script.slice(start, end);

function scanner(initial = "code") {
  let clock = 1000;
  let nextTimer = 0;
  const timers = new Map();
  const listeners = [];
  const scans = [];
  const commits = [];
  const code = {value: "", setSelectionRange() {}, classList: {contains: () => false}};
  const qty = {value: "7", classList: {contains: () => true}};
  const name = {value: "", classList: {contains: () => false}};
  const client = {value: "", classList: {contains: () => false}};
  const document = {
    activeElement: {code, qty, name, client}[initial],
    addEventListener(name, handler) { if (name === "keydown") listeners.push(handler); },
  };
  const $inpCode = {
    0: code, length: 1, is: () => true,
    focus() { document.activeElement = code; },
    val(value) { if (value === undefined) return code.value; code.value = value; return this; },
    autocomplete() {},
  };
  const context = {
    document, $inpCode,
    SCANNER_ARTIFACT_KEYS: new Set(["Shift", "Alt", "NumLock", "CapsLock"]),
    Date: {now: () => clock},
    setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, {at: clock + delay, fn}); return id; },
    clearTimeout(id) { timers.delete(id); },
    isModalOpen: () => false,
    isQtyElement: el => el === qty,
    isClienteBusquedaElement: el => el === client,
    commitCurrentQtyLikeEnterIfNeeded: el => commits.push(el.value),
    pushCodeIntoCodeInputAndAdd: value => scans.push(value),
  };
  vm.createContext(context);
  vm.runInContext(detectorCode, context);
  assert.equal(listeners.length, 1);

  function advance(ms) {
    const target = clock + ms;
    while (true) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > target) break;
      clock = next[1].at;
      timers.delete(next[0]);
      next[1].fn();
    }
    clock = target;
  }
  function key(value, gap = 10) {
    advance(gap);
    const target = document.activeElement;
    const event = {
      key: value, ctrlKey: false, metaKey: false, altKey: false, prevented: false,
      preventDefault() { this.prevented = true; }, stopImmediatePropagation() {},
    };
    listeners[0](event);
    if (!event.prevented && value.length === 1 && typeof target.value === "string") target.value += value;
    return event;
  }
  return {key, advance, scans, commits, code, qty, name, client, document};
}

test("un EAN de 13 dígitos en cantidad se completa antes de agregarlo", () => {
  const app = scanner("qty");
  for (const digit of "0012345678905") app.key(digit, 40);
  assert.deepEqual(app.scans, []);
  assert.equal(app.qty.value, "7");
  const suffix = app.key("Enter", 10);
  assert.equal(suffix.prevented, true);
  assert.deepEqual(app.scans, ["0012345678905"]);
  assert.deepEqual(app.commits, ["7"]);
});

test("el lector sin Enter conserva los 13 dígitos con pausas de 90 ms", () => {
  const app = scanner();
  for (const digit of "0012345678905") app.key(digit, 90);
  assert.deepEqual(app.scans, []);
  app.advance(230);
  assert.deepEqual(app.scans, ["0012345678905"]);
  assert.equal(app.key("Enter", 10).prevented, true);
});

test("dos lecturas consecutivas del mismo código siguen siendo dos unidades", () => {
  const app = scanner();
  for (let i = 0; i < 2; i++) {
    for (const digit of "0012345678905") app.key(digit);
    app.key("Enter");
    app.advance(40);
  }
  assert.deepEqual(app.scans, ["0012345678905", "0012345678905"]);
});

test("un Code 128 alfanumérico se conserva sin quitar letras", () => {
  const app = scanner();
  for (const char of "AB12CD34") app.key(char);
  app.key("Tab");
  assert.deepEqual(app.scans, ["AB12CD34"]);
});

test("escribir un nombre sin cifras no se confunde con un escaneo", () => {
  const app = scanner("name");
  for (const char of "ARROZBLANCO") app.key(char, 20);
  app.advance(300);
  assert.deepEqual(app.scans, []);
  assert.equal(app.name.value, "ARROZBLANCO");
});

const between = (a, b) => script.slice(script.indexOf(a), script.indexOf(b, script.indexOf(a)));
const pipelineCode = [
  between("  function isDuplicateScannerPush(", "  /* ================== ✅ CHECK DIGIT VALIDATOR"),
  between("  function addScannedProduct(", "  function addToCart("),
  between("  function pushCodeIntoCodeInputAndAdd(", "  /* ======================================================================================="),
].join("\n");

function pipeline(barcode, {local = false, returnedBarcode = barcode} = {}) {
  let clock = 1000;
  const added = [];
  const errors = [];
  const lookups = [];
  const input = {value: ""};
  const $inpCode = {
    length: 1, val(value) { input.value = value; return this; },
    autocomplete() {}, is: () => false,
  };
  const context = {
    now: () => clock, scannerPushGuard: {code: "", ts: 0},
    isModalOpen: () => false, blockModalConfirmFor() {},
    validateBarcodeChecksum: () => false,
    suppressBarcodeAutocompleteAdd() {}, rememberBarcodeAutoAdd() {},
    $inpCode, $inpNombre: {autocomplete() {}}, $inpId: {length: 0},
    queueMicrotask() {}, hasSucursal: () => true,
    getLocalExactBarcodeProduct: () => local ? {id: "42", name: "Producto", barcode} : null,
    setProductFields() {}, beginBarcodeResolve: () => 1, endBarcodeResolve() {},
    resolveByBarcode: code => { lookups.push(code); return Promise.resolve("42"); },
    BARCODE_RESOLVE_BLOCKED: "blocked",
    BARCODE_RESOLVE_UNAVAILABLE: "unavailable",
    productCache: new Map([["42", {barcode: returnedBarcode}]]),
    addToCart: (pid, qty) => added.push({pid, qty}),
    flashScanError: message => errors.push(message),
    clearBarcodeScanStatus() {},
    console: {warn() {}},
  };
  vm.createContext(context);
  vm.runInContext(pipelineCode, context);
  return {
    scan: code => context.pushCodeIntoCodeInputAndAdd(code),
    advance: ms => { clock += ms; },
    added, errors, lookups, input,
  };
}

test("el resultado exacto agrega cada lectura repetida y conserva ceros iniciales", async () => {
  const app = pipeline("0012345678905");
  app.scan("0012345678905");
  app.advance(35);
  app.scan("0012345678905");
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(app.lookups, ["0012345678905", "0012345678905"]);
  assert.deepEqual(app.added, [{pid: "42", qty: 1}, {pid: "42", qty: 1}]);
  assert.deepEqual(app.errors, []);
});

test("un código alfanumérico no se convierte en otro producto numérico", async () => {
  const app = pipeline("AB12CD34", {returnedBarcode: "1234"});
  app.scan("AB12CD34");
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(app.lookups, ["AB12CD34"]);
  assert.deepEqual(app.added, []);
});

test("un código interno con checksum no estándar se acepta si coincide exactamente", async () => {
  const app = pipeline("0012345678905", {local: true});
  app.scan("0012345678905");
  assert.deepEqual(app.added, [{pid: "42", qty: 1}]);
});

const resolverCode = between("  function resolveByBarcode(code)", "  function setProductFields({");
function resolver(responses) {
  const calls = [];
  const updates = [];
  const context = {
    getLocalExactBarcodeProduct: () => null,
    isBarcodeLocallyAmbiguous: () => false,
    sucursalID: "1", POR_COD_URL: "/producto_por_codigo/",
    asNativePromise: value => Promise.resolve(value),
    $: {ajax: options => {
      calls.push(options);
      const next = responses.shift();
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    }},
    updateCache: (id, item) => updates.push({id, item}),
    setProductFields() {}, flashScanError() {},
    BARCODE_RESOLVE_BLOCKED: "blocked",
    BARCODE_RESOLVE_UNAVAILABLE: "unavailable",
    console: {warn() {}}, Date,
  };
  vm.createContext(context);
  vm.runInContext(resolverCode, context);
  return {resolve: code => context.resolveByBarcode(code), calls, updates};
}

test("un fallo transitorio reintenta el código exacto una vez", async () => {
  const app = resolver([
    new Error("timeout"),
    {exists: true, producto: {id: 42, nombre: "Producto", codigo_de_barras: "AB12CD34"}},
  ]);
  assert.equal(await app.resolve("AB12CD34"), 42);
  assert.equal(app.calls.length, 2);
  assert.equal(app.calls[0].data.codigo_de_barras, "AB12CD34");
  assert.equal(app.calls[0].timeout, 3500);
});

test("un fallo persistente informa indisponibilidad sin agregar otro producto", async () => {
  const app = resolver([new Error("offline"), new Error("offline")]);
  assert.equal(await app.resolve("0012345678905"), "unavailable");
  assert.deepEqual(app.updates, []);
});

test("el servidor ambiguo o un código diferente nunca se agrega", async () => {
  const duplicate = resolver([{exists: false, ambiguous: true}]);
  assert.equal(await duplicate.resolve("0012345678905"), "blocked");
  const mismatch = resolver([{
    exists: true,
    producto: {id: 42, nombre: "Otro", codigo_de_barras: "0012345678906"},
  }]);
  assert.equal(await mismatch.resolve("0012345678905"), null);
  assert.deepEqual(mismatch.updates, []);
});
