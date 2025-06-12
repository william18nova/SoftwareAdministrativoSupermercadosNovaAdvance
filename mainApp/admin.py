# mainApp/admin.py
from django.contrib import admin
from .models import CambioDevolucion


@admin.register(CambioDevolucion)
class CambioDevolucionAdmin(admin.ModelAdmin):
    list_display  = (
        "cambioid",
        "venta",
        "fecha",
        "tipo",
        "estado",
        "total_afectado",        # 👈  ahora sí existe
    )
    list_filter   = ("estado", "tipo", "fecha")
    search_fields = ("venta__ventaid",)

    # ------- columna calculada -------
    @admin.display(description="Total afectado")
    def total_afectado(self, obj):
        return obj.cantidad * obj.detalle.preciounitario
