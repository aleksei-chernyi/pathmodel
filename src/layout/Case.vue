<template>
  <slot></slot>
</template>

<script setup lang="ts">
import { COMPONENT_KIND } from "@aleksei-chernyi/pathmodel"
import type { FormBase } from "@aleksei-chernyi/pathmodel"

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
