// Fetchers used by more than one dashboard panel. React `cache` dedupes them per request, so each
// Suspense boundary can ask for what it needs and the queries still run once, in parallel.
import { cache } from "react"
import { getCheckoutSeries, getDueSoon, getProjectProgress, getStatusHeadline, getTeamSnapshot } from "@/lib/analytics"

/** 90 days once; the chart slices 7/30 on the client. */
export const checkoutSeries = cache(() => getCheckoutSeries(90))
export const dueSoon = cache(() => getDueSoon(3))
export const statusHeadline = cache(getStatusHeadline)
export const projectProgress = cache(getProjectProgress)
export const teamSnapshot = cache(getTeamSnapshot)
