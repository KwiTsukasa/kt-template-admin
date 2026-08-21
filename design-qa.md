# LLM 配置与流式对话设计 QA

- source visual truth path: `/home/yemu2/KT/.kt-workspace/test-artifacts/product-design/llm-multi-provider-20260820/design-final-card-only.png`
- implementation evidence root: `/home/yemu2/KT/.kt-workspace/test-artifacts/product-design/llm-model-discovery-20260821`
- browser: Microsoft Edge 浏览器插件控制链路
- implementation viewport: 约 2317 × 1500 px
- theme: 深色主题
- final cold-start chat screenshot SHA-256: `4ceb036a220a724bd9126e0b7b14cda97ff12880d8eec9bb4cdf8ebf7af4871f`
- interrupted-stream screenshot SHA-256: `da05b070416769bcd94d412aad4fdfe0e84d581c05d841cc6baa24c6f7f4a1c3`
- stable single-chat-tag screenshot SHA-256: `00c057f40ed5506ee7f8ad82aad1639dcfe32fbf6060c2ca9851fe248a6b51be`

## Full-view comparison evidence

- `config-card-board.jpg`：配置页保持单一卡片看板，卡片底部使用纯语义图标操作栏。
- `config-create-without-models.jpg`：新增抽屉不显示或提交静态“可用模型”字段。
- `chat-no-speed-capability.jpg`：切换到未声明速度档位的模型后，速度控件隐藏而推理强度保留。
- `chat-composer-dynamic-model-tag.jpg`：路由 Tag 显示 `GPT-5.6-Sol`，内容区固定标题已移除，模型、推理强度、Fast 档位及优化后的 Composer 同屏可见。
- `chat-stream-stopped.jpg`：真实 POST SSE 发送后出现停止按钮，点击中断后消息显示“已停止”，操作位恢复为发送。
- `chat-single-model-tag-stable.jpg`：配置卡重复进入、切换 conversation 并冷刷新后，标签栏只保留一个且正确激活 `GPT-5.6-Sol` 对话 Tag。

## Focused interaction evidence

- Edge DOM 断言：`main h1=0`、内容区精确“流式对话”文本为 0、兜底 Tag“大模型对话”为 0、`GPT-5.6-Sol` 精确文本为 2（Tag 与模型选择器）。
- Edge 冷启动控制台断言：重载后 3.5 秒内 warning/error 为 0；热更新前遗留的只读计算标题告警没有在冷启动复现。
- Composer DOM 断言：输入框 1 个，空闲态“发送”按钮 1 个、“停止生成”按钮 0 个；组件测试另覆盖流式态原位替换为停止按钮。
- Edge 流式中断断言：发送后 `停止生成=1`；点击后 `已停止=1`、`发送=1`、`停止生成=0`，且该轮控制台 warning/error 为 0。
- Edge 页签身份断言：重复从配置卡进入和左栏切换 conversation 后，模型 Tag 数均为 1；URL 的 `conversationId` 更新而 `pageKey=llm-chat-<configId>` 保持不变，冷刷新仍停留在同一对话且活动 Tag 正确。应用自身 localhost warning/error 为 0；一次无 URL 的 `reportAllChanges/startTime` 浏览器度量脚本异常不来自项目源码。
- 组件行为测试：普通 Enter 发送；Shift+Enter 与 `isComposing=true` 不发送；TextArea 使用 2–8 行自动增长；自定义弱计数替代内建 `showCount`。
- 模型能力：`GPT-5.6-Sol` 同时显示推理强度与 Fast，未声明速度能力的模型隐藏速度控件。

## Findings

- P0/P1/P2 未发现未关闭项。
- Breadcrumb 继续使用路由元信息“流式对话”，用于页面层级导航；用户指定的内容标题行已移除，路由 Tag 独立跟随当前模型。

## Comparison history

- Round 1：实现卡片看板、图标操作栏与共享流式对话页。
- Round 2：移除新增表单静态模型项，改为供应商协议实时发现。
- Round 3：接入模型级推理强度与速度能力，支持项显示、不支持项隐藏。
- Round 4：优化 Composer，移除重复标题，并修复异步模型加载后路由 Tag 停留在兜底文案的问题。
- Round 5：统一配置卡、媒体治理与会话切换的 `llm-chat-<configId>` 稳定 `pageKey`，并由 Tab Store 无导航地清理旧 fullPath 重复页签。

final result: passed
