import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  Activity,
  ActivityInput,
  Contact,
  ContactDetail,
  ContactImpact,
  ContactInput,
  Dashboard,
  Deal,
  DealDetail,
  DealImpact,
  DealInput,
  Organization,
  OrganizationDetail,
  OrganizationImpact,
  OrganizationInput,
  Pipeline,
  Stage,
} from "./types";

export const keys = {
  health: ["health"] as const,
  organizations: ["organizations"] as const,
  organization: (id: number) => ["organizations", id] as const,
  industries: ["organizations", "industries"] as const,
  contacts: ["contacts"] as const,
  contact: (id: number) => ["contacts", id] as const,
  deals: ["deals"] as const,
  deal: (id: number) => ["deals", id] as const,
  pipeline: ["pipeline"] as const,
  dashboard: ["dashboard"] as const,
};

// Reads

/** Today's date, as the backend sees it. The frontend never decides what today is. */
export function useToday(): string | undefined {
  return useQuery({
    queryKey: keys.health,
    queryFn: () => api.get<{ status: string; today: string }>("/health"),
    staleTime: 60_000,
  }).data?.today;
}

export const useOrganizations = () =>
  useQuery({ queryKey: keys.organizations, queryFn: () => api.get<Organization[]>("/organizations") });

export const useOrganization = (id: number) =>
  useQuery({ queryKey: keys.organization(id), queryFn: () => api.get<OrganizationDetail>(`/organizations/${id}`) });

export const useIndustries = () =>
  useQuery({ queryKey: keys.industries, queryFn: () => api.get<string[]>("/organizations/industries") });

export const useContacts = () =>
  useQuery({ queryKey: keys.contacts, queryFn: () => api.get<Contact[]>("/contacts") });

export const useContact = (id: number) =>
  useQuery({ queryKey: keys.contact(id), queryFn: () => api.get<ContactDetail>(`/contacts/${id}`) });

export const useDeals = () => useQuery({ queryKey: keys.deals, queryFn: () => api.get<Deal[]>("/deals") });

export const useDeal = (id: number) =>
  useQuery({ queryKey: keys.deal(id), queryFn: () => api.get<DealDetail>(`/deals/${id}`) });

export const usePipeline = () => useQuery({ queryKey: keys.pipeline, queryFn: () => api.get<Pipeline>("/pipeline") });

export const useDashboard = () =>
  useQuery({ queryKey: keys.dashboard, queryFn: () => api.get<Dashboard>("/dashboard") });

export type RecordKind = "organization" | "contact" | "deal" | "activity";
export type Impact = OrganizationImpact | ContactImpact | DealImpact | null;

const PATHS: Record<RecordKind, string> = {
  organization: "/organizations",
  contact: "/contacts",
  deal: "/deals",
  activity: "/activities",
};

/** What a delete would affect, for the confirm dialog. Activities have no impact to ask about. */
export const useDeleteImpact = (kind: RecordKind, id: number, enabled: boolean) =>
  useQuery({
    queryKey: ["delete-impact", kind, id],
    queryFn: () => (kind === "activity" ? Promise.resolve(null) : api.get<Impact>(`${PATHS[kind]}/${id}/delete-impact`)),
    enabled,
    staleTime: 0,
    gcTime: 0,
  });

// Writes. Records link to each other and feed the dashboard, so every write
// refreshes all the data that's on screen.

function useWrite<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => client.invalidateQueries(),
  });
}

export const useSaveOrganization = () =>
  useWrite(({ id, input }: { id?: number; input: OrganizationInput }) =>
    id ? api.patch<Organization>(`/organizations/${id}`, input) : api.post<Organization>("/organizations", input),
  );

export const useSaveContact = () =>
  useWrite(({ id, input }: { id?: number; input: ContactInput }) =>
    id ? api.patch<Contact>(`/contacts/${id}`, input) : api.post<Contact>("/contacts", input),
  );

export const useSaveDeal = () =>
  useWrite(({ id, input }: { id?: number; input: Partial<DealInput> }) =>
    id ? api.patch<Deal>(`/deals/${id}`, input) : api.post<Deal>("/deals", input),
  );

export const useSaveActivity = () =>
  useWrite(({ id, input }: { id?: number; input: Partial<ActivityInput> }) =>
    id ? api.patch<Activity>(`/activities/${id}`, input) : api.post<Activity>("/activities", input),
  );

/** Delete a record, then refresh everything except the deleted record itself,
 * which would only answer 404 while its page is still on screen. */
export function useDeleteRecord() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id }: { kind: RecordKind; id: number }) => api.delete(`${PATHS[kind]}/${id}`),
    onSettled: (_data, _error, { kind, id }) => {
      const plural = PATHS[kind].slice(1);
      const isGone = (key: readonly unknown[]) =>
        key[0] === "delete-impact" || (key[0] === plural && key[1] === id);
      return client.invalidateQueries({ predicate: (q) => !isGone(q.queryKey) });
    },
  });
}

export const moveDeal = (id: number, stage: Stage, index: number) =>
  api.post<Deal>(`/deals/${id}/move`, { stage, index });

export const useMoveDeal = () =>
  useWrite(({ id, stage, index }: { id: number; stage: Stage; index: number }) => moveDeal(id, stage, index));
