const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 })

export function formatCurrency(value: number | null | undefined): string {
  return value == null ? "—" : inr.format(value)
}
