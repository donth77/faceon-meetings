---
title: "Agregar {appName} a Google Calendar y Gmail"
summary: Elige “{appName} meeting” en Agregar videoconferencia de Google Calendar, y pon una reunión en un correo en Gmail.
category: hosting
order: 4
---

El complemento de {appName} para Google Workspace pone {appName} donde ya planificas tus reuniones: Google Calendar y Gmail, en el navegador de una computadora. Agregas tu propia copia a tu cuenta de Google desde la Configuración de {appName}.

## Agrégalo

1. En {appName}, abre **Configuración → Calendario** y selecciona **Agregar {appName}** en **{appName} en Google Calendar y Gmail**.
2. Google te pide que permitas que {appName} cree y actualice proyectos de Apps Script en tu cuenta. {appName} usa esto solo para poner allí su complemento y mantenerlo actualizado.
3. Selecciona **Abrir en Apps Script** y luego **Implementar → Probar implementaciones → Instalar**. Google solo instala de esta forma un complemento que no está en su Marketplace, así que este paso te toca a ti, una sola vez.
4. Abre Google Calendar. La primera vez que uses {appName} allí, Google te pedirá que lo permitas y te advertirá que no está verificado. Es porque se trata de tu propia copia, no de una publicada en Google Marketplace: selecciona **Configuración avanzada**, luego **Ir a {appName}** y luego **Permitir**.

Si Google dice que la API de Apps Script está desactivada, abre la [configuración de Apps Script](https://script.google.com/home/usersettings), activa **Google Apps Script API** y vuelve a intentarlo. Si tu cuenta de Google pertenece a una escuela o una empresa, es posible que su administrador no permita Apps Script.

Tu copia solo funciona con tu cuenta de Google: si la compartes con alguien, no le funcionará. Esa persona puede agregar la suya.

## En Google Calendar: Agregar videoconferencia

1. Crea o abre un evento.
2. Selecciona **Agregar videoconferencia ▾** y elige **{appName} meeting**.

El evento recibe un enlace **Unirse**, el ID de reunión y el código de acceso, así que todas las personas que invitas los tienen, y Google Calendar envía las invitaciones como siempre.

Después, {appName} sigue el evento: muévelo o cámbiale el nombre y la reunión cambia con él, y elimínalo para cancelar la reunión. Un evento que se repite recibe un solo ID de reunión para todas sus ocurrencias, y mover o quitar una de ellas hace lo mismo en {appName}. Los cambios llegan a {appName} en pocos minutos.

La página de {appName} de una reunión creada así indica que viene de Google Calendar y abre el evento. Cambia su hora allí; su configuración de {appName}, como el código de acceso, la sala de espera y las notas de IA, se sigue cambiando en la página de {appName}. Si también conectaste Google Calendar en **Configuración → Calendario**, estas reuniones no reciben un segundo evento.

## El panel lateral en Calendar y Gmail

Selecciona el ícono de {appName} a la derecha de Google Calendar o Gmail para:

- **Iniciar una reunión** con su propio enlace, para unirte ahora o enviarlo.
- **Unirse** a una reunión con su ID de reunión de 10 dígitos.
- Ver tus **próximas reuniones** de la semana, cada una con **Unirse**.
- Mostrar la invitación de tu **sala personal**, para copiarla y enviarla.
- Abrir **Configuración**.

## En Gmail: pon una reunión en un correo

Mientras escribes un correo, abre el menú de complementos en la parte inferior de la ventana y elige **Insertar una reunión de {appName}**: una reunión nueva, con título si quieres, o tu sala personal. La invitación se inserta donde está el cursor.

## Qué puede ver

- **En Google Calendar,** el evento al que agregas una reunión de {appName}, mientras lo tienes abierto. Para mantener las reuniones al día, también revisa los eventos que cambian después en ese calendario, y solo le informa a {appName} sobre los que tienen reuniones de {appName}.
- **En Gmail,** solo el texto que eliges insertar, en el correo que estás escribiendo. Nunca lee tu correo.

Las reuniones creadas con el complemento cuentan para tus límites de reuniones como cualquier otra ([Límites de las reuniones](/help/meeting-limits)).

## Actualizaciones y cómo quitarlo

{appName} mantiene tu copia actualizada por sí solo. Si Google deja de permitirlo, **Configuración → Calendario** te pedirá que selecciones **Actualizar el complemento** y vuelvas a permitirlo.

Para quitarlo, selecciona **Quitar** en **Configuración → Calendario**. Luego, para sacarlo también de Google, ábrelo en Apps Script y selecciona **Implementar → Probar implementaciones → Desinstalar**. También puedes borrar el proyecto de tus [proyectos de Apps Script](https://script.google.com/home).

## En un celular

Las apps de Google para celulares no ejecutan complementos, pero los datos para unirse forman parte del evento: ábrelo en la app de Google Calendar y selecciona el enlace para unirte.
