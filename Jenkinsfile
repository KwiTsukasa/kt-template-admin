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
    string(name: 'DEPLOY_TARGET_DIR', defaultValue: '/home/jenkins/agent/frontends/html/admin', description: 'Nginx 挂载目录中 admin 项目的静态文件目录')
    string(name: 'NGINX_CONTAINER_NAME', defaultValue: 'kt-frontends-nginx', description: '承载 Admin 静态站的 Nginx 容器名')
    string(name: 'NGINX_CONFIG_SOURCE', defaultValue: 'deploy/nginx-admin.conf', description: '仓库内 Admin Nginx 配置文件路径')
    string(name: 'NGINX_CONFIG_TARGET', defaultValue: '/etc/nginx/conf.d/nginx-admin.conf', description: 'Nginx 容器内 Admin 配置目标路径')
    string(name: 'NGINX_CONFIG_VOLUME_DIR', defaultValue: '/vol1/docker/kt-frontends/conf.d', description: 'Docker 宿主机上的 Nginx conf.d 挂载目录')
    string(name: 'NGINX_HELPER_IMAGE', defaultValue: 'nginx:1.27-alpine', description: '用于写入宿主机 Nginx 配置挂载目录的临时 helper 镜像')
    string(name: 'VITE_BASE', defaultValue: '/', description: '构建进 Admin 的 Vite base 路径')
    string(name: 'VITE_GLOB_API_URL', defaultValue: '/api', description: '构建进 Admin 的后端 API 前缀')
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
            Deploy static files: ${params.DEPLOY_STATIC_FILES}
            Deploy target: ${params.DEPLOY_TARGET_DIR}
            Deploy nginx config: ${params.DEPLOY_NGINX_CONFIG}
            Nginx container: ${params.NGINX_CONTAINER_NAME}
            Nginx config volume: ${params.NGINX_CONFIG_VOLUME_DIR}
            API URL: ${params.VITE_GLOB_API_URL}
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
          expression { return env.IS_PUBLISH_BRANCH == 'true' }
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
          expression { return env.IS_PUBLISH_BRANCH == 'true' }
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

          if (!containerName || !configSource || !configTarget || !configVolumeDir || !helperImage) {
            error('NGINX_CONTAINER_NAME, NGINX_CONFIG_SOURCE, NGINX_CONFIG_TARGET, NGINX_CONFIG_VOLUME_DIR, and NGINX_HELPER_IMAGE are required when DEPLOY_NGINX_CONFIG is enabled.')
          }

          withEnv([
            "NGINX_CONTAINER_NAME=${containerName}",
            "NGINX_CONFIG_SOURCE=${configSource}",
            "NGINX_CONFIG_TARGET=${configTarget}",
            "NGINX_CONFIG_VOLUME_DIR=${configVolumeDir}",
            "NGINX_HELPER_IMAGE=${helperImage}",
          ]) {
            runCmd("""
              set -e
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

              target_name=\$(basename "\${NGINX_CONFIG_TARGET}")
              backup_name="\${target_name}.bak-${env.BUILD_NUMBER}"
              docker image inspect "\${NGINX_HELPER_IMAGE}" >/dev/null 2>&1 || docker pull "\${NGINX_HELPER_IMAGE}"
              docker run --rm -v "\${NGINX_CONFIG_VOLUME_DIR}:/conf.d:rw" "\${NGINX_HELPER_IMAGE}" sh -lc "if [ -f '/conf.d/\${target_name}' ]; then cp '/conf.d/\${target_name}' '/conf.d/\${backup_name}'; fi"
              docker run --rm -i -v "\${NGINX_CONFIG_VOLUME_DIR}:/conf.d:rw" "\${NGINX_HELPER_IMAGE}" sh -lc "cat > '/conf.d/\${target_name}'" < "\${NGINX_CONFIG_SOURCE}"

              if ! docker exec "\${NGINX_CONTAINER_NAME}" nginx -t; then
                echo "Nginx config validation failed; restoring previous config."
                docker run --rm -v "\${NGINX_CONFIG_VOLUME_DIR}:/conf.d:rw" "\${NGINX_HELPER_IMAGE}" sh -lc "if [ -f '/conf.d/\${backup_name}' ]; then cp '/conf.d/\${backup_name}' '/conf.d/\${target_name}'; fi"
                docker exec "\${NGINX_CONTAINER_NAME}" nginx -t || true
                exit 1
              fi

              docker exec "\${NGINX_CONTAINER_NAME}" nginx -s reload
              docker exec "\${NGINX_CONTAINER_NAME}" sh -lc "nginx -T 2>/dev/null | grep -n '/napcat-webui/' >/dev/null"
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
