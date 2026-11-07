# HPrint Agent

基于 Tauri 2 + Vue 3 + Rust 的本机打印 Agent。桌面程序启动后会在本机开启 HTTP 服务，业务系统通过 `hiprint-v2` SDK 调用打印能力。

## 开发运行

```bash
npm install
npm run tauri:dev
```

程序默认尝试监听 `127.0.0.1:17878`，端口被占用时会顺延选择可用端口，并在 Tauri 命令 `get_agent_port` 中返回实际端口。

## 生成安装包

```bash
npm run tauri:build
```

Windows 构建需要 Rust MSVC 工具链、Visual Studio C++ Build Tools、Windows SDK 和 WebView2。生成物位于 `src-tauri/target/release/bundle/`。

## 已实现的 HTTP 接口

```text
GET    /health
GET    /printers
GET/PUT /printer-settings
POST   /print
POST   /print-jobs
GET    /print-jobs/:id
GET    /print-jobs/:id/artifacts
GET    /print-jobs/:id/artifacts/:name
GET    /logs
GET    /print-history
GET    /print-history/:id
DELETE /print-history/:id
DELETE /print-history
POST   /test-raw
GET    /diagnostics
GET    /auth/config
POST   /export/pdf
```

打印设置、历史记录和任务产物写入 Tauri 应用数据目录。可以通过环境变量启用简单认证和 Origin 白名单：

```text
HPRINT_TOKEN=your-token
HPRINT_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

目前 Windows RAW 打印使用系统打印队列的 `WritePrinter`，支持 ESC/POS 原始字节发送；文档、标签和 PDF 接口已提供兼容协议，复杂 WebView2 排版和 TSPL/CPCL 位图链路仍需要连接真实打印机做实机验收。
