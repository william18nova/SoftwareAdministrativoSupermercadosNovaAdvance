# mainApp/forms.py

from django import forms
from .models import Categoria, Cliente
import re
from django.core.exceptions import ValidationError

class CategoriaForm(forms.ModelForm):
    class Meta:
        model = Categoria
        fields = ['nombre', 'descripcion']
        labels = {
            'nombre': 'Nombre',
            'descripcion': 'Descripción',
        }
        widgets = {
            'nombre': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el nombre de la categoría',
                'required': 'required'
            }),
            'descripcion': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa una descripción (opcional)'
            }),
        }
    
    def clean_nombre(self):
        nombre = self.cleaned_data.get('nombre')
        if Categoria.objects.filter(nombre__iexact=nombre).exists():
            raise forms.ValidationError('El Nombre de la categoría ya está registrado.')
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
