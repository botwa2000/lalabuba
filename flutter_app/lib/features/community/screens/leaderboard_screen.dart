import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../community_service.dart';
import '../models/leaderboard_model.dart';
import '../widgets/leaderboard_entry_widget.dart';

class LeaderboardScreen extends ConsumerStatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  ConsumerState<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends ConsumerState<LeaderboardScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  Leaderboard? _weeklyData;
  Leaderboard? _alltimeData;
  bool _loadingWeekly = false;
  bool _loadingAlltime = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    _tabCtrl.addListener(() {
      if (!_tabCtrl.indexIsChanging) _ensureLoaded();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _ensureLoaded());
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _ensureLoaded() async {
    final svc = ref.read(communityServiceProvider);
    if (_tabCtrl.index == 0 && _weeklyData == null && !_loadingWeekly) {
      setState(() => _loadingWeekly = true);
      try {
        final d = await svc.getLeaderboard(type: 'weekly');
        if (mounted) setState(() { _weeklyData = d; _loadingWeekly = false; });
      } catch (e) {
        if (mounted) setState(() { _error = e.toString(); _loadingWeekly = false; });
      }
    } else if (_tabCtrl.index == 1 && _alltimeData == null && !_loadingAlltime) {
      setState(() => _loadingAlltime = true);
      try {
        final d = await svc.getLeaderboard(type: 'alltime');
        if (mounted) setState(() { _alltimeData = d; _loadingAlltime = false; });
      } catch (e) {
        if (mounted) setState(() { _error = e.toString(); _loadingAlltime = false; });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          '🏆 Top Artists',
          style: GoogleFonts.fredoka(fontWeight: FontWeight.w700),
        ),
        bottom: TabBar(
          controller: _tabCtrl,
          tabs: [
            Tab(
              child: Text('📅 This Week',
                  style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
            ),
            Tab(
              child: Text('🏅 All Time',
                  style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabCtrl,
        children: [
          _buildList(_weeklyData, _loadingWeekly),
          _buildList(_alltimeData, _loadingAlltime),
        ],
      ),
    );
  }

  Widget _buildList(Leaderboard? data, bool loading) {
    if (loading) return const Center(child: CircularProgressIndicator());
    if (data == null && _error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('😕', style: TextStyle(fontSize: 40)),
            const SizedBox(height: 12),
            Text('Could not load leaderboard',
                style: GoogleFonts.nunito(fontSize: 15)),
            const SizedBox(height: 8),
            TextButton(
                onPressed: _ensureLoaded, child: const Text('Try again')),
          ],
        ),
      );
    }
    if (data == null || data.entries.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('🌟', style: TextStyle(fontSize: 56)),
            const SizedBox(height: 16),
            Text(
              'No entries yet!\nColor pictures and share them\nto appear here 🎨',
              textAlign: TextAlign.center,
              style: GoogleFonts.nunito(fontSize: 16),
            ),
          ],
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: data.entries.length,
      itemBuilder: (_, i) => LeaderboardEntryWidget(entry: data.entries[i]),
    );
  }
}
