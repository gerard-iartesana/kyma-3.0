# Charts & Dashboards

Patterns for data visualization using Recharts in Next.js applications.

## Library: Recharts

Recharts is the default for React projects. Lightweight, composable, built on D3.

```bash
npm install recharts
```

## Chart Wrapper Component

Every chart should be wrapped for consistent sizing and responsiveness:

```tsx
"use client";
import { ResponsiveContainer } from "recharts";

interface ChartContainerProps {
  children: React.ReactNode;
  height?: number;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

function ChartContainer({ children, height = 320, title, subtitle, action }: ChartContainerProps) {
  return (
    <div className="chart-card">
      {(title || action) && (
        <div className="chart-header">
          <div>
            {title && <h3 className="chart-title">{title}</h3>}
            {subtitle && <p className="chart-subtitle">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="chart-body">
        <ResponsiveContainer width="100%" height={height}>
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

## Color Palette for Charts

Use a consistent, accessible palette derived from the brand:

```typescript
const CHART_COLORS = {
  primary:   "hsl(230, 55%, 48%)",
  secondary: "hsl(170, 50%, 45%)",
  tertiary:  "hsl(38, 90%, 50%)",
  quaternary:"hsl(340, 60%, 50%)",
  quinary:   "hsl(270, 50%, 55%)",
  muted:     "hsl(230, 8%, 72%)",
} as const;

// For pie/donut charts with many segments
const PALETTE = [
  "hsl(230, 55%, 48%)",
  "hsl(170, 50%, 45%)",
  "hsl(38, 90%, 50%)",
  "hsl(340, 60%, 50%)",
  "hsl(270, 50%, 55%)",
  "hsl(15, 70%, 55%)",
  "hsl(200, 60%, 50%)",
  "hsl(90, 45%, 45%)",
];
```

## Common Chart Patterns

### Line Chart (Trends over time)
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

<ChartContainer title="Ocupación mensual" height={320}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" stroke="hsl(230,8%,90%)" />
    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(230,5%,56%)" />
    <YAxis tick={{ fontSize: 12 }} stroke="hsl(230,5%,56%)" />
    <Tooltip
      contentStyle={{ borderRadius: 8, border: "1px solid hsl(230,8%,90%)", fontSize: 13 }}
    />
    <Legend wrapperStyle={{ fontSize: 13 }} />
    <Line type="monotone" dataKey="occupancy" name="Ocupación %"
      stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
    <Line type="monotone" dataKey="target" name="Objetivo"
      stroke={CHART_COLORS.muted} strokeWidth={2} strokeDasharray="5 5" dot={false} />
  </LineChart>
</ChartContainer>
```

### Bar Chart (Comparisons)
```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

<ChartContainer title="Ingresos por propiedad">
  <BarChart data={data} barGap={4}>
    <CartesianGrid strokeDasharray="3 3" stroke="hsl(230,8%,90%)" vertical={false} />
    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `€${v/1000}k`} />
    <Tooltip formatter={(v: number) => [`€${v.toLocaleString("es-ES")}`, "Ingresos"]} />
    <Bar dataKey="revenue" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
  </BarChart>
</ChartContainer>
```

### Donut / Pie Chart (Distribution)
```tsx
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

<ChartContainer title="Estado de propiedades" height={280}>
  <PieChart>
    <Pie data={data} dataKey="value" nameKey="label"
      cx="50%" cy="50%" innerRadius={60} outerRadius={100}
      paddingAngle={3} cornerRadius={4}>
      {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
    </Pie>
    <Tooltip formatter={(v: number) => [v, "Propiedades"]} />
    <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
  </PieChart>
</ChartContainer>
```

### Area Chart (Volume over time)
```tsx
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

<ChartContainer title="Reservas acumuladas">
  <AreaChart data={data}>
    <defs>
      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.15} />
        <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
      </linearGradient>
    </defs>
    <CartesianGrid strokeDasharray="3 3" stroke="hsl(230,8%,90%)" />
    <XAxis dataKey="date" />
    <YAxis />
    <Tooltip />
    <Area type="monotone" dataKey="bookings"
      stroke={CHART_COLORS.primary} strokeWidth={2}
      fill="url(#colorRevenue)" />
  </AreaChart>
</ChartContainer>
```

## KPI Cards

```tsx
interface KpiCardProps {
  label: string;
  value: string | number;
  change?: number;       // percentage change
  icon?: React.ReactNode;
}

function KpiCard({ label, value, change, icon }: KpiCardProps) {
  return (
    <div className="kpi-card">
      <div className="kpi-header">
        <span className="kpi-label">{label}</span>
        {icon}
      </div>
      <div className="kpi-value">{value}</div>
      {change !== undefined && (
        <div className={cn("kpi-change", change >= 0 ? "positive" : "negative")}>
          {change >= 0 ? "↑" : "↓"} {Math.abs(change)}% vs mes anterior
        </div>
      )}
    </div>
  );
}
```

## Dashboard Layout

```tsx
{/* KPI row */}
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
  <KpiCard label="Propiedades activas" value={42} change={5} />
  <KpiCard label="Ocupación media" value="78%" change={-2} />
  <KpiCard label="Ingresos este mes" value="€45.2k" change={12} />
  <KpiCard label="Tareas pendientes" value={8} />
</div>

{/* Charts row */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
  <OccupancyLineChart data={monthlyData} />
  <RevenueBarChart data={propertyData} />
</div>

{/* Full-width chart */}
<div className="mt-6">
  <BookingsAreaChart data={dailyData} />
</div>
```

## CSS

```css
.chart-card {
  background: var(--color-surface, white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: var(--space-5) var(--space-5) 0;
}
.chart-title {
  font-size: var(--text-base);
  font-weight: 600;
}
.chart-subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-top: 2px;
}
.chart-body {
  padding: var(--space-4);
}
.kpi-card {
  background: var(--color-surface, white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}
.kpi-value {
  font-size: var(--text-2xl);
  font-weight: 700;
  margin: var(--space-2) 0;
}
.kpi-change {
  font-size: var(--text-xs);
  font-weight: 500;
}
.kpi-change.positive { color: var(--color-success); }
.kpi-change.negative { color: var(--color-error); }
```

## Rules

- Always use `ResponsiveContainer` — never fixed-width charts
- Use `"use client"` — Recharts requires client rendering
- Format numbers for Spanish locale: `toLocaleString("es-ES")`
- Currency: `€` prefix, thousands separator with dot
- Tooltip styles must match the app's design system
- Max 5–6 series per chart — more is unreadable
- Always label axes and provide a legend for multi-series
- Use gradient fills on area charts for depth
- KPI cards above charts for at-a-glance metrics
