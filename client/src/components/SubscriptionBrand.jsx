export const SUBSCRIPTION_BRANDS = [
  { name: 'Netflix', monogram: 'N' }, { name: 'Spotify', monogram: 'S' },
  { name: 'Adobe', monogram: 'A' }, { name: 'Microsoft 365', monogram: 'M' },
  { name: 'Google One', monogram: 'G' }, { name: 'YouTube Premium', monogram: 'Y' },
  { name: 'Canva', monogram: 'C' }, { name: 'Notion', monogram: 'N' },
  { name: 'Zoom', monogram: 'Z' }, { name: 'Dropbox', monogram: 'D' },
  { name: 'GitHub', monogram: 'GH' }, { name: 'AWS', monogram: 'A' }
];
export function SubscriptionBrandMonogram({ name }) {
  const brand = SUBSCRIPTION_BRANDS.find((item) => item.name.toLowerCase() === name?.toLowerCase());
  const text = brand?.monogram ?? (name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <span className="subscription-brand-monogram" aria-hidden="true">{text}</span>;
}
export function SubscriptionBrandBadge({ name, variant = 'default' }) {
  return <span className={`subscription-brand-badge subscription-brand-badge-${variant}`}><SubscriptionBrandMonogram name={name} /><span>{name}</span></span>;
}
