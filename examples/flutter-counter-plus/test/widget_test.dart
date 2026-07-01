import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_counter_plus/main.dart';

void main() {
  testWidgets('Counter Plus exposes navigation and form states', (tester) async {
    await tester.pumpWidget(const CounterPlusApp());

    expect(find.text('Counter Plus'), findsOneWidget);
    expect(find.text('0'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.add));
    await tester.pump();
    expect(find.text('1'), findsOneWidget);

    await tester.tap(find.text('Feedback'));
    await tester.pumpAndSettle();
    expect(find.text('Message'), findsOneWidget);
    expect(find.text('Submit feedback'), findsOneWidget);
  });
}
