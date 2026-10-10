import "reflect-metadata"
import { describe, it, expect } from "vitest"
import { Schema, getSchema, LayoutComponent, COMPONENT_KIND, FieldComponent } from "../src"

class SimpleModel {
  firstName!: string
  row!: any
}

const MockLayoutComponent: LayoutComponent = { __kind: COMPONENT_KIND.LAYOUT }
const MockFieldComponent: FieldComponent = { __kind: COMPONENT_KIND.FIELD }

Schema({
  component: MockFieldComponent,
  label: "First Name",
  dotPath: "first_name",
  props: {},
})(SimpleModel.prototype, "firstName")
Schema({ component: MockLayoutComponent, label: "Row Container" })(SimpleModel.prototype, "row")

describe("Schema decorator", () => {
  it("stores and retrieves schema metadata", () => {
    const schema = getSchema(SimpleModel)
    expect(schema).toBeTruthy()
    expect(schema && schema.firstName).toEqual({
      component: MockFieldComponent,
      label: "First Name",
      dotPath: "first_name",
      props: {},
    })
    expect(schema && schema.row).toEqual({
      component: MockLayoutComponent,
      label: "Row Container",
    })
  })
})
