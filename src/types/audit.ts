export type ToleranceKind = "absolute" | "relative";

export type AuditClaim = {
  id: string;
  statement: string;
  expected_value: number;
  expected_unit: string;
  tolerance: number;
  tolerance_kind: ToleranceKind;
  test_method: string;
};

export type AuditVerdict = "verified" | "discrepancy" | "inconclusive";

export type AuditResult = {
  claim_id: string;
  actual_value: number | null;
  unit: string;
  passed: boolean;
  notes: string;
};

export type AuditCertificate = {
  claims: AuditClaim[];
  results: AuditResult[];
  generatedAt: number;
  durationMs: number;
};

export const AUDIT_CLAIMS_SCHEMA = {
  type: "object",
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          statement: { type: "string" },
          expected_value: { type: "number" },
          expected_unit: { type: "string" },
          tolerance: { type: "number" },
          tolerance_kind: {
            type: "string",
            enum: ["absolute", "relative"],
          },
          test_method: { type: "string" },
        },
        required: [
          "id",
          "statement",
          "expected_value",
          "expected_unit",
          "tolerance",
          "tolerance_kind",
          "test_method",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["claims"],
  additionalProperties: false,
} as const;

export function verdictForResult(
  claim: AuditClaim,
  result: AuditResult | undefined,
): AuditVerdict {
  if (!result || result.actual_value === null || !Number.isFinite(result.actual_value)) {
    return "inconclusive";
  }
  if (result.passed) return "verified";
  const expected = claim.expected_value;
  const actual = result.actual_value;
  const diff = Math.abs(expected - actual);
  const limit =
    claim.tolerance_kind === "relative"
      ? Math.abs(expected) * claim.tolerance
      : claim.tolerance;
  if (diff <= limit) return "verified";
  return "discrepancy";
}
