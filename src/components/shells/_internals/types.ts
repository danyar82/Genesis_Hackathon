export type ParameterSpec = {
  name: string;
  description?: string;
  min: number;
  max: number;
  default: number;
  step?: number;
  type?: string;
};

export type ParamValues = Record<string, number>;

export function initialValues(parameters: ParameterSpec[] | undefined): ParamValues {
  const out: ParamValues = {};
  for (const p of parameters ?? []) out[p.name] = p.default;
  return out;
}

export function resolveStep(p: ParameterSpec): number {
  if (p.step) return p.step;
  if (p.type === "integer") return 1;
  const range = Math.abs(p.max - p.min);
  if (range === 0) return 0.01;
  if (range <= 1) return 0.001;
  if (range <= 10) return 0.01;
  if (range <= 100) return 0.1;
  return 1;
}

export function formatValue(v: number, p: ParameterSpec): string {
  if (p.type === "integer" || Number.isInteger(v)) return String(Math.round(v));
  const range = Math.abs(p.max - p.min);
  if (range <= 1) return v.toFixed(3);
  if (range <= 100) return v.toFixed(2);
  return v.toFixed(1);
}
