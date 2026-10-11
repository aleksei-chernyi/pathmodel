import "reflect-metadata"
import type { FormBase } from "./form"
import type { FieldComponent, LayoutComponent } from "./component-kind"
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
  readonly form: F
  readonly component: LayoutComponent
  readonly label: string
  readonly children: SomeNode[]
  readonly options: Record<string, any>

  constructor(
    form: F,
    component: LayoutComponent,
    label: string,
    children: SomeNode[],
    options: Record<string, any>
  ) {
    this.form = form
    this.component = component
    this.label = label
    this.children = children
    this.options = options
  }
}

export class FieldNode<Props = Record<string, any>, F extends FormBase = FormBase> {
  readonly form: F
  readonly component: FieldComponent
  readonly name: string
  readonly dotPath: string
  readonly nodePath: string
  readonly props: Props
  readonly options: FieldOptions

  constructor(
    form: F,
    component: FieldComponent,
    name: string,
    dotPath: string,
    nodePath: string,
    props: Props,
    options: FieldOptions
  ) {
    this.form = form
    this.component = component
    this.name = name
    this.dotPath = dotPath
    this.nodePath = nodePath
    this.props = props
    this.options = options
  }

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
