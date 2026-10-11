import "reflect-metadata"
import { FieldNode, getSchema, LayoutNode } from "./schema"
import type { FieldSchemaOptions, LayoutSchemaOptions, SomeNode } from "./schema"
import { isFieldComponent } from "./component-kind"
import { addError, isWithinDotPath, validateFieldNode, validateWithSchema } from "./validation"
import type { ValidationErrors, ValidationRules } from "./validation"

export interface FormOptionsInterface {
  title: string
  namespace?: string
  keepInValue?: boolean
}

export interface FormMetadata {
  nestedProperties: Record<
    string,
    {
      class: any
      formOptions: FormOptionsInterface
    }
  >
  nestedArrays: Record<
    string,
    {
      items: {
        class: any
        formOptions: FormOptionsInterface
      }[]
    }
  >
}

function collectFieldNodes(nodes: SomeNode[]): FieldNode[] {
  return nodes.flatMap((node) =>
    node instanceof LayoutNode ? collectFieldNodes(node.children || []) : [node]
  )
}

const META_KEY = Symbol("form:meta")
const FORM_OPTIONS_KEY = Symbol("form:form-options")

function setMeta(target: any, meta: FormMetadata) {
  Reflect.defineMetadata(META_KEY, meta, target)
}

function getMeta<T = FormMetadata>(target: any): T | undefined {
  return Reflect.getMetadata(META_KEY, target) as T | undefined
}

export function getFormOptions(target: any): FormOptionsInterface {
  return Reflect.getMetadata(FORM_OPTIONS_KEY, target)
}

export function FormOptions(options: FormOptionsInterface) {
  return (target: any) => {
    Reflect.defineMetadata(FORM_OPTIONS_KEY, options, target)
  }
}

export function Nested({ type }: { type: any }) {
  return (target: any, propertyKey: string) => {
    const existing = getMeta(target.constructor) || { nestedProperties: {}, nestedArrays: {} }
    existing.nestedProperties[propertyKey] = {
      class: type,
      formOptions: getFormOptions(type) || null,
    }

    setMeta(target.constructor, existing)
  }
}

export function NestedArray(options: { items: any[] }) {
  return (target: any, propertyKey: string) => {
    const existing = getMeta(target.constructor) || { nestedProperties: {}, nestedArrays: {} }
    existing.nestedArrays[propertyKey] = {
      ...options,
      items: options.items.map((cls) => ({
        class: cls,
        formOptions: getFormOptions(cls) || null,
      })),
    }

    setMeta(target.constructor, existing)
  }
}

export abstract class FormBase {
  [key: string]: any

  private readonly dotPathMap: Record<string, Map<FormBase, string>> = {}
  private validationErrors: ValidationErrors = {}
  // Kept behind a function so reactive wrappers (e.g. Vue's `reactive()`) never proxy the
  // schema itself: schemas such as Zod's have read-only properties a proxy cannot wrap.
  private getValueSchema: () => ValidationRules | null = () => null

  readonly options: FormOptionsInterface
  readonly root: FormBase

  constructor(options: FormOptionsInterface, root?: FormBase) {
    this.root = root ?? this
    const defaultOptions = { keepInValue: true }
    this.options = { ...defaultOptions, ...options }

    this.initializeNestedClasses(this.root)
    this.initializeDefaultsRecursive()
  }

  initializeDefaultsRecursive(instance: any = this, targetClass: any = this.constructor) {
    const schema = getSchema(targetClass) || {}

    // Set defaults or nulls for field components
    for (const [prop, schemaOptions] of Object.entries(schema)) {
      if (isFieldComponent(schemaOptions.component)) {
        // if (instance[prop] === undefined) {
        const options = schemaOptions.options
        instance[prop] = options && "default" in options ? options.default : null
        // }
      }
    }

    // Recurse into nested properties and arrays using metadata
    const meta = getMeta(targetClass) as FormMetadata | undefined
    if (!meta) return

    // Nested single properties
    for (const [prop, info] of Object.entries(meta.nestedProperties || {})) {
      const childInstance = (instance as any)[prop]
      if (childInstance) {
        this.initializeDefaultsRecursive(childInstance, (info as any).class)
      }
    }

    // Nested arrays with fixed item classes
    for (const [prop, arrInfo] of Object.entries(meta.nestedArrays || {})) {
      const arr = (instance as any)[prop]
      if (Array.isArray(arr)) {
        arrInfo.items.forEach((item, index) => {
          const child = arr[index]
          if (child) {
            this.initializeDefaultsRecursive(child, (item as any).class)
          }
        })
      }
    }
  }

  private initializeNestedClasses(root: FormBase) {
    const meta = getMeta(this.constructor)
    if (!meta) return

    for (const [property, info] of Object.entries(meta.nestedProperties)) {
      if (!this[property]) {
        this[property] = new (info as any).class(info.formOptions, root)
      }
    }
    if (meta.nestedArrays) {
      const instancePropertyMap = new Map(
        Object.entries(meta.nestedProperties).map(([k, v]) => [v.class, k])
      )
      for (const [arrayPropertyName, options] of Object.entries(meta.nestedArrays)) {
        this[arrayPropertyName] ??= []
        for (const item of options.items) {
          const propertyName = instancePropertyMap.get(item.class)
          if (propertyName) {
            this[arrayPropertyName].push(this[propertyName])
          } else {
            this[arrayPropertyName].push(new (item.class as any)(item.formOptions, root))
          }
        }
      }
    }
  }

  async setValueByDotPath(path: string, valueOrPromise: any | Promise<any>): Promise<void> {
    for (const [instance, property] of this.root.dotPathMap[path]) {
      instance[property] = await valueOrPromise
    }

    this.root.clearValidationError(path)
  }

  setValidationErrors(errors: Record<string, string[]>) {
    this.validationErrors = errors
  }

  getValidationErrorsCount(namespace: string): number {
    if (!namespace) {
      return 0
    }

    let res = 0
    for (const [dotPath, _errors] of Object.entries(this.root.validationErrors)) {
      if (dotPath === namespace || dotPath.startsWith(namespace + ".")) {
        res++
      }
    }

    return res
  }

  getValidationErrorsCountByPaths(dotPaths: string[]): number {
    if (!Array.isArray(dotPaths) || dotPaths.length === 0) {
      return 0
    }

    const matchedErrorPaths = new Set<string>()

    for (const dotPath of dotPaths) {
      if (!dotPath) {
        continue
      }

      if (!dotPath.includes("*")) {
        if (this.root.validationErrors[dotPath]?.length) {
          matchedErrorPaths.add(dotPath)
        }
        continue
      }

      const patternParts = dotPath.split(".")

      for (const [errorPath, errors] of Object.entries(this.root.validationErrors)) {
        if (!errors?.length) {
          continue
        }

        const pathParts = errorPath.split(".")
        if (pathParts.length !== patternParts.length) {
          continue
        }

        const isMatch = patternParts.every((part, i) => part === "*" || part === pathParts[i])
        if (isMatch) {
          matchedErrorPaths.add(errorPath)
        }
      }
    }

    return matchedErrorPaths.size
  }

  getValidationError(dotPath: string): string | null {
    return this.root.validationErrors[dotPath]?.[0] ?? null
  }

  getValidationErrors(): Record<string, string[]> {
    return { ...this.root.validationErrors }
  }

  getValidationErrorByPaths(dotPaths: string[]): string | null {
    for (const dotPath of dotPaths) {
      if (!dotPath) {
        continue
      }

      const direct = this.getValidationError(dotPath)
      if (direct) {
        return direct
      }

      if (!dotPath.includes("*")) {
        continue
      }

      const wildcard = this.getValidationErrorByWildcard(dotPath)
      if (wildcard) {
        return wildcard
      }
    }

    return null
  }

  private getValidationErrorByWildcard(dotPathPattern: string): string | null {
    const patternParts = dotPathPattern.split(".")

    for (const [dotPath, errors] of Object.entries(this.root.validationErrors)) {
      if (!errors?.length) {
        continue
      }

      const pathParts = dotPath.split(".")
      if (pathParts.length !== patternParts.length) {
        continue
      }

      const isMatch = patternParts.every((part, i) => part === "*" || part === pathParts[i])
      if (isMatch) {
        return errors[0]
      }
    }

    return null
  }

  clearValidationErrors() {
    this.root.validationErrors = {}
  }

  clearValidationError(dotPath: string) {
    if (!this.root.validationErrors[dotPath]) {
      return
    }

    const nextErrors = { ...this.root.validationErrors }
    delete nextErrors[dotPath]
    this.root.validationErrors = nextErrors
  }

  /** Sets a schema validated against the whole form value (`getFormValue()`) by `validate()`. */
  setValueSchema(schema: ValidationRules | null) {
    this.root.getValueSchema = () => schema
  }

  /**
   * Validates field `rules` / `required` options and the value schema, and stores the errors.
   * Without arguments, the whole form is validated and the error set is replaced. With `nodes`
   * (for example one step), only errors at or under those nodes' dot paths are replaced.
   * Resolves to `true` if the validated part has no errors.
   */
  async validate(nodes?: SomeNode[]): Promise<boolean> {
    const fieldNodes = collectFieldNodes(nodes ?? this.buildSchema())
    const scope = Array.from(new Set(fieldNodes.map((node) => node.dotPath)))
    const inScope = (dotPath: string) =>
      !nodes || scope.some((scopePath) => isWithinDotPath(dotPath, scopePath))

    const valueSchema = this.root.getValueSchema()
    const results = await Promise.all([
      ...fieldNodes.map((node) => validateFieldNode(node)),
      valueSchema ? validateWithSchema(valueSchema, this.getFormValue()) : Promise.resolve({}),
    ])

    const nextErrors: ValidationErrors = {}
    for (const errors of results) {
      for (const [dotPath, messages] of Object.entries(errors)) {
        if (!inScope(dotPath)) continue
        for (const message of messages) addError(nextErrors, dotPath, message)
      }
    }

    const keptErrors = Object.fromEntries(
      Object.entries(this.root.validationErrors).filter(([dotPath]) => !inScope(dotPath))
    )
    this.root.validationErrors = { ...keptErrors, ...nextErrors }

    return Object.keys(nextErrors).length === 0
  }

  private deepSet(obj: any, path: string, value: any) {
    const parts = path.split(".")
    let current = obj
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!(part in current)) {
        // If the next part is a number, create an array, else object
        const nextPart = parts[i + 1]
        if (/^\d+$/.test(nextPart)) {
          current[part] = []
        } else {
          current[part] = {}
        }
      }
      current = current[part]
    }
    const lastPart = parts[parts.length - 1]
    current[lastPart] = value
  }

  getFormValue(): Record<string, any> {
    const result: Record<string, any> = {}
    for (const [dotPath, instanceMap] of Object.entries(this.root.dotPathMap)) {
      for (const [instance, prop] of instanceMap) {
        if (instance.includedIntoValue()) {
          const value = instance[prop]
          this.deepSet(result, dotPath, value)
        }
      }
    }
    return result
  }

  private deepGet(obj: any, path: string): any {
    if (obj == null) return undefined
    const parts = path.split(".")
    let current = obj
    for (const part of parts) {
      if (current == null || !(part in current)) {
        return undefined
      }
      current = current[part]
    }
    return current
  }

  setFormValue(values: Record<string, any>): void {
    for (const [dotPath, instanceMap] of Object.entries(this.root.dotPathMap)) {
      const value = this.deepGet(values, dotPath)
      if (value !== undefined) {
        for (const [instance, prop] of instanceMap) {
          instance[prop] = value
        }
      }
    }
  }

  buildSchema(
    basePath = "",
    targetClass?: any,
    isArrayParent = false,
    arrayIndex?: number,
    instance?: any
  ): SomeNode[] {
    const actualInstance = instance || this
    targetClass ??= this.constructor
    const schema = getSchema(targetClass) || {}
    const meta = getMeta(targetClass) as FormMetadata

    const nodes: SomeNode[] = []

    for (const [prop, options] of Object.entries(schema)) {
      const parentPath = isArrayParent ? `${basePath}.${arrayIndex}` : basePath

      const fullPath = parentPath && parentPath.length > 0 ? `${parentPath}.${prop}` : prop

      if (isFieldComponent(options.component)) {
        const fieldSchemaOptions = options as FieldSchemaOptions<any>
        nodes.push(
          new FieldNode(
            actualInstance,
            options.component,
            prop,
            "dotPath" in options ? options.dotPath : prop,
            fullPath,
            fieldSchemaOptions.props ?? {},
            fieldSchemaOptions.options ?? {}
          )
        )
        this.addDotPathToMap(fieldSchemaOptions.dotPath, actualInstance, prop)
        continue
      }

      const layoutSchemaOptions = options as LayoutSchemaOptions<any>

      if (meta.nestedProperties[prop]) {
        const childClass = meta.nestedProperties[prop].class

        nodes.push(
          new LayoutNode(
            actualInstance,
            options.component as any,
            layoutSchemaOptions.label ? layoutSchemaOptions.label : "",
            this.buildSchema(fullPath, childClass, false, undefined, actualInstance[prop]),
            options.options ?? {}
          )
        )
        continue
      }

      if (meta.nestedArrays[prop]) {
        const arrayItemTypes = meta.nestedArrays[prop].items

        const arrayNodeChildren: SomeNode[] = []

        arrayItemTypes.forEach((item, index) => {
          const childSchemaNodes = this.buildSchema(
            `${fullPath}`,
            item.class,
            true,
            index,
            actualInstance[prop][index]
          )
          const nestedComponent = layoutSchemaOptions.component.getChildComponent?.()
          if (nestedComponent) {
            arrayNodeChildren.push(
              new LayoutNode(
                actualInstance,
                nestedComponent,
                (item as any).formOptions?.title || `Case ${index + 1}`,
                childSchemaNodes,
                getFormOptions(item.class)
              )
            )
          } else {
            arrayNodeChildren.push(...childSchemaNodes)
          }
        })

        nodes.push(
          new LayoutNode(
            actualInstance,
            layoutSchemaOptions.component,
            layoutSchemaOptions.label ? layoutSchemaOptions.label : "",
            arrayNodeChildren,
            layoutSchemaOptions.options ?? {}
          )
        )
      }
    }

    return nodes
  }

  addDotPathToMap(dotPath: string, instance: any, prop: string) {
    if (!dotPath) {
      throw new Error("Cannot add empty dotPath to map")
    }

    const root = this.root

    root.dotPathMap[dotPath] ??= new Map()
    if (!root.dotPathMap[dotPath].has(instance)) {
      root.dotPathMap[dotPath].set(instance, prop)
    }
  }

  includedIntoValue() {
    return this.options.keepInValue
  }
}
