def runCmd(String unixScript, String windowsScript = null) {
  if (isUnix()) {
    sh unixScript
  } else {
    bat(windowsScript ?: unixScript)
  }
}

def isPublishBranch(String branchName, String pattern) {
  return branchName ==~ pattern
}

pipeline {
  agent { label 'kt-node-agent' }

  options {
    skipDefaultCheckout(true)
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '10'))
  }

  parameters {
    booleanParam(name: 'DEPLOY_STATIC_FILES', defaultValue: true, description: '构建成功后是否发布 dist 到 Nginx 静态目录；仅发布分支生效')
    booleanParam(name: 'DEPLOY_NGINX_CONFIG', defaultValue: true, description: '构建成功后是否发布并热加载 Admin Nginx 配置；仅发布分支生效')
    string(name: 'PUBLISH_BRANCH_PATTERN', defaultValue: '^(main|master|release/.+)$', description: '允许发布静态文件的分支正则')
    string(name: 'EXPECTED_SOURCE_COMMIT', defaultValue: '', description: '发布对应的 40 位小写 Git commit；必须等于 checkout HEAD')
    string(name: 'DEPLOY_TARGET_DIR', defaultValue: '/home/jenkins/agent/frontends/html/admin', description: 'Nginx 挂载目录中 admin 项目的静态文件目录')
    string(name: 'NGINX_CONTAINER_NAME', defaultValue: 'kt-frontends-nginx', description: '承载 Admin 静态站的 Nginx 容器名')
    string(name: 'NGINX_CONFIG_SOURCE', defaultValue: 'deploy/nginx-admin.conf', description: '仓库内 Admin Nginx 配置文件路径')
    string(name: 'NGINX_CONFIG_TARGET', defaultValue: '/etc/nginx/conf.d/nginx-admin.conf', description: 'Nginx 容器内 Admin 配置目标路径')
    string(name: 'NGINX_CONFIG_VOLUME_DIR', defaultValue: '/vol1/docker/kt-frontends/conf.d', description: 'Docker 宿主机上的 Nginx conf.d 挂载目录')
    string(name: 'NGINX_HELPER_IMAGE', defaultValue: 'nginx:1.27-alpine', description: '用于写入宿主机 Nginx 配置挂载目录的临时 helper 镜像')
    string(name: 'NGINX_UPSTREAM_DOCKER_NETWORK', defaultValue: 'k3d-kt-nas', description: 'Nginx 访问 K8s NodePort upstream 所需的 Docker 网络')
    string(name: 'VITE_BASE', defaultValue: './', description: '构建进 Admin 的相对 Vite base 路径')
    string(name: 'VITE_GLOB_API_URL', defaultValue: '/api', description: '构建进 Admin 的后端 API 前缀')
    string(name: 'VITE_KT_BLOG_WEB_BASE_URL', defaultValue: '/blog/', description: 'Admin 博客预览的同源路径或显式绝对地址')
    choice(name: 'VITE_ROUTER_HISTORY', choices: ['hash', 'html5'], description: 'vue-router 模式')
    choice(name: 'VITE_COMPRESS', choices: ['none', 'gzip', 'brotli'], description: '构建产物压缩模式')
  }

  environment {
    CI = 'true'
    NODE_OPTIONS = '--max-old-space-size=8192'
    PNPM_VERSION = '10.28.2'
    WEB_APP = '@vben/web-antdv-next'
    DIST_DIR = 'apps/web-antdv-next/dist'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Prepare') {
      steps {
        script {
          env.IS_CHANGE_REQUEST = env.CHANGE_ID ? 'true' : 'false'
          def publishPattern = params.PUBLISH_BRANCH_PATTERN?.trim() ?: '^(main|master|release/.+)$'
          env.IS_PUBLISH_BRANCH = (!env.CHANGE_ID && isPublishBranch(env.BRANCH_NAME ?: '', publishPattern)) ? 'true' : 'false'
          env.IS_RELEASE_MODE = (
            !env.CHANGE_ID &&
            env.BRANCH_NAME == 'main' &&
            (params.DEPLOY_STATIC_FILES || params.DEPLOY_NGINX_CONFIG)
          ) ? 'true' : 'false'

          if (env.IS_RELEASE_MODE == 'true') {
            if (!isUnix()) {
              error('Release requires a Linux/NAS Jenkins Agent.')
            }

            def releaseContract = [
              'VITE_BASE': './',
              'VITE_GLOB_API_URL': '/api',
              'VITE_KT_BLOG_WEB_BASE_URL': '/blog/',
              'VITE_ROUTER_HISTORY': 'hash',
            ]
            releaseContract.each { parameterName, expectedValue ->
              if (params[parameterName] != expectedValue) {
                error("Release requires ${parameterName}=${expectedValue}.")
              }
            }

            def expectedSourceCommit = params.EXPECTED_SOURCE_COMMIT ?: ''
            if (!(expectedSourceCommit ==~ /[0-9a-f]{40}/)) {
              error('EXPECTED_SOURCE_COMMIT must be a 40-character lowercase Git commit.')
            }
            def checkedOutCommit = sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
            if (checkedOutCommit != expectedSourceCommit) {
              error("Checked-out HEAD ${checkedOutCommit} does not match EXPECTED_SOURCE_COMMIT ${expectedSourceCommit}.")
            }

            def remoteHeadsRaw = sh(
              script: 'git ls-remote --exit-code --heads origin refs/heads/main refs/heads/dev',
              returnStdout: true,
            ).trim()
            def remoteHeads = [:]
            remoteHeadsRaw.readLines().each { line ->
              def fields = line.trim().split(/\s+/)
              if (fields.size() == 2) {
                remoteHeads[fields[1]] = fields[0]
              }
            }
            if (
              remoteHeads['refs/heads/main'] != expectedSourceCommit ||
              remoteHeads['refs/heads/dev'] != expectedSourceCommit
            ) {
              error('Remote main/dev must both equal EXPECTED_SOURCE_COMMIT before release.')
            }
          }

          if (isUnix()) {
            runCmd("""
              node --version
              if command -v corepack >/dev/null 2>&1; then
                corepack enable
                corepack prepare pnpm@${env.PNPM_VERSION} --activate
              fi
              if ! command -v pnpm >/dev/null 2>&1; then
                echo "pnpm or corepack is required on the Jenkins Agent."
                exit 1
              fi
              pnpm --version
            """.stripIndent())
          } else {
            runCmd('', """
              node --version
              where corepack >nul 2>nul
              if not errorlevel 1 (
                corepack enable
                corepack prepare pnpm@${env.PNPM_VERSION} --activate
              )
              where pnpm >nul 2>nul
              if errorlevel 1 exit /b 1
              pnpm --version
            """.stripIndent())
          }

          echo """
            Branch: ${env.BRANCH_NAME ?: '-'}
            Change request: ${env.CHANGE_ID ?: '-'}
            Publish branch: ${env.IS_PUBLISH_BRANCH}
            Release mode: ${env.IS_RELEASE_MODE}
            Deploy static files: ${params.DEPLOY_STATIC_FILES}
            Deploy target: ${params.DEPLOY_TARGET_DIR}
            Deploy nginx config: ${params.DEPLOY_NGINX_CONFIG}
            Nginx container: ${params.NGINX_CONTAINER_NAME}
            Nginx config volume: ${params.NGINX_CONFIG_VOLUME_DIR}
            Nginx upstream network: ${params.NGINX_UPSTREAM_DOCKER_NETWORK}
            API URL: ${params.VITE_GLOB_API_URL}
            Blog preview URL: ${params.VITE_KT_BLOG_WEB_BASE_URL}
            Vite base: ${params.VITE_BASE}
            Router history: ${params.VITE_ROUTER_HISTORY}
          """.stripIndent()
        }
      }
    }

    stage('Install') {
      steps {
        script {
          runCmd('pnpm install --frozen-lockfile')
        }
      }
    }

    stage('Verify') {
      steps {
        script {
          runCmd('pnpm run verify:commit')
        }
      }
    }

    stage('Build') {
      steps {
        script {
          withEnv([
            "VITE_BASE=${params.VITE_BASE}",
            "VITE_GLOB_API_URL=${params.VITE_GLOB_API_URL}",
            "VITE_KT_BLOG_WEB_BASE_URL=${params.VITE_KT_BLOG_WEB_BASE_URL}",
            "VITE_ROUTER_HISTORY=${params.VITE_ROUTER_HISTORY}",
            "VITE_COMPRESS=${params.VITE_COMPRESS}",
            'VITE_PWA=false',
            'VITE_INJECT_APP_LOADING=true',
            'VITE_ARCHIVER=true',
          ]) {
            // Admin 是 Vben monorepo，需要让 Turbo 先构建 workspace 依赖，避免生产包读到 unbuild stub。
            runCmd('pnpm run build:antdv-next')
          }
        }
      }
    }

    stage('Deploy Static') {
      when {
        allOf {
          expression { return params.DEPLOY_STATIC_FILES }
          expression { return env.IS_CHANGE_REQUEST != 'true' }
          expression { return env.IS_RELEASE_MODE == 'true' }
        }
      }
      steps {
        script {
          if (!isUnix()) {
            error('Deploy Static stage requires a Linux/NAS Jenkins Agent.')
          }

          def targetDir = params.DEPLOY_TARGET_DIR?.trim()
          if (!targetDir) {
            error('DEPLOY_TARGET_DIR is required when DEPLOY_STATIC_FILES is enabled.')
          }

          // 先发布到临时目录再替换目标目录，避免 Nginx 读到半复制状态。
          withEnv([
            "DIST_DIR=${env.DIST_DIR}",
            "TARGET_DIR=${targetDir}",
          ]) {
            runCmd("""
              set -e
              test -f "\${DIST_DIR}/index.html"

              case "\${TARGET_DIR}" in
                ""|"/"|"/home"|"/home/jenkins"|"/home/jenkins/agent"|"/usr"|"/usr/share"|"/usr/share/nginx"|"/usr/share/nginx/html")
                  echo "Unsafe DEPLOY_TARGET_DIR: \${TARGET_DIR}"
                  exit 1
                  ;;
              esac

              parent_dir=\$(dirname "\${TARGET_DIR}")
              release_dir="\${TARGET_DIR}.release-${env.BUILD_NUMBER}"
              previous_dir="\${TARGET_DIR}.previous"

              mkdir -p "\${parent_dir}"
              rm -rf "\${release_dir}" "\${previous_dir}"
              mkdir -p "\${release_dir}"
              cp -a "\${DIST_DIR}/." "\${release_dir}/"

              if [ -d "\${TARGET_DIR}" ]; then
                mv "\${TARGET_DIR}" "\${previous_dir}"
              fi
              mv "\${release_dir}" "\${TARGET_DIR}"
              rm -rf "\${previous_dir}"

              find "\${TARGET_DIR}" -maxdepth 2 -type f | head
            """.stripIndent())
          }
        }
      }
    }

    stage('Deploy Nginx Config') {
      when {
        allOf {
          expression { return params.DEPLOY_NGINX_CONFIG }
          expression { return env.IS_CHANGE_REQUEST != 'true' }
          expression { return env.IS_RELEASE_MODE == 'true' }
        }
      }
      steps {
        script {
          if (!isUnix()) {
            error('Deploy Nginx Config stage requires a Linux/NAS Jenkins Agent.')
          }

          def containerName = params.NGINX_CONTAINER_NAME?.trim()
          def configSource = params.NGINX_CONFIG_SOURCE?.trim()
          def configTarget = params.NGINX_CONFIG_TARGET?.trim()
          def configVolumeDir = params.NGINX_CONFIG_VOLUME_DIR?.trim()
          def helperImage = params.NGINX_HELPER_IMAGE?.trim()
          def upstreamDockerNetwork = params.NGINX_UPSTREAM_DOCKER_NETWORK?.trim()

          if (!containerName || !configSource || !configTarget || !configVolumeDir || !helperImage) {
            error('NGINX_CONTAINER_NAME, NGINX_CONFIG_SOURCE, NGINX_CONFIG_TARGET, NGINX_CONFIG_VOLUME_DIR, and NGINX_HELPER_IMAGE are required when DEPLOY_NGINX_CONFIG is enabled.')
          }

          withEnv([
            "NGINX_CONTAINER_NAME=${containerName}",
            "NGINX_CONFIG_SOURCE=${configSource}",
            "NGINX_CONFIG_TARGET=${configTarget}",
            "NGINX_CONFIG_VOLUME_DIR=${configVolumeDir}",
            "NGINX_HELPER_IMAGE=${helperImage}",
            "NGINX_UPSTREAM_DOCKER_NETWORK=${upstreamDockerNetwork ?: ''}",
          ]) {
            runCmd("""
              set -eu
              test -f "\${NGINX_CONFIG_SOURCE}"

              case "\${NGINX_CONTAINER_NAME}" in
                ""|*[!A-Za-z0-9_.-]*)
                  echo "Unsafe NGINX_CONTAINER_NAME: \${NGINX_CONTAINER_NAME}"
                  exit 1
                  ;;
              esac

              case "\${NGINX_CONFIG_TARGET}" in
                ""|"/"|"/etc"|"/etc/nginx"|"/etc/nginx/conf.d"|*"/.."*|*".."*)
                  echo "Unsafe NGINX_CONFIG_TARGET: \${NGINX_CONFIG_TARGET}"
                  exit 1
                  ;;
              esac

              case "\${NGINX_CONFIG_VOLUME_DIR}" in
                ""|"/"|"/vol1"|"/vol1/docker"|*"/.."*|*".."*)
                  echo "Unsafe NGINX_CONFIG_VOLUME_DIR: \${NGINX_CONFIG_VOLUME_DIR}"
                  exit 1
                  ;;
              esac

              case "\${NGINX_HELPER_IMAGE}" in
                ""|*[!A-Za-z0-9_./:-]*)
                  echo "Unsafe NGINX_HELPER_IMAGE: \${NGINX_HELPER_IMAGE}"
                  exit 1
                  ;;
              esac

              docker ps --format '{{.Names}}' | grep -Fx "\${NGINX_CONTAINER_NAME}" >/dev/null

              if [ -n "\${NGINX_UPSTREAM_DOCKER_NETWORK}" ]; then
                case "\${NGINX_UPSTREAM_DOCKER_NETWORK}" in
                  *[!A-Za-z0-9_.-]*)
                    echo "Unsafe NGINX_UPSTREAM_DOCKER_NETWORK: \${NGINX_UPSTREAM_DOCKER_NETWORK}"
                    exit 1
                    ;;
                esac
                docker network inspect "\${NGINX_UPSTREAM_DOCKER_NETWORK}" >/dev/null
                if ! docker inspect "\${NGINX_CONTAINER_NAME}" --format '{{json .NetworkSettings.Networks}}' | grep -q "\\"\\${NGINX_UPSTREAM_DOCKER_NETWORK}\\""; then
                  docker network connect "\${NGINX_UPSTREAM_DOCKER_NETWORK}" "\${NGINX_CONTAINER_NAME}"
                fi
              fi

              docker image inspect "\${NGINX_HELPER_IMAGE}" >/dev/null 2>&1 || docker pull "\${NGINX_HELPER_IMAGE}"

              target_name=\$(basename "\${NGINX_CONFIG_TARGET}")
              backup_name="\${target_name}.bak-${env.BUILD_NUMBER}"
              candidate_name="\${target_name}.candidate-${env.BUILD_NUMBER}"
              restore_name="\${target_name}.restore-${env.BUILD_NUMBER}"

              source_sha=\$(sha256sum "\${NGINX_CONFIG_SOURCE}")
              source_sha=\${source_sha%% *}
              original_sha=\$(docker run --rm -v "\${NGINX_CONFIG_VOLUME_DIR}:/conf.d:ro" "\${NGINX_HELPER_IMAGE}" sha256sum "/conf.d/\${target_name}")
              original_sha=\${original_sha%% *}
              docker run --rm -v "\${NGINX_CONFIG_VOLUME_DIR}:/conf.d:rw" "\${NGINX_HELPER_IMAGE}" sh -lc "test -f '/conf.d/\${target_name}' && test ! -L '/conf.d/\${target_name}' && test ! -e '/conf.d/\${backup_name}' && test ! -L '/conf.d/\${backup_name}' && test ! -e '/conf.d/\${candidate_name}' && test ! -L '/conf.d/\${candidate_name}' && test ! -e '/conf.d/\${restore_name}' && test ! -L '/conf.d/\${restore_name}' && ln '/conf.d/\${target_name}' '/conf.d/\${backup_name}'"
              backup_sha=\$(docker run --rm -v "\${NGINX_CONFIG_VOLUME_DIR}:/conf.d:ro" "\${NGINX_HELPER_IMAGE}" sha256sum "/conf.d/\${backup_name}")
              backup_sha=\${backup_sha%% *}
              if [ "\${backup_sha}" != "\${original_sha}" ]; then
                echo "Nginx config backup hash does not match the current production file."
                exit 1
              fi
              echo "Current Nginx config backed up as \${backup_name} with SHA256 \${backup_sha}."

              rollback_config() {
                trap - EXIT HUP INT TERM
                set +e
                echo "Nginx config deployment failed; restoring the previous production file."

                restore_status=0
                docker run --rm -v "\${NGINX_CONFIG_VOLUME_DIR}:/conf.d:rw" "\${NGINX_HELPER_IMAGE}" sh -lc "ln '/conf.d/\${backup_name}' '/conf.d/\${restore_name}' && mv '/conf.d/\${restore_name}' '/conf.d/\${target_name}' && rm -f '/conf.d/\${candidate_name}'" || restore_status=\$?

                restored_sha=
                if [ "\${restore_status}" -eq 0 ]; then
                  restored_sha=\$(docker exec "\${NGINX_CONTAINER_NAME}" sha256sum "\${NGINX_CONFIG_TARGET}")
                  restore_status=\$?
                  restored_sha=\${restored_sha%% *}
                  if [ "\${restore_status}" -eq 0 ] && [ "\${restored_sha}" != "\${original_sha}" ]; then
                    echo "Restored Nginx config hash does not match the original production file."
                    restore_status=1
                  fi
                fi

                validate_status=1
                reload_status=1
                if [ "\${restore_status}" -eq 0 ]; then
                  docker exec "\${NGINX_CONTAINER_NAME}" nginx -t
                  validate_status=\$?
                  if [ "\${validate_status}" -eq 0 ]; then
                    docker exec "\${NGINX_CONTAINER_NAME}" nginx -s reload
                    reload_status=\$?
                  fi
                fi

                if [ "\${restore_status}" -ne 0 ] || [ "\${validate_status}" -ne 0 ] || [ "\${reload_status}" -ne 0 ]; then
                  echo "Nginx config rollback failed validation or reload."
                else
                  echo "Previous Nginx config restored, validated, and reloaded."
                fi
                exit 1
              }
              trap rollback_config EXIT HUP INT TERM

              docker run --rm -i -v "\${NGINX_CONFIG_VOLUME_DIR}:/conf.d:rw" "\${NGINX_HELPER_IMAGE}" sh -lc "set -C; umask 077; cat > '/conf.d/\${candidate_name}'" < "\${NGINX_CONFIG_SOURCE}"
              candidate_sha=\$(docker run --rm -v "\${NGINX_CONFIG_VOLUME_DIR}:/conf.d:ro" "\${NGINX_HELPER_IMAGE}" sha256sum "/conf.d/\${candidate_name}")
              candidate_sha=\${candidate_sha%% *}
              if [ "\${candidate_sha}" != "\${source_sha}" ]; then
                echo "Nginx config candidate hash does not match the repository source."
                exit 1
              fi

              docker run --rm -v "\${NGINX_CONFIG_VOLUME_DIR}:/conf.d:rw" "\${NGINX_HELPER_IMAGE}" sh -lc "mv '/conf.d/\${candidate_name}' '/conf.d/\${target_name}'"
              docker exec "\${NGINX_CONTAINER_NAME}" nginx -t
              docker exec "\${NGINX_CONTAINER_NAME}" nginx -s reload

              deployed_sha=\$(docker exec "\${NGINX_CONTAINER_NAME}" sha256sum "\${NGINX_CONFIG_TARGET}")
              deployed_sha=\${deployed_sha%% *}
              if [ "\${deployed_sha}" != "\${source_sha}" ]; then
                echo "Deployed Nginx config hash does not match the repository source."
                exit 1
              fi

              docker exec "\${NGINX_CONTAINER_NAME}" sh -lc "nginx -T 2>/dev/null | grep -n '/napcat-webui/' >/dev/null"

              trap - EXIT HUP INT TERM
              echo "Admin Nginx config deployed with SHA256 \${deployed_sha}."
            """.stripIndent())
          }
        }
      }
    }
  }

  post {
    success {
      archiveArtifacts artifacts: 'apps/web-antdv-next/dist/**,apps/web-antdv-next/dist.zip,deploy/nginx-admin.conf,package.json,pnpm-lock.yaml,Jenkinsfile', fingerprint: true, allowEmptyArchive: true
    }
  }
}
