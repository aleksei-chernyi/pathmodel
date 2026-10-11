<template>
  <div class="form__row">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { COMPONENT_KIND } from "@aleksei-chernyi/pathmodel"
import type { FormBase, LayoutNode } from "@aleksei-chernyi/pathmodel"

defineProps<{
  node?: LayoutNode
  root?: FormBase
}>()

defineOptions({
  __kind: COMPONENT_KIND.LAYOUT,
})
</script>
