import { BusinessPerformanceWorkspace } from "@/components/business-performance/business-performance-workspace";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { getBusinessPerformancePageData, getBusinessPerformanceYearOptions } from "@/services/business-performance-service";

interface BusinessPerformancePageProps {
  searchParams: {
    year?: string;
    month?: string;
    entityType?: string;
    q?: string;
    agent?: string;
    entity?: string;
  };
}

function firstParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

const MONTH_OPTIONS = [
  { value: "", label: "All months" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" }
];

export default async function BusinessPerformancePage({ searchParams }: BusinessPerformancePageProps) {
  let data: Awaited<ReturnType<typeof getBusinessPerformancePageData>> | null = null;
  let loadError: string | null = null;

  try {
    data = await getBusinessPerformancePageData({
      year: firstParam(searchParams.year),
      month: firstParam(searchParams.month),
      entityType: firstParam(searchParams.entityType),
      q: firstParam(searchParams.q),
      agent: firstParam(searchParams.agent),
      entity: firstParam(searchParams.entity)
    });
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load Business Performance section.";
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Business Performance"
          description="Revenue and commission performance for businesses and hotels."
        />
        <ErrorState message={loadError ?? "Unknown error loading section."} />
      </div>
    );
  }

  const yearOptions = getBusinessPerformanceYearOptions();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Performance"
        description="Track monthly entity performance and calculate commission payouts for agents."
        rightSlot={
          <Badge color="info">
            {data.totalEntities} entities
          </Badge>
        }
      />

      <form className="grid gap-3 rounded-xl border border-border bg-surface-elevated p-4 md:grid-cols-2 xl:grid-cols-6" method="GET">
        <Select name="year" defaultValue={String(data.filters.year)}>
          {yearOptions.map((year) => (
            <option key={year} value={String(year)}>
              {year}
            </option>
          ))}
        </Select>
        <Select name="month" defaultValue={data.filters.month ? String(data.filters.month) : ""}>
          {MONTH_OPTIONS.map((month) => (
            <option key={month.value || "all"} value={month.value}>
              {month.label}
            </option>
          ))}
        </Select>
        <Select name="entityType" defaultValue={data.filters.entityType}>
          <option value="all">All entity types</option>
          <option value="business">Business</option>
          <option value="hotel">Hotel</option>
        </Select>
        <Select name="agent" defaultValue={data.filters.agentUserId}>
          <option value="">All agents</option>
          {data.agentOptions.map((agent) => (
            <option key={agent.userId} value={agent.userId}>
              {agent.name} ({agent.activeEntities})
            </option>
          ))}
        </Select>
        <Input name="q" defaultValue={data.filters.query} placeholder="Initial filter by name, username or email" className="xl:col-span-1" />
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-strong"
        >
          Apply filters
        </button>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard title={`Total generated (${data.periodLabel})`} value={`EUR ${data.kpis.gmv.toFixed(2)}`} />
        <MetricCard title={`Attendi profit (${data.periodLabel})`} value={`EUR ${data.kpis.attendiProfit.toFixed(2)}`} />
        <MetricCard title={`No. reservations/operations (${data.periodLabel})`} value={data.kpis.operations} />
      </section>

      {data.notes.length ? (
        <Card className="space-y-2 p-4">
          <p className="text-sm font-semibold text-text">Metric mapping</p>
          <ul className="space-y-1 text-xs text-text-muted">
            {data.notes.map((note) => (
              <li key={note}>- {note}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <BusinessPerformanceWorkspace
        entities={data.entities}
        selectedEntityId={data.selectedEntityId}
        selectedEntityDetail={data.selectedEntityDetail}
        periodLabel={data.periodLabel}
      />
    </div>
  );
}
