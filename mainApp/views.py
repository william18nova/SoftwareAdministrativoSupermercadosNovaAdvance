from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from .models import Usuario, Sucursal, Categoria, Producto, Inventario, Proveedor, PreciosProveedor, PuntosPago, Rol, Empleado, HorariosNegocio, HorarioCaja, Cliente, Venta, DetalleVenta, PedidoProveedor, DetallePedidoProveedor, CambioDevolucion, Permiso, RolPermiso
from django.db.models import Count, Sum, Exists, OuterRef, Q, F, ExpressionWrapper, DecimalField, Value, IntegerField, Case, When
from django.http import JsonResponse, HttpRequest, HttpResponse
from django.contrib.auth import authenticate, login as auth_login
import json
from datetime import date
from django.utils import timezone
from django.contrib.auth import authenticate
import logging
from django.utils.dateparse import parse_date
from django.db import transaction
from django.core.exceptions import FieldDoesNotExist
from django.views.generic import DetailView
from .forms import (
    CategoriaForm,
    ClienteForm,
    EmpleadoCreateForm,
    HorarioCajaForm,
    HorariosNegocioForm,
    SucursalForm,
    ProductoForm,
    ProductoEditarForm,
    ProveedorForm,
    RolForm,
    InventarioForm,
    InventarioFiltroForm,
    PreciosProveedorForm,
    PuntosPagoForm,
    UsuarioForm,
    EditarCategoriaForm,
    EditarClienteForm,
    EditarEmpleadoForm,
    EditarHorarioCajaForm,
    EditarHorariosSucursalForm,
    EditarInventarioForm,
    EditarPreciosProveedorForm,
    EditarProveedorForm,
    PuntosPagoEditarForm,
    RolEditarForm,
    SucursalEditarForm,
    UsuarioEditarForm,
    GenerarVentaForm,
    PedidoProveedorForm,
    EditarPedidoForm,
    DevolucionForm,
    PermisoForm,
    PermisoEditarForm,
    RolPermisoAssignForm,
    RolPermisoEditForm

)
from dal import autocomplete
from decimal import Decimal, InvalidOperation
from django.urls import reverse, reverse_lazy
from itertools import zip_longest
from django.forms import formset_factory
from django.views          import View
from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView, CreateView
from django.views.generic.edit import FormView, UpdateView
from django.views.generic import ListView
from django.utils.decorators import method_decorator
from django.utils.html import escape
from django.db.models import Subquery
from django.core.paginator import Paginator
from django.db.models.functions import Upper, Lower, StrIndex
import os, io, textwrap, subprocess
from django.views.decorators.http import require_POST



logger = logging.getLogger(__name__)

# ---------- mixin reutilizable para autocompletados ----------
class PaginatedAutocompleteMixin(LoginRequiredMixin, View):
    """
    Mixin genérico para autocompletados paginados.
    Las sub-clases solo declaran `model`, `text_field`, `id_field` y
    opcionalmente `extra_filter` o `per_page`.
    """
    model        = None         #  ← se define en la sub-clase
    text_field   = "nombre"
    id_field     = "pk"
    extra_filter = None         #  callable(qs, request)  →  qs
    per_page     = 10

    def get(self, request, *args, **kwargs):
        term   = request.GET.get("term", "").strip()
        page   = max(int(request.GET.get("page", 1)), 1)
        start, end = (page - 1) * self.per_page, page * self.per_page

        qs = self.model.objects.all().order_by(self.text_field)
        if self.extra_filter:
            qs = self.extra_filter(qs, request)

        if term:
            qs = qs.filter(**{f"{self.text_field}__icontains": term})

        total = qs.count()
        qs    = qs[start:end]

        results = [
            {"id": getattr(obj, self.id_field), "text": getattr(obj, self.text_field)}
            for obj in qs
        ]
        return JsonResponse({"results": results, "has_more": end < total})

class LoginView(View):
    template_name = "login.html"

    def get(self, request):
        return render(request, self.template_name)

    def post(self, request):
        u = request.POST.get("nombreusuario")
        p = request.POST.get("contraseña")
        user = authenticate(request, username=u, password=p)
        if user:
            auth_login(request, user)
            return redirect("home")
        messages.error(request, "Usuario o contraseña incorrectos.")
        return render(request, self.template_name)


class HomePageView(LoginRequiredMixin, TemplateView):
    template_name = "homePage.html"


class SucursalCreateAJAXView(LoginRequiredMixin, FormView):
    template_name = 'agregar_sucursal.html'
    form_class = SucursalForm

    def form_valid(self, form):
        sucursal = form.save()
        # Cuando es AJAX devolvemos JSON
        if self.request.headers.get('x-requested-with') == 'XMLHttpRequest':
            return JsonResponse({
                'success': True,
                'message': 'Sucursal agregada exitosamente.',
                'sucursal': {
                    'id': sucursal.sucursalid,
                    'nombre': sucursal.nombre
                }
            })
        # En caso normal, redirigir con mensaje
        return redirect('listar_sucursales')  # O la vista deseada

    def form_invalid(self, form):
        errors = form.errors.get_json_data()
        return JsonResponse({'success': False, 'errors': errors}, status=400)


class SucursalListView(LoginRequiredMixin, ListView):
    template_name = "visualizar_sucursales.html"
    model = Sucursal               # => queryset = Sucursal.objects.all()
    context_object_name = "sucursales"

@login_required
def eliminar_sucursal(request, sucursal_id):
    sucursal = get_object_or_404(Sucursal, sucursalid=sucursal_id)
    if request.method == 'POST':
        sucursal.delete()
        messages.success(request, 'La sucursal ha sido eliminada exitosamente.')
        return redirect('visualizar_sucursales')
    return render(request, 'visualizar_sucursales.html', {'sucursales': Sucursal.objects.all()})


class SucursalUpdateAJAXView(LoginRequiredMixin, UpdateView):
    """
    ▸  Edita una sucursal mediante AJAX.
    ▸  Si la petición NO es AJAX, actúa como un UpdateView normal.
    """
    model         = Sucursal
    pk_url_kwarg  = "sucursal_id"       # <int:sucursal_id> en la URL
    form_class    = SucursalEditarForm
    template_name = "editar_sucursal.html"
    success_url   = reverse_lazy("visualizar_sucursales")

    # ------------------------------------------------------------------ AJAX
    def form_valid(self, form):
        self.object = form.save()                 # guarda y conserva instancia
        if self.request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse({
                "success": True,
                "message": f'Sucursal “{self.object.nombre}” actualizada.',
                "redirect_url": self.success_url,
            })
        # Petición normal (no-AJAX) → mensaje + redirect
        messages.success(
            self.request,
            f'Sucursal “{self.object.nombre}” actualizada exitosamente.',
        )
        return redirect(self.success_url)

    def form_invalid(self, form):
        if self.request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse(
                {"success": False, "errors": form.errors.get_json_data()},
                status=400,
            )
        # fallback: renderiza template con errores
        return self.render_to_response(self.get_context_data(form=form))

@login_required
def puntopago_autocomplete_venta(request):
    """
    Autocomplete para Punto de Pago.
    Permite buscar puntos de pago por nombre, filtrando por la sucursal seleccionada.
    Soporta paginación con 'term', 'page' y 'per_page'.
    """
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    per_page_str = request.GET.get('per_page', '50').strip()

    try:
        page = int(page_str)
    except ValueError:
        page = 1
    try:
        per_page = int(per_page_str)
    except ValueError:
        per_page = 50

    start = (page - 1) * per_page
    end = start + per_page

    # Si se pasa el id de sucursal, filtramos por ella (opcional)
    sucursal_id = request.GET.get('sucursal_id')
    qs = PuntosPago.objects.all().order_by('nombre')
    if sucursal_id and sucursal_id.isdigit():
        qs = qs.filter(sucursalid__sucursalid=sucursal_id)
    if term:
        qs = qs.filter(nombre__icontains=term)

    total_results = qs.count()
    qs = qs[start:end]
    results = [{'id': pp.puntopagoid, 'text': pp.nombre} for pp in qs]
    has_more = end < total_results
    return JsonResponse({'results': results, 'has_more': has_more})


class CategoriaCreateAJAXView(LoginRequiredMixin, FormView):
    template_name = "agregar_categoria.html"
    form_class    = CategoriaForm
    success_url   = reverse_lazy("visualizar_categorias")   # o la lista que uses

    # ------------- POST -------------
    def form_valid(self, form):
        categoria = form.save()
        if self.request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse({
                "success"  : True,
                "message"  : "Categoría agregada exitosamente.",
                "redirect_url": str(self.success_url),
                "categoria": {
                    "id"      : categoria.categoriaid,
                    "nombre"  : categoria.nombre
                }
            })
        return super().form_valid(form)

    def form_invalid(self, form):
        if self.request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse(
                {"success": False, "errors": form.errors.get_json_data()},
                status=400
            )
        return super().form_invalid(form)


class CategoriaListView(LoginRequiredMixin, ListView):
    """
    Lista todas las categorías ordenadas alfabéticamente para usarse
    con DataTables.  No paginamos en el servidor porque la paginación
    se delega al plugin JS.
    """
    model               = Categoria
    template_name       = "visualizar_categorias.html"
    context_object_name = "categorias"
    ordering            = ["nombre"]

@login_required
def eliminar_categoria(request, categoria_id):
    categoria = get_object_or_404(Categoria, categoriaid=categoria_id)
    nombre_categoria = categoria.nombre
    if request.method == 'POST':
        productos_asociados = Producto.objects.filter(categoria=categoria)
        productos_asociados.update(categoria=None)

        categoria.delete()
        messages.success(request, f'La categoría "{nombre_categoria}" ha sido eliminada exitosamente.')
        return redirect('visualizar_categorias')
    return render(request, 'visualizar_categorias.html', {'categorias': Categoria.objects.all()})

class CategoriaUpdateAJAXView(LoginRequiredMixin, UpdateView):
    """
    Edita una categoría mediante AJAX.
    • En caso de éxito devuelve JSON  {success:true, redirect_url:"…"}
    • Si hay errores devuelve        {success:false, errors:{…}}
    """
    model         = Categoria
    form_class    = EditarCategoriaForm
    template_name = "editar_categoria.html"
    pk_url_kwarg  = "categoria_id"        # <int:categoria_id> en la URL
    success_url   = reverse_lazy("visualizar_categorias")

    # ── sobreevaluamos post() para responder siempre JSON a peticiones AJAX ──
    def form_valid(self, form):
        """
        Guardamos, y enviamos ‘flash’ a sessionStorage mediante JS
        => sólo enviamos la URL destino
        """
        self.object = form.save()
        success_msg = f'Categoría «{self.object.nombre}» actualizada correctamente.'

        if self.request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse({
                "success"     : True,
                "redirect_url": str(self.success_url),
                "flash_msg"   : success_msg,          # opcional (por si lo quieres)
            })

        # Fallback (no-AJAX)
        from django.contrib import messages
        messages.success(self.request, success_msg)
        return super().form_valid(form)

    def form_invalid(self, form):
        if self.request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse(
                {"success": False, "errors": form.errors.get_json_data()},
                status=400,
            )
        return super().form_invalid(form)



class ProductoCreateAJAXView(LoginRequiredMixin, FormView):
    template_name = "agregar_producto.html"
    form_class    = ProductoForm

    def get_context_data(self, **kw):
        ctx = super().get_context_data(**kw)
        ctx["categorias"] = Categoria.objects.all()   #  para precargar si quieres un select
        return ctx

    #  POST -------------------------------------------------
    def form_valid(self, form):
        producto = form.save()
        if self.request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse({
                "success": True,
                "message": "Producto agregado exitosamente.",
                "producto": {
                    "id": producto.productoid,
                    "nombre": producto.nombre,
                }
            })
        #  fallback (no-AJAX)
        return super().form_valid(form)

    def form_invalid(self, form):
        return JsonResponse(
            {"success": False, "errors": form.errors.get_json_data()},
            status=400
        )


# ----------  Autocomplete «Categoría»  ----------
class CategoriaAutocompleteView(PaginatedAutocompleteMixin):
    """Devuelve categorías paginadas para el componente de autocompletado."""
    model      = Categoria            # ← modelo a consultar
    text_field = "nombre"             # ← columna que se muestra
    id_field   = "categoriaid"        # ← valor que se envía al form
    per_page   = 10                   # ← (opcional) página de 10 resultados


class ProductoListView(LoginRequiredMixin, ListView):
    """
    Lista completa de productos sin paginación en Django.
    La paginación se hace en el cliente con DataTables.
    """
    model = Producto
    template_name = "visualizar_productos.html"
    context_object_name = "productos"
    ordering = "nombre"         # se ordena alfabéticamente en el servidor
    paginate_by = None          # 🔴 sin paginación del lado servidor

    def get_queryset(self):
        # Evita N+1 y ordena
        return (
            Producto.objects
            .select_related("categoria")
            .order_by(self.ordering or "nombre")
        )

@login_required
def eliminar_producto(request, producto_id):
    producto = get_object_or_404(Producto, productoid=producto_id)
    if request.method == 'POST':
        nombre_producto = producto.nombre
        producto.delete()
        messages.success(request, f'El producto "{nombre_producto}" ha sido eliminado exitosamente.')
        return redirect('visualizar_productos')
    # Si no es POST, simplemente se vuelve a renderizar la página
    productos = Producto.objects.all()
    return render(request, 'visualizar_productos.html', {'productos': productos})


class ProductoUpdateAJAXView(LoginRequiredMixin, UpdateView):
    """
    · Renderiza el formulario de edición con template + JS.
    · Si la petición es AJAX (fetch), responde JSON.
    · Para navegación clásica usa messages y redirect normal.
    """
    model         = Producto
    form_class    = ProductoEditarForm
    template_name = "editar_producto.html"
    pk_url_kwarg  = "producto_id"      #  /productos/editar/<producto_id>/

    # -------------------- POST OK --------------------
    def form_valid(self, form):
        producto = form.save()

        # AJAX
        if self.request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse({
                "success"     : True,
                "redirect_url": reverse("visualizar_productos"),
                "nombre"      : producto.nombre,
            })

        # Navegación normal
        messages.success(
            self.request,
            f'Producto «{producto.nombre}» actualizado correctamente.'
        )
        return super().form_valid(form)

    # ------------------ POST con errores -------------
    def form_invalid(self, form):
        if self.request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse(
                {"success": False, "errors": form.errors.get_json_data(escape_html=True)},
                status=400,
            )
        return super().form_invalid(form)

    # --------------------- redirect ------------------
    def get_success_url(self):
        return reverse_lazy("visualizar_productos")


# ---------- alta de inventario ----------
@method_decorator(transaction.atomic, name="dispatch")
class InventarioCreateAJAXView(LoginRequiredMixin, View):
    """
    · GET  →  renderiza formulario + dataset inicial.
    · POST →  guarda lotes a partir de 'inventarios_temp' (JSON).
              Respuesta JSON {success, errors}
    """
    template_name = "agregar_inventario.html"
    form_class    = InventarioForm
    success_msg   = "Inventario creado exitosamente."

    # ----------  GET ----------
    def get(self, request):
        form  = self.form_class()
        sucs  = (Sucursal.objects
                 .annotate(inv_count=Count("inventario"))
                 .filter(inv_count=0))
        prods = Producto.objects.all()

        if not sucs.exists():
            messages.error(request,
                "Todas las sucursales ya tienen inventario activo.")
        if not prods.exists():
            messages.error(request,
                "No hay productos en el sistema. Agrega productos primero.")

        ctx = {"form": form, "sucursales": sucs, "productos": prods}
        return render(request, self.template_name, ctx)

    # ----------  POST ----------
    def post(self, request):
        form = self.form_class(request.POST)

        # 1) Validación de formulario base
        if not form.is_valid():
            return JsonResponse({
                "success": False,
                "errors" : json.dumps(form.errors.get_json_data(escape_html=True))
            })

        sucursal = form.cleaned_data["sucursal"]
        raw_list = request.POST.get("inventarios_temp", "[]")

        try:
            items = json.loads(raw_list)
        except json.JSONDecodeError:
            items = []

        if not items:
            return JsonResponse({
                "success": False,
                "errors" : json.dumps({
                    "inventarios_temp": [{"message": "Debe agregar al menos un producto."}]
                })
            })

        # 2) Construir lotes
        batch = []
        for it in items:
            pid = it.get("productId")
            qty = it.get("cantidad")
            if not (pid and qty):
                continue

            producto = get_object_or_404(Producto, pk=pid)

            # evitar duplicados
            if Inventario.objects.filter(productoid=producto,
                                         sucursalid=sucursal).exists():
                continue

            try:
                qty_int = int(qty)
                if qty_int <= 0:
                    raise ValueError
            except ValueError:
                continue

            batch.append(Inventario(
                productoid = producto,
                sucursalid = sucursal,
                cantidad   = qty_int
            ))

        if not batch:
            return JsonResponse({
                "success": False,
                "errors" : json.dumps({
                    "__all__": [{"message": "Nada que guardar."}]
                })
            })

        # 3) Guardar
        Inventario.objects.bulk_create(batch)

        # ► ¡Ya NO se añade messages.success aquí! ◄
        # messages.success(request, self.success_msg)

        return JsonResponse({"success": True})


# ---------- autocompletado ①: sucursales sin inventario ----------
class SucursalSinInventarioAutocomplete(PaginatedAutocompleteMixin):
    model = Sucursal

    def extra_filter(self, qs, request):
        return (
            qs.annotate(inv_count=Count("inventario"))
              .filter(inv_count=0)
        )


# ---------- autocompletado ②: productos (excluye IDs recibidos) ----------
class ProductoAutocomplete(PaginatedAutocompleteMixin):
    model = Producto
    id_field = "productoid"

    def extra_filter(self, qs, request):
        excluded = request.GET.get("excluded", "")
        ids      = [int(x) for x in excluded.split(",") if x.isdigit()]
        return qs.exclude(productoid__in=ids) if ids else qs

class InventarioListView(LoginRequiredMixin, View):
    """Renderiza y filtra inventarios por sucursal (o modo global)."""

    template_name = "visualizar_inventarios.html"

    def get_context(self, request):
        """Devuelve contexto según el filtro POST (si lo hay)."""
        form         = InventarioFiltroForm(request.POST or None)
        sucursales   = Sucursal.objects.filter(inventario__isnull=False).distinct()
        sucursal_sel = None
        inventarios  = []
        global_mode  = False
        global_data  = []

        if form.is_valid():
            filtro = form.cleaned_data.get("sucursal")
            if filtro == "global":
                global_mode = True
                global_data = (Inventario.objects
                               .values("productoid__nombre")
                               .annotate(total_cantidad=Sum("cantidad"))
                               .order_by("productoid__nombre"))
            elif filtro:
                sucursal_sel = get_object_or_404(Sucursal, pk=int(filtro))
                inventarios  = (Inventario.objects
                                .filter(sucursalid=sucursal_sel)
                                .select_related("productoid"))
        return {
            "form"                : form,
            "sucursales"          : sucursales,
            "inventarios"         : inventarios,
            "inventario_global"   : global_mode,
            "inventario_global_data": global_data,
            "sucursal_seleccionada": sucursal_sel,
        }

    # GET y POST necesitan la misma lógica
    def get(self, request):
        return render(request, self.template_name, self.get_context(request))

    def post(self, request):
        return render(request, self.template_name, self.get_context(request))

class SucursalInventarioAutocompleteView(PaginatedAutocompleteMixin):
    """
    Autocompletado de sucursales que YA tienen inventario.
    En la primera página agrega la opción «Inventario Global».
    """
    model       = Sucursal
    text_field  = "nombre"
    id_field    = "sucursalid"

    # ── se filtra solo a sucursales con inventario ───────────────────────────
    def extra_filter(self, qs, request):
        #  opción A (sin Count) – más simple
        return qs.filter(inventario__isnull=False).distinct()

        #  opción B (con Count) – si prefieres una sola consulta
        # return qs.annotate(n=Count("inventario")).filter(n__gt=0)

    # ── se añade la opción «global» en la página 1 ────────────────────────────
    def get(self, request, *args, **kwargs):
        # llamamos al mixin ⇒ JsonResponse
        base_response = super().get(request, *args, **kwargs)
        data          = json.loads(base_response.content)   # → dict

        if int(request.GET.get("page", "1")) == 1:
            data["results"].insert(0, {"id": "global", "text": "Inventario Global"})

        return JsonResponse(data)


# ─────────────────────────────────────────────────────────────────────────────
# Editar Inventario  (CBV)
# ─────────────────────────────────────────────────────────────────────────────


class EditarInventarioView(LoginRequiredMixin, View):
    """
    GET  → muestra formulario precargado.
    POST →
      - action=add_item (AJAX): upsert solo del producto enviado (recarga misma página).
      - submit principal: upsert SOLO de los productos enviados SIN borrar los demás.
    """
    template_name = "editar_inventario.html"

    # ---------- GET ----------
    def get(self, request, sucursal_id):
        sucursal = get_object_or_404(Sucursal, pk=sucursal_id)
        inventarios_existentes = (
            Inventario.objects
            .filter(sucursalid=sucursal)
            .select_related("productoid")
            .order_by("productoid__nombre")
        )

        form = EditarInventarioForm(initial={
            "sucursal": sucursal.pk,
            "sucursal_autocomplete": sucursal.nombre,
        })

        return render(request, self.template_name, {
            "form": form,
            "sucursal": sucursal,
            "inventarios": inventarios_existentes,
        })

    # ---------- POST ----------
    @transaction.atomic
    def post(self, request, sucursal_id):
        # ───── AJAX: agregar/actualizar un item y recargar misma página ─────
        if request.POST.get("action") == "add_item":
            sucursal = get_object_or_404(Sucursal, pk=sucursal_id)  # tomamos la del URL

            productoid = (request.POST.get("productoid") or "").strip()
            cantidad   = (request.POST.get("cantidad") or "").strip()

            errors = {}
            if not productoid:
                errors.setdefault("productoid", []).append({"message": "Debe seleccionar un producto."})
            try:
                cantidad_int = int(cantidad)
                if cantidad_int <= 0:
                    errors.setdefault("cantidad", []).append({"message": "Cantidad debe ser mayor que 0."})
            except ValueError:
                errors.setdefault("cantidad", []).append({"message": "Cantidad debe ser un número entero."})

            if errors:
                return JsonResponse({"success": False, "errors": json.dumps(errors)}, status=400)

            pid = int(productoid)
            inv, created = Inventario.objects.select_for_update().get_or_create(
                sucursalid=sucursal,
                productoid_id=pid,
                defaults={"cantidad": cantidad_int},
            )
            if not created:
                inv.cantidad = cantidad_int
                inv.save(update_fields=["cantidad"])

            messages.success(request, f"Producto actualizado en «{sucursal.nombre}».")
            return JsonResponse({"success": True})

        # ───── Submit principal: MERGE (no eliminar faltantes) ─────
        form = EditarInventarioForm(request.POST)
        if not form.is_valid():
            errors = {
                fld: [{"message": e["message"]} for e in ferr]
                for fld, ferr in form.errors.get_json_data().items()
            }
            return JsonResponse({"success": False, "errors": json.dumps(errors)})

        sucursal_destino = form.cleaned_data["sucursal"]
        raw_json         = form.cleaned_data["inventarios_temp"]

        try:
            payload = json.loads(raw_json or "[]")
        except json.JSONDecodeError:
            return JsonResponse({
                "success": False,
                "errors": json.dumps({
                    "inventarios_temp": [{"message": "Formato JSON inválido."}]
                })
            })

        # Normaliza y valida el payload de la tabla visible del usuario
        upserts = {}
        for item in payload:
            pid = item.get("productId")
            cant = item.get("cantidad")
            if pid is None or cant is None:
                continue
            try:
                pid_int = int(pid)
                cant_int = int(cant)
                if cant_int <= 0:
                    continue
            except (ValueError, TypeError):
                continue
            upserts[str(pid_int)] = cant_int

        # Cargamos existentes solo para hacer upsert de los enviados (no borraremos faltantes)
        existentes = {
            str(obj.productoid_id): obj
            for obj in (Inventario.objects
                        .select_for_update()
                        .filter(sucursalid=sucursal_destino))
        }

        # Upsert SOLO de lo que envía el usuario en su lista
        for pid_str, cant_int in upserts.items():
            if pid_str in existentes:
                inv = existentes[pid_str]
                inv.cantidad = cant_int
                inv.save(update_fields=["cantidad"])
            else:
                Inventario.objects.create(
                    productoid_id=int(pid_str),
                    sucursalid=sucursal_destino,
                    cantidad=cant_int
                )

        # Importante: NO eliminamos lo que no vino en el payload
        messages.success(
            request,
            f'Inventario de «{sucursal_destino.nombre}» actualizado (merge: sin eliminar productos no listados).'
        )
        return JsonResponse({
            "success": True,
            "redirect_url": reverse("visualizar_inventarios"),
        })

# ─────────────────────────────────────────────────────────────────────────────
# Autocomplete de SUCURSALES (modo editar)
# ─────────────────────────────────────────────────────────────────────────────
class SucursalInventarioAutocompleteEditarView(PaginatedAutocompleteMixin):
    """
    Autocompletado de sucursales para la pantalla *Editar Inventario*.

    • Siempre incluye la sucursal que se está editando
      (parámetro GET “current_sucursal_id”).
    • Además muestra las sucursales SIN inventario (inventario__isnull=True),
      para permitir mover existencias a una nueva sede vacía.
    • Soporta paginación estándar del mixin (?page=, ?term= …).
    """
    model      = Sucursal
    text_field = "nombre"
    id_field   = "sucursalid"
    per_page   = 50   # mismo tamaño que usarás en JS

    def extra_filter(self, qs, request):
        """
        Aplica el filtro base:
          — sucursal actual  OR
          — sucursales sin inventario
        Luego .distinct() para evitar duplicados.
        """
        current_id = request.GET.get("current_sucursal_id")
        if current_id and current_id.isdigit():
            qs = qs.filter(
                Q(pk=current_id) | Q(inventario__isnull=True)
            )
        else:
            qs = qs.filter(inventario__isnull=True)
        return qs.distinct()

    # Añadimos el método «global» solo si lo necesitas; aquí NO se agrega.


# ─────────────────────────────────────────────────────────────────────────────
# Autocomplete de PRODUCTOS (excluye IDs ya listados)
# ─────────────────────────────────────────────────────────────────────────────
class ProductoInventarioAutocompleteView(LoginRequiredMixin, View):
    """
    Autocomplete de productos para Editar Inventario:
    - Muestra TODOS los productos (vinculados o no al inventario de la sucursal).
    - Excluye los IDs enviados en ?excluded=1,2,3
    - Filtra por 'term' en nombre (añade más campos si quieres).
    - Paginado por ?page= (1 por defecto), page_size=50.
    Respuesta: {results:[{id:<productoid>, text:<nombre>}]}
    """

    page_size = 50

    def get(self, request, *args, **kwargs):
        term = (request.GET.get("term") or "").strip()
        page = int(request.GET.get("page") or 1)

        # 1) Query base: TODOS los productos, sin relación a inventario/sucursal
        qs = Producto.objects.all().only("productoid", "nombre")

        # 2) Filtro por término (agrega más si los tienes)
        if term:
            qs = qs.filter(
                Q(nombre__icontains=term)
                # | Q(codigo__icontains=term)
                # | Q(referencia__icontains=term)
            )

        # 3) Excluir los IDs ya agregados en la UI
        excluded_param = (request.GET.get("excluded") or "").strip()
        if excluded_param:
            try:
                excluded_ids = [int(x) for x in excluded_param.split(",") if x.isdigit()]
                if excluded_ids:
                    qs = qs.exclude(productoid__in=excluded_ids)
            except Exception:
                pass

        qs = qs.order_by("nombre")

        paginator = Paginator(qs, self.page_size)
        page_obj = paginator.get_page(page)

        results = [
            {"id": obj.productoid, "text": obj.nombre}
            for obj in page_obj.object_list
        ]

        return JsonResponse({
            "results": results,
            "pagination": {"more": page_obj.has_next()}
        })


@login_required
def eliminar_producto_inventario_view(request, inventario_id):
    """
    Función para eliminar un registro de inventario vía AJAX.
    """
    if request.method == 'POST':
        inventario = get_object_or_404(Inventario, pk=inventario_id)
        producto_nombre = inventario.productoid.nombre
        inventario.delete()
        return JsonResponse({
            'success': True,
            'message': f'Producto "{producto_nombre}" eliminado exitosamente.'
        })
    return JsonResponse({'success': False, 'message': 'Método no permitido.'}, status=405)


class ProveedorCreateView(LoginRequiredMixin, View):
    """
    Crea un proveedor vía AJAX:
      • GET  → renderiza formulario
      • POST → devuelve JSON {success, message|errors}
    """
    template_name = "agregar_proveedor.html"

    def get(self, request):
        return render(request, self.template_name, {"form": ProveedorForm()})

    @transaction.atomic
    def post(self, request):
        form = ProveedorForm(request.POST)
        if form.is_valid():
            form.save()
            return JsonResponse({
                "success": True,
                "message": "Proveedor agregado exitosamente."
            })
        # form.errors es un ErrorDict → .get_json_data() lista mensajes y códigos
        return JsonResponse({
            "success": False,
            "errors": form.errors.get_json_data()
        }, status=400)


class ProveedorListView(LoginRequiredMixin, ListView):
    """Lista de proveedores (lectura únicamente)."""
    model               = Proveedor
    template_name       = "visualizar_proveedores.html"
    context_object_name = "proveedores"
    paginate_by         = 0          # paginación la maneja DataTables

@login_required
def eliminar_proveedor(request, proveedor_id):
    proveedor = get_object_or_404(Proveedor, proveedorid=proveedor_id)
    if request.method == 'POST':
        proveedor.delete()
        messages.success(request, 'El proveedor ha sido eliminado exitosamente.')
        return redirect('visualizar_proveedores')
    # Si la solicitud no es POST se vuelve a renderizar la página
    return render(request, 'visualizar_proveedores.html', {'proveedores': Proveedor.objects.all()})


class ProveedorUpdateView(LoginRequiredMixin, View):
    """
    Edición de proveedor con soporte AJAX.
    – GET  → renderiza el formulario.
    – POST → valida + responde JSON (success | errors)
    """

    def get(self, request, proveedor_id: int):
        proveedor = get_object_or_404(Proveedor, pk=proveedor_id)
        form      = EditarProveedorForm(instance=proveedor)
        return render(
            request,
            "editar_proveedor.html",
            {"form": form, "proveedor": proveedor},
        )

    def post(self, request, proveedor_id: int):
        proveedor = get_object_or_404(Proveedor, pk=proveedor_id)
        form      = EditarProveedorForm(request.POST, instance=proveedor)

        if form.is_valid():
            form.save()

            # el “flash” se mostrará al volver a la lista
            request.session["flash-prov"] = "Proveedor actualizado exitosamente."

            return JsonResponse(
                {
                    "success": True,
                    "redirect_url": reverse("visualizar_proveedores"),
                }
            )

        # serializamos los errores tal cual los genera Django
        return JsonResponse(
            {
                "success": False,
                "errors": form.errors.get_json_data(),
            }
        )



@method_decorator(transaction.atomic, name="dispatch")
class PreciosProveedorCreateAJAXView(LoginRequiredMixin, View):
    template_name = "agregar_productos_precios_proveedor.html"
    form_class    = PreciosProveedorForm

    # ---------- GET ----------
    def get(self, request):
        form = self.form_class()
        sin_precios = (
            Proveedor.objects
                     .annotate(p_count=Count("preciosproveedor"))
                     .filter(p_count=0)
        )
        if not sin_precios.exists():
            messages.error(request, "Todos los proveedores ya tienen precios cargados.")

        ctx = {"form": form, "proveedores": sin_precios}
        return render(request, self.template_name, ctx)

    # ---------- POST ----------
    def post(self, request):
        form = self.form_class(request.POST)

        if not form.is_valid():
            return JsonResponse({
                "success": False,
                "errors" : json.dumps(form.errors.get_json_data(escape_html=True))
            })

        proveedor = form.cleaned_data["proveedor"]
        raw_json  = request.POST.get("precios_temp", "[]")

        try:
            items = json.loads(raw_json)
        except json.JSONDecodeError:
            items = []

        if not items:
            return JsonResponse({
                "success": False,
                "errors": json.dumps({
                    "precios_temp": [{"message": "Debe agregar al menos un producto."}]
                })
            })

        batch = []
        for it in items:
            pid   = it.get("productId")
            price = it.get("price")

            # validaciones mínimas
            if not (pid and price):
                continue
            try:
                precio_dec = Decimal(price)
                if precio_dec <= 0:
                    raise ValidationError("Precio no válido")
            except Exception:
                continue

            producto = get_object_or_404(Producto, pk=pid)

            # evitar duplicados
            if PreciosProveedor.objects.filter(
                    productoid=producto, proveedorid=proveedor).exists():
                continue

            batch.append(PreciosProveedor(
                productoid=producto,
                proveedorid=proveedor,
                precio=precio_dec
            ))

        if not batch:
            return JsonResponse({
                "success": False,
                "errors": json.dumps({
                    "__all__": [{"message": "Nada que guardar."}]
                })
            })

        PreciosProveedor.objects.bulk_create(batch)
        return JsonResponse({"success": True})


# ──────────────────────────────────────────────────────────────
# 2. Autocompletados (mismo patrón que inventario)
# ──────────────────────────────────────────────────────────────
class ProveedorSinPreciosAutocomplete(PaginatedAutocompleteMixin):
    """
    • Devuelve todos los proveedores SIN precios
    • + el proveedor indicado en ?current=<id> (aunque tenga precios)
    """
    model = Proveedor    # el mixin usa id_field y text_field por defecto

    def extra_filter(self, qs, request):
        sin_precios = qs.annotate(cnt=Count("preciosproveedor")).filter(cnt=0)

        cur = request.GET.get("current", "").strip()
        if cur.isdigit():
            sin_precios = sin_precios | qs.filter(pk=cur)

        return sin_precios.distinct()


class ProductoExcludingAutocomplete(PaginatedAutocompleteMixin):
    """Productos excluyendo IDs ya listados en el front (query param excluded)."""
    model     = Producto
    id_field  = "productoid"

    def extra_filter(self, qs, request):
        excluded = request.GET.get("excluded", "")
        ids      = [int(x) for x in excluded.split(",") if x.isdigit()]
        return qs.exclude(productoid__in=ids) if ids else qs


class PreciosProveedorListView(LoginRequiredMixin, View):
    template_name = "visualizar_productos_precios_proveedores.html"

    # ---------- GET ----------
    def get(self, request):
        ctx = self._base_context()
        return render(request, self.template_name, ctx)

    # ---------- POST (filtro) ----------
    def post(self, request):
        ctx = self._base_context()
        pid = request.POST.get("proveedor")
        if pid:
            ctx["proveedor_seleccionado"] = prov = get_object_or_404(Proveedor, pk=pid)
            ctx["productos_precios"] = (
                PreciosProveedor.objects.filter(proveedorid=prov)
            )
        return render(request, self.template_name, ctx)

    # ---------- contexto común ----------
    def _base_context(self):
        proveedores = (
            Proveedor.objects.annotate(num=Count("preciosproveedor"))
                             .filter(num__gt=0)
        )
        return {
            "proveedores": proveedores,
            "productos_precios": None,
            "proveedor_seleccionado": None,
        }


class ProveedorConProductosAutocomplete(PaginatedAutocompleteMixin):
    """
    • Devuelve únicamente los proveedores que YA tienen al menos un
      producto en la tabla `PreciosProveedor`.
    • Soporta paginación (`page`, `per_page`) y búsqueda (`term`)
      exactamente igual que los demás autocompletes de la app.
    """
    model       = Proveedor
    text_field  = "nombre"        # lo que verá el usuario
    id_field    = "proveedorid"   # value que se enviará al servidor
    per_page    = 10              # por coherencia con tus otros autocompletes

    # ——— filtro adicional ———
    def extra_filter(self, qs, request):
        """
        · El mixin ya aplica «term» y la paginación.
        · Aquí sólo restringimos a “con productos”.
        """
        return (
            qs.filter(preciosproveedor__isnull=False)   # al menos un registro
              .distinct()
              .order_by("nombre")
        )


@login_required
def eliminar_precio_proveedor_view(request, id):
    if request.method == 'POST':
        precio_proveedor = get_object_or_404(PreciosProveedor, pk=id)
        nombre_producto = precio_proveedor.productoid.nombre
        precio_proveedor.delete()
        return JsonResponse({'success': True, 'message': f'Producto "{nombre_producto}" eliminado correctamente.'})
    return JsonResponse({'success': False, 'message': 'Error al eliminar el producto.'})


@method_decorator(transaction.atomic, name="dispatch")
class PreciosProveedorUpdateAJAXView(LoginRequiredMixin, View):
    """
    · GET  →  muestra el formulario con los productos del proveedor.
    · POST →  guarda los cambios recibidos en `precios_temp` (JSON):
              crea / actualiza / elimina, y si el usuario cambió
              de proveedor, desvincula todos los productos del anterior.
    """
    template_name = "editar_productos_precios_proveedor.html"
    form_class    = EditarPreciosProveedorForm

    # ---------- GET ----------
    def get(self, request, proveedor_id):
        proveedor = get_object_or_404(Proveedor, pk=proveedor_id)

        # --- productos actuales -> JSON que inyectamos al JS ---
        existentes = (
            PreciosProveedor.objects
            .filter(proveedorid=proveedor)
            .select_related("productoid")
        )
        productos_json = json.dumps([
            {
                "productId"  : pp.productoid_id,
                "productName": pp.productoid.nombre,
                "price"      : str(pp.precio),
            } for pp in existentes
        ])

        form = self.form_class(initial={
            "proveedor_autocomplete": proveedor.nombre,
            "proveedor"             : proveedor.pk,
        })

        ctx = {
            "form"                     : form,
            "proveedor"                : proveedor,
            "productos_existentes_json": productos_json,
        }
        return render(request, self.template_name, ctx)

    # ---------- POST ----------
    def post(self, request, proveedor_id):
        old_prov = get_object_or_404(Proveedor, pk=proveedor_id)   # (1) URL
        form     = self.form_class(request.POST)

        if not form.is_valid():
            return JsonResponse({
                "success": False,
                "errors" : json.dumps(form.errors.get_json_data(escape_html=True))
            })

        new_prov = form.cleaned_data["proveedor"]                  # (2) HIDDEN
        prov_has_changed = old_prov.pk != new_prov.pk              # (3) ¿cambió?

        # ───── si cambió, borramos TODO lo del proveedor anterior ─────
        if prov_has_changed:
            PreciosProveedor.objects.filter(proveedorid=old_prov).delete()

        prov = new_prov  # a partir de aquí siempre trabajamos con 'prov'

        # ---------- 1) JSON entrante ----------
        raw_json = request.POST.get("precios_temp", "[]")
        try:
            nuevos = json.loads(raw_json)
        except json.JSONDecodeError:
            nuevos = []

        # ---------- 2) normalizar ----------
        nuevos_map = {}
        for it in nuevos:
            pid, price = it.get("productId"), it.get("price")
            if not (pid and price):
                continue
            try:
                precio_dec = Decimal(price)
                if precio_dec <= 0:
                    raise InvalidOperation
            except (InvalidOperation, ValueError):
                continue
            nuevos_map[str(pid)] = precio_dec

        # ---------- 3) registros existentes del proveedor ----------
        existentes_qs   = PreciosProveedor.objects.filter(proveedorid=prov)
        existentes_dict = {str(pp.productoid_id): pp for pp in existentes_qs}

        to_create, to_update = [], []

        # ---------- 4) create / update ----------
        for pid, new_price in nuevos_map.items():
            if pid in existentes_dict:
                obj = existentes_dict.pop(pid)      # ya existe → quizás actualizar
                if obj.precio != new_price:
                    obj.precio = new_price
                    to_update.append(obj)
            else:                                   # nuevo
                to_create.append(
                    PreciosProveedor(
                        proveedorid   = prov,
                        productoid_id = int(pid),
                        precio        = new_price
                    )
                )

        # ---------- 5) delete (los que quedaron fuera del JSON) ----------
        if existentes_dict:
            PreciosProveedor.objects.filter(pk__in=existentes_dict).delete()

        # ---------- 6) bulk ops ----------
        if to_create:
            PreciosProveedor.objects.bulk_create(to_create)
        if to_update:
            PreciosProveedor.objects.bulk_update(to_update, ["precio"])

        messages.success(
            request,
            f"Productos y precios actualizados exitosamente para «{prov.nombre}»."
        )
        return JsonResponse({
            "success"     : True,
            "redirect_url": reverse("visualizar_productos_precios_proveedores")
        })

@method_decorator(transaction.atomic, name="dispatch")
class PuntosPagoCreateAJAXView(LoginRequiredMixin, View):
    """
    · GET  →  formulario + DataSet inicial.
    · POST →  crea puntos de pago a partir de `puntos_temp` (JSON).
              Responde {success, errors}
    """
    template_name = "agregar_punto_pago.html"
    form_class    = PuntosPagoForm

    # ---------- GET ----------
    def get(self, request):
        form = self.form_class()

        sin_pp = (Sucursal.objects
                  .annotate(pp_count=Count("puntospago"))
                  .filter(pp_count=0))

        if not sin_pp.exists():
            messages.error(request, "Todas las sucursales ya tienen puntos de pago.")

        ctx = {"form": form, "sucursales": sin_pp}
        return render(request, self.template_name, ctx)

    # ---------- POST ----------
    def post(self, request):
        form = self.form_class(request.POST)

        # 1) Val. básica del formulario
        if not form.is_valid():
            return JsonResponse({
                "success": False,
                "errors" : json.dumps(form.errors.get_json_data(escape_html=True))
            })

        sucursal = form.cleaned_data["sucursal"]
        raw_json = request.POST.get("puntos_temp", "[]")

        # 2) Parse JSON
        try:
            items = json.loads(raw_json)
        except json.JSONDecodeError:
            items = []

        if not items:
            return JsonResponse({
                "success": False,
                "errors" : json.dumps({
                    "puntos_temp": [{"message": "Debe agregar al menos un punto de pago."}]
                })
            })

        # 3) Construir lote
        batch = []
        for it in items:
            nombre  = (it.get("nombre") or "").strip()
            descr   = (it.get("descripcion") or "").strip()
            caja    = it.get("dinerocaja") or "0"

            if not nombre:
                continue

            # evitar duplicados
            if PuntosPago.objects.filter(sucursalid=sucursal, nombre__iexact=nombre).exists():
                return JsonResponse({
                    "success": False,
                    "errors" : json.dumps({
                        "nombre": [{"message": f'«{nombre}» ya existe en la sucursal.'}]
                    })
                })

            try:
                caja_dec = Decimal(caja)
                if caja_dec < 0:
                    raise InvalidOperation
            except (InvalidOperation, ValueError):
                caja_dec = Decimal("0")

            batch.append(PuntosPago(
                sucursalid = sucursal,
                nombre     = nombre,
                descripcion= descr,
                dinerocaja = caja_dec
            ))

        if not batch:
            return JsonResponse({
                "success": False,
                "errors" : json.dumps({
                    "__all__": [{"message": "Nada que guardar."}]
                })
            })

        # 4) Guardar
        PuntosPago.objects.bulk_create(batch)
        return JsonResponse({"success": True})


# ────────────────────────────────────────────────
# ②  Autocomplete  Sucursales sin Puntos-de-Pago
# ────────────────────────────────────────────────
class SucursalSinPuntoPagoAutocomplete(PaginatedAutocompleteMixin):
    model      = Sucursal
    text_field = "nombre"
    id_field   = "sucursalid"

    def extra_filter(self, qs, request):
        """
        Devuelve sólo las sucursales que aún NO tienen puntos de pago.
        """
        return (
            qs.annotate(pp_count=Count("puntospago"))
              .filter(pp_count=0)
              .order_by("nombre")
        )


class PuntosPagoListView(LoginRequiredMixin, View):
    """Listado + filtro por sucursal que YA tiene puntos de pago"""

    template_name = "visualizar_puntos_pago.html"

    # ---------- GET ----------
    def get(self, request):
        ctx = self._base_context()
        return render(request, self.template_name, ctx)

    # ---------- POST (filtro) ----------
    def post(self, request):
        ctx = self._base_context()
        sid = request.POST.get("sucursal")
        if sid:
            ctx["sucursal_seleccionada"] = suc = get_object_or_404(Sucursal, pk=sid)
            ctx["puntos_pago"] = PuntosPago.objects.filter(sucursalid=suc)
        return render(request, self.template_name, ctx)

    # ---------- contexto común ----------
    def _base_context(self):
        sucursales = (
            Sucursal.objects.annotate(num=Count("puntospago"))
                            .filter(num__gt=0)
        )
        return {
            "sucursales"          : sucursales,
            "puntos_pago"         : None,
            "sucursal_seleccionada": None,
        }

@login_required
def eliminar_punto_pago_view(request, puntopagoid):
    if request.method == 'POST':
        try:
            punto_pago = get_object_or_404(PuntosPago, pk=puntopagoid)
            nombre_punto = punto_pago.nombre
            punto_pago.delete()
            return JsonResponse({
                'success': True,
                'message': f'Punto de pago "{nombre_punto}" eliminado correctamente.'
            })
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'Error al eliminar el punto de pago: {str(e)}'
            })
    return JsonResponse({'success': False, 'message': 'Método no permitido.'})

class SucursalConPuntosAutocomplete(PaginatedAutocompleteMixin):
    """
    Autocomplete ▸ solo sucursales que YA tienen al menos un Punto de Pago.
    Conserva term, page, per_page y JSON estándar.
    """
    model        = Sucursal
    label_field  = "nombre"
    per_page     = 10

    def extra_filter(self, qs, request):
        sub = PuntosPago.objects.filter(sucursalid=OuterRef("pk"))
        return (
            qs.annotate(has_pp=Exists(sub))        # True si existe ≥1 punto
              .filter(has_pp=True)                 # ← elimina sucursales vacías
              .order_by("nombre")                  # orden alfabético consistente
        )

@method_decorator(login_required, name="dispatch")
@method_decorator(transaction.atomic,  name="dispatch")
class PuntosPagoUpdateAJAXView(View):
    template_name = "editar_puntos_pago.html"
    form_class    = PuntosPagoEditarForm

    # ---------- GET ----------
    def get(self, request, sucursal_id):
        sucursal = get_object_or_404(Sucursal, pk=sucursal_id)

        puntos_qs = (
            PuntosPago.objects
                      .filter(sucursalid=sucursal)
                      .values("puntopagoid", "nombre", "descripcion", "dinerocaja")
        )
        puntos = [
            {
                "id"         : p["puntopagoid"],
                "nombre"     : p["nombre"],
                "descripcion": p["descripcion"] or "",
                "dinerocaja" : float(p["dinerocaja"] or 0),
            }
            for p in puntos_qs
        ]

        form = self.form_class(initial={
            "sucursal"             : sucursal.pk,
            "sucursal_autocomplete": sucursal.nombre,
        })

        return render(request, self.template_name, {
            "form"       : form,
            "sucursal"   : sucursal,
            "puntos_json": json.dumps(puntos),
        })

    # ---------- POST ----------
    @transaction.atomic
    def post(self, request, sucursal_id):
        old_suc = get_object_or_404(Sucursal, pk=sucursal_id)
        form    = self.form_class(request.POST, initial={"sucursal": old_suc.pk})

        if not form.is_valid():
            return JsonResponse({
                "success": False,
                "errors" : json.dumps(form.errors.get_json_data(escape_html=True))
            })

        new_suc = form.cleaned_data["sucursal"]  # instancia

        # JSON de la tabla
        try:
            items = json.loads(request.POST.get("puntos_temp", "[]"))
        except json.JSONDecodeError:
            items = []

        if not items:
            return JsonResponse({
                "success": False,
                "errors" : json.dumps({
                    "puntos_temp": [{"message": "Debe agregar al menos un punto de pago."}]
                })
            })

        # helpers
        norm = lambda s: (s or "").strip().casefold()

        # existentes en sucursal origen (para eliminar los que no vengan)
        existentes_origen = {
            pp.puntopagoid: pp
            for pp in PuntosPago.objects.select_for_update().filter(sucursalid=old_suc)
        }

        # existentes por nombre en sucursal destino (para “merge” al crear)
        existentes_dest_por_nombre = {
            norm(pp.nombre): pp
            for pp in PuntosPago.objects.select_for_update().filter(sucursalid=new_suc)
        }

        keep_ids, to_create = set(), []

        for it in items:
            pid    = it.get("id")
            nombre = (it.get("nombre") or "").strip()
            descr  = (it.get("descripcion") or "").strip()
            caja   = it.get("dinerocaja") or "0"

            if not nombre:
                # OJO: esta validación es por ítem de la tabla, no por el input de arriba
                return JsonResponse({
                    "success": False,
                    "errors" : json.dumps({
                        "puntos_temp": [{"message": "Hay una fila sin nombre en la tabla."}]
                    })
                })

            try:
                caja_dec = Decimal(str(caja))
                if caja_dec < 0:
                    raise InvalidOperation
            except (InvalidOperation, ValueError):
                caja_dec = Decimal("0")

            # ---------- UPDATE ----------
            if pid:
                pid = int(pid)
                keep_ids.add(pid)
                obj = existentes_origen.get(pid)

                if not obj:
                    # el ID ya no existe en BD: lo tratamos como nuevo
                    # y seguimos la rama CREATE (ver abajo) sin error
                    pid = None
                else:
                    name_changed = norm(obj.nombre) != norm(nombre)
                    suc_changed  = obj.sucursalid_id != new_suc.pk

                    if name_changed or suc_changed:
                        # ¿Hay otro con el mismo nombre en la sucursal destino?
                        dup = PuntosPago.objects.filter(
                            sucursalid=new_suc, nombre__iexact=nombre
                        ).exclude(puntopagoid=pid).first()
                        if dup:
                            # En lugar de error, “fusionamos” al duplicado
                            dup.descripcion = descr
                            dup.dinerocaja  = caja_dec
                            dup.save(update_fields=["descripcion", "dinerocaja"])
                            keep_ids.add(dup.puntopagoid)
                            # y este lo marcamos para borrar si venía de old_suc
                            continue

                    # actualización normal
                    obj.sucursalid  = new_suc
                    obj.nombre      = nombre
                    obj.descripcion = descr
                    obj.dinerocaja  = caja_dec
                    obj.save()
                    continue  # next item

            # ---------- CREATE ----------
            if not pid:
                name_key = norm(nombre)
                if name_key in existentes_dest_por_nombre:
                    # Si ya existe en la sucursal destino con ese nombre,
                    # lo tratamos como UPDATE (merge), no como error.
                    obj = existentes_dest_por_nombre[name_key]
                    obj.descripcion = descr
                    obj.dinerocaja  = caja_dec
                    obj.save(update_fields=["descripcion", "dinerocaja"])
                    keep_ids.add(obj.puntopagoid)
                else:
                    to_create.append(PuntosPago(
                        sucursalid=new_suc, nombre=nombre,
                        descripcion=descr, dinerocaja=caja_dec
                    ))

        # eliminar los que ya no vienen (solo de la sucursal origen)
        delete_ids = [pk for pk in existentes_origen if pk not in keep_ids]
        if delete_ids:
            PuntosPago.objects.filter(puntopagoid__in=delete_ids).delete()

        if to_create:
            PuntosPago.objects.bulk_create(to_create)

        messages.success(request, "Puntos de pago actualizados exitosamente.")
        return JsonResponse({
            "success"     : True,
            "redirect_url": reverse("visualizar_puntos_pago")
        })

class SucursalEditarPuntoPagoAutocomplete(PaginatedAutocompleteMixin):
    """
    Devuelve:
      • la sucursal actual   (?current_sucursal_id=…)
      • + las sucursales que NO tienen puntos de pago
    """
    model       = Sucursal
    label_field = "nombre"
    per_page    = 10   # el mixin hace la paginación

    # ------------ filtro extra ------------
    def extra_filter(self, qs, request):
        term        = request.GET.get("term", "").strip()
        current_id  = request.GET.get("current_sucursal_id", "")

        # ¿la sucursal tiene puntos de pago?
        sub = PuntosPago.objects.filter(sucursalid=OuterRef("pk"))
        qs  = qs.annotate(has_pp=Exists(sub))

        # • sin puntos de pago                 OR
        # • la sucursal actual (si el parámetro es válido)
        filtro = Q(has_pp=False)
        if current_id.isdigit():
            filtro |= Q(pk=current_id)

        qs = qs.filter(filtro)

        if term:
            qs = qs.filter(nombre__icontains=term)

        return qs.order_by("nombre")


class RolCreateAJAXView(LoginRequiredMixin, FormView):
    """
    • GET  → renderiza formulario clásico
    • POST → alta AJAX; responde JSON {success, message | errors}
    """
    template_name = "agregar_rol.html"
    form_class    = RolForm

    # ---------- POST OK ----------
    def form_valid(self, form):
        rol = form.save()

        # Llamada AJAX (fetch) → devolvemos JSON
        if self.request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse({
                "success": True,
                "message": "Rol agregado exitosamente.",
                "rol": {
                    "id":   rol.pk,
                    "name": rol.nombre
                }
            })

        # Petición clásica → redirección donde corresponda
        return redirect("listar_roles")  # ajusta a tu flujo

    # ---------- POST errores ----------
    def form_invalid(self, form):
        return JsonResponse(
            {"success": False, "errors": form.errors.get_json_data()},
            status=400
        )


class RolListView(LoginRequiredMixin, ListView):
    """
    Muestra la tabla de roles con DataTable.
    """
    template_name       = "visualizar_roles.html"
    model               = Rol
    context_object_name = "roles"


class RolUpdateAJAXView(LoginRequiredMixin, UpdateView):
    """
    ▸ Edita un rol vía AJAX manteniendo la UX de ‘Editar Sucursal’.
    """
    model         = Rol
    pk_url_kwarg  = "rol_id"
    form_class    = RolEditarForm
    template_name = "editar_rol.html"
    success_url   = reverse_lazy("visualizar_roles")

    # -------- AJAX OK --------
    def form_valid(self, form):
        self.object = form.save()
        msg = f'Rol «{self.object.nombre}» actualizado correctamente.'
        # Siempre guardar el mensaje (aparecerá tras la redirección)
        messages.success(self.request, msg)

        if self.request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse({
                "success": True,
                "message": msg,
                "redirect_url": str(self.success_url),
            })
        return super().form_valid(form)

    # -------- AJAX KO --------
    def form_invalid(self, form):
        if self.request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse(
                {"success": False, "errors": form.errors.get_json_data()},
                status=400,
            )
        return super().form_invalid(form)


@login_required
def eliminar_rol_view(request, rol_id):
    if request.method == 'POST':
        rol = get_object_or_404(Rol, pk=rol_id)
        nombre_rol = rol.nombre
        rol.delete()
        messages.success(request, f'Se eliminó el rol "{nombre_rol}" correctamente.')
        return redirect('visualizar_roles')
    # Si no es POST, retornamos un JSON de error (o podrías redirigir)
    return JsonResponse({'success': False, 'message': 'Error al eliminar el rol.'})


class UsuarioCreateAJAXView(LoginRequiredMixin, FormView):
    template_name = "agregar_usuario.html"
    form_class    = UsuarioForm
    success_url   = reverse_lazy("visualizar_usuarios")   # ajusta la URL si existe

    # ----- POST ↩︎ JSON ----------------------------------------------------
    def form_valid(self, form):
        usuario = form.save()
        if self.request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse({
                "success": True,
                "message": "Usuario creado exitosamente.",
                "redirect_url": str(self.success_url),
            })
        messages.success(self.request, "Usuario creado exitosamente.")
        return redirect(self.success_url)

    def form_invalid(self, form):
        if self.request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse(
                {"success": False, "errors": form.errors.get_json_data()},
                status=400
            )
        return self.render_to_response(self.get_context_data(form=form))


# ──────────────────────────────────────────────────────────────────
#  Autocomplete «Rol»
# ──────────────────────────────────────────────────────────────────
class RolAutocompleteView(PaginatedAutocompleteMixin):
    """
    Devuelve roles paginados para el componente de autocompletado.
    """
    model      = Rol
    text_field = "nombre"
    id_field   = "rolid"
    per_page   = 10


class UsuarioListView(LoginRequiredMixin, ListView):
    """
    Muestra los usuarios en una tabla paginada con DataTables.

    • `select_related('rolid')` evita el N+1 al traer el Rol.
    • Se ordena alfabéticamente por nombre de usuario.
    • `context_object_name = "usuarios"` → variable en la plantilla.
    """
    model               = Usuario
    template_name       = "visualizar_usuarios.html"
    context_object_name = "usuarios"
    paginate_by         = 50

    def get_queryset(self):
        return (
            Usuario.objects
            .select_related("rolid")
            .order_by("nombreusuario")
        )

@login_required
def eliminar_usuario_view(request, usuarioid):
    usuario = get_object_or_404(Usuario, pk=usuarioid)
    nombre_usuario = usuario.nombreusuario
    usuario.delete()
    messages.success(request, f'Usuario "{nombre_usuario}" eliminado exitosamente.')
    return redirect('visualizar_usuarios')


class UsuarioUpdateAJAXView(LoginRequiredMixin, UpdateView):
    """
    Vista de actualización de usuarios:

    • GET  → Renderiza el formulario “editar_usuario.html”.
    • POST →   – Fetch/AJAX  ⇒ JSON   (success / errors)
               – Navegación   ⇒ redirect + messages.

    save() del formulario ya gestiona el cambio de contraseña.
    """
    model         = Usuario
    form_class    = UsuarioEditarForm
    template_name = "editar_usuario.html"
    pk_url_kwarg  = "usuario_id"              # /usuarios/editar/<usuario_id>/

    # ---------------------------------------------------------------- helpers
    @staticmethod
    def _is_ajax(request) -> bool:
        return request.headers.get("x-requested-with") == "XMLHttpRequest"

    # ---------------------------------------------------------------- context
    def get_context_data(self, **kwargs):
        """Inyectamos la lista de campos de contraseña para el bucle del template."""
        ctx = super().get_context_data(**kwargs)
        frm = ctx["form"]
        ctx["password_fields"] = [frm["contraseña"], frm["confirmar_contraseña"]]
        return ctx

    # ---------------------------------------------------------------- POST
    def form_valid(self, form):
        usuario = form.save()  # El ModelForm setea rol y contraseña si aplica

        if self._is_ajax(self.request):
            return JsonResponse({
                "success"     : True,
                "redirect_url": reverse("visualizar_usuarios"),
                "nombre"      : usuario.nombreusuario,
            })

        messages.success(
            self.request,
            f'Usuario «{usuario.nombreusuario}» actualizado correctamente.'
        )
        return super().form_valid(form)

    def form_invalid(self, form):
        if self._is_ajax(self.request):
            return JsonResponse(
                {"success": False, "errors": form.errors.get_json_data()},
                status=400,
            )
        return super().form_invalid(form)

    # ---------------------------------------------------------------- redirect
    def get_success_url(self):
        return reverse_lazy("visualizar_usuarios")




@method_decorator(transaction.atomic, name="dispatch")
class EmpleadoCreateAJAXView(LoginRequiredMixin, View):
    template_name = "agregar_empleado.html"
    form_class    = EmpleadoCreateForm

    # ---------- GET ----------
    def get(self, request):
        form = self.form_class()
        return render(request, self.template_name, {"form": form})

    # ---------- POST ----------
    def post(self, request):
        form = self.form_class(request.POST)

        if not form.is_valid():
            return JsonResponse({
                "success": False,
                "errors" : json.dumps(form.errors.get_json_data(escape_html=True))
            })

        try:
            emp = form.save()
            logger.info("Empleado creado %s", emp.pk)
        except Exception as exc:
            logger.exception("Error al guardar empleado")
            return JsonResponse({
                "success": False,
                "errors" : json.dumps({
                    "__all__": [{"message": "Ocurrió un error inesperado."}]
                })
            })

        return JsonResponse({"success": True})


# ─────────────────────────────────────────────────────────────
# 2. Autocompletados
# ─────────────────────────────────────────────────────────────
class UsuarioDisponibleAutocomplete(PaginatedAutocompleteMixin):
    """
    • Devuelve usuarios que **no** tienen empleado asociado
    • Incluye (?current=<id>) al editar para que siga apareciendo el usuario ya asignado
    """
    model       = Usuario
    id_field    = "pk"
    text_field  = "nombreusuario"

    def extra_filter(self, qs, request):
        # Excluir los que ya están vinculados, sin depender de related_name
        sub = Empleado.objects.filter(usuarioid=OuterRef("pk"))
        qs  = qs.annotate(has_emp=Exists(sub)).filter(has_emp=False)

        # incluir el usuario actual (modo edición)
        cur = request.GET.get("current", "").strip()
        if cur.isdigit():
            qs = qs | Usuario.objects.filter(pk=cur)

        # búsqueda por término
        term = request.GET.get("term", "").strip()
        if term:
            qs = qs.filter(nombreusuario__icontains=term)

        return qs.distinct().order_by("nombreusuario")


class SucursalAutocomplete(PaginatedAutocompleteMixin):
    """Todas las sucursales con búsqueda por nombre."""
    model     = Sucursal
    id_field  = "pk"
    text_field = "nombre"

    def extra_filter(self, qs, request):
        term = request.GET.get("term", "").strip()
        return qs.filter(nombre__icontains=term) if term else qs



class EmpleadoListView(LoginRequiredMixin, ListView):
    """
    Tabla paginada de empleados con DataTables (idéntico estilo a usuarios).

    • `order_by("nombre", "apellido")` para orden alfabético.
    • `context_object_name = "empleados"` → variable usada en la plantilla.
    """
    model               = Empleado
    template_name       = "visualizar_empleados.html"
    context_object_name = "empleados"
    paginate_by         = 50          # DataTables usa toda la page; igualmente paginamos.

    def get_queryset(self):
        return (
            Empleado.objects
            .order_by("nombre", "apellido")   # puedes añadir select_related() si lo necesitas
        )


class EmpleadoUpdateAJAXView(LoginRequiredMixin, UpdateView):
    """
    • GET  → renderiza “editar_empleado.html”.
    • POST →
        – Fetch/AJAX ⇒ JSON (success / errors)
        – Navegación  ⇒ redirect + messages
    """
    model         = Empleado
    form_class    = EditarEmpleadoForm          # ⇠ ver punto 3
    template_name = "editar_empleado.html"
    pk_url_kwarg  = "empleado_id"               # /empleados/editar/<empleado_id>/

    # ---------- util ----------
    @staticmethod
    def _is_ajax(request) -> bool:
        return request.headers.get("x-requested-with") == "XMLHttpRequest"

    # ---------- POST ----------
    def form_valid(self, form):
        emp = form.save()

        if self._is_ajax(self.request):
            return JsonResponse({
                "success"     : True,
                "redirect_url": reverse("visualizar_empleados"),
                "nombre"      : f"{emp.nombre} {emp.apellido}",
            })

        messages.success(
            self.request,
            f'Empleado «{emp.nombre} {emp.apellido}» actualizado correctamente.',
        )
        return super().form_valid(form)

    def form_invalid(self, form):
        if self._is_ajax(self.request):
            return JsonResponse(
                {"success": False, "errors": form.errors.get_json_data()},
                status=400,
            )
        return super().form_invalid(form)

    # ---------- redirect ----------
    def get_success_url(self):
        return reverse_lazy("visualizar_empleados")


@login_required
def eliminar_empleado_view(request, empleado_id):
    empleado = get_object_or_404(Empleado, pk=empleado_id)
    nombre_completo = f"{empleado.nombre} {empleado.apellido}"
    empleado.delete()
    messages.success(request, f'Empleado "{nombre_completo}" ha sido eliminado exitosamente.')
    return redirect('visualizar_empleados')


@method_decorator(transaction.atomic, name="dispatch")
class HorarioCreateAJAXView(LoginRequiredMixin, View):
    """
    • GET  → renderiza formulario “agregar_horario.html”
    • POST → guarda horarios a partir de 'horarios' (JSON)
               y responde JSON {success, errors}
    """
    template_name = "agregar_horario.html"
    form_class    = HorariosNegocioForm
    success_msg   = "Horario(s) agregado(s) exitosamente."

    def get(self, request):
        form = self.form_class()
        # Lista de días para el template
        days = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"]
        return render(request, self.template_name, {
            "form":  form,
            "days":  days,
        })

    def post(self, request):
        form = self.form_class(request.POST)
        # 1) validación del formulario base
        if not form.is_valid():
            return JsonResponse({
                "success": False,
                "errors": json.dumps(
                    form.errors.get_json_data(escape_html=True)
                )
            }, status=400)

        # 2) cargar array de horarios (JSON)
        raw = request.POST.get("horarios", "[]")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = []
        if not data:
            return JsonResponse({
                "success": False,
                "errors": json.dumps({
                    "horarios": [{"message": "Debe agregar al menos un horario."}]
                })
            }, status=400)

        # 3) construir batch de HorariosNegocio
        suc = form.cleaned_data["sucursalid"]
        batch = []
        for h in data:
            dia = h.get("dia")
            ap  = h.get("horaapertura")
            ci  = h.get("horacierre")
            if dia and ap and ci:
                batch.append(HorariosNegocio(
                    sucursalid   = suc,
                    dia_semana   = dia,
                    horaapertura = ap,
                    horacierre   = ci
                ))
        if not batch:
            return JsonResponse({
                "success": False,
                "errors": json.dumps({
                    "__all__": [{"message": "No hay horarios válidos para guardar."}]
                })
            }, status=400)

        # 4) bulk create y responder éxito
        HorariosNegocio.objects.bulk_create(batch)
        return JsonResponse({"success": True})

class SucursalSinHorarioAutocomplete(PaginatedAutocompleteMixin):
    """
    Autocomplete de sucursales sin horarios (paginado).
    """
    model      = Sucursal
    id_field   = "pk"
    text_field = "nombre"

    def extra_filter(self, qs, request):
        return qs.filter(horariosnegocio__isnull=True).order_by("nombre")

class HorariosListView(LoginRequiredMixin, View):
    template_name = "visualizar_horarios.html"

    # GET
    def get(self, request):
        ctx = self._base_context()
        return render(request, self.template_name, ctx)

    # POST (filtro)
    def post(self, request):
        ctx = self._base_context()
        sid = request.POST.get("sucursal")
        if sid:
            ctx["sucursal_seleccionada"] = suc = get_object_or_404(Sucursal, pk=sid)
            ctx["horarios"] = HorariosNegocio.objects.filter(sucursalid=suc)
        return render(request, self.template_name, ctx)

    # contexto común
    def _base_context(self):
        sucursales = (
            Sucursal.objects.annotate(num=Count("horariosnegocio"))
                            .filter(num__gt=0)               # sólo sucursales con horarios
        )
        return {
            "sucursales"          : sucursales,
            "horarios"            : None,
            "sucursal_seleccionada": None,
        }

# ---------- autocomplete ----------
class SucursalConHorariosAutocomplete(PaginatedAutocompleteMixin):
    """
    Autocomplete ▸ sólo sucursales que YA tienen al menos un horario.
    term, page, per_page & JSON estándar.
    """
    model        = Sucursal
    label_field  = "nombre"
    per_page     = 10

    def extra_filter(self, qs, request):
        sub = HorariosNegocio.objects.filter(sucursalid=OuterRef("pk"))
        return (
            qs.annotate(has_h=Exists(sub))
              .filter(has_h=True)
              .order_by("nombre")
        )


@method_decorator(transaction.atomic, name="dispatch")
class HorarioUpdateAJAXView(LoginRequiredMixin, View):
    """
    • GET  → muestra la plantilla con horarios actuales.
    • POST → recibe JSON con lista de horarios, los reemplaza y responde JSON.
    """
    template_name = "editar_horario.html"
    form_class    = EditarHorariosSucursalForm
    success_msg   = "Horarios actualizados correctamente."

    def get(self, request, sucursal_id):
        suc = get_object_or_404(Sucursal, pk=sucursal_id)
        hrs = (
            HorariosNegocio.objects
            .filter(sucursalid=suc)
            .order_by("dia_semana")
        )
        days = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"]
        return render(request, self.template_name, {
            "sucursal": suc,
            "horarios": hrs,
            "days":     days,
        })

    def post(self, request, sucursal_id):
        # 1) Cargo la payload JSON
        try:
            payload = json.loads(request.body)
        except (ValueError, TypeError):
            return JsonResponse(
                {"success": False, "error": "JSON inválido."},
                status=400
            )

        horarios = payload.get("horarios", [])
        form = self.form_class(payload, horarios_present=bool(horarios))

        if not form.is_valid():
            return JsonResponse({
                "success": False,
                "errors": json.dumps(
                    form.errors.get_json_data(escape_html=True)
                ),
            }, status=400)

        # 2) Borro los horarios de la sucursal original (de la URL)
        original_suc = get_object_or_404(Sucursal, pk=sucursal_id)
        HorariosNegocio.objects.filter(sucursalid=original_suc).delete()

        # 3) Creo los nuevos horarios en la sucursal seleccionada
        new_suc = get_object_or_404(
            Sucursal, pk=form.cleaned_data["sucursalid"]
        )
        nuevos = [
            HorariosNegocio(
                sucursalid=new_suc,
                dia_semana=h["dia"],
                horaapertura=h["horaapertura"],
                horacierre=h["horacierre"],
            )
            for h in horarios
        ]
        HorariosNegocio.objects.bulk_create(nuevos)

        # 4) Mensaje de éxito
        messages.success(request, self.success_msg)
        return JsonResponse({"success": True})



@login_required
def eliminar_horario_view(request, horario_id):
    if request.method == 'POST':
        horario = get_object_or_404(HorariosNegocio, pk=horario_id)
        horario.delete()
        return JsonResponse({'success': True, 'message': 'Horario eliminado exitosamente.'})
    return JsonResponse({'success': False, 'message': 'Método no permitido.'})


# ────────────────────────────────────────────────────────────────
#  AJAX Create — Horario de Caja
# ────────────────────────────────────────────────────────────────
@method_decorator(transaction.atomic, name="dispatch")
class HorarioCajaCreateAJAXView(LoginRequiredMixin, View):
    """
    • GET  → muestra el form y lista vacía.
    • POST → recibe JSON con lista de horarios, los guarda y responde JSON.
    """
    template_name = "agregar_horario_caja.html"
    form_class    = HorarioCajaForm
    success_msg   = "Horario(s) de caja agregado(s) exitosamente."

    def get(self, request):
        form = self.form_class()
        days = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"]
        return render(request, self.template_name, {
            "form": form,
            "days": days,
        })

    def post(self, request):
        raw = request.POST.get("horarios", "[]")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = []
        horarios_present = bool(data)

        form = self.form_class(request.POST, horarios_present=horarios_present)
        if not form.is_valid():
            return JsonResponse({
                "success": False,
                "errors": json.dumps(form.errors.get_json_data(escape_html=True))
            }, status=400)

        puntopago = form.cleaned_data["puntopagoid"]
        batch = []
        # Si viene lista JSON, la usamos directamente
        if horarios_present:
            for h in data:
                batch.append(HorarioCaja(
                    puntopagoid=puntopago,
                    dia_semana=h["dia"],
                    horaapertura=h["horaapertura"],
                    horacierre=h["horacierre"],
                ))
        else:
            # Fallback a campos individuales
            dias = form.cleaned_data["dia_semana"].split(",")
            ap   = form.cleaned_data["horaapertura"]
            ci   = form.cleaned_data["horacierre"]
            for d in dias:
                batch.append(HorarioCaja(
                    puntopagoid=puntopago,
                    dia_semana=d,
                    horaapertura=ap,
                    horacierre=ci,
                ))

        HorarioCaja.objects.bulk_create(batch)
        return JsonResponse({"success": True})


class SucursalAgregarHorarioCajaAutocomplete(View):
    """
    Devuelve sucursales que tienen >=1 Punto de Pago SIN ningún HorarioCaja.
    JSON: { results: [{id, text}], has_more: bool }
    """
    per_page = 10

    def get(self, request):
        term = (request.GET.get("term") or "").strip()
        page = int(request.GET.get("page") or 1)

        # IDs de sucursales con al menos un punto de pago sin horarios
        suc_ids = (
            PuntosPago.objects
            .filter(horarios_caja__isnull=True)        # ← usa related_name en HorarioCaja
            .values("sucursalid_id")
            .distinct()
        )

        qs = Sucursal.objects.filter(sucursalid__in=Subquery(suc_ids))
        if term:
            qs = qs.filter(nombre__icontains=term)

        qs = qs.order_by("nombre", "sucursalid")       # orden estable para paginación

        paginator = Paginator(qs, self.per_page)
        page_obj  = paginator.get_page(page)

        results = [{"id": s.sucursalid, "text": s.nombre} for s in page_obj.object_list]
        return JsonResponse({"results": results, "has_more": page_obj.has_next()})


class PuntosPagoAgregarHorarioCajaAutocomplete(View):
    """
    Devuelve puntos de pago de la sucursal dada que NO tengan HorarioCaja.
    JSON: { results: [{id, text}], has_more: bool }
    """
    per_page = 10

    def get(self, request):
        term   = (request.GET.get("term") or "").strip()
        page   = int(request.GET.get("page") or 1)
        suc_id = request.GET.get("sucursal_id")

        if not suc_id:
            return JsonResponse({"results": [], "has_more": False})

        qs = PuntosPago.objects.filter(
            sucursalid_id=suc_id,
            horarios_caja__isnull=True                 # ← usa related_name en HorarioCaja
        )
        if term:
            qs = qs.filter(nombre__icontains=term)

        qs = qs.order_by("nombre", "puntopagoid")      # orden estable para paginación

        paginator = Paginator(qs, self.per_page)
        page_obj  = paginator.get_page(page)

        results = [{"id": p.puntopagoid, "text": p.nombre} for p in page_obj.object_list]
        return JsonResponse({"results": results, "has_more": page_obj.has_next()})


# ─────────── Vista principal ───────────
@method_decorator(login_required, name="dispatch")
class VisualizarHorariosCajasView(View):
    template_name = "visualizar_horarios_cajas.html"

    def get(self, request):
        return render(request, self.template_name, self._base_context())

    def post(self, request):
        ctx = self._base_context()
        sid = request.POST.get("sucursal")
        if sid:
            suc = get_object_or_404(Sucursal, pk=sid)
            ctx["sucursal_seleccionada"] = suc

            # sólo puntos de esa sucursal que ya tienen al menos 1 horario
            sub = HorarioCaja.objects.filter(puntopagoid=OuterRef("pk"))
            ctx["puntos_pago"] = (
                PuntosPago.objects
                .filter(sucursalid=suc)
                .annotate(has_h=Exists(sub))
                .filter(has_h=True)
                .order_by("nombre")
            )

            pid = request.POST.get("punto_pago")
            if pid:
                pp = get_object_or_404(PuntosPago, pk=pid)
                ctx["punto_pago_seleccionado"] = pp
                ctx["horarios"] = HorarioCaja.objects.filter(puntopagoid=pp)

        return render(request, self.template_name, ctx)

    def _base_context(self):
        # sucursales que tienen al menos un punto de pago con horarios
        sub_pp = PuntosPago.objects.filter(sucursalid=OuterRef("pk"))
        sub_h  = HorarioCaja.objects.filter(puntopagoid=OuterRef("pk"))
        qs = (
            Sucursal.objects
            .annotate(has_pp=Exists(sub_pp.filter(Exists(sub_h))))
            .filter(has_pp=True)
            .order_by("nombre")
        )
        return {
            "sucursales": qs,
            "sucursal_seleccionada": None,
            "puntos_pago": [],
            "punto_pago_seleccionado": None,
            "horarios": [],
        }


# ─────────── Autocomplete Sucursal ───────────
class SucursalHorarioCajaAutocomplete(PaginatedAutocompleteMixin):
    model        = Sucursal
    id_field     = "pk"
    text_field   = "nombre"
    per_page     = 10

    def extra_filter(self, qs, request):
        # sólo sucursales con al menos un PuntoPago que tenga horarios
        sub_pp = PuntosPago.objects.filter(sucursalid=OuterRef("pk"))
        sub_h  = HorarioCaja.objects.filter(puntopagoid=OuterRef("pk"))
        return (
            qs.annotate(has=Exists(sub_pp.filter(Exists(sub_h))))
              .filter(has=True)
              .order_by("nombre")
        )


# ─────────── Autocomplete PuntoPago ───────────
class PuntoPagoHorarioCajaAutocomplete(PaginatedAutocompleteMixin):
    model        = PuntosPago
    id_field     = "pk"
    text_field   = "nombre"
    per_page     = 10

    def extra_filter(self, qs, request):
        # filtramos por sucursal_id y sólo puntos de pago con al menos un horario
        sid = request.GET.get("sucursal_id")
        sub_h = HorarioCaja.objects.filter(puntopagoid=OuterRef("pk"))
        qs = qs.annotate(has=Exists(sub_h)).filter(has=True)
        if sid:
            qs = qs.filter(sucursalid_id=sid)
        return qs.order_by("nombre")



@login_required
def eliminar_horario_caja_view(request, horario_id):
    try:
        horario = get_object_or_404(HorarioCaja, pk=horario_id)
        horario.delete()
        return JsonResponse({'success': True, 'message': 'Horario eliminado exitosamente.'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': 'Ocurrió un error al eliminar el horario.'})


# ──────────────────────────────────────────────────────────────
#  Vista principal (GET  → plantilla  |  POST → JSON)
# ──────────────────────────────────────────────────────────────
@method_decorator(transaction.atomic, name="dispatch")
class EditarHorarioCajaView(LoginRequiredMixin, View):
    template_name = "editar_horario_caja.html"
    form_class    = EditarHorarioCajaForm
    success_msg   = "Horarios actualizados correctamente."

    # ─── GET ────────────────────────────────────────────────────
    def get(self, request, puntopagoid):
        pp       = get_object_or_404(PuntosPago, pk=puntopagoid)
        horarios = (HorarioCaja.objects
                               .filter(puntopagoid=pp)
                               .order_by("dia_semana"))
        dias     = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"]

        return render(request, self.template_name, {
            "punto_pago": pp,
            "sucursal"  : pp.sucursalid,
            "horarios"  : horarios,
            "days"      : dias,
        })

    # ─── POST (AJAX) ────────────────────────────────────────────
    def post(self, request, puntopagoid):
        try:
            payload = json.loads(request.body or "{}")
        except ValueError:
            return JsonResponse({"success": False,
                                 "error":   "JSON inválido."},
                                status=400)

        form = self.form_class(payload,
                               horarios_present=bool(payload.get("horarios")))
        if not form.is_valid():
            return JsonResponse({
                "success": False,
                "errors" : form.errors.as_json(escape_html=True)
            }, status=400)

        new_sucursal_id  = form.cleaned_data["sucursalid"]
        new_puntopago_id = form.cleaned_data["puntopagoid"]

        old_pp = get_object_or_404(PuntosPago, pk=puntopagoid)

        try:
            with transaction.atomic():

                # 1 · Siempre borrar horarios del punto de pago original
                HorarioCaja.objects.filter(puntopagoid=old_pp).delete()

                # 2 · Si el usuario eligió OTRO punto de pago, limpiar ese nuevo
                if str(new_puntopago_id) != str(old_pp.pk):
                    HorarioCaja.objects.filter(puntopagoid_id=new_puntopago_id).delete()

                # 3 · Mover la caja de sucursal **solo si**:
                #       • El usuario NO cambió de punto de pago (sigue la misma caja)
                #       • Y cambió la sucursal
                if (str(new_puntopago_id) == str(old_pp.pk) and
                    str(new_sucursal_id)  != str(old_pp.sucursalid_id)):
                    new_suc = get_object_or_404(Sucursal, pk=new_sucursal_id)
                    old_pp.sucursalid = new_suc
                    old_pp.save(update_fields=["sucursalid"])

                # 4 · Crear la lista nueva de horarios
                nuevos = [
                    HorarioCaja(
                        puntopagoid_id=new_puntopago_id,
                        dia_semana    =h["dia"],
                        horaapertura  =h["horaapertura"],
                        horacierre    =h["horacierre"],
                    )
                    for h in payload["horarios"]
                ]
                HorarioCaja.objects.bulk_create(nuevos)

            messages.success(request, self.success_msg)
            return JsonResponse({"success": True})

        except Exception as exc:
            # En desarrollo imprime el traceback para ver la causa exacta
            import traceback, sys
            traceback.print_exc(file=sys.stderr)
            return JsonResponse({"success": False,
                                 "error":   str(exc)},
                                status=500)




class SucursalDisponibleCajaAutocomplete(PaginatedAutocompleteMixin):
    model = Sucursal

    def extra_filter(self, qs, request):
        """
        Devuelve sucursales que tengan al menos un punto de pago sin horario
        O la sucursal actualmente ligada al formulario (actual_id).
        """
        actual_id = request.GET.get("actual_id")

        sub_libre = PuntosPago.objects.filter(
            sucursalid=OuterRef("pk")
        ).filter(~Exists(HorarioCaja.objects.filter(puntopagoid=OuterRef("pk"))))

        qs = qs.annotate(tiene_libre=Exists(sub_libre))

        filtros = Q(tiene_libre=True)
        if actual_id and actual_id.isdigit():
            filtros |= Q(pk=actual_id)

        return qs.filter(filtros).distinct()


class PuntoCajaDisponibleAutocomplete(PaginatedAutocompleteMixin):
    model = PuntosPago

    def extra_filter(self, qs, request):
        """
        Devuelve los puntos de pago de la sucursal seleccionada que no tengan
        horario O el punto de pago actualmente ligado al formulario (actual_id).
        """
        suc_id    = request.GET.get("sucursal_id")
        actual_id = request.GET.get("actual_id")

        if suc_id and suc_id.isdigit():
            qs = qs.filter(sucursalid_id=suc_id)

        sub_horario = HorarioCaja.objects.filter(puntopagoid=OuterRef("pk"))
        qs = qs.annotate(ocupado=Exists(sub_horario))

        filtros = Q(ocupado=False)
        if actual_id and actual_id.isdigit():
            filtros |= Q(pk=actual_id)

        return qs.filter(filtros).distinct()





class ClienteCreateAJAXView(LoginRequiredMixin, FormView):
    """
    • GET  → muestra el formulario clásico.
    • POST → alta vía AJAX → responde JSON.
    """
    template_name = "agregar_cliente.html"
    form_class    = ClienteForm

    # ---------- POST OK ----------
    def form_valid(self, form):
        cliente = form.save()

        # llamada AJAX (fetch)
        if self.request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse({
                "success": True,
                "message": "Cliente agregado exitosamente.",
                "cliente": {
                    "id":   cliente.pk,
                    "name": f"{cliente.nombre} {cliente.apellido}"
                }
            })

        # Petición clásica (no-AJAX) – redirecciona a donde corresponda
        return redirect("listar_clientes")      # ajusta a tu flujo

    # ---------- POST con errores ----------
    def form_invalid(self, form):
        return JsonResponse(
            {"success": False, "errors": form.errors.get_json_data()},
            status=400
        )


class ClienteListView(LoginRequiredMixin, ListView):
    """
    Lista de clientes con DataTable.
    """
    template_name       = "visualizar_clientes.html"
    model               = Cliente
    context_object_name = "clientes"
    ordering            = ["nombre", "apellido"]   # opcional


@login_required
def eliminar_cliente(request, clienteid):
    cliente = get_object_or_404(Cliente, clienteid=clienteid)
    cliente.delete()
    messages.success(request, 'Cliente eliminado exitosamente.')
    return redirect('visualizar_clientes')


class ClienteUpdateAJAXView(LoginRequiredMixin, UpdateView):
    model         = Cliente
    pk_url_kwarg  = "cliente_id"
    form_class    = EditarClienteForm
    template_name = "editar_cliente.html"
    success_url   = reverse_lazy("visualizar_clientes")

    def form_valid(self, form):
        self.object = form.save()
        msg = f"Cliente «{self.object.nombre} {self.object.apellido}» actualizado."

        # Guarda SIEMPRE el mensaje en sesión (sirve tanto para AJAX como no-AJAX)
        messages.success(self.request, msg)

        # Respuesta AJAX: el front hace window.location = redirect_url
        if self.request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse({
                "success": True,
                "message": msg,
                "redirect_url": str(self.success_url),
            })

        # No-AJAX: redirección estándar
        return super().form_valid(form)

    def form_invalid(self, form):
        if self.request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse(
                {"success": False, "errors": form.errors.get_json_data()},
                status=400
            )
        return super().form_invalid(form)


class GenerarVentaView(LoginRequiredMixin, View):
    """
    GET  → muestra formulario
    POST → procesa la venta (ajax) y devuelve texto listo para imprimir

    Política: permite vender por encima de stock; el inventario puede quedar negativo.
    """
    template_name = "generar_venta.html"
    success_url   = reverse_lazy("generar_venta")

    # ---------- GET ----------
    def get(self, request, *args, **kwargs):
        form = GenerarVentaForm(request.GET or None)
        return render(request, self.template_name, self._base_context(form))

    # ---------- POST ----------
    def post(self, request, *args, **kwargs):
        form = GenerarVentaForm(request.POST)
        if not form.is_valid():
            return JsonResponse({'success': False, 'error': 'Formulario inválido.'})

        data = form.cleaned_data
        suc_inst = data['sucursal']     # instancia (ModelChoiceField)
        pp_inst  = data['puntopago']    # instancia (ModelChoiceField)

        productos  = data['productos']    # lista de ids (str/int)
        cantidades = data['cantidades']   # lista de cantidades (int/str)
        if not productos:
            return JsonResponse({'success': False, 'error': 'Carrito vacío.'})

        # Normalizar y alinear productos-cantidades
        try:
            prod_ids = [int(p) for p in productos]
        except (ValueError, TypeError):
            return JsonResponse({'success': False, 'error': 'IDs de productos inválidos.'})

        if len(cantidades) < len(prod_ids):
            return JsonResponse({'success': False, 'error': 'Faltan cantidades para algunos productos.'})

        # Traer productos existentes
        prods_qs = Producto.objects.filter(productoid__in=prod_ids)
        prods_map = {p.productoid: p for p in prods_qs}

        detalles = []
        total = Decimal('0')

        for idx, pid in enumerate(prod_ids):
            prod = prods_map.get(pid)
            if not prod:
                # Si algún producto del arreglo no existe, lo ignoramos (o podrías abortar)
                continue
            try:
                qty = int(cantidades[idx])
            except (ValueError, TypeError):
                return JsonResponse({'success': False, 'error': f'Cantidad inválida para producto {pid}.'})
            if qty <= 0:
                return JsonResponse({'success': False, 'error': f'Cantidad debe ser mayor a 0 para producto {pid}.'})

            # Precio como Decimal seguro
            try:
                precio_unit = Decimal(str(prod.precio or 0))
            except (InvalidOperation, TypeError):
                precio_unit = Decimal('0')

            subtotal = precio_unit * Decimal(qty)
            total += subtotal

            detalles.append({
                'productoid'     : prod.productoid,
                'producto'       : prod.nombre,
                'cantidad'       : qty,
                'precio_unitario': precio_unit,
                'subtotal'       : subtotal
            })

        if not detalles:
            return JsonResponse({'success': False, 'error': 'No hay ítems válidos para vender.'})

        # Crear venta y mover inventario
        return self._crear_venta(request.user, suc_inst, pp_inst, data.get('cliente_id'), data['medio_pago'], detalles, total)

    # ----------------------------------------------------------------------
    def _base_context(self, form, detalles=None, total=Decimal('0')):
        return {'form': form, 'detalles': detalles or [], 'total': total}

    @staticmethod
    def _build_receipt_text(venta_data, detalles, total):
        def money(n):
            try:
                q = Decimal(n)
            except Exception:
                q = Decimal('0')
            # formato $1.234.567
            return f"${int(q):,}".replace(",", ".")
        WIDTH = 32
        def line(txt=""): t = str(txt or ""); return t[:WIDTH]
        def lr(left, right):
            left = str(left or ""); right = str(right or "")
            space = max(1, WIDTH - len(left) - len(right))
            return left + (" " * space) + right

        ahora = timezone.localtime()
        head = [
            line("NOVA POS"),
            line("SUPER MERCADO VILLA CAFE"),
            line("NIT: 1.005.813.837-6"),
            line("FACTURA"),
            lr("Fecha:", ahora.strftime("%Y-%m-%d %H:%M")),
            lr("Sucursal:", venta_data.get("sucursal_nombre","")),
            "-" * WIDTH,
        ]
        body = []
        for d in detalles:
            nom = str(d.get("producto",""))[:WIDTH]
            qty = d.get("cantidad", 1)
            pu  = d.get("precio_unitario", Decimal('0'))
            sub = d.get("subtotal", Decimal('0'))
            body.append(line(nom))
            body.append(lr(f" x{qty}  @ {money(pu)}", money(sub)))
        foot = [
            "-" * WIDTH,
            lr("TOTAL:", money(total)),
            "",
            line("¡Gracias por su compra!"),
            ""
        ]
        return "\n".join(head + body + foot) + "\n\n\n"

    @staticmethod
    def _crear_venta(user, suc_inst, pp_inst, cliente_id, medio_pago, detalles, total):
        try:
            ahora = timezone.localtime()
            with transaction.atomic():
                empleado = getattr(user, "empleado", None)
                if empleado is None:
                    return JsonResponse({'success': False, 'error': 'El usuario no tiene un empleado asociado.'})

                cliente_inst = Cliente.objects.filter(pk=cliente_id).first() if cliente_id else None

                venta = Venta.objects.create(
                    fecha       = ahora.date(),
                    hora        = ahora.time(),
                    clienteid   = cliente_inst,
                    empleadoid  = empleado,
                    sucursalid  = suc_inst,   # pasar instancia, no ID
                    puntopagoid = pp_inst,    # pasar instancia, no ID
                    total       = total,      # Decimal
                    mediopago   = medio_pago
                )

                # Detalles + Inventario (permitiendo negativo)
                for d in detalles:
                    DetalleVenta.objects.create(
                        ventaid        = venta,
                        productoid_id  = d['productoid'],
                        cantidad       = d['cantidad'],
                        preciounitario = d['precio_unitario']  # Decimal
                    )
                    inv, _ = Inventario.objects.select_for_update().get_or_create(
                        productoid_id = d['productoid'],
                        sucursalid    = suc_inst,   # instancia consistente
                        defaults      = {"cantidad": 0}
                    )
                    inv.cantidad = (inv.cantidad or 0) - int(d['cantidad'])
                    inv.save(update_fields=["cantidad"])

                # Caja solo si es efectivo
                if (medio_pago or "").lower() == "efectivo":
                    pp_inst.dinerocaja = (pp_inst.dinerocaja or Decimal('0')) + total
                    pp_inst.save(update_fields=["dinerocaja"])

            receipt_text = GenerarVentaView._build_receipt_text(
                {"sucursal_nombre": getattr(suc_inst, 'nombre', str(suc_inst))},
                detalles, total
            )
            return JsonResponse({'success': True, 'venta_id': venta.pk, 'receipt_text': receipt_text})

        except Exception as e:
            # En desarrollo, devuelve el detalle del error para depurar más rápido
            if getattr(settings, "DEBUG", False):
                return JsonResponse({'success': False, 'error': f'Error al crear la venta: {e!s}'})
            return JsonResponse({'success': False, 'error': 'Error al crear la venta.'})

class ProductoSnapshotView(View):
    """
    Devuelve un snapshot compacto {id, name, price, stock, barcode} de TODOS
    los productos con stock>0 en la sucursal dada. Pensado para cachear en el
    browser y responder AC al instante.
    """
    per_hard_limit = 8000  # defensa: tope superior para cargas muy grandes

    def get(self, request, *args, **kwargs):
      sid = (request.GET.get("sucursal_id") or "").strip()
      if not sid.isdigit():
          return JsonResponse({"results": []})

      sid = int(sid)
      qs = (Producto.objects
            .filter(inventario__sucursalid=sid, inventario__cantidad__gt=0)  # <-- cambia a >=0 si aceptas ver productos sin stock
            .values(
                "productoid",
                "nombre",
                "precio",
                "codigo_de_barras",
            )
            .order_by(Lower("nombre"))[:self.per_hard_limit])

      # Mapa de stock por productoid en esa sucursal
      inv = Inventario.objects.filter(sucursalid=sid, productoid__in=[r["productoid"] for r in qs]).values("productoid", "cantidad")
      stock_map = { row["productoid"]: int(row["cantidad"]) for row in inv }

      results = [{
          "id": row["productoid"],
          "name": row["nombre"],
          "price": float(row["precio"] or 0),
          "stock": stock_map.get(row["productoid"], 0),
          "barcode": row["codigo_de_barras"] or ""
      } for row in qs]

      return JsonResponse({"results": results})


TICKET_WIDTH = 32  # caracteres aprox. para 58mm

def _fmt_money(v):
    return f"${v:,.0f}".replace(",", ".")

def _wrap(text, width=TICKET_WIDTH):
    return textwrap.wrap(str(text or ""), width=width, break_long_words=True, break_on_hyphens=False)

def _line():
    return "-" * TICKET_WIDTH

def _build_ticket(venta: Venta) -> bytes:
    """
    Construye el ticket en texto plano (ASCII) + 3 saltos + pulso abre-caja.
    """
    tz_now = timezone.localtime()
    out = []

    # Encabezado (ajusta a tu negocio)
    out += _wrap("NOVA ADVANCE")
    out += _wrap("NIT: 900.000.000-1")
    out.append(_line())
    out += _wrap(f"NIT: 1.005.813.837-6 #{venta.pk}")
    out += _wrap(f"Fecha: {venta.fecha}  {venta.hora.strftime('%H:%M')}")
    out += _wrap(f"Sucursal: {venta.sucursalid.nombre}")
    if getattr(venta, "clienteid", None):
        out += _wrap(f"Cliente: {venta.clienteid.nombre}")
    out.append(_line())

    # Detalle
    detalles = (DetalleVenta.objects
                .filter(ventaid=venta)
                .select_related("productoid"))
    for det in detalles:
        nombre = (det.productoid.nombre or "").strip()
        pu     = det.preciounitario or 0
        qty    = det.cantidad or 0
        subtotal = pu * qty

        # Primera línea: nombre (envuelto)
        lines = _wrap(nombre)
        if not lines:
            lines = ["(Producto)"]
        out.append(lines[0])
        # Segunda línea: cant x precio  => subtotal alineado a la derecha
        left = f"{qty} x {_fmt_money(pu)}"
        right = _fmt_money(subtotal)
        out.append(f"{left:<{TICKET_WIDTH-len(right)}}{right}")
        # Resto de renglones del nombre, si quedaron
        for extra in lines[1:]:
            out.append(extra)

    out.append(_line())
    out.append(f"{'TOTAL':<{TICKET_WIDTH-10}}{_fmt_money(venta.total):>10}")
    out.append(_line())
    out += _wrap(f"Medio de pago: {venta.mediopago.upper()}")
    out.append("")
    out += _wrap("¡Gracias por su compra!")
    out.append("")

    # 3 saltos de línea
    body = "\n".join(out) + "\n\n\n"
    data = body.encode("cp437", errors="ignore")

    # Pulso para abrir gaveta (ESC p m t1 t2) — mismo que tu ejemplo
    drawer_pulse = b"\x1B\x70\x00\x32\x32"

    return data + drawer_pulse

def _just_open_drawer() -> bytes:
    # Solo pulso + un salto
    return b"\n" + b"\x1B\x70\x00\x32\x32"

def _send_to_printer(payload: bytes) -> tuple[bool, str]:
    """
    Intenta enviar a /dev/usb/lp0; si no existe, intenta CUPS (lp raw).
    Devuelve (ok, error_message).
    """
    device = os.environ.get("PRINTER_DEVICE", "/dev/usb/lp0")
    # 1) /dev/usb/lp0
    try:
        if os.path.exists(device):
            with open(device, "wb") as f:
                f.write(payload)
            return True, ""
    except Exception as e:
        # sigue a fallback
        last_err = f"lp0 error: {e}"
    else:
        last_err = "lp0 no encontrado"

    # 2) CUPS (requiere 'lp' y una impresora configurada RAW)
    try:
        printer = os.environ.get("PRINTER", "")  # nombre de impresora en el sistema
        cmd = ["lp", "-o", "media=Custom.58x3276mm", "-o", "raw"]
        if printer:
            cmd.extend(["-d", printer])
        proc = subprocess.run(cmd, input=payload, check=True)
        return True, ""
    except Exception as e:
        return False, f"{last_err} ; CUPS error: {e}"

@method_decorator(require_POST, name="dispatch")
class ImprimirFacturaView(LoginRequiredMixin, View):
    """
    POST: {venta_id} → imprime ticket 58mm y abre la caja.
    """
    def post(self, request, *args, **kwargs):
        venta_id = request.POST.get("venta_id")
        if not venta_id or not str(venta_id).isdigit():
            return HttpResponseBadRequest("venta_id inválido")

        venta = get_object_or_404(Venta, pk=int(venta_id))
        payload = _build_ticket(venta)
        ok, err = _send_to_printer(payload)
        if ok:
            return JsonResponse({"success": True})
        return JsonResponse({"success": False, "error": err}, status=500)

@method_decorator(require_POST, name="dispatch")
class AbrirCajaView(LoginRequiredMixin, View):
    """
    POST: abre la caja sin imprimir ticket.
    """
    def post(self, request, *args, **kwargs):
        payload = _just_open_drawer()
        ok, err = _send_to_printer(payload)
        if ok:
            return JsonResponse({"success": True})
        return JsonResponse({"success": False, "error": err}, status=500)

class SucursalAutocompleteView(PaginatedAutocompleteMixin):
    model      = Sucursal
    text_field = "nombre"
    id_field   = "sucursalid"

    @staticmethod
    def extra_filter(qs, request):
        # IDs de sucursales con stock positivo
        inv_ids = Inventario.objects \
                            .filter(cantidad__gt=0) \
                            .values_list('sucursalid', flat=True) \
                            .distinct()
        # IDs de sucursales con puntos de pago
        pp_ids  = PuntosPago.objects \
                            .values_list('sucursalid', flat=True) \
                            .distinct()
        # Primero filtras por inventario, luego por puntos de pago
        return qs.filter(pk__in=inv_ids) \
                 .filter(pk__in=pp_ids)


class PuntoPagoAutocompleteView(PaginatedAutocompleteMixin):
    """
    Lista puntos de pago para la sucursal seleccionada.
    """
    model      = PuntosPago
    text_field = "nombre"
    id_field   = "puntopagoid"

    @staticmethod
    def extra_filter(qs, request):
        sid = request.GET.get("sucursal_id")
        if sid:
            return qs.filter(sucursalid__sucursalid=sid)
        return qs.none()  # si no hay sucursal, no listar

class ProductoAutocompleteView(PaginatedAutocompleteMixin):
    model      = Producto
    text_field = "nombre"
    id_field   = "productoid"
    per_page   = 15

    @staticmethod
    def extra_filter(qs, request):
        sid = request.GET.get("sucursal_id")
        if sid:
            return qs.filter(
                inventario__sucursalid=sid,
                inventario__cantidad__gt=0   # cambia a __gte=0 si quieres listar sin stock
            ).distinct()
        return qs.none()

    def get(self, request, *args, **kwargs):
        term = (request.GET.get("term","") or "").strip()
        sid  = (request.GET.get("sucursal_id") or "").strip()
        limit = int(request.GET.get("limit") or self.per_page)

        if not sid.isdigit():
            return JsonResponse({"results": [], "has_more": False})

        sid = int(sid)

        qs = (self.model.objects
              .filter(inventario__sucursalid=sid,
                      inventario__cantidad__gt=0)     # política stock
              .distinct()
              .annotate(lname=Lower("nombre")))

        if term:
            lt = term.lower()
            qs = (
                qs.filter(lname__contains=lt)
                  .annotate(
                      # 0 si empieza por el término, 1 en caso contrario
                      starts=Case(
                          When(Q(lname__startswith=lt), then=Value(0)),
                          default=Value(1),
                          output_field=IntegerField(),
                      ),
                      # posición del término (0 si es match exacto para priorizar)
                      pos=Case(
                          When(Q(lname=lt), then=Value(0)),
                          default=StrIndex(F("lname"), Value(lt)),
                          output_field=IntegerField(),
                      ),
                  )
                  .order_by("starts", "pos", "lname")
            )
        else:
            qs = qs.order_by("lname")

        total = qs.count()

        # payload mínimo y límite razonable
        qs_vals = list(
            qs.values("productoid", "nombre", "precio")[:max(5, min(50, limit))]
        )

        # stock por producto en esa sucursal
        prod_ids = [r["productoid"] for r in qs_vals]
        inv_map = {
            inv["productoid"]: inv["cantidad"]
            for inv in Inventario.objects.filter(
                productoid__in=prod_ids, sucursalid=sid
            ).values("productoid", "cantidad")
        }

        results = [{
            "id": r["productoid"],
            "text": r["nombre"],
            "precio": float(r["precio"] or 0),
            "stock": int(inv_map.get(r["productoid"], 0)),
        } for r in qs_vals]

        return JsonResponse({"results": results, "has_more": total > limit})

class ClienteAutocompleteView(PaginatedAutocompleteMixin):
    """
    Cliente por nombre / apellido / documento.
    Usamos un override para poder buscar en varios campos a la vez.
    """
    model = Cliente
    id_field = "clienteid"

    def get(self, request, *args, **kwargs):
        term   = request.GET.get("term", "").strip()
        page   = max(int(request.GET.get("page", 1)), 1)
        start, end = (page-1)*self.per_page, page*self.per_page

        qs = Cliente.objects.all()
        if term:
            qs = qs.filter(
                Q(nombre__icontains=term)  |
                Q(apellido__icontains=term)|
                Q(numerodocumento__icontains=term)
            )

        total   = qs.count()
        results = [
            {
              "id"  : c.clienteid,
              "text": f"{c.nombre} {c.apellido} ({c.numerodocumento})"
            }
            for c in qs.order_by("nombre")[start:end]
        ]
        return JsonResponse({"results": results, "has_more": end < total})



# ───────────────────────────────────────────────────────────────────────────
# ··· Vistas AJAX utilitarias ···
# ───────────────────────────────────────────────────────────────────────────
class VerificarProductoView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        producto_id = request.POST.get("producto_id")
        sucursal_id = request.POST.get("sucursal_id")
        try:
            cantidad = int(request.POST.get("cantidad") or 0)
        except ValueError:
            cantidad = 0

        if not (producto_id and sucursal_id and str(sucursal_id).isdigit()):
            return JsonResponse({'exists': False})

        try:
            producto   = Producto.objects.get(productoid=producto_id)
            inventario = Inventario.objects.get(productoid=producto, sucursalid=int(sucursal_id))
        except (Producto.DoesNotExist, Inventario.DoesNotExist):
            return JsonResponse({'exists': False})

        if inventario.cantidad < cantidad:
            return JsonResponse({'exists': True, 'cantidad_disponible': inventario.cantidad})

        precio   = producto.precio
        subtotal = precio * cantidad
        return JsonResponse({
            'exists': True,
            'precio_unitario':      precio,
            'precio_unitario_fmt':  f"${precio:,.2f}",
            'subtotal':             subtotal,
            'subtotal_fmt':         f"${subtotal:,.2f}",
            'cantidad_disponible':  inventario.cantidad,
            'nombre':               producto.nombre,
            'codigo_de_barras':     producto.codigo_de_barras
        })


class BuscarProductoPorCodigoView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        codigo      = request.GET.get("codigo_de_barras", "")
        sucursal_id = request.GET.get("sucursal_id")
        producto = Producto.objects.filter(
            codigo_de_barras=codigo, inventario__sucursalid=sucursal_id
        ).first()
        if not producto:
            return JsonResponse({'exists': False})

        stock = Inventario.objects.filter(
            productoid=producto, sucursalid=sucursal_id
        ).values_list("cantidad", flat=True).first() or 0

        return JsonResponse({
            'exists': True,
            'producto': {
                'id':              producto.productoid,
                'nombre':          producto.nombre,
                'codigo_de_barras':producto.codigo_de_barras,
                'precio':          float(producto.precio or 0),
                'stock':           int(stock),
            }
        })

class ProductoCodigoAutocompleteView(LoginRequiredMixin, View):
    per_page = 15
    def get(self, request, *args, **kwargs):
        term = (request.GET.get("term","") or "").strip()
        sid  = (request.GET.get("sucursal_id") or "").strip()
        if not sid.isdigit():
            return JsonResponse({"results": [], "has_more": False})

        qs = Producto.objects.filter(
            inventario__sucursalid=sid, inventario__cantidad__gt=0
        ).distinct()
        if term:
            filt = Q(nombre__icontains=term)
            if term.isdigit():
                try:
                    filt |= Q(productoid=int(term))
                except ValueError:
                    pass
            qs = qs.filter(filt)

        total = qs.count()
        qs = qs.order_by("nombre")[:self.per_page]

        inv_map = {inv.productoid_id: inv.cantidad
                   for inv in Inventario.objects.filter(
                        productoid__in=qs, sucursalid=int(sid)
                   )}

        results = [{
            "id": p.productoid,
            "text": p.nombre,
            "precio": float(p.precio or 0),
            "stock": int(inv_map.get(p.productoid, 0)),
        } for p in qs]

        return JsonResponse({"results": results, "has_more": total > self.per_page})

class ProductoBarrasAutocompleteView(LoginRequiredMixin, View):
    per_page = 15
    def get(self, request, *args, **kwargs):
        term = (request.GET.get("term","") or "").strip()
        sid  = (request.GET.get("sucursal_id") or "").strip()
        if not sid.isdigit():
            return JsonResponse({"results": [], "has_more": False})

        qs = Producto.objects.filter(
            inventario__sucursalid=sid, inventario__cantidad__gt=0
        ).distinct()
        if term:
            qs = qs.filter(Q(codigo_de_barras__icontains=term) | Q(nombre__icontains=term))

        total = qs.count()
        qs = qs.order_by("nombre")[:self.per_page]

        inv_map = {inv.productoid_id: inv.cantidad
                   for inv in Inventario.objects.filter(
                        productoid__in=qs, sucursalid=int(sid)
                   )}

        results = [{
            "id": p.productoid,
            "text": p.nombre,
            "barcode": p.codigo_de_barras or "",
            "precio": float(p.precio or 0),
            "stock": int(inv_map.get(p.productoid, 0)),
        } for p in qs]

        return JsonResponse({"results": results, "has_more": total > self.per_page})


class VentaListView(LoginRequiredMixin, ListView):
    """
    Lista de ventas, más recientes primero, paginada
    y con tabla responsive + buscador externo.
    """
    model               = Venta
    template_name       = "visualizar_ventas.html"
    context_object_name = "ventas"
    paginate_by         = 50
    ordering            = ["-fecha", "-hora"]



class VentaDetailView(LoginRequiredMixin, View):
    """
    Muestra el detalle de una venta y permite registrar devoluciones.
    """
    template_name = "ver_venta.html"

    def get(self, request, venta_id):
        venta = get_object_or_404(
            Venta.objects.select_related(
                "clienteid", "empleadoid", "sucursalid", "puntopagoid"
            ),
            pk=venta_id
        )

        # Anotamos subtotal = cantidad * preciounitario
        detalles = (
            DetalleVenta.objects
            .filter(ventaid=venta)
            .select_related("productoid")
            .annotate(
                subtotal=ExpressionWrapper(
                    F("cantidad") * F("preciounitario"),
                    output_field=DecimalField(max_digits=10, decimal_places=2)
                )
            )
        )

        DevolucionFormSet = formset_factory(DevolucionForm, extra=0)
        formset = DevolucionFormSet(initial=[
            {"detalle_id": d.pk, "devolver": 0} for d in detalles
        ])

        return render(request, self.template_name, {
            "venta":   venta,
            "filas":   zip(detalles, formset.forms),
            "formset": formset,
        })

    @transaction.atomic
    def post(self, request, venta_id):
        venta    = get_object_or_404(Venta, pk=venta_id)
        detalles = DetalleVenta.objects.filter(ventaid=venta)
        DevolucionFormSet = formset_factory(DevolucionForm, extra=0)
        formset = DevolucionFormSet(request.POST)

        if formset.is_valid():
            devoluciones = []
            for data in formset.cleaned_data:
                cant = data.get("devolver", 0)
                if cant:
                    devoluciones.append({
                        "detalle": detalles.get(pk=data["detalle_id"]),
                        "cantidad": cant
                    })

            if devoluciones:
                CambioDevolucion.registrar_devolucion(venta, devoluciones)
                messages.success(request, "✅ Devolución registrada correctamente.")

        return redirect(reverse_lazy("visualizar_ventas"))

class CambiosListView(LoginRequiredMixin, ListView):
    model = CambioDevolucion
    template_name = "visualizar_cambios.html"
    context_object_name = "cambios"
    paginate_by = 50
    ordering = ["-fecha", "-cambioid"]

    def get_queryset(self):
        return (
            CambioDevolucion.objects
            .select_related("venta", "productoid", "detalle")
            .order_by("-fecha", "-cambioid")
        )






@method_decorator(transaction.atomic, name="dispatch")
class PedidoProveedorCreateAJAXView(LoginRequiredMixin, View):
    """
    • GET  → renderiza form + selects iniciales
    • POST → valida, guarda y responde JSON {success, message|errors}
    """
    template_name = "agregar_pedido.html"
    form_class    = PedidoProveedorForm
    success_msg   = "Pedido guardado exitosamente."

    def get(self, request):
        form        = self.form_class()
        # opcionales: lista completa de proveedores y sucursales
        proveedores = Proveedor.objects.all().order_by("nombre")
        sucursales  = Sucursal.objects.all().order_by("nombre")
        return render(request, self.template_name, {
            "form": form,
            "proveedores": proveedores,
            "sucursales": sucursales,
        })

    def post(self, request):
        form = self.form_class(request.POST)
        if not form.is_valid():
            return JsonResponse({
                "success": False,
                "errors": json.dumps(form.errors.get_json_data())
            })
        # datos base
        prov   = form.cleaned_data["proveedor"]
        suc    = form.cleaned_data["sucursal"]
        fecha  = form.cleaned_data.get("fechaestimadaentrega")
        comen  = form.cleaned_data.get("comentario", "")
        detalles = json.loads(form.cleaned_data["detalles"])

        # 1) al menos uno
        if not detalles:
            return JsonResponse({
                "success": False,
                "errors": json.dumps({
                    "detalles":[{"message":"Debe agregar al menos un producto."}]
                })
            })

        # 2) validar que el proveedor venda cada producto
        invalidos = []
        for d in detalles:
            pid = d["productoid"]
            if not PreciosProveedor.objects.filter(
                productoid_id=pid, proveedorid=prov
            ).exists():
                nombre = Producto.objects.filter(pk=pid).first()
                invalidos.append(nombre.nombre if nombre else f"ID {pid}")
        if invalidos:
            return JsonResponse({
                "success": False,
                "message": (
                  "El proveedor NO vende: "
                  + ", ".join(invalidos)
                  + ". Revise el pedido."
                )
            })

        # 3) calcular total
        total = Decimal("0.00")
        for d in detalles:
            c = Decimal(str(d["cantidad"]))
            p = Decimal(str(d["precio_unitario"]))
            total += c * p

        # 4) guardar
        try:
            pedido = PedidoProveedor.objects.create(
                proveedorid=prov,
                sucursalid=suc,
                fechaestimadaentrega=fecha,
                costototal=total,
                comentario=comen,
                estado="En espera"
            )
            for d in detalles:
                DetallePedidoProveedor.objects.create(
                    pedidoid=pedido,
                    productoid_id=d["productoid"],
                    cantidad=d["cantidad"],
                    preciounitario=d["precio_unitario"]
                )
        except Exception as e:
            return JsonResponse({
                "success": False,
                "message": f"Error al guardar: {e}"
            })

        return JsonResponse({
            "success": True,
            "message": self.success_msg
        })


class ProductoPedidoAutocomplete(PaginatedAutocompleteMixin):
    """
    • Filtra por proveedor (GET ?proveedor_id=)
    • Excluye los IDs ya listados (?excluded=1,2,3)
    • Devuelve   id, text, precio   por página
    """
    model      = Producto
    text_field = "nombre"
    id_field   = "productoid"
    per_page   = 10           # si tu mixin ya lo trae, esta línea es opcional

    # --- filtros dinámicos --------------------------------------------------
    def extra_filter(self, qs, request):
        prov_id = request.GET.get("proveedor_id", "").strip()
        if prov_id:
            qs = qs.filter(
                Exists(
                    PreciosProveedor.objects.filter(
                        productoid=OuterRef("pk"),
                        proveedorid=prov_id
                    )
                )
            )

        excl = request.GET.get("excluded", "").split(",")
        excl_ids = [int(x) for x in excl if x.isdigit()]
        if excl_ids:
            qs = qs.exclude(productoid__in=excl_ids)

        return qs.order_by("nombre")

    # --- sobrescribimos GET para inyectar el precio -------------------------
    def get(self, request, *args, **kwargs):
        import json

        # respuesta «base» del mixin (JsonResponse)
        base_response = super().get(request, *args, **kwargs)

        # lo convertimos a dict
        base_data = json.loads(base_response.content)

        prov_id = request.GET.get("proveedor_id")
        nuevos  = []
        for itm in base_data["results"]:
            precio = (
                PreciosProveedor.objects
                .filter(productoid_id=itm["id"], proveedorid=prov_id)
                .values_list("precio", flat=True)
                .first()   # None → usamos 0
            ) or 0
            nuevos.append({**itm, "precio": str(precio)})

        return JsonResponse(
            {"results": nuevos, "has_more": base_data["has_more"]},
            safe=False
        )

class PedidoListView(LoginRequiredMixin, ListView):
    """
    Lista de pedidos a proveedor, más recientes primero, paginada
    y con la variable *just_updated* para mostrar la alerta cuando
    se vuelve desde “Editar Pedido”.
    """
    model               = PedidoProveedor
    template_name       = "visualizar_pedidos.html"
    context_object_name = "pedidos"
    paginate_by         = 50
    ordering            = ["-fechapedido"]

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["just_updated"] = self.request.GET.get("updated") == "1"
        return ctx


@login_required
def eliminar_pedido(request, pedido_id):
    if request.method == 'POST':
        try:
            pedido = get_object_or_404(PedidoProveedor, pk=pedido_id)
            pedido.delete()
            return JsonResponse({'success': True})
        except Exception as e:
            print("Error al eliminar:", e)  # Para debug en la consola del servidor
            return JsonResponse({'success': False, 'message': 'Error al eliminar el pedido.'})
    else:
        return JsonResponse({'success': False, 'message': 'Método no permitido.'})

class PedidoDetailView(LoginRequiredMixin, DetailView):
    model               = PedidoProveedor
    template_name       = "ver_pedido.html"
    context_object_name = "pedido"
    pk_url_kwarg        = "pedido_id"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        # obtenemos los detalles asociados
        detalles = DetallePedidoProveedor.objects.filter(pedidoid=self.object)
        # calculamos subtotal en cada uno
        for det in detalles:
            det.subtotal = det.preciounitario * det.cantidad
        ctx["detalles"] = detalles
        return ctx

@method_decorator(login_required, name="dispatch")
class EditarPedidoView(View):
    template_name = "editar_pedido.html"

    def get(self, request, pedido_id):
        pedido = get_object_or_404(PedidoProveedor, pk=pedido_id)

        detalles_qs = (
            DetallePedidoProveedor.objects
            .filter(pedidoid=pedido)
            .select_related("productoid")
            .annotate(
                subtotal=ExpressionWrapper(
                    F("cantidad") * F("preciounitario"),
                    output_field=DecimalField(max_digits=14, decimal_places=2),
                )
            )
            .order_by("productoid__nombre")
        )

        detalles_json = json.dumps([
            {
                "detallepedidoid": det.detallepedidoid,
                "productoid":      det.productoid_id,
                "producto":        det.productoid.nombre,
                "cantidad":        det.cantidad,
                "precio_unitario": float(det.preciounitario),
                "subtotal":        float(det.subtotal),
            }
            for det in detalles_qs
        ])

        form = EditarPedidoForm(initial={
            "proveedor":               pedido.proveedorid_id,
            "proveedor_autocomplete":  pedido.proveedorid.nombre,
            "sucursal":                pedido.sucursalid_id,
            "sucursal_autocomplete":   pedido.sucursalid.nombre,
            "fechaestimadaentrega":    pedido.fechaestimadaentrega,
            "comentario":              pedido.comentario or "",
            "estado":                  pedido.estado,
            "monto_pagado":            pedido.monto_pagado or "",
            "caja_pagoid":             pedido.caja_pago_id or "",
            "caja_pago_autocomplete":  pedido.caja_pago.nombre if pedido.caja_pago else "",
            "detalles":                detalles_json,
        })

        return render(request, self.template_name, {
            "form":          form,
            "pedido":        pedido,
            "detalles_qs":   detalles_qs,
            "detalles_json": detalles_json,
        })

    @transaction.atomic
    def post(self, request, pedido_id):
        form = EditarPedidoForm(request.POST)
        if not form.is_valid():
            errs = {
                f: [{"message": e["message"]} for e in ferr]
                for f, ferr in form.errors.get_json_data().items()
            }
            return JsonResponse({"success": False, "errors": errs})

        pedido = get_object_or_404(PedidoProveedor, pk=pedido_id)

        # Estado previo para decidir caja y si sumar inventario
        previo_estado  = pedido.estado
        previo_caja_id = pedido.caja_pago_id  # puede ser None

        # Campos base
        pedido.proveedorid_id       = form.cleaned_data["proveedor"]
        pedido.sucursalid_id        = form.cleaned_data["sucursal"]
        pedido.fechaestimadaentrega = form.cleaned_data["fechaestimadaentrega"]
        pedido.comentario           = form.cleaned_data.get("comentario", "")
        pedido.estado               = form.cleaned_data["estado"]

        # Detalles desde el form (JSON)
        detalles = json.loads(form.cleaned_data["detalles"] or "[]")

        # Recalcular total
        total = sum(
            Decimal(str(d["precio_unitario"])) * Decimal(str(d["cantidad"]))
            for d in detalles
        )
        pedido.costototal = total

        # Si pasa a "Recibido", validar caja/pago
        if pedido.estado == "Recibido":
            monto   = Decimal(str(form.cleaned_data["monto_pagado"]))
            caja_id = form.cleaned_data["caja_pagoid"]

            # Descontar solo si antes no estaba recibido o cambió la caja
            debe_descontar = (previo_estado != "Recibido") or (str(previo_caja_id) != str(caja_id))
            if debe_descontar:
                caja = get_object_or_404(PuntosPago.objects.select_for_update(), pk=caja_id)
                if caja.dinerocaja < monto:
                    return JsonResponse({
                        "success": False,
                        "errors": {"monto_pagado": [{"message": "Saldo insuficiente en la caja seleccionada."}]}
                    })
                caja.dinerocaja -= monto
                caja.save(update_fields=["dinerocaja"])

            pedido.monto_pagado   = monto
            pedido.caja_pago_id   = caja_id
            pedido.fecha_recibido = date.today()
        else:
            # Limpiar campos de recibido si cambió de estado
            pedido.monto_pagado   = None
            pedido.caja_pago      = None
            pedido.fecha_recibido = None

        # Guardar cabecera antes de tocar líneas
        pedido.save()

        # Reemplazar detalles del pedido
        DetallePedidoProveedor.objects.filter(pedidoid=pedido).delete()
        nuevas = [
            DetallePedidoProveedor(
                pedidoid       = pedido,
                productoid_id  = d["productoid"],
                cantidad       = d["cantidad"],
                preciounitario = Decimal(str(d["precio_unitario"])),
            )
            for d in detalles
        ]
        if nuevas:
            DetallePedidoProveedor.objects.bulk_create(nuevas)

        # === Si quedó RECIBIDO ===
        if pedido.estado == "Recibido":
            proveedor_id = pedido.proveedorid_id
            sucursal_id  = pedido.sucursalid_id

            # 1) Actualizar precios del proveedor si cambiaron
            for d in detalles:
                prod_id      = int(d["productoid"])
                precio_nuevo = Decimal(str(d["precio_unitario"])).quantize(Decimal("0.01"))
                pp, created = PreciosProveedor.objects.get_or_create(
                    productoid_id=prod_id,
                    proveedorid_id=proveedor_id,
                    defaults={"precio": precio_nuevo},
                )
                if not created and pp.precio != precio_nuevo:
                    pp.precio = precio_nuevo
                    pp.save(update_fields=["precio"])

            # 2) Sumar al inventario de la sucursal (solo si antes NO estaba recibido)
            if previo_estado != "Recibido":
                for d in detalles:
                    prod_id = int(d["productoid"])
                    qty     = Decimal(str(d["cantidad"]))  # usa int(...) si tu campo es entero

                    inv, _ = Inventario.objects.select_for_update().get_or_create(
                        sucursalid_id=sucursal_id,
                        productoid_id=prod_id,
                        defaults={"cantidad": 0}
                    )
                    # Incremento atómico
                    Inventario.objects.filter(pk=inv.pk).update(
                        cantidad = F("cantidad") + qty
                    )

        # ✅ Mensaje de éxito (sistema de mensajes de Django)
        messages.success(request, f"El pedido #{pedido.pedidoid} se actualizó correctamente.")

        # ✅ Redirección con query param para alert en visualizar_pedidos
        return JsonResponse({
            "success": True,
            "redirect_url": reverse("visualizar_pedidos") + "?updated=1&msg=Pedido%20actualizado%20correctamente",
        })

class PuntoPagoPorSucursalAutocomplete(PaginatedAutocompleteMixin):
    model      = PuntosPago
    text_field = "nombre"
    id_field   = "puntopagoid"
    per_page   = 10

    def extra_filter(self, qs, request):
        sid = request.GET.get("sucursal_id")
        if sid:
            qs = qs.filter(sucursalid_id=sid)
        return qs.order_by(self.text_field)

class PermisoCreateView(LoginRequiredMixin, CreateView):
    model = Permiso
    form_class = PermisoForm
    template_name = "permiso_form.html"
    success_url = reverse_lazy("permiso_agregar")  # permanecer en la página para agregar varios

    def form_valid(self, form):
        response = super().form_valid(form)
        messages.success(self.request, "Permiso creado correctamente.")
        return response

    def form_invalid(self, form):
        messages.error(self.request, "Por favor corrige los errores.")
        return super().form_invalid(form)

class PermisoListView(LoginRequiredMixin, ListView):
    """
    Muestra la tabla de permisos con DataTable.
    """
    template_name       = "visualizar_permisos.html"
    model               = Permiso
    context_object_name = "permisos"

class PermisoUpdateAJAXView(LoginRequiredMixin, UpdateView):
    """
    ▸ Edita un permiso vía AJAX, manteniendo misma UX que ‘Editar Rol’.
    """
    model         = Permiso
    pk_url_kwarg  = "permiso_id"
    form_class    = PermisoEditarForm
    template_name = "editar_permiso.html"
    success_url   = reverse_lazy("visualizar_permisos")

    # -------- AJAX OK --------
    def form_valid(self, form):
        self.object = form.save()
        msg = f'Permiso «{self.object.nombre}» actualizado correctamente.'
        messages.success(self.request, msg)  # persiste tras redirect

        if self.request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse({
                "success": True,
                "message": msg,
                "redirect_url": str(self.success_url),
            })
        return super().form_valid(form)

    # -------- AJAX KO --------
    def form_invalid(self, form):
        if self.request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse(
                {"success": False, "errors": form.errors.get_json_data()},
                status=400,
            )
        return super().form_invalid(form)

def eliminar_permiso(request, pk):
    """Elimina por POST y vuelve a la lista."""
    if request.method == "POST":
        obj = get_object_or_404(Permiso, pk=pk)
        nombre = obj.nombre
        obj.delete()
        messages.success(request, f"Permiso «{nombre}» eliminado correctamente.")
    return redirect("visualizar_permisos")

class RolPermisoAssignView(LoginRequiredMixin, View):
    """
    Página + endpoint AJAX para asociar 1..n permisos a un rol.
    Espera:
      - form.rol (hidden) con el rol elegido.
      - permisos_temp (hidden) con JSON: [{permisoId:<id>, permisoName:<txt>}, ...]
    """
    template_name = "roles_permisos.html"
    form_class = RolPermisoAssignForm

    def get(self, request):
        return render(request, self.template_name, {"form": self.form_class()})

    @transaction.atomic
    def post(self, request):
        form = self.form_class(request.POST)
        if not form.is_valid():
            # form.errors.get_json_data() ya viene estructurado; lo serializamos
            return JsonResponse(
                {"success": False, "errors": json.dumps(form.errors.get_json_data(escape_html=True))},
                status=400,
            )

        # Rol
        rol = form.cleaned_data["rol"]

        # Lista de permisos venida del front
        raw = request.POST.get("permisos_temp", "[]")
        try:
            items = json.loads(raw)
        except json.JSONDecodeError:
            return JsonResponse(
                {"success": False, "errors": json.dumps({"__all__":[{"message":"JSON inválido"}]})},
                status=400,
            )

        if not items:
            return JsonResponse(
                {"success": False, "errors": json.dumps({"__all__":[{"message":"Debe agregar al menos un permiso."}]})},
                status=400,
            )

        creados = 0
        for it in items:
            pid = it.get("permisoId")
            if not pid:
                continue
            permiso = get_object_or_404(Permiso, pk=pid)

            # Gracias al unique(rol, permiso) esto es seguro y atómico
            _, was_created = RolPermiso.objects.get_or_create(rol=rol, permiso=permiso)
            if was_created:
                creados += 1

        if not creados:
            return JsonResponse(
                {"success": False, "errors": json.dumps({"__all__":[{"message":"Nada que guardar."}]})},
                status=400,
            )

        messages.success(request, f"Se asociaron {creados} permisos al rol «{rol.nombre}».")
        return JsonResponse({"success": True, "created": creados})


# ---------- Autocompletes ----------
class RolAutocomplete(LoginRequiredMixin, View):
    """
    Devuelve {results: [{id, text}, ...], has_more: bool}
    • Solo roles SIN permisos asociados en rolespermisos
    • Filtro por 'term' y paginación por 'page'
    """
    PAGE_SIZE = 20

    def get(self, request):
        term = (request.GET.get("term") or "").strip()
        page = int(request.GET.get("page") or 1)

        # Subquery: ¿existe algún rol-permiso para este rol?
        has_perms = Exists(
            RolPermiso.objects.filter(rol=OuterRef("pk"))
        )

        qs = (
            Rol.objects
               .annotate(_has_perms=has_perms)
               .filter(_has_perms=False)          # <-- solo SIN permisos
               .order_by("nombre")
        )

        if term:
            qs = qs.filter(Q(nombre__icontains=term))

        start = (page - 1) * self.PAGE_SIZE
        end   = start + self.PAGE_SIZE
        total = qs.count()
        rows  = qs[start:end]

        results = [{"id": r.pk, "text": r.nombre} for r in rows]
        has_more = end < total
        return JsonResponse({"results": results, "has_more": has_more})


class PermisoAutocomplete(LoginRequiredMixin, View):
    """
    Devuelve permisos excluyendo IDs ya listados (?excluded=1,2,3).
    Respuesta {results:[{id,text}], has_more}
    """
    PAGE_SIZE = 30

    def get(self, request):
        term = (request.GET.get("term") or "").strip()
        page = max(int(request.GET.get("page") or 1), 1)

        excluded = request.GET.get("excluded", "")
        ids = [int(x) for x in excluded.split(",") if x.isdigit()]

        qs = Permiso.objects.exclude(pk__in=ids).order_by("nombre")
        if term:
            qs = qs.filter(Q(nombre__icontains=term) | Q(descripcion__icontains=term))

        start, end = (page - 1) * self.PAGE_SIZE, page * self.PAGE_SIZE
        total = qs.count()
        rows = qs[start:end]

        results = [{"id": p.pk, "text": p.nombre} for p in rows]
        return JsonResponse({"results": results, "has_more": end < total})

class VisualizarRolesPermisosView(LoginRequiredMixin, View):
    """
    GET  -> página base sin tabla (hasta que el usuario elija un rol)
    POST -> recibe rol (id) y muestra sus permisos en tabla
    """
    template_name = "visualizar_roles_permisos.html"

    def get(self, request):
        return render(request, self.template_name, self._ctx())

    def post(self, request):
        ctx = self._ctx()
        rid = (request.POST.get("rol") or "").strip()  # <input name="rol" ...>
        if rid.isdigit():
            rol = get_object_or_404(Rol, pk=int(rid))
            permisos_rel = (
                RolPermiso.objects
                .select_related("permiso")
                .filter(rol=rol)
                .order_by("permiso__nombre")
            )
            ctx["rol_seleccionado"] = rol
            ctx["permisos_rel"] = permisos_rel
        # si no hay id válido, vuelve con página base
        return render(request, self.template_name, ctx)

    def _ctx(self):
        # contexto mínimo; la búsqueda se hace con un endpoint de autocomplete
        return {"rol_seleccionado": None, "permisos_rel": None}


@login_required
def eliminar_rol_permiso_view(request, rp_id):
    """
    Elimina una relación RolPermiso por PK (botón papelera) y devuelve JSON.
    Maneja grácilmente el caso 'no encontrado' para clientes AJAX.
    """
    try:
        rel = RolPermiso.objects.select_related("permiso").get(pk=rp_id)
    except RolPermiso.DoesNotExist:
        return JsonResponse(
            {"success": False, "message": "Relación no encontrada."},
            status=404
        )

    nombre_perm = rel.permiso.nombre
    rel.delete()
    return JsonResponse(
        {"success": True, "message": f'Permiso "{nombre_perm}" desvinculado correctamente.'}
    )


class RolConPermisosAutocomplete(LoginRequiredMixin, View):
    """
    Respuesta: {results:[{id,text}], has_more:bool}
    GET: term, page
    """
    PAGE = 20

    def get(self, request):
        term = (request.GET.get("term") or "").strip()
        page = int(request.GET.get("page") or 1)

        sub = RolPermiso.objects.filter(rol_id=OuterRef("pk"))
        qs = (Rol.objects
              .annotate(has_perms=Exists(sub))
              .filter(has_perms=True)
              .order_by("nombre"))
        if term:
            qs = qs.filter(nombre__icontains=term)

        total = qs.count()
        start = (page - 1) * self.PAGE
        end   = start + self.PAGE
        rows  = qs[start:end]

        results = [{"id": r.pk, "text": r.nombre} for r in rows]
        return JsonResponse({"results": results, "has_more": end < total})

class RolesPermisosEditView(LoginRequiredMixin, View):
    """
    Editar permisos de un rol con 'buffer':
      • GET  -> muestra permisos actuales
      • POST -> aplica altas (permisos_temp) y bajas (permisos_borrar) en batch
    """
    template_name = "editar_roles_permisos.html"
    form_class    = RolPermisoEditForm
    success_url   = reverse_lazy("visualizar_roles_permisos")

    def get(self, request, rol_id):
        rol = get_object_or_404(Rol, pk=rol_id)

        rels = (RolPermiso.objects
                .select_related("permiso")
                .filter(rol=rol)
                .order_by("permiso__nombre"))

        form = self.form_class(initial={"rol": rol})
        ctx = {"rol": rol, "form": form, "permisos_rel": rels}
        return render(request, self.template_name, ctx)

    @transaction.atomic
    def post(self, request, rol_id):
        """
        Espera:
          - 'permisos_temp'   => JSON con altas [{permisoId, permisoName}]
          - 'permisos_borrar' => JSON con bajas  [permisoId, ...]
        """
        rol  = get_object_or_404(Rol, pk=rol_id)
        form = self.form_class(request.POST, initial={"rol": rol})

        if not form.is_valid():
            return JsonResponse({
                "success": False,
                "errors": form.errors.get_json_data(escape_html=True),
            }, status=400)

        import json

        # ALTAS
        raw_add = request.POST.get("permisos_temp", "[]")
        try:
            items_add = json.loads(raw_add)
        except json.JSONDecodeError:
            items_add = []

        # BAJAS
        raw_del = request.POST.get("permisos_borrar", "[]")
        try:
            items_del = json.loads(raw_del)
        except json.JSONDecodeError:
            items_del = []

        # Nada que hacer
        if not items_add and not items_del:
            return JsonResponse({
                "success": False,
                "errors": {"__all__": [{"message": "No hay cambios para guardar."}]}
            }, status=400)

        creados = 0
        eliminados = 0

        # Procesar ALTAS (evitar duplicados)
        for it in items_add:
            pid = it.get("permisoId")
            if not pid:
                continue
            permiso = get_object_or_404(Permiso, pk=pid)
            _, was_created = RolPermiso.objects.get_or_create(rol=rol, permiso=permiso)
            if was_created:
                creados += 1

        # Procesar BAJAS (por permiso_id)
        if items_del:
            ids = [int(x) for x in items_del if str(x).isdigit()]
            if ids:
                qs = RolPermiso.objects.filter(rol=rol, permiso_id__in=ids)
                eliminados = qs.count()
                qs.delete()

        messages.success(
            request,
            f"Cambios guardados para «{rol.nombre}». (+{creados} altas, −{eliminados} bajas)"
        )
        return JsonResponse({
            "success": True,
            "created": creados,
            "deleted": eliminados,
            "redirect_url": str(self.success_url)
        })


class PermisoParaRolAutocomplete(LoginRequiredMixin, View):
    """
    Autocomplete de permisos EXCLUYENDO:
      • los que ya tiene el rol en BD (salvo los marcados en 'pending_remove')
      • los listados en 'excluded' (agregados en el front)
    GET:
      term, page, rol_id, excluded, pending_remove
    Resp: {results:[{id,text}], has_more:bool}
    """
    PAGE = 30

    def get(self, request):
        term = (request.GET.get("term") or "").strip()
        page = int(request.GET.get("page") or 1)

        # agregados en el front (no deben aparecer)
        excluded = request.GET.get("excluded", "")
        excluded_ids = [int(x) for x in excluded.split(",") if x.isdigit()]

        # ids marcados PARA BORRAR (en borrador) -> deben volver a aparecer
        pend = request.GET.get("pending_remove", "")
        pending_remove_ids = [int(x) for x in pend.split(",") if x.isdigit()]

        # rol actual (para excluir los que tiene en BD, menos los pending_remove)
        rid = request.GET.get("rol_id")
        already_ids = []
        if rid and rid.isdigit():
            already_ids = list(
                RolPermiso.objects.filter(rol_id=int(rid))
                                   .values_list("permiso_id", flat=True)
            )
            if pending_remove_ids:
                # quita de "ya vinculados" los que están marcados para borrar en borrador
                already_ids = [pid for pid in already_ids if pid not in set(pending_remove_ids)]

        # construir queryset final
        qs = Permiso.objects.exclude(pk__in=already_ids + excluded_ids).order_by("nombre")
        if term:
            qs = qs.filter(Q(nombre__icontains=term) | Q(descripcion__icontains=term))

        total = qs.count()
        start = (page - 1) * self.PAGE
        rows  = qs[start:start + self.PAGE]

        data = [{"id": p.pk, "text": p.nombre} for p in rows]
        return JsonResponse({"results": data, "has_more": start + self.PAGE < total})

PAGE_SIZE = 20

class VentasDiariasView(LoginRequiredMixin, View):
    template_name = "ventas_diarias.html"

    def get(self, request):
        # fecha por defecto (local)
        hoy = timezone.localdate()
        return render(request, self.template_name, {"fecha_hoy": hoy.isoformat()})


class SucursalParaVentasAutocomplete(LoginRequiredMixin, View):
    """Autocomplete de sucursales que tienen al menos un Punto de Pago."""
    PAGE = PAGE_SIZE

    def get(self, request):
        term = (request.GET.get("term") or "").strip()
        page = int(request.GET.get("page") or 1)

        sub = PuntosPago.objects.filter(sucursalid=OuterRef("pk"))
        qs = (
            Sucursal.objects
            .annotate(has_pp=Exists(sub))
            .filter(has_pp=True)
            .order_by("nombre")
        )

        if term:
            qs = qs.filter(nombre__icontains=term)

        total = qs.count()
        start, end = (page - 1) * self.PAGE, page * self.PAGE
        data = [{"id": s.pk, "text": s.nombre} for s in qs[start:end]]
        return JsonResponse({"results": data, "has_more": end < total})

class PuntoPagoParaVentasAutocomplete(LoginRequiredMixin, View):
    """Autocomplete de puntos de pago filtrados por sucursal."""
    PAGE = PAGE_SIZE

    def get(self, request):
        term = (request.GET.get("term") or "").strip()
        page = int(request.GET.get("page") or 1)
        sid = request.GET.get("sucursal_id")

        qs = PuntosPago.objects.all().order_by("nombre")
        if sid and str(sid).isdigit():
            qs = qs.filter(sucursalid_id=int(sid))
        if term:
            qs = qs.filter(nombre__icontains=term)

        total = qs.count()
        start, end = (page - 1) * self.PAGE, page * self.PAGE
        data = [{"id": p.pk, "text": p.nombre} for p in qs[start:end]]
        return JsonResponse({"results": data, "has_more": end < total})


class VentasDiariasStatsView(LoginRequiredMixin, View):
    """
    Devuelve {num_ventas, total_vendido} para (sucursal, puntopago, fecha) y modo de pago.
    Usa Venta.mediopago (case-insensitive).

    Modos soportados desde el front:
      - TOTAL      → no filtra por método
      - EFECTIVO   → filtra mediopago ∈ {EFECTIVO, CASH, EF}
      - NEQUI      → filtra mediopago ∈ {NEQUI}
      - DAVIPLATA  → filtra mediopago ∈ {DAVIPLATA, DAVI}
    """
    # Normalizaciones aceptadas (todas en mayúscula)
    METODO_ALIASES = {
        "EFECTIVO": {"EFECTIVO", "CASH", "EF"},
        "NEQUI": {"NEQUI"},
        "DAVIPLATA": {"DAVIPLATA", "DAVI", "DAVI PLATA"},
    }

    def get(self, request):
        sid  = request.GET.get("sucursal_id")
        pid  = request.GET.get("puntopago_id")
        f    = request.GET.get("fecha")
        modo = (request.GET.get("modo") or "TOTAL").upper().strip()

        if not (sid and pid and f):
            return JsonResponse({"success": False, "error": "Parámetros incompletos."}, status=400)

        suc = get_object_or_404(Sucursal, pk=sid)                 # pk → sucursalid
        pp  = get_object_or_404(PuntosPago, pk=pid, sucursalid=suc)  # pk → puntopagoid

        # fecha yyyy-mm-dd
        try:
            fecha = timezone.datetime.fromisoformat(f).date()
        except Exception:
            return JsonResponse({"success": False, "error": "Fecha inválida."}, status=400)

        # Base: ventas del punto de pago en esa fecha
        qs = Venta.objects.filter(puntopagoid=pp, fecha=fecha)

        # TOTAL: sin discriminar método
        if modo == "TOTAL":
            agg = qs.aggregate(num=Count("ventaid"), total=Sum("total"))
            return JsonResponse({
                "success": True,
                "num_ventas": int(agg["num"] or 0),
                "total_vendido": float(agg["total"] or 0),
            })

        # Filtrado por método usando Venta.mediopago (case-insensitive)
        met_aliases = self.METODO_ALIASES.get(modo)
        if not met_aliases:
            return JsonResponse({"success": False, "error": "Modo de pago inválido."}, status=400)

        # Normalizamos a mayúsculas para comparar sin importar el casing almacenado
        qs_met = qs.annotate(_mp=Upper("mediopago")).filter(_mp__in=met_aliases)
        agg = qs_met.aggregate(num=Count("ventaid"), total=Sum("total"))

        return JsonResponse({
            "success": True,
            "num_ventas": int(agg["num"] or 0),
            "total_vendido": float(agg["total"] or 0),
        })

class SucursalConPedidosPagadosAutocomplete(LoginRequiredMixin, View):
    """
    Sucursales que tengan al menos un pedido 'Recibido' con monto_pagado > 0.
    GET: term, page, [fecha]
    """
    PAGE = 25
    def get(self, request):
        term  = (request.GET.get("term") or "").strip()
        page  = int(request.GET.get("page") or 1)
        fecha = request.GET.get("fecha")
        fecha = parse_date(fecha) if fecha else None

        subq = PedidoProveedor.objects.filter(
            sucursalid_id=OuterRef("pk"),
            estado="Recibido",
        ).exclude(monto_pagado__isnull=True).exclude(monto_pagado=0)

        if fecha:
            subq = subq.filter(fecha_recibido=fecha)

        qs = (Sucursal.objects
              .annotate(tiene=Exists(subq))
              .filter(tiene=True)
              .order_by("nombre"))
        if term:
            qs = qs.filter(nombre__icontains=term)

        total = qs.count()
        start = (page-1)*self.PAGE
        end   = start + self.PAGE
        rows  = qs[start:end]
        data  = [{"id": s.pk, "text": s.nombre} for s in rows]
        return JsonResponse({"results": data, "has_more": end < total})

class PuntosPagoConPedidosPagadosAutocomplete(LoginRequiredMixin, View):
    """
    Puntos de pago con pedidos 'Recibido' y monto_pagado > 0.
    GET: term, page, sucursal_id, [fecha]
    """
    PAGE = 25
    def get(self, request):
        term   = (request.GET.get("term") or "").strip()
        page   = int(request.GET.get("page") or 1)
        suc_id = request.GET.get("sucursal_id")
        fecha  = request.GET.get("fecha")
        fecha  = parse_date(fecha) if fecha else None

        qs = PuntosPago.objects.all()
        if suc_id and str(suc_id).isdigit():
            qs = qs.filter(sucursalid_id=int(suc_id))

        subq = PedidoProveedor.objects.filter(
            caja_pago_id=OuterRef("pk"),
            estado="Recibido",
        ).exclude(monto_pagado__isnull=True).exclude(monto_pagado=0)

        if fecha:
            subq = subq.filter(fecha_recibido=fecha)

        qs = qs.annotate(tiene=Exists(subq)).filter(tiene=True).order_by("nombre")
        if term:
            qs = qs.filter(nombre__icontains=term)

        total = qs.count()
        start = (page-1)*self.PAGE
        end   = start + self.PAGE
        rows  = qs[start:end]
        data  = [{"id": p.pk, "text": p.nombre} for p in rows]
        return JsonResponse({"results": data, "has_more": end < total})

class PedidosPagadosView(LoginRequiredMixin, View):
    """
    Página y endpoint para resumir pedidos pagados.
    GET  -> render
    POST -> JSON con 'cantidad' y 'total'
    """
    template_name = "pedidos_pagados.html"

    def get(self, request):
        return render(request, self.template_name, {})

    def post(self, request):
        suc_id  = request.POST.get("sucursal_id")
        pp_id   = request.POST.get("puntopago_id")
        fecha_s = request.POST.get("fecha")  # opcional
        fecha   = parse_date(fecha_s) if fecha_s else None

        if not (suc_id and str(suc_id).isdigit()):
            return JsonResponse({"success": False,
                                 "message": "Selecciona una sucursal."}, status=400)

        qs = PedidoProveedor.objects.filter(
            sucursalid_id=int(suc_id),
            estado="Recibido",
        ).exclude(monto_pagado__isnull=True).exclude(monto_pagado=0)

        if fecha:
            qs = qs.filter(fecha_recibido=fecha)

        if pp_id and str(pp_id).isdigit():
            qs = qs.filter(caja_pago_id=int(pp_id))

        agg = qs.aggregate(
            cantidad=Count("pedidoid"),
            total=Sum("monto_pagado")
        )
        cantidad = agg["cantidad"] or 0
        total    = agg["total"] or 0

        return JsonResponse({
            "success": True,
            "cantidad": int(cantidad),
            "total": f"{total:.2f}"
        })