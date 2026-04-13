interface BrandLogoProps {
  compact?: boolean
}

export default function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <span className={`console-brand ${compact ? 'console-brand-compact' : ''}`}>
      <span className="console-brand-mark" aria-hidden="true">
        <span className="console-brand-mark-core">M</span>
      </span>
      <span className="console-brand-copy">
        <span className="console-brand-name">MaxIO</span>
        <span className="console-brand-subtitle">控制台</span>
      </span>
    </span>
  )
}
