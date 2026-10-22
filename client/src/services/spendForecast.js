const DAY = 86400000;
const MONTHLY_FACTOR = { WEEKLY: 52 / 12, MONTHLY: 1, QUARTERLY: 1 / 3, YEARLY: 1 / 12 };
const monthlyCost = (item) => Number(item.monthlyCost ?? (item.amount * (MONTHLY_FACTOR[item.billingCycle] ?? 1)));
const isActive = (item) => item.status === 'ACTIVE';

export function buildSpendForecast(subscriptions, now = new Date(), currency = null) {
  const active = subscriptions.filter(isActive);
  const pricedActive = currency ? active.filter((item) => (item.currency || 'INR') === currency) : active;
  const monthlySpend = pricedActive.reduce((sum, item) => sum + monthlyCost(item), 0);
  const yearlyPlanEquivalent = pricedActive.filter((item) => item.billingCycle === 'YEARLY').reduce((sum, item) => sum + monthlyCost(item), 0);
  const nonYearlyPlanEquivalent = pricedActive.filter((item) => item.billingCycle !== 'YEARLY').reduce((sum, item) => sum + monthlyCost(item), 0);
  const categories = [...pricedActive.reduce((map, item) => map.set(item.category || 'Other', (map.get(item.category || 'Other') ?? 0) + monthlyCost(item)), new Map())]
    .map(([category, amount]) => ({ category, monthlySpend: amount, annualSpend: amount * 12 }))
    .sort((a, b) => b.monthlySpend - a.monthlySpend);
  const renewals = active.map((item) => ({ ...item, monthlyCost: monthlyCost(item), renewalDate: new Date(item.nextRenewalDate) }))
    .filter((item) => Number.isFinite(item.renewalDate.getTime()) && item.renewalDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    .sort((a, b) => a.renewalDate - b.renewalDate);
  const unused = active.filter((item) => !item.lastUsedAt || now - new Date(item.lastUsedAt).getTime() > 30 * DAY);
  const unusedInCurrency = unused.filter((item) => !currency || (item.currency || 'INR') === currency);
  const monthlySavings = unusedInCurrency.reduce((sum, item) => sum + monthlyCost(item), 0);
  const duplicateGroups = new Map();
  active.forEach((item) => {
    const key = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!key) return;
    duplicateGroups.set(key, [...(duplicateGroups.get(key) ?? []), item]);
  });
  const duplicates = [...duplicateGroups.values()].filter((group) => group.length > 1);
  const yearlyCount = active.filter((item) => item.billingCycle === 'YEARLY').length;
  const recentlyUsedCount = active.filter((item) => item.lastUsedAt && now - new Date(item.lastUsedAt).getTime() <= 30 * DAY).length;
  const healthScore = active.length ? Math.round((recentlyUsedCount / active.length) * 100) : 100;
  const projections = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() + index + 1, 1);
    return { month: date.toLocaleString(undefined, { month: 'short' }), amount: monthlySpend };
  });
  const renewalsNext30Days = renewals.filter((item) => item.renewalDate - now <= 30 * DAY);
  return { active, pricedActive, monthlySpend, annualSpend: monthlySpend * 12, yearlyPlanEquivalent, nonYearlyPlanEquivalent, categories, renewals, renewalsNext30Days, unused, unusedInCurrency, duplicates, monthlySavings, yearlyCount, healthScore, projections };
}

