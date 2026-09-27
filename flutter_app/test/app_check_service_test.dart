import 'package:flutter_test/flutter_test.dart';
import 'package:lalabuba/shared/services/app_check_service.dart';

void main() {
  test('token() returns null (never throws) when App Check is not active', () async {
    // Firebase is not initialised in unit tests, so App Check never activated.
    // Generation must still proceed: the server decides what a missing token means.
    expect(await AppCheckService.token(), isNull);
  });
}
