import BackgroundOrbs from "./_components/BackgroundOrbs";
import { GenesisPipeline } from "./_components/GenesisPipeline";

export default function Home() {
  return (
    // `safe center` keeps the small extracting/synthesizing/frontier stages
    // vertically centered when their content fits the viewport, but falls back
    // to top-aligned when the idle stage's full landing page exceeds 100dvh —
    // preventing the classic flexbox clip where centered overflow hides the
    // top of the page.
    <main className="relative flex min-h-dvh flex-1 flex-col items-center px-4 pt-20 sm:px-6 sm:pt-20 xl:px-8 xl:pt-16 [justify-content:safe_center]">
      <BackgroundOrbs />
      <GenesisPipeline />
    </main>
  );
}
