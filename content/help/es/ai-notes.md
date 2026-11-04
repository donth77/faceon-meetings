---
title: Notas de IA
summary: Un resumen, tareas pendientes y decisiones a partir de lo que se dice, creados en tu navegador.
category: hosting
order: 5
---

Las notas de IA convierten lo que se dice en una reunión en un resumen breve, una lista de tareas pendientes (con quién se encarga de cada una y para cuándo, si queda claro) y las decisiones tomadas. Están desactivadas a menos que el anfitrión de la reunión las permita y un anfitrión las inicie, todos pueden ver cuándo están activadas, y no se guarda nada a menos que quien toma las notas decida hacerlo.

## Permítelas en tus reuniones

Las notas de IA están desactivadas al principio en todas las cuentas. Para usarlas en las reuniones que organizas, ve a **Configuración**, luego a **Notas de IA**, y activa **Notas de IA en las reuniones que organizas**. En una reunión que organizas, **Más** y luego **Notas de IA** tiene un botón que te lleva allí.

Esta opción se guarda con tu cuenta, así que también se aplica a tus coanfitriones: mientras esté desactivada, nadie puede iniciar notas de IA en tus reuniones. Desactivarla también detiene las que estén activadas en una reunión que estés organizando en ese momento.

## Actívalas

Los anfitriones y coanfitriones seleccionan **Más**, luego **Notas de IA** y luego **Iniciar notas de IA**. Cada reunión empieza con ellas desactivadas. Las notas de IA no están disponibles en las reuniones de demostración, ni en las reuniones cuyo anfitrión no las permitió.

Quien las inicia es quien toma las notas: la transcripción se acumula en su navegador, y las notas se crean allí. Selecciona **Detener notas de IA** para terminarlas para todos. También se detienen cuando sale quien toma las notas.

## Inícialas automáticamente

Cuando tus reuniones permiten notas de IA, una reunión puede iniciarlas sola: activa **Iniciar las notas de IA automáticamente** al programarla, en la página de la reunión, en tu página **Sala personal** o en la reunión (**Participantes** y luego **⋯**). A partir de entonces, las notas de IA se inician en cuanto tú o un coanfitrión se unen, con el mismo mensaje para todos, y a quienes están por unirse se les avisa antes.

Se inician en el navegador de quien se une, siempre que pueda crear notas (consulta Cómo se crean las notas, más abajo). Si no puede, no se inician, y {appName} explica por qué, con un acceso a **Configuración**. Cuando alguien selecciona **Detener notas de IA**, se quedan desactivadas el resto de esa reunión, aunque alguien vuelva a unirse.

## Lo que ven todos

- **Notas de IA activadas** en la parte superior de la reunión, y un mensaje que dice quién las activó.
- Quienes están por unirse ven el mismo aviso antes de unirse o, en una reunión que inicia las notas de IA automáticamente, que se iniciarán.
- Para quedarte fuera de las notas, selecciona **Notas de IA activadas** y activa **No transcribirme**. A partir de ese momento, lo que dices no se transcribe, y quien toma las notas ve que elegiste esto.

## Cómo la voz se convierte en texto

El navegador de cada persona convierte lo que _ella_ dice en texto, en su propio dispositivo, y solo envía el texto a quien toma las notas. Para esto, el audio nunca sale del dispositivo de nadie, y no se transcribe nada mientras tienes el audio silenciado.

Funciona en Chrome en una computadora. La primera vez, Chrome necesita una descarga única para convertir tu idioma en texto: unos cientos de MB, que conserva. Puedes hacerla antes de una reunión, en **Configuración**, luego **Notas de IA** (**Transcripción en este dispositivo**), o antes de unirte a una reunión que tiene las notas de IA activadas. En una reunión, selecciona **Notas de IA activadas** y luego **Descargar ahora**. Hasta que termine, lo que dices no aparece en las notas, y quien toma las notas ve que estás esperando la descarga.

Si un navegador no puede transcribir en el dispositivo (Safari, Firefox y algunos celulares), las palabras de esa persona no aparecen en las notas, y quien toma las notas ve quién falta.

La transcripción agrupa las palabras de cada persona bajo su nombre y la hora, y empieza un párrafo nuevo cuando hace una pausa de medio minuto, y más o menos cada minuto de conversación.

## Cómo se crean las notas

Cuando quien toma las notas detiene las notas de IA, o sale, las notas se crean a partir de la transcripción. Si las notas de IA vuelven a iniciarse más tarde, se crean de nuevo con todo. Si, en cambio, el anfitrión de la reunión desactiva las notas de IA, solo se crean cuando seleccionas **Crear notas**. Elige cómo en **Configuración**, luego **Notas de IA**:

- **En esta computadora**: la IA integrada de Chrome crea las notas en la propia computadora de quien toma las notas. Es gratis, y nada sale de la computadora. La primera vez, Chrome descarga su IA, unos pocos gigabytes que pueden tardar un rato, y solo cuando seleccionas **Descargar y crear notas**. Necesita una versión reciente de Chrome en una computadora con suficiente memoria y espacio en disco, y escribe las notas en inglés, español o japonés (en inglés para los demás idiomas).
- **Tu propia clave de IA**: tu proveedor de IA (OpenAI, Anthropic, Google, DeepSeek u OpenRouter) crea las notas, con una clave de tu cuenta con ese proveedor. Tu navegador envía la transcripción directamente al proveedor, y es el proveedor quien te cobra. Selecciona **Probar clave** para comprobar que funciona.

> **Tu clave se queda en tu navegador.** {appName} nunca la recibe ni la guarda. Los planes gratuitos de algunos proveedores pueden usar lo que envías para mejorar sus productos, así que revisa las condiciones de tu proveedor antes de usar una clave gratuita en reuniones privadas.

## Después de la reunión

Las notas aparecen en el panel **Notas de IA**, y también después de que salgas de la reunión. Selecciona **Copiar** para copiarlas, o **Descargar .md** para guardarlas, con la transcripción, como un archivo Markdown. **Volver a crear** las crea de nuevo, por ejemplo de otra forma.

Hasta que las guardes, la transcripción y las notas solo están en esa pestaña del navegador: al cerrar la pestaña, se pierden. Selecciona **Eliminar notas y transcripción** para quitarlas antes.

## Guárdalas y compártelas

Si iniciaste sesión, puedes conservar las notas con la reunión:

- **Guardar en la reunión**: solo tú y el anfitrión de la reunión pueden verlas.
- **Compartir con los participantes**: todas las personas que estuvieron en la reunión con una cuenta también pueden verlas.

Un anfitrión puede configurar una reunión para **Compartir las notas de IA con los participantes automáticamente**: en el formulario para programar, en la página de la reunión, en la página de la sala personal o en la reunión, en **Participantes** › **⋯**. Así, las notas se guardan y se comparten en cuanto se crean, sin que nadie seleccione **Guardar**, y a todos se les avisa cuando se activan las notas de IA, antes de que hablen. Quien las guardó, o el anfitrión, puede seguir usando **Dejar de compartir** o eliminarlas. Las notas creadas por un coanfitrión sin cuenta no se pueden guardar, y así lo indican; cópialas o descárgalas para compartirlas.

Las notas guardadas están en **Anteriores**: selecciona **Ver detalles** en la reunión y luego **Ver notas de IA**. Allí, usa **Dejar de compartir** o **Eliminar notas** si las guardaste o si organizas la reunión. La transcripción se guarda con ellas cuando cabe (hasta unos 200 KB en total). Las notas guardadas se eliminan a los 90 días, o junto con la reunión.
