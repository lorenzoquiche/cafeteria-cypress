# La Taza — pedidos de cafetería con Cypress

Aplicación de pedidos con interfaz web, API HTTP y persistencia JSON local. Node.js 24, Cypress + TypeScript. No requiere base de datos ni servicios externos.

## Ejecutar

```bash
npm ci
ENABLE_TEST_RESET=1 npm start
```

Abrir http://127.0.0.1:3000. En otra terminal:

```bash
npm run test:e2e
# o npm run test:e2e:open para observar cada prueba
```

En Windows PowerShell: `$env:ENABLE_TEST_RESET='1'; npm start`. Sin la variable, el endpoint de reinicio responde 404; para usarlo en pruebas es imprescindible activarla antes de iniciar el servidor.

## Arquitectura y contrato

- `public/`: HTML, CSS y JavaScript sin dependencias de frontend. Carrito en memoria del navegador; muestra disponibilidad, cantidades, total, éxito y error.
- `server/index.js`: servidor Node.js. `GET /api/products`, `POST /api/orders`, `GET /api/orders/:id`. Los precios y el stock se toman del servidor, nunca de la solicitud del cliente. Rechaza cantidades inválidas, repetidas o mayores que el stock; crea el pedido y descuenta existencias en una escritura síncrona y atómica mediante archivo temporal + rename. Cada pedido contiene UUID, líneas y `totalCents`.
- `data/cafeteria.json`: almacenamiento persistente, ignorado por Git. Se crea al primer acceso. Un solo proceso de servidor gestiona las solicitudes; este almacenamiento sencillo no está diseñado para despliegues con múltiples procesos.
- `cypress/e2e/pedidos.cy.ts`: tres recorridos independientes. `cypress.config.ts` fija `baseUrl`, video y captura en fallos.

## Datos y estabilidad

Con `ENABLE_TEST_RESET=1`, `POST /api/test/reset` restaura el catálogo y borra pedidos. Cada prueba ejecuta `cy.request('POST', '/api/test/reset')` antes de `cy.visit('/')`; ninguna depende del orden de ejecución ni de datos anteriores. El servidor también admite `DATA_FILE` para usar otro archivo aislado. Solo el fallo 503 se simula mediante `cy.intercept`; las demás operaciones llegan a la API y al archivo real. El test de éxito consulta el pedido mediante `GET /api/orders/:id` y verifica el total persistido. La prueba de validación cuenta las solicitudes POST interceptadas y exige cero. Se esperan respuestas mediante alias y estados visibles, sin pausas numéricas. Las capturas intencionales se generan con `cy.screenshot` y se ignoran en Git.

## CI y evidencias

El workflow `.github/workflows/e2e.yml` se ejecuta con push, pull request y manualmente. Instala dependencias con `npm ci`, inicia la API con reset habilitado y ejecuta Cypress. Guarda capturas y videos como artifact `evidencias-cypress` tanto en éxito como en fallo; Cypress toma capturas automáticas cuando falla y las cuatro capturas intencionales documentan los tres recorridos. Descarga el artifact de la ejecución para incluir las capturas en el PDF.

## Herramientas

Elegí **Cypress** porque la tarea exige Cypress y su interceptación da una aserción directa del request y una simulación reproducible de 503. Elegiría **Playwright** si necesitara cubrir varios motores de navegador o varias pestañas; **Agent Browser** para exploración asistida de una interfaz cambiante, no como sustituto de estas aserciones deterministas. Usé **ChatGPT/Codex** para proponer la estructura, implementar la aplicación y redactar los escenarios; revisé las aserciones y ejecuté comprobaciones de TypeScript y API local. La suite completa de Cypress debe ejecutarse en el equipo local o en Actions antes de enlazar un resultado exitoso; en el entorno de creación no se pudo instalar su ejecutable gráfico.

## Entrega PDF y video

PDF único: URL pública del repositorio, URL de una ejecución exitosa en Actions, capturas legibles del éxito (ID + total y respuesta 201), validación (mensaje y ausencia de POST), error (503) y recuperación (201). Añadir descripción de reset y de las esperas basadas en alias. Grabar video de hasta 3 minutos: menú y carrito; ejecutar éxito; explicar `cy.intercept('POST', '/api/orders').as('createOrder')` y la comprobación de solicitud/respuesta; enseñar la ejecución exitosa en la pestaña Actions. No incluir credenciales.

## Publicar en tu cuenta y ejecutar CI

En la carpeta descomprimida, después de verificar `npm run test:e2e` localmente:

```bash
git init
git add .
git commit -m "Aplicación de cafetería y pruebas E2E con Cypress"
git branch -M main
git remote add origin https://github.com/lorenzoquiche/cafeteria-cypress.git
git push -u origin main
```

Crea previamente el repositorio público vacío `cafeteria-cypress` desde tu propia cuenta; no marques la opción de crear README inicial. Si usas otro nombre, cambia la URL de `origin`. En GitHub abre **Actions → Cypress E2E → ejecución verde**, copia la URL de esa ejecución y descarga `evidencias-cypress`. Si CI falla, revisa sus logs y el mismo artifact antes de usar un enlace de entrega.

## Guion breve del video (máximo 3:00)

- **0:00–0:30:** Abre la web; señala el menú, precios, disponibilidad y carrito.
- **0:30–1:15:** Agrega dos Espresso y un Croissant, confirma; enseña el ID, el total Q 58.00 y el pedido persistido en `GET /api/orders/:id` o en la prueba.
- **1:15–2:10:** Enseña Cypress en ejecución. Explica el alias `@createOrder`: comprueba el cuerpo POST, el código 201 y el total; menciona el 503 simulado, el mensaje y el reintento. Muestra brevemente la validación sin POST.
- **2:10–2:50:** Muestra el workflow verde en GitHub Actions y su artifact. Explica el reset antes de cada prueba y las esperas por alias, sin pausas fijas.
- **2:50–3:00:** Cierra mostrando el enlace del repositorio. Comparte el enlace público del video en el PDF.

Los enlaces de repositorio, ejecución y video deben provenir de recursos reales y accesibles antes de generar el PDF final.
