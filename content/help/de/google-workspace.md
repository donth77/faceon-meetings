---
title: "{appName} zu Google Kalender und Gmail hinzufügen"
summary: Wählen Sie „{appName} meeting“ unter „Videokonferenz hinzufügen“ in Google Kalender, und fügen Sie in Gmail ein Meeting in eine E-Mail ein.
category: hosting
order: 4
---

Das Add-on von {appName} für Google Workspace bringt {appName} dorthin, wo Sie Meetings bereits planen: in Google Kalender und Gmail, im Browser am Computer. Sie fügen Ihre eigene Kopie in den Einstellungen von {appName} zu Ihrem Google-Konto hinzu.

## Hinzufügen

1. Öffnen Sie in {appName} **Einstellungen → Kalender** und wählen Sie unter **{appName} in Google Kalender und Gmail** die Option **{appName} hinzufügen**.
2. Google bittet Sie, {appName} zu erlauben, Apps-Script-Projekte in Ihrem Konto zu erstellen und zu aktualisieren. {appName} nutzt das nur, um sein Add-on dort abzulegen und aktuell zu halten.
3. Wählen Sie **In Apps Script öffnen** und dann **Bereitstellen → Bereitstellungen testen → Installieren**. Ein Add-on, das nicht im Marketplace ist, installiert Google nur auf diese Weise, dieser Schritt liegt also einmalig bei Ihnen.
4. Öffnen Sie Google Kalender. Wenn Sie {appName} dort zum ersten Mal verwenden, bittet Google Sie um Erlaubnis und warnt, dass es nicht überprüft ist. Das liegt daran, dass es Ihre eigene Kopie ist und keine aus dem Google Marketplace: Wählen Sie **Erweitert**, dann den Link zu {appName} und dann **Zulassen**.

Wenn Google meldet, dass die Apps Script API deaktiviert ist, öffnen Sie die [Apps-Script-Einstellungen](https://script.google.com/home/usersettings), schalten Sie **Google Apps Script API** ein und versuchen Sie es erneut. Gehört Ihr Google-Konto zu einer Schule oder einem Unternehmen, lässt dessen Admin Apps Script eventuell nicht zu.

Ihre Kopie funktioniert nur mit Ihrem Google-Konto: Wenn Sie sie mit jemandem teilen, funktioniert sie für diese Person nicht. Sie kann eine eigene hinzufügen.

## In Google Kalender: Videokonferenz hinzufügen

1. Erstellen oder öffnen Sie einen Termin.
2. Wählen Sie **Videokonferenz hinzufügen ▾** und dann **{appName} meeting**.

Der Termin erhält einen Link zum **Teilnehmen**, die Meeting-ID und den Kenncode, sodass alle Eingeladenen sie haben, und Google Kalender verschickt die Einladungen wie gewohnt.

Danach folgt {appName} dem Termin: Verschieben oder umbenennen Sie ihn, und das Meeting zieht mit, löschen Sie ihn, um das Meeting abzusagen. Ein Serientermin erhält eine Meeting-ID für alle Wiederholungen, und wenn Sie einen davon verschieben oder entfernen, geschieht in {appName} dasselbe. Änderungen kommen innerhalb weniger Minuten bei {appName} an.

Die Seite von {appName} für ein so erstelltes Meeting zeigt, dass es aus Google Kalender stammt, und öffnet den Termin. Ändern Sie die Uhrzeit dort; die Einstellungen von {appName}, etwa Kenncode, Warteraum und KI-Notizen, ändern Sie weiterhin auf der Seite von {appName}. Wenn Sie Google Kalender auch unter **Einstellungen → Kalender** verbunden haben, erhalten diese Meetings keinen zweiten Termin.

## Die Seitenleiste in Kalender und Gmail

Wählen Sie das {appName}-Symbol rechts in Google Kalender oder Gmail, um:

- ein **Meeting zu starten**, mit eigenem Link, zum sofortigen Teilnehmen oder Versenden.
- per 10-stelliger Meeting-ID an einem Meeting **teilzunehmen**.
- Ihre **nächsten Meetings** der Woche zu sehen, jeweils mit **Teilnehmen**.
- die Einladung Ihres **persönlichen Raums** anzuzeigen, zum Kopieren und Versenden.
- die **Einstellungen** zu öffnen.

## In Gmail: Ein Meeting in eine E-Mail einfügen

Öffnen Sie beim Schreiben einer E-Mail das Add-on-Menü unten im Fenster und wählen Sie **{appName}-Meeting einfügen**: ein neues Meeting, auf Wunsch mit Titel, oder Ihren persönlichen Raum. Die Einladung wird an der Cursorposition eingefügt.

## Was es sehen kann

- **In Google Kalender** den Termin, dem Sie ein {appName}-Meeting hinzufügen, solange er geöffnet ist. Um Meetings aktuell zu halten, prüft es auch die Termine, die sich danach in diesem Kalender ändern, und meldet {appName} nur die mit {appName}-Meetings.
- **In Gmail** nur den Text, den Sie einfügen möchten, in die E-Mail, die Sie gerade schreiben. Es liest nie Ihre E-Mails.

Über das Add-on erstellte Meetings zählen wie alle anderen zu Ihren Meeting-Limits ([Meeting-Limits](/help/meeting-limits)).

## Updates und Entfernen

{appName} hält Ihre Kopie selbst aktuell. Wenn Google das nicht mehr zulässt, bittet Sie **Einstellungen → Kalender**, **Add-on aktualisieren** zu wählen und es erneut zu erlauben.

Zum Entfernen wählen Sie **Entfernen** unter **Einstellungen → Kalender**. Um es auch aus Google zu entfernen, öffnen Sie es danach in Apps Script und wählen **Bereitstellen → Bereitstellungen testen → Deinstallieren**. Sie können das Projekt auch aus Ihren [Apps-Script-Projekten](https://script.google.com/home) löschen.

## Auf dem Smartphone

Die Smartphone-Apps von Google führen keine Add-ons aus, aber die Teilnahmedaten sind Teil des Termins: Öffnen Sie ihn in der Google Kalender-App und wählen Sie den Link, um teilzunehmen.
