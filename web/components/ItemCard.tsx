import { DigestItem } from '@/lib/digests'
import BookmarkButton from './BookmarkButton'
import AffiliationFlagButton from './AffiliationFlagButton'

const SOURCE_STYLES: Record<string, string> = {
  arXiv: 'bg-red-100 text-red-700',
  'Hacker News': 'bg-orange-100 text-orange-700',
  Anthropic: 'bg-violet-100 text-violet-700',
  OpenAI: 'bg-emerald-100 text-emerald-700',
  'Hugging Face': 'bg-yellow-100 text-yellow-700',
  'Google DeepMind': 'bg-blue-100 text-blue-700',
  'Meta AI': 'bg-sky-100 text-sky-700',
  Mistral: 'bg-indigo-100 text-indigo-700',
  'The Batch': 'bg-teal-100 text-teal-700',
  'Import AI': 'bg-lime-100 text-lime-700',
}

function sourceStyle(source: string): string {
  return SOURCE_STYLES[source] ?? 'bg-zinc-100 text-zinc-600'
}

function relativeDay(published: string): string {
  const diff = Math.round(
    (new Date(published).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(diff, 'day')
}

interface Props {
  item: DigestItem
  digestDate?: string
  section?: string
}

export default function ItemCard({ item, digestDate, section }: Props) {
  const arxivId = item.url.match(/arxiv\.org\/abs\/([^\s?#]+)/)?.[1] ?? null
  const isResearch = section === 'Research'

  return (
    <article className="border-l-2 border-zinc-300 pl-4">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sourceStyle(item.source)}`}>
            {item.source}
          </span>
          {item.published && (
            <span className="text-xs text-zinc-400">
              {relativeDay(item.published)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isResearch && arxivId && (
            <AffiliationFlagButton
              arxivId={arxivId}
              title={item.title}
              digestDate={digestDate ?? ''}
              currentAffiliations={item.affiliations ?? []}
            />
          )}
          <BookmarkButton
            url={item.url}
            title={item.title}
            source={item.source}
            digestDate={digestDate ?? ''}
          />
        </div>
      </div>
      <h3 className="text-sm font-semibold leading-snug mb-1 text-zinc-900">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline underline-offset-2"
        >
          {item.title}
        </a>
      </h3>
      {item.keywords && item.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {item.keywords.map((kw) => (
            <span key={kw} className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
              {kw}
            </span>
          ))}
        </div>
      )}
      {item.summary && (
        <p className="text-sm text-zinc-500 leading-relaxed">
          {item.summary}
        </p>
      )}
      {item.affiliations && item.affiliations.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {item.affiliations.map((aff) => (
            <span key={aff} className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 font-medium">
              {aff}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}
