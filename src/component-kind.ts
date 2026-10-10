import type { Component as VueComponent } from "vue"

export type Component<T extends COMPONENT_KIND> = VueComponent & { __kind?: T }
export type LayoutComponent = Component<COMPONENT_KIND.LAYOUT> & {
  getChildComponent?: () => VueComponent
}
export type FieldComponent = VueComponent | Component<COMPONENT_KIND.FIELD>

export enum COMPONENT_KIND {
  FIELD = "field",
  LAYOUT = "layout",
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
