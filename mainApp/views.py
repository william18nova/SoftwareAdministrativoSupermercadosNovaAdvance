# views.py
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from .models import Usuario, Sucursal, Categoria, Producto, Inventario, Proveedor, PreciosProveedor, PuntosPago, Rol, Usuario, Empleado, HorariosNegocio, HorarioCaja
from django.db.models import Count, Sum, Exists, OuterRef, Exists, OuterRef
from django.http import JsonResponse
import json

def login(request):
    if request.method == 'POST':
        nombreusuario = request.POST['nombreusuario']
        contraseña = request.POST['contraseña']
        try:
            usuario = Usuario.objects.get(nombreusuario=nombreusuario)
            if usuario.contraseña == contraseña:
                return redirect('home')
            else:
                messages.error(request, 'Contraseña incorrecta')
        except Usuario.DoesNotExist:
            messages.error(request, 'El usuario no existe')
    return render(request, 'login.html')

def homePage_view(request):
    return render(request, 'homePage.html')

def agregar_sucursal_view(request):
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        direccion = request.POST.get('direccion')
        telefono = request.POST.get('telefono')

        if not nombre:
            messages.error(request, 'El Nombre es un campo obligatorio.')
            return render(request, 'agregar_sucursal.html')

        if Sucursal.objects.filter(nombre=nombre).exists():
            messages.error(request, 'El Nombre de la sucursal ya está registrado.')
            return render(request, 'agregar_sucursal.html')

        sucursal = Sucursal(nombre=nombre, direccion=direccion, telefono=telefono)
        sucursal.save()
        messages.success(request, f'Sucursal agregada exitosamente: Nombre={nombre}, Dirección={direccion}, Teléfono={telefono}')
        return redirect('agregar_sucursal')

    return render(request, 'agregar_sucursal.html')

def visualizar_sucursales_view(request):
    sucursales = Sucursal.objects.all()
    return render(request, 'visualizar_sucursales.html', {'sucursales': sucursales})

def eliminar_sucursal(request, sucursal_id):
    sucursal = get_object_or_404(Sucursal, sucursalid=sucursal_id)
    if request.method == 'POST':
        sucursal.delete()
        messages.success(request, 'La sucursal ha sido eliminada exitosamente.')
        return redirect('visualizar_sucursales')
    return render(request, 'visualizar_sucursales.html', {'sucursales': Sucursal.objects.all()})

def editar_sucursal_view(request, sucursal_id):
    sucursal = get_object_or_404(Sucursal, sucursalid=sucursal_id)
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        direccion = request.POST.get('direccion')
        telefono = request.POST.get('telefono')

        if not nombre:
            messages.error(request, 'El Nombre es un campo obligatorio.')
            return render(request, 'editar_sucursal.html', {'sucursal': sucursal})

        if Sucursal.objects.filter(nombre=nombre).exclude(sucursalid=sucursal_id).exists():
            messages.error(request, 'El Nombre de la sucursal ya está registrado.')
            return render(request, 'editar_sucursal.html', {'sucursal': sucursal})

        sucursal.nombre = nombre
        sucursal.direccion = direccion
        sucursal.telefono = telefono
        sucursal.save()
        messages.success(request, f'Sucursal actualizada exitosamente: Nombre={nombre}, Dirección={direccion}, Teléfono={telefono}')
        return redirect('visualizar_sucursales')

    return render(request, 'editar_sucursal.html', {'sucursal': sucursal})

def agregar_categoria_view(request):
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        descripcion = request.POST.get('descripcion', '')

        if not nombre:
            messages.error(request, 'El Nombre es un campo obligatorio.')
            return render(request, 'agregar_categoria.html')

        if Categoria.objects.filter(nombre=nombre).exists():
            messages.error(request, 'El Nombre de la categoría ya está registrado.')
            return render(request, 'agregar_categoria.html')

        categoria = Categoria(nombre=nombre, descripcion=descripcion)
        categoria.save()
        messages.success(request, f'Categoría agregada exitosamente: Nombre={nombre}, Descripción={descripcion}')
        return redirect('agregar_categoria')

    return render(request, 'agregar_categoria.html')

def visualizar_categorias_view(request):
    categorias = Categoria.objects.all()
    return render(request, 'visualizar_categorias.html', {'categorias': categorias})

def eliminar_categoria(request, categoria_id):
    categoria = get_object_or_404(Categoria, categoriaid=categoria_id)
    nombre_categoria = categoria.nombre  # Captura el nombre de la categoría antes de eliminarla
    if request.method == 'POST':
        # Manejar los productos asociados antes de eliminar la categoría
        productos_asociados = Producto.objects.filter(categoria=categoria)
        productos_asociados.update(categoria=None)  # O podrías eliminarlos: productos_asociados.delete()

        categoria.delete()
        messages.success(request, f'La categoría "{nombre_categoria}" ha sido eliminada exitosamente.')
        return redirect('visualizar_categorias')
    return render(request, 'visualizar_categorias.html', {'categorias': Categoria.objects.all()})


def editar_categoria_view(request, categoria_id):
    categoria = get_object_or_404(Categoria, categoriaid=categoria_id)
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        descripcion = request.POST.get('descripcion')

        if not nombre:
            messages.error(request, 'El Nombre es un campo obligatorio.')
            return render(request, 'editar_categoria.html', {'categoria': categoria})

        if Categoria.objects.filter(nombre=nombre).exclude(categoriaid=categoria_id).exists():
            messages.error(request, 'El Nombre de la categoría ya está registrado.')
            return render(request, 'editar_categoria.html', {'categoria': categoria})

        categoria.nombre = nombre
        categoria.descripcion = descripcion
        categoria.save()
        messages.success(request, f'Categoría actualizada exitosamente a "{nombre}".')
        return redirect('visualizar_categorias')

    return render(request, 'editar_categoria.html', {'categoria': categoria})


def agregar_producto_view(request):
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        descripcion = request.POST.get('descripcion')
        precio = request.POST.get('precio')
        categoria_id = request.POST.get('categoria')

        if not nombre:
            messages.error(request, 'El Nombre es un campo obligatorio.')
            return redirect('agregar_producto')

        if Producto.objects.filter(nombre=nombre).exists():
            messages.error(request, 'El Nombre del producto ya está registrado.')
            return redirect('agregar_producto')

        categoria = Categoria.objects.get(pk=categoria_id) if categoria_id else None
        producto = Producto(nombre=nombre, descripcion=descripcion, precio=precio, categoria=categoria)
        producto.save()
        messages.success(request, f'Producto agregado exitosamente: Nombre={nombre}, Descripción={descripcion}, Precio={precio}, Categoría={categoria.nombre if categoria else "Sin categoría"}')
        return redirect('agregar_producto')

    categorias = Categoria.objects.all()
    return render(request, 'agregar_producto.html', {'categorias': categorias})


def visualizar_productos_view(request):
    productos = Producto.objects.all()
    return render(request, 'visualizar_productos.html', {'productos': productos})


def eliminar_producto(request, producto_id):
    producto = get_object_or_404(Producto, productoid=producto_id)
    if request.method == 'POST':
        nombre_producto = producto.nombre
        producto.delete()
        messages.success(request, f'El producto "{nombre_producto}" ha sido eliminado exitosamente.')
        return redirect('visualizar_productos')
    return render(request, 'visualizar_productos.html', {'productos': Producto.objects.all()})

def editar_producto_view(request, producto_id):
    producto = get_object_or_404(Producto, productoid=producto_id)
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        descripcion = request.POST.get('descripcion')
        precio = request.POST.get('precio')
        categoria_id = request.POST.get('categoria')

        if not nombre:
            messages.error(request, 'El Nombre es un campo obligatorio.')
            return render(request, 'editar_producto.html', {'producto': producto, 'categorias': Categoria.objects.all()})

        if Producto.objects.filter(nombre=nombre).exclude(productoid=producto_id).exists():
            messages.error(request, 'El Nombre del producto ya está registrado.')
            return render(request, 'editar_producto.html', {'producto': producto, 'categorias': Categoria.objects.all()})

        producto.nombre = nombre
        producto.descripcion = descripcion
        producto.precio = precio
        producto.categoria_id = categoria_id if categoria_id else None
        producto.save()
        messages.success(request, f'Producto actualizado exitosamente: Nombre={nombre}, Descripción={descripcion}, Precio={precio}, Categoría={producto.categoria.nombre if producto.categoria else "Sin categoría"}')
        return redirect('visualizar_productos')

    return render(request, 'editar_producto.html', {'producto': producto, 'categorias': Categoria.objects.all()})

def agregar_inventario_view(request):
    if request.method == 'POST':
        sucursal_id = request.POST.get('sucursal')
        sucursal = get_object_or_404(Sucursal, pk=sucursal_id)

        productos = request.POST.getlist('producto[]')
        cantidades = request.POST.getlist('cantidad[]')

        for producto_id, cantidad in zip(productos, cantidades):
            producto = get_object_or_404(Producto, pk=producto_id)
            Inventario.objects.create(
                productoid=producto,
                sucursalid=sucursal,
                cantidad=int(cantidad)
            )

        messages.success(request, 'Inventario creado exitosamente')
        return redirect('agregar_inventario')

    sucursales_sin_inventario = Sucursal.objects.annotate(inventarios_count=Count('inventario')).filter(inventarios_count=0)
    productos = Producto.objects.all()

    if not sucursales_sin_inventario.exists():
        messages.error(request, 'Todas las sucursales ya tienen inventario. Debe ir a visualizar inventario para modificarlas o ir a agregar sucursales para añadir nuevas sucursales.')

    if not productos.exists():
        messages.error(request, 'No hay productos en el sistema. Debe ir a agregar productos para añadir productos al sistema y generar un inventario.')

    return render(request, 'agregar_inventario.html', {'sucursales': sucursales_sin_inventario, 'productos': productos})

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
        inventario_global_data = Inventario.objects.values('productoid__nombre').annotate(total_cantidad=Sum('cantidad'))

    context = {
        'sucursales': sucursales_con_inventario,
        'inventarios': inventarios,
        'inventario_global': inventario_global,
        'inventario_global_data': inventario_global_data,
        'sucursal_seleccionada': sucursal_seleccionada if sucursal_id and sucursal_id != "global" else None,
    }
    return render(request, 'visualizar_inventarios.html', context)


def editar_inventario_view(request, sucursal_id):
    sucursal = get_object_or_404(Sucursal, pk=sucursal_id)
    inventarios = Inventario.objects.filter(sucursalid=sucursal)
    productos = Producto.objects.exclude(inventario__sucursalid=sucursal)

    if request.method == 'POST':
        for inventario in inventarios:
            cantidad = request.POST.get(f'cantidad_{inventario.inventarioid}')
            if cantidad:
                inventario.cantidad = cantidad
                inventario.save()

        nuevos_productos = request.POST.getlist('nuevo_producto[]')
        nuevas_cantidades = request.POST.getlist('nueva_cantidad[]')
        for producto_id, cantidad in zip(nuevos_productos, nuevas_cantidades):
            producto = get_object_or_404(Producto, pk=producto_id)
            Inventario.objects.create(
                productoid=producto,
                sucursalid=sucursal,
                cantidad=cantidad
            )

        messages.success(request, f'Inventario de la sucursal {sucursal.nombre} actualizado exitosamente.')
        return redirect('visualizar_inventarios')

    return render(request, 'editar_inventario.html', {
        'sucursal': sucursal,
        'inventarios': inventarios,
        'productos': productos,
    })

def eliminar_producto_inventario_view(request, inventario_id):
    if request.method == 'POST':
        inventario = get_object_or_404(Inventario, pk=inventario_id)
        producto_nombre = inventario.productoid.nombre
        inventario.delete()
        return JsonResponse({'success': True, 'message': f'Producto "{producto_nombre}" eliminado exitosamente.', 'producto_nombre': producto_nombre})
    return JsonResponse({'success': False, 'message': 'Método no permitido.'}, status=405)

def agregar_proveedor_view(request):
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        empresa = request.POST.get('empresa')
        telefono = request.POST.get('telefono')
        email = request.POST.get('email')
        direccion = request.POST.get('direccion')

        if Proveedor.objects.filter(nombre=nombre).exists():
            messages.error(request, 'Ya existe un proveedor con este nombre.')
            return render(request, 'agregar_proveedor.html')

        proveedor = Proveedor(nombre=nombre, empresa=empresa, telefono=telefono, email=email, direccion=direccion)
        proveedor.save()
        messages.success(request, 'Proveedor agregado exitosamente.')
        return redirect('agregar_proveedor')

    return render(request, 'agregar_proveedor.html')

def visualizar_proveedores_view(request):
    proveedores = Proveedor.objects.all()
    return render(request, 'visualizar_proveedores.html', {'proveedores': proveedores})

def eliminar_proveedor(request, proveedor_id):
    proveedor = get_object_or_404(Proveedor, proveedorid=proveedor_id)
    if request.method == 'POST':
        proveedor.delete()
        messages.success(request, 'El proveedor ha sido eliminado exitosamente.')
        return redirect('visualizar_proveedores')
    return render(request, 'visualizar_proveedores.html', {'proveedores': Proveedor.objects.all()})

def editar_proveedor_view(request, proveedor_id):
    proveedor = get_object_or_404(Proveedor, pk=proveedor_id)
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        empresa = request.POST.get('empresa')
        telefono = request.POST.get('telefono')
        email = request.POST.get('email')
        direccion = request.POST.get('direccion')

        # Validar campos vacíos
        if not nombre or not empresa or not telefono or not email or not direccion:
            messages.error(request, 'Todos los campos son obligatorios.')
        elif Proveedor.objects.exclude(pk=proveedor_id).filter(nombre=nombre).exists():
            messages.error(request, 'Ya existe un proveedor con ese nombre.')
        else:
            proveedor.nombre = nombre
            proveedor.empresa = empresa
            proveedor.telefono = telefono
            proveedor.email = email
            proveedor.direccion = direccion
            proveedor.save()
            messages.success(request, 'El proveedor ha sido actualizado exitosamente.')
            return redirect('visualizar_proveedores')

    return render(request, 'editar_proveedor.html', {'proveedor': proveedor})

def agregar_productos_precios_proveedor_view(request):
    if request.method == 'POST':
        proveedor_id = request.POST.get('proveedor')
        productos = request.POST.getlist('producto[]')
        precios = request.POST.getlist('precio[]')

        proveedor = get_object_or_404(Proveedor, pk=proveedor_id)

        for producto_id, precio in zip(productos, precios):
            if producto_id and precio:  # Asegúrate de que producto_id y precio no estén vacíos
                producto = get_object_or_404(Producto, pk=producto_id)
                if PreciosProveedor.objects.filter(productoid=producto, proveedorid=proveedor).exists():
                    messages.error(request, f'El producto {producto.nombre} ya está registrado para el proveedor {proveedor.nombre}.')
                    continue
                PreciosProveedor.objects.create(productoid=producto, proveedorid=proveedor, precio=precio)

        messages.success(request, 'Productos y precios agregados exitosamente al proveedor.')
        return redirect('agregar_productos_precios_proveedor')

    # Filtrar proveedores que no tienen productos asociados
    proveedores_con_productos = PreciosProveedor.objects.filter(proveedorid=OuterRef('pk'))
    proveedores = Proveedor.objects.annotate(tiene_productos=Exists(proveedores_con_productos)).filter(tiene_productos=False)
    
    productos = Producto.objects.all()
    return render(request, 'agregar_productos_precios_proveedor.html', {'proveedores': proveedores, 'productos': productos})

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


def eliminar_precio_proveedor_view(request, id):
    if request.method == 'POST':
        precio_proveedor = get_object_or_404(PreciosProveedor, pk=id)
        nombre_producto = precio_proveedor.productoid.nombre
        precio_proveedor.delete()
        return JsonResponse({'success': True, 'message': f'Producto "{nombre_producto}" eliminado correctamente.'})
    return JsonResponse({'success': False, 'message': 'Error al eliminar el producto.'})

def editar_productos_precios_proveedor_view(request, proveedor_id):
    proveedor = get_object_or_404(Proveedor, pk=proveedor_id)
    productos_precios = PreciosProveedor.objects.filter(proveedorid=proveedor)
    productos_existentes = list(productos_precios.values_list('productoid', flat=True))
    productos = Producto.objects.all()

    if request.method == 'POST':
        nuevos_productos_ids = request.POST.getlist('producto[]')
        nuevos_precios = request.POST.getlist('precio[]')

        # Filtrar los valores vacíos
        nuevos_productos_ids = [pid for pid in nuevos_productos_ids if pid]
        nuevos_precios = [precio for precio in nuevos_precios if precio]

        # Eliminar productos no incluidos en la nueva lista
        PreciosProveedor.objects.filter(proveedorid=proveedor).exclude(productoid__in=nuevos_productos_ids).delete()

        for producto_id, precio in zip(nuevos_productos_ids, nuevos_precios):
            if producto_id and precio:
                producto = get_object_or_404(Producto, pk=producto_id)
                precios_proveedor, created = PreciosProveedor.objects.update_or_create(
                    productoid=producto, proveedorid=proveedor,
                    defaults={'precio': precio}
                )

        messages.success(request, 'Productos y precios actualizados exitosamente para el proveedor.')
        return redirect('visualizar_productos_precios_proveedores')

    return render(request, 'editar_productos_precios_proveedor.html', {
        'proveedor': proveedor,
        'productos_precios': productos_precios,
        'productos': productos,
        'productos_existentes': productos_existentes,
    })

def agregar_punto_pago_view(request):
    if request.method == 'POST':
        sucursal_id = request.POST.get('sucursal')
        nombres = request.POST.getlist('nombre[]')
        descripciones = request.POST.getlist('descripcion[]')

        if not sucursal_id:
            messages.error(request, 'La sucursal es obligatoria.')
            return redirect('agregar_punto_pago')

        if not nombres:
            messages.error(request, 'Debe agregar al menos un punto de pago.')
            return redirect('agregar_punto_pago')

        sucursal = Sucursal.objects.get(sucursalid=sucursal_id)

        for nombre, descripcion in zip(nombres, descripciones):
            if nombre:
                if PuntosPago.objects.filter(sucursalid=sucursal, nombre=nombre).exists():
                    messages.error(request, f'La sucursal ya tiene un punto de pago con el nombre {nombre}.')
                    return redirect('agregar_punto_pago')
                
                punto_pago = PuntosPago(sucursalid=sucursal, nombre=nombre, descripcion=descripcion or "")
                punto_pago.save()

        messages.success(request, 'Puntos de pago agregados exitosamente.')
        return redirect('agregar_punto_pago')

    # Obtener todas las sucursales que no tienen puntos de pago asociados
    sucursales_sin_punto_pago = Sucursal.objects.exclude(puntospago__isnull=False)
    return render(request, 'agregar_punto_pago.html', {'sucursales': sucursales_sin_punto_pago})

def visualizar_puntos_pago_view(request):
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

def eliminar_punto_pago_view(request, puntopagoid):
    if request.method == 'POST':
        try:
            punto_pago = get_object_or_404(PuntosPago, pk=puntopagoid)
            nombre_punto = punto_pago.nombre
            punto_pago.delete()
            return JsonResponse({'success': True, 'message': f'Punto de pago "{nombre_punto}" eliminado correctamente.'})
        except Exception as e:
            return JsonResponse({'success': False, 'message': f'Error al eliminar el punto de pago: {str(e)}'})
    return JsonResponse({'success': False, 'message': 'Método no permitido.'})


def editar_puntos_pago_view(request, sucursal_id):
    sucursal = get_object_or_404(Sucursal, pk=sucursal_id)
    puntos_pago = PuntosPago.objects.filter(sucursalid=sucursal_id)

    if request.method == 'POST':
        nuevos_nombres = request.POST.getlist('nombre[]')
        nuevas_descripciones = request.POST.getlist('descripcion[]')

        # Filtrar los valores vacíos
        nuevos_nombres = [nombre for nombre in nuevos_nombres if nombre]
        nuevas_descripciones = [descripcion for descripcion in nuevas_descripciones]

        # Eliminar puntos de pago no incluidos en la nueva lista
        PuntosPago.objects.filter(sucursalid=sucursal_id).exclude(nombre__in=nuevos_nombres).delete()

        for nombre, descripcion in zip(nuevos_nombres, nuevas_descripciones):
            if nombre:
                punto_pago, created = PuntosPago.objects.update_or_create(
                    nombre=nombre, sucursalid=sucursal,
                    defaults={'descripcion': descripcion}
                )

        messages.success(request, f'Puntos de pago de la sucursal {sucursal.nombre} actualizados exitosamente.')
        return redirect('visualizar_puntos_pago')

    return render(request, 'editar_puntos_pago.html', {
        'sucursal': sucursal,
        'puntos_pago': puntos_pago,
    })

def agregar_rol_view(request):
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        descripcion = request.POST.get('descripcion')

        if nombre:
            if Rol.objects.filter(nombre=nombre).exists():
                messages.error(request, 'Ya existe un rol con ese nombre.')
            else:
                Rol.objects.create(nombre=nombre, descripcion=descripcion)
                messages.success(request, 'Rol agregado exitosamente.')
                return redirect('agregar_rol')
        else:
            messages.error(request, 'El nombre del rol es obligatorio.')

    return render(request, 'agregar_rol.html')

def visualizar_roles_view(request):
    roles = Rol.objects.all()
    return render(request, 'visualizar_roles.html', {'roles': roles})

def editar_rol_view(request, rol_id):
    rol = get_object_or_404(Rol, pk=rol_id)
    
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        descripcion = request.POST.get('descripcion')
        
        if nombre and nombre != rol.nombre:
            # Verifica si el nombre ya existe
            if Rol.objects.filter(nombre=nombre).exclude(pk=rol_id).exists():
                messages.error(request, 'Ya existe un rol con ese nombre.')
                return redirect('editar_rol', rol_id=rol_id)
        
        rol.nombre = nombre
        rol.descripcion = descripcion
        rol.save()
        
        messages.success(request, f'Rol "{rol.nombre}" actualizado correctamente.')
        return redirect('visualizar_roles')
    
    return render(request, 'editar_rol.html', {'rol': rol})

def eliminar_rol_view(request, rol_id):
    if request.method == 'POST':
        rol = get_object_or_404(Rol, pk=rol_id)
        nombre_rol = rol.nombre
        rol.delete()
        messages.success(request, f'Se eliminó el rol "{nombre_rol}" correctamente.')
        return redirect('visualizar_roles')
    return JsonResponse({'success': False, 'message': 'Error al eliminar el rol.'})

def agregar_usuario_view(request):
    roles = Rol.objects.all()

    if request.method == 'POST':
        nombreusuario = request.POST['nombreusuario']
        contraseña = request.POST['contraseña']
        confirmar_contraseña = request.POST['confirmar_contraseña']
        rol_id = request.POST['rolid']

        if contraseña != confirmar_contraseña:
            messages.error(request, 'Las contraseñas no coinciden.')
        elif Usuario.objects.filter(nombreusuario=nombreusuario).exists():
            messages.error(request, f'El nombre de usuario "{nombreusuario}" ya existe.')
        else:
            rol = Rol.objects.get(pk=rol_id)
            Usuario.objects.create(nombreusuario=nombreusuario, contraseña=contraseña, rolid=rol)
            messages.success(request, f'Usuario "{nombreusuario}" creado exitosamente.')

    return render(request, 'agregar_usuario.html', {'roles': roles})

def visualizar_usuarios_view(request):
    usuarios = Usuario.objects.all()
    return render(request, 'visualizar_usuarios.html', {'usuarios': usuarios})

def editar_usuario_view(request, usuarioid):
    usuario = get_object_or_404(Usuario, pk=usuarioid)
    roles = Rol.objects.all()

    if request.method == 'POST':
        usuario.nombreusuario = request.POST['nombreusuario']
        contraseña = request.POST['contraseña']
        confirmar_contraseña = request.POST['confirmar_contraseña']
        usuario.rolid = Rol.objects.get(pk=request.POST['rolid'])

        if contraseña:
            if contraseña == confirmar_contraseña:
                usuario.contraseña = contraseña
            else:
                messages.error(request, 'Las contraseñas no coinciden.')
                return redirect('editar_usuario', usuarioid=usuarioid)

        usuario.save()
        messages.success(request, 'Usuario actualizado exitosamente.')
        return redirect('visualizar_usuarios')

    return render(request, 'editar_usuario.html', {'usuario': usuario, 'roles': roles})

def eliminar_usuario_view(request, usuarioid):
    usuario = get_object_or_404(Usuario, pk=usuarioid)
    nombre_usuario = usuario.nombreusuario
    usuario.delete()
    messages.success(request, f'Usuario "{nombre_usuario}" eliminado exitosamente.')
    return redirect('visualizar_usuarios')

def editar_usuario_view(request, usuarioid):
    usuario = get_object_or_404(Usuario, pk=usuarioid)
    roles = Rol.objects.all()

    if request.method == 'POST':
        nombreusuario = request.POST['nombreusuario']
        contraseña = request.POST['contraseña']
        confirmar_contraseña = request.POST['confirmar_contraseña']
        rol_id = request.POST['rolid']

        # Verificar si el nombre de usuario ya existe para otro usuario
        if Usuario.objects.filter(nombreusuario=nombreusuario).exclude(pk=usuarioid).exists():
            messages.error(request, 'El nombre de usuario "{}" ya existe.'.format(nombreusuario))
        elif contraseña != confirmar_contraseña:
            messages.error(request, 'Las contraseñas no coinciden.')
        else:
            usuario.nombreusuario = nombreusuario
            if contraseña:
                usuario.contraseña = contraseña
            usuario.rolid_id = rol_id
            usuario.save()
            messages.success(request, 'Usuario "{}" actualizado exitosamente.'.format(nombreusuario))
            return redirect('visualizar_usuarios')

    return render(request, 'editar_usuario.html', {'usuario': usuario, 'roles': roles})

def agregar_empleado_view(request):
    usuarios = Usuario.objects.exclude(usuarioid__in=Empleado.objects.values('usuarioid'))
    sucursales = Sucursal.objects.all()

    if request.method == 'POST':
        nombre = request.POST['nombre']
        apellido = request.POST['apellido']
        telefono = request.POST['telefono']
        email = request.POST['email']
        direccion = request.POST['direccion']
        puesto = request.POST['puesto']
        numerodocumento = request.POST['numerodocumento']
        usuarioid = request.POST.get('usuario')
        sucursalid = request.POST.get('sucursal')

        if Empleado.objects.filter(telefono=telefono).exists():
            messages.error(request, 'El teléfono ya está en uso.')
        elif Empleado.objects.filter(email=email).exists():
            messages.error(request, 'El correo ya está en uso.')
        elif Empleado.objects.filter(numerodocumento=numerodocumento).exists():
            messages.error(request, 'El número de documento ya está en uso.')
        else:
            usuario = Usuario.objects.get(pk=usuarioid) if usuarioid else None
            sucursal = Sucursal.objects.get(pk=sucursalid) if sucursalid else None
            Empleado.objects.create(
                nombre=nombre,
                apellido=apellido,
                telefono=telefono,
                email=email,
                direccion=direccion,
                puesto=puesto,
                numerodocumento=numerodocumento,
                usuarioid=usuario,
                sucursalid=sucursal
            )
            messages.success(request, f'Empleado "{nombre} {apellido}" creado exitosamente.')

    return render(request, 'agregar_empleado.html', {'usuarios': usuarios, 'sucursales': sucursales})



def visualizar_empleados_view(request):
    empleados = Empleado.objects.all()
    return render(request, 'visualizar_empleados.html', {'empleados': empleados})

def editar_empleado_view(request, empleadoid):
    empleado = get_object_or_404(Empleado, pk=empleadoid)
    usuarios = Usuario.objects.exclude(usuarioid__in=Empleado.objects.values('usuarioid')).union(Usuario.objects.filter(pk=empleado.usuarioid_id))
    sucursales = Sucursal.objects.all()

    if request.method == 'POST':
        nombre = request.POST['nombre']
        apellido = request.POST['apellido']
        telefono = request.POST['telefono']
        email = request.POST['email']
        direccion = request.POST['direccion']
        puesto = request.POST['puesto']
        numerodocumento = request.POST['numerodocumento']
        sucursal_id = request.POST['sucursal']

        if Empleado.objects.filter(telefono=telefono).exclude(pk=empleadoid).exists():
            messages.error(request, 'El teléfono ya está en uso.')
        elif Empleado.objects.filter(email=email).exclude(pk=empleadoid).exists():
            messages.error(request, 'El correo ya está en uso.')
        elif numerodocumento and Empleado.objects.filter(numerodocumento=numerodocumento).exclude(pk=empleadoid).exists():
            messages.error(request, 'El número de documento ya está en uso.')
        else:
            if numerodocumento:
                empleado.numerodocumento = numerodocumento
            empleado.nombre = nombre
            empleado.apellido = apellido
            empleado.telefono = telefono
            empleado.email = email
            empleado.direccion = direccion
            empleado.puesto = puesto
            empleado.sucursalid_id = sucursal_id
            empleado.save()
            messages.success(request, f'Empleado "{nombre} {apellido}" editado exitosamente.')
            return redirect('visualizar_empleados')

    return render(request, 'editar_empleado.html', {'empleado': empleado, 'usuarios': usuarios, 'sucursales': sucursales})

def eliminar_empleado_view(request, empleado_id):
    empleado = get_object_or_404(Empleado, pk=empleado_id)
    nombre_completo = f"{empleado.nombre} {empleado.apellido}"
    empleado.delete()
    messages.success(request, f'Empleado "{nombre_completo}" ha sido eliminado exitosamente.')
    return redirect('visualizar_empleados')

def agregar_horario_view(request):
    sucursales = Sucursal.objects.exclude(horariosnegocio__isnull=False)

    if request.method == 'POST':
        sucursalid = request.POST.get('sucursalid')
        horarios_temp = request.POST.get('horarios_temp')

        if horarios_temp:
            horarios = json.loads(horarios_temp)
            for horario in horarios:
                dia, hora_apertura, hora_cierre = horario['dia'], horario['apertura'], horario['cierre']
                HorariosNegocio.objects.create(
                    sucursalid=Sucursal.objects.get(pk=sucursalid),
                    dia_semana=dia,
                    horaapertura=hora_apertura,
                    horacierre=hora_cierre
                )

            messages.success(request, 'Horarios agregados exitosamente.')
            return redirect('agregar_horario')
        else:
            messages.error(request, 'Debe agregar al menos un horario.')

    return render(request, 'agregar_horario.html', {'sucursales': sucursales})

def visualizar_horarios_view(request):
    # Filtrar solo las sucursales que tienen horarios asignados
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

def editar_horarios_view(request, sucursal_id):
    sucursal = get_object_or_404(Sucursal, pk=sucursal_id)
    horarios = HorariosNegocio.objects.filter(sucursalid=sucursal)

    if request.method == 'POST':
        dia_semana = request.POST.get('dia_semana')
        horaapertura = request.POST.get('horaapertura')
        horacierre = request.POST.get('horacierre')
        horarios_json = request.POST.get('horarios')

        if horarios_json:
            horarios_data = json.loads(horarios_json)
            for horario_data in horarios_data:
                HorariosNegocio.objects.update_or_create(
                    horarioid=horario_data.get('id'),
                    defaults={
                        'dia_semana': horario_data['dia'],
                        'horaapertura': horario_data['horaapertura'],
                        'horacierre': horario_data['horacierre'],
                        'sucursalid': sucursal,
                    }
                )

        deleted_horarios_list = request.POST.getlist('deleted_horarios')
        if deleted_horarios_list:
            # Filtrar IDs válidos (números) en la lista
            valid_deleted_ids = [int(id) for id in deleted_horarios_list if id.isdigit()]
            if valid_deleted_ids:
                HorariosNegocio.objects.filter(horarioid__in=valid_deleted_ids).delete()

        messages.success(request, f'Horarios de la sucursal {sucursal.nombre} actualizados correctamente.')
        return redirect('visualizar_horarios')

    return render(request, 'editar_horario.html', {'sucursal': sucursal, 'horarios': horarios})

def eliminar_horario_view(request, horario_id):
    if request.method == 'POST':
        horario = get_object_or_404(HorariosNegocio, pk=horario_id)
        horario.delete()
        return JsonResponse({'success': True, 'message': 'Horario eliminado exitosamente.'})
    return JsonResponse({'success': False, 'message': 'Método no permitido.'})

from django.db.models import OuterRef, Subquery

def agregar_horario_caja_view(request):
    # Subconsulta para obtener puntos de pago con horarios asignados
    puntos_con_horario = HorarioCaja.objects.filter(puntopagoid=OuterRef('pk'))

    # Filtrar las sucursales que tienen al menos un punto de pago sin horario asignado
    sucursales = Sucursal.objects.annotate(
        tiene_puntos_sin_horario=Exists(
            PuntosPago.objects.filter(
                sucursalid=OuterRef('pk')
            ).exclude(Exists(puntos_con_horario))
        )
    ).filter(tiene_puntos_sin_horario=True).distinct()

    if request.method == 'POST':
        sucursal_id = request.POST.get('sucursal')
        puntopago_id = request.POST.get('punto_pago')
        horarios = request.POST.get('horarios')

        if not (sucursal_id and puntopago_id and horarios):
            messages.error(request, 'Todos los campos son requeridos.')
            return redirect('agregar_horario_caja')

        horarios = json.loads(horarios)
        for horario in horarios:
            HorarioCaja.objects.create(
                puntopagoid=puntopago_id,
                dia_semana=horario['dia'],
                horaapertura=horario['horaapertura'],
                horacierre=horario['horacierre']
            )
        messages.success(request, 'Horario de caja agregado exitosamente.')
        return redirect('agregar_horario_caja')

    return render(request, 'agregar_horario_caja.html', {
        'sucursales': sucursales,
    })

def obtener_puntos_pago(request):
    sucursal_id = request.GET.get('sucursal_id')
    puntos_pago = PuntosPago.objects.filter(sucursalid=sucursal_id).exclude(
        puntopagoid__in=HorarioCaja.objects.values_list('puntopagoid', flat=True)
    )
    opciones = []
    for punto_pago in puntos_pago:
        opciones.append(f'<option value="{punto_pago.puntopagoid}">{punto_pago.nombre}</option>')
    return JsonResponse(opciones, safe=False)

def visualizar_horarios_cajas_view(request):
    # Filtrar sucursales que tienen puntos de pago con horarios definidos
    puntos_con_horario = HorarioCaja.objects.filter(puntopagoid=OuterRef('pk')).values('puntopagoid')
    sucursales = Sucursal.objects.filter(
        Exists(
            PuntosPago.objects.filter(
                sucursalid=OuterRef('pk')
            ).filter(Exists(puntos_con_horario))
        )
    ).distinct()

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
        'horarios': horarios
    })

def eliminar_horario_caja_view(request, horario_id):
    try:
        horario = get_object_or_404(HorarioCaja, pk=horario_id)
        horario.delete()
        return JsonResponse({'success': True, 'message': 'Horario eliminado exitosamente.'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': 'Ocurrió un error al eliminar el horario.'})

def obtener_puntos_pago_con_horarios(request):
    sucursal_id = request.GET.get('sucursal_id')
    puntos_con_horario = HorarioCaja.objects.filter(puntopagoid=OuterRef('pk')).values('puntopagoid')
    puntos_pago = PuntosPago.objects.filter(sucursalid=sucursal_id).filter(Exists(puntos_con_horario))
    opciones = ['<option value="">Seleccionar punto de pago</option>']
    for punto_pago in puntos_pago:
        opciones.append(f'<option value="{punto_pago.puntopagoid}">{punto_pago.nombre}</option>')
    return JsonResponse(opciones, safe=False)

def editar_horarios_cajas_view(request, puntopagoid):
    return render(request, 'editar_horarios_cajas.html', {
        'mensaje': 'Esta es la vista para editar los horarios de la caja con ID: {}'.format(puntopagoid)
    })