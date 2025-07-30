from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from .models import Usuario, Sucursal, Categoria, Producto, Inventario, Proveedor, PreciosProveedor, PuntosPago, Rol, Empleado, HorariosNegocio, HorarioCaja, Cliente, Venta, DetalleVenta, PedidoProveedor, DetallePedidoProveedor, CambioDevolucion
from django.db.models import Count, Sum, Exists, OuterRef, Q
from django.http import JsonResponse
from django.contrib.auth import authenticate, login as auth_login
import json
from datetime import datetime, date
from django.utils import timezone
from django.contrib.auth import authenticate, login
import logging
from django.db import transaction
import subprocess
import os
from .nequi_websocket import verificacionPago
from django.views.decorators.csrf import csrf_exempt
from django.db.models import F, ExpressionWrapper, DecimalField
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
)
from dal import autocomplete
from decimal import Decimal, InvalidOperation
from django.urls import reverse, reverse_lazy
from itertools import zip_longest
from django.forms import formset_factory 
from django.views          import View
from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView
from django.views.generic.edit import FormView, UpdateView
from django.views.generic import ListView
from django.utils.decorators import method_decorator
from django.utils.html import escape


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
    Lista de productos optimizada y paginada.

    • select_related('categoria') evita el problema N+1.
    • Se ordena alfabéticamente por nombre.
    • context_object_name = 'productos' mantiene la variable usada en la plantilla.
    """
    model               = Producto
    template_name       = "visualizar_productos.html"
    context_object_name = "productos"
    paginate_by         = 50                      # ajusta si necesitas menos/más filas

    def get_queryset(self):
        return (
            Producto.objects
            .select_related("categoria")
            .order_by("nombre")
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
                {"success": False, "errors": form.errors.get_json_data()},
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
    POST → procesa JSON de inventarios y redirige.
    """

    template_name = "editar_inventario.html"

    # ---------- GET ----------
    def get(self, request, sucursal_id):
        sucursal_original = get_object_or_404(Sucursal, pk=sucursal_id)
        inventarios_existentes = (
            Inventario.objects
            .filter(sucursalid=sucursal_original)
            .select_related("productoid")
            .order_by("productoid__nombre")
        )

        form = EditarInventarioForm(initial={
            "sucursal": sucursal_original.pk,
            "sucursal_autocomplete": sucursal_original.nombre,
        })

        return render(request, self.template_name, {
            "form": form,
            "sucursal": sucursal_original,
            "inventarios": inventarios_existentes,
        })

    # ---------- POST ----------
    @transaction.atomic
    def post(self, request, sucursal_id):
        form = EditarInventarioForm(request.POST)
        if not form.is_valid():
            errors = {
                fld: [{"message": e["message"]} for e in ferr]
                for fld, ferr in form.errors.get_json_data().items()
            }
            return JsonResponse({"success": False,
                                 "errors": json.dumps(errors)})

        nueva_sucursal = form.cleaned_data["sucursal"]
        raw_json       = form.cleaned_data["inventarios_temp"]

        try:
            data = json.loads(raw_json or "[]")
        except json.JSONDecodeError:
            return JsonResponse({
                "success": False,
                "errors": json.dumps({
                    "inventarios_temp": [{
                        "message": "Formato JSON inválido."
                    }]
                })
            })

        # ----- Diccionario {id: cantidad} -----
        nuevo_dic = {
            str(item["productId"]): int(item["cantidad"])
            for item in data
            if item.get("productId") and item.get("cantidad") is not None
        }

        # Si cambió la sucursal, limpiamos inventario anterior
        sucursal_original = get_object_or_404(Sucursal, pk=sucursal_id)
        if sucursal_original != nueva_sucursal:
            Inventario.objects.filter(sucursalid=sucursal_original).delete()

        # ----- Inventario existente en la nueva sucursal -----
        existentes = {
            str(obj.productoid_id): obj
            for obj in Inventario.objects.filter(sucursalid=nueva_sucursal)
        }

        # Actualizar/eliminar los existentes
        for pid, inv in existentes.items():
            if pid in nuevo_dic:
                inv.cantidad = nuevo_dic.pop(pid)
                inv.save(update_fields=["cantidad"])
            else:
                inv.delete()

        # Crear los nuevos restantes
        nuevos = [
            Inventario(productoid_id=int(pid),
                       sucursalid=nueva_sucursal,
                       cantidad=cant)
            for pid, cant in nuevo_dic.items()
        ]
        if nuevos:
            Inventario.objects.bulk_create(nuevos)

        messages.success(
            request,
            f'Inventario de la sucursal «{nueva_sucursal.nombre}» '
            f'actualizado correctamente.'
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
class ProductoInventarioAutocompleteView(PaginatedAutocompleteMixin):
    """Devuelve productos paginados, excluyendo los IDs recibidos en ?excluded."""
    model     = Producto
    text_field = "nombre"
    id_field   = "productoid"
    per_page   = 50

    def extra_filter(self, qs, request):
        excluded = request.GET.get("excluded", "")
        ids = [int(x) for x in excluded.split(",") if x.isdigit()]
        return qs.exclude(productoid__in=ids) if ids else qs


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
                "id"        : p["puntopagoid"],
                "nombre"    : p["nombre"],
                "descripcion": p["descripcion"] or "",
                "dinerocaja": float(p["dinerocaja"] or 0),
            } for p in puntos_qs
        ]

        form = self.form_class(initial={
            "sucursal"            : sucursal.pk,
            "sucursal_autocomplete": sucursal.nombre,
        })

        return render(request, self.template_name, {
            "form"       : form,
            "sucursal"   : sucursal,
            "puntos_json": json.dumps(puntos),
        })

    # ---------- POST ----------
    def post(self, request, sucursal_id):
        old_suc = get_object_or_404(Sucursal, pk=sucursal_id)
        form    = self.form_class(request.POST, initial={"sucursal": old_suc.pk})

        # 1▪ validación básica
        if not form.is_valid():
            return JsonResponse({
                "success": False,
                "errors" : json.dumps(form.errors.get_json_data(escape_html=True))
            })

        new_suc = form.cleaned_data["sucursal"]

        # 2▪ leer JSON
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

        # 3▪ diccionario de existentes (para delete / update)
        existentes_qs   = PuntosPago.objects.filter(sucursalid=old_suc)
        existentes_dict = {pp.puntopagoid: pp for pp in existentes_qs}

        keep_ids, to_create = set(), []

        # 4▪ loop items (create / update)
        for it in items:
            pid   = it.get("id")
            nombre= (it.get("nombre") or "").strip()
            descr = (it.get("descripcion") or "").strip()
            caja  = it.get("dinerocaja") or "0"

            if not nombre:
                return JsonResponse({
                    "success": False,
                    "errors" : json.dumps({
                        "nombre": [{"message": "El nombre es obligatorio."}]
                    })
                })

            try:
                caja_dec = Decimal(str(caja))
                if caja_dec < 0:
                    raise InvalidOperation
            except (InvalidOperation, ValueError):
                caja_dec = Decimal("0")

            # --- UPDATE ---
            if pid:
                pid = int(pid)
                keep_ids.add(pid)
                obj = existentes_dict.get(pid)

                #  • si no existe (se borró en BD) => tratar como nuevo
                if not obj:
                    to_create.append(PuntosPago(
                        sucursalid=new_suc, nombre=nombre,
                        descripcion=descr, dinerocaja=caja_dec
                    ))
                else:
                    # duplicados por nombre (distinto ID)
                    if PuntosPago.objects.filter(
                        sucursalid=new_suc,
                        nombre__iexact=nombre
                    ).exclude(puntopagoid=pid).exists():
                        return JsonResponse({
                            "success": False,
                            "errors" : json.dumps({
                                "nombre": [{"message": f"«{nombre}» ya existe en la sucursal."}]
                            })
                        })
                    obj.sucursalid = new_suc
                    obj.nombre     = nombre
                    obj.descripcion= descr
                    obj.dinerocaja = caja_dec
                    obj.save()
            # --- CREATE ---
            else:
                if PuntosPago.objects.filter(
                    sucursalid=new_suc, nombre__iexact=nombre
                ).exists():
                    return JsonResponse({
                        "success": False,
                        "errors" : json.dumps({
                            "nombre": [{"message": f"«{nombre}» ya existe en la sucursal."}]
                        })
                    })
                to_create.append(PuntosPago(
                    sucursalid=new_suc, nombre=nombre,
                    descripcion=descr, dinerocaja=caja_dec
                ))

        # 5▪ eliminar los que ya no vienen
        delete_ids = [pk for pk in existentes_dict if pk not in keep_ids]
        if delete_ids:
            PuntosPago.objects.filter(puntopagoid__in=delete_ids).delete()

        # 6▪ bulk create
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
        if self.request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse({
                "success": True,
                "message": f'Rol «{self.object.nombre}» actualizado.',
                "redirect_url": str(self.success_url),
            })
        messages.success(
            self.request,
            f'Rol «{self.object.nombre}» actualizado correctamente.',
        )
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


class SucursalHorarioCajaAutocomplete(PaginatedAutocompleteMixin):
    """
    Autocomplete de Sucursales que tienen al menos un PuntoPago
    sin ningún HorarioCaja asignado.
    """
    model      = Sucursal
    id_field   = "pk"
    text_field = "nombre"
    per_page   = 10

    def extra_filter(self, qs, request):
        # Subconsulta: ¿existe algún PuntoPago de esta sucursal
        #   para el que NO exista HorarioCaja?
        puntos_sin_horario = PuntosPago.objects.filter(
            sucursalid=OuterRef('pk')
        ).annotate(
            tiene_horario=Exists(
                HorarioCaja.objects.filter(puntopagoid=OuterRef('pk'))
            )
        ).filter(tiene_horario=False)

        return qs.annotate(
            tiene_pp_sin=Exists(puntos_sin_horario)
        ).filter(tiene_pp_sin=True)


class PuntosPagoHorarioCajaAutocomplete(PaginatedAutocompleteMixin):
    """
    Autocomplete de PuntosPago de la sucursal seleccionada
    que aún no tengan HorarioCaja.
    """
    model      = PuntosPago
    id_field   = "pk"
    text_field = "nombre"
    per_page   = 10

    def extra_filter(self, qs, request):
        suc_id = request.GET.get("sucursal_id")
        if not suc_id:
            # Sin sucursal, no devolvemos nada
            return qs.none()

        # Subconsulta: ¿existe HorarioCaja para este PuntoPago?
        tiene_horario = Exists(
            HorarioCaja.objects.filter(puntopagoid=OuterRef('pk'))
        )

        return (
            qs
            .filter(sucursalid_id=suc_id)
            .annotate(tiene_hor= tiene_horario)
            .filter(tiene_hor=False)
        )

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
    """
    Edita un Cliente vía AJAX.  La lógica es idéntica a RolUpdateAJAXView.
    """
    model         = Cliente
    pk_url_kwarg  = "cliente_id"
    form_class    = EditarClienteForm
    template_name = "editar_cliente.html"
    success_url   = reverse_lazy("visualizar_clientes")

    # ----- POST válido -----
    def form_valid(self, form):
        self.object = form.save()
        if self.request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse({
                "success"      : True,
                "message"      : "Cliente actualizado correctamente.",
                "redirect_url" : str(self.success_url),
            })
        messages.success(
            self.request,
            f"Cliente «{self.object.nombre} {self.object.apellido}» actualizado."
        )
        return super().form_valid(form)

    # ----- POST con errores -----
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
    POST → procesa la venta (ajax)
    """
    template_name = "generar_venta.html"
    success_url   = reverse_lazy("generar_venta")

    def get(self, request, *args, **kwargs):
        form = GenerarVentaForm(request.GET or None)
        context = self._base_context(form)
        return render(request, self.template_name, context)

    # POST AJAX --------------------------------------------------
    def post(self, request, *args, **kwargs):
        form = GenerarVentaForm(request.POST)
        if not form.is_valid():
            return JsonResponse({'success': False, 'error': 'Formulario inválido.'})

        data = form.cleaned_data
        productos  = data['productos']
        cantidades = data['cantidades']
        detalles   = []
        total      = 0

        try:
            productos_obj = Producto.objects.filter(productoid__in=productos)
            inventarios   = Inventario.objects.filter(productoid__in=productos_obj,
                                                      sucursalid=data['sucursal'].pk)

            for i, prod in enumerate(productos_obj):
                inv   = inventarios.get(productoid=prod)
                qty   = int(cantidades[i])
                if qty > inv.cantidad:
                    return JsonResponse({
                        'success': False,
                        'error': f"No hay suficiente stock de {prod.nombre}."
                    })
                subtotal = prod.precio * qty
                total   += subtotal
                detalles.append({
                    'productoid'     : prod.productoid,
                    'producto'       : prod.nombre,
                    'cantidad'       : qty,
                    'precio_unitario': prod.precio,
                    'subtotal'       : subtotal
                })
        except Exception:
            return JsonResponse({'success': False,
                                 'error': 'Error al procesar los productos.'})

        # Si es Nequi y no viene confirmado
        if data['medio_pago'] == 'nequi' and not request.POST.get('confirmar_nequi'):
            ok, err = self._esperar_confirmacion_nequi()
            if not ok:
                return JsonResponse({'success': False, 'error': err})

        return self._crear_venta(request.user, data, detalles, total)

    # ----------------------------------------------------------------------
    #  helpers internos
    # ----------------------------------------------------------------------
    def _base_context(self, form, detalles=None, total=0):
        return {
            'form'            : form,
            'detalles'        : detalles or [],
            'total'           : total,
        }

    def _esperar_confirmacion_nequi(self):
        """
        Lanza el script websocket y espera confirmación.
        """
        import os, subprocess, sys, pathlib, json, shlex, time
        script_path = pathlib.Path(__file__).with_name("nequi_websocket.py")
        try:
            result = subprocess.run(
                [sys.executable, str(script_path)],
                capture_output=True, text=True, timeout=60
            )
            if "se pago" in result.stdout:
                return True, ""
            return False, "El pago no fue confirmado."
        except subprocess.TimeoutExpired:
            return False, "Tiempo de espera agotado para confirmar pago."
        except Exception as e:
            return False, f"Error conexión WebSocket: {e}"

    @staticmethod
    def _crear_venta(user, data, detalles, total):
        """
        Crea la venta y actualiza inventario / caja.
        """
        try:
            with transaction.atomic():
                empleado = getattr(user, "empleado", None)
                if empleado is None:
                    return JsonResponse({
                        'success': False,
                        'error'  : 'El usuario no tiene un empleado asociado.'
                    })

                venta = Venta.objects.create(
                    fecha       = timezone.now().date(),
                    hora        = timezone.now().time(),
                    clienteid   = Cliente.objects.filter(pk=data['cliente_id']).first(),
                    empleadoid  = empleado,
                    sucursalid  = data['sucursal'],
                    puntopagoid = data['puntopago'],
                    total       = total,
                    mediopago   = data['medio_pago']
                )

                for d in detalles:
                    DetalleVenta.objects.create(
                        ventaid       = venta,
                        productoid_id = d['productoid'],
                        cantidad      = d['cantidad'],
                        preciounitario= d['precio_unitario']
                    )
                    inv = Inventario.objects.get(
                        productoid_id=d['productoid'],
                        sucursalid   =data['sucursal'].pk
                    )
                    inv.cantidad -= d['cantidad']
                    inv.save(update_fields=["cantidad"])

                if data['medio_pago'].lower() == "efectivo":
                    pp = data['puntopago']
                    pp.dinerocaja = (pp.dinerocaja or 0) + total
                    pp.save(update_fields=["dinerocaja"])

            return JsonResponse({'success': True})
        except Exception:
            return JsonResponse({'success': False, 'error': 'Error al crear la venta.'})

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
    """
    Productos con stock > 0 en la sucursal seleccionada.
    """
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
                inventario__cantidad__gt=0
            ).distinct()
        return qs.none()

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
        cantidad    = int(request.POST.get("cantidad", 0))

        try:
            producto   = Producto.objects.get(productoid=producto_id)
            inventario = Inventario.objects.get(productoid=producto, sucursalid=sucursal_id)
        except (Producto.DoesNotExist, Inventario.DoesNotExist):
            return JsonResponse({'exists': False})

        if inventario.cantidad < cantidad:
            return JsonResponse({
                'exists': True,
                'cantidad_disponible': inventario.cantidad
            })

        precio     = producto.precio
        subtotal   = precio * cantidad
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
        return JsonResponse({
            'exists': True,
            'producto': {
                'id':              producto.productoid,
                'nombre':          producto.nombre,
                'codigo_de_barras':producto.codigo_de_barras
            }
        })


@csrf_exempt
@login_required
def verificar_pago_nequi(request):
    if request.method == 'POST':
        total = float(request.POST.get('total'))
        flag = verificacionPago(total)  # Ajustar verificacionPago para que tome el total
        if flag:
            return JsonResponse({'success': True})
        else:
            return JsonResponse({'success': False, 'error': 'Pago Nequi no confirmado.'})
    return JsonResponse({'success': False, 'error': 'Método no permitido.'})




@login_required
def visualizar_ventas_view(request):
    # Se recuperan las ventas con relaciones para evitar consultas repetidas
    ventas = Venta.objects.select_related(
        'clienteid', 'empleadoid', 'sucursalid', 'puntopagoid'
    ).order_by('-fecha', '-hora')
    return render(request, 'visualizar_ventas.html', {'ventas': ventas})


# mainApp/views.py
from django.contrib import messages
from django.shortcuts import redirect

@login_required
@transaction.atomic
def ver_venta_view(request, venta_id):
    venta     = get_object_or_404(
                   Venta.objects.select_related(
                       "clienteid", "empleadoid", "sucursalid"),
                   pk=venta_id)
    detalles  = DetalleVenta.objects.filter(ventaid=venta).select_related("productoid")

    DevolucionFormSet = formset_factory(DevolucionForm, extra=0)
    filas = list(zip(detalles, DevolucionFormSet(initial=[
              {"detalle_id": d.pk, "devolver": 0} for d in detalles])))

    if request.method == "POST":
        formset = DevolucionFormSet(request.POST)
        if formset.is_valid():
            devoluciones = []
            for form in formset.cleaned_data:
                cant = form["devolver"]
                if cant:
                    devoluciones.append({
                        "detalle": detalles.get(pk=form["detalle_id"]),
                        "cantidad": cant
                    })

            if devoluciones:
                CambioDevolucion.registrar_devolucion(venta, devoluciones)
                # ------------- MENSAJE ÉXITO -------------
                messages.success(
                    request,
                    "✅ Devolución registrada correctamente."
                )
        # Redirige **siempre** a la lista de ventas
        return redirect("visualizar_ventas")

    else:
        formset = DevolucionFormSet(initial=[
            {"detalle_id": d.pk, "devolver": 0} for d in detalles
        ])

    return render(request, "ver_venta.html", {
        "venta": venta,
        "filas": zip(detalles, formset.forms),   # (det, f) para la plantilla
        "formset": formset,
    })

@login_required
def visualizar_cambios_view(request):
    cambios = (
        CambioDevolucion.objects
        .select_related('venta', 'productoid', 'detalle')
        .order_by('-fecha', '-cambioid')
    )
    return render(request, 'visualizar_cambios.html', {
        'cambios': cambios,
    })






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

@login_required
def ver_pedido_view(request, pedido_id):
    # Obtener el pedido principal (o un 404 si no existe)
    pedido = get_object_or_404(PedidoProveedor, pk=pedido_id)
    
    # Obtener los detalles asociados
    detalles = DetallePedidoProveedor.objects.filter(pedidoid=pedido)

    # Calcular el subtotal de cada detalle
    for d in detalles:
        # Multiplicar preciounitario * cantidad
        # Ojo: si preciounitario es Decimal, se mantiene la precisión
        d.subtotal = d.preciounitario * d.cantidad
    
    # Renderizar el template con pedido y detalles
    return render(request, "ver_pedido.html", {
        "pedido": pedido,
        "detalles": detalles,
    })
    
@method_decorator(login_required, name="dispatch")
class EditarPedidoView(View):
    """GET → muestra formulario precargado | POST → actualiza / valida."""

    template_name = "editar_pedido.html"

    # ---------- GET ----------
    def get(self, request, pedido_id):
        pedido = get_object_or_404(PedidoProveedor, pk=pedido_id)

        # ----- Detalles + subtotal precalculado en la BD -----
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

        # ----- JSON usado por el JS (DataTable) -----
        detalles_json = json.dumps([
            {
                "detallepedidoid": det.detallepedidoid,
                "productoid": det.productoid_id,
                "producto": det.productoid.nombre,
                "cantidad": det.cantidad,
                "precio_unitario": float(det.preciounitario),
                "subtotal": float(det.subtotal),
            }
            for det in detalles_qs
        ])

        form = EditarPedidoForm(initial={
            "proveedor": pedido.proveedorid_id,
            "proveedor_autocomplete": pedido.proveedorid.nombre,
            "sucursal": pedido.sucursalid_id,
            "sucursal_autocomplete": pedido.sucursalid.nombre,
            "fechaestimadaentrega": pedido.fechaestimadaentrega,
            "comentario": pedido.comentario,
            "detalles": detalles_json,
        })

        return render(
            request,
            self.template_name,
            {
                "form": form,
                "pedido": pedido,
                "detalles_json": detalles_json,
                "detalles_qs": detalles_qs,   # para precargar la tabla en el HTML
            },
        )

    # ---------- POST ----------
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

        proveedor   = form.cleaned_data["proveedor"]
        sucursal    = form.cleaned_data["sucursal"]
        estimada    = form.cleaned_data["fechaestimadaentrega"]
        comentario  = form.cleaned_data.get("comentario")
        raw_detalle = form.cleaned_data["detalles"]

        try:
            detalles = json.loads(raw_detalle or "[]")
        except json.JSONDecodeError:
            return JsonResponse({
                "success": False,
                "errors": {"detalles": [{"message": "JSON inválido."}]}
            })

        if not detalles:
            return JsonResponse({
                "success": False,
                "errors": {"detalles": [{"message": "Debe agregar al menos un producto."}]}
            })

        total = sum(
            Decimal(str(d["precio_unitario"])) * Decimal(str(d["cantidad"]))
            for d in detalles
        )

        # --- update & re-crear detalles ---
        pedido.proveedorid          = proveedor
        pedido.sucursalid           = sucursal
        pedido.fechaestimadaentrega = estimada
        pedido.comentario           = comentario
        pedido.costototal           = total
        pedido.save()

        DetallePedidoProveedor.objects.filter(pedidoid=pedido).delete()
        DetallePedidoProveedor.objects.bulk_create([
            DetallePedidoProveedor(
                pedidoid=pedido,
                productoid_id=d["productoid"],
                cantidad=d["cantidad"],
                preciounitario=d["precio_unitario"],
            )
            for d in detalles
        ])

        messages.success(request, "Pedido actualizado correctamente.")
        return JsonResponse({
            "success": True,
            "redirect_url": reverse("visualizar_pedidos") + "?updated=1",
        })