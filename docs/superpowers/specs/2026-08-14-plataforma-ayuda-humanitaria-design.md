# Plataforma de Ayuda Humanitaria — Terremoto de Colombia (agosto 2026)

**Fecha:** 2026-08-14 · **Estado:** diseño aprobado en brainstorming, pendiente de revisión final del spec
**Contexto:** terremoto del lunes 10 de agosto de 2026. Regiones afectadas: Manizales (Caldas), Pereira (Risaralda), Quindío (Armenia), Cali (Valle del Cauca), Chocó (Quibdó) y zonas rurales de esos departamentos. Cientos de personas perdieron viviendas y negocios.

## 1. Propósito

Centralizar en una sola plataforma web información **fidedigna, verificada y en tiempo real** sobre:

- Solicitudes de ayuda reales (alimento, agua, albergue, materiales de construcción, remoción de escombros, salud, rescate).
- Centros de acopio de donaciones (qué reciben y qué ya NO necesitan).
- Voluntarios y solicitudes de personal (médicos, psicólogos, remoción de escombros, logística).
- Ofertas de servicios (alojamiento temporal, transporte, maquinaria, bodegas).
- Campañas de dinero verificadas (solo enlaces; la plataforma no procesa pagos).

Sirve a la vez como **portal público** (dónde ayudar, dónde pedir ayuda) y como **herramienta de coordinación** para alcaldías, ONG y grupos de voluntarios, de modo que las ayudas se destinen a donde más se necesitan y no se dupliquen.

**Bilingüe español/inglés** para canalizar donaciones de la diáspora y de donantes en Estados Unidos.

## 2. Restricciones y decisiones de contexto

| Tema | Decisión |
|---|---|
| Plazo | MVP sólido en ~1 semana |
| Presupuesto | Gratis o casi gratis |
| Operación | Grupo de voluntarios (moderación por turnos) |
| Canales de entrada | Formulario web móvil-primero + línea de WhatsApp atendida por voluntarios que transcriben (sin bot en V1) |
| Dinero | Solo enlaces a campañas verificadas (GoFundMe, cuentas de ONG). La plataforma nunca toca dinero → sin riesgo legal/fiscal |
| Registro | El público NO se registra. Solo moderadores, organizaciones y admins tienen cuenta |

## 3. Stack técnico

- **Frontend/app:** Next.js (App Router, TypeScript), móvil-primero. Una sola aplicación para portal público, formularios, panel de moderación y dashboard.
- **Backend:** Supabase capa gratuita — Postgres (datos), Auth (login y roles), Realtime (actualizaciones en vivo), Storage (fotos comprimidas).
- **Mapas:** MapLibre GL + OpenStreetMap (sin API keys ni costos). Visualizador de focos nacional en SVG con el mapa de Vemaps (ver §7).
- **i18n:** next-intl con rutas `/es` y `/en`.
- **Hosting:** Hostinger del usuario (Node + PM2 + HTTPS), desplegando desde GitHub. Supabase y OpenStreetMap son servicios externos independientes del hosting.
- **Gráficos de estadísticas:** librería ligera (Recharts o similar).

## 4. Modelo de datos (Postgres/Supabase)

Mockup de referencia: `mockups/modelo-datos.html`.

**Necesidades**
- `solicitudes_ayuda`: categoría (enum: alimentos, agua, albergue, materiales_construccion, remocion_escombros, salud, rescate, otro), descripción, nº personas afectadas, urgencia (alta/media/baja), municipio + detalle + lat/lng, estado (`sin_verificar → verificada → en_atencion → resuelta`, más `rechazada`, `duplicada`, `por_reconfirmar`), fotos, origen (web/whatsapp), contacto privado (nombre + teléfono), verificada_por/fecha, org_asignada.

**Recursos**
- `centros_acopio`: organización dueña, dirección, municipio, lat/lng, horarios, contacto público, listas "qué reciben" / "qué ya NO necesitan", estado (activo/lleno/cerrado), fecha de última actualización.
- `voluntarios`: habilidades (enum múltiple), disponibilidad, municipio, contacto privado, estado.
- `ofertas_servicios`: tipo (alojamiento, transporte, maquinaria, bodega, otro), capacidad, municipio, contacto privado, estado.
- `solicitudes_personal`: organización, habilidad requerida, cantidad, ubicación, estado.

**Organizaciones y roles**
- `organizaciones`: tipo (ONG, alcaldía, bomberos, iglesia, empresa, grupo comunitario), contacto, estado (pendiente/aprobada), descripción.
- `perfiles` (usuarios con login): rol (`admin`, `moderador`, `org`), organización asociada.

**Transversal**
- `municipios`: catálogo fijo con códigos DANE de los municipios de los 5 departamentos afectados (ampliable), para filtros consistentes.
- `campanas_dinero`: título y descripción en ES y EN, organización, URL, verificada_por.
- `historial_cambios`: entidad, id, estado anterior/nuevo, autor, fecha, nota. Alimenta estadísticas y "actualizado hace X".

**Reglas de privacidad (RLS a nivel de fila):**
- Los campos de contacto de afectados y voluntarios **nunca** son legibles por el rol anónimo. Vistas públicas sin esas columnas.
- Moderadores ven todo; organizaciones ven contactos solo de solicitudes que han tomado.

**Las categorías y estados son códigos** (no texto libre) → se traducen por diccionario en la UI y los filtros no se rompen. Los textos libres se muestran en su idioma original.

## 5. Flujo de verificación y moderación

Mockup de referencia: `mockups/flujo-verificacion.html`.

1. Un reporte entra por web (formulario abierto, sin registro) o por WhatsApp (voluntario lo transcribe desde el panel).
2. Queda **visible de inmediato** con etiqueta gris "sin verificar", sin foco en el mapa ni prioridad en listas.
3. Un **moderador verifica** (llama al teléfono privado o valida con una organización local) → sello "✓ verificada" con fecha y visibilidad plena.
4. Una **organización la "toma"** → estado "en atención"; las demás organizaciones ven que ya está cubierta (núcleo de la coordinación, evita ayuda duplicada).
5. La organización confirma la entrega → "resuelta" → suma a estadísticas de impacto.
6. **Caducidad:** una verificada/en atención sin actualización en 72 h pasa a "por reconfirmar" y pierde el sello hasta que un moderador la reconfirme. El mapa nunca presenta información vieja como actual.
7. Rechazada/duplicada: para spam, datos falsos o reportes repetidos (se fusionan).

Los acopios y ofertas de organizaciones **aprobadas** se publican directo, sin pasar por "sin verificar".

**Anti-abuso sin registro:** límite de reportes por IP/dispositivo por hora, honeypot contra bots, teléfono de contacto obligatorio (privado), botón público "reportar dato incorrecto" que alimenta la cola de moderación.

**Roles:** público (ver, reportar, ofrecerse), moderador (verificar/rechazar/fusionar/transcribir/reconfirmar, ve contactos), organización (publicar acopios, tomar/resolver solicitudes, pedir personal), admin (todo + aprobar organizaciones y moderadores + campañas de dinero).

## 6. Pantallas y dirección visual

Dirección elegida: **marco claro (portal accesible) + visualizador oscuro incrustado** ("híbrido", opción B). Mockups: `mockups/direccion-diseno.html`, `mockups/visualizador-focos-v2.html`.

- **Inicio:** titular bilingüe + tres acciones grandes (🆘 Pedir ayuda / 🤝 Quiero ayudar / 💵 Donar desde EE.UU.) + **visualizador de focos** (§7) + últimas verificadas + contadores en vivo.
- **Mapa operativo:** MapLibre con pines individuales, clustering animado, filtros por ciudad/categoría/estado, panel lateral con detalle.
- **Listas:** necesidades, acopios, voluntariado, servicios — con los mismos filtros y "actualizado hace X".
- **Detalle de necesidad:** categoría, descripción, urgencia, ubicación aproximada, estado con línea de tiempo, sello de verificación; sin datos de contacto públicos.
- **Cómo ayudar / Donate:** guía por ciudad + campañas de dinero verificadas (página clave para EE.UU.).
- **Panel de moderación** (login): cola de sin verificar/por reconfirmar, transcripción WhatsApp, gestión de acopios, aprobación de organizaciones.
- **Dashboard de estadísticas:** ver §8.

Elementos "cutting edge" transversales: contadores animados, indicador "● EN VIVO", sello de verificación con fecha como elemento de diseño, focos que pulsan según urgencia, móvil-primero.

## 7. Visualizador de focos (pieza distintiva)

Inspirado en covidvisualizer.com pero aplicado a Colombia:

- Silueta real de Colombia con 33 departamentos del **SVG de Vemaps** (`recursos/vemaps/co-07.svg`). **Atribución obligatoria visible: "Mapa: © Vemaps.com"** (requisito de licencia; el acuerdo está en `recursos/vemaps/0_License Agreement.rtf`).
- Tema oscuro; departamentos afectados iluminados; focos que pulsan sobre cada región (rojo = crítico, ámbar = alto), tamaño/color calculados de las necesidades urgentes sin resolver por municipio (datos de Supabase, no manuales).
- Clic en un foco → panel con números grandes animados de la región (activas, urgentes, acopios, voluntarios, resueltas + categorías más pedidas) → botón al mapa operativo filtrado.
- **Calibración geográfica ya resuelta** (validada en el mockup): proyección equirectangular con anclas en la isla de Malpelo y el extremo oriental; `x = 178.9 + (lon + 81.6) × 30.24`, `y = 322.7 + (4.0 − lat) × 30.05` en el viewBox 800×600 del SVG original; viewBox recortado a `245 30 400 555` para centrar el continente. Coordenadas ya computadas: Quibdó (328.3, 271.9), Manizales (362.8, 290.5), Pereira (357.6, 298.4), Armenia (357.9, 306.8), Cali (332.2, 339.2), Bogotá (406.6, 301.4). Los paths de los departamentos afectados se identifican por punto-en-polígono (script de referencia: `recursos/vemaps/gen_visualizador_referencia.py`; índices en co-07.svg: Chocó=2, Valle=13, Caldas=25, Quindío=31, Risaralda=33).

## 8. Estadísticas

- Contadores: activas, verificadas, resueltas, acopios abiertos, voluntarios — totales y por municipio.
- Gráficos: reportes vs. resueltas por día, desglose por categoría, tiempo mediano de resolución por región.
- Filtros por ciudad/categoría/rango de fechas. Exportación CSV para alcaldías, prensa y análisis propios.
- Fuente única: `historial_cambios` + conteos de tablas; sin captura manual.

## 9. Tiempo real

- Supabase Realtime empuja cambios (nuevas verificadas, cambios de estado, acopios actualizados) a mapa, listas y contadores sin recargar.
- Degradación: si el canal en vivo falla, polling cada 60 s. Siempre se muestra "actualizado hace X min" — la página nunca finge estar al día.

## 10. Resiliencia y manejo de errores

- **Conectividad rural:** páginas ligeras (objetivo < 200 KB sin mapa), mapa en carga diferida, fotos comprimidas en el dispositivo antes de subir.
- **Corte de señal en el formulario:** borrador guardado localmente y reenvío al recuperar conexión.
- **Supabase caído:** las páginas públicas sirven la última copia cacheada con aviso "datos de hace X min"; los formularios muestran error claro y conservan lo escrito.
- Validación de formularios con mensajes claros en ambos idiomas.
- Límites de tamaño de foto y tipos de archivo permitidos.

## 11. Seguridad y pruebas

- **RLS testeada automáticamente:** una suite ejecuta consultas como usuario anónimo y falla si algún campo de contacto es legible. Innegociable.
- Pruebas de transiciones de estado válidas (p. ej. "resuelta" no vuelve a "pendiente" sin moderador).
- E2E de los 3 flujos críticos: reportar necesidad → verificar como moderador → tomar/resolver como organización.
- Prueba de rendimiento del mapa con ~2.000 puntos.

## 12. Fuera de alcance en V1 (registrado para después)

- Bot automático de WhatsApp (API de WhatsApp Business).
- Procesamiento de pagos/donaciones en la plataforma.
- Registro de entregas logísticas detalladas (inventarios por acopio).
- Globo 3D como intro del visualizador (MapLibre lo permite; extra de ~medio día cuando haya tiempo).
- PWA con modo offline completo.
- Notificaciones push / suscripciones por correo.

## 13. Riesgos conocidos

- **Capa gratuita de Supabase:** 500 MB de datos y pausa por inactividad (no aplica con uso activo). Migrable a plan pago (~USD 25/mes) si el tráfico crece.
- **Moderación es el cuello de botella humano:** el diseño lo mitiga (publicación directa de orgs aprobadas, caducidad automática, fusión de duplicados), pero se necesita un turno de voluntarios constante.
- **Nombre y dominio pendientes:** "AyudaCol" en los mockups es un placeholder; decidir nombre real y dominio antes del lanzamiento.
- **Hostinger:** verificar que el plan del usuario soporte Node.js persistente (VPS); si es hosting compartido sin Node, alternativa inmediata: Vercel gratis sin cambiar nada del código.

## 14. Referencias

- Mockups interactivos: `docs/superpowers/specs/mockups/` (el visualizador v2 es autónomo; los demás se diseñaron dentro del frame del companion de brainstorming).
- Mapa Vemaps + licencia: `recursos/vemaps/`.
- Inspiración del visualizador: covidvisualizer.com.
