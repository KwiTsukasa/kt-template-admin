export class StateHandler {
  private condition: boolean = false;
  private rejectCondition: (() => void) | null = null;
  private resolveCondition: (() => void) | null = null;

  /**
   * 执行布尔值或条件函数，并把 Promise 与普通结果统一归一为布尔判定。
   *
   * @returns 布尔值或条件函数解析为真时返回 true；异步条件会等待其结果。
   */
  isConditionTrue(): boolean {
    return this.condition;
  }

  /**
   * 把条件状态重置为 false，并释放等待条件的 Promise 回调引用。
   */
  reset() {
    this.condition = false;
    this.clearPromises();
  }

  // 触发状态为 false 时，reject
  /**
   * 把等待条件设为 false；已有等待者时拒绝并清空对应 Promise 回调。
   */
  setConditionFalse() {
    this.condition = false;
    if (this.rejectCondition) {
      this.rejectCondition();
      this.clearPromises();
    }
  }

  // 触发状态为 true 时，resolve
  /**
   * 把等待条件设为 true；已有等待者时兑现并清空对应 Promise 回调。
   */
  setConditionTrue() {
    this.condition = true;
    if (this.resolveCondition) {
      this.resolveCondition();
      this.clearPromises();
    }
  }

  // 返回一个 Promise，等待 condition 变为 true
  /**
   * 通过复用同一个等待 Promise 等待状态条件满足或超时。
   *
   * @returns 条件满足时解析的 Promise；超过等待上限时按实现超时结束。
   */
  waitForCondition(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.condition) {
        resolve(); // 如果 condition 已经为 true，立即 resolve
      } else {
        this.resolveCondition = resolve;
        this.rejectCondition = reject;
      }
    });
  }

  // 清理 resolve/reject 函数
  /**
   * 清空条件等待器保存的 resolve 与 reject 回调，避免重复兑现。
   */
  private clearPromises() {
    this.resolveCondition = null;
    this.rejectCondition = null;
  }
}
