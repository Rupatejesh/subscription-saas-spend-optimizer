import { buildSpendForecast } from '../services/spendForecast.js';

const money = (amount, currency) => new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 }).format(amount);
const dateLabel = (value) => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(value);

export function SpendSmarter({ subscriptions, currency, now = new Date() }) {
  const forecast = buildSpendForecast(subscriptions, now, currency);
  const otherCurrencyCount = forecast.active.filter((item) => (item.currency || 'INR') !== currency).length;
  const maxCategory = Math.max(1, ...forecast.categories.map((item) => item.monthlySpend));
  const recommendations = [];
  if (forecast.unusedInCurrency.length) recommendations.push({ title: 'Review subscriptions you may not be using', body: `${forecast.unusedInCurrency.length} active ${currency} plan${forecast.unusedInCurrency.length === 1 ? '' : 's'} have no recent use recorded or were last used more than 30 days ago. Check whether each still earns its place before the next renewal.`, saving: `${money(forecast.monthlySavings, currency)}/month estimated if all were stopped`, type: 'Review' });
  if (forecast.duplicates.length) recommendations.push({ title: 'Check for overlapping subscriptions', body: `We found ${forecast.duplicates.length} groups with matching service names. Confirm these are intentional before changing any plan.`, type: 'Compare' });
  if (forecast.renewalsNext30Days.length) recommendations.push({ title: 'Renewals coming up', body: `${forecast.renewalsNext30Days.length} subscription${forecast.renewalsNext30Days.length === 1 ? ' renews' : 's renew'} in the next 30 days. Review the price and whether you still need each service before it renews.`, type: 'Plan ahead' });
  recommendations.push({ title: 'Compare monthly and annual pricing', body: 'For plans you expect to keep, compare the provider’s current monthly total with its annual price, including any terms, taxes, and cancellation limits. An annual plan can cost less over a full year but requires a larger upfront payment.', type: 'Learn' });
  recommendations.push({ title: 'Ask about legitimate shared plans', body: 'If a service offers an official family, household, or team tier, compare its rules and total cost per person. Only share through plans that explicitly allow it.', type: 'Learn' });
  recommendations.push({ title: 'Look for a suitable lower-cost option', body: 'When reviewing a paid tool, compare its features with the provider’s free tier or reputable alternatives. Check limits, privacy, and whether the switch fits your needs.', type: 'Learn' });

  return <section className="dashboard-panel spend-smarter" id="spending" aria-labelledby="spend-smarter-title">
    <div className="panel-title"><div><p className="welcome-kicker">Financial awareness</p><h2 id="spend-smarter-title">Spend Smarter</h2><p>Plan ahead and find subscriptions worth a closer look.</p></div><span className="projection-tag">ESTIMATES</span></div>
    <p className="spend-estimate-note">Estimates based on your active subscription list and recorded usage. Totals use {currency} plans only; {otherCurrencyCount ? `${otherCurrencyCount} plan${otherCurrencyCount === 1 ? ' uses' : 's use'} another currency and are excluded (no currency conversion is applied). ` : ''}These estimates are for awareness only, not financial advice.</p>
    <div className="spend-summary-grid" aria-label="Spending estimates">
      <article><span>Current monthly spend</span><strong>{money(forecast.monthlySpend, currency)}</strong><small>At current active plan rates</small></article>
      <article><span>Annual spending forecast</span><strong>{money(forecast.annualSpend, currency)}</strong><small>Assumes current plans continue for 12 months</small></article>
      <article className="spend-saving"><span>Potential identified savings</span><strong>{money(forecast.monthlySavings, currency)}/mo</strong><small>{money(forecast.monthlySavings * 12, currency)} annual estimate if all flagged unused plans were stopped</small></article>
      <article><span>Subscription health</span><strong>{forecast.healthScore}<small className="score-suffix">/100</small></strong><small>Share of active plans used in the last 30 days</small><div className="health-track" role="progressbar" aria-label="Estimated subscription health score" aria-valuemin="0" aria-valuemax="100" aria-valuenow={forecast.healthScore}><span style={{ width: `${forecast.healthScore}%` }} /></div></article>
    </div>
    <div className="forecast-grid">
      <section className="forecast-block" aria-labelledby="monthly-forecast-title"><div className="forecast-heading"><div><h3 id="monthly-forecast-title">Monthly spending forecast</h3><p>Next six months at today’s recurring cost</p></div><strong>{money(forecast.monthlySpend, currency)}<small> / month</small></strong></div>
        <div className="forecast-bars" role="img" aria-label={`Estimated monthly recurring spending is ${money(forecast.monthlySpend, currency)} for each of the next six months.`}>{forecast.projections.map((point, index) => <div className="forecast-bar-column" key={`${point.month}-${index}`}><span className="forecast-bar" style={{ height: forecast.monthlySpend ? '100%' : '0%' }} /><small>{point.month}</small></div>)}</div>
      </section>
      <section className="forecast-block" aria-labelledby="category-forecast-title"><div className="forecast-heading"><div><h3 id="category-forecast-title">Category forecast</h3><p>Estimated monthly amount by category</p></div></div>
        {forecast.categories.length ? <ul className="category-forecast">{forecast.categories.map((item) => <li key={item.category}><div><span>{item.category}</span><strong>{money(item.monthlySpend, currency)}<small> / mo</small></strong></div><div className="category-track" aria-hidden="true"><span style={{ width: `${item.monthlySpend / maxCategory * 100}%` }} /></div><small>{money(item.annualSpend, currency)} / year estimate</small></li>)}</ul> : <p className="empty-copy">Add an active subscription to see a category forecast.</p>}
      </section>
    </div>
    <section className="cadence-comparison" aria-labelledby="cadence-title"><div className="forecast-heading"><div><h3 id="cadence-title">Monthly vs annual billing</h3><p>Monthly equivalent of plans by their current billing cycle</p></div></div><div className="cadence-values"><p><span>Plans billed yearly</span><strong>{money(forecast.yearlyPlanEquivalent, currency)}<small> / month equivalent</small></strong></p><p><span>Plans billed more often</span><strong>{money(forecast.nonYearlyPlanEquivalent, currency)}<small> / month equivalent</small></strong></p></div><p className="panel-footnote">This compares your listed prices on a monthly equivalent basis. It cannot determine whether an annual option is cheaper; compare each provider’s current offers and terms.</p></section>
    <section className="forecast-block renewal-forecast" aria-labelledby="renewal-forecast-title"><div className="forecast-heading"><div><h3 id="renewal-forecast-title">Renewal forecast</h3><p>Upcoming active plan renewals and listed prices</p></div></div>
      {forecast.renewals.length ? <ul className="renewal-list">{forecast.renewals.slice(0, 6).map((item) => <li key={item.id ?? `${item.name}-${item.renewalDate.toISOString()}`}><span><strong>{item.name}</strong><small>{dateLabel(item.renewalDate)} · {item.billingCycle.toLowerCase()} plan</small></span><b>{money(item.amount, item.currency)}<small> / {item.billingCycle.toLowerCase()}</small></b></li>)}</ul> : <p className="empty-copy">No upcoming renewals are listed for active subscriptions.</p>}
      <p className="panel-footnote">The schedule uses the renewal dates you entered; amounts and dates can change with the provider.</p>
    </section>
    <section className="recommendation-section" aria-labelledby="recommendations-title"><div className="forecast-heading"><div><h3 id="recommendations-title">Ideas to review</h3><p>Informational prompts; you decide whether to take action.</p></div></div>
      <ul className="recommendation-list">{recommendations.map((item) => <li key={item.title}><span className="recommendation-type">{item.type}</span><div><strong>{item.title}</strong><p>{item.body}</p>{item.saving && <small>{item.saving}</small>}</div></li>)}</ul>
    </section>
  </section>;
}
