"use client";

import { Download } from "lucide-react";

/**
 * Triggers the browser's print dialog (→ "Save as PDF"). Hidden in the printed
 * output via the print:hidden utility on its wrapper. Zero dependencies — the
 * report page itself is print-optimized, so this yields a clean branded PDF.
 */
export function SaveAsPdfButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-nav to-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
    >
      <Download className="h-4 w-4" aria-hidden />
      Save as PDF
    </button>
  );
}
