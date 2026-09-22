import json

from django.test import RequestFactory, TestCase
from django.urls import reverse

from .models import Categoria, Inventario, Producto, Sucursal, Usuario
from .views import BuscarProductoPorCodigoView, ProductoBarrasAutocompleteView


class SaleBarcodeScannerTests(TestCase):
    def setUp(self):
        category = Categoria.objects.create(nombre="Prueba escáner")
        self.branch = Sucursal.objects.create(nombre="Caja escáner")
        self.user = Usuario.objects.create_user("Cajero escáner")
        self.product = Producto.objects.create(
            nombre="Arroz escáner", precio=4500, categoria=category,
            codigo_de_barras="0012345678905",
        )
        Inventario.objects.create(productoid=self.product, sucursalid=self.branch, cantidad=5)
        self.category = category

    def lookup(self, code, branch_id=None):
        request = RequestFactory().get(reverse("buscar_producto_por_codigo"), {
            "codigo_de_barras": code,
            "sucursal_id": branch_id if branch_id is not None else self.branch.pk,
        })
        request.user = self.user
        return json.loads(BuscarProductoPorCodigoView.as_view()(request).content)

    def autocomplete(self, term, exact="1"):
        request = RequestFactory().get(reverse("producto_autocomplete_barras"), {
            "term": term, "sucursal_id": self.branch.pk, "exact": exact,
        })
        request.user = self.user
        return json.loads(ProductoBarrasAutocompleteView.as_view()(request).content)

    def test_exact_lookup_preserves_leading_zeroes_and_rejects_partial_code(self):
        self.assertEqual(self.lookup("0012345678905")["producto"]["id"], self.product.pk)
        self.assertFalse(self.lookup("12345678905")["exists"])
        self.assertFalse(self.lookup("001234567890")["exists"])
        self.assertFalse(self.lookup("0012345678905", branch_id="abc")["exists"])

    def test_duplicate_barcode_is_reported_instead_of_picking_first_product(self):
        duplicate = Producto.objects.create(
            nombre="Arroz duplicado escáner", precio=5000, categoria=self.category,
            codigo_de_barras="0012345678905",
        )
        Inventario.objects.create(productoid=duplicate, sucursalid=self.branch, cantidad=2)
        result = self.lookup("0012345678905")
        self.assertFalse(result["exists"])
        self.assertTrue(result["ambiguous"])

    def test_exact_autocomplete_does_not_offer_name_or_prefix_matches(self):
        other = Producto.objects.create(
            nombre="Prefijo escáner", precio=4000, categoria=self.category,
            codigo_de_barras="00123456789050",
        )
        Inventario.objects.create(productoid=other, sucursalid=self.branch, cantidad=3)
        rows = self.autocomplete("0012345678905")["results"]
        self.assertEqual([row["id"] for row in rows], [self.product.pk])
        self.assertEqual(self.autocomplete("Arroz")["results"], [])
