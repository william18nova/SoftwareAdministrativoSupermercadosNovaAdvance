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
    path('visualizar_productos/', views.visualizar_productos_view, name='visualizar_productos'),
    path('productos/eliminar/<int:producto_id>/', views.eliminar_producto, name='eliminar_producto'),
    path('productos/editar/<int:producto_id>/', views.editar_producto_view, name='editar_producto'),
    path('agregar_inventario/', views.agregar_inventario_view, name='agregar_inventario'),
    path('visualizar_inventarios/', views.visualizar_inventarios_view, name='visualizar_inventarios'),
    path('editar_inventario/<int:sucursal_id>/', views.editar_inventario_view, name='editar_inventario'),
    path('inventario/eliminar/<int:inventario_id>/', views.eliminar_producto_inventario_view, name='eliminar_producto_inventario'),
    path('agregar_proveedor/', views.agregar_proveedor_view, name='agregar_proveedor'),
]
