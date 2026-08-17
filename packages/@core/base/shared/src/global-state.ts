interface ComponentsState {
  [key: string]: any;
}

interface MessageState {
  copyPreferencesSuccess?: (title: string, content?: string) => void;
}

export interface IGlobalSharedState {
  components: ComponentsState;
  message: MessageState;
}

class GlobalShareState {
  #components: ComponentsState = {};
  #message: MessageState = {};

  /**
   * 把框架各场景的提示函数注册到共享状态，供非组件代码统一调用。
   */
  public defineMessage({ copyPreferencesSuccess }: MessageState) {
    this.#message = {
      copyPreferencesSuccess,
    };
  }

  /**
   * 返回框架共享的动态组件注册表，尚未注册组件时该表为空。
   *
   * @returns 全局注册组件映射；尚未注册任何组件时为空对象。
   */
  public getComponents(): ComponentsState {
    return this.#components;
  }

  /**
   * 返回框架共享的消息处理器集合，尚未注册处理器时该集合为空。
   *
   * @returns 当前注册的全局消息处理器集合；尚未定义处理器时返回空对象。
   */
  public getMessage(): MessageState {
    return this.#message;
  }

  /**
   * 替换全局动态组件注册表，供渲染器按名称解析组件。
   *
   * @param value - 按组件名保存的全局组件注册表，后续读取会返回同一对象。
   */
  public setComponents(value: ComponentsState) {
    this.#components = value;
  }
}

export const globalShareState = new GlobalShareState();
