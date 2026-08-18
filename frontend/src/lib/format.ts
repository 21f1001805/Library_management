export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatMonth(monthKey: string): string {
  return new Date(`${monthKey}-01`).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

export function formatDate(iso: string): string;
export function formatDate(iso: string | null): string | null;
export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
