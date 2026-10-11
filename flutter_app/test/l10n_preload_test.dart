import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lalabuba/core/l10n/l10n_service.dart';

void main() {
  test('a preloaded locale is available on the first read (no raw-key frame)', () {
    const de = L10n('de', {'heroHeading': 'Was wollen wir zeichnen?'});
    final c = ProviderContainer(overrides: [initialL10nProvider.overrideWithValue(de)]);
    addTearDown(c.dispose);
    // Read before the async notifier settles: must already be translated.
    expect(c.read(l10nProvider).t('heroHeading'), 'Was wollen wir zeichnen?');
    expect(c.read(l10nProvider).locale, 'de');
  });
}
