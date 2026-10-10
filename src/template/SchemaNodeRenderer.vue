<template>
  <div
    v-if="isFieldNode && !isEmptyFieldNode"
    class="form-component-wrapper"
    :class="{ 'has-error': hasNodeError }"
  >
    <component :is="node.component" v-bind="componentProps" />
    <div v-if="showDefaultFieldError" class="field-error">{{ fieldError }}</div>
  </div>

  <component
    :is="node.component"
    v-else-if="
      isLayoutComponent(node.component) && (node.component as LayoutComponent).getChildComponent?.()
    "
    v-bind="componentProps"
  >
    <template #default="{ nested }">
      <SchemaNodeRenderer
        v-for="(child, i) in nested?.children || []"
        :key="i"
        :node="child"
        :root="root"
      />
    </template>
  </component>

  <component :is="node.component" v-else v-bind="componentProps">
    <template v-if="hasChildren">
      <SchemaNodeRenderer
        v-for="(child, i) in (node as LayoutNode).children!"
        :key="i"
        :node="child"
        :root="root"
      />
    </template>
  </component>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { FieldNode, LayoutNode, SomeNode } from "../schema"
import { FormBase } from "../form"
import { isFieldComponent, isLayoutComponent, LayoutComponent } from "../component-kind"
import Empty from "../layout/Empty.vue"

const props = defineProps<{
  node: SomeNode
  root: FormBase
}>()

const hasChildren = computed(() => {
  const node = props.node as LayoutNode
  return Array.isArray(node.children) && node.children.length > 0
})

const isFieldNode = computed(() => isFieldComponent(props.node.component))
const isEmptyFieldNode = computed(() => isFieldNode.value && props.node.component === Empty)

const fieldError = computed(() => {
  if (!isFieldComponent(props.node.component)) {
    return null
  }

  const fieldNode = props.node as FieldNode
  const nodeProps = (fieldNode.getProps?.() ?? {}) as Record<string, unknown>
  const nestedPaths = Array.isArray(nodeProps.validationErrorPaths)
    ? nodeProps.validationErrorPaths.filter(
        (path): path is string => typeof path === "string" && path.length > 0
      )
    : []

  return props.root.getValidationErrorByPaths([
    fieldNode.dotPath,
    ...nestedPaths.map((suffix) => `${fieldNode.dotPath}.${suffix}`),
  ])
})

const hasNodeError = computed(() => {
  return isFieldNode.value && Boolean(fieldError.value)
})

const showDefaultFieldError = computed(() => {
  if (!fieldError.value || !isFieldComponent(props.node.component)) {
    return false
  }

  const fieldNode = props.node as FieldNode
  const nodeProps = (fieldNode.getProps?.() ?? {}) as Record<string, unknown>
  return !Boolean(nodeProps.inlineError)
})

const componentProps = computed(() => {
  const error = fieldError.value

  return {
    node: props.node,
    root: props.root,
    ...(isFieldComponent(props.node.component)
      ? {
          error,
          fieldError: error,
          hasError: Boolean(error),
        }
      : {}),
  }
})
</script>

<style scoped>
.field-error {
  color: #d44;
  font-size: 0.85rem;
  margin-top: 4px;
}
</style>
