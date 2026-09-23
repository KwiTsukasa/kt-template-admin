import { ref } from 'vue';

/**
 * 为单个弹窗实例保存当前可见会话、确认占用和表单初始化顺序。
 * @returns 显式开启/失效会话、确认互斥及串行初始化的本地操作。
 */
export function useModalSessionIntent() {
  let revision = 0;
  let open = false;
  let disposed = false;
  const ready = ref(false);
  let readyRevision: number | undefined;
  let pendingConfirm: number | undefined;
  let initializationTail: Promise<void> = Promise.resolve();

  /**
   * 在用户显式打开新建或编辑时换发令牌，使前一会话的异步完成失效。
   * @returns 新会话的递增身份。
   */
  function begin() {
    revision += 1;
    open = true;
    ready.value = false;
    readyRevision = undefined;
    return revision;
  }

  /**
   * 返回当前弹窗会话身份，供已挂载表单的打开回调固定初始化目标。
   * @returns 当前会话的递增身份。
   */
  function current() {
    return revision;
  }

  /**
   * 关闭或卸载时废弃旧会话，迟到校验与完成不得写入下一次打开。
   */
  function invalidate() {
    revision += 1;
    open = false;
    ready.value = false;
    readyRevision = undefined;
  }

  /**
   * 禁止组件销毁后的新提交，并使所有在途令牌失去写入资格。
   */
  function dispose() {
    disposed = true;
    invalidate();
  }

  /**
   * 只有仍可见、未销毁且令牌匹配的会话可以继续异步表单阶段。
   * @param token - 发起操作时取得的会话身份。
   * @returns 该异步操作仍归属当前可见会话时为 true。
   */
  function isCurrent(token: number) {
    return !disposed && open && token === revision;
  }

  /**
   * 区分会话已打开与表单初始化已完成，避免新会话确认读取旧字段。
   * @param token - 发起确认或预览时固定的会话身份。
   * @returns 本会话仍可见且已完成自己的表单初始化时为 true。
   */
  function isReady(token: number) {
    return isCurrent(token) && ready.value && readyRevision === token;
  }

  /**
   * 从确认点击起阻止同一会话重复校验或写入，同时允许新会话独立确认。
   * @param token - 点击确认时固定的会话身份。
   * @returns 当前会话尚无确认在途且本次成功占用时为 true。
   */
  function claimConfirm(token: number) {
    if (!isReady(token) || pendingConfirm === token) return false;
    pendingConfirm = token;
    return true;
  }

  /**
   * 仅释放原会话自己的确认占用，旧完成不能解开新会话的确认。
   * @param token - 当初取得确认占用的会话身份。
   */
  function releaseConfirm(token: number) {
    if (pendingConfirm === token) pendingConfirm = undefined;
  }

  /**
   * 串行同一表单的重置任务，旧重置结束后由调用方逐阶段检查令牌再写新值。
   * @param token - 本次初始化绑定的会话身份。
   * @param task - 表单拥有者的初始化步骤；收到当前令牌检查函数。
   * @returns 当前任务自己的完成结果；错误仍向调用者传播。
   */
  function initialize(
    token: number,
    task: (stillCurrent: () => boolean) => Promise<void>,
  ) {
    const result = initializationTail.then(async () => {
      if (!isCurrent(token)) return;
      await task(() => isCurrent(token));
      if (isCurrent(token)) {
        readyRevision = token;
        ready.value = true;
      }
    });
    initializationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return {
    begin,
    claimConfirm,
    current,
    dispose,
    initialize,
    invalidate,
    isCurrent,
    isReady,
    ready,
    releaseConfirm,
  };
}
