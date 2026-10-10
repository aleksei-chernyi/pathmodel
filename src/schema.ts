import "reflect-metadata"
import { FormBase } from "./form"
import { FieldComponent, LayoutComponent } from "./component-kind"
import type { ValidationRules } from "./validation"

export interface LayoutSchemaOptions<T> {
  component: LayoutComponent
  label?: string
  props?: T
  options?: Record<string, any>
}

export interface FieldSchemaOptions<T> {
  component: FieldComponent
  dotPath: string
  props: T
  options?: FieldOptions
}

export interface FieldOptions extends Record<string, any> {
  default?: any
  /** An empty value (`null`, `undefined`, blank string, empty array) is an error. */
  required?: boolean
  requiredMessage?: string
  /** A Standard Schema (Zod, Valibot, ArkType, ...) checked against non-empty values. */
  rules?: ValidationRules
}

export type SchemaOptions<T = Record<string, any>> = FieldSchemaOptions<T> | LayoutSchemaOptions<T>
export type SchemaMetadata = Record<string, SchemaOptions>

export type SomeNode = LayoutNode | FieldNode

export class LayoutNode<F extends FormBase = FormBase> {
  constructor(
    public readonly form: F,
    public readonly component: LayoutComponent,
    public readonly label: string,
    public readonly children: SomeNode[],
    public readonly options: Record<string, any>
  ) {}
}

export class FieldNode<Props = Record<string, any>, F extends FormBase = FormBase> {
  constructor(
    public readonly form: F,
    public readonly component: FieldComponent,
    public readonly name: string,
    public readonly dotPath: string,
    public readonly nodePath: string,
    public readonly props: Props,
    public readonly options: FieldOptions
  ) {}

  async setValue(value: any): Promise<void> {
    // await this.node.setValue(this.name, value)
    await this.form.setValueByDotPath(this.dotPath, value)
  }

  getValue<T = any>(): T {
    return (this.form as any)[this.name] as T
  }

  getProps() {
    const props: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(this.props || {})) {
      if (typeof value === "function") {
        props[key] = value(this.form)
      } else {
        props[key] = value
      }
    }
    return props
  }

  getValidationError(): string | null {
    return this.form.getValidationError(this.dotPath)
  }

  isRequired(): boolean {
    return Boolean(this.options?.required)
  }
}

const SCHEMA_META_KEY = Symbol("form:schema")

export function Schema<T extends Record<string, any>>(options: SchemaOptions<T>) {
  return (target: any, propertyKey: string) => {
    const schemaMeta: SchemaMetadata =
      Reflect.getMetadata(SCHEMA_META_KEY, target.constructor) || {}

    schemaMeta[propertyKey] = options

    Reflect.defineMetadata(SCHEMA_META_KEY, schemaMeta, target.constructor)
  }
}

export function getSchema(target: any): SchemaMetadata | undefined {
  return Reflect.getMetadata(SCHEMA_META_KEY, target)
}
