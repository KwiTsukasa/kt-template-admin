import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('lLM selected design source contract', () => {
  it('uses one permanent source-aligned card board with icon-only actions', () => {
    const source = readFileSync(
      resolve('apps/web-antdv-next/src/views/llm/config/index.tsx'),
      'utf8',
    );
    const style = readFileSync(
      resolve('apps/web-antdv-next/src/views/llm/config/index.scss'),
      'utf8',
    );
    const cardListStyle = readFileSync(
      resolve('apps/web-antdv-next/src/components/kt-card-list/style.scss'),
      'utf8',
    );
    expect(source).not.toContain('viewMode');
    expect(source).not.toContain('TableOutlined');
    expect(source).not.toContain('AppstoreOutlined');
    expect(source).toContain('<AKtCardListCard');
    expect(source).not.toContain('class="llm-config-card-actions"');
    expect(source).toContain('<MessageOutlined />');
    expect(source).toContain('<EyeOutlined />');
    expect(source).toContain('moreTrigger="hover"');
    expect(source).toContain(
      'query: { pageKey: `llm-chat-' + '$' + '{config.id}` }',
    );
    expect(source).not.toContain('流式健康');
    expect(source).not.toContain('Progress');
    expect(source).toContain('<AKtCardList');
    expect(source).toContain('itemCount={items.value.length}');
    expect(source).toContain('loading={loading.value}');
    expect(style).not.toContain('auto-fill');
    expect(cardListStyle).toContain('auto-fill');
    expect(cardListStyle).not.toContain('--kt-card-list-item-max-width');
    expect(cardListStyle).toContain('min-height: 44px');
    expect(cardListStyle).toContain('border-top: 1px solid hsl(var(--border))');
  });

  it('keeps model switching and actual assistant model attribution in chat', () => {
    const apiSource = readFileSync(
      resolve('apps/web-antdv-next/src/api/llm/index.ts'),
      'utf8',
    );
    const drawerSource = readFileSync(
      resolve(
        'apps/web-antdv-next/src/views/llm/config/components/LlmConfigDrawer.tsx',
      ),
      'utf8',
    );
    const pageSource = readFileSync(
      resolve('apps/web-antdv-next/src/views/llm/chat/index.tsx'),
      'utf8',
    );
    const routeSource = readFileSync(
      resolve('apps/web-antdv-next/src/router/routes/modules/llm.ts'),
      'utf8',
    );
    const chatStyle = readFileSync(
      resolve('apps/web-antdv-next/src/views/llm/chat/index.scss'),
      'utf8',
    );
    const nginxSource = readFileSync(
      resolve('deploy/nginx-admin.conf'),
      'utf8',
    );
    const workspaceSource = readFileSync(
      resolve(
        'apps/web-antdv-next/src/views/llm/chat/components/LlmChatWorkspace.tsx',
      ),
      'utf8',
    );
    expect(pageSource).toContain('selectedModel');
    expect(pageSource).toContain('getLlmConfigModels(configId)');
    expect(pageSource).toContain('label: model.label');
    expect(pageSource).toContain('value: model.id');
    expect(pageSource).toContain('modelOptions={modelOptions.value}');
    expect(pageSource).toContain(
      'reasoningEffortOptions={reasoningEffortOptions.value}',
    );
    expect(pageSource).toContain(
      'serviceTierOptions={serviceTierOptions.value}',
    );
    expect(pageSource).toContain(
      'streamInput.reasoningEffort = selectedReasoningEffort.value',
    );
    expect(pageSource).toContain(
      'streamInput.serviceTier = selectedServiceTier.value',
    );
    expect(pageSource).toContain('readonlyNotice={modelDiscoveryError.value}');
    expect(pageSource).toContain('assistantMessage.model = event.model');
    expect(pageSource).toContain('streamController?.abort()');
    expect(pageSource).toContain('reactive(');
    expect(pageSource).toContain('createTextTypewriter');
    expect(pageSource).toContain('await typewriter.drain()');
    expect(pageSource).toContain('const { setTabTitle } = useTabs()');
    expect(pageSource).toContain('pageKey: `llm-chat-' + '$' + '{configId}`');
    expect(pageSource).toContain(
      'watch(tabTitle, (title) => void setTabTitle(title), { immediate: true })',
    );
    expect(pageSource).not.toContain('llm-chat-title-row');
    expect(pageSource).not.toContain('>流式对话</h1>');
    expect(pageSource).not.toContain("scene === 'media-governance'");
    expect(workspaceSource).toContain('onPressEnter={(event: KeyboardEvent)');
    expect(workspaceSource).toContain('event.isComposing');
    expect(workspaceSource).toContain('maxRows: 6, minRows: 1');
    expect(pageSource).toContain('routeConversationId');
    expect(pageSource).toContain('reconcileRouteConversation');
    expect(pageSource).toContain('conversationLoadRevision');
    expect(pageSource).toContain('showConversationRail');
    expect(workspaceSource).toContain('llm-chat-transcript');
    expect(workspaceSource).toContain('llm-chat-jump-latest');
    expect(workspaceSource).toContain('llm-chat-composer-toolbar');
    expect(workspaceSource).toContain('llm-chat-composer-count');
    expect(workspaceSource).toContain('<SendOutlined />');
    expect(workspaceSource).toContain('<StopOutlined />');
    expect(workspaceSource).not.toContain('showCount');
    expect(workspaceSource).toContain('思考过程');
    expect(workspaceSource).toContain('KtMilkdownEditor');
    expect(workspaceSource).toContain('推理强度');
    expect(workspaceSource).toContain('速度');
    expect(workspaceSource).toContain(
      'if (props.reasoningEffortOptions.length > 0)',
    );
    expect(workspaceSource).toContain(
      'if (props.serviceTierOptions.length > 0)',
    );
    expect(apiSource).toContain('`/llm/configs/' + '$' + '{id}/models`');
    expect(apiSource).not.toContain('modelIds');
    expect(drawerSource).not.toContain("fieldName: 'modelIds'");
    expect(drawerSource).not.toContain('可用模型');
    expect(drawerSource).toContain('模型将在进入对话页时按供应商协议实时获取');
    expect(routeSource).toContain('fullPathKey: false');
    expect(routeSource).toContain('keepAlive: true');
    expect(workspaceSource).toContain('llm-chat-message--assistant');
    expect(chatStyle).toContain('--llm-chat-message-background');
    expect(chatStyle).toContain(
      'background: var(--llm-chat-message-background) !important',
    );
    const llmProxy = nginxSource.slice(
      nginxSource.indexOf('location ^~ /api/llm/'),
      nginxSource.indexOf(
        'location ^~ /api/',
        nginxSource.indexOf('location ^~ /api/llm/') + 1,
      ),
    );
    expect(llmProxy).toContain('proxy_buffering off');
    expect(llmProxy).toContain('proxy_cache off');
    expect(llmProxy).toContain('proxy_read_timeout 1h');
  });
});
