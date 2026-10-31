#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(message) {
	console.error(`Error: ${message}`);
	process.exit(1);
}

function usage() {
	console.log(`Usage:
  node init-skill.mjs <skill-name> --path <parent-directory> --description <text> [--manual-only]

Example:
  node init-skill.mjs release-notes --path .pi/skills \\
    --description "Draft release notes from repository changes. Use when preparing a release or changelog summary."`);
}

function parseArgs(argv) {
	if (argv.includes("--help") || argv.includes("-h")) {
		usage();
		process.exit(0);
	}

	const name = argv[0];
	if (!name || name.startsWith("-")) {
		fail("provide a skill name as the first argument");
	}

	let parentPath;
	let description;
	let manualOnly = false;

	for (let index = 1; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--manual-only") {
			manualOnly = true;
			continue;
		}
		if (argument === "--path" || argument === "--description") {
			const value = argv[index + 1];
			if (!value || value.startsWith("--")) {
				fail(`${argument} requires a value`);
			}
			if (argument === "--path") parentPath = value;
			if (argument === "--description") description = value;
			index += 1;
			continue;
		}
		fail(`unknown argument: ${argument}`);
	}

	return { name, parentPath, description, manualOnly };
}

function titleFromName(name) {
	return name
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

function yamlString(value) {
	return JSON.stringify(value);
}

const { name, parentPath, description, manualOnly } = parseArgs(process.argv.slice(2));

if (!NAME_PATTERN.test(name) || name.length > 64) {
	fail("skill name must be 1-64 lowercase letters, digits, or single hyphens");
}
if (!parentPath) fail("--path is required");
if (!description?.trim()) fail("--description is required and cannot be empty");
if (description.length > 1024) fail("description must not exceed 1024 characters");

const skillDirectory = resolve(parentPath, name);
const frontmatter = [
	"---",
	`name: ${name}`,
	`description: ${yamlString(description.trim())}`,
	...(manualOnly ? ["disable-model-invocation: true"] : []),
	"---",
].join("\n");

const body = `${frontmatter}

# ${titleFromName(name)}

## Goal

TODO: Explain the outcome this skill enables and the important boundaries.

## Workflow

1. TODO: Inspect the user's context and inputs.
2. TODO: Perform the task using the required tools or resources.
3. TODO: Validate the result and report important limitations.

## Quality checks

- TODO: Add checks that distinguish a correct result from a plausible one.
`;

try {
	await mkdir(resolve(parentPath), { recursive: true });
	await mkdir(skillDirectory, { recursive: false });
	await writeFile(resolve(skillDirectory, "SKILL.md"), body, { flag: "wx" });
} catch (error) {
	if (error && typeof error === "object" && error.code === "EEXIST") {
		fail(`target already exists: ${skillDirectory}`);
	}
	const message = error instanceof Error ? error.message : String(error);
	fail(`could not create ${skillDirectory}: ${message}`);
}

console.log(`Created ${resolve(skillDirectory, "SKILL.md")}`);
console.log("Next: replace every TODO, add only necessary resources, then run check-skill.mjs.");
