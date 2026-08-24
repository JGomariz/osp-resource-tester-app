Probador de Recursos: comprueba que los recursos de backend responden
correctamente en los entornos no productivos (ent1, ent2, ase).

## Descargas

| Sistema | Archivo | Qué hacer con él |
| --- | --- | --- |
| macOS (Apple Silicon e Intel) | `ProbadorDeRecursos-macos.zip` | Descomprime y arrastra `resource-tester.app` a Aplicaciones |
| Windows 10 y 11 (64 bits) | `ProbadorDeRecursos-windows.exe` | Ejecútalo tal cual: no hay instalador |

El `.zip` de macOS es solo el envoltorio — GitHub no puede servir una carpeta,
y un `.app` lo es. Dentro hay una única aplicación.

## La primera vez que lo abras

Los binarios **no están firmados**: firmarlos exige un certificado de Apple
Developer y uno de Authenticode, que están fuera del alcance de esta versión.
Los dos sistemas lo avisan la primera vez, y solo la primera vez.

### macOS — Gatekeeper

Aparece «no se puede abrir porque proviene de un desarrollador no
identificado». Cualquiera de estas vías sirve:

- **Ajustes del Sistema** (la vía que funciona en macOS actual): intenta
  abrir la aplicación con doble clic, acepta el aviso, y ve a **Ajustes del
  Sistema → Privacidad y seguridad**. Abajo aparecerá un botón **Abrir de
  todos modos**; púlsalo y confirma.
- **Clic derecho** (o Ctrl+clic) sobre la aplicación → **Abrir**. En macOS 15
  y posteriores esta vía ya no basta para una aplicación sin notarizar, así
  que si no ocurre nada, usa la anterior.
- **Desde el Terminal**, quitando la marca de cuarentena, que evita el aviso
  por completo:

  ```sh
  xattr -dr com.apple.quarantine /ruta/a/resource-tester.app
  ```

### Windows — SmartScreen

Aparece una pantalla azul «Windows protegió tu PC». Pulsa **Más información**
y luego **Ejecutar de todas formas**. El aviso no vuelve a salir para ese
archivo.

### Windows — WebView2

La aplicación usa el motor web del sistema, así que necesita **Microsoft Edge
WebView2 Runtime**. Viene ya instalado en Windows 11 y en cualquier Windows 10
actualizado; si faltara, se instala una vez desde la página de Microsoft
(«WebView2 Runtime», versión *Evergreen Standalone Installer*). No hace falta
en macOS, que trae WebKit de serie.
