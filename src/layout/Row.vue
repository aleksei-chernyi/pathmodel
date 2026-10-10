<template>
  <div class="form__row">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { COMPONENT_KIND } from "../component-kind"
import { FormBase } from "../form"
import { LayoutNode } from "../schema"

defineProps<{
  node?: LayoutNode
  root?: FormBase
}>()

defineOptions({
  __kind: COMPONENT_KIND.LAYOUT,
})
</script>
