# Probador de Recursos

Aplicación de escritorio para comprobar que los recursos de backend responden
correctamente en los entornos **no productivos** (`ent1`, `ent2`, `ase`). Compone
la petición HTTP a partir de un catálogo, la envía y muestra la respuesta.

Se distribuye como un único archivo ejecutable para macOS y Windows: no hay
instalador ni servidor que levantar.

## Instalación

Descarga el archivo de tu sistema desde la
[última release](../../releases/latest):

| Sistema | Archivo | Qué hacer con él |
| --- | --- | --- |
| macOS (Apple Silicon e Intel) | `ProbadorDeRecursos-macos.zip` | Descomprime y arrastra `resource-tester.app` a Aplicaciones |
| Windows 10 y 11 (64 bits) | `ProbadorDeRecursos-windows.exe` | Ejecútalo tal cual |

Los binarios **no están firmados**, así que la primera vez —y solo la primera—
macOS (Gatekeeper) y Windows (SmartScreen) avisan de que el desarrollador no
está identificado. Las notas de cada release explican cómo continuar en cada
sistema; el detalle vive en [`.github/release-notes.md`](.github/release-notes.md).

En Windows hace falta **Microsoft Edge WebView2 Runtime**, ya incluido en
Windows 11 y en cualquier Windows 10 actualizado. macOS no necesita nada: usa
el WebKit del sistema.

## Uso

1. Elige el **Entorno** (`ent1`, `ent2` o `ase`) e introduce el **Document ID**
   del cliente.
2. Selecciona un **Recurso** en el árbol lateral. Los recursos aún sin
   configurar aparecen listados pero no son invocables.
3. Ajusta los parámetros de consulta que muestre la cabecera. Un parámetro
   vacío desaparece por completo de la URL, no se envía vacío.
4. Revisa la **URL final**, que es editable, y pulsa enviar.
5. Lee la respuesta abajo: **Formateado** (JSON o XML) o **Sin formato**, con
   buscador que resalta las coincidencias y permite saltar entre ellas.

Un indicador de solo lectura señala si la llamada sale por **Zuul** o por
**Apigee**. No es un ajuste: se deduce del prefijo de la URL final.

### Zuul y Apigee

Cada Recurso está fijado a una pasarela en el catálogo.

- **Zuul** — se llama directamente, sin token:
  `https://zuul-uat2.int.si.orange.es:9061` (ent1),
  `https://zuul-uat.int.si.orange.es:9061` (ent2),
  `https://zuul-ase.int.si.orange.es:9061` (ase).
- **Apigee** — base
  `https://api-{entorno}-openapi.cloudready-nonprod.cloud.si.orange.es/jwt`.
  Antes de **cada** petición se genera un token nuevo contra
  `…/jwtgenerator/v1/token` con el Document ID introducido, y se envía en la
  cabecera `Authorization`. El último token de la sesión se puede consultar y
  copiar en el desplegable **Último token**, útil cuando se sospecha de la
  autenticación.

## El catálogo

El árbol de Servicios y Recursos, y la especificación de cada petición (método,
ruta, parámetros y pasarela), viven en un `catalog.json` editable. **No hace
falta recompilar la aplicación para cambiarlo.**

En el primer arranque se escribe una copia del catálogo incluido en el binario,
dentro de la carpeta de configuración del sistema:

- macOS: `~/Library/Application Support/es.masorange.resourcetester/catalog.json`
- Windows: `%APPDATA%\es.masorange.resourcetester\catalog.json`

La propia aplicación ofrece abrir esa ubicación en el explorador de archivos.

Si el archivo falta, no se puede leer o no es válido, la aplicación **no se
rompe**: muestra el catálogo incluido en el binario junto a un aviso que nombra
el archivo y el motivo exacto.

### Formato

```json
{
  "nodes": [
    {
      "kind": "service",
      "name": "CRMB2B",
      "children": [
        {
          "kind": "resource",
          "name": "Lines",
          "method": "GET",
          "gateway": "apigee",
          "path": "/crbproductinventory/v1/lines",
          "params": [
            { "name": "docId", "kind": "text", "source": "documentId" },
            { "name": "status", "kind": "dropdown", "options": ["active", "suspended"] }
          ]
        },
        { "kind": "resource", "name": "ServiciosCentrex" }
      ]
    },
    { "kind": "service", "name": "MDG" }
  ]
}
```

- `kind`: `service` (agrupa, no tiene endpoint) o `resource` (la unidad que se
  prueba).
- `gateway`: `zuul` o `apigee`.
- `path`: se añade a la URL base de la pasarela; empieza por `/`.
- `params[].kind`: `text` (campo libre) o `dropdown` (`options` fijas).
- `params[].source`: `documentId` vincula el parámetro al campo compartido
  Document ID en vez de darle su propio control.
- Un recurso sin `method`/`path` queda *sin definir*: se ve en el árbol pero no
  se puede enviar.

## Desarrollo

Requiere Node (versión en [`.nvmrc`](.nvmrc)) y la
[toolchain de Rust](https://www.rust-lang.org/tools/install).

```sh
npm ci
npm run tauri dev    # aplicación en modo desarrollo
npm test             # Vitest sobre el motor
npm run typecheck    # TypeScript sin emitir
cd src-tauri && cargo test
```

### Estructura

| Ruta | Qué contiene |
| --- | --- |
| `src/engine/` | La lógica: catálogo, composición de URL, envío, vista de respuesta. Sin React ni Tauri, y donde viven los tests |
| `src/components/` | La interfaz React |
| `src/lib/` | Adaptadores a Tauri (transporte HTTP, acceso al catálogo) |
| `src-tauri/` | Shell Rust: ventana, peticiones HTTP y acceso a disco |
| `src/catalog/default-catalog.json` | El catálogo incluido en el binario |

El motor es deliberadamente independiente del framework: el transporte y el
acceso al archivo se inyectan, de modo que las decisiones se prueban sin red ni
disco. Ver [`CONTEXT.md`](CONTEXT.md) para el vocabulario del dominio y
[`docs/adr/`](docs/adr/) para las decisiones de arquitectura.

## Publicar una versión

El [workflow de release](.github/workflows/release.yml) se dispara al empujar
una etiqueta `v*`:

```sh
git tag v1.0.0
git push origin v1.0.0
```

Primero pasan los tests y el typecheck; solo entonces se compilan los binarios
de macOS (universal, Apple Silicon e Intel) y Windows, y se publican como
adjuntos de la release. Una ejecución manual (`workflow_dispatch`) construye los
mismos binarios pero no publica nada: sirve para comprobar la compilación.
