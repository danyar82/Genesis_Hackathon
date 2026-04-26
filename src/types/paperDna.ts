export type VizType =
  | "3d_particles"
  | "2d_chart"
  | "interactive_graph"
  | "data_dashboard"
  | "canvas_physics"
  | "math_explorer";

export type PaperDnaParameter = {
  name: string;
  description?: string;
  default_value: number;
  min: number;
  max: number;
  type?: string;
};

export type PaperDna = {
  title: string;
  classification: string;
  core_algorithm: string;
  equations: string[];
  parameters: PaperDnaParameter[];
  visualization_type: VizType | string;
  code_kernel: string;
};
