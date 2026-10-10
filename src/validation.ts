import type { StandardSchemaV1 } from "@standard-schema/spec"
import type { FieldNode } from "./schema"

/**
 * Any schema implementing the Standard Schema spec (https://standardschema.dev):
 * Zod, Valibot, ArkType, Effect Schema and others.
 */
export type ValidationRules = StandardSchemaV1

/** Error messages keyed by dot path. */
export type ValidationErrors = Record<string, string[]>

export const DEFAULT_REQUIRED_MESSAGE = "The field is required"

export function isEmptyValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  )
}

export function issuePathToDotPath(path: StandardSchemaV1.Issue["path"]): string {
  return (path ?? [])
    .map((segment) => String(typeof segment === "object" ? segment.key : segment))
    .join(".")
}

export function joinDotPath(base: string, path: string): string {
  if (!base) return path
  if (!path) return base
  return `${base}.${path}`
}

/** Returns true if `dotPath` equals `scope` or lies under it. */
export function isWithinDotPath(dotPath: string, scope: string): boolean {
  return dotPath === scope || dotPath.startsWith(scope + ".")
}

export function addError(errors: ValidationErrors, dotPath: string, message: string) {
  const messages = (errors[dotPath] ??= [])
  if (!messages.includes(message)) {
    messages.push(message)
  }
}

/**
 * Validates `value` against a Standard Schema. Issue paths are appended to `basePath`,
 * so an issue at `["city"]` with base `address` is reported under `address.city`.
 */
export async function validateWithSchema(
  schema: ValidationRules,
  value: unknown,
  basePath = ""
): Promise<ValidationErrors> {
  const result = await schema["~standard"].validate(value)
  const errors: ValidationErrors = {}

  for (const issue of result.issues ?? []) {
    addError(errors, joinDotPath(basePath, issuePathToDotPath(issue.path)), issue.message)
  }

  return errors
}

/**
 * Validates a single field:
 * - an empty value fails if the field is `required`, and its `rules` are skipped;
 * - an empty value of an optional field is valid, and its `rules` are skipped;
 * - otherwise the value is checked against the field's `rules`, if any.
 */
export async function validateFieldNode(node: FieldNode): Promise<ValidationErrors> {
  const { required, requiredMessage, rules } = node.options ?? {}
  const value = node.getValue()

  if (isEmptyValue(value)) {
    return required ? { [node.dotPath]: [requiredMessage || DEFAULT_REQUIRED_MESSAGE] } : {}
  }

  return rules ? validateWithSchema(rules, value, node.dotPath) : {}
}
