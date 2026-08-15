import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';

import { describe, expect, it } from 'vitest';

const jenkinsfile = readFileSync(resolve(cwd(), 'Jenkinsfile'), 'utf8');
const dollar = '$';

function gStringShellVariable(name: string): string {
  return `\\${dollar}{${name}}`;
}

function groovyVariable(name: string): string {
  return `${dollar}{${name}}`;
}

function extractBlockAfter(source: string, marker: string): string {
  const markerIndex = source.indexOf(marker);
  expect(markerIndex).toBeGreaterThanOrEqual(0);

  const openingBrace = source.indexOf('{', markerIndex + marker.length);
  expect(openingBrace).toBeGreaterThan(markerIndex);

  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(openingBrace + 1, index);
  }

  throw new Error(`Unclosed block after ${marker}`);
}

function extractStage(name: string): string {
  return extractBlockAfter(jenkinsfile, `stage('${name}')`);
}

describe('admin Jenkins release contract', () => {
  it('rejects stale publish parameters before dependency preparation', () => {
    const prepare = extractStage('Prepare');
    const contractIndex = prepare.indexOf('def releaseContract');
    const nodePreparationIndex = prepare.indexOf('node --version');

    expect(jenkinsfile).toContain(
      "string(name: 'EXPECTED_SOURCE_COMMIT', defaultValue: ''",
    );
    expect(prepare).toContain("'VITE_BASE': './'");
    expect(prepare).toContain("'VITE_GLOB_API_URL': '/api'");
    expect(prepare).toContain("'VITE_KT_BLOG_WEB_BASE_URL': '/blog/'");
    expect(prepare).toContain("'VITE_ROUTER_HISTORY': 'hash'");
    expect(prepare).toContain('params[parameterName] != expectedValue');
    expect(prepare).toMatch(
      /Release requires \$\{parameterName\}=\$\{expectedValue\}\./,
    );
    expect(contractIndex).toBeGreaterThanOrEqual(0);
    expect(nodePreparationIndex).toBeGreaterThan(contractIndex);
  });

  it('binds a main release to checkout HEAD and synchronized remote branches', () => {
    const prepare = extractStage('Prepare');
    const deployStatic = extractStage('Deploy Static');
    const deployNginx = extractStage('Deploy Nginx Config');

    expect(prepare).toContain("env.BRANCH_NAME == 'main'");
    expect(prepare).not.toContain(
      "env.IS_PUBLISH_BRANCH == 'true' &&\n            (params.DEPLOY_STATIC_FILES",
    );
    expect(prepare).toMatch(/expectedSourceCommit ==~ \/\[0-9a-f\]\{40\}\//);
    expect(prepare).toContain(
      'def expectedSourceCommit = params.EXPECTED_SOURCE_COMMIT',
    );
    expect(prepare).toContain(
      "sh(script: 'git rev-parse HEAD', returnStdout: true).trim()",
    );
    expect(prepare).toContain('if (checkedOutCommit != expectedSourceCommit)');
    expect(prepare).not.toContain("if (env.BRANCH_NAME == 'main')");
    expect(prepare).toContain(
      'git ls-remote --exit-code --heads origin refs/heads/main refs/heads/dev',
    );
    expect(prepare).toContain(
      "sshagent(credentials: ['github-ssh-kt-template'])",
    );
    expect(prepare).toContain(
      "remoteHeads['refs/heads/main'] != expectedSourceCommit",
    );
    expect(prepare).toContain(
      "remoteHeads['refs/heads/dev'] != expectedSourceCommit",
    );
    expect(prepare).toContain(
      'Remote main/dev must both equal EXPECTED_SOURCE_COMMIT before release.',
    );
    expect(deployStatic).toContain(
      "expression { return env.IS_RELEASE_MODE == 'true' }",
    );
    expect(deployNginx).toContain(
      "expression { return env.IS_RELEASE_MODE == 'true' }",
    );
    expect(deployStatic).not.toContain(
      "expression { return env.IS_PUBLISH_BRANCH == 'true' }",
    );
    expect(deployNginx).not.toContain(
      "expression { return env.IS_PUBLISH_BRANCH == 'true' }",
    );
  });

  it('publishes the exact Admin nginx config atomically with verified rollback', () => {
    const deploy = extractStage('Deploy Nginx Config');
    const backupName = gStringShellVariable('backup_name');
    const backupSha = gStringShellVariable('backup_sha');
    const candidateName = gStringShellVariable('candidate_name');
    const candidateSha = gStringShellVariable('candidate_sha');
    const configSource = groovyVariable('configSource');
    const deployedSha = gStringShellVariable('deployed_sha');
    const nginxContainerName = gStringShellVariable('NGINX_CONTAINER_NAME');
    const originalSha = gStringShellVariable('original_sha');
    const restoreName = gStringShellVariable('restore_name');
    const restoredSha = gStringShellVariable('restored_sha');
    const sourceSha = gStringShellVariable('source_sha');
    const targetName = gStringShellVariable('target_name');
    const backupIndex = deploy.indexOf('backup_name=');
    const residueCheckIndex = deploy.indexOf(
      `test ! -e '/conf.d/${backupName}'`,
      backupIndex,
    );
    const backupCopyIndex = deploy.indexOf(
      `ln '/conf.d/${targetName}' '/conf.d/${backupName}'`,
      backupIndex,
    );
    const backupHashCheckIndex = deploy.indexOf(
      `[ "${backupSha}" != "${originalSha}" ]`,
      backupCopyIndex,
    );
    const trapIndex = deploy.indexOf('trap rollback_config EXIT HUP INT TERM');
    const candidateWriteIndex = deploy.indexOf(
      `cat > '/conf.d/${candidateName}'`,
    );
    const atomicInstallIndex = deploy.indexOf(
      `mv '/conf.d/${candidateName}' '/conf.d/${targetName}'`,
    );
    const validationIndex = deploy.indexOf(
      `docker exec "${nginxContainerName}" nginx -t`,
      atomicInstallIndex,
    );
    const reloadIndex = deploy.indexOf(
      `docker exec "${nginxContainerName}" nginx -s reload`,
      validationIndex,
    );
    const hashReadbackIndex = deploy.indexOf('deployed_sha=', reloadIndex);
    const napcatValidationIndex = deploy.indexOf(
      "grep -n '/napcat-webui/'",
      hashReadbackIndex,
    );
    const clearTrapIndex = deploy.indexOf(
      'trap - EXIT HUP INT TERM',
      napcatValidationIndex,
    );

    expect(deploy).toContain(
      'def configSource = params.NGINX_CONFIG_SOURCE?.trim()',
    );
    expect(deploy).toContain(`"NGINX_CONFIG_SOURCE=${configSource}"`);
    expect(deploy).toContain('rollback_config()');
    expect(deploy).toContain('trap rollback_config EXIT HUP INT TERM');
    expect(deploy).toContain(
      `ln '/conf.d/${backupName}' '/conf.d/${restoreName}'`,
    );
    expect(deploy).toContain(
      `mv '/conf.d/${restoreName}' '/conf.d/${targetName}'`,
    );
    expect(deploy.match(/nginx -t/g)?.length).toBeGreaterThanOrEqual(2);
    expect(deploy.match(/nginx -s reload/g)?.length).toBeGreaterThanOrEqual(2);
    expect(deploy).toContain('source_sha=');
    expect(deploy).toContain('original_sha=');
    expect(deploy).toContain('backup_sha=');
    expect(deploy).toContain('candidate_sha=');
    expect(deploy).toContain('restored_sha=');
    expect(deploy).toContain('deployed_sha=');
    expect(deploy).toContain(`[ "${candidateSha}" != "${sourceSha}" ]`);
    expect(deploy).toContain(`[ "${restoredSha}" != "${originalSha}" ]`);
    expect(deploy).toContain(`[ "${deployedSha}" != "${sourceSha}" ]`);
    expect(deploy).toContain(
      'Deployed Nginx config hash does not match the repository source.',
    );
    expect(deploy).toContain(
      `test -f '/conf.d/${targetName}' && test ! -L '/conf.d/${targetName}'`,
    );
    expect(deploy).toContain(
      `set -C; umask 077; cat > '/conf.d/${candidateName}'`,
    );
    expect(deploy).not.toMatch(/rm -f [^"\n]*\\\$\{backup_name\}/);
    expect(backupIndex).toBeGreaterThanOrEqual(0);
    expect(residueCheckIndex).toBeGreaterThan(backupIndex);
    expect(backupCopyIndex).toBeGreaterThan(residueCheckIndex);
    expect(backupHashCheckIndex).toBeGreaterThan(backupCopyIndex);
    expect(trapIndex).toBeGreaterThan(backupHashCheckIndex);
    expect(candidateWriteIndex).toBeGreaterThan(trapIndex);
    expect(atomicInstallIndex).toBeGreaterThan(candidateWriteIndex);
    expect(validationIndex).toBeGreaterThan(atomicInstallIndex);
    expect(reloadIndex).toBeGreaterThan(validationIndex);
    expect(hashReadbackIndex).toBeGreaterThan(reloadIndex);
    expect(napcatValidationIndex).toBeGreaterThan(hashReadbackIndex);
    expect(clearTrapIndex).toBeGreaterThan(napcatValidationIndex);
  });
});
