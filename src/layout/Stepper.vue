<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue"
import { COMPONENT_KIND, FieldNode, LayoutNode } from "@aleksei-chernyi/pathmodel"
import type { FormBase, FormSwitch, SomeNode } from "@aleksei-chernyi/pathmodel"
import Case from "./Case.vue"

interface props {
  node: LayoutNode<FormSwitch>
  root: FormBase
}

defineOptions({
  __kind: COMPONENT_KIND.LAYOUT,
  getChildComponent: () => Case,
})

const { node, root } = defineProps<props>()

const cases = node.children as LayoutNode[]
const options = node.options

const activeCaseIndex = computed(() => node.form.getActiveCaseIndex())

const shouldRenderCase = computed(() => {
  if (!options?.hideWhenNoActive) {
    return true
  }

  return activeCaseIndex.value > -1
})

const activeCase = computed(() => {
  const index = activeCaseIndex.value
  if (index > -1) {
    return index
  }

  return node.form.getSelectedCaseIndex()
})

const maxReachedCaseIndex = computed(() => node.form.getMaxReachedCaseIndex())

const isCaseLocked = (index: number) => index > maxReachedCaseIndex.value
const isCaseCompleted = (index: number) => index < maxReachedCaseIndex.value

const collectStepValidationPaths = (nodes: SomeNode[]): string[] => {
  const result = new Set<string>()

  const walk = (currentNodes: SomeNode[]) => {
    for (const child of currentNodes) {
      if (child instanceof FieldNode) {
        result.add(child.dotPath)

        const nodeProps = (child.getProps?.() ?? {}) as Record<string, unknown>
        const nestedPaths = Array.isArray(nodeProps.validationErrorPaths)
          ? nodeProps.validationErrorPaths.filter(
              (path): path is string => typeof path === "string" && path.length > 0
            )
          : []

        for (const nestedPath of nestedPaths) {
          result.add(`${child.dotPath}.${nestedPath}`)
        }

        continue
      }

      if (child instanceof LayoutNode) {
        walk(child.children || [])
      }
    }
  }

  walk(nodes)

  return Array.from(result)
}

const stepErrorCounts = computed(() => {
  return cases.map((step) => {
    const paths = collectStepValidationPaths(step.children || [])
    const pathsCount = root.getValidationErrorsCountByPaths(paths)
    const namespaceCount = root.getValidationErrorsCount(step.options?.namespace)

    return Math.max(pathsCount, namespaceCount)
  })
})

const isValidating = ref(false)

const onCaseClick = async (index: number) => {
  if (isCaseLocked(index) || isValidating.value) {
    return
  }

  const currentIndex = activeCase.value
  if (index === currentIndex) {
    return
  }

  if (index > currentIndex) {
    const currentCase = cases[currentIndex]
    if (currentCase) {
      isValidating.value = true
      try {
        if (!(await node.form.validate(currentCase.children))) {
          return
        }
      } finally {
        isValidating.value = false
      }
    }
  }

  node.form.setActiveCaseIndex(index)
}

const stepsContainerRef = ref<HTMLElement | null>(null)

watch(
  activeCase,
  async (index) => {
    await nextTick()
    const container = stepsContainerRef.value
    if (!container) return
    const item = container.children[index] as HTMLElement | undefined
    if (!item) return
    const containerLeft = container.scrollLeft
    const containerRight = containerLeft + container.clientWidth
    const itemLeft = item.offsetLeft
    const itemRight = itemLeft + item.offsetWidth
    if (itemLeft < containerLeft) {
      container.scrollTo({ left: itemLeft, behavior: "smooth" })
    } else if (itemRight > containerRight) {
      container.scrollTo({ left: itemRight - container.clientWidth, behavior: "smooth" })
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="cases">
    <div
      v-if="options.showHeader === undefined || options.showHeader"
      ref="stepsContainerRef"
      class="cases-steps"
    >
      <div
        v-for="(step, i) in cases"
        :key="i"
        class="cases-steps__item"
        :class="{
          active: i === activeCase,
          disabled: isCaseLocked(i),
          completed: isCaseCompleted(i),
        }"
      >
        <div class="cases-steps__button" @click="onCaseClick(i)">
          <div class="cases-steps__title">
            {{ step.label || `Case ${i + 1}` }}
          </div>
          <div class="cases-steps__shapes">
            <div class="cases-steps__circle">
              {{ i + 1 }}
              <i v-if="stepErrorCounts[i] > 0" class="cases-steps__error">{{
                stepErrorCounts[i]
              }}</i>
            </div>
            <div class="cases-steps__line"></div>
          </div>
        </div>
      </div>
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
  margin-bottom: 30px;
  padding: 14px;
  background: var(--var-button-bg-400);
  border-radius: var(--var-border-radius-big);
  overflow: auto;
  &__title {
    margin: 0 10px;
  }
  &__item {
    display: flex;
    align-items: center;
    position: relative;
    flex: 1;
    justify-content: center;
    &.active {
      .cases-steps__line {
        &:after {
          width: 50%;
          transition-delay: 0.1s;
        }
      }
      .cases-steps__circle {
        background: var(--var-main-color);
      }
    }
    &.disabled {
      .cases-steps__circle {
        color: var(--var-text-color-disabled);
        background: var(--var-button-bg-100);
      }
    }
    &.completed {
      .cases-steps__line:after {
        width: 100%;
      }
    }
    &.active.completed {
      .cases-steps__line:after {
        width: 50%;
      }
    }
    &.active ~ &.completed {
      .cases-steps__line:after {
        width: 0;
      }
    }
    &:last-child {
      .cases-steps__line {
        right: 50%;
        left: auto;
      }
      &.active {
        .cases-steps__line:after {
          width: 100%;
        }
      }
    }
    &:first-child {
      .cases-steps__line {
        left: 50%;
      }
      &.active {
        .cases-steps__line:after {
          width: 0;
        }
      }
    }
  }
  &__line {
    position: absolute;
    height: 2px;
    background: var(--var-button-bg-100);
    width: 100%;
    z-index: 100;
    left: 0;
    margin-top: 1px;
    &::after {
      content: "";
      position: absolute;
      height: 2px;
      background: var(--var-button-active-bg);
      width: 0;
      left: 0;
      top: 0;
      transition: width 0.1s linear;
    }
  }
  &__button {
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
  }
  &__shapes {
    display: flex;
    align-items: center;
  }
  &__circle {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--var-button-active-bg);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 4px;
    z-index: 200;
    position: relative;
    line-height: 0;
  }
  &__error {
    position: absolute;
    top: -6px;
    right: -6px;
    background: var(--var-danger);
    color: #fff;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-style: normal;
  }
}
</style>
