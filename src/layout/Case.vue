<template>
  <slot></slot>
</template>

<script setup lang="ts">
import { COMPONENT_KIND } from "../component-kind"
import { FormBase } from "../form"

defineProps<{
  node?: {
    options?: Record<string, unknown>
  }
  root?: FormBase
}>()

defineOptions({
  __kind: COMPONENT_KIND.LAYOUT,
})
</script>
