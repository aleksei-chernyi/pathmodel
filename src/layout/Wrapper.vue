<template>
  <div :class="wrapperClass">
    <div v-if="wrapperTitle" class="offer-form__section-title">{{ wrapperTitle }}</div>
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { COMPONENT_KIND } from "../component-kind"
import { FormBase } from "../form"

const props = defineProps<{
  node?: {
    options?: {
      className?: string
      title?: string
    }
  }
  root?: FormBase
}>()

const wrapperClass = computed(() => props.node?.options?.className || "form-wrapper")
const wrapperTitle = computed(() => props.node?.options?.title || "")

defineOptions({
  __kind: COMPONENT_KIND.LAYOUT,
})
</script>
