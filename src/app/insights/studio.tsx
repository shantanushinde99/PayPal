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

// Preset "Overview" page; users can rearrange it or ask the AI for new widgets (edit mode).
const initialState: AgReportState = {
  selectedPageId: "overview",
  // Builder panels start collapsed so the dashboard gets the room; the AI chat stays open.
  panels: { filters: { collapsed: true }, edit: { collapsed: true }, data: { collapsed: true }, ai: { width: 320 } },
  pages: [{
    id: "overview",
    widgets: {
      escrow: { type: "value", format: { title: { text: "Total in escrow", enabled: true } }, dataMapping: { value: [{ id: "milestones.amount", aggregation: "sum" }] } },
      paid: { type: "value", format: { title: { text: "Paid to freelancers", enabled: true } }, dataMapping: { value: [{ id: "milestones.paid", aggregation: "sum" }] } },
      checks: { type: "value", format: { title: { text: "AI checks run", enabled: true } }, dataMapping: { value: [{ id: "checks.milestone", aggregation: "count" }] } },
      speed: { type: "value", format: { title: { text: "Avg days to payment", enabled: true } }, dataMapping: { value: [{ id: "milestones.daysToPaid", aggregation: "avg" }] } },
      byState: {
        type: "column-chart-grouped", format: { title: { text: "Money by stage", enabled: true } },
        dataMapping: { categoryKey: [{ id: "milestones.state" }], valueKey: [{ id: "milestones.amount", aggregation: "sum" }] },
      },
      items: {
        type: "bar-chart-grouped", format: { title: { text: "Checklist results by requirement", enabled: true } },
        dataMapping: { categoryKey: [{ id: "verdicts.requirement" }], valueKey: [{ id: "verdicts.status", aggregation: "count" }], legendKey: [{ id: "verdicts.status" }] },
      },
      flow: {
        type: "column-chart-grouped", format: { title: { text: "Money movements per month", enabled: true } },
        dataMapping: { categoryKey: [{ id: "payments.date::month" }], valueKey: [{ id: "payments.amount", aggregation: "sum" }], legendKey: [{ id: "payments.kind" }] },
      },
      table: {
        type: "grid", format: { title: { text: "Milestones", enabled: true } },
        dataMapping: { cols: ["job", "milestone", "freelancer", "state", "amount", "paid", "created"].map((f) => ({ id: `milestones.${f}` })) },
      },
    },
    widgetLayout: {
      escrow: { xTrack: 0, yTrack: 0, xSpan: 6, ySpan: 8 },
      paid: { xTrack: 6, yTrack: 0, xSpan: 6, ySpan: 8 },
      checks: { xTrack: 12, yTrack: 0, xSpan: 6, ySpan: 8 },
      speed: { xTrack: 18, yTrack: 0, xSpan: 6, ySpan: 8 },
      byState: { xTrack: 0, yTrack: 8, xSpan: 10, ySpan: 18 },
      items: { xTrack: 10, yTrack: 8, xSpan: 14, ySpan: 18 },
      flow: { xTrack: 0, yTrack: 26, xSpan: 24, ySpan: 16 },
      table: { xTrack: 0, yTrack: 42, xSpan: 24, ySpan: 18 },
    },
  }],
};

export function InsightsStudio({ data, licenseKey }: { data: Insights; licenseKey?: string }) {
  const sources = useMemo<AgDataSourcesDefinition>(() => ({
    sources: [
      { id: "milestones", name: "Milestones", data: data.milestones, fields: [
        text("milestone", "Milestone"), text("job", "Job"), text("client", "Client"), text("freelancer", "Freelancer"), text("myRole", "My role"),
        text("state", "Stage"), text("proof", "Proof type"), text("currency", "Currency"), cash("amount", "Amount"), cash("paid", "Paid"),
        date("created", "Created"), { id: "daysToPaid", name: "Days to payment", format: "decimalFormat" },
      ] },
      { id: "verdicts", name: "AI verdicts", data: data.verdicts, fields: [
        { id: "requirement", name: "Requirement", format: "textFormat" }, text("status", "Result"), { id: "reason", name: "Reason", format: "textFormat" },
        text("milestone", "Milestone"), text("job", "Job"), date("checked", "Checked"),
      ] },
      { id: "payments", name: "Payments", data: data.payments, fields: [
        text("kind", "Movement"), cash("amount", "Amount"), text("currency", "Currency"), date("date", "Date"), text("milestone", "Milestone"), text("job", "Job"),
      ] },
      { id: "checks", name: "Website checks", data: data.checks, fields: [
        text("milestone", "Milestone"), text("job", "Job"), text("proof", "Proof type"),
        { id: "pages", name: "Pages crawled", format: "integerFormat" }, { id: "brokenLinks", name: "Broken links", format: "integerFormat" }, date("date", "Date"),
      ] },
    ],
  }), [data]);

  const ai = useMemo(() => ({ api }: { api: Parameters<typeof createAiHarness>[0] }) => createAiHarness(api, {
    adapter: geminiAdapter(),
    promptStarters: [
      { label: "Failing requirements", prompt: "Which checklist requirements fail most often? Add a chart." },
      { label: "Money per freelancer", prompt: "Show how much each freelancer has been paid." },
      { label: "Slow payments", prompt: "Which milestones took longest from funding to payment?" },
    ],
  }), []);

  return (
    <AgStudioProvider licenseKey={licenseKey} modules={[AgStudioAiModule]}>
      <AgStudio data={sources} initialState={initialState} mode="edit" theme={theme} ai={ai} style={{ height: "100%" }} />
    </AgStudioProvider>
  );
}
