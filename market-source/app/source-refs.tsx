import type { Source } from '@/lib/market-types';

export function SourceRefs({
  ids,
  sources,
}: {
  ids: string[];
  sources: Source[];
}) {
  return (
    <span className="inline-flex flex-wrap gap-x-1.5 gap-y-1">
      {ids.map((id) => {
        const source = sources.find((s) => s.id === id);
        return source ? (
          <a
            key={id}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            title={source.label}
            aria-label={`${id} ${source.label}`}
            className="font-mono text-xs text-[#536f59] underline decoration-[#536f59]/35 underline-offset-4 hover:text-[#26382e]"
          >
            {id}
          </a>
        ) : null;
      })}
    </span>
  );
}
