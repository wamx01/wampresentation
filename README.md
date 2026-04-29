# Generador QR desde CSV

Aplicación estática para GitHub Pages que permite:

- subir un archivo CSV con un listado
- elegir la columna que se convertirá en QR
- usar una segunda columna como etiqueta visible
- personalizar el tamaño del QR y su margen
- descargar cada QR en PNG o exportar todos juntos en ZIP

## Archivos
- `index.html`, `styles.css`, `script.js`
- `.nojekyll` para servir el sitio sin Jekyll

## Uso local
Abre `index.html` en un navegador con acceso a internet para cargar las librerías del generador QR y del ZIP desde CDN.

## Publicar en GitHub Pages
1. Asegura que estos archivos estén en la raíz de la rama publicada.
2. En GitHub: Settings → Pages.
3. Source: Deploy from a branch.
4. Selecciona la rama y carpeta raíz.
5. Guarda y espera unos minutos.
