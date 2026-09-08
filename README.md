# Wocheneinkauf PWA

Installierbare Web-App zum Erfassen und Auswerten von Kassenbons. Foto- und PDF-Bons sowie alle Einkäufe werden ausschließlich im Browser des jeweiligen Geräts gespeichert.

## Veröffentlichung mit GitHub Pages

1. Den kompletten Inhalt dieses Ordners in das GitHub-Repository `Einkaufen` hochladen.
2. Im Repository **Settings → Pages** öffnen.
3. Unter **Build and deployment** die Quelle **Deploy from a branch** auswählen.
4. Branch **main** und Ordner **/(root)** auswählen und speichern.
5. Die App ist anschließend unter `https://dekoschda.github.io/Einkaufen/` erreichbar.

## Datensicherung

Unter **Auswertung → Datensicherung** können alle Einkäufe einschließlich der Foto- und PDF-Bons als JSON-Datei exportiert und auf einem anderen Gerät wieder importiert werden. Nach Änderungen erinnert die App an eine neue Sicherung.

## Hinweise

- Die Texterkennung lädt Tesseract.js und für PDF-Dateien PDF.js bei Bedarf aus dem Internet. Manuelle Eingaben und gespeicherte Daten funktionieren auch offline.
- Über die Schaltfläche mit Mond bzw. Sonne kann zwischen Light und Dark Mode gewechselt werden.
- Daten werden nicht automatisch zwischen Geräten synchronisiert.
- Angebotspreise werden nicht erfunden oder zwischengespeichert; die App öffnet aktuelle Suchseiten bei kaufDA und marktguru.
