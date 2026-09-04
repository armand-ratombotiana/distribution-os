/**
 * Pure password strength evaluation. All functions are deterministic and
 * side-effect free; common-password checks are done against an in-module
 * list of well-known leaked passwords (no network calls).
 */

/**
 * A small, illustrative subset of the "Have I Been Pwned" top-100 list.
 * In production this would be loaded from a breach corpus; for a pure
 * module we keep a curated set of the most common passwords.
 */
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  "password",
  "123456",
  "123456789",
  "12345678",
  "12345",
  "1234567",
  "admin",
  "root",
  "qwerty",
  "abc123",
  "letmein",
  "monkey",
  "dragon",
  "iloveyou",
  "welcome",
  "login",
  "princess",
  "football",
  "baseball",
  "shadow",
  "sunshine",
  "master",
  "superman",
  "trustno1",
  "hello",
  "freedom",
  "whatever",
  "passw0rd",
  "p@ssword",
  "password1",
  "qwerty123",
]);

export type PasswordRequirements = {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSymbol: boolean;
};

export const DEFAULT_PASSWORD_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSymbol: true,
};

export type RequirementCheck = {
  requirement: keyof PasswordRequirements;
  passed: boolean;
  message: string;
};

export type RequirementResult = {
  ok: boolean;
  checks: RequirementCheck[];
};

/**
 * Check `password` against the configured requirements. Returns the full
 * per-requirement breakdown so callers can surface individual failures
 * to the user.
 */
export function checkPasswordRequirements(
  password: string,
  requirements: PasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS,
): RequirementResult {
  const checks: RequirementCheck[] = [];
  checks.push({
    requirement: "minLength",
    passed: password.length >= requirements.minLength,
    message: `Must be at least ${requirements.minLength} characters`,
  });
  if (requirements.requireUppercase) {
    checks.push({
      requirement: "requireUppercase",
      passed: /[A-Z]/.test(password),
      message: "Must contain an uppercase letter",
    });
  }
  if (requirements.requireLowercase) {
    checks.push({
      requirement: "requireLowercase",
      passed: /[a-z]/.test(password),
      message: "Must contain a lowercase letter",
    });
  }
  if (requirements.requireDigit) {
    checks.push({
      requirement: "requireDigit",
      passed: /\d/.test(password),
      message: "Must contain a digit",
    });
  }
  if (requirements.requireSymbol) {
    checks.push({
      requirement: "requireSymbol",
      passed: /[^A-Za-z0-9]/.test(password),
      message: "Must contain a symbol",
    });
  }
  return { ok: checks.every((c) => c.passed), checks };
}

/**
 * Return `true` when `password` is present (case-insensitively) in the
 * common-password list.
 */
export function checkCommonPasswords(password: string): boolean {
  if (typeof password !== "string" || password.length === 0) return false;
  return COMMON_PASSWORDS.has(password.toLowerCase());
}

/**
 * Calculate a strength score in the range `[0, 100]`.
 *
 * The score combines:
 *   - length (longer is better, with diminishing returns past 16 chars),
 *   - character-class diversity (lower / upper / digit / symbol),
 *   - sequential and repeated patterns (penalty),
 *   - common-password membership (heavy penalty),
 *
 * The returned value is always an integer in the inclusive range 0..100.
 */
export function calculateStrength(password: string): number {
  if (typeof password !== "string" || password.length === 0) return 0;

  // Common passwords are always scored at most 10.
  if (checkCommonPasswords(password)) return 10;

  let score = 0;

  // Length contribution: 4 points per char, capped at 40.
  score += Math.min(password.length * 4, 40);

  // Character-class diversity.
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const classCount =
    (hasLower ? 1 : 0) +
    (hasUpper ? 1 : 0) +
    (hasDigit ? 1 : 0) +
    (hasSymbol ? 1 : 0);
  score += classCount * 10; // up to 40

  // Bonus for high diversity AND reasonable length.
  if (classCount === 4 && password.length >= 12) score += 10;

  // Penalty for sequential characters (e.g. "abcd", "1234", "qwerty").
  const lowered = password.toLowerCase();
  const sequences = ["abcd", "bcde", "cdef", "wxyz", "1234", "2345", "3456",
    "qwerty", "asdf", "zxcv"];
  for (const seq of sequences) {
    if (lowered.includes(seq)) {
      score -= 15;
      break;
    }
  }

  // Penalty for repeated characters (3+ in a row).
  if (/(.)\1{2,}/.test(password)) score -= 10;

  // Penalty for all-letters-only short passwords.
  if (password.length < 8) score -= 15;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export type StrengthLabel = "very-weak" | "weak" | "fair" | "strong" | "very-strong";

/**
 * Map a numeric strength score to a human-readable label.
 */
export function getStrengthLabel(score: number): StrengthLabel {
  if (typeof score !== "number" || Number.isNaN(score)) return "very-weak";
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  if (clamped < 20) return "very-weak";
  if (clamped < 40) return "weak";
  if (clamped < 60) return "fair";
  if (clamped < 80) return "strong";
  return "very-strong";
}
