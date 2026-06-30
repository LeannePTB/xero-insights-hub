## Rewrite Priority alerts in plain English

Update `pickAlert()` in `src/lib/health.functions.ts` so all three alerts use friendly, plain-English copy and adapt to the actual numbers. Only one alert ever displays (highest weight wins).

### 1. Bad debts
**Title:** Priority alert — money you're unlikely to recover

**Body (dynamic):**
> About {X%} of your sales this period have been written off as bad debt. That's money you've earned but won't see. Tighten up who you give credit to, ask for deposits up front, and follow up overdue invoices before they get to write-off stage.

(X% = badDebts / revenue, 1 decimal)

### 2. Running low on cash *(replaces the hardcoded version)*
**Title:** Priority alert — running low on cash

**Body (dynamic, three variants):**

- If `monthsRunway < 0.5`:
> You've got roughly {N weeks} of cash left at your current spending. {If profitable: "The good news — your business is profitable, so this is a collections problem, not an earnings problem. Chase your outstanding invoices this week and hold off on any non-essential spend." | If not profitable: "Spending is outpacing what's coming in. This week, chase outstanding invoices and pause any non-essential costs while you work out where to trim."}

- If `monthsRunway < 1`:
> You've got less than a month of cash at your current spending. {profitable / loss-making variant as above, slightly softer tone}

- If `monthsRunway < 2`:
> You've got under two months of cash at your current spending. Not urgent yet, but worth getting ahead of — chase overdue invoices and review any spend you could delay.

"Weeks" = `Math.max(1, Math.round(monthsRunway * 4.33))`. "Profitable" = `netMarginPct >= 0`.

### 3. Operating loss
**Title:** Priority alert — spending more than you earn

**Body (dynamic):**
> You spent more than you brought in this period — net margin is {X%}. Look at your two biggest cost lines and your pricing. Small changes to either usually move this faster than chasing more sales.

### Out of scope
No UI changes — `HealthWidget.tsx` already renders `alert.title` and `alert.body` as-is. No DB changes.
