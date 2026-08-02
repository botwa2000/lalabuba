// Remote drawing configuration served from /api/drawing-config.
//
// Constructed via DrawingConfig.fromJson with per-field fallbacks, so any
// missing or malformed key keeps the hard-coded DrawingConfig.defaults.
// Used by DrawingConfigService to expose a singleton via DrawingConfigService.instance.

class DifficultyConfig {
  final int minArea;
  final int maxRegions;
  final int colorCount;
  final int resolution;
  final bool skipFreeTiers;

  const DifficultyConfig({
    required this.minArea,
    required this.maxRegions,
    required this.colorCount,
    required this.resolution,
    required this.skipFreeTiers,
  });

  factory DifficultyConfig.fromJson(
      Map<String, dynamic> json, DifficultyConfig d) {
    return DifficultyConfig(
      minArea: (json['minArea'] as num?)?.toInt() ?? d.minArea,
      maxRegions: (json['maxRegions'] as num?)?.toInt() ?? d.maxRegions,
      colorCount: (json['colorCount'] as num?)?.toInt() ?? d.colorCount,
      resolution: (json['resolution'] as num?)?.toInt() ?? d.resolution,
      skipFreeTiers: (json['skipFreeTiers'] as bool?) ?? d.skipFreeTiers,
    );
  }
}

class OutlineMaskConfig {
  final int globalDark;
  final int localMargin;
  final int adaptiveCeil;
  final int weakMargin;
  final int weakCeil;

  const OutlineMaskConfig({
    required this.globalDark,
    required this.localMargin,
    required this.adaptiveCeil,
    required this.weakMargin,
    required this.weakCeil,
  });

  factory OutlineMaskConfig.fromJson(
      Map<String, dynamic> json, OutlineMaskConfig d) {
    return OutlineMaskConfig(
      globalDark: (json['globalDark'] as num?)?.toInt() ?? d.globalDark,
      localMargin: (json['localMargin'] as num?)?.toInt() ?? d.localMargin,
      adaptiveCeil: (json['adaptiveCeil'] as num?)?.toInt() ?? d.adaptiveCeil,
      weakMargin: (json['weakMargin'] as num?)?.toInt() ?? d.weakMargin,
      weakCeil: (json['weakCeil'] as num?)?.toInt() ?? d.weakCeil,
    );
  }
}

class LineBridgeConfig {
  final int maxGapMin;
  final int maxGapMax;
  final double faceCos;
  final int tangentSteps;

  const LineBridgeConfig({
    required this.maxGapMin,
    required this.maxGapMax,
    required this.faceCos,
    required this.tangentSteps,
  });

  factory LineBridgeConfig.fromJson(
      Map<String, dynamic> json, LineBridgeConfig d) {
    return LineBridgeConfig(
      maxGapMin: (json['maxGapMin'] as num?)?.toInt() ?? d.maxGapMin,
      maxGapMax: (json['maxGapMax'] as num?)?.toInt() ?? d.maxGapMax,
      faceCos: (json['faceCos'] as num?)?.toDouble() ?? d.faceCos,
      tangentSteps:
          (json['tangentSteps'] as num?)?.toInt() ?? d.tangentSteps,
    );
  }
}

class TrappedBallConfig {
  final int maxRMin;
  final int maxRMax;
  final int decayNumerator;
  final int decayDenominator;
  final int finalPassRadius;

  const TrappedBallConfig({
    required this.maxRMin,
    required this.maxRMax,
    required this.decayNumerator,
    required this.decayDenominator,
    required this.finalPassRadius,
  });

  factory TrappedBallConfig.fromJson(
      Map<String, dynamic> json, TrappedBallConfig d) {
    return TrappedBallConfig(
      maxRMin: (json['maxRMin'] as num?)?.toInt() ?? d.maxRMin,
      maxRMax: (json['maxRMax'] as num?)?.toInt() ?? d.maxRMax,
      decayNumerator:
          (json['decayNumerator'] as num?)?.toInt() ?? d.decayNumerator,
      decayDenominator:
          (json['decayDenominator'] as num?)?.toInt() ?? d.decayDenominator,
      finalPassRadius:
          (json['finalPassRadius'] as num?)?.toInt() ?? d.finalPassRadius,
    );
  }
}

class RegionFilterConfig {
  final int absoluteFloor;
  final int promoteFloor;
  final int rescueFloor;

  const RegionFilterConfig({
    required this.absoluteFloor,
    required this.promoteFloor,
    required this.rescueFloor,
  });

  factory RegionFilterConfig.fromJson(
      Map<String, dynamic> json, RegionFilterConfig d) {
    return RegionFilterConfig(
      absoluteFloor:
          (json['absoluteFloor'] as num?)?.toInt() ?? d.absoluteFloor,
      promoteFloor:
          (json['promoteFloor'] as num?)?.toInt() ?? d.promoteFloor,
      rescueFloor: (json['rescueFloor'] as num?)?.toInt() ?? d.rescueFloor,
    );
  }
}

class SnapRadiusConfig {
  final int web;
  final int flutter;

  const SnapRadiusConfig({required this.web, required this.flutter});

  factory SnapRadiusConfig.fromJson(
      Map<String, dynamic> json, SnapRadiusConfig d) {
    return SnapRadiusConfig(
      web: (json['web'] as num?)?.toInt() ?? d.web,
      flutter: (json['flutter'] as num?)?.toInt() ?? d.flutter,
    );
  }
}

class DetectionConfig {
  final OutlineMaskConfig outlineMask;
  final LineBridgeConfig lineBridge;
  final TrappedBallConfig trappedBall;
  final RegionFilterConfig regionFilter;
  final int bfsDarkThreshold;
  final double bfsFloodCapRatio;
  final int workerTimeoutMs;
  final SnapRadiusConfig snapRadius;

  const DetectionConfig({
    required this.outlineMask,
    required this.lineBridge,
    required this.trappedBall,
    required this.regionFilter,
    required this.bfsDarkThreshold,
    required this.bfsFloodCapRatio,
    required this.workerTimeoutMs,
    required this.snapRadius,
  });

  factory DetectionConfig.fromJson(
      Map<String, dynamic> json, DetectionConfig d) {
    final om = json['outlineMask'];
    final lb = json['lineBridge'];
    final tb = json['trappedBall'];
    final rf = json['regionFilter'];
    final sr = json['snapRadius'];
    return DetectionConfig(
      outlineMask: om is Map<String, dynamic>
          ? OutlineMaskConfig.fromJson(om, d.outlineMask)
          : d.outlineMask,
      lineBridge: lb is Map<String, dynamic>
          ? LineBridgeConfig.fromJson(lb, d.lineBridge)
          : d.lineBridge,
      trappedBall: tb is Map<String, dynamic>
          ? TrappedBallConfig.fromJson(tb, d.trappedBall)
          : d.trappedBall,
      regionFilter: rf is Map<String, dynamic>
          ? RegionFilterConfig.fromJson(rf, d.regionFilter)
          : d.regionFilter,
      bfsDarkThreshold:
          (json['bfsDarkThreshold'] as num?)?.toInt() ?? d.bfsDarkThreshold,
      bfsFloodCapRatio:
          (json['bfsFloodCapRatio'] as num?)?.toDouble() ?? d.bfsFloodCapRatio,
      workerTimeoutMs:
          (json['workerTimeoutMs'] as num?)?.toInt() ?? d.workerTimeoutMs,
      snapRadius: sr is Map<String, dynamic>
          ? SnapRadiusConfig.fromJson(sr, d.snapRadius)
          : d.snapRadius,
    );
  }
}

class CompletionConfig {
  final double freeCoverageRatio;
  final double freehandCoverThreshold;
  final double tinyRegionAutoRatio;

  const CompletionConfig({
    required this.freeCoverageRatio,
    required this.freehandCoverThreshold,
    required this.tinyRegionAutoRatio,
  });

  factory CompletionConfig.fromJson(
      Map<String, dynamic> json, CompletionConfig d) {
    return CompletionConfig(
      freeCoverageRatio:
          (json['freeCoverageRatio'] as num?)?.toDouble() ?? d.freeCoverageRatio,
      freehandCoverThreshold: (json['freehandCoverThreshold'] as num?)
              ?.toDouble() ??
          d.freehandCoverThreshold,
      tinyRegionAutoRatio:
          (json['tinyRegionAutoRatio'] as num?)?.toDouble() ??
              d.tinyRegionAutoRatio,
    );
  }
}

class CanvasConfig {
  final int maxDisplayEdgePx;
  final int undoStackMax;

  const CanvasConfig({
    required this.maxDisplayEdgePx,
    required this.undoStackMax,
  });

  factory CanvasConfig.fromJson(Map<String, dynamic> json, CanvasConfig d) {
    return CanvasConfig(
      maxDisplayEdgePx:
          (json['maxDisplayEdgePx'] as num?)?.toInt() ?? d.maxDisplayEdgePx,
      undoStackMax:
          (json['undoStackMax'] as num?)?.toInt() ?? d.undoStackMax,
    );
  }
}

class GenerationConfig {
  final int clientTimeoutMs;
  final int seedRange;
  final int maxImageBytes;

  const GenerationConfig({
    required this.clientTimeoutMs,
    required this.seedRange,
    required this.maxImageBytes,
  });

  factory GenerationConfig.fromJson(
      Map<String, dynamic> json, GenerationConfig d) {
    return GenerationConfig(
      clientTimeoutMs:
          (json['clientTimeoutMs'] as num?)?.toInt() ?? d.clientTimeoutMs,
      seedRange: (json['seedRange'] as num?)?.toInt() ?? d.seedRange,
      maxImageBytes:
          (json['maxImageBytes'] as num?)?.toInt() ?? d.maxImageBytes,
    );
  }
}

class DrawingConfig {
  final Map<String, DifficultyConfig> difficulties;
  final DetectionConfig detection;
  final CompletionConfig completion;
  final CanvasConfig canvas;
  final GenerationConfig generation;

  const DrawingConfig({
    required this.difficulties,
    required this.detection,
    required this.completion,
    required this.canvas,
    required this.generation,
  });

  static DrawingConfig get defaults => DrawingConfig(
        difficulties: const {
          'easy': DifficultyConfig(
              minArea: 2000,
              maxRegions: 10,
              colorCount: 6,
              resolution: 1024,
              skipFreeTiers: false),
          'medium': DifficultyConfig(
              minArea: 800,
              maxRegions: 18,
              colorCount: 8,
              resolution: 1024,
              skipFreeTiers: false),
          'hard': DifficultyConfig(
              minArea: 300,
              maxRegions: 30,
              colorCount: 12,
              resolution: 1024,
              skipFreeTiers: true),
          'extreme': DifficultyConfig(
              minArea: 80,
              maxRegions: 48,
              colorCount: 99,
              resolution: 1024,
              skipFreeTiers: true),
        },
        detection: const DetectionConfig(
          outlineMask: OutlineMaskConfig(
            globalDark: 100,
            localMargin: 22,
            adaptiveCeil: 165,
            weakMargin: 8,
            weakCeil: 212,
          ),
          lineBridge: LineBridgeConfig(
            maxGapMin: 4,
            maxGapMax: 20,
            faceCos: 0.5,
            tangentSteps: 4,
          ),
          trappedBall: TrappedBallConfig(
            maxRMin: 2,
            maxRMax: 7,
            decayNumerator: 2,
            decayDenominator: 3,
            finalPassRadius: 1,
          ),
          regionFilter: RegionFilterConfig(
            absoluteFloor: 30,
            promoteFloor: 50,
            rescueFloor: 5,
          ),
          bfsDarkThreshold: 80,
          bfsFloodCapRatio: 0.65,
          workerTimeoutMs: 90000,
          snapRadius: SnapRadiusConfig(web: 16, flutter: 12),
        ),
        completion: const CompletionConfig(
          freeCoverageRatio: 0.90,
          freehandCoverThreshold: 0.45,
          tinyRegionAutoRatio: 0.0005,
        ),
        canvas: const CanvasConfig(
          maxDisplayEdgePx: 2048,
          undoStackMax: 20,
        ),
        generation: const GenerationConfig(
          clientTimeoutMs: 80000,
          seedRange: 2000000000,
          maxImageBytes: 26214400,
        ),
      );

  factory DrawingConfig.fromJson(Map<String, dynamic> json) {
    final d = DrawingConfig.defaults;

    // difficulties
    Map<String, DifficultyConfig> difficulties = d.difficulties;
    final difsRaw = json['difficulties'];
    if (difsRaw is Map<String, dynamic>) {
      difficulties = Map<String, DifficultyConfig>.from(d.difficulties);
      for (final entry in difsRaw.entries) {
        final val = entry.value;
        if (val is Map<String, dynamic>) {
          final fallback =
              d.difficulties[entry.key] ?? d.difficulties['medium']!;
          difficulties[entry.key] =
              DifficultyConfig.fromJson(val, fallback);
        }
      }
    }

    // detection
    final detRaw = json['detection'];
    final detection = detRaw is Map<String, dynamic>
        ? DetectionConfig.fromJson(detRaw, d.detection)
        : d.detection;

    // completion
    final compRaw = json['completion'];
    final completion = compRaw is Map<String, dynamic>
        ? CompletionConfig.fromJson(compRaw, d.completion)
        : d.completion;

    // canvas
    final canvRaw = json['canvas'];
    final canvas = canvRaw is Map<String, dynamic>
        ? CanvasConfig.fromJson(canvRaw, d.canvas)
        : d.canvas;

    // generation
    final genRaw = json['generation'];
    final generation = genRaw is Map<String, dynamic>
        ? GenerationConfig.fromJson(genRaw, d.generation)
        : d.generation;

    return DrawingConfig(
      difficulties: difficulties,
      detection: detection,
      completion: completion,
      canvas: canvas,
      generation: generation,
    );
  }
}
