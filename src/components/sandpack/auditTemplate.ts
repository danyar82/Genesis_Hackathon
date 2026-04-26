/**
 * Off-screen Sandpack template for the GENESIS Audit harness.
 * Runs the AI-generated harness against the AI-generated kernel inside
 * the Sandpack iframe and reports results back via console.log with a
 * magic prefix. The parent listens for `__GENESIS_AUDIT__:<json>`.
 *
 * Security model: kernel + harness execute in a Sandpack iframe (separate
 * origin, default sandbox flags, no parent DOM access). The runner adds
 * a 25s soft timeout; the parent enforces a 30s hard timeout by tearing
 * down the iframe.
 */

export const AUDIT_MAGIC_PREFIX = "__GENESIS_AUDIT__:";

const RUNNER_TS = `import * as kernelModule from "./kernel";
import * as harnessModule from "./harness";

const TIMEOUT_MS = 25000;
const PREFIX = "${AUDIT_MAGIC_PREFIX}";

function emit(payload: Record<string, unknown>): void {
  try {
    // eslint-disable-next-line no-console
    console.log(PREFIX + JSON.stringify(payload));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(PREFIX + JSON.stringify({ type: "error", error: String(e) }));
  }
}

async function main() {
  emit({ type: "ready" });

  const runAudit = (harnessModule as Record<string, unknown>).runAudit as
    | ((kernel: unknown) => unknown | Promise<unknown>)
    | undefined;

  if (typeof runAudit !== "function") {
    emit({ type: "error", error: "harness did not export runAudit(kernel)" });
    return;
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(\`audit timed out after \${TIMEOUT_MS}ms\`)),
      TIMEOUT_MS,
    );
  });

  try {
    const raw = await Promise.race([
      Promise.resolve().then(() => runAudit(kernelModule)),
      timeoutPromise,
    ]);
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);

    if (!Array.isArray(raw)) {
      emit({
        type: "error",
        error: "runAudit must return an array; got " + typeof raw,
      });
      return;
    }

    const sanitized: Array<Record<string, unknown>> = [];
    for (const r of raw) {
      if (!r || typeof r !== "object") continue;
      const o = r as Record<string, unknown>;
      const claim_id = typeof o.claim_id === "string" ? o.claim_id : null;
      if (!claim_id) continue;

      const actual = o.actual_value;
      const actual_value =
        typeof actual === "number" && Number.isFinite(actual) ? actual : null;
      sanitized.push({
        claim_id,
        actual_value,
        unit: typeof o.unit === "string" ? o.unit : "",
        passed: o.passed === true,
        notes: typeof o.notes === "string" ? o.notes.slice(0, 500) : "",
      });
    }

    emit({ type: "results", results: sanitized });
  } catch (err) {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err);
    emit({ type: "error", error: message.slice(0, 500) });
  }
}

main();
`;

const INDEX_TS = `import "./runner";
`;

const INDEX_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><title>Genesis Audit</title></head>
<body><div id="root"></div></body>
</html>
`;

export function getAuditFiles(
  codeKernel: string,
  harness: string,
): Record<string, string> {
  return {
    "/index.tsx": INDEX_TS,
    "/runner.ts": RUNNER_TS,
    "/kernel.ts": codeKernel,
    "/harness.ts": harness,
    "/public/index.html": INDEX_HTML,
  };
}

export const AUDIT_CUSTOM_SETUP = {
  entry: "/index.tsx",
  dependencies: {} as Record<string, string>,
};
