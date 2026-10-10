import { FormBase } from "./form"

export abstract class FormSwitch extends FormBase {
  protected cases!: FormCase[]
  protected activeCaseIndex = 0
  protected maxReachedCaseIndex = 0

  toggleActiveCase(val: string) {
    let nextIndex = this.activeCaseIndex
    for (const [index, item] of (this.cases ?? []).entries()) {
      const isActive = item.is(val)
      item.setActive(isActive)
      if (isActive) {
        nextIndex = index
      }
    }

    this.activeCaseIndex = nextIndex
  }

  getActiveCase() {
    return this.cases.find((item) => item.isActive())
  }

  getActiveCaseIndex() {
    const activeIndex = this.cases.findIndex((item) => item.isActive())
    if (activeIndex > -1) {
      this.activeCaseIndex = activeIndex
    }

    return activeIndex
  }

  getSelectedCaseIndex() {
    return this.activeCaseIndex
  }

  setActiveCaseIndex(index: number) {
    if (!Number.isInteger(index) || index < 0) {
      return
    }

    this.activeCaseIndex = index

    for (const [caseIndex, item] of (this.cases ?? []).entries()) {
      item.setActive(caseIndex === index)
    }
  }

  getMaxReachedCaseIndex() {
    return this.maxReachedCaseIndex
  }

  unlockCaseIndex(index: number) {
    if (!Number.isInteger(index) || index < 0) {
      return
    }

    this.maxReachedCaseIndex = Math.max(this.maxReachedCaseIndex, index)
  }

  resetCaseProgress() {
    this.maxReachedCaseIndex = 0
  }
}

export abstract class FormCase extends FormBase {
  protected _active: boolean = false
  protected _case: string | null = null

  is(val: string): boolean {
    return this._case === val
  }

  setActive(active: boolean) {
    this.active = active
  }

  isActive() {
    return this.active
  }

  includedIntoValue() {
    return this.options.keepInValue || this.active
  }
}
