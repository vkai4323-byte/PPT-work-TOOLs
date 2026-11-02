# 依赖获取与版本记录

公开预览包只携带工具源码、安装器、固定版本清单和来源记录，不携带Python第三方wheel及源码归档。客户Codex运行安装器后，自动从https://pypi.org/simple获取依赖，不要求客户分别安装。

modules/creator-workflow/requirements-pypi-win-py313.lock固定25个运行依赖及原始发布文件SHA256；dependency-origins.json记录PyPI元数据返回的确切文件URL、版本、分发类型和许可标识。安装使用require-hashes，版本或文件不匹配即停止，不通过换浮动版本绕过。

除qrcode-terminal==0.8外均使用预编译wheel。该包官方版本只有源码分发，安装器先按build-requirements.lock固定安装setuptools与wheel，再用no-build-isolation自动构建；不在客户机使用浮动构建依赖。源码哈希与本地构建wheel哈希是不同概念，验收以官方源码哈希为输入依据。

包的原有许可证、版权及使用条件以其官方发行内容为准，安装到独立workflow-python环境，不重写许可证，也不将第三方代码改称Workbench自有代码。B站客户端官方来源为https://pypi.org/project/bilibili-api-python/17.4.2/及其链接的上游项目。

Python、OfficeCLI与WebBridge由tools/bootstrap-lock.json固定来源和版本；Node由安装器固定缺失时的下载版本并核验官方SHASUMS256，已有兼容Node可复用。JS依赖由package-lock.json固定，浏览器由锁定的Playwright安装。所有运行依赖都需要安装时网络；下载中断由Codex诊断后续跑。
