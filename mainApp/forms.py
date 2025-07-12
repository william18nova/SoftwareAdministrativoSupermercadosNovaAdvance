# mainApp/forms.py

from django import forms
from .models import Categoria, Cliente, Empleado, Usuario, Sucursal, HorarioCaja, PuntosPago, HorariosNegocio, Producto, Proveedor, Rol, Inventario, PreciosProveedor, PedidoProveedor, DetallePedidoProveedor
import re
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from dal import autocomplete
import json
from django.db.models import Exists, OuterRef, Count, Q  # Agrega esta línea
from django.forms import formset_factory

MEDIO_PAGO_CHOICES = (
    ('nequi', 'Nequi'),
    ('daviplata', 'Daviplata'),
    ('efectivo', 'Efectivo'),
    ('tarjeta', 'Tarjeta'),
)

telefono_validator = RegexValidator(
    regex=r'^\d{10}$',
    message='El teléfono debe contener exactamente 10 dígitos.'
)

# -----------------------------------------------------------------------------
#  AGREGAR  ▸  SucursalForm
# -----------------------------------------------------------------------------
class SucursalForm(forms.ModelForm):
    """
    • «nombre» permite **cualquier** carácter UTF-8; sólo se valida longitud ≦ 100
    • Se siguen validando duplicados en `clean_nombre`.
    """
    nombre = forms.CharField(
        max_length=100,
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Ingresa el nombre de la sucursal",
            "required": True,
        }),
        error_messages={
            "required":   "El nombre es obligatorio.",
            "max_length": "El nombre no puede superar los 100 caracteres.",
        },
    )

    telefono = forms.CharField(
        validators=[telefono_validator],
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Ingresa el teléfono",
            "required": True,
        }),
    )

    class Meta:
        model  = Sucursal
        fields = ("nombre", "direccion", "telefono")
        labels = {
            "nombre":    "Nombre",
            "direccion": "Dirección",
            "telefono":  "Teléfono",
        }
        widgets = {
            "direccion": forms.TextInput(attrs={
                "class": "form-control",
                "placeholder": "Ingresa la dirección",
                "required": True,
            })
        }

    # --- unicidad (case-insensitive) ----------------------------------------
    def clean_nombre(self):
        nombre = self.cleaned_data["nombre"].strip()
        if Sucursal.objects.filter(nombre__iexact=nombre).exists():
            raise forms.ValidationError("El nombre de la sucursal ya está registrado.")
        return nombre


# -----------------------------------------------------------------------------
#  EDITAR  ▸  SucursalEditarForm
# -----------------------------------------------------------------------------
class SucursalEditarForm(forms.ModelForm):
    """
    Versión para edición:
    · Permite cualquier carácter UTF-8 en el nombre.
    · Sólo comprueba longitud y unicidad (sin disparar error si no se modificó).
    """

    nombre = forms.CharField(
        max_length=100,
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Ingresa el nombre de la sucursal",
            "required": True,
        }),
        error_messages={
            "required":   "El nombre es obligatorio.",
            "max_length": "El nombre no puede superar los 100 caracteres.",
        },
    )

    direccion = forms.CharField(
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Ingresa la dirección",
            "required": True,
        }),
        error_messages={"required": "La dirección es obligatoria."},
    )

    telefono = forms.CharField(
        validators=[telefono_validator],
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Ingresa el teléfono",
            "required": True,
        }),
    )

    class Meta:
        model  = Sucursal
        fields = ("nombre", "direccion", "telefono")
        labels = {
            "nombre":    "Nombre",
            "direccion": "Dirección",
            "telefono":  "Teléfono",
        }

    # ───────── validación extra ─────────
    def clean_nombre(self):
        nombre = self.cleaned_data["nombre"].strip()

        # si no cambió, aceptamos
        if self.instance and nombre.lower() == self.instance.nombre.lower():
            return nombre

        # si cambió, verificamos unicidad
        existe = Sucursal.objects.filter(
            nombre__iexact=nombre
        ).exclude(pk=self.instance.pk).exists()

        if existe:
            raise forms.ValidationError(
                "El nombre de la sucursal ya está registrado."
            )
        return nombre

class CategoriaForm(forms.ModelForm):
    nombre = forms.CharField(
        max_length=100,
        widget=forms.TextInput(attrs={
            "class"      : "form-control",
            "placeholder": "Ingresa el nombre de la categoría",
            "required"   : "required"
        }),
        error_messages={
            "required"  : "El nombre es obligatorio.",
            "max_length": "No más de 100 caracteres."
        }
    )

    descripcion = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            "class"      : "form-control",
            "placeholder": "Ingresa una descripción (opcional)"
        })
    )

    class Meta:
        model  = Categoria
        fields = ["nombre", "descripcion"]
        labels = {"nombre": "Nombre", "descripcion": "Descripción"}

    # validación de duplicados (nombre UTF-8 sin distinción de mayúsculas)
    def clean_nombre(self):
        nombre = self.cleaned_data["nombre"].strip()
        if Categoria.objects.filter(nombre__iexact=nombre).exists():
            raise forms.ValidationError("El nombre de la categoría ya está registrado.")
        return nombre

class EditarCategoriaForm(forms.ModelForm):
    class Meta:
        model  = Categoria
        fields = ("nombre", "descripcion")
        labels = {"nombre": "Nombre", "descripcion": "Descripción"}
        widgets = {
            "nombre": forms.TextInput(attrs={
                "class": "form-control",
                "placeholder": "Ingresa el nombre de la categoría",
            }),
            "descripcion": forms.TextInput(attrs={
                "class": "form-control",
                "placeholder": "Ingresa una descripción (opcional)",
            }),
        }

    def clean_nombre(self):
        nombre = self.cleaned_data["nombre"]
        qs = Categoria.objects.filter(nombre__iexact=nombre)
        if self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise forms.ValidationError(
                "El nombre de la categoría ya está registrado."
            )
        return nombre

class ClienteForm(forms.ModelForm):
    class Meta:
        model = Cliente
        fields = ['numerodocumento', 'nombre', 'apellido', 'telefono', 'email']
        labels = {
            'numerodocumento': 'Número de Documento',
            'nombre': 'Nombre',
            'apellido': 'Apellido',
            'telefono': 'Teléfono',
            'email': 'Correo Electrónico',
        }
        widgets = {
            'numerodocumento': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el número de documento',
                'required': 'required'
            }),
            'nombre': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el nombre',
                'required': 'required'
            }),
            'apellido': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el apellido',
                'required': 'required'
            }),
            'telefono': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el teléfono',
                'required': 'required'
            }),
            'email': forms.EmailInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el correo electrónico',
                'required': 'required'
            }),
        }

    def clean_numerodocumento(self):
        numerodocumento = self.cleaned_data.get('numerodocumento')
        if not numerodocumento.isdigit():
            raise forms.ValidationError('El número de documento debe contener solo dígitos.')
        if Cliente.objects.filter(numerodocumento=numerodocumento).exists():
            raise forms.ValidationError('El número de documento ya está registrado.')
        return numerodocumento

    def clean_telefono(self):
        telefono = self.cleaned_data.get('telefono')
        if not telefono.isdigit():
            raise forms.ValidationError('El teléfono debe contener solo dígitos.')
        if len(telefono) < 7 or len(telefono) > 15:
            raise forms.ValidationError('El teléfono debe tener entre 7 y 15 dígitos.')
        if Cliente.objects.filter(telefono=telefono).exists():
            raise forms.ValidationError('El teléfono ya está registrado.')
        return telefono

    def clean_nombre(self):
        nombre = self.cleaned_data.get('nombre')
        if not re.match(r'^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$', nombre):
            raise forms.ValidationError('El nombre solo puede contener letras.')
        return nombre

    def clean_apellido(self):
        apellido = self.cleaned_data.get('apellido')
        if not re.match(r'^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$', apellido):
            raise forms.ValidationError('El apellido solo puede contener letras.')
        return apellido

    def clean_email(self):
        email = self.cleaned_data.get('email')
        if email and Cliente.objects.filter(email=email).exists():
            raise forms.ValidationError('El correo electrónico ya está registrado.')
        return email

class EditarClienteForm(forms.ModelForm):
    class Meta:
        model = Cliente
        fields = ['numerodocumento', 'nombre', 'apellido', 'telefono', 'email']
        labels = {
            'numerodocumento': 'Número de Documento',
            'nombre': 'Nombre',
            'apellido': 'Apellido',
            'telefono': 'Teléfono',
            'email': 'Correo Electrónico',
        }
        widgets = {
            'numerodocumento': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el número de documento',
            }),
            'nombre': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el nombre',
            }),
            'apellido': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el apellido',
            }),
            'telefono': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el teléfono',
            }),
            'email': forms.EmailInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el correo electrónico',
            }),
        }

    def clean_numerodocumento(self):
        numerodocumento = self.cleaned_data.get('numerodocumento', '')
        # Validaciones similares a las del "ClienteForm" original
        if not numerodocumento.isdigit():
            raise forms.ValidationError('El número de documento debe contener solo dígitos.')

        # Excluir la PK actual (self.instance) para no chocar con uno mismo
        if (Cliente.objects.filter(numerodocumento=numerodocumento)
                           .exclude(pk=self.instance.pk)
                           .exists()):
            raise forms.ValidationError('El número de documento ya está registrado.')
        return numerodocumento

    def clean_telefono(self):
        telefono = self.cleaned_data.get('telefono', '')
        if not telefono.isdigit():
            raise forms.ValidationError('El teléfono debe contener solo dígitos.')
        if len(telefono) < 7 or len(telefono) > 15:
            raise forms.ValidationError('El teléfono debe tener entre 7 y 15 dígitos.')
        if (Cliente.objects.filter(telefono=telefono)
                           .exclude(pk=self.instance.pk)
                           .exists()):
            raise forms.ValidationError('El teléfono ya está registrado.')
        return telefono

    def clean_email(self):
        email = self.cleaned_data.get('email', '')
        if (email
            and Cliente.objects.filter(email=email)
                               .exclude(pk=self.instance.pk)
                               .exists()):
            raise forms.ValidationError('El correo electrónico ya está registrado.')
        return email
    
class EmpleadoCreateForm(forms.ModelForm):
    """
    «Agregar Empleado»  (estilo ligero + autocompletado)
    ─────────────────────────────────────────────────────
    """

    # ─── validadores simples ───
    text_v  = RegexValidator(r"^[A-Za-z\s]+$", "Solo letras y espacios.")
    doc_v   = RegexValidator(r"^\d{6,10}$",   "6-10 dígitos.")
    tel_v   = RegexValidator(r"^\d{10}$",     "10 dígitos.")

    # ─── campos visibles ───
    numerodocumento = forms.CharField(
        label="Número de Documento",
        validators=[doc_v],
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Número de documento",
            "required": True,
        })
    )
    nombre = forms.CharField(
        validators=[text_v],
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Nombre",
            "required": True,
        })
    )
    apellido = forms.CharField(
        validators=[text_v],
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Apellido",
            "required": True,
        })
    )
    telefono = forms.CharField(
        validators=[tel_v],
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Teléfono (10 dígitos)",
            "required": True,
        })
    )
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={
            "class": "form-control",
            "placeholder": "Correo electrónico",
            "required": True,
        })
    )
    direccion = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Dirección",
        })
    )
    puesto = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Puesto",
        })
    )

    # autocompletes visibles
    usuario_autocomplete = forms.CharField(
        required=True,
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Escriba para buscar usuario…",
            "autocomplete": "off",
        })
    )
    sucursal_autocomplete = forms.CharField(
        required=True,
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Escriba para buscar sucursal…",
            "autocomplete": "off",
        })
    )

    # ─── ocultos ───
    usuarioid  = forms.ModelChoiceField(
        queryset=Usuario.objects.none(),
        widget=forms.HiddenInput(), required=True
    )
    sucursalid = forms.ModelChoiceField(
        queryset=Sucursal.objects.none(),
        widget=forms.HiddenInput(), required=True
    )

    class Meta:
        model  = Empleado
        fields = ("numerodocumento", "nombre", "apellido",
                  "telefono", "email", "direccion", "puesto",
                  "usuarioid", "sucursalid")

    # ─── queryset dinámico ───
    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)

        # Sub-consulta para excluir usuarios ya vinculados
        sub = Empleado.objects.filter(usuarioid=OuterRef("pk"))
        libres = Usuario.objects.annotate(has_emp=Exists(sub)).filter(has_emp=False)

        self.fields["usuarioid"].queryset  = libres
        self.fields["sucursalid"].queryset = Sucursal.objects.all()

    # ─── validaciones de unicidad ───
    def clean_email(self):
        e = self.cleaned_data["email"]
        if Empleado.objects.filter(email=e).exists():
            raise ValidationError("El correo ya está en uso.")
        return e

    def clean_numerodocumento(self):
        d = self.cleaned_data["numerodocumento"]
        if Empleado.objects.filter(numerodocumento=d).exists():
            raise ValidationError("Número de documento duplicado.")
        return d

    def clean_telefono(self):
        t = self.cleaned_data["telefono"]
        if Empleado.objects.filter(telefono=t).exists():
            raise ValidationError("Teléfono duplicado.")
        return t

    def clean_usuarioid(self):
        u = self.cleaned_data["usuarioid"]
        if Empleado.objects.filter(usuarioid=u).exists():
            raise ValidationError("Este usuario ya tiene empleado.")
        return u

class EditarEmpleadoForm(forms.ModelForm):
    # Validadores similares a los de EmpleadoForm
    nombre_validator = RegexValidator(
        regex=r'^[A-Za-z\s]+$',
        message='El nombre solo debe contener letras y espacios.'
    )

    apellido_validator = RegexValidator(
        regex=r'^[A-Za-z\s]+$',
        message='El apellido solo debe contener letras y espacios.'
    )

    numerodocumento_validator = RegexValidator(
        regex=r'^\d{6,10}$',
        message='El número de documento debe contener entre 6 y 10 dígitos.'
    )

    telefono_validator = RegexValidator(
        regex=r'^\d{10}$',
        message='El teléfono debe contener exactamente 10 dígitos.'
    )

    numerodocumento = forms.CharField(
        label='Número de Documento',
        required=False,  # Si permites "dejar en blanco para mantener la actual"
        validators=[numerodocumento_validator],
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Dejar en blanco para mantener la actual'
        })
    )
    nombre = forms.CharField(
        validators=[nombre_validator],
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa el nombre'
        })
    )
    apellido = forms.CharField(
        validators=[apellido_validator],
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa el apellido'
        })
    )
    telefono = forms.CharField(
        validators=[telefono_validator],
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa el teléfono'
        })
    )
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa el correo electrónico'
        })
    )
    direccion = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa la dirección'
        })
    )
    puesto = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa el puesto'
        })
    )
    # usuarioid y sucursalid podrían manejarse con inputs/hidden o selects
    # depende de tu lógica de autocompletado o select normal
    usuarioid = forms.ModelChoiceField(
        queryset=Usuario.objects.all(),
        required=False,  # O True si es obligatorio
        widget=forms.Select(attrs={
            'class': 'form-control'
        })
    )
    sucursalid = forms.ModelChoiceField(
        queryset=Sucursal.objects.all(),
        required=False,
        widget=forms.Select(attrs={
            'class': 'form-control'
        })
    )

    class Meta:
        model = Empleado
        fields = [
            'numerodocumento',
            'nombre',
            'apellido',
            'telefono',
            'email',
            'direccion',
            'puesto',
            'usuarioid',
            'sucursalid'
        ]

    def clean_numerodocumento(self):
        numero = self.cleaned_data.get('numerodocumento')
        # Si se deja en blanco => no se cambia
        # Si no está en blanco => validamos
        if numero:
            if Empleado.objects.filter(numerodocumento=numero).exclude(pk=self.instance.pk).exists():
                raise forms.ValidationError('El número de documento ya está en uso.')
        return numero

    def clean_telefono(self):
        tel = self.cleaned_data.get('telefono')
        # Validar si ya existe en otro Empleado, excluyendo el actual
        if Empleado.objects.filter(telefono=tel).exclude(pk=self.instance.pk).exists():
            raise forms.ValidationError('El teléfono ya está en uso.')
        return tel

    def clean_email(self):
        mail = self.cleaned_data.get('email')
        if Empleado.objects.filter(email=mail).exclude(pk=self.instance.pk).exists():
            raise forms.ValidationError('El correo ya está en uso.')
        return mail

    # Podrías agregar más clean_... si gustas replicar la lógica de:
    # clean_nombre, clean_apellido => Revisar solo letras, etc.

    def save(self, commit=True):
        """
        Si 'numerodocumento' vino en blanco => se mantiene la actual
        """
        instance = super().save(commit=False)
        # Lógica: si numerodocumento == '', no sobrescribir
        if not self.cleaned_data.get('numerodocumento'):
            # Dejamos la anterior
            pass  # El instance ya tiene su numerodocumento previo
        # De lo contrario, la forma ya se aplicó
        if commit:
            instance.save()
        return instance

class HorariosNegocioForm(forms.ModelForm):
    """
    Formulario para agregar horarios a una sucursal.
    Incluye un campo de autocompletado para seleccionar la sucursal,
    campos para seleccionar días de la semana y horarios de apertura y cierre.
    """

    # Campos para el autocompletado de sucursal
    sucursal_autocomplete = forms.CharField(
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Escriba para buscar sucursal...',
            'autocomplete': 'off',
        })
    )

    # Campo oculto que guarda el ID de la sucursal elegida
    sucursalid = forms.ModelChoiceField(
        queryset=Sucursal.objects.exclude(horariosnegocio__isnull=False),
        widget=forms.HiddenInput(),
        required=True,
    )

    # Campos para días y horarios
    dia_semana = forms.CharField(
        required=False,  # Solo obligatorio si no hay horarios listados
        widget=forms.HiddenInput()
    )
    horaapertura = forms.TimeField(
        required=False,  # Solo obligatorio si no hay horarios listados
        widget=forms.TimeInput(attrs={
            'class': 'form-control',
            'type': 'time',
            'placeholder': 'Seleccione la hora de apertura',
        })
    )
    horacierre = forms.TimeField(
        required=False,  # Solo obligatorio si no hay horarios listados
        widget=forms.TimeInput(attrs={
            'class': 'form-control',
            'type': 'time',
            'placeholder': 'Seleccione la hora de cierre',
        })
    )

    class Meta:
        model = HorariosNegocio
        fields = ['sucursalid', 'dia_semana', 'horaapertura', 'horacierre']
        labels = {
            'sucursal_autocomplete': 'Sucursal',
            'dia_semana': 'Día de la Semana',
            'horaapertura': 'Hora de Apertura',
            'horacierre': 'Hora de Cierre',
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Excluir sucursales que ya tienen horarios asignados
        self.fields['sucursalid'].queryset = Sucursal.objects.exclude(horariosnegocio__isnull=False)

    def clean(self):
        """
        Validaciones personalizadas:
         - Sucursal no puede quedar vacía en ningún caso.
         - Si el usuario no ha agregado horarios a la lista temporal,
           los campos (dia_semana, horaapertura y horacierre) deben estar llenos.
         - Si se llenan horaapertura y horacierre, validar que horaapertura < horacierre.
        """
        cleaned_data = super().clean()

        # Campos del formulario
        sucursalid = cleaned_data.get('sucursalid')
        dia_semana = cleaned_data.get('dia_semana')
        horaapertura = cleaned_data.get('horaapertura')
        horacierre = cleaned_data.get('horacierre')

        # Este campo hidden viene del JavaScript con la lista de horarios temporales
        horarios_json = self.data.get('horarios')

        # 1. Validación de sucursalid (siempre requerida)
        if not sucursalid:
            self.add_error('sucursalid', 'Debe seleccionar una sucursal.')

        # 2. Revisar si hay horarios listados en la tabla temporal
        #    (el usuario pudo haber agregado horarios sin usar estos campos)
        if not horarios_json:
            # Si NO hay horarios listados, entonces estos campos son obligatorios:
            # dia_semana, horaapertura, horacierre
            if not dia_semana:
                self.add_error('dia_semana', 'Debe seleccionar al menos un día de la semana.')
            if not horaapertura:
                self.add_error('horaapertura', 'Debe seleccionar una hora de apertura.')
            if not horacierre:
                self.add_error('horacierre', 'Debe seleccionar una hora de cierre.')

            # Validar también que horaapertura < horacierre si ambos están presentes
            if horaapertura and horacierre and horaapertura >= horacierre:
                self.add_error('horacierre', 'La hora de cierre debe ser mayor que la hora de apertura.')
        else:
            # Si hay horarios en horarios_json, no es obligatorio
            # rellenar estos campos, pero si se rellenan, verificarlos
            if horaapertura and horacierre and horaapertura >= horacierre:
                self.add_error('horacierre', 'La hora de cierre debe ser mayor que la hora de apertura.')

        return cleaned_data

class EditarHorariosSucursalForm(forms.Form):
    """
    Formulario para editar horarios de una sucursal.
    Usado principalmente para validar la información básica
    que llega vía AJAX (JSON).
    """
    # Campo autocompletado: si deseas permitir cambiar de sucursal
    sucursalid = forms.CharField(required=True)
    
    # Campos "dummy" para evitar errores si tu plantilla envía algo extra.
    dia_semana = forms.CharField(required=False)
    horaapertura = forms.TimeField(required=False)
    horacierre = forms.TimeField(required=False)

    def __init__(self, *args, horarios_present=False, **kwargs):
        """
        'horarios_present' indica si en el POST (JSON) venía la lista de horarios.
        Podrías usarlo para validaciones personalizadas.
        """
        super().__init__(*args, **kwargs)
        self.horarios_present = horarios_present

    def clean_sucursalid(self):
        s_id = self.cleaned_data.get('sucursalid')
        # Valida que sea dígito (opcional, si tus PK son numéricos)
        if not s_id.isdigit():
            raise forms.ValidationError('ID de sucursal inválido.')
        # Valida que la sucursal exista
        try:
            Sucursal.objects.get(pk=s_id)
        except Sucursal.DoesNotExist:
            raise forms.ValidationError('La sucursal no existe.')
        return s_id

    def clean(self):
        """
        Aquí podrías agregar validaciones adicionales:
         - Que existan horarios
         - Que las horas sean correctas, etc.
        """
        cleaned_data = super().clean()
        return cleaned_data

class HorarioCajaForm(forms.ModelForm):
    puntopago_autocomplete = forms.CharField(
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Escriba para buscar punto de pago...',
            'autocomplete': 'off',
        })
    )
    puntopagoid = forms.ModelChoiceField(
        queryset=PuntosPago.objects.none(),
        widget=forms.HiddenInput(),
        required=True,
    )
    dia_semana = forms.CharField(
        required=False,
        widget=forms.HiddenInput()
    )
    horaapertura = forms.TimeField(
        required=False,
        widget=forms.TimeInput(attrs={
            'class': 'form-control',
            'type': 'time'
        })
    )
    horacierre = forms.TimeField(
        required=False,
        widget=forms.TimeInput(attrs={
            'class': 'form-control',
            'type': 'time'
        })
    )

    class Meta:
        model = HorarioCaja
        fields = ['puntopagoid', 'dia_semana', 'horaapertura', 'horacierre']
        labels = {
            'puntopagoid': 'Punto de Pago',
            'dia_semana': 'Día de la Semana',
            'horaapertura': 'Hora de Apertura',
            'horacierre': 'Hora de Cierre',
        }
        widgets = {
            'puntopagoid': forms.HiddenInput(),
            'dia_semana': forms.HiddenInput(),
            'horaapertura': forms.TimeInput(attrs={
                'class': 'form-control',
                'type': 'time'
            }),
            'horacierre': forms.TimeInput(attrs={
                'class': 'form-control',
                'type': 'time'
            }),
        }

    def __init__(self, *args, horarios_present=False, **kwargs):
        super().__init__(*args, **kwargs)
        self.horarios_present = horarios_present

        # Filtrar los Puntos de Pago que no tienen horario asignado
        self.fields['puntopagoid'].queryset = PuntosPago.objects.filter(
            sucursalid__isnull=False
        ).exclude(
            horarios_caja__isnull=False
        )

    def clean(self):
        cleaned_data = super().clean()
        horaapertura = cleaned_data.get('horaapertura')
        horacierre = cleaned_data.get('horacierre')
        dia_semana = cleaned_data.get('dia_semana')
        puntopagoid = cleaned_data.get('puntopagoid')

        # Si no hay horarios listados, validar los campos
        if not self.horarios_present:
            if horaapertura and horacierre:
                if horaapertura >= horacierre:
                    raise forms.ValidationError('La hora de apertura debe ser menor que la hora de cierre.')

            if not dia_semana:
                raise forms.ValidationError('Debe seleccionar al menos un día de la semana.')

            # Validar que no exista ya un horario para el mismo día y punto de pago
            if dia_semana and puntopagoid:
                dias = dia_semana.split(',')
                for dia in dias:
                    if HorarioCaja.objects.filter(puntopagoid=puntopagoid, dia_semana=dia).exists():
                        raise forms.ValidationError(f'Ya existe un horario para el día {dia} en este punto de pago.')

        return cleaned_data
    
class EditarHorarioCajaForm(forms.Form):
    """
    Formulario genérico para validar que la sucursal y el punto de pago sean válidos.
    Se valida que el ID de la sucursal y del punto de pago sean dígitos y que existan.
    """
    sucursalid = forms.CharField(required=True)
    puntopagoid = forms.CharField(required=True)
    
    # Se definen estos campos para evitar errores en la validación (aunque no se usen directamente)
    dia_semana = forms.CharField(required=False)
    horaapertura = forms.TimeField(required=False)
    horacierre = forms.TimeField(required=False)

    def __init__(self, *args, horarios_present=False, **kwargs):
        super().__init__(*args, **kwargs)
        self.horarios_present = horarios_present

    def clean_sucursalid(self):
        s_id = self.cleaned_data.get('sucursalid')
        if not s_id.isdigit():
            raise forms.ValidationError('ID de sucursal inválido.')
        try:
            Sucursal.objects.get(pk=s_id)
        except Sucursal.DoesNotExist:
            raise forms.ValidationError('La sucursal no existe.')
        return s_id

    def clean_puntopagoid(self):
        p_id = self.cleaned_data.get('puntopagoid')
        if not p_id.isdigit():
            raise forms.ValidationError('ID de punto de pago inválido.')
        try:
            PuntosPago.objects.get(pk=p_id)
        except PuntosPago.DoesNotExist:
            raise forms.ValidationError('El punto de pago no existe.')
        return p_id

    def clean(self):
        cleaned_data = super().clean()
        # Aquí podrías agregar validaciones adicionales según tu lógica (por ejemplo, que el 
        # punto de pago pertenezca a la sucursal) si lo consideras necesario.
        return cleaned_data

    
class ProductoForm(forms.ModelForm):
    _ean_validator = RegexValidator(
        regex=r"^\d{12}$",
        message="El código de barras debe contener exactamente 12 dígitos."
    )

    codigo_de_barras = forms.CharField(
        required=False,
        validators=[_ean_validator],
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Ingresa el código de barras"
        })
    )

    class Meta:
        model  = Producto
        fields = ["nombre", "descripcion", "precio", "categoria",
                  "codigo_de_barras", "iva"]

        labels = {
            "nombre"          : "Nombre",
            "descripcion"     : "Descripción",
            "precio"          : "Precio",
            "categoria"       : "Categoría",
            "codigo_de_barras": "Código de barras",
            "iva"             : "IVA (p. ej. 0.19)",
        }

        widgets = {
            "nombre": forms.TextInput(attrs={
                "class": "form-control",
                "placeholder": "Ingresa el nombre del producto",
                "required": "required"
            }),
            "descripcion": forms.TextInput(attrs={
                "class": "form-control",
                "placeholder": "Ingresa la descripción del producto"
            }),
            "precio": forms.NumberInput(attrs={
                "class": "form-control",
                "step": "0.01",
                "min": "0",
                "placeholder": "Ingresa el precio",
                "required": "required"
            }),
            #  campo oculto: la PK llega vía autocompletado
            "categoria": forms.HiddenInput(),
            "iva": forms.NumberInput(attrs={
                "class": "form-control",
                "step": "0.01",
                "min": "0",
                "max": "1",
                "placeholder": "Ingresa el IVA",
                "required": "required"
            }),
        }

    #  === VALIDATIONS ======================================================

    def __init__(self, *args, **kw):
        super().__init__(*args, **kw)
        self._instance_pk = getattr(self.instance, "productoid", None)

    def clean_nombre(self):
        nombre = self.cleaned_data["nombre"]
        qs = Producto.objects.filter(nombre__iexact=nombre)
        if self._instance_pk:
            qs = qs.exclude(productoid=self._instance_pk)
        if qs.exists():
            raise forms.ValidationError("El nombre ya está registrado.", code="duplicate")
        return nombre

    def clean_codigo_de_barras(self):
        ean = self.cleaned_data.get("codigo_de_barras")
        if not ean:
            return ean
        qs = Producto.objects.filter(codigo_de_barras=ean)
        if self._instance_pk:
            qs = qs.exclude(productoid=self._instance_pk)
        if qs.exists():
            raise forms.ValidationError("El código de barras ya está registrado.", code="duplicate")
        return ean


class ProductoEditarForm(forms.ModelForm):
    """
    Formulario **único** para crear / editar productos.
    El autocompletado de categoría se maneja con:
      • id_categoria_autocomplete  → solo texto visible
      • categoria (HiddenInput)    → PK real que se envía
    """

    # ---------- campo técnico (hidden) ----------
    categoria = forms.ModelChoiceField(
        queryset=Categoria.objects.none(),      # se llena en __init__
        widget=forms.HiddenInput(),
        required=True,
        label="Categoría",
    )

    class Meta:
        model  = Producto
        fields = (
            "nombre",
            "descripcion",
            "precio",
            "categoria",            # hidden – lo llena el JS
            "codigo_de_barras",
            "iva",
        )
        labels = {
            "nombre"          : "Nombre",
            "descripcion"     : "Descripción",
            "precio"          : "Precio",
            "codigo_de_barras": "Código de barras",
            "iva"             : "IVA (0 – 1)",
        }
        widgets = {
            "nombre": forms.TextInput(attrs={
                "class"      : "form-control",
                "placeholder": "Nombre del producto",
                "required"   : True,
            }),
            "descripcion": forms.TextInput(attrs={
                "class"      : "form-control",
                "placeholder": "Descripción (opcional)",
            }),
            "precio": forms.NumberInput(attrs={
                "class"      : "form-control",
                "step"       : "0.01",
                "min"        : "0",
                "placeholder": "Precio",
                "required"   : True,
            }),
            "codigo_de_barras": forms.TextInput(attrs={
                "class"      : "form-control",
                "placeholder": "EAN / código de barras",
            }),
            "iva": forms.NumberInput(attrs={
                "class"      : "form-control",
                "step"       : "0.01",
                "min"        : "0",
                "max"        : "1",
                "placeholder": "IVA (ej. 0.19)",
                "required"   : True,
            }),
        }

    # ---------------------- init ----------------------
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # queryset completo (o filtra a gusto)
        self.fields["categoria"].queryset = Categoria.objects.all()

        # guardamos la PK para validaciones de duplicados
        self._pk = self.instance.pk

        # si estamos editando, enviamos el nombre de la categoría al template
        if self.instance.pk and self.instance.categoria:
            self.initial["id_categoria_autocomplete_initial"] = (
                self.instance.categoria.nombre
            )

    # ------------------ validaciones ------------------
    def clean_nombre(self):
        nombre = self.cleaned_data["nombre"].strip()
        qs = Producto.objects.filter(nombre__iexact=nombre)
        if self._pk:
            qs = qs.exclude(pk=self._pk)
        if qs.exists():
            raise ValidationError("El nombre ya está registrado.", code="duplicate")
        return nombre

    def clean_codigo_de_barras(self):
        ean = self.cleaned_data.get("codigo_de_barras", "").strip()
        if not ean:
            return ean
        qs = Producto.objects.filter(codigo_de_barras=ean)
        if self._pk:
            qs = qs.exclude(pk=self._pk)
        if qs.exists():
            raise ValidationError("El código de barras ya está registrado.", code="duplicate")
        return ean

    
    
    
class ProveedorForm(forms.ModelForm):
    nombre = forms.CharField(
        max_length=100,
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Nombre del proveedor",
            "required": True,
        })
    )
    
    empresa = forms.CharField(
        max_length=100,
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Empresa",
            "required": True,
        })
    )
    telefono = forms.CharField(
        max_length=15,
        validators=[telefono_validator],
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Teléfono (7-15 dígitos)",
            "required": True,
        })
    )
    email = forms.EmailField(
        max_length=100,
        required=False,
        widget=forms.EmailInput(attrs={
            "class": "form-control",
            "placeholder": "Correo electrónico",
        })
    )
    direccion = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={
            "class": "form-control",
            "placeholder": "Dirección",
            "rows": 3,
        })
    )

    class Meta:
        model = Proveedor
        fields = ["nombre", "empresa", "telefono", "email", "direccion"]

    # ---------- Validaciones de unicidad ---------- #
    def clean_nombre(self):
        nombre = self.cleaned_data["nombre"]
        if Proveedor.objects.filter(nombre__iexact=nombre).exists():
            raise forms.ValidationError("Ya existe un proveedor con este nombre.")
        return nombre

    def clean_telefono(self):
        tel = self.cleaned_data["telefono"]
        if Proveedor.objects.filter(telefono=tel).exists():
            raise forms.ValidationError("Ya existe un proveedor con este teléfono.")
        return tel
    

class EditarProveedorForm(forms.ModelForm):
    """
    Form para editar un proveedor (con la misma lógica de validación que el de agregar).
    """
    class Meta:
        model = Proveedor
        fields = ['nombre', 'empresa', 'telefono', 'email', 'direccion']
        labels = {
            'nombre': 'Nombre',
            'empresa': 'Empresa',
            'telefono': 'Teléfono',
            'email': 'Email',
            'direccion': 'Dirección',
        }
        widgets = {
            'nombre': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el nombre del proveedor',
                'required': 'required'
            }),
            'empresa': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa la empresa',
                'required': 'required'
            }),
            'telefono': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el teléfono',
                'required': 'required'
            }),
            'email': forms.EmailInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el correo electrónico'
            }),
            'direccion': forms.Textarea(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa la dirección',
                'rows': 3
            }),
        }

    def clean_nombre(self):
        nombre = self.cleaned_data['nombre']
        # Evitar duplicados con otros proveedores
        qs = (Proveedor.objects
             .exclude(pk=self.instance.pk)  # excluye al actual
             .filter(nombre__iexact=nombre))
        if qs.exists():
            raise forms.ValidationError('Ya existe un proveedor con este nombre.')
        return nombre

    def clean_telefono(self):
        telefono = self.cleaned_data['telefono']
        if not telefono.isdigit():
            raise forms.ValidationError('El teléfono debe contener solo dígitos.')
        return telefono

    
class RolForm(forms.ModelForm):
    nombre = forms.CharField(
        max_length=50,
        validators=[
            RegexValidator(
                regex=r"^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$",
                message="El nombre solo debe contener letras y espacios."
            )
        ],
        widget=forms.TextInput(attrs={
            "class"      : "form-control",
            "placeholder": "Ingresa el nombre del rol",
            "required"   : True,
        }),
        error_messages={
            "required"  : "El nombre es obligatorio.",
            "max_length": "Máximo 50 caracteres.",
        },
    )

    descripcion = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={
            "class"      : "form-control",
            "placeholder": "Ingresa la descripción (opcional)",
            "rows"       : 4
        }),
    )

    class Meta:
        model  = Rol
        fields = ("nombre", "descripcion")
        labels = {
            "nombre"     : "Nombre del Rol",
            "descripcion": "Descripción",
        }

    # --------- unicidad case-insensitive ---------
    def clean_nombre(self):
        nombre = self.cleaned_data["nombre"].strip()
        if Rol.objects.filter(nombre__iexact=nombre).exists():
            raise forms.ValidationError("Ya existe un rol con ese nombre.")
        return nombre
    
class RolEditarForm(forms.ModelForm):
    """
    ▸ Formulario para editar un Rol.
    ▸ - Permite conservar el mismo nombre sin lanzar error.
    ▸ - Si el nombre cambia, verifica duplicados (case-insensitive),
         excluyendo el propio registro.
    """

    nombre = forms.CharField(
        label="Nombre del Rol",
        max_length=50,
        validators=[
            RegexValidator(
                regex=r"^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$",
                message="El nombre solo debe contener letras y espacios."
            )
        ],
        widget=forms.TextInput(attrs={
            "class"      : "form-control",
            "placeholder": "Ingresa el nombre del rol",
            "required"   : True,
        }),
        error_messages={
            "required"   : "El nombre es obligatorio.",
            "max_length" : "El nombre no puede superar 50 caracteres.",
        },
    )

    descripcion = forms.CharField(
        label="Descripción",
        required=False,
        widget=forms.Textarea(attrs={
            "class"      : "form-control",
            "placeholder": "Ingresa la descripción del rol",
            "rows"       : 4,
        }),
    )

    class Meta:
        model  = Rol
        fields = ("nombre", "descripcion")

    # ---------- validación de unicidad ----------
    def clean_nombre(self):
        nombre = self.cleaned_data.get("nombre", "").strip()

        # Si el usuario NO cambió el nombre, lo aceptamos tal cual
        if self.instance and nombre.lower() == self.instance.nombre.lower():
            return nombre

        # Si lo cambió, comprobamos duplicados excluyendo el propio ID
        existe = Rol.objects.filter(
            nombre__iexact=nombre
        ).exclude(pk=self.instance.pk).exists()

        if existe:
            raise forms.ValidationError("Ya existe un rol con ese nombre.")
        return nombre

class InventarioForm(forms.Form):
    """Formulario «liviano»; solo valida datos mínimos."""

    # visibles
    sucursal_autocomplete = forms.CharField(
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Escriba para buscar sucursal…",
            "autocomplete": "off",
        }), required=True)

    producto_autocomplete = forms.CharField(
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Escriba para buscar producto…",
            "autocomplete": "off",
        }), required=False)

    cantidad = forms.IntegerField(
        min_value=1,
        widget=forms.NumberInput(attrs={
            "class": "form-control",
            "placeholder": "Cantidad",
            "min": "1",
        }), required=False)

    # ocultos
    sucursal  = forms.ModelChoiceField(
        queryset=Sucursal.objects.none(),
        widget=forms.HiddenInput(), required=True)

    productoid = forms.ModelChoiceField(
        queryset=Producto.objects.all(),
        widget=forms.HiddenInput(), required=False)

    class Meta:
        fields = ("sucursal", "productoid", "cantidad")

    # ----------- queryset dinámico -----------
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        sin_inv = Sucursal.objects.annotate(
            tiene_inv=Exists(
                Inventario.objects.filter(sucursalid=OuterRef("pk"))
            )
        ).filter(tiene_inv=False)

        self.fields["sucursal"].queryset  = sin_inv
        self.fields["productoid"].queryset = Producto.objects.all()

    # ----------- validación cruzada -----------
    def clean(self):
        cd = super().clean()

        if not cd.get("sucursal"):
            self.add_error("sucursal", "Seleccione una sucursal válida.")

        if cd.get("productoid") and not cd.get("cantidad"):
            self.add_error("cantidad", "Indique una cantidad válida.")
        return cd
    

class InventarioFiltroForm(forms.Form):
    """
    Formulario mínimo usado por la vista `InventarioListView`.
    Solo contiene el campo oculto “sucursal” que llega del
    autocompletado (puede ser un PK o la cadena “global”).
    """

    sucursal = forms.CharField(widget=forms.HiddenInput(), required=False)

    def clean_sucursal(self):
        valor = self.cleaned_data.get("sucursal", "").strip()
        if not valor:                       # → sin filtro (listar nada)
            return ""

        if valor == "global":               # → modo inventario global
            return "global"

        # debe ser un entero correspondiente a una sucursal existente
        if not valor.isdigit():
            raise forms.ValidationError("Sucursal no válida.")
        pk = int(valor)
        if not Sucursal.objects.filter(pk=pk, inventario__isnull=False).exists():
            raise forms.ValidationError("Sucursal no encontrada.")
        return pk

    
class EditarInventarioForm(forms.Form):
    """
    Formulario para editar el inventario de una sucursal con autocomplete.
    """
    # Campo autocompletado de sucursal
    sucursal_autocomplete = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Escriba para buscar sucursal...',
            'autocomplete': 'off',
        })
    )
    # Campo hidden para la ID de la sucursal
    sucursal = forms.ModelChoiceField(
        queryset=Sucursal.objects.all(),  # o .none() y luego sobreescribir en la vista
        widget=forms.HiddenInput(),
        required=True
    )

    # Campo oculto con la lista final de productos/cantidades en JSON
    inventarios_temp = forms.CharField(
        required=False,
        widget=forms.HiddenInput()
    )

    def clean_sucursal(self):
        suc = self.cleaned_data.get('sucursal')
        if not suc:
            raise forms.ValidationError('Debe seleccionar una sucursal.')
        return suc

    def clean_inventarios_temp(self):
        # Podrías validar que sea JSON, etc. Por ahora, lo dejas pasar.
        data = self.cleaned_data.get('inventarios_temp', '')
        return data
    

    
class PreciosProveedorForm(forms.Form):
    """Formulario ligero: sólo valida mínimos para el proveedor + precio unitario."""

    # visibles
    proveedor_autocomplete = forms.CharField(
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Escriba para buscar proveedor…",
            "autocomplete": "off",
        }), required=True)

    producto_autocomplete = forms.CharField(
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Escriba para buscar producto…",
            "autocomplete": "off",
        }), required=False)

    precio = forms.DecimalField(
        min_value=0.01,
        widget=forms.NumberInput(attrs={
            "class": "form-control",
            "placeholder": "Ingrese el precio",
            "min": "0.01",
            "step": "0.01",
        }), required=False)

    # ocultos
    proveedor  = forms.ModelChoiceField(
        queryset=Proveedor.objects.none(),
        widget=forms.HiddenInput(), required=True)

    productoid = forms.ModelChoiceField(
        queryset=Producto.objects.all(),
        widget=forms.HiddenInput(), required=False)

    class Meta:
        fields = ("proveedor", "productoid", "precio")

    # ---------- queryset dinámico ----------
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        sin_precios = Proveedor.objects.annotate(
            has_p=Exists(
                PreciosProveedor.objects.filter(proveedorid=OuterRef("pk"))
            )
        ).filter(has_p=False)

        self.fields["proveedor"].queryset  = sin_precios
        self.fields["productoid"].queryset = Producto.objects.all()

    # ---------- validación cruzada ----------
    def clean(self):
        cd = super().clean()

        if not cd.get("proveedor"):
            self.add_error("proveedor", "Seleccione un proveedor válido.")

        if cd.get("productoid") and not cd.get("precio"):
            self.add_error("precio", "El precio debe ser mayor que 0.")
        return cd
    

class EditarPreciosProveedorForm(forms.Form):
    """Valida mínimamente proveedor + precio unitario para edición."""

    proveedor_autocomplete = forms.CharField(
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Escriba para buscar proveedor…",
            "autocomplete": "off",
        }), required=True)

    producto_autocomplete = forms.CharField(
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Escriba para buscar producto…",
            "autocomplete": "off",
        }), required=False)

    precio = forms.DecimalField(
        min_value=0.01,
        widget=forms.NumberInput(attrs={
            "class": "form-control",
            "placeholder": "Ingrese el precio",
            "min": "0.01",
            "step": "0.01",
        }), required=False)

    # ocultos
    proveedor  = forms.ModelChoiceField(
        queryset=Proveedor.objects.all(),
        widget=forms.HiddenInput(), required=True)

    productoid = forms.ModelChoiceField(
        queryset=Producto.objects.all(),
        widget=forms.HiddenInput(), required=False)

    precios_temp = forms.CharField(widget=forms.HiddenInput(), required=False)

    class Meta:
        fields = (
            "proveedor", "productoid", "precio", "precios_temp",
        )

    # ---------- validación cruzada ----------
    def clean(self):
        cd = super().clean()

        if not cd.get("proveedor"):
            self.add_error("proveedor", "Seleccione un proveedor válido.")

        if cd.get("productoid") and not cd.get("precio"):
            self.add_error("precio", "El precio debe ser mayor que 0.")
        return cd


class PuntosPagoForm(forms.Form):
    """Formulario mínimo; toda la lógica pesada se maneja en la vista."""

    # visibles
    sucursal_autocomplete = forms.CharField(
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Escriba para buscar sucursal…",
            "autocomplete": "off",
        }), required=True)

    nombre = forms.CharField(
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Nombre del punto de pago…",
        }), required=False)

    descripcion = forms.CharField(
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Descripción (opcional)…",
        }), required=False)

    dinerocaja = forms.DecimalField(
        min_value=0,
        widget=forms.NumberInput(attrs={
            "class": "form-control",
            "placeholder": "Dinero en caja",
            "step": "0.01",
        }), required=False)

    # ocultos
    sucursal = forms.ModelChoiceField(
        queryset=Sucursal.objects.none(),
        widget=forms.HiddenInput(), required=True)

    class Meta:
        fields = ("sucursal", "nombre", "descripcion", "dinerocaja")

    # ---------- queryset dinámico ----------
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        sin_pp = Sucursal.objects.annotate(
            tiene_pp=Exists(
                PuntosPago.objects.filter(sucursalid=OuterRef("pk"))
            )
        ).filter(tiene_pp=False)

        self.fields["sucursal"].queryset = sin_pp

    # ---------- validación mínima ----------
    def clean(self):
        cd = super().clean()
        if not cd.get("sucursal"):
            self.add_error("sucursal", "Seleccione una sucursal válida.")
        return cd

class PuntosPagoEditarForm(forms.Form):
    """
    Form para 'Editar Puntos de Pago': permite elegir/editar
    la Sucursal con un autocomplete y validamos que la sucursal sea válida.
    """
    # Nuevo campo de autocomplete (mostrará la sucursal actual y permitirá cambiarla)
    sucursal_autocomplete = forms.CharField(
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Escriba para buscar sucursal...',
            'autocomplete': 'off',
        })
    )
    
    # Sucursal oculta donde guardamos el ID resultante del autocomplete
    sucursal = forms.ModelChoiceField(
        queryset=Sucursal.objects.none(),
        widget=forms.HiddenInput(),
        required=True,
    )

    # Campos opcionales (usados en la parte superior del form para agregar un punto)
    nombre = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Nombre del punto de pago...',
        })
    )
    descripcion = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Descripción (opcional)...',
        })
    )
    dinerocaja = forms.DecimalField(
        required=False,
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'placeholder': 'Dinero en caja...',
            'min': '0.00',
            'step': '0.01'
        })
    )

    def __init__(self, *args, **kwargs):
        # Podemos recibir por kwargs un 'initial_sucursal_id'
        # o simplemente usar initial['sucursal'].
        super().__init__(*args, **kwargs)

        # Permitimos "todas" las sucursales, ya que la vista
        # se encargará de filtrar en el autocomplete.
        self.fields['sucursal'].queryset = Sucursal.objects.all()

        # Si existe un initial con 'sucursal_autocomplete' (nombre)
        # o 'sucursal', se puede prefijar. La vista lo hará.

    def clean(self):
        cleaned_data = super().clean()
        sucursal_obj = cleaned_data.get('sucursal')
        if not sucursal_obj:
            self.add_error('sucursal', 'Sucursal no válida.')
        return cleaned_data
    
class UsuarioForm(forms.ModelForm):
    """
    Formulario para crear usuarios con:
      • autocompletado de Rol
      • verificación de nombre único
      • confirmación de contraseña
    """

    # ---------- campo visible del autocomplete ----------
    rol_autocomplete = forms.CharField(
        label="Rol",
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Escribe para buscar rol…",
            "autocomplete": "off",
            "required": True,
        })
    )

    # ---------- los dos Password ----------
    password1 = forms.CharField(
        label="Contraseña",
        widget=forms.PasswordInput(attrs={
            "class": "form-control",
            "placeholder": "Contraseña",
            "required": True,
        }),
        min_length=6,
        error_messages={"required": "La contraseña es obligatoria."},
    )
    password2 = forms.CharField(
        label="Confirmar contraseña",
        widget=forms.PasswordInput(attrs={
            "class": "form-control",
            "placeholder": "Confirma la contraseña",
            "required": True,
        }),
        min_length=6,
    )

    class Meta:
        model  = Usuario
        fields = ("rolid", "nombreusuario", "password1", "password2")
        labels = {
            "nombreusuario": "Nombre de usuario",
        }
        widgets = {
            "rolid": forms.HiddenInput(),
            "nombreusuario": forms.TextInput(attrs={
                "class": "form-control",
                "placeholder": "Nombre de usuario",
                "required": True,
            }),
        }

    # ---------- init ----------
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["rolid"].queryset = Rol.objects.all()

    # ---------- validaciones ----------
    def clean_nombreusuario(self):
        nombre = self.cleaned_data["nombreusuario"].strip()
        if Usuario.objects.filter(nombreusuario__iexact=nombre).exists():
            raise forms.ValidationError("Ese nombre de usuario ya existe.")
        return nombre

    def clean(self):
        cd = super().clean()
        p1, p2 = cd.get("password1"), cd.get("password2")
        if p1 and p2 and p1 != p2:
            self.add_error("password2", "Las contraseñas no coinciden.")
        return cd

    # ---------- crear usuario ----------
    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password1"])
        if commit:
            user.save()
        return user

class UsuarioEditarForm(forms.ModelForm):
    """
    ▸ Edita un usuario existente (rol, username y contraseña opcional).
    ▸ `rol_autocomplete` es el campo visible; `rolid` queda oculto.
    """

    # ─────────── Campos visibles extra ───────────
    rol_autocomplete = forms.CharField(
        label="Rol",
        required=True,
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Escribe para buscar rol…",
            "autocomplete": "off",
        }),
    )

    contraseña = forms.CharField(
        label="Contraseña",
        required=False,                         # ← dejar vacío ⇒ no cambia
        widget=forms.PasswordInput(attrs={
            "class": "form-control",
            "placeholder": "Contraseña (vacío = sin cambios)",
        }),
    )
    confirmar_contraseña = forms.CharField(
        label="Confirmar contraseña",
        required=False,
        widget=forms.PasswordInput(attrs={
            "class": "form-control",
            "placeholder": "Confirmar contraseña",
        }),
    )

    # ─────────── Meta ───────────
    class Meta:
        model  = Usuario
        fields = ("rolid", "nombreusuario")     # los extras se añaden arriba
        labels = {
            "rolid"        : "Rol",
            "nombreusuario": "Nombre de usuario",
        }
        widgets = {
            "rolid": forms.HiddenInput(),
            "nombreusuario": forms.TextInput(attrs={
                "class": "form-control",
                "placeholder": "Nombre de usuario",
                "required": True,
            }),
        }

    # ─────────── init ───────────
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # queryset completo para el <select> oculto
        self.fields["rolid"].queryset = Rol.objects.all()

        # precargar datos del usuario que se está editando
        if self.instance.pk:
            rol_obj = getattr(self.instance, "rolid", None)  # ↲ ya es Rol
            if rol_obj:
                self.fields["rol_autocomplete"].initial = rol_obj.nombre
                self.fields["rolid"].initial            = rol_obj.pk

    # ─────────── validaciones ───────────
    def clean_nombreusuario(self):
        nombre = self.cleaned_data["nombreusuario"].strip()
        qs = (
            Usuario.objects
            .filter(nombreusuario__iexact=nombre)
            .exclude(pk=self.instance.pk)
        )
        if qs.exists():
            raise ValidationError(
                f'El nombre de usuario «{nombre}» ya existe.',
                code="duplicate",
            )
        return nombre

    def clean(self):
        cleaned = super().clean()
        pwd1, pwd2 = cleaned.get("contraseña"), cleaned.get("confirmar_contraseña")
        if pwd1 or pwd2:                       # sólo si al menos uno viene
            if pwd1 != pwd2:
                self.add_error("confirmar_contraseña", "Las contraseñas no coinciden.")
        return cleaned

    # ─────────── save ───────────
    def save(self, commit=True):
        """
        • Actualiza rol, usuario y contraseña (si se indicó).
        • Al ser ForeignKey, podemos asignar el objeto Rol directamente.
          - Si tu campo es int, usa:  usuario.rolid_id = self.cleaned_data["rolid"].pk
        """
        usuario = super().save(commit=False)

        # Rol
        usuario.rolid = self.cleaned_data["rolid"]          # objeto Rol

        # Contraseña (opcional)
        pwd = self.cleaned_data.get("contraseña")
        if pwd:
            usuario.set_password(pwd)

        if commit:
            usuario.save()
        return usuario

class GenerarVentaForm(forms.Form):
    cliente_id = forms.IntegerField(required=False)
    sucursal = forms.ModelChoiceField(
        queryset=Sucursal.objects.all(),
        required=True,
        label="Sucursal"
    )
    puntopago = forms.ModelChoiceField(
        queryset=PuntosPago.objects.all(),
        required=True,
        label="Punto de Pago"
    )
    productos = forms.CharField(
        widget=forms.HiddenInput(),
        required=False,
        label="Productos (JSON)"
    )
    cantidades = forms.CharField(
        widget=forms.HiddenInput(),
        required=False,
        label="Cantidades (JSON)"
    )
    medio_pago = forms.ChoiceField(
        choices=[('nequi', 'Nequi'), ('efectivo', 'Efectivo'), ('daviplata', 'Daviplata'), ('tarjeta', 'Tarjeta')],
        widget=forms.HiddenInput(),
        required=True,
        label="Medio de Pago"
    )

    def clean_productos(self):
        data = self.cleaned_data.get('productos', '[]')
        try:
            parsed = json.loads(data)
        except Exception:
            raise forms.ValidationError("Productos inválidos.")
        return parsed

    def clean_cantidades(self):
        data = self.cleaned_data.get('cantidades', '[]')
        try:
            parsed = json.loads(data)
        except Exception:
            raise forms.ValidationError("Cantidades inválidas.")
        return parsed



class PedidoProveedorForm(forms.Form):
    proveedor_autocomplete = forms.CharField(
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Buscar proveedor...',
            'autocomplete': 'off'
        })
    )
    proveedor = forms.ModelChoiceField(
        queryset=Proveedor.objects.all(),
        widget=forms.HiddenInput(),
        required=True
    )
    sucursal = forms.ModelChoiceField(
        queryset=Sucursal.objects.all(),
        widget=forms.Select(attrs={'class': 'form-control'}),
        required=True
    )
    fechaestimadaentrega = forms.DateField(
        required=False,
        input_formats=['%d/%m/%Y'],  # acepta dd/mm/yyyy
        widget=forms.TextInput(
            attrs={
                'class': 'form-control',
                'placeholder': 'dd/mm/yyyy'
            }
        )
    )
    comentario = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={
            'class': 'form-control',
            'placeholder': 'Comentario (opcional)',
            'rows': 3
        })
    )
    detalles = forms.CharField(
        required=True,
        widget=forms.HiddenInput()
    )

    def clean_fechaestimadaentrega(self):
        """
        Si el usuario no ingresa nada, puede quedar en blanco.
        Si ingresa algo, se valida con el formato dd/mm/yyyy
        (gracias a input_formats).
        """
        data = self.cleaned_data.get('fechaestimadaentrega')
        # data será un objeto date si pasa la validación
        # o None si no se ingresó
        return data
    
class LineaDevolucionForm(forms.Form):
    """Un input por línea de venta (cantidad a devolver)."""
    detalle_id = forms.IntegerField(widget=forms.HiddenInput)
    devolver   = forms.IntegerField(
        min_value=0, label="Cant.",
        widget=forms.NumberInput(attrs={"class": "form-control form-control-sm", "style": "width:5em"}))

DevolucionFormSet = formset_factory(LineaDevolucionForm, extra=0)

class DevolucionForm(forms.Form):
    """
    Form simple usado en ver_venta para indicar cuántas unidades
    se devuelven de cada DetalleVenta.
    """
    devolver   = forms.IntegerField(
        min_value=0,               # 0 = no devolver
        required=True,
        widget=forms.NumberInput(attrs={
            "class": "form-control text-end",
            "style": "width: 5rem;",
        })
    )
    detalle_id = forms.IntegerField(widget=forms.HiddenInput())