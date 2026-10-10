import "reflect-metadata"
import { describe, it, expect } from "vitest"
import { z } from "zod"
import {
  COMPONENT_KIND,
  DEFAULT_REQUIRED_MESSAGE,
  FieldComponent,
  FormBase,
  LayoutComponent,
  LayoutNode,
  Nested,
  Schema,
  issuePathToDotPath,
  validateWithSchema,
} from "../src"

const Field: FieldComponent = { __kind: COMPONENT_KIND.FIELD }
const Layout: LayoutComponent = { __kind: COMPONENT_KIND.LAYOUT }

class Contacts extends FormBase {
  email!: string | null
  phone!: string | null
}
Schema({
  component: Field,
  dotPath: "contacts.email",
  props: {},
  options: { required: true, rules: z.email("Invalid email") },
})(Contacts.prototype, "email")
Schema({
  component: Field,
  dotPath: "contacts.phone",
  props: {},
  options: { rules: z.string().regex(/^\+\d+$/, "Invalid phone") },
})(Contacts.prototype, "phone")

class Account extends FormBase {
  password!: string | null
  confirm!: string | null
}
Schema({ component: Field, dotPath: "account.password", props: {} })(Account.prototype, "password")
Schema({ component: Field, dotPath: "account.confirm", props: {} })(Account.prototype, "confirm")

class Signup extends FormBase {
  contacts!: Contacts
  account!: Account
}
Nested({ type: Contacts })(Signup.prototype, "contacts")
Schema({ component: Layout })(Signup.prototype, "contacts")
Nested({ type: Account })(Signup.prototype, "account")
Schema({ component: Layout })(Signup.prototype, "account")

const passwordsMatch = z
  .object({
    account: z.object({ password: z.string().nullable(), confirm: z.string().nullable() }),
  })
  .refine((v) => v.account.password === v.account.confirm, {
    message: "Passwords do not match",
    path: ["account", "confirm"],
  })

function createForm() {
  const form = new Signup({ title: "Signup" })
  const nodes = form.buildSchema()
  return { form, nodes }
}

describe("validation helpers", () => {
  it("converts issue paths to dot paths", () => {
    expect(issuePathToDotPath(["a", 0, { key: "b" }])).toBe("a.0.b")
    expect(issuePathToDotPath(undefined)).toBe("")
  })

  it("prefixes nested issue paths with the base path", async () => {
    const schema = z.object({ city: z.string().min(1, "City is required") })
    expect(await validateWithSchema(schema, { city: "" }, "address")).toEqual({
      "address.city": ["City is required"],
    })
  })
})

describe("FormBase.validate", () => {
  it("reports required fields and skips rules for empty optional fields", async () => {
    const { form } = createForm()

    expect(await form.validate()).toBe(false)
    expect(form.getValidationErrors()).toEqual({
      "contacts.email": [DEFAULT_REQUIRED_MESSAGE],
    })
  })

  it("checks rules on non-empty values", async () => {
    const { form } = createForm()
    form.contacts.email = "not-an-email"
    form.contacts.phone = "123"

    expect(await form.validate()).toBe(false)
    expect(form.getValidationErrors()).toEqual({
      "contacts.email": ["Invalid email"],
      "contacts.phone": ["Invalid phone"],
    })

    form.contacts.email = "ada@example.com"
    form.contacts.phone = "+123"
    expect(await form.validate()).toBe(true)
    expect(form.getValidationErrors()).toEqual({})
  })

  it("validates the value schema for cross-field rules", async () => {
    const { form } = createForm()
    form.setValueSchema(passwordsMatch)
    form.contacts.email = "ada@example.com"
    form.account.password = "secret"
    form.account.confirm = "other"

    expect(await form.validate()).toBe(false)
    expect(form.getValidationError("account.confirm")).toBe("Passwords do not match")
  })

  it("replaces only errors in scope when validating a subset of nodes", async () => {
    const { form, nodes } = createForm()
    form.setValueSchema(passwordsMatch)
    form.account.password = "secret"
    form.setValidationErrors({ "contacts.email": ["Taken (from server)"] })

    const accountNodes = (nodes[1] as LayoutNode).children
    expect(await form.validate(accountNodes)).toBe(false)

    expect(form.getValidationErrors()).toEqual({
      "contacts.email": ["Taken (from server)"],
      "account.confirm": ["Passwords do not match"],
    })
  })
})
