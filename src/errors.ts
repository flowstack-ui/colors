import type { ColorDiagnostic, ColorDiagnosticCode } from "./types.js";

export class FlowstackColorError extends Error {
  readonly code: ColorDiagnosticCode;
  readonly path: string;

  constructor(diagnostic: ColorDiagnostic) {
    super(diagnostic.message);
    this.name = "FlowstackColorError";
    this.code = diagnostic.code;
    this.path = diagnostic.path;
  }

  toDiagnostic(): ColorDiagnostic {
    return {
      code: this.code,
      severity: "error",
      path: this.path,
      message: this.message,
    };
  }
}

export function colorError(
  code: ColorDiagnosticCode,
  path: string,
  message: string,
): FlowstackColorError {
  return new FlowstackColorError({ code, severity: "error", path, message });
}
