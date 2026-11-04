---
title: KI-Notizen
summary: Eine Zusammenfassung, Aufgaben und Entscheidungen aus dem Gesagten, erstellt in Ihrem Browser.
category: hosting
order: 5
---

KI-Notizen machen aus dem, was in einem Meeting gesagt wird, eine kurze Zusammenfassung, eine Liste von Aufgaben (mit Zuständigkeit und Termin, wenn das klar ist) und die getroffenen Entscheidungen. Sie sind aus, es sei denn, der Host des Meetings erlaubt sie und ein Host startet sie, alle sehen, wenn sie an sind, und nichts wird gespeichert, es sei denn, die Person, die die Notizen erstellt, entscheidet sich dafür.

## In Ihren Meetings erlauben

KI-Notizen sind anfangs für jedes Konto aus. Um sie in Meetings zu nutzen, die Sie veranstalten, öffnen Sie **Einstellungen**, dann **KI-Notizen**, und schalten Sie **KI-Notizen in Meetings, die Sie veranstalten** ein. In einem Meeting, das Sie veranstalten, führt eine Schaltfläche unter **Mehr** und dann **KI-Notizen** dorthin.

Diese Einstellung wird mit Ihrem Konto gespeichert und gilt daher auch für Ihre Co-Hosts: Solange sie aus ist, kann niemand KI-Notizen in Ihren Meetings starten. Wenn Sie sie ausschalten, werden auch laufende KI-Notizen in einem Meeting beendet, das Sie gerade veranstalten.

## Einschalten

Hosts und Co-Hosts wählen **Mehr**, dann **KI-Notizen** und dann **KI-Notizen starten**. Jedes Meeting beginnt ohne sie. KI-Notizen gibt es nicht in Demo-Meetings und nicht in Meetings, deren Host sie nicht erlaubt hat.

Wer sie startet, erstellt die Notizen: Das Transkript sammelt sich in dessen Browser, und die Notizen entstehen dort. Wählen Sie **KI-Notizen beenden**, um sie für alle zu beenden. Sie enden auch, wenn die Person, die die Notizen erstellt, das Meeting verlässt.

## Automatisch starten

Sobald Ihre Meetings KI-Notizen erlauben, kann ein Meeting sie selbst starten: Aktivieren Sie **KI-Notizen automatisch starten** beim Planen, auf der Seite des Meetings, auf Ihrer Seite **Persönlicher Raum** oder im Meeting (**Teilnehmer** und dann **⋯**). Von da an starten KI-Notizen, sobald Sie oder ein Co-Host beitreten, mit derselben Nachricht für alle, und wer gerade beitreten will, wird vorher informiert.

Sie starten im Browser der beitretenden Person, sofern dieser Notizen erstellen kann (siehe „Wie die Notizen entstehen“ weiter unten). Kann er das nicht, starten sie nicht, und {appName} sagt, warum, mit einem Weg zu den **Einstellungen**. Sobald jemand **KI-Notizen beenden** wählt, bleiben sie für den Rest des Meetings aus, auch wenn jemand erneut beitritt.

## Was alle sehen

- **KI-Notizen an** oben im Meeting und eine Nachricht, wer sie eingeschaltet hat.
- Wer gerade beitreten will, sieht denselben Hinweis vor dem Beitreten, oder, bei einem Meeting, das KI-Notizen automatisch startet, dass sie starten werden.
- Um nicht in den Notizen vorzukommen, wählen Sie **KI-Notizen an** und aktivieren Sie **Mich nicht transkribieren**. Ab dann wird nicht transkribiert, was Sie sagen, und die Person, die die Notizen erstellt, sieht, dass Sie das gewählt haben.

## Wie Sprache zu Text wird

Der Browser jeder Person wandelt das, was _sie_ sagt, auf ihrem eigenen Gerät in Text um und sendet nur den Text an die Person, die die Notizen erstellt. Audio verlässt dafür nie das Gerät von irgendjemandem, und während Sie stummgeschaltet sind, wird nichts transkribiert.

Das funktioniert in Chrome am Computer. Beim ersten Mal braucht Chrome einen einmaligen Download, um Ihre Sprache in Text umzuwandeln: einige hundert MB, die es behält. Sie können ihn vor einem Meeting erledigen, unter **Einstellungen**, dann **KI-Notizen** (**Transkription auf diesem Gerät**), oder bevor Sie einem Meeting mit aktiven KI-Notizen beitreten. Wählen Sie im Meeting **KI-Notizen an** und dann **Jetzt herunterladen**. Bis der Download fertig ist, kommt das, was Sie sagen, nicht in die Notizen, und die Person, die die Notizen erstellt, sieht, dass Sie darauf warten.

Wo ein Browser nicht auf dem Gerät transkribieren kann (Safari, Firefox und manche Smartphones), fehlen die Worte dieser Person in den Notizen, und die Person, die die Notizen erstellt, sieht, wer fehlt.

Das Transkript gruppiert die Worte jeder Person unter ihrem Namen und der Uhrzeit und beginnt einen neuen Absatz, wenn sie eine halbe Minute pausiert, und etwa nach jeder Minute Redezeit.

## Wie die Notizen entstehen

Wenn die Person, die die Notizen erstellt, die KI-Notizen beendet oder das Meeting verlässt, entstehen die Notizen aus dem Transkript. Starten KI-Notizen später erneut, werden sie mit allem neu erstellt. Schaltet stattdessen der Host des Meetings die KI-Notizen aus, entstehen sie erst, wenn Sie **Notizen erstellen** wählen. Wie, legen Sie unter **Einstellungen** und dann **KI-Notizen** fest:

- **Auf diesem Computer**: Die integrierte KI von Chrome erstellt die Notizen auf dem Computer der Person, die die Notizen erstellt. Das ist kostenlos, und nichts verlässt den Computer. Beim ersten Mal lädt Chrome seine KI herunter, einige Gigabyte, was eine Weile dauern kann, und zwar erst, wenn Sie **Herunterladen und Notizen erstellen** wählen. Sie brauchen ein aktuelles Chrome auf einem Computer mit genug Arbeitsspeicher und Speicherplatz, und die Notizen werden auf Englisch, Spanisch oder Japanisch geschrieben (bei anderen Sprachen auf Englisch).
- **Ihr eigener KI-Schlüssel**: Ihr KI-Anbieter (OpenAI, Anthropic, Google, DeepSeek oder OpenRouter) erstellt die Notizen, mit einem Schlüssel aus Ihrem Konto dort. Ihr Browser sendet das Transkript direkt an den Anbieter, und der rechnet mit Ihnen ab. Wählen Sie **Schlüssel testen**, um zu prüfen, ob er funktioniert.

> **Ihr Schlüssel bleibt in Ihrem Browser.** {appName} empfängt oder speichert ihn nie. Die kostenlosen Tarife mancher Anbieter dürfen das, was Sie senden, zur Verbesserung ihrer Produkte nutzen, prüfen Sie also die Bedingungen Ihres Anbieters, bevor Sie einen kostenlosen Schlüssel für vertrauliche Meetings verwenden.

## Nach dem Meeting

Die Notizen erscheinen im Bereich **KI-Notizen** und auch, nachdem Sie das Meeting verlassen haben. Wählen Sie **Kopieren**, um sie zu kopieren, oder **.md herunterladen**, um sie mit dem Transkript als Markdown-Datei zu speichern. **Neu erstellen** erstellt sie erneut, zum Beispiel auf eine andere Art.

Bis Sie sie speichern, bleiben Transkript und Notizen nur in diesem Browser-Tab: Wenn Sie den Tab schließen, sind sie weg. Wählen Sie **Notizen und Transkript löschen**, um sie früher zu entfernen.

## Speichern und teilen

Wenn Sie angemeldet sind, können Sie die Notizen beim Meeting aufbewahren:

- **Im Meeting speichern**: Nur Sie und der Host des Meetings können sie sehen.
- **Mit Teilnehmern teilen**: Auch alle, die mit einem Konto im Meeting waren, können sie sehen.

Ein Host kann ein Meeting auf **KI-Notizen automatisch mit Teilnehmern teilen** einstellen: im Planungsformular, auf der Seite des Meetings, auf der Seite des persönlichen Raums oder im Meeting unter **Teilnehmer** › **⋯**. Dann werden die Notizen gespeichert und geteilt, sobald sie fertig sind, ohne dass jemand **Speichern** wählt, und alle werden darüber informiert, wenn KI-Notizen starten, bevor sie sprechen. Wer sie gespeichert hat, oder der Host, kann weiterhin **Teilen beenden** wählen oder sie löschen. Notizen eines Co-Hosts ohne Konto können nicht gespeichert werden, und sie weisen darauf hin; kopieren Sie sie oder laden Sie sie herunter, um sie zu teilen.

Gespeicherte Notizen finden Sie unter **Vergangen**: Wählen Sie beim Meeting **Details ansehen** und dann **KI-Notizen ansehen**. Dort wählen Sie **Teilen beenden** oder **Notizen löschen**, wenn Sie sie gespeichert haben oder das Meeting veranstalten. Das Transkript wird mit ihnen gespeichert, wenn es passt (insgesamt bis etwa 200 KB). Gespeicherte Notizen werden nach 90 Tagen gelöscht, oder mit dem Meeting.
