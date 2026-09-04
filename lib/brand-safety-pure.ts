// Pure brand-safety helpers for Distribution OS.
//
// These functions detect, score, and sanitize forbidden marketing claims before
// content is queued for publication. They are side-effect free and operate on
// plain strings and claim catalogs so they can be unit tested in isolation
// and reused by content review workers, API routes, and the UI.

export type ClaimCategory =
  | "regulatory"
  | "performance"
  | "guarantee"
  | "comparative"
  | "social_proof"
  | "sensitive";

export type ClaimSeverity = "low" | "medium" | "high";

export type ForbiddenClaim = {
  id: string;
  pattern: RegExp;
  description: string;
  category: ClaimCategory;
  severity: ClaimSeverity;
  replacement?: string;
};

export type ClaimMatch = {
  claim: ForbiddenClaim;
  match: string;
  index: number;
};

export const DEFAULT_FORBIDDEN_CLAIMS: readonly ForbiddenClaim[] = [
  {
    id: "guaranteed_revenue",
    pattern: /guaranteed\s+(revenue|sales|profit|income|results?)/gi,
    description: "Guaranteed revenue, sales, profit or income claims.",
    category: "guarantee",
    severity: "high",
    replacement: "pursuing measurable",
  },
  {
    id: "risk_free",
    pattern: /risk[-\s]?free/gi,
    description: "Risk-free framing that removes material uncertainty.",
    category: "guarantee",
    severity: "high",
    replacement: "lower-risk",
  },
  {
    id: "no_effort",
    pattern: /(no\s+effort|zero\s+effort|effortless|without\s+(?:any\s+)?effort)/gi,
    description: "Claims that outcomes require no effort.",
    category: "performance",
    severity: "medium",
    replacement: "focused",
  },
  {
    id: "get_rich_quick",
    pattern: /(get\s+rich\s+quick|make\s+money\s+fast|easy\s+money|fast\s+cash)/gi,
    description: "Get-rich-quick promises.",
    category: "regulatory",
    severity: "high",
    replacement: "build durable revenue",
  },
  {
    id: "medical_cure",
    pattern: /(cure|heals?|treats?)\s+(?:your|any|all)\s+(?:disease|illness|condition|cancer)/gi,
    description: "Medical cure or treatment claims.",
    category: "regulatory",
    severity: "high",
    replacement: "supports",
  },
  {
    id: "fda_approved",
    pattern: /fda[-\s]?approved/gi,
    description: "FDA approval claims that are typically unverifiable.",
    category: "regulatory",
    severity: "high",
    replacement: "reviewed",
  },
  {
    id: "specific_income_amount",
    pattern: /\$\s?1[,.]?\s?000[,.]?\s?000|one\s+million\s+dollars|million-dollar/gi,
    description: "Specific income amount claims.",
    category: "performance",
    severity: "medium",
    replacement: "significant",
  },
  {
    id: "overnight_success",
    pattern: /overnight\s+success/gi,
    description: "Overnight success claims.",
    category: "performance",
    severity: "medium",
    replacement: "measured progress",
  },
  {
    id: "best_in_world",
    pattern: /(best\s+in\s+the\s+world|world'?s\s+best|#1\s+globally)/gi,
    description: "Best-in-the-world superlatives.",
    category: "comparative",
    severity: "medium",
    replacement: "highly regarded",
  },
  {
    id: "better_than_competitor",
    pattern: /(better\s+than\s+(?:any|all|every)\s+(?:other\s+)?(?:competitor|alternative|solution))|crush(?:es|ed)?\s+the\s+competition/gi,
    description: "Comparative superiority claims without evidence.",
    category: "comparative",
    severity: "medium",
    replacement: "competes with",
  },
  {
    id: "thousands_of_customers",
    pattern: /(thousands|millions)\s+of\s+(happy\s+)?customers/gi,
    description: "Vague unverifiable social proof counts.",
    category: "social_proof",
    severity: "low",
    replacement: "many customers",
  },
  {
    id: "100_percent_success",
    pattern: /100\s?%\s+success\s+rate/gi,
    description: "100% success rate claims.",
    category: "guarantee",
    severity: "high",
    replacement: "strong success rate",
  },
  {
    id: "unverified_testimonial",
    pattern: /(?:amazing|life[-\s]?changing|incredible)\s+testimonial/gi,
    description: "Unverified testimonial framing.",
    category: "social_proof",
    severity: "low",
    replacement: "customer feedback",
  },
  {
    id: "political_endorsement",
    pattern: /(endorse[sd]?|support[sed]?)\s+(?:candidate|party|politician)/gi,
    description: "Political endorsement claims.",
    category: "sensitive",
    severity: "high",
    replacement: "neutral",
  },
  {
    id: "discriminatory_targeting",
    pattern: /(only\s+for\s+(?:men|women|whites?|christians?|muslims?|jews?)|excludes?\s+(?:women|minorities|lgbtq))/gi,
    description: "Discriminatory targeting language.",
    category: "sensitive",
    severity: "high",
    replacement: "for everyone",
  },
];

export function checkClaims(
  text: string,
  claims: readonly ForbiddenClaim[] = DEFAULT_FORBIDDEN_CLAIMS
): ClaimMatch[] {
  if (!text) return [];
  const matches: ClaimMatch[] = [];
  for (const claim of claims) {
    const re = new RegExp(claim.pattern.source, claim.pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      matches.push({ claim, match: m[0], index: m.index });
      if (m.index === re.lastIndex) {
        re.lastIndex++;
      }
    }
  }
  return matches.sort((a, b) => a.index - b.index);
}

const SEVERITY_ORDER: Record<ClaimSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export function shouldBlockContent(
  text: string,
  options: {
    claims?: readonly ForbiddenClaim[];
    blockAtSeverity?: ClaimSeverity;
    minMatches?: number;
  } = {}
): boolean {
  const claims = options.claims ?? DEFAULT_FORBIDDEN_CLAIMS;
  const matches = checkClaims(text, claims);
  if (matches.length === 0) return false;
  const minMatches = options.minMatches ?? 1;
  if (matches.length < minMatches) return false;
  const threshold = options.blockAtSeverity ?? "medium";
  return matches.some(
    (m) => SEVERITY_ORDER[m.claim.severity] >= SEVERITY_ORDER[threshold]
  );
}

export function sanitizeContent(
  text: string,
  claims: readonly ForbiddenClaim[] = DEFAULT_FORBIDDEN_CLAIMS
): string {
  const matches = checkClaims(text, claims);
  if (matches.length === 0) return text;
  let result = text;
  // Replace from the end so earlier indices remain valid.
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const replacement = m.claim.replacement ?? "[removed]";
    result =
      result.slice(0, m.index) +
      replacement +
      result.slice(m.index + m.match.length);
  }
  return result;
}

export function addCustomClaim(
  existing: readonly ForbiddenClaim[],
  claim: ForbiddenClaim
): ForbiddenClaim[] {
  const without = existing.filter((c) => c.id !== claim.id);
  return [...without, claim];
}

export function getClaimsByCategory(
  claims: readonly ForbiddenClaim[],
  category: ClaimCategory
): ForbiddenClaim[] {
  return claims.filter((c) => c.category === category);
}

export function getClaimsBySeverity(
  claims: readonly ForbiddenClaim[],
  severity: ClaimSeverity
): ForbiddenClaim[] {
  return claims.filter((c) => c.severity === severity);
}
