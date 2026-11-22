# WEST-VILL · Aplicación de viajes y administración

Esta carpeta contiene la PWA que Render publica como aplicación principal.

## Alcance
- Panel administrativo de solicitudes, viajes, clientes, ingresos, gastos y cuentas pendientes.
- Diseño adaptable de una sola aplicación, con navegación vertical en móviles.
- Manifiesto instalable configurado para abrir en modo independiente y orientación vertical.
- Service worker propio de WEST-VILL, sin reutilizar cachés del juego ILOX anterior.

## Separación y preservación
- Los archivos del juego 3D y su interfaz antigua no forman parte de esta PWA.
- Se conserva sin modificaciones `multiplayer.js` y el proyecto Supabase existente para no destruir la identidad/chat ni los datos históricos.
- No se modifica ninguna tabla, migración ni registro de Supabase.
- El panel actual todavía mantiene los registros de formularios en memoria local de la vista; no se presenta como persistencia ya conectada.

## Publicación
Render publica esta carpeta desde el servicio existente `ilox-mundo-abierto`.