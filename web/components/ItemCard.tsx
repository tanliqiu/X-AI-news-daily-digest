import { DigestItem } from '@/lib/digests'

const SOURCE_STYLES: Record<string, string> = {
  arXiv: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  'Hacker News': 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Anthropic: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  OpenAI: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'Hugging Face': 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Google DeepMind': 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'Meta AI': 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  Mistral: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  'The Batch': 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  'Import AI': 'bg-lime-50 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300',
}

function sourceStyle(source: string): string {
  return (
    SOURCE_STYLES[source] ??
    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  )
}

function relativeDay(published: string): string {
  const diff = Math.round(
    (new Date(published).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(diff, 'day')
}

interface Props {
  item: DigestItem
}

export default function ItemCard({ item }: Props) {
  return (
    <article className="border-l-2 border-gray-100 dark:border-gray-800 pl-4">
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${sourceStyle(item.source)}`}
        >
          {item.source}
        </span>
        {item.published && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {relativeDay(item.published)}
          </span>
        )}
      </div>
      <h3 className="text-sm font-semibold leading-snug mb-1">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline underline-offset-2"
        >
          {item.title}
        </a>
      </h3>
      {item.summary && (
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          {item.summary}
        </p>
      )}
    </article>
  )
}
