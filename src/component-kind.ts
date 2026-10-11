import type { Component as VueComponent } from "vue"

export type Component<T extends COMPONENT_KIND> = VueComponent & { __kind?: T }
export type LayoutComponent = Component<COMPONENT_KIND.LAYOUT> & {
  getChildComponent?: () => VueComponent
}
export type FieldComponent = VueComponent | Component<COMPONENT_KIND.FIELD>

/** Marks a Vue component as a field or a layout: `defineOptions({ __kind: COMPONENT_KIND.LAYOUT })`. */
export const COMPONENT_KIND = {
  FIELD: "field",
  LAYOUT: "layout",
} as const

export type COMPONENT_KIND = (typeof COMPONENT_KIND)[keyof typeof COMPONENT_KIND]

// Keeps `COMPONENT_KIND.LAYOUT` usable as a type, as it was with the former enum.
export declare namespace COMPONENT_KIND {
  type FIELD = typeof COMPONENT_KIND.FIELD
  type LAYOUT = typeof COMPONENT_KIND.LAYOUT
}

export function isLayoutComponent(
  component: Component<COMPONENT_KIND>
): component is LayoutComponent {
  return component.__kind === COMPONENT_KIND.LAYOUT
}

export function isFieldComponent(
  component: Component<COMPONENT_KIND>
): component is FieldComponent {
  return component.__kind === COMPONENT_KIND.FIELD || !component.__kind
}
