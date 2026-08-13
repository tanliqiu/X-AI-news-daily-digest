import { DigestItem } from '@/lib/digests'
import ItemCard from './ItemCard'

const SECTION_STYLES: Record<string, string> = {
  Research: 'text-purple-600',
  Tools: 'text-blue-600',
  'Industry News': 'text-emerald-600',
}

interface Props {
  title: string
  items: DigestItem[]
  digestDate?: string
}

export default function SectionBlock({ title, items, digestDate }: Props) {
  const color = SECTION_STYLES[title] ?? 'text-zinc-500'

  return (
    <section>
      <h2 className={`text-xs font-bold uppercase tracking-widest mb-5 ${color}`}>
        {title}
      </h2>
      <div className="space-y-5">
        {items.map((item, i) => (
          <ItemCard key={i} item={item} digestDate={digestDate} section={title} />
        ))}
      </div>
    </section>
  )
}
