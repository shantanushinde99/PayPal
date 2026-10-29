"use client";
import { useMemo } from "react";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import { AgStudioAiModule, createAiHarness, studioTheme, type AgDataSourcesDefinition, type AgReportState } from "ag-studio";
import type { Insights } from "@/lib/insights";
import { geminiAdapter } from "./studio-adapter";

const FONT = "var(--font-plex), system-ui, sans-serif";
const theme = studioTheme.withParams({
  accentColor: "#0369a1",
  fontFamily: FONT, studioCanvasFontFamily: FONT, chartFontFamily: FONT,
  chartPaletteFills1Color: "#0369a1", chartPaletteFills2Color: "#10b981", chartPaletteFills3Color: "#f59e0b",
  chartPaletteFills4Color: "#ef4444", chartPaletteFills5Color: "#6366f1",
});

const text = (id: string, name?: string) => ({ id, name, format: "textFormat" as const, cardinality: "low" as const });
const cash = (id: string, name?: string) => ({ id, name, format: "decimalFormat" as const });
const date = (id: string, name?: string) => ({ id, name, format: "dateFormat" as const });

type Side = Insights["side"];
const kpi = (text: string, id: string, aggregation: "sum" | "avg") =>
  ({ type: "value" as const, format: { title: { text, enabled: true } }, dataMapping: { value: [{ id, aggregation }] } });

// Labels per side: a client spends and holds money, a freelancer earns it.
const COPY = {
  client: { held: "Money on hold", paid: "Paid to freelancers", done: "Milestones verified & paid", speed: "Avg days to payment",
    flow: "Paid per month", items: "Checklist results by requirement", other: "Freelancer" },
  freelancer: { held: "Waiting to be released", paid: "Total earned", done: "Milestones completed", speed: "Avg days to get paid",
    flow: "Earnings per month", items: "How your work scored", other: "Client" },
  platform: { held: "Money on hold (platform)", paid: "Paid to freelancers", done: "Milestones completed", speed: "Avg days to payment",
    flow: "Money movements per month", items: "Checklist results by requirement", other: "Freelancer" },
} as const;

// Preset "Overview" page for each side; users can rearrange it or ask the AI for new widgets (edit mode).
function initialState(side: Side): AgReportState {
  const c = COPY[side];
  const middle = side === "freelancer"
    ? { type: "bar-chart-grouped", format: { title: { text: "Earnings by client", enabled: true } },
        dataMapping: { categoryKey: [{ id: "milestones.counterpart" }], valueKey: [{ id: "milestones.paid", aggregation: "sum" }] } }
    : { type: "column-chart-grouped", format: { title: { text: "Money by stage", enabled: true } },
        dataMapping: { categoryKey: [{ id: "milestones.stage" }], valueKey: [{ id: "milestones.amount", aggregation: "sum" }] } };
  const cols = side === "platform" ? ["job", "milestone", "client", "freelancer", "stage", "amount", "paid", "created"]
    : ["job", "milestone", "counterpart", "stage", "amount", "paid", "created"];
  return {
    selectedPageId: "overview",
    // Builder panels start collapsed so the dashboard gets the room; the AI chat stays open.
    panels: { filters: { collapsed: true }, edit: { collapsed: true }, data: { collapsed: true }, ai: { width: 320 } },
    pages: [{
      id: "overview",
      widgets: {
        held: kpi(c.held, "milestones.onHold", "sum"),
        paid: kpi(c.paid, "milestones.paid", "sum"),
        done: kpi(c.done, "milestones.completed", "sum"),
        speed: kpi(c.speed, "milestones.daysToPaid", "avg"),
        middle: middle as never,
        items: {
          type: "bar-chart-grouped", format: { title: { text: c.items, enabled: true } },
          dataMapping: { categoryKey: [{ id: "verdicts.requirement" }], valueKey: [{ id: "verdicts.status", aggregation: "count" }], legendKey: [{ id: "verdicts.status" }] },
        },
        flow: {
          type: "column-chart-grouped", format: { title: { text: c.flow, enabled: true } },
          dataMapping: side === "platform"
            ? { categoryKey: [{ id: "payments.date::month" }], valueKey: [{ id: "payments.amount", aggregation: "sum" }], legendKey: [{ id: "payments.movement" }] }
            : { categoryKey: [{ id: "payments.date::month" }], valueKey: [{ id: "payments.settled", aggregation: "sum" }] },
        },
        table: { type: "grid", format: { title: { text: "Milestones", enabled: true } }, dataMapping: { cols: cols.map((f) => ({ id: `milestones.${f}` })) } },
      },
      widgetLayout: {
        held: { xTrack: 0, yTrack: 0, xSpan: 6, ySpan: 8 },
        paid: { xTrack: 6, yTrack: 0, xSpan: 6, ySpan: 8 },
        done: { xTrack: 12, yTrack: 0, xSpan: 6, ySpan: 8 },
        speed: { xTrack: 18, yTrack: 0, xSpan: 6, ySpan: 8 },
        middle: { xTrack: 0, yTrack: 8, xSpan: 10, ySpan: 18 },
        items: { xTrack: 10, yTrack: 8, xSpan: 14, ySpan: 18 },
        flow: { xTrack: 0, yTrack: 26, xSpan: 24, ySpan: 16 },
        table: { xTrack: 0, yTrack: 42, xSpan: 24, ySpan: 18 },
      },
    }],
  };
}

const STARTERS = {
  client: [
    { label: "Spend per freelancer", prompt: "Show how much I have paid each freelancer." },
    { label: "Failing requirements", prompt: "Which checklist requirements fail most often? Add a chart." },
    { label: "Slow payments", prompt: "Which milestones took longest from funding to payment?" },
  ],
  freelancer: [
    { label: "Earnings per client", prompt: "Which client has paid me the most? Add a chart." },
    { label: "What fails my checks", prompt: "Which checklist requirements does my work fail most often?" },
    { label: "Money still on hold", prompt: "Show the milestones where money is still on hold for me." },
  ],
  platform: [
    { label: "Money per freelancer", prompt: "Show how much each freelancer has been paid." },
    { label: "Failing requirements", prompt: "Which checklist requirements fail most often? Add a chart." },
    { label: "Slow payments", prompt: "Which milestones took longest from funding to payment?" },
  ],
};

export function InsightsStudio({ data, licenseKey }: { data: Insights; licenseKey?: string }) {
  const sources = useMemo<AgDataSourcesDefinition>(() => ({
    sources: [
      { id: "milestones", name: "Milestones", data: data.milestones, fields: [
        text("milestone", "Milestone"), text("job", "Job"), text("client", "Client"), text("freelancer", "Freelancer"),
        text("counterpart", COPY[data.side].other), text("stage", "Stage"), text("proof", "Proof type"), text("currency", "Currency"),
        cash("amount", "Amount"), cash("onHold", COPY[data.side].held), cash("paid", COPY[data.side].paid),
        { id: "completed", name: "Completed", format: "integerFormat" }, date("created", "Created"),
        { id: "daysToPaid", name: COPY[data.side].speed.replace("Avg ", ""), format: "decimalFormat" },
      ] },
      { id: "verdicts", name: "AI verdicts", data: data.verdicts, fields: [
        { id: "requirement", name: "Requirement", format: "textFormat" }, text("status", "Result"), { id: "reason", name: "Reason", format: "textFormat" },
        text("milestone", "Milestone"), text("job", "Job"), date("checked", "Checked"),
      ] },
      { id: "payments", name: "Payments", data: data.payments, fields: [
        text("movement", "Movement"), cash("amount", "Amount"), cash("settled", data.side === "freelancer" ? "Earned" : "Paid"), text("currency", "Currency"), date("date", "Date"), text("milestone", "Milestone"), text("job", "Job"),
        text("counterpart", COPY[data.side].other),
      ] },
      { id: "checks", name: "Website checks", data: data.checks, fields: [
        text("milestone", "Milestone"), text("job", "Job"), text("proof", "Proof type"),
        { id: "pages", name: "Pages crawled", format: "integerFormat" }, { id: "brokenLinks", name: "Broken links", format: "integerFormat" }, date("date", "Date"),
      ] },
    ],
  }), [data]);

  const ai = useMemo(() => ({ api }: { api: Parameters<typeof createAiHarness>[0] }) => createAiHarness(api, {
    adapter: geminiAdapter(),
    promptStarters: STARTERS[data.side],
  }), [data.side]);

  return (
    <AgStudioProvider licenseKey={licenseKey} modules={[AgStudioAiModule]}>
      <AgStudio key={data.side} data={sources} initialState={initialState(data.side)} mode="edit" theme={theme} ai={ai} style={{ height: "100%" }} />
    </AgStudioProvider>
  );
}
