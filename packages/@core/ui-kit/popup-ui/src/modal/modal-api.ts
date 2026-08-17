import type { ModalApiOptions, ModalState } from './modal';

import { Store } from '@vben-core/shared/store';
import { bindMethods, isFunction } from '@vben-core/shared/utils';

export class ModalApi {
  // 共享数据
  public sharedData: Record<'payload', any> = {
    payload: {},
  };
  public store: Store<ModalState>;

  private api: Pick<
    ModalApiOptions,
    | 'onBeforeClose'
    | 'onCancel'
    | 'onClosed'
    | 'onConfirm'
    | 'onOpenChange'
    | 'onOpened'
  >;

  // private prevState!: ModalState;
  private state!: ModalState;

  constructor(options: ModalApiOptions = {}) {
    const {
      connectedComponent: _,
      onBeforeClose,
      onCancel,
      onClosed,
      onConfirm,
      onOpenChange,
      onOpened,
      ...storeState
    } = options;

    const defaultState: ModalState = {
      bordered: true,
      centered: false,
      class: '',
      closeOnClickModal: true,
      closeOnPressEscape: true,
      confirmDisabled: false,
      confirmLoading: false,
      contentClass: '',
      destroyOnClose: true,
      draggable: false,
      footer: true,
      footerClass: '',
      fullscreen: false,
      fullscreenButton: true,
      header: true,
      headerClass: '',
      isOpen: false,
      loading: false,
      modal: true,
      openAutoFocus: false,
      showCancelButton: true,
      showConfirmButton: true,
      title: '',
      animationType: 'slide',
    };

    this.store = new Store<ModalState>(
      {
        ...defaultState,
        ...storeState,
      },
      {
        onUpdate: () => {
          const state = this.store.state;

          // 每次更新状态时，都会调用 onOpenChange 回调函数
          if (state?.isOpen === this.state?.isOpen) {
            this.state = state;
          } else {
            this.state = state;
            this.api.onOpenChange?.(!!state?.isOpen);
          }
        },
      },
    );

    this.state = this.store.state;

    this.api = {
      onBeforeClose,
      onCancel,
      onClosed,
      onConfirm,
      onOpenChange,
      onOpened,
    };
    bindMethods(this);
  }

  /**
   * 将弹窗 open 状态设为 false，并在关闭前执行外部拦截器。
   */
  async close() {
    // 通过 onBeforeClose 钩子函数来判断是否允许关闭弹窗
    // 如果 onBeforeClose 返回 false，则不关闭弹窗
    const allowClose = (await this.api.onBeforeClose?.()) ?? true;
    if (allowClose) {
      this.store.setState((prev) => ({
        ...prev,
        isOpen: false,
      }));
    }
  }

  /**
   * 读取调用方写入弹窗共享状态的数据，尚未写入时以空对象代替。
   *
   * @returns 调用方写入的弹窗数据；尚未写入时返回空对象。
   */
  getData<T extends object = Record<string, any>>() {
    return (this.sharedData?.payload ?? {}) as T;
  }

  /**
   * 根据提交状态锁定或解锁弹窗交互。
   *
   * @param isLocked - 要写入抽屉或弹窗的锁定状态；锁定时阻止重复操作；未传入时使用 `true`。
   * @returns 写入 submitting 状态后的同一 ModalApi 实例，支持链式调用。
   */
  lock(isLocked = true) {
    return this.setState({ submitting: isLocked });
  }

  /**
   * 在取消弹窗时执行回调，并在未被阻止时关闭弹窗。
   */
  onCancel() {
    if (this.api.onCancel) {
      this.api.onCancel?.();
    } else {
      this.close();
    }
  }

  /**
   * 当弹窗关闭动画完成时执行已注册回调。
   */
  onClosed() {
    if (!this.state.isOpen) {
      this.api.onClosed?.();
    }
  }

  /**
   * 在确认弹窗时执行提交回调，并按结果维持锁定状态。
   */
  onConfirm() {
    this.api.onConfirm?.();
  }

  /**
   * 当弹窗打开动画完成时执行已注册回调。
   */
  onOpened() {
    if (this.state.isOpen) {
      this.api.onOpened?.();
    }
  }

  /**
   * 打开弹窗并清除上一轮提交中状态，使确认按钮可以接受新一轮操作。
   */
  open() {
    this.store.setState((prev) => ({
      ...prev,
      isOpen: true,
      submitting: false,
    }));
  }

  /**
   * 把调用方数据写入弹窗或抽屉共享状态，并返回 API 实例以支持链式调用。
   *
   * @param payload - 要保存到弹窗共享状态、供打开后的组件读取的数据。
   * @returns 当前弹窗或抽屉 API 实例，用于继续链式调用。
   */
  setData<T>(payload: T) {
    this.sharedData.payload = payload;
    return this;
  }

  /**
   * 用状态补丁或计算函数更新弹窗状态，并返回当前 API 以支持链式调用。
   *
   * @param stateOrFn - 弹窗状态补丁，或根据旧状态计算补丁的函数。
   * @returns 当前弹窗 API 实例，用于继续链式调用。
   */
  setState(
    stateOrFn:
      | ((prev: ModalState) => Partial<ModalState>)
      | Partial<ModalState>,
  ) {
    if (isFunction(stateOrFn)) {
      this.store.setState(stateOrFn);
    } else {
      this.store.setState((prev) => ({ ...prev, ...stateOrFn }));
    }
    return this;
  }

  /**
   * 将弹窗锁定状态恢复为 false，使交互重新可用。
   *
   * @returns 解除 submitting 状态后的同一 ModalApi 实例。
   */
  unlock() {
    return this.lock(false);
  }
}
