import { TabsList, TabsTrigger } from "@/components/ui/tabs";

export const SYSTEM_ORGANISATION_TABS = [
  ["overview", "Overview"],
  ["plan", "Plan & options"],
  ["billing", "Billing"],
  ["members", "Members"],
  ["xero", "Xero files"],
  ["support", "Support"],
  ["audit", "Audit log"],
] as const;

export type SystemOrganisationTab = (typeof SYSTEM_ORGANISATION_TABS)[number][0];

export function SystemOrganisationTabs() {
  return (
    <div className="overflow-x-auto pb-1">
      <TabsList className="h-auto min-w-max justify-start">
        {SYSTEM_ORGANISATION_TABS.map(([value, label]) => (
          <TabsTrigger key={value} value={value}>{label}</TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
}