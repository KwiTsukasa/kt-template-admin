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
   * 定义框架内部各个场景的消息提示
   */
  public defineMessage({ copyPreferencesSuccess }: MessageState) {
    this.#message = {
      copyPreferencesSuccess,
    };
  }

  public getComponents(): ComponentsState {
    return this.#components;
  }

  public getMessage(): MessageState {
    return this.#message;
  }

  public setComponents(value: ComponentsState) {
    this.#components = value;
  }
}

export const globalShareState = new GlobalShareState();
