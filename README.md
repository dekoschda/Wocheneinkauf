# Wocheneinkauf PWA

Installierbare Web-App zum Erfassen und Auswerten von Kassenbons. Alle Einkäufe und Bonbilder werden ausschließlich im Browser des jeweiligen Geräts gespeichert.

## Veröffentlichung mit GitHub Pages

1. Den kompletten Inhalt dieses Ordners in das GitHub-Repository `Einkaufen` hochladen.
2. Im Repository **Settings → Pages** öffnen.
3. Unter **Build and deployment** die Quelle **Deploy from a branch** auswählen.
4. Branch **main** und Ordner **/(root)** auswählen und speichern.
5. Die App ist anschließend unter `https://dekoschda.github.io/Einkaufen/` erreichbar.

## Datensicherung

Unter **Auswertung → Datensicherung** können alle Einkäufe und Bonbilder als JSON-Datei exportiert und auf einem anderen Gerät wieder importiert werden.

## Hinweise

- Die Texterkennung lädt Tesseract.js bei Bedarf aus dem Internet. Manuelle Eingaben und gespeicherte Daten funktionieren danach auch offline.
- Daten werden nicht automatisch zwischen Geräten synchronisiert.
- Angebotspreise werden nicht erfunden oder zwischengespeichert; die App öffnet aktuelle Suchseiten bei kaufDA und marktguru.
