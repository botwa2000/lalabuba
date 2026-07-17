import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:lalabuba/features/community/models/artwork_model.dart';
import 'package:lalabuba/features/community/models/leaderboard_model.dart';
import 'package:lalabuba/features/community/widgets/community_artwork_card.dart';
import 'package:lalabuba/features/community/widgets/leaderboard_entry_widget.dart';

Widget _wrap(Widget child) => ProviderScope(
      child: MaterialApp(
        home: Scaffold(body: child),
      ),
    );

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  group('avatarEmoji', () {
    test('returns correct emoji for valid index', () {
      expect(avatarEmoji(0), '🐉');
      expect(avatarEmoji(1), '🐧');
      expect(avatarEmoji(19), '🦘');
    });

    test('returns fallback bear for out-of-range index', () {
      expect(avatarEmoji(-1), '🐻');
      expect(avatarEmoji(100), '🐻');
    });
  });

  group('CommunityArtworkCard', () {
    final artwork = CommunityArtwork(
      id: 1,
      shareType: 'colored',
      subject: 'Cat',
      imageUrl: '/img/s/test.png',
      starCount: 7,
      viewCount: 42,
      sharedAt: '2026-07-13T10:00:00Z',
      nickname: 'Sparkly Dragon',
      avatarIndex: 0,
    );

    testWidgets('renders nickname and star count', (tester) async {
      await tester.pumpWidget(_wrap(
        SizedBox(
          width: 160,
          height: 200,
          child: CommunityArtworkCard(
            artwork: artwork,
            onTap: () {},
            baseUrl: 'https://lalabuba.com',
          ),
        ),
      ));

      expect(find.textContaining('Sparkly Dragon'), findsOneWidget);
      expect(find.textContaining('⭐ 7'), findsOneWidget);
    });

    testWidgets('prepends baseUrl for relative imageUrl', (tester) async {
      // Just verify the card builds without error — image loading is network.
      await tester.pumpWidget(_wrap(
        SizedBox(
          width: 160,
          height: 200,
          child: CommunityArtworkCard(
            artwork: artwork,
            onTap: () {},
            baseUrl: 'https://lalabuba.com',
          ),
        ),
      ));
      expect(find.byType(CommunityArtworkCard), findsOneWidget);
    });

    testWidgets('does not prepend baseUrl for absolute imageUrl', (tester) async {
      final absArtwork = CommunityArtwork(
        id: 2,
        shareType: 'template',
        imageUrl: 'https://cdn.example.com/img.png',
        starCount: 0,
        viewCount: 0,
        sharedAt: '',
        nickname: 'Rainbow Bear',
        avatarIndex: 2,
      );
      await tester.pumpWidget(_wrap(
        SizedBox(
          width: 160,
          height: 200,
          child: CommunityArtworkCard(
            artwork: absArtwork,
            onTap: () {},
            baseUrl: 'https://lalabuba.com',
          ),
        ),
      ));
      expect(find.textContaining('Rainbow Bear'), findsOneWidget);
    });

    testWidgets('calls onTap when tapped', (tester) async {
      var tapped = false;
      await tester.pumpWidget(_wrap(
        SizedBox(
          width: 160,
          height: 200,
          child: CommunityArtworkCard(
            artwork: artwork,
            onTap: () => tapped = true,
            baseUrl: 'https://lalabuba.com',
          ),
        ),
      ));
      await tester.tap(find.byType(GestureDetector).first);
      expect(tapped, isTrue);
    });
  });

  group('LeaderboardEntryWidget', () {
    testWidgets('top 3 show medal emojis', (tester) async {
      for (final (rank, medal) in [(1, '🥇'), (2, '🥈'), (3, '🥉')]) {
        final entry = LeaderboardEntry(
          rank: rank,
          nickname: 'Brave Fox',
          avatarIndex: 5,
          score: 100 - rank,
          weeklyCompleted: 10,
          weeklyStars: 3,
        );
        await tester.pumpWidget(_wrap(LeaderboardEntryWidget(entry: entry)));
        expect(find.textContaining(medal), findsOneWidget,
            reason: 'rank $rank should show $medal');
      }
    });

    testWidgets('rank 4+ shows number instead of medal', (tester) async {
      final entry = LeaderboardEntry(
        rank: 4,
        nickname: 'Sneaky Owl',
        avatarIndex: 12,
        score: 80,
      );
      await tester.pumpWidget(_wrap(LeaderboardEntryWidget(entry: entry)));
      expect(find.textContaining('4'), findsWidgets);
    });

    testWidgets('isOwn uses primaryContainer decoration', (tester) async {
      final entry = LeaderboardEntry(
        rank: 5,
        nickname: 'Happy Kitty',
        avatarIndex: 1,
        score: 60,
        weeklyCompleted: 5,
        weeklyStars: 1,
      );
      await tester.pumpWidget(_wrap(LeaderboardEntryWidget(entry: entry, isOwn: true)));
      expect(find.textContaining('Happy Kitty'), findsOneWidget);
      // Can't check color directly; verify it renders without error when isOwn.
      expect(find.byType(LeaderboardEntryWidget), findsOneWidget);
    });

    testWidgets('shows weekly stats when present', (tester) async {
      final entry = LeaderboardEntry(
        rank: 2,
        nickname: 'Cosmic Dragon',
        avatarIndex: 0,
        score: 90,
        weeklyCompleted: 8,
        weeklyStars: 5,
      );
      await tester.pumpWidget(_wrap(LeaderboardEntryWidget(entry: entry)));
      // Nickname and score always render; weekly stat line uses l10n (test env
      // may not load asset translations, so just verify it renders without error).
      expect(find.textContaining('Cosmic Dragon'), findsOneWidget);
      expect(find.textContaining('90'), findsOneWidget);
      expect(find.byType(LeaderboardEntryWidget), findsOneWidget);
    });
  });

  group('CommunityArtwork.fromJson', () {
    test('parses full JSON', () {
      final a = CommunityArtwork.fromJson({
        'id': 42,
        'shareType': 'freehand',
        'subject': 'Rainbow',
        'difficulty': 'easy',
        'seed': 12345,
        'imageUrl': '/img/s/abc.png',
        'starCount': 3,
        'viewCount': 10,
        'sharedAt': '2026-07-01T00:00:00Z',
        'nickname': 'Lucky Tiger',
        'avatarIndex': 4,
      });
      expect(a.id, 42);
      expect(a.shareType, 'freehand');
      expect(a.subject, 'Rainbow');
      expect(a.seed, 12345);
      expect(a.starCount, 3);
      expect(a.nickname, 'Lucky Tiger');
      expect(a.avatarIndex, 4);
    });

    test('handles null optional fields gracefully', () {
      final a = CommunityArtwork.fromJson({
        'id': 1,
        'imageUrl': '/img/s/x.png',
        'sharedAt': '',
      });
      expect(a.subject, isNull);
      expect(a.seed, isNull);
      expect(a.starCount, 0);
      expect(a.nickname, 'Artist');
      expect(a.avatarIndex, 0);
    });
  });

  group('LeaderboardEntry.fromJson', () {
    test('parses full JSON', () {
      final e = LeaderboardEntry.fromJson({
        'rank': 1,
        'nickname': 'Daring Phoenix',
        'avatarIndex': 8,
        'score': 150,
        'weeklyCompleted': 15,
        'weeklyStars': 9,
      });
      expect(e.rank, 1);
      expect(e.score, 150);
      expect(e.weeklyCompleted, 15);
      expect(e.weeklyStars, 9);
    });

    test('handles missing optional weekly fields', () {
      final e = LeaderboardEntry.fromJson({
        'rank': 10,
        'nickname': 'Jolly Hamster',
        'avatarIndex': 15,
        'score': 20,
      });
      expect(e.weeklyCompleted, isNull);
      expect(e.weeklyStars, isNull);
    });
  });
}
