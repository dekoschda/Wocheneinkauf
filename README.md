# Wocheneinkauf PWA

Installierbare Web-App zum Erfassen und Auswerten von Kassenbons. Bons im PDF-, JPG-, PNG- oder WEBP-Format sowie alle Einkäufe werden ausschließlich im Browser des jeweiligen Geräts gespeichert.

## Veröffentlichung mit GitHub Pages

1. Den kompletten Inhalt dieses Ordners in das GitHub-Repository `Einkaufen` hochladen.
2. Im Repository **Settings → Pages** öffnen.
3. Unter **Build and deployment** die Quelle **Deploy from a branch** auswählen.
4. Branch **main** und Ordner **/(root)** auswählen und speichern.
5. Die App ist anschließend unter `https://dekoschda.github.io/Einkaufen/` erreichbar.

## Datensicherung

Unter **Auswertung → Datensicherung** können alle Einkäufe einschließlich der Foto- und PDF-Bons als JSON-Datei exportiert und auf einem anderen Gerät wieder importiert werden. Nach Änderungen erinnert die App an eine neue Sicherung.

## Hinweise

- Gespeicherte Foto- und PDF-Bons können in der Historie wieder geöffnet, heruntergeladen und zusammen mit Händler, Datum, Artikeln, Mengen, Preisen und Kategorien nachträglich bearbeitet werden.
- Die Auswertung enthält Wochen-, Monats- und Jahreszeiträume, einen Ausgabenverlauf, einen Vergleich zum vorherigen Zeitraum, getrennte Rabatt-/Pfandwerte, Preisentwicklungen und eine Zuordnungshilfe für unbekannte Artikel.
- Manuell gewählte Kategorien werden auf dem Gerät gespeichert und bei gleich benannten Artikeln künftig automatisch angewendet. Sie sind auch Bestandteil der vollständigen JSON-Sicherung.
- Die automatische Einteilung umfasst unter anderem Obst und Gemüse, Milchprodukte und Eier, Backwaren, Frühstück, Fleisch, Fisch, Grundnahrungsmittel, Vorräte, Tiefkühl- und Fertiggerichte, Getränke, Körperpflege, Reinigung, Haushalt, Tierbedarf sowie Baby und Kind.
- Die Texterkennung lädt Tesseract.js und für PDF-Dateien PDF.js bei Bedarf aus dem Internet. Manuelle Eingaben und gespeicherte Daten funktionieren auch offline.
- Über die Schaltfläche mit Mond bzw. Sonne kann zwischen Light Mode und einem neutral schwarzen Dark Mode gewechselt werden.
- Die App besitzt ein eigenes Wocheneinkauf-Symbol und kann über die dauerhaft sichtbare Schaltfläche **Installieren** zum Startbildschirm hinzugefügt werden.
- Beim Auslesen werden Summen-, Steuer- und Zahlungszeilen herausgefiltert. Pfand-, Leergutrückgaben und gesondert ausgewiesene Rabatte werden als Minusbeträge erkannt und vom Einkaufswert abgezogen.
- Reine Berechnungszeilen wie `-18 x 0,25` werden nicht als Artikel übernommen. Sie geben nur die Anzahl und den Einzelpfandwert an.
- Daten werden nicht automatisch zwischen Geräten synchronisiert.
- Angebotspreise werden nicht erfunden oder zwischengespeichert; die App öffnet aktuelle Suchseiten bei kaufDA und marktguru.
