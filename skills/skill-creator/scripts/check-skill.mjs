#!/usr/bin/env node

import { access, readFile, stat } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KNOWN_FIELDS = new Set([
	"name",
	"description",
	"license",
	"compatibility",
	"metadata",
	"allowed-tools",
	"disable-model-invocation",
]);

function usage() {
	console.log("Usage: node check-skill.mjs <skill-directory-or-SKILL.md>");
}

function localMarkdownLinks(markdown) {
	const links = [];
	const pattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
	for (const match of markdown.matchAll(pattern)) {
		let target = match[1].trim();
		if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);
		if (!target || target.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
		const withoutTitle = target.replace(/\s+["'][^"']*["']$/, "");
		const encodedPath = withoutTitle.split("#", 1)[0];
		try {
			links.push(decodeURIComponent(encodedPath));
		} catch {
			links.push({ invalidEncoding: encodedPath });
		}
	}
	return links;
}

const input = process.argv[2];
if (!input || input === "--help" || input === "-h") {
	usage();
	process.exit(input ? 0 : 1);
}

const inputPath = resolve(input);
let skillFile = inputPath;
try {
	if ((await stat(inputPath)).isDirectory()) skillFile = resolve(inputPath, "SKILL.md");
} catch {
	console.error(`FAIL: path does not exist: ${inputPath}`);
	process.exit(1);
}

const errors = [];
const warnings = [];
const notes = [];
let content;
try {
	content = await readFile(skillFile, "utf8");
} catch {
	console.error(`FAIL: cannot read ${skillFile}`);
	process.exit(1);
}

const normalized = content.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n").replaceAll("\r", "\n");
const lines = normalized.split("\n");
if (lines[0] !== "---") errors.push("SKILL.md must begin with YAML frontmatter (---)");

const closingIndex = lines.slice(1).findIndex((line) => line === "---");
if (closingIndex < 0) {
	errors.push("SKILL.md is missing the closing frontmatter delimiter");
} else {
	let frontmatter = {};
	let body = "";
	try {
		({ frontmatter, body } = parseFrontmatter(normalized));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		errors.push(`Pi cannot parse YAML frontmatter: ${message}`);
	}

	if (!frontmatter || typeof frontmatter !== "object" || Array.isArray(frontmatter)) {
		errors.push("frontmatter must be a YAML mapping");
		frontmatter = {};
	}

	for (const key of Object.keys(frontmatter)) {
		if (!KNOWN_FIELDS.has(key)) notes.push(`Pi ignores unknown frontmatter field: ${key}`);
	}

	const name = frontmatter.name;
	const description = frontmatter.description;
	const compatibility = frontmatter.compatibility;
	const license = frontmatter.license;
	const metadata = frontmatter.metadata;
	const allowedTools = frontmatter["allowed-tools"];
	const manualOnly = frontmatter["disable-model-invocation"];

	if (typeof name !== "string" || !name) {
		errors.push("frontmatter name is required");
	} else {
		if (name.length > 64) errors.push(`name exceeds 64 characters (${name.length})`);
		if (!NAME_PATTERN.test(name)) {
			errors.push("name must use lowercase letters, digits, and single hyphens only");
		}
		const folderName = basename(dirname(skillFile));
		if (folderName !== name) {
			warnings.push(`directory '${folderName}' differs from name '${name}'; Pi allows this, but the Agent Skills standard does not`);
		}
	}

	if (typeof description !== "string" || !description.trim()) {
		errors.push("frontmatter description is required and cannot be empty");
	} else {
		if (description.length > 1024) {
			errors.push(`description exceeds 1024 characters (${description.length})`);
		}
		if (!/\b(use|when|for)\b/i.test(description)) {
			warnings.push("description may not explain when Pi should select the skill");
		}
	}

	if (compatibility !== undefined && compatibility !== null) {
		if (typeof compatibility !== "string" || !compatibility) {
			errors.push("compatibility must be a non-empty string when present");
		} else if (compatibility.length > 500) {
			errors.push(`compatibility exceeds 500 characters (${compatibility.length})`);
		}
	}
	if (license !== undefined && typeof license !== "string") {
		errors.push("license must be a string when present");
	}
	if (allowedTools !== undefined && typeof allowedTools !== "string") {
		errors.push("allowed-tools must be a space-delimited string when present");
	}
	if (metadata !== undefined) {
		if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
			errors.push("metadata must be a string-to-string mapping when present");
		} else if (Object.values(metadata).some((value) => typeof value !== "string")) {
			errors.push("every metadata value must be a string");
		}
	}

	if (manualOnly !== undefined && typeof manualOnly !== "boolean") {
		errors.push("disable-model-invocation must be true or false");
	}

	if (!body) errors.push("SKILL.md body cannot be empty");
	if (/\b(TODO|FIXME)\b|\[TODO[:\]]/i.test(body)) {
		errors.push("SKILL.md still contains TODO or FIXME placeholders");
	}
	if (body.split("\n").length > 500) {
		notes.push("SKILL.md body exceeds the Agent Skills 500-line design recommendation; Pi still loads longer skills");
	}

	for (const link of localMarkdownLinks(body)) {
		if (typeof link !== "string") {
			errors.push(`invalid percent-encoding in local link: ${link.invalidEncoding}`);
			continue;
		}
		try {
			await access(resolve(dirname(skillFile), link));
		} catch {
			errors.push(`missing local link target: ${link}`);
		}
	}
}

if (extname(skillFile).toLowerCase() !== ".md" || basename(skillFile) !== "SKILL.md") {
	warnings.push("portable directory skills should use a file named SKILL.md");
}

for (const note of notes) console.log(`NOTE: ${note}`);
for (const warning of warnings) console.warn(`WARN: ${warning}`);
for (const error of errors) console.error(`FAIL: ${error}`);

if (errors.length > 0) {
	console.error(`\n${errors.length} error(s), ${warnings.length} warning(s): ${skillFile}`);
	process.exit(1);
}

console.log(`PASS: ${skillFile} (${warnings.length} warning(s))`);
