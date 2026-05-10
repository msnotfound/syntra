import React from 'react';
import { clsx } from 'clsx';
import { Factory, Anchor, MoveRight, Flag, Globe2, Package, type LucideIcon } from 'lucide-react';

type EntityType = 'supplier' | 'port' | 'route' | 'country' | 'region' | 'asset';

const TYPE_ICONS: Record<EntityType, LucideIcon> = {
  supplier: Factory,
  port:     Anchor,
  route:    MoveRight,
  country:  Flag,
  region:   Globe2,
  asset:    Package,
};

interface EntityChipProps {
  type: EntityType;
  name: string;
  location?: string;
  onClick?: () => void;
  className?: string;
}

export function EntityChip({ type, name, location, onClick, className }: EntityChipProps) {
  const Icon = TYPE_ICONS[type];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-1',
        'text-[13px] text-text-primary',
        'bg-bg-surface-2 border border-border-subtle',
        'rounded-[4px]',
        'transition-colors duration-[150ms] ease-out',
        onClick && 'cursor-pointer hover:bg-bg-surface-3',
        className
      )}
      onClick={onClick}
    >
      <Icon size={14} className="text-text-secondary flex-shrink-0" />
      <span>{name}</span>
      {location && <span className="text-text-muted">{location}</span>}
    </span>
  );
}
