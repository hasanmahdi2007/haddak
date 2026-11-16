import type { PriceCurrency, PriceUnit, ProviderSummary } from '@/api';
import type { Strings } from '@/i18n/en';

/** "$20" or "20$" (Arabic), or "500000 LBP". */
export function formatAmount(s: Strings, amount: number, currency: PriceCurrency): string {
  const n = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return (currency === 'LBP' ? s.price.lbp : s.price.usd).replace('{n}', n);
}

/** "$12 an hour". */
export function formatPrice(s: Strings, amount: number, unit: PriceUnit, currency: PriceCurrency): string {
  return s.price[unit].replace('{price}', formatAmount(s, amount, currency));
}

/**
 * The provider's own words (`price_text`, which can say "From $10"), or the
 * structured price written out when they gave only that.
 */
export function providerPrice(s: Strings, provider: ProviderSummary): string | null {
  if (provider.price_text) return provider.price_text;
  const { price_amount: amount, price_unit: unit, price_currency: currency } = provider;
  if (amount != null && unit && currency) return formatPrice(s, amount, unit, currency);
  return null;
}
