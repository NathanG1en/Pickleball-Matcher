import { PickleballIcon } from "@/components/ui/icons";

export function RoundGenerationIndicator() {
  return (
    <span role="status" className="relative inline-flex w-full items-center justify-center px-8 whitespace-nowrap">
      <span className="round-generation-art absolute -left-2 inline-flex h-5 w-6 shrink-0 items-center justify-center" aria-hidden="true">
        <span className="round-generation-hop block h-4 w-4">
          <PickleballIcon className="round-generation-ball h-4 w-4" />
        </span>
      </span>
      <span>Generating…</span>
    </span>
  );
}
