export type ValidationErrorSource = "schema" | "reference" | "yaml";

export type ValidationSeverity = "error" | "warning";

export type ValidationError = {
  path: string;
  message: string;
  source: ValidationErrorSource;
  severity: ValidationSeverity;
  keyword?: string;
};

export type ValidationStatus = "pass" | "warn" | "error";

export type ValidationResult = {
  valid: boolean;
  status: ValidationStatus;
  errors: ValidationError[];
  warnings: ValidationError[];
  lastValidCandidate: unknown | null;
};
