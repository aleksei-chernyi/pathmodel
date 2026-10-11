import "reflect-metadata"
import { describe, it, expect } from "vitest"
import type { FieldNode, LayoutComponent, FieldComponent, LayoutNode } from "../src"
import {
  FormBase,
  Schema,
  Nested,
  NestedArray,
  FormOptions,
  getFormOptions,
  isFieldComponent,
  COMPONENT_KIND,
} from "../src"
import Col from "../src/layout/Col.vue"
import Row from "../src/layout/Row.vue"

// Helper to set design:type metadata that decorators rely upon
function setDesignType(target: any, propertyKey: string, type: any) {
  Reflect.defineMetadata("design:type", type, target, propertyKey)
}

class Child extends FormBase {
  name!: string
  getOptions() {
    return (this as any).options
  }
}
// Apply class and property decorators manually
FormOptions({ title: "Child" })(Child)
Schema({ component: {} as any, dotPath: "child.name.dot.path" })(Child.prototype, "name")

class Other extends FormBase {
  age!: number
  getOptions() {
    return (this as any).options
  }
}
FormOptions({ title: "Other" })(Other)
Schema({ component: {} as any, dotPath: "other.age.dot.path" })(Other.prototype, "age")

class Parent extends FormBase {
  child!: Child
  items!: (Child | Other)[]
}
// Apply decorators and metadata for Parent properties
setDesignType(Parent.prototype, "child", Child)
Nested({ type: Child })(Parent.prototype, "child")
Schema({ component: Col })(Parent.prototype, "child")

setDesignType(Parent.prototype, "items", Array)
NestedArray({ items: [Child, Other] })(Parent.prototype, "items")
Schema({ component: Row })(Parent.prototype, "items")

describe("Form decorators and FormBase behavior", () => {
  it("FormOptions is stored on class", () => {
    expect(getFormOptions(Child)).toEqual({ title: "Child" })
    expect(getFormOptions(Other)).toEqual({ title: "Other" })
  })

  it("Nested initializes child instances with FormOptions", () => {
    const p = new Parent({ title: "Parent" })
    expect(p.child).toBeInstanceOf(Child)
    expect(p.child.getOptions()).toEqual({ title: "Child", keepInValue: true })
  })

  it("NestedArray initializes array and reuses existing nested instance when possible", () => {
    const p = new Parent({ title: "parent" })
    expect(Array.isArray(p.items)).toBe(true)
    expect(p.items.length).toBe(2)

    // First item is Child, reused instance from nested property
    expect(p.items[0]).toBe(p.child)
    expect(p.items[0]).toBeInstanceOf(Child)

    // Second item is Other, new instance with its form options
    expect(p.items[1]).toBeInstanceOf(Other)
    expect((p.items[1] as Other).getOptions()).toEqual({ title: "Other", keepInValue: true })
  })

  it("buildSchema produces correct nodes including nested child and array items", () => {
    const p = new Parent({ title: "parent" })
    const nodes = p.buildSchema()

    // There should be two container nodes: one for child (col) and one for items (row)
    const childContainer = nodes.find((n) => n.component === Col) as any
    const itemsContainer = nodes.find((n) => n.component === Row) as any
    expect(childContainer).toBeTruthy()
    expect(itemsContainer).toBeTruthy()

    // Child container should include field for Child.name with nodePath 'child.name'
    const childField = (childContainer.children || []).find(
      (n: FieldNode) => isFieldComponent(n.component) && n.name === "name"
    )
    expect(childField).toBeTruthy()
    expect(childField.nodePath).toBe("child.name")

    // Items container should include fields from each array item with indexed nodePaths
    const itemFields = (itemsContainer.children || []).filter((n: FieldNode) =>
      isFieldComponent(n.component)
    )
    // Expect two fields: one from Child (name) and one from Other (age)
    expect(itemFields.length).toBe(2)
    const nameField = itemFields.find((n: FieldNode) => n.name === "name")
    const ageField = itemFields.find((n: FieldNode) => n.name === "age")
    expect(nameField).toBeTruthy()
    expect(ageField).toBeTruthy()
    expect(nameField.nodePath).toBe("items.0.name")
    expect(ageField.nodePath).toBe("items.1.age")
  })
})

// Separate targeted test for array nodePath
class ArrayChild extends FormBase {
  title!: string
}
Schema({ component: {} as any, dotPath: "some.dot.path" })(ArrayChild.prototype, "title")

class ArrayHolder extends FormBase {
  arr!: ArrayChild[]
}
setDesignType(ArrayHolder.prototype, "arr", Array)
NestedArray({ items: [ArrayChild, ArrayChild] })(ArrayHolder.prototype, "arr")
Schema({ component: Row })(ArrayHolder.prototype, "arr")

describe("buildSchema array nodePath", () => {
  it("uses index in nodePath for array items", () => {
    const h = new ArrayHolder({ title: "ArrayHolder" })
    const nodes = h.buildSchema()
    const arrContainer = nodes.find((n) => n.component === Row) as any
    expect(arrContainer).toBeTruthy()
    const fields = (arrContainer.children || []).filter((n: FieldNode) =>
      isFieldComponent(n.component)
    )
    expect(fields.map((f: any) => f.nodePath)).toEqual(["arr.0.title", "arr.1.title"])
  })
})

describe("getFormValue", () => {
  class ValueTest extends FormBase {
    name!: string
    // nested!: ValueTest // Removed recursive nesting to avoid stack overflow
  }
  // Setup metadata
  Schema({ component: {} as any, dotPath: "result.name" })(ValueTest.prototype, "name")

  it("constructs object based on GLOBAL_DOT_PATHS_MAP", () => {
    const form = new ValueTest({ title: "ValueTest" })
    form.name = "Root Name"

    // IMPORTANT: must call buildSchema to populate GLOBAL_DOT_PATHS_MAP
    form.buildSchema()

    const result = form.getFormValue()

    expect(result).toEqual({
      result: {
        name: "Root Name",
      },
    })
  })

  // Better test with unique paths if possible (e.g. dynamic schemas or specific classes)
  class UniqueA extends FormBase {
    val!: string
  }
  Schema({ component: {} as any, dotPath: "unique.a" })(UniqueA.prototype, "val")

  class UniqueB extends FormBase {
    val!: string
  }
  Schema({ component: {} as any, dotPath: "unique.b" })(UniqueB.prototype, "val")

  class UniqueRoot extends FormBase {
    a!: UniqueA
    b!: UniqueB
  }

  // Mock layout component to ensure buildSchema treats these as nested containers, not fields
  const MockLayout = { __kind: "layout" } as any

  Nested({ type: UniqueA })(UniqueRoot.prototype, "a")
  Nested({ type: UniqueB })(UniqueRoot.prototype, "b")
  Schema({ component: MockLayout })(UniqueRoot.prototype, "a")
  Schema({ component: MockLayout })(UniqueRoot.prototype, "b")

  it("merges values from different paths", () => {
    const form = new UniqueRoot({ title: "UniqueRoot" })
    // Initialize properties (FormBase logic usually does this if options passed, but we do manual for test speed)
    form.a = new UniqueA({ title: "UniqueA" })
    form.b = new UniqueB({ title: "UniqueB" })

    form.a.val = "Value A"
    form.b.val = "Value B"

    form.buildSchema()
    const result = form.getFormValue()

    expect(result).toEqual({
      unique: {
        a: "Value A",
        b: "Value B",
      },
    })
  })
})

describe("setFormValue", () => {
  class ChildSetTest extends FormBase {
    name!: string
  }

  class ParentSetTest extends FormBase {
    name!: string
    nested!: ChildSetTest
  }
  const MockLayoutComponent: LayoutComponent = { __kind: COMPONENT_KIND.LAYOUT }
  const MockFieldComponent: FieldComponent = { __kind: COMPONENT_KIND.FIELD }

  // ParentSetTest.name
  Schema({ component: MockFieldComponent, dotPath: "test.name", props: {} })(
    ParentSetTest.prototype,
    "name"
  )

  // ParentSetTest.nested
  Nested({ type: ChildSetTest })(ParentSetTest.prototype, "nested")
  Schema({ component: MockLayoutComponent })(ParentSetTest.prototype, "nested")

  // ChildSetTest.name
  Schema({ component: MockFieldComponent, dotPath: "test.name", props: {} })(
    ChildSetTest.prototype,
    "name"
  )

  it("populates values based on dotPathMap", async () => {
    const form = new ParentSetTest({ title: "ParentSetTest" })

    // Build schema to register dot paths
    // "test.name" -> [form.name, form.nested.name]
    const schema = form.buildSchema()

    const data = {
      test: {
        name: "Updated Name",
      },
    }

    form.setFormValue(data)

    const parentNameNode = schema[0] as FieldNode<any, ParentSetTest>
    expect(parentNameNode.name).toBe("name")
    expect(parentNameNode.dotPath).toBe("test.name")
    expect(parentNameNode.nodePath).toBe("name")
    expect(parentNameNode.form).toBe(form)
    expect(parentNameNode.form.root).toBe(form)

    const parentNestedNode = schema[1] as LayoutNode<ParentSetTest>
    expect(parentNestedNode.children.length).toEqual(1)
    expect(parentNestedNode.form).toBe(form)
    expect(parentNestedNode.form.root).toBe(form)

    const childNode = parentNestedNode.children[0] as FieldNode<any, ChildSetTest>
    expect(childNode.name).toEqual("name")
    expect(childNode.dotPath).toEqual("test.name")
    expect(childNode.nodePath).toEqual("nested.name")
    expect(childNode.form).toEqual(form.nested)
    expect(childNode.form.root).toEqual(form)

    expect(form.name).toBe("Updated Name")
    expect(form.nested.name).toBe("Updated Name")
  })
})
