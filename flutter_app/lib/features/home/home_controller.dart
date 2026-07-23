import 'dart:convert';
import 'dart:math';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/subject_model.dart';

class DailyChallenge {
  final String word;      // English
  final int seed;
  final Map<String, String> translations;

  const DailyChallenge({
    required this.word,
    required this.seed,
    required this.translations,
  });

  String translate(String locale) => translations[locale] ?? word;
}

class HomeState {
  final List<SubjectCard> allCards;
  final List<SubjectCard> visibleCards;
  final DailyChallenge? dailyChallenge;
  final String subject;
  final bool loaded;

  const HomeState({
    this.allCards = const [],
    this.visibleCards = const [],
    this.dailyChallenge,
    this.subject = '',
    this.loaded = false,
  });

  HomeState copyWith({
    List<SubjectCard>? allCards,
    List<SubjectCard>? visibleCards,
    DailyChallenge? dailyChallenge,
    String? subject,
    bool? loaded,
  }) => HomeState(
        allCards: allCards ?? this.allCards,
        visibleCards: visibleCards ?? this.visibleCards,
        dailyChallenge: dailyChallenge ?? this.dailyChallenge,
        subject: subject ?? this.subject,
        loaded: loaded ?? this.loaded,
      );
}

class HomeNotifier extends AsyncNotifier<HomeState> {
  final _rng = Random();

  @override
  Future<HomeState> build() async {
    final cards = await _loadCards();
    final daily = await _loadDailyChallenge();
    final shuffled = [...cards]..shuffle(_rng);
    return HomeState(
      allCards: shuffled,
      visibleCards: shuffled.take(4).toList(),
      dailyChallenge: daily,
      loaded: true,
    );
  }

  void shuffle() {
    final s = state.value;
    if (s == null) return;
    final shuffled = [...s.allCards]..shuffle(_rng);
    state = AsyncData(s.copyWith(
      allCards: shuffled,
      visibleCards: shuffled.take(4).toList(),
    ));
  }

  void setSubject(String subject) {
    final s = state.value;
    if (s == null) return;
    state = AsyncData(s.copyWith(subject: subject));
  }

  /// Picks a random subject card. Returns it so the UI can show the *localized*
  /// label while still sending the English prompt to the API. The stored
  /// subject stays English (used as the generation prompt).
  SubjectCard? surpriseMe() {
    final s = state.value;
    if (s == null || s.allCards.isEmpty) return null;
    final card = s.allCards[_rng.nextInt(s.allCards.length)];
    state = AsyncData(s.copyWith(subject: card.englishPrompt));
    return card;
  }

  void selectCard(SubjectCard card) {
    final s = state.value;
    if (s == null) return;
    state = AsyncData(s.copyWith(subject: card.englishPrompt));
  }

  Future<List<SubjectCard>> _loadCards() async {
    final raw = await rootBundle.loadString('assets/data/subjects.json');
    final json = jsonDecode(raw) as Map<String, dynamic>;
    final subjects = (json['subjects'] as List)
        .map((e) => Subject.fromJson(e as Map<String, dynamic>))
        .toList();
    final actions = (json['actions'] as List)
        .map((e) => SubjectAction.fromJson(e as Map<String, dynamic>))
        .toList();

    final cards = <SubjectCard>[];
    for (final s in subjects) {
      for (final a in actions) {
        cards.add(SubjectCard(subject: s, action: a));
      }
    }
    cards.shuffle(_rng);
    return cards;
  }

  Future<DailyChallenge?> _loadDailyChallenge() async {
    try {
      final raw =
          await rootBundle.loadString('assets/data/daily_words.json');
      final json = jsonDecode(raw) as Map<String, dynamic>;
      final words = List<String>.from(json['words'] as List);
      final translations =
          json['translations'] as Map<String, dynamic>;

      final dayIndex = DateTime.now().millisecondsSinceEpoch ~/ 86400000;
      final word = words[dayIndex % words.length];
      final seed = (dayIndex * 1000003) % 2147483647;

      final trans = <String, String>{};
      (translations).forEach((lang, entries) {
        final m = entries as Map<String, dynamic>;
        if (m.containsKey(word)) {
          trans[lang] = m[word] as String;
        }
      });

      return DailyChallenge(word: word, seed: seed, translations: trans);
    } catch (_) {
      return null;
    }
  }
}

final homeProvider =
    AsyncNotifierProvider<HomeNotifier, HomeState>(HomeNotifier.new);
