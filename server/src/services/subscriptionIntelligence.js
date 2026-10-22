const DAY = 86400000;
const MERCHANTS = [
  { pattern: /spotify/i, name: 'Spotify', category: 'Entertainment' },
  { pattern: /netflix/i, name: 'Netflix', category: 'Entertainment' },
  { pattern: /youtube/i, name: 'YouTube Premium', category: 'Entertainment' },
  { pattern: /microsoft|office 365/i, name: 'Microsoft 365', category: 'Productivity' },
  { pattern: /adobe/i, name: 'Adobe Creative Cloud', category: 'Design' },
  { pattern: /canva/i, name: 'Canva', category: 'Design' },
  { pattern: /google one/i, name: 'Google One', category: 'Cloud Storage' },
  { pattern: /dropbox/i, name: 'Dropbox', category: 'Cloud Storage' },
  { pattern: /chatgpt|openai/i, name: 'ChatGPT Plus', category: 'AI Tools' },
  { pattern: /notion/i, name: 'Notion', category: 'Productivity' }
];
const normalize = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const matchMerchant = (merchant) => MERCHANTS.find(({ pattern }) => pattern.test(merchant)) ?? null;

export function detectRecurringPayments(transactions, subscriptions = []) {
  const groups = new Map();
  for (const transaction of transactions) {
    const known = matchMerchant(transaction.merchant);
    const key = known?.name ?? normalize(transaction.merchant);
    if (!key) continue;
    const group = groups.get(key) ?? { key, name: known?.name ?? transaction.merchant.trim(), category: known?.category ?? transaction.category ?? 'Other', transactions: [] };
    group.transactions.push(transaction);
    groups.set(key, group);
  }
  return [...groups.values()].flatMap((group) => {
    const rows = group.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    const dated = rows.filter((row) => Number.isFinite(new Date(row.date).getTime()));
    if (dated.length < 2) return [];
    const intervals = dated.slice(1).map((row, i) => (new Date(row.date) - new Date(dated[i].date)) / DAY);
    const monthlyIntervals = intervals.filter((days) => days >= 25 && days <= 35);
    const weeklyIntervals = intervals.filter((days) => days >= 6 && days <= 8);
    const matches = Math.max(monthlyIntervals.length, weeklyIntervals.length);
    if (!matches) return [];
    const interval = weeklyIntervals.length > monthlyIntervals.length ? 'WEEKLY' : 'MONTHLY';
    const amounts = dated.map((row) => Number(row.amount));
    const average = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    const variance = amounts.length > 1 ? Math.min(...amounts) / Math.max(...amounts) : 1;
    const confidence = Math.min(0.99, Math.round((0.5 + Math.min(matches, 3) * 0.12 + variance * 0.15 + (matchMerchant(group.name) ? 0.1 : 0)) * 100) / 100);
    const linked = subscriptions.filter((item) => normalize(item.name) === normalize(group.name) || normalize(item.name) === normalize(dated[0].merchant));
    return [{ merchant: group.name, category: group.category, billingCycle: interval, amount: Math.round(average * 100) / 100, currency: dated.at(-1).currency ?? 'INR', occurrenceCount: dated.length, confidenceScore: confidence, firstSeenAt: dated[0].date, lastSeenAt: dated.at(-1).date, transactionIds: dated.map((row) => String(row._id)), duplicate: linked.length > 1, matchingSubscriptions: linked.map((item) => ({ id: String(item._id), name: item.name })), explanation: `${group.name} appears ${dated.length} times with ${interval.toLowerCase()} timing across simulated transactions.` }];
  });
}
