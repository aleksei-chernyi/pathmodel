# pathmodel

Class-based data models addressed by dot paths, in TypeScript. You describe the shape of your
data as a class tree with decorators. Each field is bound to a dot path in the resulting value.
Fields that share a path stay in sync, and validation errors are keyed by path. `FormBase`
also builds a schema (a tree of layout and field nodes) from the classes, and the bundled
**Vue 3** components render that schema as a form.

## Contents

- `src/schema.ts`: the `@Schema` decorator, plus `FieldNode` / `LayoutNode`
- `src/form.ts`: `FormBase`, `@FormOptions`, `@Nested`, `@NestedArray`
- `src/form-switch.ts`: `FormSwitch` / `FormCase` for forms with switchable cases or steps
- `src/validation.ts`: the validation adapter for [Standard Schema](https://standardschema.dev) libraries
- `src/component-kind.ts`: `COMPONENT_KIND` and helpers that tell layout components from field components
- `src/template/`: `SchemaRenderer.vue` and `SchemaNodeRenderer.vue`, which render the schema
- `src/layout/`: layout components: `Row`, `Col`, `Wrapper`, `Switch`, `Stepper`, `Case`, `Empty`

`src/index.ts` exports everything except the `.vue` files, which you import by path.

## Installation

```bash
npm install @aleksei-chernyi/pathmodel reflect-metadata vue
```

## Requirements

- Node.js >= 18
- A Vue 3 host app whose bundler compiles `.vue` SFCs with `<script setup lang="ts">` and
  `<style lang="scss">` (for example Vite with `@vitejs/plugin-vue` and `sass`)
- `reflect-metadata`, imported once at startup
- TypeScript with decorators enabled:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

```ts
import "reflect-metadata"
```

> `vue` (^3.3) is a peer dependency. The host app provides it.

Class fields must use TypeScript's legacy semantics (`useDefineForClassFields: false`).
Otherwise a field declaration with no initializer, such as `address!: AddressForm`, resets the
nested form that `FormBase` created to `undefined`. With `tsc`, set the option in
`tsconfig.json`; a `target` of ES2021 or lower turns it off by default. Vite 8 compiles
TypeScript with Oxc, which needs this config:

```ts
// vite.config.ts
export default defineConfig({
  oxc: {
    assumptions: { setPublicClassFields: true },
    typescript: { removeClassFieldsWithoutInitializer: true },
  },
})
```

## Concepts

### Components

Every node has a Vue `component`. A component is a **layout** if it declares
`defineOptions({ __kind: COMPONENT_KIND.LAYOUT })`. Any other component is a **field**.

- **Field components** get the props `node` (a `FieldNode`), `root` (the root form), `error`,
  `fieldError` and `hasError`. They read values with `node.getValue()` and write them with
  `node.setValue(value)`. They can read resolved props with `node.getProps()`.
- **Layout components** get `node` (a `LayoutNode`) and `root`, and render their children
  through the default slot. A layout component can define `getChildComponent()` in
  `defineOptions`. When it does, each item of a `@NestedArray` is wrapped in a `LayoutNode` that
  uses that component. The slot then exposes the selected item as `nested`. `Switch` and
  `Stepper` work this way, with `Case` as the child component.

### Decorators

| Decorator                 | Target   | Purpose                                                                                                                         |
| ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `@Schema(options)`        | property | Declares a field (`{ component, dotPath, props, options? }`) or a layout container (`{ component, label?, props?, options? }`). |
| `@Nested({ type })`       | property | The property is a nested form of class `type`. It is instantiated automatically.                                                |
| `@NestedArray({ items })` | property | The property is an array of nested forms, one instance per class in `items`, in order.                                          |
| `@FormOptions(options)`   | class    | Sets the `FormOptionsInterface` passed to a nested class when it is created.                                                    |

A nested property needs both `@Schema` (with a layout component) and `@Nested` / `@NestedArray`.
The `@Schema` part decides how the property renders.

`FormOptionsInterface`:

- `title`: shown as the tab or step label for array items
- `namespace?`: dot path prefix used to count a step's validation errors
- `keepInValue?`: defaults to `true`. If `false`, the form's fields are left out of
  `getFormValue()`. For a `FormCase`, they are left out unless the case is active.

Field `options` (`FieldOptions`):

- `default`: the initial value (otherwise `null`)
- `required`: an empty value is an error (see [Validation](#validation))
- `requiredMessage`: error text. The default is `"The field is required"`.
- `rules`: a Standard Schema (Zod, Valibot, ArkType, ...) that checks the field's value

A function value in a field's `props` is called with the owning form instance when
`node.getProps()` runs. Two prop keys have special meaning for the renderer:

- `validationErrorPaths: string[]`: sub-paths under the field's `dotPath` whose errors also
  belong to this field. Useful for composite fields.
- `inlineError: true`: the field renders its own error, so the renderer skips the default
  `.field-error` block.

### Dot paths

Each field's `dotPath` is its key in the form value. Several fields, even in different nested
forms, can share one `dotPath`. They then stay in sync: `setValueByDotPath` writes every
instance mapped to that path. The map is filled during `buildSchema()`, so call `buildSchema()`
before you read or write values.

## Usage

```ts
import "reflect-metadata"
import { FormBase, FormOptions, Nested, Schema } from "@aleksei-chernyi/pathmodel"
import Row from "@aleksei-chernyi/pathmodel/src/layout/Row.vue"
import TextInput from "./TextInput.vue" // your field component

@FormOptions({ title: "Address" })
class AddressForm extends FormBase {
  @Schema({ component: TextInput, dotPath: "address.city", props: { label: "City" } })
  city!: string
}

class UserForm extends FormBase {
  @Schema({
    component: TextInput,
    dotPath: "firstName",
    props: { label: "First name" },
    options: { required: true },
  })
  firstName!: string

  @Schema({ component: Row })
  @Nested({ type: AddressForm })
  address!: AddressForm
}

const form = new UserForm({ title: "User" })
const nodes = form.buildSchema()

form.setFormValue({ firstName: "Ada", address: { city: "London" } })
form.getFormValue() // { firstName: "Ada", address: { city: "London" } }
```

Rendering:

```vue
<script setup lang="ts">
import { reactive } from "vue"
import SchemaRenderer from "@aleksei-chernyi/pathmodel/src/template/SchemaRenderer.vue"

// `reactive()` returns an unwrapped type; the cast keeps the class type for `:root`.
const form = reactive(new UserForm({ title: "User" })) as UserForm
const nodes = form.buildSchema()
</script>

<template>
  <SchemaRenderer :nodes="nodes" :root="form" />
</template>
```

### Switch and stepper forms

Extend `FormSwitch` for the container and `FormCase` for each case. Put the cases on a
`@NestedArray` property named `cases`, and render it with `Switch` (tabs) or `Stepper`
(numbered steps):

```ts
import { FormCase, FormSwitch } from "@aleksei-chernyi/pathmodel"
import Stepper from "@aleksei-chernyi/pathmodel/src/layout/Stepper.vue"

@FormOptions({ title: "Contacts", namespace: "contacts" })
class ContactsStep extends FormCase {
  protected _case = "contacts"
  // ...fields
}

class Wizard extends FormSwitch {
  @Schema({ component: Stepper, options: { showHeader: true } })
  @NestedArray({ items: [ContactsStep, PaymentStep] })
  cases!: FormCase[]
}
```

- `toggleActiveCase(value)` activates the case whose `_case` equals `value`.
  `setActiveCaseIndex(i)` activates a case by position.
- `Stepper` locks steps after `getMaxReachedCaseIndex()`. Use `unlockCaseIndex(i)` and
  `resetCaseProgress()` to control progress. A step can only move forward if
  `validate()` passes for the current step. Each step shows a badge with its error
  count, matched by field dot paths, `validationErrorPaths` and the case `namespace`. The
  active step scrolls into view.
- Layout options for both components: `showHeader` (default `true`) and `hideWhenNoActive`.

`Stepper` styles use host CSS variables: `--var-main-color`, `--var-button-bg-100`,
`--var-button-bg-400`, `--var-button-active-bg`, `--var-text-color-disabled`, `--var-danger`
and `--var-border-radius-big`.

### Other layouts

- `Row` / `Col`: a `div` with the class `.form__row` / `.form__col`
- `Wrapper`: a `div` with the class `options.className` (default `form-wrapper`), plus an
  optional `options.title` header
- `Empty`: renders nothing. A field that uses it is skipped by the renderer.

## Validation

pathmodel has no validation rules of its own. Rules come from any library that implements
[Standard Schema](https://standardschema.dev), such as [Zod](https://zod.dev),
[Valibot](https://valibot.dev) or [ArkType](https://arktype.io). Install the one you prefer
in your app; pathmodel only depends on the spec's types.

### Field rules

```ts
import { z } from "zod"

class ContactsForm extends FormBase {
  @Schema({
    component: TextInput,
    dotPath: "contacts.email",
    props: { label: "Email" },
    options: { required: true, rules: z.email("Некорректный email") },
  })
  email!: string | null

  @Schema({
    component: AddressInput,
    dotPath: "contacts.address",
    props: { validationErrorPaths: ["city", "street"] },
    // Issue paths are appended to the field's dot path: "contacts.address.city"
    options: { rules: z.object({ city: z.string().min(1), street: z.string().min(1) }) },
  })
  address!: { city: string; street: string } | null
}
```

For each field:

1. An empty value (`null`, `undefined`, a blank string, `[]`) is an error if the field is
   `required`, and valid otherwise. `rules` are not run on empty values, so optional fields
   don't need `.nullable()` or `.optional()`.
2. A non-empty value is checked against `rules`.

### Value schema

For rules that involve several fields, set a schema for the whole form value. It is checked
against `getFormValue()`, and each issue path is the dot path of the error:

```ts
form.setValueSchema(
  z
    .object({ account: z.object({ password: z.string(), confirm: z.string() }) })
    .refine((v) => v.account.password === v.account.confirm, {
      message: "Пароли не совпадают",
      path: ["account", "confirm"],
    })
)
```

### Running validation

```ts
const ok = await form.validate() // whole form; replaces all errors
const stepOk = await form.validate(step.children) // only these nodes
```

With `nodes`, only errors at or under those nodes' dot paths are replaced. Other errors are
kept, for example server errors on other steps. Value schema issues outside those paths are
ignored. `Stepper` uses this to validate the current step.

You can also call `validateWithSchema(schema, value, basePath?)` directly to validate any
value and get errors keyed by dot path.

### Error store

All errors live on the root form as `Record<dotPath, string[]>`.

| Method                                                                    | Description                                                                                     |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `validate(nodes?)`                                                        | Runs field rules and the value schema, stores the errors, resolves to `true` if there are none. |
| `setValueSchema(schema)`                                                  | Sets or clears (`null`) the schema for the whole form value.                                    |
| `setValidationErrors(errors)`                                             | Sets errors, for example from a server response. Call it on the root form.                      |
| `getValidationError(path)` / `getValidationErrors()`                      | Returns the first error for a path, or all errors.                                              |
| `getValidationErrorByPaths(paths)`                                        | Returns the first error across several paths. `*` matches one path segment.                     |
| `getValidationErrorsCount(ns)` / `getValidationErrorsCountByPaths(paths)` | Counts errors under a namespace prefix, or across paths (wildcards allowed).                    |
| `clearValidationError(path)` / `clearValidationErrors()`                  | Clears one path or all errors. Setting a value by dot path also clears that path's errors.      |

## Development

```bash
npm install
npm test           # vitest
npm run lint       # eslint
npm run format     # prettier
npm run build      # tsc -> dist/ (CommonJS + .d.ts)
```

Known gap in the current tooling:

- `tsc` does not compile `.vue` files, so they are not in `dist/`. Consumers use them from
  `src/`.

## License

[MIT](LICENSE)
