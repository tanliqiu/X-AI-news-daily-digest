import { DigestItem } from '@/lib/digests'
import BookmarkButton from './BookmarkButton'

const SOURCE_STYLES: Record<string, string> = {
  arXiv: 'bg-red-900/30 text-red-400',
  'Hacker News': 'bg-orange-900/30 text-orange-400',
  Anthropic: 'bg-violet-900/30 text-violet-400',
  OpenAI: 'bg-emerald-900/30 text-emerald-400',
  'Hugging Face': 'bg-yellow-900/30 text-yellow-400',
  'Google DeepMind': 'bg-blue-900/30 text-blue-400',
  'Meta AI': 'bg-sky-900/30 text-sky-400',
  Mistral: 'bg-indigo-900/30 text-indigo-400',
  'The Batch': 'bg-teal-900/30 text-teal-400',
  'Import AI': 'bg-lime-900/30 text-lime-400',
}

function sourceStyle(source: string): string {
  return SOURCE_STYLES[source] ?? 'bg-zinc-800 text-gray-400'
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
}

export default function ItemCard({ item, digestDate }: Props) {
  return (
    <article className="border-l-2 border-zinc-700 pl-4">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sourceStyle(item.source)}`}>
            {item.source}
          </span>
          {item.published && (
            <span className="text-xs text-gray-600">
              {relativeDay(item.published)}
            </span>
          )}
        </div>
        <BookmarkButton
          url={item.url}
          title={item.title}
          source={item.source}
          digestDate={digestDate ?? ''}
        />
      </div>
      <h3 className="text-sm font-semibold leading-snug mb-1 text-gray-100">
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
            <span key={kw} className="text-xs px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400 font-medium">
              {kw}
            </span>
          ))}
        </div>
      )}
      {item.summary && (
        <p className="text-sm text-gray-500 leading-relaxed">
          {item.summary}
        </p>
      )}
      {item.affiliations && item.affiliations.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {item.affiliations.map((aff) => (
            <span key={aff} className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-gray-500 font-medium">
              {aff}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}
