<template>
  <SchemaNodeRenderer v-for="(node, i) in nodes" :key="i" :node="node" :root="root" />
</template>

<script setup lang="ts">
import SchemaNodeRenderer from "./SchemaNodeRenderer.vue"
import { SomeNode } from "../schema"
import { FormBase } from "../form"

const { root, nodes } = defineProps<{
  nodes: SomeNode[]
  root: FormBase
}>()
</script>
