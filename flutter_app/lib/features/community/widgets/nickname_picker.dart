import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../community_service.dart';

/// Shows a bottom sheet for picking a curated nickname.
/// Returns the selected nickname or null if dismissed.
Future<String?> showNicknamePicker(
  BuildContext context,
  CommunityService svc,
) async {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (_) => _NicknamePickerSheet(svc: svc),
  );
}

class _NicknamePickerSheet extends StatefulWidget {
  final CommunityService svc;
  const _NicknamePickerSheet({required this.svc});

  @override
  State<_NicknamePickerSheet> createState() => _NicknamePickerSheetState();
}

class _NicknamePickerSheetState extends State<_NicknamePickerSheet> {
  List<String> _nicknames = [];
  List<String> _filtered = [];
  String _query = '';
  bool _loading = true;
  final _scrollCtrl = ScrollController();
  String? _selected;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final result = await widget.svc.getNicknames();
      if (mounted) {
        setState(() {
          _nicknames = result.nicknames;
          _filtered = result.nicknames;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _filter(String q) {
    setState(() {
      _query = q;
      _filtered = q.isEmpty
          ? _nicknames
          : _nicknames
              .where((n) => n.toLowerCase().contains(q.toLowerCase()))
              .toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final bottom = MediaQuery.viewInsetsOf(context).bottom;

    return Container(
      padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + bottom),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.75,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: cs.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            '👤 Choose your name',
            style: GoogleFonts.fredoka(fontSize: 20, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 12),
          TextField(
            autofocus: false,
            onChanged: _filter,
            inputFormatters: [LengthLimitingTextInputFormatter(30)],
            decoration: InputDecoration(
              hintText: 'Search nicknames…',
              prefixIcon: const Icon(Icons.search_rounded),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
          ),
          const SizedBox(height: 12),
          Flexible(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _filtered.isEmpty
                    ? Center(
                        child: Text(
                          'No matches for "$_query"',
                          style: GoogleFonts.nunito(
                              color: cs.onSurface.withValues(alpha: 0.5)),
                        ),
                      )
                    : ListView.separated(
                        controller: _scrollCtrl,
                        itemCount: _filtered.length,
                        separatorBuilder: (_, __) =>
                            const Divider(height: 1),
                        itemBuilder: (_, i) {
                          final n = _filtered[i];
                          final isSelected = _selected == n;
                          return ListTile(
                            dense: true,
                            title: Text(
                              n,
                              style: GoogleFonts.nunito(
                                fontSize: 14,
                                fontWeight: isSelected
                                    ? FontWeight.w800
                                    : FontWeight.w600,
                                color: isSelected ? cs.primary : null,
                              ),
                            ),
                            trailing: isSelected
                                ? Icon(Icons.check_circle_rounded,
                                    color: cs.primary)
                                : null,
                            onTap: () {
                              HapticFeedback.selectionClick();
                              setState(() => _selected = n);
                            },
                          );
                        },
                      ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _selected == null
                  ? null
                  : () => Navigator.of(context).pop(_selected),
              style: FilledButton.styleFrom(
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(50)),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: Text(
                'Choose ${_selected ?? "…"}',
                style:
                    GoogleFonts.fredoka(fontSize: 16, fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
