// Formatting for underclass admin API payloads. Fields are read defensively:
// underclass may add or rename keys without notice.

type Payload = Record<string, unknown>;

function record(value: unknown): Payload | undefined {
	return value && typeof value === "object" ? (value as Payload) : undefined;
}

function accountList(state: Payload): unknown[] {
	return Array.isArray(state.accounts) ? state.accounts : [];
}

function accountEnabled(account: unknown): boolean {
	const fields = record(account);
	return fields?.enabled !== false && fields?.disabled !== true;
}

function flowState(account: unknown): string | undefined {
	const fields = record(account);
	for (const key of ["flow_state", "flowState", "state", "status"]) {
		const value = fields?.[key];
		if (typeof value === "string" && value) return value;
	}
	return undefined;
}

function accountLabel(account: unknown, index: number): string {
	const fields = record(account);
	for (const key of ["email", "account_id", "accountId", "id", "name", "label"]) {
		const value = fields?.[key];
		if (typeof value === "string" && value) return value;
	}
	return `#${index + 1}`;
}

export function formatStatus(state: Payload, origin: string): string {
	const list = accountList(state);
	const enabled = list.filter(accountEnabled).length;
	const lines = [
		`underclass ${origin}`,
		`accounts: ${list.length} (${enabled} enabled, ${list.length - enabled} disabled)`,
	];
	if (Array.isArray(state.requests)) lines.push(`requests tracked: ${state.requests.length}`);
	const flows = list.map(flowState).filter((value): value is string => !!value);
	if (flows.length > 0) lines.push(`flow state: ${flows.join(", ")}`);
	return lines.join("\n");
}

export function formatAccounts(state: Payload): string {
	const list = accountList(state);
	if (list.length === 0) return "No underclass accounts are configured.";
	return list
		.map((account, index) => {
			const flow = flowState(account);
			return `- ${accountLabel(account, index)}: ${accountEnabled(account) ? "enabled" : "disabled"}${flow ? ` (${flow})` : ""}`;
		})
		.join("\n");
}

const METRIC_KEYS = ["requests", "input_tokens", "output_tokens", "total_tokens", "cost_usd", "credits"];

function formatMetrics(value: unknown): string {
	const fields = record(value);
	if (!fields) return "no metrics";
	const parts = METRIC_KEYS.filter((key) => typeof fields[key] === "number").map((key) => `${key}=${fields[key]}`);
	return parts.length > 0 ? parts.join(" ") : "no metrics";
}

export function formatUsage(payload: Payload): string {
	const lines = [`totals: ${formatMetrics(payload.totals)}`];
	const groups = Array.isArray(payload.groups) ? payload.groups : [];
	if (groups.length > 0) {
		lines.push("top groups:");
		for (const group of groups.slice(0, 10)) {
			const fields = record(group);
			const label = [fields?.key, fields?.group, fields?.group_by, fields?.model, fields?.account_id]
				.find((value): value is string => typeof value === "string" && !!value);
			lines.push(`- ${label ?? "unknown"}: ${formatMetrics(group)}`);
		}
	}
	return lines.join("\n");
}
