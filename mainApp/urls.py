from django.urls import path
from . import views

urlpatterns = [
    path('', views.login, name='login'),
    path('home/', views.homePage_view, name='home'),
    path('agregar_sucursal/', views.agregar_sucursal_view, name='agregar_sucursal'),
    path('visualizar_sucursales/', views.visualizar_sucursales_view, name='visualizar_sucursales'),
    path('sucursales/eliminar/<int:sucursal_id>/', views.eliminar_sucursal, name='eliminar_sucursal'),
    path('sucursales/editar/<int:sucursal_id>/', views.editar_sucursal_view, name='editar_sucursal'),

    path('agregar_categoria/', views.agregar_categoria_view, name='agregar_categoria'),
    path('visualizar_categorias/', views.visualizar_categorias_view, name='visualizar_categorias'),
    path('categorias/eliminar/<int:categoria_id>/', views.eliminar_categoria, name='eliminar_categoria'),
    path('categorias/editar/<int:categoria_id>/', views.editar_categoria_view, name='editar_categoria'),
    
    path('agregar_producto/', views.agregar_producto_view, name='agregar_producto'),
    path('categoria_autocomplete/', views.categoria_autocomplete, name='categoria_autocomplete'),
    path('visualizar_productos/', views.visualizar_productos_view, name='visualizar_productos'),
    path('productos/eliminar/<int:producto_id>/', views.eliminar_producto, name='eliminar_producto'),
    path('productos/editar/<int:producto_id>/', views.editar_producto_view, name='editar_producto'),
    
    path('agregar_inventario/', views.agregar_inventario_view, name='agregar_inventario'),
    # Ruta para autocompletar Sucursales sin Inventario
    path('autocomplete/sucursal_inventario/', views.sucursal_inventario_autocomplete, name='sucursal_inventario_autocomplete'),
    # Ruta para autocompletar Productos (por ejemplo)
    path('autocomplete/producto_inventario/', views.producto_inventario_autocomplete, name='producto_inventario_autocomplete'),
    path('visualizar_inventarios/', views.visualizar_inventarios_view, name='visualizar_inventarios'),
    path('autocomplete/sucursal_con_inventario/', views.sucursal_con_inventario_autocomplete, name='sucursal_con_inventario_autocomplete'),
    path('editar_inventario/<int:sucursal_id>/', views.editar_inventario_view, name='editar_inventario'),
    path('autocomplete/sucursal_inventario_editar/', views.sucursal_inventario_autocomplete_editar, name='sucursal_inventario_autocomplete_editar'),
    path('autocomplete/producto_inventario_editar/', views.producto_inventario_autocomplete_editar, name='producto_inventario_autocomplete_editar'),
    path('inventario/eliminar/<int:inventario_id>/', views.eliminar_producto_inventario_view, name='eliminar_producto_inventario'),
    
    path('agregar_proveedor/', views.agregar_proveedor_view, name='agregar_proveedor'),
    path('visualizar_proveedores/', views.visualizar_proveedores_view, name='visualizar_proveedores'),
    path('eliminar_proveedor/<int:proveedor_id>/', views.eliminar_proveedor, name='eliminar_proveedor'),
    path('editar_proveedor/<int:proveedor_id>/', views.editar_proveedor_view, name='editar_proveedor'),
    
    
    path('agregar_productos_precios_proveedor/', views.agregar_productos_precios_proveedor_view, name='agregar_productos_precios_proveedor'),
    path('autocomplete/proveedor/', views.proveedor_precios_autocomplete, name='proveedor_precios_autocomplete'),
    path('autocomplete/producto/', views.producto_precios_autocomplete, name='producto_precios_autocomplete'),
    path('visualizar_productos_precios_proveedores/', views.visualizar_productos_precios_proveedores_view, name='visualizar_productos_precios_proveedores'),
    path('autocomplete/proveedor_con_productos/', views.proveedor_con_productos_autocomplete, name='proveedor_con_productos_autocomplete'),
    path('precios_proveedor/eliminar/<int:id>/', views.eliminar_precio_proveedor_view, name='eliminar_precio_proveedor'),
    path('editar_productos_precios_proveedor/<int:proveedor_id>/', views.editar_productos_precios_proveedor_view, name='editar_productos_precios_proveedor'),

    path('agregar_punto_pago/', views.agregar_punto_pago_view, name='agregar_punto_pago'),
    path('sucursal_punto_pago_autocomplete/', views.sucursal_punto_pago_autocomplete, name='sucursal_punto_pago_autocomplete'),
    path('visualizar_puntos_pago/', views.visualizar_puntos_pago_view, name='visualizar_puntos_pago'),
    path('editar-puntos-pago/<int:sucursal_id>/', views.editar_puntos_pago_view, name='editar_puntos_pago'),
    path('sucursal_editar_punto_pago_autocomplete/', views.sucursal_editar_punto_pago_autocomplete, name='sucursal_editar_punto_pago_autocomplete'),
    path('eliminar-punto-pago/<int:puntopagoid>/', views.eliminar_punto_pago_view, name='eliminar_punto_pago'),

    path('agregar_rol/', views.agregar_rol_view, name='agregar_rol'),
    path('visualizar_roles/', views.visualizar_roles_view, name='visualizar_roles'),
    path('editar_rol/<int:rol_id>/', views.editar_rol_view, name='editar_rol'),
    path('eliminar_rol/<int:rol_id>/', views.eliminar_rol_view, name='eliminar_rol'),

    path('agregar_usuario/', views.agregar_usuario_view, name='agregar_usuario'),
    path('rol_autocomplete/', views.rol_autocomplete, name='rol_autocomplete'),
    path('visualizar_usuarios/', views.visualizar_usuarios_view, name='visualizar_usuarios'),
    path('eliminar_usuario/<int:usuarioid>/', views.eliminar_usuario_view, name='eliminar_usuario'),
    path('editar_usuario/<int:usuarioid>/', views.editar_usuario_view, name='editar_usuario'),

    path('agregar_empleado/', views.agregar_empleado_view, name='agregar_empleado'),
    path('autocomplete/usuario/', views.usuario_autocomplete, name='usuario_autocomplete'),

    # Se deja un solo path para sucursal_autocomplete
    path('autocomplete/sucursal/', views.sucursal_autocomplete, name='sucursal_autocomplete'),
    # Se podría eliminar el duplicado si no se usa:
    path('sucursal-autocomplete/', views.sucursal_autocomplete, name='sucursal_autocomplete'),

    path('visualizar_empleados/', views.visualizar_empleados_view, name='visualizar_empleados'),
    path('editar_empleado/<int:empleadoid>/', views.editar_empleado_view, name='editar_empleado'),
    path('eliminar_empleado/<int:empleado_id>/', views.eliminar_empleado_view, name='eliminar_empleado'),

    path('agregar_horario/', views.agregar_horario_view, name='agregar_horario'),
    path('horarios_sucursal_autocomplete/', views.horarios_sucursal_autocomplete, name='horarios_sucursal_autocomplete'),
    path('visualizar_horarios/', views.visualizar_horarios_view, name='visualizar_horarios'),
    path('visualizar_horarios_sucursal_autocomplete/', views.visualizar_horarios_sucursal_autocomplete, name='visualizar_horarios_sucursal_autocomplete'),
    path('editar_horarios/<int:sucursal_id>/', views.editar_horarios_view, name='editar_horarios'),
    path('eliminar_horario/<int:horario_id>/', views.eliminar_horario_view, name='eliminar_horario'),

    path('agregar_horario_caja/', views.agregar_horario_caja_view, name='agregar_horario_caja'),
    path('sucursales_horariocaja_autocomplete/', views.sucursal_autocomplete_horariocaja, name='sucursal_autocomplete_horariocaja'),
    path('puntopago-autocomplete/', views.puntopago_autocomplete, name='puntopago_autocomplete'),
    path('visualizar_horarios_cajas/', views.visualizar_horarios_cajas_view, name='visualizar_horarios_cajas'),
    path('autocomplete/sucursal_horarios/', views.sucursal_horarios_autocomplete, name='sucursal_horarios_autocomplete'),
    path('autocomplete/puntopago_horarios/', views.puntopago_horarios_autocomplete, name='puntopago_horarios_autocomplete'),
    path('eliminar_horario_caja/<int:horario_id>/', views.eliminar_horario_caja_view, name='eliminar_horario_caja'),
    path('obtener_puntos_pago_con_horarios/', views.obtener_puntos_pago_con_horarios, name='obtener_puntos_pago_con_horarios'),
    path('editar_horarios_cajas/<int:puntopagoid>/', views.editar_horarios_cajas_view, name='editar_horarios_cajas'),

    path('agregar_cliente/', views.agregar_cliente, name='agregar_cliente'),
    path('visualizar_clientes/', views.visualizar_clientes, name='visualizar_clientes'),
    path('editar_cliente/<int:clienteid>/', views.editar_cliente, name='editar_cliente'),
    path('eliminar_cliente/<int:clienteid>/', views.eliminar_cliente, name='eliminar_cliente'),

    path('generar_venta/', views.generar_venta, name='generar_venta'),
    path('buscar_productos/', views.buscar_productos, name='buscar_productos'),
    path('verificar_producto/', views.verificar_producto, name='verificar_producto'),
    path('buscar_producto_por_codigo/', views.buscar_producto_por_codigo, name='buscar_producto_por_codigo'),
    path('buscar_cliente/', views.buscar_cliente, name='buscar_cliente'),
    path('verificar_pago_nequi/', views.verificar_pago_nequi, name='verificar_pago_nequi'),
]
