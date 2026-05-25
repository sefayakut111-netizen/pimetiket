export interface DesignQCResult {
  fileId: string;
  fileName: string;
  dpi: number;
  colorProfile: string;
  verdict: string;
  score: number;
  fileType: string;
}

export interface ConsistencyIssue {
  type: "dpi_mismatch" | "color_mismatch" | "quality_mismatch" | "type_mismatch";
  severity: "warning" | "info";
  message_tr: string;
  affected_files: string[];
}

export interface ConsistencyResult {
  consistent: boolean;
  issues: ConsistencyIssue[];
}

export function checkMultiDesignConsistency(
  results: DesignQCResult[]
): ConsistencyResult {
  if (results.length <= 1) {
    return { consistent: true, issues: [] };
  }

  const issues: ConsistencyIssue[] = [];

  const dpis = results.map((r) => r.dpi).filter((d) => d > 0);
  if (dpis.length > 1) {
    const minDpi = Math.min(...dpis);
    const maxDpi = Math.max(...dpis);
    if (maxDpi / minDpi > 2) {
      const lowFiles = results
        .filter((r) => r.dpi === minDpi)
        .map((r) => r.fileName);
      issues.push({
        type: "dpi_mismatch",
        severity: "warning",
        message_tr: `Tasarımlar arasında DPI farkı var: ${minDpi} ile ${maxDpi} DPI. Düşük olan dosyalar baskıda daha düşük kalitede olabilir.`,
        affected_files: lowFiles,
      });
    }
  }

  const profiles = [...new Set(results.map((r) => r.colorProfile))];
  if (profiles.length > 1) {
    issues.push({
      type: "color_mismatch",
      severity: "info",
      message_tr: `Tasarımlarda farklı renk profilleri var: ${profiles.join(", ")}. Tüm dosyalar baskıda CMYK'ya dönüştürülecek.`,
      affected_files: results
        .filter((r) => r.colorProfile === "RGB")
        .map((r) => r.fileName),
    });
  }

  const scores = results.map((r) => r.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  if (maxScore - minScore > 30) {
    const lowFiles = results
      .filter((r) => r.score === minScore)
      .map((r) => r.fileName);
    issues.push({
      type: "quality_mismatch",
      severity: "warning",
      message_tr:
        "Tasarımlar arasında kalite farkı var. Bazı dosyalar daha düşük kalitede — baskıda fark hissedilebilir.",
      affected_files: lowFiles,
    });
  }

  const types = [...new Set(results.map((r) => r.fileType))];
  if (types.length > 1) {
    issues.push({
      type: "type_mismatch",
      severity: "info",
      message_tr: `Tasarımlar farklı dosya tiplerinde: ${types.join(", ")}.`,
      affected_files: results.map((r) => r.fileName),
    });
  }

  return {
    consistent: issues.filter((i) => i.severity === "warning").length === 0,
    issues,
  };
}
