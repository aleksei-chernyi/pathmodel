<script setup lang="ts">
import { computed, ref } from "vue"
import { FormBase } from "../form"
import { COMPONENT_KIND } from "../component-kind"
import Case from "./Case.vue"
import { LayoutNode } from "../schema"
import { FormSwitch } from "../form-switch"

interface props {
  node: LayoutNode<FormSwitch>
  root: FormBase
}

defineOptions({
  __kind: COMPONENT_KIND.LAYOUT,
  getChildComponent: () => Case,
})

const { node } = defineProps<props>()

const cases = node.children as LayoutNode[]
const options = node.options

const clickedTab = ref(0)

const activeCaseIndex = computed(() => node.form.getActiveCaseIndex())

const shouldRenderCase = computed(() => {
  if (!options?.hideWhenNoActive) {
    return true
  }

  return activeCaseIndex.value > -1
})

const activeCase = computed(() => {
  const index = activeCaseIndex.value
  return index > -1 ? index : clickedTab.value
})
</script>

<template>
  <div class="cases">
    <!-- header -->
    <div v-if="options.showHeader === undefined || options.showHeader" class="cases-header">
      <button
        v-for="(tab, i) in cases"
        :key="i"
        :class="['case-button', { active: i === activeCase }]"
        @click="node.form.setActiveCaseIndex(i)"
      >
        {{ (tab as any).label || `Case ${i + 1}` }}
      </button>
    </div>
    <div v-if="shouldRenderCase" class="cases-content">
      <slot :nested="cases[activeCase]"></slot>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.cases-header {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.case-button {
  padding: 6px 12px;
  border: 1px solid #ccc;
  background: #f6f6f6;
  cursor: pointer;
  border-radius: 4px;
  font-size: 14px;
}

.case-button.active {
  background: white;
  border-color: #888;
}
.cases-steps {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  &__item {
    display: flex;
    align-items: center;
    position: relative;
    flex: 1;
  }
  &__button {
    cursor: pointer;
  }
  &__circle {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #ccc;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 4px;
  }
}
</style>
