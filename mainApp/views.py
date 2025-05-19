from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from .models import Usuario, Sucursal, Categoria, Producto, Inventario, Proveedor, PreciosProveedor, PuntosPago, Rol, Empleado, HorariosNegocio, HorarioCaja, Cliente, Venta, DetalleVenta, PedidoProveedor, DetallePedidoProveedor
from django.db.models import Count, Sum, Exists, OuterRef, Q
from django.http import JsonResponse
from django.contrib.auth import authenticate, login as auth_login
import json
from datetime import datetime
from django.utils import timezone
from django.contrib.auth import authenticate, login
import logging
from django.db import transaction
import subprocess
import os
from .nequi_websocket import verificacionPago
from django.views.decorators.csrf import csrf_exempt
from .forms import (
    CategoriaForm,
    ClienteForm,
    EmpleadoForm,
    HorarioCajaForm,
    HorariosNegocioForm,
    SucursalForm,
    ProductoForm,
    ProveedorForm,
    RolForm,
    InventarioForm, 
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
    PedidoProveedorForm
)
from dal import autocomplete
from decimal import Decimal
from django.urls import reverse

logger = logging.getLogger(__name__)


def login(request):
    if request.method == 'POST':
        nombreusuario = request.POST.get('nombreusuario')
        contraseña = request.POST.get('contraseña')

        usuario = authenticate(request, username=nombreusuario, password=contraseña)
        
        if usuario is not None:
            auth_login(request, usuario)
            return redirect('home')  # Asegúrate de que 'home' está definido en tus URLs
        else:
            messages.error(request, 'Nombre de usuario o contraseña incorrectos')

    return render(request, 'login.html')


@login_required
def homePage_view(request):
    return render(request, 'homePage.html')


@login_required
def agregar_sucursal_view(request):
    if request.method == 'POST':
        form = SucursalForm(request.POST)
        if form.is_valid():
            form.save()
            return JsonResponse({'success': True, 'message': 'Sucursal agregada exitosamente.'})
        else:
            errors = form.errors.get_json_data()  # Obtener errores como dict
            return JsonResponse({'success': False, 'errors': errors})
    else:
        form = SucursalForm()
    return render(request, 'agregar_sucursal.html', {'form': form})


@login_required
def visualizar_sucursales_view(request):
    sucursales = Sucursal.objects.all()
    return render(request, 'visualizar_sucursales.html', {'sucursales': sucursales})

@login_required
def eliminar_sucursal(request, sucursal_id):
    sucursal = get_object_or_404(Sucursal, sucursalid=sucursal_id)
    if request.method == 'POST':
        sucursal.delete()
        messages.success(request, 'La sucursal ha sido eliminada exitosamente.')
        return redirect('visualizar_sucursales')
    return render(request, 'visualizar_sucursales.html', {'sucursales': Sucursal.objects.all()})


@login_required
def editar_sucursal_view(request, sucursal_id):
    sucursal = get_object_or_404(Sucursal, sucursalid=sucursal_id)

    if request.method == 'POST':
        form = SucursalEditarForm(request.POST, instance=sucursal)

        if form.is_valid():
            form.save()
            # Mensaje de éxito (para mostrarse en visualizar_sucursales)
            messages.success(request, f'Sucursal "{sucursal.nombre}" actualizada exitosamente.')

            # Retornamos JSON con success y la URL de redirección
            return JsonResponse({
                'success': True,
                'redirect_url': reverse('visualizar_sucursales')  
            })
        else:
            # Devolver errores
            errors_data = form.errors.get_json_data()
            return JsonResponse({
                'success': False,
                'errors': errors_data
            })

    else:
        # GET: renderizamos la plantilla con el form
        form = SucursalEditarForm(instance=sucursal)

    return render(request, 'editar_sucursal.html', {
        'sucursal': sucursal,
        'form': form,
    })

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


@login_required
def agregar_categoria_view(request):
    """
    Vista para agregar una categoría usando AJAX.
    Retorna un JSON con success=True o success=False y la lista de errores en caso de no ser válido.
    """
    if request.method == 'POST':
        form = CategoriaForm(request.POST)
        if form.is_valid():
            form.save()
            return JsonResponse({'success': True})
        else:
            errors = form.errors.as_json()
            return JsonResponse({'success': False, 'errors': errors})
    else:
        form = CategoriaForm()
    
    return render(request, 'agregar_categoria.html', {'form': form})


@login_required
def visualizar_categorias_view(request):
    categorias = Categoria.objects.all().order_by('nombre')
    return render(request, 'visualizar_categorias.html', {
        'categorias': categorias
    })

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


@login_required
def editar_categoria_view(request, categoria_id):
    categoria = get_object_or_404(Categoria, pk=categoria_id)
    if request.method == 'POST':
        form = EditarCategoriaForm(request.POST, instance=categoria)
        if form.is_valid():
            form.save()
            # Mensaje de éxito
            messages.success(request, f'Categoría "{categoria.nombre}" editada exitosamente.')
            return JsonResponse({
                'success': True,
                'redirect_url': reverse('visualizar_categorias')
            })
        else:
            errors = form.errors.as_json()
            return JsonResponse({'success': False, 'errors': errors})
    else:
        form = EditarCategoriaForm(instance=categoria)

    return render(request, 'editar_categoria.html', {'form': form})


@login_required
def agregar_producto_view(request):
    if request.method == 'POST':
        form = ProductoForm(request.POST)
        if form.is_valid():
            form.save()
            return JsonResponse({'success': True, 'message': 'Producto agregado exitosamente.'})
        else:
            errors = form.errors.as_json()
            return JsonResponse({'success': False, 'errors': errors})
    else:
        form = ProductoForm()
    categorias = Categoria.objects.all()
    return render(request, 'agregar_producto.html', {'form': form, 'categorias': categorias})

@login_required
def categoria_autocomplete(request):
    """
    Autocomplete para Categoría.
    """
    term = request.GET.get('term', '').strip()
    page = request.GET.get('page', '1').strip()
    per_page = 10  # Número de resultados por página

    try:
        page = int(page)
        if page < 1:
            page = 1
    except ValueError:
        page = 1

    start = (page - 1) * per_page
    end = start + per_page

    categorias = Categoria.objects.filter(
        Q(nombre__icontains=term)
    ).order_by('nombre')

    total_results = categorias.count()
    categorias = categorias[start:end]

    results = []
    for categoria in categorias:
        results.append({
            'id': categoria.categoriaid,
            'text': categoria.nombre,
        })

    return JsonResponse({
        'results': results,
        'has_more': end < total_results,
    })


@login_required
def visualizar_productos_view(request):
    productos = Producto.objects.all()
    return render(request, 'visualizar_productos.html', {'productos': productos})

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


@login_required
def editar_producto_view(request, producto_id):
    """
    Permite editar un producto existente.
    - Utiliza ProductoForm para manejar la edición.
    - Responde con JSON para solicitudes AJAX.
    - Redirige a visualizar_productos tras un guardado exitoso.
    """
    producto = get_object_or_404(Producto, productoid=producto_id)
    categorias = Categoria.objects.all()
    
    if request.method == 'POST':
        form = ProductoForm(request.POST, instance=producto)
        if form.is_valid():
            form.save()
            # Guardar mensaje de éxito en la sesión
            messages.success(
                request,
                f'Producto actualizado exitosamente: '
                f'Nombre="{producto.nombre}", Descripción="{producto.descripcion}", Precio="{producto.precio}", '
                f'Categoría="{producto.categoria.nombre if producto.categoria else "Sin categoría"}"'
            )
            # Obtener la URL de redirección
            redirect_url = reverse('visualizar_productos')
            return JsonResponse({'success': True, 'redirect_url': redirect_url})
        else:
            # Retornar errores del formulario en formato JSON
            errors = form.errors.as_json()
            return JsonResponse({'success': False, 'errors': errors})
    else:
        # Solicitud GET: inicializar el formulario con datos del producto
        form = ProductoForm(instance=producto)
    
    return render(
        request,
        'editar_producto.html',
        {'form': form, 'categorias': categorias, 'producto': producto},
    )


@login_required
def agregar_inventario_view(request):
    """
    Vista para agregar inventario a una Sucursal.
    Maneja tanto GET como POST.
    - En GET, muestra el formulario con autocompletados.
    - En POST, valida el formulario y procesa los inventarios temporales.
      Responde con JSON para manejar las respuestas en el frontend.
    """
    if request.method == 'POST':
        form = InventarioForm(request.POST)
        if form.is_valid():
            sucursal = form.cleaned_data['sucursal']
            inventarios_temp = request.POST.get('inventarios_temp')
            if inventarios_temp:
                try:
                    inventarios = json.loads(inventarios_temp)
                except json.JSONDecodeError:
                    inventarios = []

                if not inventarios:
                    errors = {
                        'inventarios_temp': [{'message': 'Debe agregar al menos un producto antes de guardar.'}]
                    }
                    return JsonResponse({'success': False, 'errors': json.dumps(errors)})

                # Preparar lista para bulk_create
                inventarios_to_create = []
                for inventario in inventarios:
                    producto_id = inventario.get('productId')
                    cantidad = inventario.get('cantidad')
                    if not producto_id or not cantidad:
                        continue  # Puedes optar por manejar errores específicos aquí

                    producto = get_object_or_404(Producto, pk=producto_id)

                    # Evitar duplicados
                    if Inventario.objects.filter(productoid=producto, sucursalid=sucursal).exists():
                        continue  # Opcional: manejar duplicados según necesidades

                    inventarios_to_create.append(
                        Inventario(
                            productoid=producto,
                            sucursalid=sucursal,
                            cantidad=int(cantidad)
                        )
                    )
                # Crear todos los inventarios en una sola consulta
                Inventario.objects.bulk_create(inventarios_to_create)
                return JsonResponse({'success': True})
            else:
                errors = {
                    'inventarios_temp': [{'message': 'Debe agregar al menos un producto antes de guardar.'}]
                }
                return JsonResponse({'success': False, 'errors': json.dumps(errors)})
        else:
            # Convertir errores del formulario a JSON
            errors = form.errors.get_json_data()
            # Procesar errores para el formato esperado por el frontend
            processed_errors = {}
            for field, field_errors in errors.items():
                processed_errors[field] = [{'message': error['message']} for error in field_errors]
            return JsonResponse({'success': False, 'errors': json.dumps(processed_errors)})
    else:
        form = InventarioForm()

    # Filtrar sucursales sin inventario y listar productos
    sucursales_sin_inventario = Sucursal.objects.annotate(inventarios_count=Count('inventario')) \
                                                .filter(inventarios_count=0)
    productos = Producto.objects.all()

    if not sucursales_sin_inventario.exists():
        messages.error(
            request,
            'Todas las sucursales ya tienen inventario. '
            'Debe ir a visualizar inventario para modificarlas o ir a agregar sucursales para añadir nuevas.'
        )

    if not productos.exists():
        messages.error(
            request,
            'No hay productos en el sistema. Debe ir a agregar productos para añadir productos al sistema.'
        )

    return render(request, 'agregar_inventario.html', {
        'form': form,
        'sucursales': sucursales_sin_inventario,
        'productos': productos
    })

@login_required
def sucursal_inventario_autocomplete(request):
    """
    Lista únicamente las sucursales que no tengan inventario
    Incluye scroll infinito con 'term' y 'page'.
    """
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    per_page = 10  # Ajusta el número de resultados por página

    try:
        page = int(page_str)
        if page < 1:
            page = 1
    except ValueError:
        page = 1

    start = (page - 1) * per_page
    end = start + per_page

    # Filtrar sucursales sin inventario y asegurarse de que 'nombre' está indexado
    qs = (Sucursal.objects.annotate(inventarios_count=Count('inventario'))
                        .filter(inventarios_count=0)
                        .order_by('nombre'))

    if term:
        qs = qs.filter(nombre__icontains=term)

    total_results = qs.count()
    qs = qs[start:end]

    results = []
    for sucursal in qs:
        results.append({
            'id': sucursal.sucursalid,
            'text': sucursal.nombre,
        })

    return JsonResponse({
        'results': results,
        'has_more': end < total_results,
    })

@login_required
def producto_inventario_autocomplete(request):
    """
    Lista productos con autocompletado, excluyendo los IDs proporcionados.
    Incluye scroll infinito con 'term', 'page' y 'excluded'.
    """
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    excluded_str = request.GET.get('excluded', '').strip()
    per_page = 10  # Ajusta el número de resultados por página

    try:
        page = int(page_str)
        if page < 1:
            page = 1
    except ValueError:
        page = 1

    start = (page - 1) * per_page
    end = start + per_page

    qs = Producto.objects.all().order_by('nombre')

    # Excluir IDs listados
    excluded_ids = []
    if excluded_str:
        try:
            excluded_ids = [int(x) for x in excluded_str.split(',') if x.isdigit()]
        except:
            pass

    if excluded_ids:
        qs = qs.exclude(productoid__in=excluded_ids)

    if term:
        qs = qs.filter(nombre__icontains=term)

    total_results = qs.count()
    qs = qs[start:end]

    results = []
    for prod in qs:
        results.append({
            'id': prod.productoid,
            'text': prod.nombre,
        })

    return JsonResponse({
        'results': results,
        'has_more': end < total_results,
    })

@login_required
def visualizar_inventarios_view(request):
    sucursales_con_inventario = Sucursal.objects.filter(inventario__isnull=False).distinct()
    sucursal_id = request.POST.get('sucursal')
    inventario_global = False
    inventarios = []
    inventario_global_data = []

    if sucursal_id and sucursal_id != "global":
        sucursal_seleccionada = get_object_or_404(Sucursal, pk=int(sucursal_id))
        inventarios = Inventario.objects.filter(sucursalid=sucursal_seleccionada)
    elif sucursal_id == "global":
        inventario_global = True
        inventario_global_data = Inventario.objects.values('productoid__nombre').annotate(
            total_cantidad=Sum('cantidad')
        )

    context = {
        'sucursales': sucursales_con_inventario,
        'inventarios': inventarios,
        'inventario_global': inventario_global,
        'inventario_global_data': inventario_global_data,
        'sucursal_seleccionada': (
            sucursal_seleccionada if (sucursal_id and sucursal_id != "global") else None
        ),
    }
    return render(request, 'visualizar_inventarios.html', context)

@login_required
def sucursal_con_inventario_autocomplete(request):
    """
    Devuelve en JSON las sucursales que tienen inventario para el autocomplete
    en la vista de Visualizar Inventarios. Se inserta "Inventario Global" como primera opción.
    Soporta paginación mediante 'term' y 'page'.
    """
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    per_page = 10

    try:
        page = int(page_str)
        if page < 1:
            page = 1
    except ValueError:
        page = 1

    start = (page - 1) * per_page
    end = start + per_page

    qs = Sucursal.objects.annotate(inventarios_count=Count('inventario')) \
                         .filter(inventarios_count__gt=0) \
                         .order_by('nombre')
    if term:
        qs = qs.filter(nombre__icontains=term)
    
    total_results = qs.count()
    qs = qs[start:end]

    results = [{'id': sucursal.sucursalid, 'text': sucursal.nombre} for sucursal in qs]
    # Si es la primera página, insertar la opción global al inicio
    if page == 1:
        results.insert(0, {"id": "global", "text": "Inventario Global"})

    return JsonResponse({
        'results': results,
        'has_more': end < total_results,
    })


@login_required
def editar_inventario_view(request, sucursal_id):
    sucursal_original = get_object_or_404(Sucursal, pk=sucursal_id)
    inventarios_existentes = (Inventario.objects
                              .filter(sucursalid=sucursal_original)
                              .select_related('productoid')
                              .order_by('productoid__nombre'))

    if request.method == 'POST':
        form = EditarInventarioForm(request.POST)
        if form.is_valid():
            nueva_sucursal = form.cleaned_data['sucursal']
            inventarios_str = form.cleaned_data['inventarios_temp']

            # Parsear JSON
            try:
                inventarios_data = json.loads(inventarios_str) if inventarios_str else []
            except ValueError:
                inventarios_data = []

            # Si la nueva sucursal es distinta, borramos inventario viejo
            if nueva_sucursal != sucursal_original:
                Inventario.objects.filter(sucursalid=sucursal_original).delete()

            # Diccionario { productId -> cantidad }
            nuevo_dic = {}
            for item in inventarios_data:
                pid = item.get('productId')
                cant = item.get('cantidad')
                if pid and cant is not None:
                    nuevo_dic[str(pid)] = int(cant)

            # Inventarios actuales en la nueva sucursal
            inv_map = {
                str(inv.productoid_id): inv
                for inv in Inventario.objects.filter(sucursalid=nueva_sucursal)
            }

            # Actualizar / Eliminar
            for prod_str, inv_obj in inv_map.items():
                if prod_str in nuevo_dic:
                    inv_obj.cantidad = nuevo_dic[prod_str]
                    inv_obj.save()
                    del nuevo_dic[prod_str]
                else:
                    inv_obj.delete()

            # Crear los nuevos
            for prod_str, cant in nuevo_dic.items():
                prod_id = int(prod_str)
                producto = get_object_or_404(Producto, pk=prod_id)
                Inventario.objects.create(
                    productoid=producto,
                    sucursalid=nueva_sucursal,
                    cantidad=cant
                )

            # Guardamos mensaje en la sesión (para que aparezca en la siguiente vista)
            messages.success(
                request,
                f'Inventario de la sucursal "{nueva_sucursal.nombre}" se ha actualizado correctamente.'
            )
            # Retornamos la URL de redirección
            redirect_url = reverse('visualizar_inventarios')
            return JsonResponse({'success': True, 'redirect_url': redirect_url})
        else:
            # Errores
            errors = form.errors.get_json_data()
            processed_errors = {}
            for field, ferrors in errors.items():
                processed_errors[field] = [{'message': e['message']} for e in ferrors]
            return JsonResponse({'success': False, 'errors': json.dumps(processed_errors)})
    else:
        # GET => pre-cargamos la sucursal
        form = EditarInventarioForm(initial={
            'sucursal': sucursal_original.sucursalid,
            'sucursal_autocomplete': sucursal_original.nombre,
        })

    return render(
        request,
        'editar_inventario.html',
        {
            'form': form,
            'sucursal': sucursal_original,
            'inventarios': inventarios_existentes,
        }
    )

@login_required
def sucursal_inventario_autocomplete_editar(request):
    """
    Autocomplete que:
      - Incluye SIEMPRE la sucursal actual (enviada como 'current_sucursal_id'),
        aunque ya tenga inventarios.
      - Incluye también las sucursales que NO tengan inventario (inventario__isnull=True).
      - Filtra por 'term'.
      - Evita duplicados con .distinct().
    """
    term = request.GET.get('term', '').strip()
    current_sucursal_str = request.GET.get('current_sucursal_id', '').strip()
    page_str = request.GET.get('page', '1').strip()
    per_page_str = request.GET.get('per_page', '50').strip()

    # Manejo de page
    try:
        page = int(page_str)
    except ValueError:
        page = 1
    if page < 1:
        page = 1

    # Manejo de per_page
    try:
        per_page = int(per_page_str)
    except ValueError:
        per_page = 50
    if per_page < 1:
        per_page = 50

    # Convertir sucursal actual
    try:
        current_suc_id = int(current_sucursal_str)
    except ValueError:
        current_suc_id = None

    # Query base
    if current_suc_id:
        # OR para la sucursal actual + las que no tienen inventario
        qs = Sucursal.objects.filter(
            Q(pk=current_suc_id) | Q(inventario__isnull=True)
        ).distinct()
    else:
        qs = Sucursal.objects.filter(inventario__isnull=True).distinct()

    if term:
        qs = qs.filter(nombre__icontains=term)

    qs = qs.order_by('nombre')

    # Paginación
    start = (page - 1) * per_page
    end = start + per_page
    total_results = qs.count()
    qs = qs[start:end]

    # Construir results
    results = []
    for s in qs:
        results.append({
            'id': s.pk,
            'text': s.nombre
        })

    has_more = end < total_results
    return JsonResponse({
        'results': results,
        'has_more': has_more
    })

@login_required
def producto_inventario_autocomplete_editar(request):
    """
    Autocomplete para productos en edición de inventario.
    Recibe 'excluded' (IDs de productos ya listados).
    """
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    excluded_str = request.GET.get('excluded', '').strip()
    per_page = 50  # Ajusta el número de resultados por página si quieres

    # page
    try:
        page = int(page_str)
    except ValueError:
        page = 1
    if page < 1:
        page = 1

    start = (page - 1) * per_page
    end = start + per_page

    qs = Producto.objects.all().order_by('nombre')

    # Excluir productos cuyos IDs están en 'excluded'
    excluded_ids = []
    if excluded_str:
        try:
            excluded_ids = [int(x) for x in excluded_str.split(',') if x.isdigit()]
        except:
            pass
    if excluded_ids:
        qs = qs.exclude(productoid__in=excluded_ids)

    # Filtro por 'term'
    if term:
        qs = qs.filter(nombre__icontains=term)

    total_results = qs.count()
    qs = qs[start:end]

    results = []
    for prod in qs:
        results.append({
            'id': prod.productoid,
            'text': prod.nombre,
        })

    has_more = end < total_results
    return JsonResponse({
        'results': results,
        'has_more': has_more,
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


@login_required
def agregar_proveedor_view(request):
    if request.method == 'POST':
        form = ProveedorForm(request.POST)
        if form.is_valid():
            form.save()
            return JsonResponse({'success': True, 'message': 'Proveedor agregado exitosamente.'})
        else:
            errors = form.errors.as_json()
            return JsonResponse({'success': False, 'errors': errors})
    else:
        form = ProveedorForm()
    return render(request, 'agregar_proveedor.html', {'form': form})


@login_required
def visualizar_proveedores_view(request):
    proveedores = Proveedor.objects.all()
    return render(request, 'visualizar_proveedores.html', {'proveedores': proveedores})

@login_required
def eliminar_proveedor(request, proveedor_id):
    proveedor = get_object_or_404(Proveedor, proveedorid=proveedor_id)
    if request.method == 'POST':
        proveedor.delete()
        messages.success(request, 'El proveedor ha sido eliminado exitosamente.')
        return redirect('visualizar_proveedores')
    # Si la solicitud no es POST se vuelve a renderizar la página
    return render(request, 'visualizar_proveedores.html', {'proveedores': Proveedor.objects.all()})


@login_required
def editar_proveedor_view(request, proveedor_id):
    proveedor = get_object_or_404(Proveedor, pk=proveedor_id)

    if request.method == 'POST':
        form = EditarProveedorForm(request.POST, instance=proveedor)
        if form.is_valid():
            form.save()
            # Aquí guardamos el mensaje de éxito en el "message framework"
            messages.success(request, 'Proveedor actualizado exitosamente.')

            # Devolvemos JSON con la URL a donde redirigir
            return JsonResponse({
                'success': True,
                'redirect_url': reverse('visualizar_proveedores'),
            })
        else:
            errors = form.errors.get_json_data()
            return JsonResponse({'success': False, 'errors': json.dumps(errors)})
    else:
        form = EditarProveedorForm(instance=proveedor)

    return render(request, 'editar_proveedor.html', {
        'form': form,
        'proveedor': proveedor,
    })



@login_required
def agregar_productos_precios_proveedor_view(request):
    """
    Vista para agregar productos con sus precios a un Proveedor.
    Maneja tanto GET como POST.
    - En GET, muestra el formulario con autocompletados.
    - En POST, valida el formulario y procesa los productos y precios temporales.
      Responde con JSON para manejar las respuestas en el frontend.
    """
    if request.method == 'POST':
        form = PreciosProveedorForm(request.POST)
        if form.is_valid():
            precios_temp = request.POST.get('precios_temp')
            proveedor = form.cleaned_data['proveedor']
            if precios_temp:
                try:
                    precios = json.loads(precios_temp)
                except json.JSONDecodeError:
                    precios = []

                if not precios:
                    errors = {
                        'precios_temp': [{'message': 'Debe agregar al menos un producto antes de guardar.'}]
                    }
                    return JsonResponse({'success': False, 'errors': json.dumps(errors)})

                # Preparar lista para bulk_create
                precios_to_create = []
                for precio in precios:
                    producto_id = precio.get('productId')
                    precio_val = precio.get('price')
                    if not producto_id or not precio_val:
                        continue  # Puedes optar por manejar errores específicos aquí

                    producto = get_object_or_404(Producto, pk=producto_id)

                    # Evitar duplicados
                    if PreciosProveedor.objects.filter(productoid=producto, proveedorid=proveedor).exists():
                        continue  # Opcional: manejar duplicados según necesidades

                    precios_to_create.append(
                        PreciosProveedor(
                            productoid=producto,
                            proveedorid=proveedor,
                            precio=Decimal(precio_val)
                        )
                    )
                # Crear todos los precios en una sola consulta
                PreciosProveedor.objects.bulk_create(precios_to_create)
                return JsonResponse({'success': True})
            else:
                errors = {
                    'precios_temp': [{'message': 'Debe agregar al menos un producto antes de guardar.'}]
                }
                return JsonResponse({'success': False, 'errors': json.dumps(errors)})
        else:
            # Convertir errores del formulario a JSON
            errors = form.errors.get_json_data()
            # Procesar errores para el formato esperado por el frontend
            processed_errors = {}
            for field, field_errors in errors.items():
                processed_errors[field] = [{'message': error['message']} for error in field_errors]
            return JsonResponse({'success': False, 'errors': json.dumps(processed_errors)})
    else:
        form = PreciosProveedorForm()

    return render(request, 'agregar_productos_precios_proveedor.html', {'form': form})

@login_required
def proveedor_precios_autocomplete(request):
    """
    Autocomplete de Proveedores, excluyendo aquellos que ya
    tienen registros en PreciosProveedor.
    Implementa paginación y manejo de términos vacíos.
    """
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    per_page = 10  # Cantidad de resultados por página

    try:
        page = int(page_str)
        if page < 1:
            page = 1
    except ValueError:
        page = 1

    start = (page - 1) * per_page
    end = start + per_page

    # Excluir Proveedores que ya tengan algo en PreciosProveedor
    # => Los que tengan precios_count=0
    qs = (
        Proveedor.objects.annotate(precios_count=Count('preciosproveedor'))
                        .filter(precios_count=0)
                        .order_by('nombre')
    )

    if term:
        qs = qs.filter(nombre__icontains=term)

    total_results = qs.count()
    qs = qs[start:end]

    results = []
    for prov in qs:
        results.append({
            'id': prov.proveedorid,
            'text': prov.nombre,
        })

    return JsonResponse({
        'results': results,
        'has_more': end < total_results,
    })

@login_required
def producto_precios_autocomplete(request):
    """
    Autocomplete para Producto, excluyendo IDs pasados via 'excluded'.
    Implementa paginación y manejo de términos vacíos.
    """
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    excluded_str = request.GET.get('excluded', '').strip()
    per_page = 10

    try:
        page = int(page_str)
        if page < 1:
            page = 1
    except ValueError:
        page = 1

    start = (page - 1) * per_page
    end = start + per_page

    qs = Producto.objects.all().order_by('nombre')

    # Excluir IDs
    excluded_ids = []
    if excluded_str:
        try:
            excluded_ids = [int(x) for x in excluded_str.split(',') if x.isdigit()]
        except:
            pass

    if excluded_ids:
        qs = qs.exclude(productoid__in=excluded_ids)

    if term:
        qs = qs.filter(nombre__icontains=term)

    total_results = qs.count()
    qs = qs[start:end]

    results = []
    for prod in qs:
        results.append({
            'id': prod.productoid,
            'text': prod.nombre,
        })

    return JsonResponse({
        'results': results,
        'has_more': end < total_results,
    })


@login_required
def visualizar_productos_precios_proveedores_view(request):
    proveedores = Proveedor.objects.annotate(product_count=Count('preciosproveedor')).filter(product_count__gt=0)
    productos_precios = None
    proveedor_seleccionado = None

    if request.method == 'POST':
        proveedor_id = request.POST.get('proveedor')
        if proveedor_id:
            proveedor_seleccionado = get_object_or_404(Proveedor, pk=proveedor_id)
            productos_precios = PreciosProveedor.objects.filter(proveedorid=proveedor_seleccionado)

    return render(request, 'visualizar_productos_precios_proveedores.html', {
        'proveedores': proveedores,
        'productos_precios': productos_precios,
        'proveedor_seleccionado': proveedor_seleccionado,
    })

@login_required
def proveedor_con_productos_autocomplete(request):
    """
    Autocomplete de Proveedores que ya están vinculados con productos,
    es decir, aquellos que tienen al menos un registro en PreciosProveedor.
    Soporta paginación y manejo de términos vacíos.
    """
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    per_page = 10

    try:
        page = int(page_str)
        if page < 1:
            page = 1
    except ValueError:
        page = 1

    start = (page - 1) * per_page
    end = start + per_page

    qs = Proveedor.objects.annotate(product_count=Count('preciosproveedor'))\
                           .filter(product_count__gt=0)\
                           .order_by('nombre')
    if term:
        qs = qs.filter(nombre__icontains=term)
    
    total_results = qs.count()
    qs = qs[start:end]

    results = [{'id': prov.proveedorid, 'text': prov.nombre} for prov in qs]
    return JsonResponse({
        'results': results,
        'has_more': end < total_results,
    })


@login_required
def eliminar_precio_proveedor_view(request, id):
    if request.method == 'POST':
        precio_proveedor = get_object_or_404(PreciosProveedor, pk=id)
        nombre_producto = precio_proveedor.productoid.nombre
        precio_proveedor.delete()
        return JsonResponse({'success': True, 'message': f'Producto "{nombre_producto}" eliminado correctamente.'})
    return JsonResponse({'success': False, 'message': 'Error al eliminar el producto.'})


@login_required
def editar_productos_precios_proveedor_view(request, proveedor_id):
    proveedor = get_object_or_404(Proveedor, pk=proveedor_id)
    
    if request.method == 'POST':
        form = EditarPreciosProveedorForm(request.POST)
        if form.is_valid():
            # 1. Cargamos el JSON de precios_temp
            precios_temp_str = form.cleaned_data.get('precios_temp', '')
            try:
                precios_data = json.loads(precios_temp_str) if precios_temp_str else []
            except ValueError:
                precios_data = []

            # 2. Convertimos a dict => { str(productId): 'price' }
            nuevos_dict = {}
            for item in precios_data:
                pid = item.get('productId')
                price = item.get('price')
                if pid and price is not None:
                    nuevos_dict[str(pid)] = price

            # 3. Obtener todos los PreciosProveedor actuales de este proveedor en una sola consulta
            existentes_qs = PreciosProveedor.objects.filter(proveedorid=proveedor)
            existentes_map = { str(pp.productoid_id): pp for pp in existentes_qs }

            # Preparar listas para bulk operations
            a_crear = []     # Lista de PreciosProveedor (nuevos)
            a_actualizar = []# Lista de PreciosProveedor (existen, hay que actualizar)
            
            # 4. Revisar cada productId en nuevos_dict
            nuevos_product_ids = set(nuevos_dict.keys())

            for product_id_str in nuevos_product_ids:
                if product_id_str in existentes_map:
                    # Ya existe => actualizar
                    obj = existentes_map[product_id_str]
                    nuevo_precio = Decimal(nuevos_dict[product_id_str])
                    if obj.precio != nuevo_precio:
                        obj.precio = nuevo_precio
                        a_actualizar.append(obj)
                    # Eliminamos de existentes_map para no borrarlo después
                    del existentes_map[product_id_str]
                else:
                    # No existe => crear
                    producto_id_int = int(product_id_str)
                    nuevo_precio = Decimal(nuevos_dict[product_id_str])
                    a_crear.append(
                        PreciosProveedor(
                            proveedorid=proveedor,
                            productoid_id=producto_id_int,
                            precio=nuevo_precio
                        )
                    )

            # 5. Los objetos que quedan en existentes_map son los que ya no existen en el JSON => borrar
            # Si deseas la misma lógica de "eliminar lo que no aparece", puedes hacerlo:
            a_borrar_ids = [pp.pk for pid, pp in existentes_map.items()]
            
            # 6. Ejecutar las operaciones en bloque:
            #  6a) Borrar
            if a_borrar_ids:
                PreciosProveedor.objects.filter(pk__in=a_borrar_ids).delete()
            
            #  6b) Crear
            if a_crear:
                PreciosProveedor.objects.bulk_create(a_crear)

            #  6c) Actualizar
            if a_actualizar:
                PreciosProveedor.objects.bulk_update(a_actualizar, ['precio'])
            
            messages.success(request, f'Productos y precios actualizados exitosamente para el proveedor {proveedor.nombre}.')
            redirect_url = reverse('visualizar_productos_precios_proveedores')
            return JsonResponse({'success': True, 'redirect_url': redirect_url})
        else:
            errors = form.errors.as_json()
            return JsonResponse({'success': False, 'errors': errors})
    else:
        # GET => cargar formulario y productos existentes
        form = EditarPreciosProveedorForm(initial={
            'proveedor': proveedor.pk,
            'proveedor_autocomplete': proveedor.nombre,
        })
        # Construimos la lista para JS
        existentes = PreciosProveedor.objects.filter(proveedorid=proveedor).select_related('productoid')
        productos_existentes = []
        for pp in existentes:
            productos_existentes.append({
                'productId': pp.productoid.productoid,
                'productName': pp.productoid.nombre,
                'price': str(pp.precio),
            })
        
        return render(request, 'editar_productos_precios_proveedor.html', {
            'form': form,
            'proveedor': proveedor,
            'productos_existentes_json': json.dumps(productos_existentes),
        })


@login_required
def agregar_punto_pago_view(request):
    """
    Vista para agregar Puntos de Pago a una Sucursal.
    - GET: muestra formulario + autocompletado.
    - POST: valida e inserta la lista temporal de Puntos de Pago.
      Devuelve JSON.
    """
    if request.method == 'POST':
        form = PuntosPagoForm(request.POST)
        if form.is_valid():
            sucursal = form.cleaned_data['sucursal']
            puntos_temp_json = request.POST.get('puntos_temp')

            if puntos_temp_json:
                try:
                    puntos_temp = json.loads(puntos_temp_json)
                except json.JSONDecodeError:
                    puntos_temp = []

                if not puntos_temp:
                    # No hay puntos de pago
                    errors = {
                        'puntos_temp': [{'message': 'Debe agregar al menos un Punto de Pago antes de guardar.'}]
                    }
                    return JsonResponse({'success': False, 'errors': json.dumps(errors)})

                # Crear lista de objetos
                puntos_crear = []
                for punto in puntos_temp:
                    nombre = punto.get('nombre')
                    descripcion = punto.get('descripcion', '')
                    dinerocaja = punto.get('dinerocaja', 0.00)

                    if not nombre:
                        # Omitir si el campo nombre no existe
                        continue

                    # Evitar duplicados
                    if PuntosPago.objects.filter(sucursalid=sucursal, nombre=nombre).exists():
                        # Omitimos o retornamos error, según tu lógica:
                        # Aquí, devolvemos un error para todo.
                        errors = {
                            'nombre': [{'message': f'Ya existe un punto de pago con el nombre "{nombre}" en la sucursal.'}]
                        }
                        return JsonResponse({'success': False, 'errors': json.dumps(errors)})

                    puntos_crear.append(
                        PuntosPago(
                            sucursalid=sucursal,
                            nombre=nombre,
                            descripcion=descripcion or "",
                            dinerocaja=dinerocaja or 0.00
                        )
                    )

                # Bulk create
                PuntosPago.objects.bulk_create(puntos_crear)
                return JsonResponse({'success': True})
            else:
                errors = {
                    'puntos_temp': [{'message': 'Debe agregar al menos un Punto de Pago antes de guardar.'}]
                }
                return JsonResponse({'success': False, 'errors': json.dumps(errors)})
        else:
            # Error de formulario (por ejemplo, sucursal no válida)
            errors = form.errors.get_json_data()
            processed_errors = {}
            for field, field_errors in errors.items():
                processed_errors[field] = [{'message': error['message']} for error in field_errors]
            return JsonResponse({'success': False, 'errors': json.dumps(processed_errors)})
    else:
        form = PuntosPagoForm()

    # Filtrar Sucursales sin puntos de pago (o tu lógica)
    sucursales_sin_pp = Sucursal.objects.exclude(puntospago__isnull=False)

    return render(request, 'agregar_punto_pago.html', {
        'form': form,
        'sucursales': sucursales_sin_pp,
    })


@login_required
def sucursal_punto_pago_autocomplete(request):
    """
    Autocomplete para Sucursales sin Puntos de Pago.
    Paginación + Respuesta JSON.
    """
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    per_page_str = request.GET.get('per_page', '10').strip()

    try:
        page = int(page_str)
        if page < 1:
            page = 1
    except ValueError:
        page = 1

    try:
        per_page = int(per_page_str)
        if per_page < 1:
            per_page = 10
    except ValueError:
        per_page = 10

    start = (page - 1) * per_page
    end = start + per_page

    # Filtrar sucursales sin puntos de pago
    qs = Sucursal.objects.annotate(
        puntos_count=Count('puntospago')
    ).filter(
        puntos_count=0
    ).order_by('nombre')

    if term:
        qs = qs.filter(nombre__icontains=term)

    total_results = qs.count()
    qs = qs[start:end]

    results = []
    for suc in qs:
        results.append({
            'id': suc.sucursalid,
            'text': suc.nombre,
        })

    has_more = end < total_results
    return JsonResponse({
        'results': results,
        'has_more': has_more,
    })


@login_required
def visualizar_puntos_pago_view(request):
    # Obtener sucursales que ya tienen puntos de pago vinculados
    sucursales = Sucursal.objects.annotate(punto_count=Count('puntospago')).filter(punto_count__gt=0)
    puntos_pago = None
    sucursal_seleccionada = None

    if request.method == 'POST':
        sucursal_id = request.POST.get('sucursal')
        if sucursal_id:
            sucursal_seleccionada = get_object_or_404(Sucursal, pk=sucursal_id)
            puntos_pago = PuntosPago.objects.filter(sucursalid=sucursal_seleccionada)

    return render(request, 'visualizar_puntos_pago.html', {
        'sucursales': sucursales,
        'puntos_pago': puntos_pago,
        'sucursal_seleccionada': sucursal_seleccionada,
    })

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

@login_required
def visualizar_sucursal_punto_pago_autocomplete(request):
    """
    Autocomplete para sucursales CON puntos de pago (puntos_count > 0).
    Paginación + Respuesta JSON.
    """
    from django.db.models import Count
    
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    per_page_str = request.GET.get('per_page', '10').strip()

    try:
        page = int(page_str)
        if page < 1:
            page = 1
    except ValueError:
        page = 1

    try:
        per_page = int(per_page_str)
        if per_page < 1:
            per_page = 10
    except ValueError:
        per_page = 10

    start = (page - 1) * per_page
    end = start + per_page

    # Filtrar sucursales que tengan al menos un punto de pago
    qs = (Sucursal.objects
          .annotate(puntos_count=Count('puntospago'))
          .filter(puntos_count__gt=0)
          .order_by('nombre'))

    if term:
        qs = qs.filter(nombre__icontains=term)

    total_results = qs.count()
    qs = qs[start:end]

    results = []
    for suc in qs:
        results.append({
            'id': suc.sucursalid,
            'text': suc.nombre,
        })

    has_more = end < total_results
    return JsonResponse({
        'results': results,
        'has_more': has_more,
    })


@login_required
def editar_puntos_pago_view(request, sucursal_id):
    """
    Vista para EDITAR Puntos de Pago de una sucursal,
    con autocompletado de sucursal y edición en tabla.
    """
    sucursal = get_object_or_404(Sucursal, pk=sucursal_id)
    puntos = PuntosPago.objects.filter(sucursalid=sucursal)

    if request.method == 'POST':
        # Tomamos el formulario
        form = PuntosPagoEditarForm(request.POST, initial={'sucursal': sucursal.sucursalid})
        if form.is_valid():
            # Obtenemos la sucursal elegida en el formulario
            nueva_sucursal = form.cleaned_data['sucursal']

            # Tomamos el JSON con los puntos
            puntos_temp_json = request.POST.get('puntos_temp', '')
            try:
                puntos_temp = json.loads(puntos_temp_json)
            except json.JSONDecodeError:
                puntos_temp = []

            if not puntos_temp:
                errors = {
                    'puntos_temp': [{'message': 'Debe haber al menos un Punto de Pago para guardar.'}]
                }
                return JsonResponse({'success': False, 'errors': json.dumps(errors)})

            # IDs en DB
            db_ids = set(puntos.values_list('puntopagoid', flat=True))
            # IDs en la petición
            new_ids = set(int(p['id']) for p in puntos_temp if p.get('id'))

            # 1. Eliminar de la base los que ya no estén
            to_delete_ids = db_ids - new_ids
            if to_delete_ids:
                PuntosPago.objects.filter(puntopagoid__in=to_delete_ids).delete()

            # 2. Crear o actualizar
            for p in puntos_temp:
                punto_id = p.get('id', None)
                nombre = p.get('nombre', '').strip()
                descripcion = p.get('descripcion', '')
                dinerocaja = p.get('dinerocaja', 0.0)

                if not nombre:
                    errors = {
                        'nombre': [{'message': 'El nombre del Punto de Pago es obligatorio.'}]
                    }
                    return JsonResponse({'success': False, 'errors': json.dumps(errors)})

                if punto_id:  # actualizar
                    punto_id = int(punto_id)
                    pp = PuntosPago.objects.filter(puntopagoid=punto_id).first()
                    if not pp:
                        # No existía => crear
                        if PuntosPago.objects.filter(sucursalid=nueva_sucursal, nombre=nombre).exists():
                            errors = {
                                'nombre': [{'message': f'Ya existe un punto de pago con el nombre "{nombre}" en la sucursal.'}]
                            }
                            return JsonResponse({'success': False, 'errors': json.dumps(errors)})
                        PuntosPago.objects.create(
                            sucursalid=nueva_sucursal,
                            nombre=nombre,
                            descripcion=descripcion,
                            dinerocaja=dinerocaja
                        )
                    else:
                        # Verificar duplicado por nombre (excluyendo el mismo ID)
                        if PuntosPago.objects.filter(
                            sucursalid=nueva_sucursal,
                            nombre=nombre
                        ).exclude(puntopagoid=punto_id).exists():
                            errors = {
                                'nombre': [{'message': f'Ya existe un punto de pago con el nombre "{nombre}" en la sucursal.'}]
                            }
                            return JsonResponse({'success': False, 'errors': json.dumps(errors)})

                        # Actualizar
                        pp.sucursalid = nueva_sucursal
                        pp.nombre = nombre
                        pp.descripcion = descripcion
                        pp.dinerocaja = dinerocaja
                        pp.save()
                else:
                    # Crear nuevo
                    if PuntosPago.objects.filter(sucursalid=nueva_sucursal, nombre=nombre).exists():
                        errors = {
                            'nombre': [{'message': f'Ya existe un punto de pago con el nombre "{nombre}" en la sucursal.'}]
                        }
                        return JsonResponse({'success': False, 'errors': json.dumps(errors)})
                    PuntosPago.objects.create(
                        sucursalid=nueva_sucursal,
                        nombre=nombre,
                        descripcion=descripcion,
                        dinerocaja=dinerocaja
                    )

            # Todo salió bien => guardamos un mensaje de éxito
            messages.success(request, "Puntos de pago actualizados exitosamente.")

            # Enviamos la redirección al front-end (JS)
            return JsonResponse({
                'success': True,
                'redirect_url': reverse('visualizar_puntos_pago')
            })
        else:
            # Error en el form
            errors = form.errors.get_json_data()
            processed_errors = {}
            for field, field_errors in errors.items():
                processed_errors[field] = [{'message': err['message']} for err in field_errors]
            return JsonResponse({'success': False, 'errors': json.dumps(processed_errors)})

    else:
        # GET
        form = PuntosPagoEditarForm(initial={
            'sucursal': sucursal.sucursalid,
            'sucursal_autocomplete': sucursal.nombre,
        })

    # Convertir dinerocaja (Decimal) a float para JSON
    puntos_list = list(puntos.values('puntopagoid', 'nombre', 'descripcion', 'dinerocaja'))
    for p in puntos_list:
        if p['dinerocaja'] is not None:
            p['dinerocaja'] = float(p['dinerocaja'])
        else:
            p['dinerocaja'] = 0.0

    return render(request, 'editar_puntos_pago.html', {
        'form': form,
        'sucursal': sucursal,
        'puntos_json': json.dumps(puntos_list),
    })

@login_required
def sucursal_editar_punto_pago_autocomplete(request):
    """
    Autocomplete para elegir la sucursal al editar Puntos de Pago.
    Incluirá la sucursal actual (si se pasa 'current_sucursal_id')
    y las sucursales que no tengan puntos de pago.
    """
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    per_page_str = request.GET.get('per_page', '10').strip()
    current_sucursal_id = request.GET.get('current_sucursal_id', '').strip()

    try:
        page = int(page_str)
        if page < 1:
            page = 1
    except ValueError:
        page = 1

    try:
        per_page = int(per_page_str)
        if per_page < 1:
            per_page = 10
    except ValueError:
        per_page = 10

    start = (page - 1) * per_page
    end = start + per_page

    # 1. QuerySet de sucursales sin puntos de pago
    qs_sin_pp = (Sucursal.objects
                 .annotate(count_pp=Count('puntospago'))
                 .filter(count_pp=0))

    # 2. QuerySet de la sucursal actual (si es un ID válido)
    qs_actual = Sucursal.objects.filter(pk__exact=current_sucursal_id) if current_sucursal_id.isdigit() else Sucursal.objects.none()

    # 3. OR de ambos => Retorna las sucursales sin PP o la actual
    qs = (qs_sin_pp | qs_actual).distinct().order_by('nombre')

    # Si 'term' no está vacío, filtramos por nombre
    if term:
        qs = qs.filter(nombre__icontains=term)

    total_results = qs.count()
    qs = qs[start:end]

    results = []
    for suc in qs:
        results.append({
            'id': suc.sucursalid,
            'text': suc.nombre,
        })

    has_more = end < total_results
    return JsonResponse({
        'results': results,
        'has_more': has_more,
    })


@login_required
def agregar_rol_view(request):
    if request.method == 'POST':
        form = RolForm(request.POST)
        if form.is_valid():
            form.save()
            return JsonResponse({'success': True, 'message': 'Rol agregado exitosamente.'})
        else:
            errors = form.errors.as_json()
            return JsonResponse({'success': False, 'errors': errors})
    else:
        form = RolForm()
    return render(request, 'agregar_rol.html', {'form': form})


@login_required
def visualizar_roles_view(request):
    roles = Rol.objects.all()
    return render(request, 'visualizar_roles.html', {'roles': roles})


def editar_rol_view(request, rol_id):
    """
    Vista para editar un Rol con AJAX. 
    Si todo va bien, redirige a visualizar_roles al final.
    """
    rol = get_object_or_404(Rol, pk=rol_id)

    if request.method == 'POST':
        form = RolEditarForm(request.POST, instance=rol)
        if form.is_valid():
            form.save()
            # Mensaje de éxito con Django messages
            messages.success(request, f'Rol "{rol.nombre}" actualizado correctamente.')
            
            # Devolvemos JSON indicando que todo salió bien y la URL a la que redirigir
            return JsonResponse({
                'success': True, 
                'redirect_url': reverse('visualizar_roles')
            })
        else:
            errors_json = form.errors.as_json()
            return JsonResponse({
                'success': False, 
                'errors': errors_json
            })
    else:
        # GET
        form = RolEditarForm(instance=rol)

    return render(request, 'editar_rol.html', {
        'form': form,
        'rol': rol,
    })


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


@login_required
def agregar_usuario_view(request):
    """
    Vista para agregar un nuevo Usuario.
    Maneja GET (muestra formulario) y POST (valida y guarda).
    Devuelve JSON en caso de POST.
    """
    if request.method == 'POST':
        form = UsuarioForm(request.POST)
        if form.is_valid():
            nombreusuario = form.cleaned_data['nombreusuario']
            password = form.cleaned_data['contraseña']
            rol_obj = form.cleaned_data['rolid']

            # Validar si ya existe un usuario con ese nombre
            if Usuario.objects.filter(nombreusuario=nombreusuario).exists():
                errors = {
                    'nombreusuario': [{'message': f'El nombre de usuario "{nombreusuario}" ya existe.'}]
                }
                return JsonResponse({'success': False, 'errors': json.dumps(errors)})

            # Crear el nuevo usuario
            nuevo_usuario = Usuario(
                nombreusuario=nombreusuario,
                rolid=rol_obj.rolid  # asumiendo que 'rolid' es un int en la DB
            )
            # Encriptar la contraseña
            nuevo_usuario.set_password(password)
            nuevo_usuario.save()

            return JsonResponse({'success': True})
        else:
            # Convertir errores del formulario a JSON
            errors = form.errors.get_json_data()
            processed_errors = {}
            for field, field_errors in errors.items():
                processed_errors[field] = [{'message': e['message']} for e in field_errors]
            return JsonResponse({'success': False, 'errors': json.dumps(processed_errors)})
    else:
        # GET
        form = UsuarioForm()

    # Render normal (si es GET)
    return render(request, 'agregar_usuario.html', {'form': form})


@login_required
def rol_autocomplete(request):
    """
    Autocomplete para Rol.
    Implementa paginación y responde con JSON.
    """
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    per_page_str = request.GET.get('per_page', '10').strip()

    try:
        page = int(page_str)
        if page < 1:
            page = 1
    except ValueError:
        page = 1

    try:
        per_page = int(per_page_str)
        if per_page < 1:
            per_page = 10
    except ValueError:
        per_page = 10

    start = (page - 1) * per_page
    end = start + per_page

    qs = Rol.objects.all().order_by('nombre')
    if term:
        qs = qs.filter(nombre__icontains=term)

    total_results = qs.count()
    qs = qs[start:end]

    results = []
    for rol in qs:
        results.append({
            'id': rol.rolid,
            'text': rol.nombre,
        })

    has_more = end < total_results

    return JsonResponse({
        'results': results,
        'has_more': has_more,
    })


@login_required
def visualizar_usuarios_view(request):
    usuarios = Usuario.objects.all()
    return render(request, 'visualizar_usuarios.html', {'usuarios': usuarios})

@login_required
def eliminar_usuario_view(request, usuarioid):
    usuario = get_object_or_404(Usuario, pk=usuarioid)
    nombre_usuario = usuario.nombreusuario
    usuario.delete()
    messages.success(request, f'Usuario "{nombre_usuario}" eliminado exitosamente.')
    return redirect('visualizar_usuarios')


@login_required
def editar_usuario_view(request, usuarioid):
    """
    Vista para EDITAR Usuario usando AJAX.
    - GET: muestra form con los datos actuales.
    - POST: valida form, si ok => actualiza y retorna JSON con redirect_url.
    """
    usuario = get_object_or_404(Usuario, pk=usuarioid)

    if request.method == 'POST':
        form = UsuarioEditarForm(request.POST, instance=usuario)
        if form.is_valid():
            cd = form.cleaned_data
            # 1. Rol
            rol_obj = cd['rolid']
            usuario.rolid = rol_obj.pk  # asumiendo que rolid en Usuario es un int

            # 2. nombreusuario (si cambió, el form ya verificó duplicado)
            usuario.nombreusuario = cd['nombreusuario']

            # 3. Contraseña (si la ingresaron)
            password = cd['contraseña']
            if password:
                # Cambiamos la contraseña
                usuario.set_password(password)
            
            usuario.save()

            # Guardar mensaje de éxito y retornar JSON
            messages.success(request, f'Usuario "{usuario.nombreusuario}" actualizado exitosamente.')
            return JsonResponse({
                'success': True,
                'redirect_url': reverse('visualizar_usuarios')
            })
        else:
            # Retornar errores
            errors_dict = form.errors.get_json_data()  
            # Pasarlo a un JSON string si quieres
            return JsonResponse({
                'success': False,
                'errors': json.dumps(errors_dict)
            })
    else:
        # GET
        form = UsuarioEditarForm(instance=usuario)

    return render(request, 'editar_usuario.html', {
        'form': form,
        'usuario': usuario
    })




@login_required
def agregar_empleado_view(request):
    if request.method == 'POST':
        form = EmpleadoForm(request.POST)
        if form.is_valid():
            try:
                form.save()
                logger.info(f"Empleado agregado: {form.cleaned_data}")
                return JsonResponse({'success': True, 'message': 'Empleado agregado exitosamente.'})
            except Exception as e:
                logger.error(f"Error al guardar el empleado: {e}")
                return JsonResponse({'success': False, 'errors': {'__all__': [{'message': 'Ocurrió un error al guardar el empleado.'}]}})
        else:
            logger.warning(f"Formulario inválido: {form.errors}")
            errors = form.errors.get_json_data()  # Obtener errores como dict
            return JsonResponse({'success': False, 'errors': errors})
    else:
        form = EmpleadoForm()
    return render(request, 'agregar_empleado.html', {'form': form})

@login_required
def usuario_autocomplete(request):
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    empleado_id_str = request.GET.get('empleadoid', '').strip()  # <-- nuevo
    per_page = 10
    
    # Convertir page
    try:
        page = int(page_str)
        if page < 1: page = 1
    except ValueError:
        page = 1

    # Convertir empleadoid
    empleado_id = None
    try:
        empleado_id = int(empleado_id_str)
    except (ValueError, TypeError):
        empleado_id = None

    start = (page - 1) * per_page
    end = start + per_page

    # Caso base: Filtrar usuarios sin empleado
    # y que nombreusuario contenga `term`
    qs = Usuario.objects.filter(
        Q(nombreusuario__icontains=term),
        Q(empleado__isnull=True)
    ).order_by('nombreusuario')

    # Si “empleado_id” existe, incluir el USUARIO que ya estaba asignado a ese empleado
    # => Ejemplo: si Empleado xyz tenía usuario X, no lo excluimos
    if empleado_id:
        try:
            empleado = Empleado.objects.select_related('usuarioid').get(pk=empleado_id)
            if empleado.usuarioid:
                # Incluir el “usuarioid actual” en el queryset
                # De modo que si ya está asignado a “empleado”, no se excluya
                qs = qs.union(
                    Usuario.objects.filter(pk=empleado.usuarioid.pk)
                )
        except Empleado.DoesNotExist:
            pass

    total_results = qs.count()
    qs = qs[start:end]

    results = []
    for usuario in qs:
        results.append({
            'id': usuario.pk,
            'text': usuario.nombreusuario,
        })

    return JsonResponse({
        'results': results,
        'has_more': end < total_results,
    })

@login_required
def sucursal_autocomplete(request):
    """
    Autocomplete para Sucursal: muestra TODAS las sucursales,
    con paginación y soporte para 'term'.
    """
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    per_page_str = request.GET.get('per_page', '50').strip()

    # 1. Convertir 'page'
    try:
        page = int(page_str)
    except ValueError:
        page = 1
    if page < 1:
        page = 1

    # 2. Convertir 'per_page'
    try:
        per_page = int(per_page_str)
    except ValueError:
        per_page = 50
    if per_page < 1:
        per_page = 50

    start = (page - 1) * per_page
    end = start + per_page

    # 3. Tomar TODAS las sucursales (SIN filtrar por horarios)
    qs = Sucursal.objects.all()

    # 4. Filtro por 'term'
    if term:
        qs = qs.filter(nombre__icontains=term)

    # 5. Ordenar
    qs = qs.order_by('nombre')

    # 6. Paginación
    total_results = qs.count()
    qs = qs[start:end]

    # 7. Construir 'results'
    results = []
    for sucursal in qs:
        results.append({
            'id': sucursal.pk,
            'text': sucursal.nombre,
        })

    # Saber si hay más resultados
    has_more = end < total_results

    # Retornar en formato JSON para el autocomplete
    return JsonResponse({
        'results': results,
        'has_more': has_more,
    })



@login_required
def visualizar_empleados_view(request):
    empleados = Empleado.objects.all().order_by('nombre')
    return render(request, 'visualizar_empleados.html', {'empleados': empleados})


@login_required
def editar_empleado_view(request, empleadoid):
    from django.urls import reverse
    empleado = get_object_or_404(Empleado, pk=empleadoid)

    if request.method == 'POST':
        form = EditarEmpleadoForm(request.POST, instance=empleado)
        if form.is_valid():
            form.save()
            messages.success(
                request,
                f'Empleado "{form.instance.nombre} {form.instance.apellido}" editado exitosamente.'
            )
            # Responder en JSON (AJAX)
            return JsonResponse({
                'success': True,
                'redirect_url': reverse('visualizar_empleados')
            })
        else:
            # Retornar errores en JSON
            errors = form.errors.as_json()
            return JsonResponse({
                'success': False,
                'errors': errors
            })
    else:
        # GET => mostrar formulario con datos
        form = EditarEmpleadoForm(instance=empleado)

    return render(request, 'editar_empleado.html', {'form': form})


@login_required
def eliminar_empleado_view(request, empleado_id):
    empleado = get_object_or_404(Empleado, pk=empleado_id)
    nombre_completo = f"{empleado.nombre} {empleado.apellido}"
    empleado.delete()
    messages.success(request, f'Empleado "{nombre_completo}" ha sido eliminado exitosamente.')
    return redirect('visualizar_empleados')


@login_required
def agregar_horario_view(request):
    """
    Vista para agregar horarios a una sucursal.
    Maneja tanto GET como POST requests.
    En POST, valida el formulario y procesa los horarios temporales.
    Responde con JSON para manejar las respuestas en el frontend.
    """
    if request.method == 'POST':
        form = HorariosNegocioForm(request.POST)
        if form.is_valid():
            horarios_temp = request.POST.get('horarios')
            if horarios_temp:
                horarios = json.loads(horarios_temp)
                sucursal = form.cleaned_data['sucursalid']
                for horario in horarios:
                    HorariosNegocio.objects.create(
                        sucursalid=sucursal,
                        dia_semana=horario['dia'],
                        horaapertura=horario['horaapertura'],
                        horacierre=horario['horacierre']
                    )
                return JsonResponse({'success': True})
            else:
                errors = {
                    'horarios': [{'message': 'Debe agregar al menos un horario antes de guardar.'}]
                }
                return JsonResponse({'success': False, 'errors': json.dumps(errors)})
        else:
            # Convertir errores del formulario a JSON
            errors = form.errors.get_json_data()
            # Procesar errores para el formato esperado por el frontend
            processed_errors = {}
            for field, field_errors in errors.items():
                processed_errors[field] = [{'message': error['message']} for error in field_errors]
            return JsonResponse({'success': False, 'errors': json.dumps(processed_errors)})
    else:
        form = HorariosNegocioForm()

    return render(request, 'agregar_horario.html', {'form': form})

@login_required
def horario_sucursal_autocomplete(request):
    """
    Autocomplete para Sucursal: muestra solo aquellas sucursales que NO 
    tienen horarios establecidos (en el modelo HorariosNegocio), 
    con paginación y soporte para 'term'.
    
    Se asume que en el modelo Sucursal la relación con HorariosNegocio 
    tiene el related name "horariosnegocio". Ajusta este valor en caso de ser diferente.
    """
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    per_page_str = request.GET.get('per_page', '50').strip()

    # Convertir 'page'
    try:
        page = int(page_str)
    except ValueError:
        page = 1
    if page < 1:
        page = 1

    # Convertir 'per_page'
    try:
        per_page = int(per_page_str)
    except ValueError:
        per_page = 50
    if per_page < 1:
        per_page = 50

    start = (page - 1) * per_page
    end = start + per_page

    # Filtrar sucursales que NO tengan ningún horario asignado
    qs = Sucursal.objects.filter(horariosnegocio__isnull=True)

    # Filtro por 'term'
    if term:
        qs = qs.filter(nombre__icontains=term)

    # Ordenar por nombre
    qs = qs.order_by('nombre')

    # Paginación
    total_results = qs.count()
    qs = qs[start:end]

    # Construir results para el autocomplete
    results = []
    for sucursal in qs:
        results.append({
            'id': sucursal.pk,
            'text': sucursal.nombre,
        })

    has_more = end < total_results

    return JsonResponse({
        'results': results,
        'has_more': has_more,
    })


@login_required
def visualizar_horarios_view(request):
    sucursales = Sucursal.objects.filter(horariosnegocio__isnull=False).distinct()
    sucursal_seleccionada = None
    horarios = []

    if request.method == 'POST':
        sucursal_id = request.POST.get('sucursal')
        if sucursal_id:
            sucursal_seleccionada = get_object_or_404(Sucursal, pk=sucursal_id)
            horarios = HorariosNegocio.objects.filter(sucursalid=sucursal_seleccionada)

    return render(request, 'visualizar_horarios.html', {
        'sucursales': sucursales,
        'sucursal_seleccionada': sucursal_seleccionada,
        'horarios': horarios,
    })
    
@login_required
def visualizar_horarios_sucursal_autocomplete(request):
    """
    Autocomplete para filtrar sucursales que tienen horarios (es decir, que tienen al menos un HorariosNegocio).
    Permite buscar por 'term' y usa paginación con 'page' y 'per_page'.
    """
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    per_page_str = request.GET.get('per_page', '50').strip()

    try:
        page = int(page_str)
    except ValueError:
        page = 1
    if page < 1:
        page = 1

    try:
        per_page = int(per_page_str)
    except ValueError:
        per_page = 50
    if per_page < 1:
        per_page = 50

    qs = Sucursal.objects.filter(horariosnegocio__isnull=False).distinct()
    if term:
        qs = qs.filter(nombre__icontains=term)
    qs = qs.order_by('nombre')

    total_results = qs.count()
    start = (page - 1) * per_page
    end = start + per_page
    qs = qs[start:end]

    results = [{'id': suc.sucursalid, 'text': suc.nombre} for suc in qs]
    has_more = end < total_results

    return JsonResponse({
        'results': results,
        'has_more': has_more,
    })


@login_required
def editar_horarios_view(request, sucursal_id):
    """
    Vista para editar los horarios de una sucursal en particular.
    - GET: retorna la plantilla con la sucursal y sus horarios actuales.
    - POST (AJAX/JSON): recibe los datos con la lista de horarios nuevos,
      elimina los existentes y crea (o actualiza) los nuevos.
    """
    sucursal = get_object_or_404(Sucursal, pk=sucursal_id)
    horarios_existentes = HorariosNegocio.objects.filter(sucursalid=sucursal).order_by('dia_semana')

    if request.method == 'POST':
        # Se espera que vengan datos en formato JSON via fetch (AJAX)
        try:
            data = json.loads(request.body)
        except ValueError:
            return JsonResponse({'success': False, 'error': 'JSON inválido.'}, status=400)

        sucursal_id_post = data.get('sucursalid')
        horarios_list = data.get('horarios', [])

        # Instanciamos el formulario para validaciones básicas
        form_data = {
            'sucursalid': sucursal_id_post,
            'dia_semana': '',
            'horaapertura': '',
            'horacierre': '',
        }
        form = EditarHorariosSucursalForm(data=form_data, horarios_present=bool(horarios_list))
        if form.is_valid():
            try:
                # 1) Borrar los horarios antiguos de esta sucursal
                HorariosNegocio.objects.filter(sucursalid=sucursal).delete()

                # 2) (Opcional) Si quisieras cambiar la sucursal "asociada" a la URL,
                #    podrías hacerlo (dependerá de tu lógica), por ejemplo:
                #    sucursal.sucursalid = sucursal_id_post
                #    sucursal.save()

                # 3) Crear/Insertar los nuevos horarios
                for item in horarios_list:
                    dia = item['dia']
                    hora_apertura = item['horaapertura']
                    hora_cierre = item['horacierre']
                    HorariosNegocio.objects.create(
                        sucursalid_id=sucursal_id_post,
                        dia_semana=dia,
                        horaapertura=hora_apertura,
                        horacierre=hora_cierre
                    )

                # Mensaje de éxito en caso de que quieras usarlo con Django messages
                messages.success(request, f'Horarios de la sucursal {sucursal.nombre} actualizados correctamente.')
                return JsonResponse({'success': True})
            except Exception as e:
                return JsonResponse({'success': False, 'error': str(e)})
        else:
            # Errores de validación del formulario
            errors_json = form.errors.get_json_data()
            return JsonResponse({'success': False, 'errors': json.dumps(errors_json)})
    
    # GET => Renderizar la plantilla
    return render(request, 'editar_horario.html', {
        'sucursal': sucursal,
        'horarios': horarios_existentes,
    })

@login_required
def horarios_sucursal_autocomplete(request):
    """
    Autocomplete que:
      - Incluye SIEMPRE la sucursal actual (enviada como 'current_sucursal_id'),
        incluso si ya tiene horarios.
      - Incluye TODAS las sucursales que NO tengan ningún horario (horariosnegocio__isnull=True).
      - Aplica filtro por 'term' (nombre) únicamente si se proporciona.
      - Maneja paginación con 'page' y 'per_page'.
    """
    # Parámetros GET
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    per_page_str = request.GET.get('per_page', '50').strip()
    current_sucursal_str = request.GET.get('current_sucursal_id', '').strip()

    # Paginación: page
    try:
        page = int(page_str)
    except ValueError:
        page = 1
    if page < 1:
        page = 1

    # Paginación: per_page
    try:
        per_page = int(per_page_str)
    except ValueError:
        per_page = 50
    if per_page < 1:
        per_page = 50

    # Convertir el ID de sucursal actual
    try:
        current_sucursal_id = int(current_sucursal_str)
    except ValueError:
        current_sucursal_id = None

    # QuerySet base:
    # Si tenemos un current_sucursal_id => mostrar esa sucursal y las que no tienen horarios
    # De lo contrario, solo mostramos las sin horarios.
    if current_sucursal_id:
        qs = Sucursal.objects.filter(
            Q(pk=current_sucursal_id) | Q(horariosnegocio__isnull=True)
        )
    else:
        qs = Sucursal.objects.filter(horariosnegocio__isnull=True)

    # Si hay un 'term', filtramos adicionalmente por nombre
    if term:
        qs = qs.filter(nombre__icontains=term)

    # Ordenar por nombre
    qs = qs.order_by('nombre')

    # Paginación
    start = (page - 1) * per_page
    end = start + per_page
    total_results = qs.count()
    qs = qs[start:end]

    # Construir la respuesta JSON
    results = []
    for suc in qs:
        results.append({
            'id': suc.pk,
            'text': suc.nombre
        })

    has_more = end < total_results
    return JsonResponse({
        'results': results,
        'has_more': has_more,
    })

@login_required
def eliminar_horario_view(request, horario_id):
    if request.method == 'POST':
        horario = get_object_or_404(HorariosNegocio, pk=horario_id)
        horario.delete()
        return JsonResponse({'success': True, 'message': 'Horario eliminado exitosamente.'})
    return JsonResponse({'success': False, 'message': 'Método no permitido.'})


@login_required
def agregar_horario_caja_view(request):
    puntos_con_horario = HorarioCaja.objects.filter(puntopagoid=OuterRef('pk'))

    sucursales = Sucursal.objects.annotate(
        tiene_puntos_sin_horario=Exists(
            PuntosPago.objects.filter(
                sucursalid=OuterRef('pk')
            ).exclude(
                Exists(puntos_con_horario)
            )
        )
    ).filter(tiene_puntos_sin_horario=True).distinct()

    if request.method == 'POST':
        horarios_temp = request.POST.get('horarios')
        horarios_present = bool(horarios_temp and json.loads(horarios_temp))
        form = HorarioCajaForm(request.POST, horarios_present=horarios_present)
        if form.is_valid():
            if horarios_present:
                horarios = json.loads(horarios_temp)
                puntopago = form.cleaned_data['puntopagoid']
                for horario in horarios:
                    HorarioCaja.objects.create(
                        puntopagoid=puntopago,
                        dia_semana=horario['dia'],
                        horaapertura=horario['horaapertura'],
                        horacierre=horario['horacierre']
                    )
                return JsonResponse({'success': True})
            else:
                dia_semana = form.cleaned_data['dia_semana']
                horaapertura = form.cleaned_data['horaapertura']
                horacierre = form.cleaned_data['horacierre']
                puntopago = form.cleaned_data['puntopagoid']

                dias = dia_semana.split(',')
                for dia in dias:
                    HorarioCaja.objects.create(
                        puntopagoid=puntopago,
                        dia_semana=dia,
                        horaapertura=horaapertura,
                        horacierre=horacierre
                    )
                return JsonResponse({'success': True})
        else:
            errors = form.errors.as_json()
            return JsonResponse({'success': False, 'errors': errors})
    else:
        form = HorarioCajaForm()

    return render(request, 'agregar_horario_caja.html', {
        'form': form,
        'sucursales': sucursales,
    })


@login_required
def sucursal_autocomplete_horariocaja(request):
    """
    Autocomplete para Sucursal que tengan al menos un Punto de Pago
    que aún NO tenga un horario asignado (HorarioCaja).
    Incluye paginación y filtro por 'term' (búsqueda).
    """
    # 1. Obtener parámetros de búsqueda y paginación
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    per_page_str = request.GET.get('per_page', '50').strip()

    # 2. Convertir 'page' a entero seguro
    try:
        page = int(page_str)
    except ValueError:
        page = 1
    if page < 1:
        page = 1

    # 3. Convertir 'per_page' a entero seguro
    try:
        per_page = int(per_page_str)
    except ValueError:
        per_page = 50
    if per_page < 1:
        per_page = 50

    start = (page - 1) * per_page
    end = start + per_page

    # 4. QuerySet base:
    #    Filtramos Sucursales que tengan AL MENOS 1 punto de pago SIN horario.
    #    - Para ello, usamos un Count en PuntosPago (con horarios_caja__isnull=True)
    #      y filtramos las sucursales que tienen count_pp_sin_horario > 0
    qs = (
        Sucursal.objects
        .annotate(
            # Contar los PuntosPago que no tengan horarios
            count_pp_sin_horario=Count(
                'puntospago',
                filter=Q(puntospago__horarios_caja__isnull=True),
                distinct=True
            )
        )
        .filter(count_pp_sin_horario__gt=0)
    )

    # 5. Filtro por 'term' si viene
    if term:
        qs = qs.filter(nombre__icontains=term)

    # 6. Ordenar por nombre
    qs = qs.order_by('nombre')

    # 7. Paginación
    total_results = qs.count()
    qs = qs[start:end]

    # 8. Construir results para el autocomplete
    results = []
    for sucursal in qs:
        results.append({
            'id': sucursal.pk,
            'text': sucursal.nombre,
        })

    # 9. Saber si hay más
    has_more = end < total_results

    # 10. Respuesta JSON
    return JsonResponse({
        'results': results,
        'has_more': has_more,
    })

@login_required
def puntopago_autocomplete(request):
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    per_page = 50

    # Validar y convertir página a entero
    try:
        page = int(page_str)
        if page < 1:
            page = 1
    except ValueError:
        page = 1

    start = (page - 1) * per_page
    end = start + per_page

    # Tomar la sucursal
    sucursal_id_str = request.GET.get('sucursal_id', '')
    if not sucursal_id_str:
        return JsonResponse({
            'results': [],
            'has_more': False,
            'error': 'No se proporcionó un ID de sucursal.'
        })

    try:
        sucursal_id = int(sucursal_id_str)
        sucursal = Sucursal.objects.get(pk=sucursal_id)
    except (ValueError, Sucursal.DoesNotExist):
        return JsonResponse({
            'results': [],
            'has_more': False,
            'error': 'Sucursal no válida o no encontrada.'
        })

    # Filtrar PuntosPago sin horario
    puntos_pago = (
        PuntosPago.objects
        .filter(sucursalid=sucursal)
        .annotate(
            tiene_horario=Exists(
                HorarioCaja.objects.filter(puntopagoid=OuterRef('pk'))
            )
        )
        .exclude(tiene_horario=True)
    )

    # Filtro por término
    if term:
        puntos_pago = puntos_pago.filter(nombre__icontains=term)

    total_results = puntos_pago.count()
    puntos_pago = puntos_pago[start:end]

    results = []
    for pp in puntos_pago:
        results.append({
            'id': pp.pk,      # o pp.puntopagoid
            'text': pp.nombre
        })

    return JsonResponse({
        'results': results,
        'has_more': end < total_results,
    })


@login_required
def visualizar_horarios_cajas_view(request):
    # Subquery para identificar puntos de pago que tengan horarios
    puntos_con_horario = HorarioCaja.objects.filter(puntopagoid=OuterRef('pk'))
    
    # Sucursales que tienen al menos un punto de pago con horarios
    sucursales = Sucursal.objects.filter(
        Exists(
            PuntosPago.objects.filter(sucursalid=OuterRef('pk')).filter(Exists(puntos_con_horario))
        )
    ).distinct().order_by('nombre')

    sucursal_seleccionada = None
    punto_pago_seleccionado = None
    puntos_pago = []
    horarios = []

    if request.method == 'POST':
        sucursal_id = request.POST.get('sucursal')
        punto_pago_id = request.POST.get('punto_pago')
        if sucursal_id:
            sucursal_seleccionada = get_object_or_404(Sucursal, pk=sucursal_id)
            puntos_pago = PuntosPago.objects.filter(sucursalid=sucursal_seleccionada).filter(Exists(puntos_con_horario))
        if punto_pago_id:
            punto_pago_seleccionado = get_object_or_404(PuntosPago, pk=punto_pago_id)
            horarios = HorarioCaja.objects.filter(puntopagoid=punto_pago_seleccionado.puntopagoid)

    return render(request, 'visualizar_horarios_cajas.html', {
        'sucursales': sucursales,
        'sucursal_seleccionada': sucursal_seleccionada,
        'puntos_pago': puntos_pago,
        'punto_pago_seleccionado': punto_pago_seleccionado,
        'horarios': horarios,
    })

@login_required
def sucursal_horarios_autocomplete(request):
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    per_page_str = request.GET.get('per_page', '10').strip()

    try:
        page = int(page_str)
        if page < 1:
            page = 1
    except ValueError:
        page = 1

    try:
        per_page = int(per_page_str)
        if per_page < 1:
            per_page = 10
    except ValueError:
        per_page = 10

    start = (page - 1) * per_page
    end = start + per_page

    # Subquery para identificar puntos de pago que tienen horarios
    puntos_con_horario = HorarioCaja.objects.filter(puntopagoid=OuterRef('pk')).values('puntopagoid')
    
    # Filtrar sucursales que tienen al menos un punto de pago que tenga horarios
    qs = Sucursal.objects.filter(
            Exists(
                PuntosPago.objects.filter(sucursalid=OuterRef('pk')).filter(Exists(puntos_con_horario))
            )
         ).order_by('nombre')

    if term:
        qs = qs.filter(nombre__icontains=term)

    total_results = qs.count()
    qs = qs[start:end]

    results = [{'id': sucursal.sucursalid, 'text': sucursal.nombre} for sucursal in qs]
    has_more = end < total_results

    return JsonResponse({'results': results, 'has_more': has_more})

@login_required
def puntopago_horarios_autocomplete(request):
    term = request.GET.get('term', '').strip()
    sucursal_id = request.GET.get('sucursal_id', None)
    page_str = request.GET.get('page', '1').strip()
    per_page_str = request.GET.get('per_page', '10').strip()

    try:
        page = int(page_str)
        if page < 1:
            page = 1
    except ValueError:
        page = 1

    try:
        per_page = int(per_page_str)
        if per_page < 1:
            per_page = 10
    except ValueError:
        per_page = 10

    start = (page - 1) * per_page
    end = start + per_page

    # Subquery para saber si el punto de pago tiene horarios
    qs = PuntosPago.objects.filter(Exists(HorarioCaja.objects.filter(puntopagoid=OuterRef('pk'))))
    
    if sucursal_id:
        qs = qs.filter(sucursalid__sucursalid=sucursal_id)
    if term:
        qs = qs.filter(nombre__icontains=term)
    
    qs = qs.order_by('nombre')
    total_results = qs.count()
    qs = qs[start:end]

    results = [{'id': punto.puntopagoid, 'text': punto.nombre} for punto in qs]
    has_more = end < total_results

    return JsonResponse({'results': results, 'has_more': has_more})

@login_required
def eliminar_horario_caja_view(request, horario_id):
    try:
        horario = get_object_or_404(HorarioCaja, pk=horario_id)
        horario.delete()
        return JsonResponse({'success': True, 'message': 'Horario eliminado exitosamente.'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': 'Ocurrió un error al eliminar el horario.'})


@login_required
def obtener_puntos_pago_con_horarios(request):
    sucursal_id = request.GET.get('sucursal_id')
    puntos_con_horario = HorarioCaja.objects.filter(puntopagoid=OuterRef('pk')).values('puntopagoid')
    puntos_pago = PuntosPago.objects.filter(sucursalid=sucursal_id).filter(Exists(puntos_con_horario))
    opciones = ['<option value="">Seleccionar punto de pago</option>']
    for punto_pago in puntos_pago:
        opciones.append(f'<option value="{punto_pago.puntopagoid}">{punto_pago.nombre}</option>')
    return JsonResponse(opciones, safe=False)


@login_required
def editar_horarios_cajas_view(request, puntopagoid):
    """
    Vista para editar (reemplazar) los horarios de una Caja en particular (punto_pago),
    PERMITIENDO CAMBIAR a otra Sucursal y/o Punto de Pago que no tenga horario.
    
    GET:
      - Muestra la página con los horarios ya existentes del puntopagoid actual.
      - Muestra, en el input de Sucursal/Punto de Pago, la sucursal/punto de pago actual,
        pero no "disabled" (para que el usuario pueda cambiarlos vía autocomplete).
    POST (JSON):
      {
        "sucursalid": <ID de la sucursal elegida>,
        "puntopagoid": <ID del punto de pago elegido>,
        "horarios": [
           {
              "dia": "Lun",
              "hora_apertura": "08:00",
              "hora_cierre": "12:00"
           },
           ...
        ]
      }
    """
    punto_pago = get_object_or_404(PuntosPago, pk=puntopagoid)
    sucursal = punto_pago.sucursalid
    horarios_existentes = HorarioCaja.objects.filter(puntopagoid=punto_pago)

    if request.method == 'POST':
        # Se asume que viene JSON en request.body:
        try:
            data = json.loads(request.body)
        except ValueError:
            return JsonResponse({'success': False, 'error': 'JSON inválido.'}, status=400)

        sucursal_id = data.get('sucursalid')
        nuevo_puntopago_id = data.get('puntopagoid')
        horarios_list = data.get('horarios', [])

        # Emulamos un POST dict para validaciones básicas
        form_data = {
            'sucursalid': sucursal_id,
            'puntopagoid': nuevo_puntopago_id,
            'dia_semana': '',    # Evitamos error si el form lo requiere
            'horaapertura': '',  # igual
            'horacierre': '',
        }
        form = EditarHorarioCajaForm(data=form_data, horarios_present=bool(horarios_list))
        if form.is_valid():
            try:
                # 1) Borrar los horarios antiguos del puntopago original
                HorarioCaja.objects.filter(puntopagoid=puntopagoid).delete()

                # 2) Actualizar el punto_pago para que apunte a la nueva sucursal/puntopago (si es diferente)
                #    OJO: si vas a permitir cambiar la sucursal del PUNTO DE PAGO en la BD,
                #         necesitarías hacer algo como:
                # punto_pago.sucursalid_id = sucursal_id
                # punto_pago.nombre        = (puedes cambiar si quieres)
                # punto_pago.save()
                #
                # PERO usualmente un PuntosPago no se "mueve" de sucursal, sino que se crea uno nuevo.
                # En todo caso, si solamente actualizas la ForeignKey, se hace así:
                punto_pago.sucursalid_id = sucursal_id
                punto_pago.save(update_fields=['sucursalid'])

                # 3) Insertar los nuevos horarios en LA caja elegida (nuevo_puntopago_id)
                for item in horarios_list:
                    HorarioCaja.objects.create(
                        puntopagoid_id=nuevo_puntopago_id,
                        dia_semana=item['dia'],
                        horaapertura=item['hora_apertura'],
                        horacierre=item['hora_cierre']
                    )

                messages.success(request, f'Horarios de la caja en "{punto_pago.nombre}" editados exitosamente.')
                return JsonResponse({'success': True})
            except Exception as e:
                return JsonResponse({'success': False, 'error': str(e)})
        else:
            errors_json = form.errors.as_json()
            return JsonResponse({'success': False, 'errors': errors_json})
    
    # GET => render
    return render(request, 'editar_horarios_cajas.html', {
        'punto_pago': punto_pago,
        'sucursal': sucursal,
        'horarios': horarios_existentes,
    })


def agregar_cliente(request):
    """
    Vista para agregar un cliente usando AJAX. La validación (número de documento,
    teléfono, nombre, apellido, correo único) se maneja en ClienteForm.
    Devuelve un JSON con success=True o success=False y la lista de errores.
    """
    if request.method == 'POST':
        form = ClienteForm(request.POST)
        if form.is_valid():
            form.save()
            return JsonResponse({'success': True})
        else:
            errors = form.errors.as_json()
            return JsonResponse({'success': False, 'errors': errors})
    else:
        form = ClienteForm()
    
    return render(request, 'agregar_cliente.html', {'form': form})


@login_required
def visualizar_clientes(request):
    clientes = Cliente.objects.all().order_by('nombre')  # Se ordena por nombre (opcional)
    return render(request, 'visualizar_clientes.html', {'clientes': clientes})


@login_required
def eliminar_cliente(request, clienteid):
    cliente = get_object_or_404(Cliente, clienteid=clienteid)
    cliente.delete()
    messages.success(request, 'Cliente eliminado exitosamente.')
    return redirect('visualizar_clientes')


@login_required
def editar_cliente(request, clienteid):
    from django.urls import reverse  # Asegúrate de importar
    cliente = get_object_or_404(Cliente, pk=clienteid)
    
    if request.method == 'POST':
        form = EditarClienteForm(request.POST, instance=cliente)
        if form.is_valid():
            form.save()
            messages.success(
                request,
                f'Cliente con número de documento {cliente.numerodocumento} editado exitosamente.'
            )
            # Retornar JSON con success y URL de redirección
            return JsonResponse({
                'success': True,
                'redirect_url': reverse('visualizar_clientes')
            })
        else:
            # Retornar JSON con errores
            errors = form.errors.as_json()
            return JsonResponse({'success': False, 'errors': errors})
    else:
        form = EditarClienteForm(instance=cliente)
    
    return render(request, 'editar_cliente.html', {'form': form})


@login_required
def generar_venta(request):
    if request.method == 'POST':
        cliente_id = request.POST.get('cliente_id')
        sucursal_id = request.POST.get('sucursal_id')
        puntopago_id = request.POST.get('puntopago_id')
        productos = json.loads(request.POST.get('productos', '[]'))
        cantidades = json.loads(request.POST.get('cantidades', '[]'))
        medio_pago = request.POST.get('medio_pago')

        total = 0
        detalles = []

        try:
            productos_obj = Producto.objects.filter(productoid__in=productos)
            inventarios = Inventario.objects.filter(productoid__in=productos_obj, sucursalid=sucursal_id)

            for i, producto in enumerate(productos_obj):
                inventario = inventarios.get(productoid=producto)
                cantidad = int(cantidades[i])
                if cantidad > inventario.cantidad:
                    return JsonResponse({
                        'success': False,
                        'error': f'No hay suficiente stock de {producto.nombre} en la sucursal seleccionada.'
                    })

                subtotal = producto.precio * cantidad
                total += subtotal
                detalles.append({
                    'producto': producto.nombre,
                    'cantidad': cantidad,
                    'precio_unitario': producto.precio,
                    'subtotal': subtotal,
                    'productoid': producto.productoid
                })

        except Exception:
            return JsonResponse({'success': False, 'error': 'Error al procesar los productos.'})

        # Si el pago es con Nequi, esperar confirmación (a menos que ya se haya confirmado)
        if medio_pago == 'nequi' and not request.POST.get('confirmar_nequi'):
            try:
                script_path = os.path.join(os.path.dirname(__file__), 'nequi_websocket.py')
                result = subprocess.run(['python', script_path], capture_output=True, text=True, timeout=60)
                if 'se pago' not in result.stdout:
                    return JsonResponse({'success': False, 'error': 'El pago no fue confirmado.'})
            except subprocess.TimeoutExpired:
                return JsonResponse({'success': False, 'error': 'El tiempo de espera para la confirmación del pago ha expirado.'})
            except Exception as e:
                return JsonResponse({'success': False, 'error': f'Error en la conexión de WebSocket: {str(e)}'})

        return procesar_venta(request, cliente_id, sucursal_id, puntopago_id, productos, cantidades, medio_pago, detalles, total)

    # GET => mostrar plantilla
    sucursal_id = request.GET.get('sucursal_id')
    puntopago_id = request.GET.get('puntopago_id')
    return render(request, 'generar_venta.html', obtener_contexto(sucursal_id, puntopago_id))


def procesar_venta(request, cliente_id, sucursal_id, puntopago_id, productos, cantidades, medio_pago, detalles, total):
    try:
        with transaction.atomic():
            empleado = getattr(request.user, 'empleado', None)
            if empleado is None:
                # Antes se retornaba 'message'
                return JsonResponse({
                    'success': False,
                    'error': 'El usuario autenticado no tiene un empleado asociado.'
                })

            cliente = Cliente.objects.get(pk=cliente_id) if cliente_id else None
            sucursal = Sucursal.objects.get(pk=sucursal_id)
            puntopago = PuntosPago.objects.get(pk=puntopago_id)

            venta = Venta.objects.create(
                fecha=timezone.now().date(),
                hora=timezone.now().time(),
                clienteid=cliente,
                empleadoid=empleado,
                sucursalid=sucursal,
                puntopagoid=puntopago,
                total=total,
                mediopago=medio_pago
            )

            for detalle in detalles:
                DetalleVenta.objects.create(
                    ventaid=venta,
                    productoid_id=detalle['productoid'],
                    cantidad=detalle['cantidad'],
                    preciounitario=detalle['precio_unitario']
                )
                inventario = Inventario.objects.get(
                    productoid_id=detalle['productoid'],
                    sucursalid=sucursal_id
                )
                inventario.cantidad -= detalle['cantidad']
                inventario.save()

            # Si el medio de pago es efectivo, se incrementa el dinero en caja
            if medio_pago.lower() == 'efectivo':
                puntopago.dinerocaja = (puntopago.dinerocaja or 0) + total
                puntopago.save(update_fields=['dinerocaja'])

        return JsonResponse({'success': True, 'sucursal_id': sucursal_id, 'puntopago_id': puntopago_id})
    except Exception:
        # Antes se retornaba 'message'
        return JsonResponse({'success': False, 'error': 'Error al crear la venta.'})


def obtener_contexto(sucursal_id=None, puntopago_id=None, detalles=[], total=0):
    return {
        'clientes': Cliente.objects.all(),
        'sucursales': Sucursal.objects.all(),
        'puntos_pago': (
            PuntosPago.objects.filter(sucursalid=sucursal_id)
            if sucursal_id else PuntosPago.objects.none()
        ),
        'productos': Producto.objects.all(),
        'detalles': detalles,
        'total': total,
        'selected_sucursal': sucursal_id,
        'selected_puntopago': puntopago_id
    }


@login_required
def verificar_producto(request):
    if request.method == 'POST':
        producto_id = request.POST.get('producto_id')
        cantidad = int(request.POST.get('cantidad'))
        sucursal_id = request.POST.get('sucursal_id')

        try:
            producto = Producto.objects.get(productoid=producto_id)
            inventario = Inventario.objects.get(productoid=producto, sucursalid=sucursal_id)

            if inventario.cantidad >= cantidad:
                precio_unitario = producto.precio
                subtotal = precio_unitario * cantidad
                return JsonResponse({
                    'exists': True,
                    'precio_unitario': precio_unitario,
                    'subtotal': subtotal,
                    'precio_unitario_formatted': "${:,.2f}".format(precio_unitario),
                    'subtotal_formatted': "${:,.2f}".format(subtotal),
                    'cantidad_disponible': inventario.cantidad,
                    'nombre': producto.nombre,
                    'codigo_de_barras': producto.codigo_de_barras
                })
            else:
                return JsonResponse({'exists': True, 'cantidad_disponible': inventario.cantidad})
        except Producto.DoesNotExist:
            return JsonResponse({'exists': False})
    return JsonResponse({'exists': False})


@login_required
def obtener_puntos_pago(request):
    sucursal_id = request.GET.get('sucursal_id')
    puntos_pago = PuntosPago.objects.filter(sucursalid=sucursal_id).values('puntopagoid', 'nombre')
    return JsonResponse({'puntos_pago': list(puntos_pago)})


@login_required
def buscar_productos(request):
    term = request.GET.get('term', '')
    sucursal_id = request.GET.get('sucursal_id')
    try:
        term_as_int = int(term)
        productos = Producto.objects.filter(
            Q(productoid=term_as_int) | Q(nombre__icontains=term) | Q(codigo_de_barras__icontains=term),
            inventario__sucursalid=sucursal_id
        ).values('productoid', 'nombre', 'codigo_de_barras').distinct()
    except ValueError:
        productos = Producto.objects.filter(
            Q(nombre__icontains=term) | Q(codigo_de_barras__icontains=term),
            inventario__sucursalid=sucursal_id
        ).values('productoid', 'nombre', 'codigo_de_barras').distinct()
    
    return JsonResponse({'productos': list(productos)})


@login_required
def buscar_cliente(request):
    term = request.GET.get('term', '')
    clientes = Cliente.objects.filter(
        Q(nombre__icontains=term) | Q(apellido__icontains=term) | Q(numerodocumento__icontains=term)
    )
    clientes_list = list(clientes.values('clienteid', 'nombre', 'apellido'))
    return JsonResponse({'clientes': clientes_list})


@login_required
def buscar_producto_por_codigo(request):
    codigo_de_barras = request.GET.get('codigo_de_barras')
    sucursal_id = request.GET.get('sucursal_id')
    producto = Producto.objects.filter(codigo_de_barras=codigo_de_barras, inventario__sucursalid=sucursal_id).first()
    if producto:
        return JsonResponse({
            'exists': True,
            'producto': {
                'id': producto.productoid,
                'nombre': producto.nombre,
                'codigo_de_barras': producto.codigo_de_barras
            }
        })
    return JsonResponse({'exists': False})


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
def puntopago_autocomplete_venta(request):
    term = request.GET.get('term', '').strip()
    sucursal_id = request.GET.get('sucursal_id', '').strip()
    page_str = request.GET.get('page', '1').strip()
    per_page_str = request.GET.get('per_page', '10').strip()

    try:
        page = int(page_str)
    except ValueError:
        page = 1
    if page < 1:
        page = 1

    try:
        per_page = int(per_page_str)
    except ValueError:
        per_page = 10
    if per_page < 1:
        per_page = 10

    start = (page - 1) * per_page
    end = start + per_page

    qs = PuntosPago.objects.all()
    if sucursal_id:
        qs = qs.filter(sucursalid__sucursalid=sucursal_id)
    if term:
        qs = qs.filter(nombre__icontains=term)
    
    qs = qs.order_by('nombre')
    total_results = qs.count()
    qs = qs[start:end]

    results = [{'id': punto.puntopagoid, 'text': punto.nombre} for punto in qs]
    has_more = end < total_results

    return JsonResponse({'results': results, 'has_more': has_more})  

@login_required
def visualizar_ventas_view(request):
    # Se recuperan las ventas con relaciones para evitar consultas repetidas
    ventas = Venta.objects.select_related(
        'clienteid', 'empleadoid', 'sucursalid', 'puntopagoid'
    ).order_by('-fecha', '-hora')
    return render(request, 'visualizar_ventas.html', {'ventas': ventas})










@login_required
def agregar_pedido_proveedor_view(request):
    """
    Crea un pedido a proveedor.
    Ahora también valida que todos los productos añadidos
    efectivamente los venda el proveedor seleccionado.
    """
    if request.method == "POST":
        form = PedidoProveedorForm(request.POST)
        if form.is_valid():
            proveedor = form.cleaned_data["proveedor"]
            sucursal = form.cleaned_data["sucursal"]
            fechaestimadaentrega = form.cleaned_data.get("fechaestimadaentrega")
            comentario = form.cleaned_data.get("comentario")
            detalles_json = form.cleaned_data["detalles"]

            # Detalles a lista -------------------------------------------------
            try:
                detalles = json.loads(detalles_json)
            except json.JSONDecodeError:
                detalles = []

            if not detalles:
                return JsonResponse(
                    {
                        "success": False,
                        "errors": {
                            "detalles": [
                                {"message": "Debe agregar al menos un producto."}
                            ]
                        },
                    }
                )

            # ---------- Validar compatibilidad de productos ----------
            productos_invalidos = []
            for item in detalles:
                productoid = item.get("productoid")
                if not PreciosProveedor.objects.filter(
                    productoid_id=productoid, proveedorid=proveedor
                ).exists():
                    # Obtener nombre legible si es posible
                    try:
                        nombre = Producto.objects.get(pk=productoid).nombre
                    except Producto.DoesNotExist:
                        nombre = f"ID {productoid}"
                    productos_invalidos.append(nombre)

            if productos_invalidos:
                return JsonResponse(
                    {
                        "success": False,
                        "message": (
                            "El proveedor seleccionado NO vende los siguientes "
                            f"productos: {', '.join(productos_invalidos)}. "
                            "Revise el pedido."
                        ),
                    }
                )

            # Calcular costo total --------------------------------------------
            total_cost = Decimal("0.00")
            for item in detalles:
                cant = Decimal(str(item.get("cantidad", 0)))
                pu = Decimal(str(item.get("precio_unitario", "0.00")))
                total_cost += cant * pu

            # Guardar ----------------------------------------------------------
            try:
                with transaction.atomic():
                    pedido = PedidoProveedor.objects.create(
                        proveedorid=proveedor,
                        sucursalid=sucursal,
                        fechaestimadaentrega=fechaestimadaentrega,
                        costototal=total_cost,
                        comentario=comentario,
                        estado="En espera",
                    )
                    for item in detalles:
                        DetallePedidoProveedor.objects.create(
                            pedidoid=pedido,
                            productoid_id=item["productoid"],
                            cantidad=item["cantidad"],
                            preciounitario=item["precio_unitario"],
                        )
                return JsonResponse(
                    {"success": True, "message": "Pedido guardado exitosamente."}
                )
            except Exception as e:
                return JsonResponse(
                    {
                        "success": False,
                        "message": f"Error al guardar el pedido: {str(e)}",
                    }
                )
        # Form no válido ------------------------------------------------------
        return JsonResponse({"success": False, "errors": form.errors.get_json_data()})
    # GET --------------------------------------------------------------------
    form = PedidoProveedorForm()
    return render(request, "agregar_pedido.html", {"form": form})


@login_required
def producto_pedido_autocomplete(request):
    term = request.GET.get('term', '').strip()
    proveedor_id = request.GET.get('proveedor_id', '').strip()  # Se espera que se envíe este parámetro
    page_str = request.GET.get('page', '1').strip()
    per_page_str = request.GET.get('per_page', '10').strip()

    try:
        page = int(page_str)
    except ValueError:
        page = 1
    if page < 1:
        page = 1

    try:
        per_page = int(per_page_str)
    except ValueError:
        per_page = 10
    if per_page < 1:
        per_page = 10

    start = (page - 1) * per_page
    end = start + per_page

    qs = Producto.objects.all()
    if proveedor_id:
        qs = qs.filter(Exists(
            PreciosProveedor.objects.filter(productoid=OuterRef('pk'), proveedorid=proveedor_id)
        ))
    if term:
        qs = qs.filter(nombre__icontains=term)
    
    qs = qs.order_by('nombre')
    total_results = qs.count()
    qs = qs[start:end]

    results = []
    for prod in qs:
        precio_obj = PreciosProveedor.objects.filter(productoid=prod, proveedorid=proveedor_id).first()
        precio = str(precio_obj.precio) if precio_obj else "0.00"
        results.append({
            'id': prod.productoid,
            'text': prod.nombre,
            'precio': precio
        })
    has_more = end < total_results

    return JsonResponse({'results': results, 'has_more': has_more})

@login_required
def visualizar_pedidos_view(request):
    """
    Lista todos los pedidos, más recientes primero.
    Si llega con ?updated=1 (vuelta desde “Editar Pedido”)
    pasamos la bandera just_updated al template para que muestre
    la alerta de éxito.
    """
    pedidos = PedidoProveedor.objects.all().order_by("-fechapedido")
    just_updated = request.GET.get("updated") == "1"
    return render(
        request,
        "visualizar_pedidos.html",
        {"pedidos": pedidos, "just_updated": just_updated},
    )

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
    
@login_required
def editar_pedido_view(request, pedido_id):
    pedido = get_object_or_404(PedidoProveedor, pk=pedido_id)
    detalles_qs = DetallePedidoProveedor.objects.filter(pedidoid=pedido)
    detalles = []
    for det in detalles_qs:
        detalles.append({
            'detallepedidoid': det.detallepedidoid,
            'productoid': det.productoid.pk,
            'producto': det.productoid.nombre,
            'cantidad': det.cantidad,
            'precio_unitario': float(det.preciounitario),
            'subtotal': float(det.preciounitario) * det.cantidad,
        })
    detalles_json = json.dumps(detalles)

    if request.method == "POST":
        form = PedidoProveedorForm(request.POST)
        if form.is_valid():
            proveedor = form.cleaned_data['proveedor']
            sucursal = form.cleaned_data['sucursal']
            fechaestimadaentrega = form.cleaned_data.get('fechaestimadaentrega')
            comentario = form.cleaned_data.get('comentario')
            detalles_data = form.cleaned_data['detalles']
            try:
                detalles_list = json.loads(detalles_data)
            except json.JSONDecodeError:
                detalles_list = []
            if not detalles_list:
                return JsonResponse({
                    'success': False,
                    'errors': {'detalles': [{'message': 'Debe agregar al menos un producto.'}]}
                })
            # Calcular costo total
            total_cost = sum(Decimal(str(item.get('precio_unitario', '0.00'))) * Decimal(str(item.get('cantidad', 0))) for item in detalles_list)
            try:
                with transaction.atomic():
                    pedido.proveedorid = proveedor
                    pedido.sucursalid = sucursal
                    pedido.fechaestimadaentrega = fechaestimadaentrega
                    pedido.comentario = comentario
                    pedido.costototal = total_cost
                    pedido.save()
                    # Eliminar detalles anteriores y crearlos de nuevo
                    DetallePedidoProveedor.objects.filter(pedidoid=pedido).delete()
                    for item in detalles_list:
                        productoid = item.get('productoid')
                        cantidad = item.get('cantidad')
                        precio_unitario = item.get('precio_unitario')
                        if productoid and cantidad and precio_unitario:
                            DetallePedidoProveedor.objects.create(
                                pedidoid=pedido,
                                productoid_id=productoid,
                                cantidad=cantidad,
                                preciounitario=precio_unitario
                            )
                # Aquí puedes usar el sistema de mensajes de Django para enviar un mensaje de éxito
                # Ejemplo: messages.success(request, "Pedido editado exitosamente.")
                return JsonResponse({'success': True})
            except Exception as e:
                return JsonResponse({'success': False, 'message': 'Error al guardar el pedido.'})
        else:
            errors = form.errors.get_json_data()
            return JsonResponse({'success': False, 'errors': errors})
    else:
        form = PedidoProveedorForm(initial={
            'proveedor': pedido.proveedorid.pk,
            'sucursal': pedido.sucursalid.pk,
            'fechaestimadaentrega': pedido.fechaestimadaentrega,
            'comentario': pedido.comentario,
            'detalles': detalles_json,
        })
    return render(request, 'editar_pedido.html', {'form': form, 'pedido': pedido, 'detalles_json': detalles_json})