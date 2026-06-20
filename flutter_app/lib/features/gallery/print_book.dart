import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

/// Builds a printable "coloring book" PDF from the child's finished Journal
/// pages and hands it to the system print / share-to-PDF sheet. Parity with the
/// web `buildPrintBook()` (which opens a print window of the gallery). One image
/// per A4 page, centered and scaled to fit, preceded by a simple cover page.
///
/// Returns false (and prints nothing) when there are no pages to include, so the
/// caller can surface the "color some pictures first" hint.
Future<bool> printColoringBook({
  required String title,
  required List<File> files,
}) async {
  if (files.isEmpty) return false;

  final doc = pw.Document();

  // Cover page — big friendly title, no image dependency so it always renders.
  doc.addPage(
    pw.Page(
      pageFormat: PdfPageFormat.a4,
      build: (context) => pw.Center(
        child: pw.Column(
          mainAxisAlignment: pw.MainAxisAlignment.center,
          children: [
            pw.Text('🎨', style: const pw.TextStyle(fontSize: 72)),
            pw.SizedBox(height: 24),
            pw.Text(
              title,
              textAlign: pw.TextAlign.center,
              style: pw.TextStyle(
                fontSize: 34,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    ),
  );

  // One page per finished picture. Decode lazily; skip any unreadable file so a
  // single corrupt PNG can't abort the whole book.
  for (final f in files) {
    try {
      final bytes = await f.readAsBytes();
      final image = pw.MemoryImage(bytes);
      doc.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.all(24),
          build: (context) => pw.Center(
            child: pw.Image(image, fit: pw.BoxFit.contain),
          ),
        ),
      );
    } catch (e) {
      if (kDebugMode) debugPrint('Skipping unreadable page ${f.path}: $e');
    }
  }

  // Hand off to the OS print dialog (also offers "Save to Files" / share-to-PDF).
  await Printing.layoutPdf(onLayout: (format) async => doc.save());
  return true;
}
