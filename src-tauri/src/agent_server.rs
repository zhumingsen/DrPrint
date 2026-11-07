use axum::{
    Json, Router,
    body::Body,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post, put},
};
use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    collections::HashMap,
    fs, io,
    path::PathBuf,
    sync::{
        Arc,
        atomic::{AtomicU16, Ordering},
    },
    time::Instant,
};
use tokio::{
    net::TcpListener,
    sync::{Mutex, RwLock},
};
use tower_http::cors::CorsLayer;
use uuid::Uuid;

const DEFAULT_PORT: u16 = 17_878;

#[derive(Clone)]
pub struct AgentState {
    pub root: PathBuf,
    pub settings: Arc<RwLock<Value>>,
    pub jobs: Arc<RwLock<HashMap<String, JobRecord>>>,
    pub history: Arc<RwLock<Vec<HistoryEntry>>>,
    pub queue: Arc<Mutex<()>>,
    pub started_at: Instant,
    pub token: Option<String>,
    pub allowed_origins: Arc<Vec<String>>,
}

impl AgentState {
    pub fn new(root: PathBuf) -> Self {
        let _ = fs::create_dir_all(root.join("artifacts"));
        let settings_path = root.join("printer-settings.json");
        let settings = fs::read_to_string(&settings_path)
            .ok()
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or_else(default_settings);
        let history = fs::read_to_string(root.join("print-history.json"))
            .ok()
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or_default();
        let token = std::env::var("HPRINT_TOKEN")
            .ok()
            .filter(|v| !v.trim().is_empty());
        let allowed_origins = std::env::var("HPRINT_ALLOWED_ORIGINS")
            .unwrap_or_default()
            .split(',')
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .map(ToOwned::to_owned)
            .collect();
        Self {
            root,
            settings: Arc::new(RwLock::new(settings)),
            jobs: Arc::new(RwLock::new(HashMap::new())),
            history: Arc::new(RwLock::new(history)),
            queue: Arc::new(Mutex::new(())),
            started_at: Instant::now(),
            token,
            allowed_origins: Arc::new(allowed_origins),
        }
    }
}

struct ApiError {
    error: String,
    code: String,
}

impl ApiError {
    fn new(status: StatusCode, code: impl Into<String>, error: impl Into<String>) -> ApiResponse {
        ApiResponse {
            status,
            body: Json(json!({ "error": error.into(), "code": code.into() })),
        }
    }
}

struct ApiResponse {
    status: StatusCode,
    body: Json<Value>,
}
impl IntoResponse for ApiResponse {
    fn into_response(self) -> Response {
        (self.status, self.body).into_response()
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PrintJobRequest {
    template: Value,
    #[serde(default = "empty_object")]
    data: Value,
    rendered_html: Option<String>,
    rendered_pages: Option<Vec<String>>,
    printer_name: Option<String>,
    copies: Option<u32>,
    document_name: Option<String>,
    render_mode: Option<String>,
    usage: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct JobRecord {
    job_id: String,
    status: String,
    message: Option<String>,
    printer_name: String,
    document_name: String,
    copies: u32,
    created_at: DateTime<Utc>,
    render_mode: Option<String>,
    usage: Option<String>,
    error_code: Option<String>,
    bytes_written: Option<usize>,
    raw_artifacts: Vec<Value>,
    raw_metrics: Value,
    #[serde(skip)]
    request: Option<PrintJobRequest>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HistoryEntry {
    id: String,
    created_at: DateTime<Utc>,
    printer_name: String,
    document_name: String,
    template_name: Option<String>,
    usage: Option<String>,
    render_mode: Option<String>,
    copies: u32,
    status: String,
    error_code: Option<String>,
    message: Option<String>,
    bytes_written: Option<usize>,
    snapshot_truncated: bool,
}

#[derive(Debug, Deserialize)]
struct HistoryQuery {
    limit: Option<usize>,
}
pub async fn serve(state: AgentState, port: Arc<AtomicU16>) {
    let Ok((listener, actual_port)) = bind_listener().await else {
        return;
    };
    port.store(actual_port, Ordering::Relaxed);
    let _ = fs::write(
        state.root.join("agent-port.json"),
        json!({ "port": actual_port }).to_string(),
    );
    let app = Router::new()
        .route("/health", get(health))
        .route("/printers", get(printers))
        .route("/printer-settings", get(get_settings).put(put_settings))
        .route("/print", post(create_job))
        .route("/print-jobs", post(create_job))
        .route("/print-jobs/:id", get(get_job).delete(delete_job))
        .route("/print-jobs/:id/artifacts", get(list_artifacts))
        .route("/print-jobs/:id/artifacts/:name", get(download_artifact))
        .route("/print-history", get(print_history).delete(clear_history))
        .route(
            "/print-history/:id",
            get(history_item).delete(delete_history_item),
        )
        .route("/test-raw", post(test_raw))
        .route("/diagnostics", get(diagnostics))
        .route("/auth/config", get(auth_config))
        .route("/export/pdf", post(export_pdf))
        .layer(CorsLayer::very_permissive())
        .with_state(state);
    let _ = axum::serve(listener, app).await;
}

async fn bind_listener() -> io::Result<(TcpListener, u16)> {
    for port in DEFAULT_PORT..DEFAULT_PORT + 30 {
        if let Ok(listener) = TcpListener::bind(("127.0.0.1", port)).await {
            return Ok((listener, port));
        }
    }
    Err(io::Error::new(
        io::ErrorKind::AddrInUse,
        "没有可用的 Agent 端口",
    ))
}

fn empty_object() -> Value {
    json!({})
}
fn default_settings() -> Value {
    json!({ "previewBeforePrint": true, "printerSettings": {
        "label": { "printerName": "", "renderMode": "raw-raster", "rawProtocol": "tspl", "paper": { "width": 80, "height": 60, "unit": "mm" }, "paperPolicy": "template", "printableWidthMm": 80, "printableWidthDots": 640, "labelMediaType": "gap", "gapMm": 2, "gapOffsetMm": 0 },
        "receipt": { "printerName": "", "renderMode": "raw-raster", "rawProtocol": "escpos", "paper": { "width": 80, "height": 200, "unit": "mm" }, "paperPolicy": "template", "printableWidthMm": 72, "printableWidthDots": 576, "cutterFeedMm": 18 },
        "document": { "printerName": "", "renderMode": "webview", "rawProtocol": "none", "paper": { "width": 210, "height": 297, "unit": "mm" }, "paperPolicy": "template" }
    } })
}

fn authorize(headers: &HeaderMap, state: &AgentState) -> Result<(), ApiResponse> {
    if let Some(origin) = headers.get("origin").and_then(|v| v.to_str().ok()) {
        if !state.allowed_origins.is_empty()
            && !state.allowed_origins.iter().any(|item| item == origin)
        {
            return Err(ApiError::new(
                StatusCode::FORBIDDEN,
                "ORIGIN_NOT_ALLOWED",
                "Origin 不在允许列表中",
            ));
        }
    }
    if let Some(token) = &state.token {
        let expected = format!("Bearer {token}");
        if headers.get("authorization").and_then(|v| v.to_str().ok()) != Some(expected.as_str()) {
            return Err(ApiError::new(
                StatusCode::UNAUTHORIZED,
                "AUTH_REQUIRED",
                "Agent token 无效",
            ));
        }
    }
    Ok(())
}

async fn health(
    State(state): State<AgentState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiResponse> {
    authorize(&headers, &state)?;
    Ok(Json(
        json!({ "ok": true, "name": "HPrint Agent", "version": "1.0.0-reconstructed", "protocolVersion": "2026-06" }),
    ))
}

async fn printers(
    State(state): State<AgentState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiResponse> {
    authorize(&headers, &state)?;
    let items = printer::list_printers().into_iter().map(|item| {
        let lower = format!("{} {}", item.name, item.driver_name).to_lowercase();
        let document = lower.contains("pdf") || lower.contains("xps") || lower.contains("onenote") || lower.contains("document");
        json!({ "name": item.name, "isDefault": item.is_default, "status": item.status, "printerType": if document { "document" } else { "raw" }, "capabilities": { "paperWidthMm": if document { 210 } else { 80 }, "charsPerLine": if document { 80 } else { 48 }, "encoding": "GBK", "dpi": 203, "printableWidthMm": if document { 210 } else { 72 }, "printableWidthDots": if document { 1680 } else { 576 }, "rawProtocol": if document { "none" } else { "escpos" }, "supportedModes": if document { json!(["webview"]) } else { json!(["raw", "raw-text", "raw-raster"]) } } })
    }).collect::<Vec<_>>();
    Ok(Json(Value::Array(items)))
}

async fn get_settings(
    State(state): State<AgentState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiResponse> {
    authorize(&headers, &state)?;
    Ok(Json(state.settings.read().await.clone()))
}

async fn put_settings(
    State(state): State<AgentState>,
    headers: HeaderMap,
    Json(value): Json<Value>,
) -> Result<Json<Value>, ApiResponse> {
    authorize(&headers, &state)?;
    if value
        .get("printerSettings")
        .and_then(Value::as_object)
        .is_none()
    {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "INVALID_SETTINGS",
            "缺少 printerSettings",
        ));
    }
    *state.settings.write().await = value.clone();
    persist_json(&state.root.join("printer-settings.json"), &value).map_err(|e| {
        ApiError::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "SETTINGS_WRITE_FAILED",
            e.to_string(),
        )
    })?;
    Ok(Json(value))
}

async fn create_job(
    State(state): State<AgentState>,
    headers: HeaderMap,
    Json(request): Json<PrintJobRequest>,
) -> Result<Json<Value>, ApiResponse> {
    authorize(&headers, &state)?;
    let id = Uuid::new_v4().to_string();
    let copies = request.copies.unwrap_or(1).clamp(1, 99);
    let usage = request
        .usage
        .clone()
        .unwrap_or_else(|| "document".to_string());
    let printer_name = if let Some(name) = request.printer_name.clone() {
        name
    } else {
        configured_printer(&state, &usage).await.unwrap_or_default()
    };
    let record = JobRecord {
        job_id: id.clone(),
        status: "queued".to_string(),
        message: None,
        printer_name,
        document_name: request
            .document_name
            .clone()
            .unwrap_or_else(|| "HPrint 打印任务".to_string()),
        copies,
        created_at: Utc::now(),
        render_mode: request.render_mode.clone(),
        usage: request.usage.clone(),
        error_code: None,
        bytes_written: None,
        raw_artifacts: Vec::new(),
        raw_metrics: json!({}),
        request: Some(request),
    };
    state.jobs.write().await.insert(id.clone(), record);
    let worker_state = state.clone();
    tokio::spawn(async move {
        process_job(worker_state, id).await;
    });
    Ok(Json(json!({ "jobId": id, "status": "queued" })))
}

async fn get_job(
    State(state): State<AgentState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiResponse> {
    authorize(&headers, &state)?;
    let jobs = state.jobs.read().await;
    let Some(job) = jobs.get(&id) else {
        return Err(ApiError::new(
            StatusCode::NOT_FOUND,
            "JOB_NOT_FOUND",
            "任务不存在",
        ));
    };
    Ok(Json(serde_json::to_value(job).unwrap_or_else(
        |_| json!({ "jobId": id, "status": "failed" }),
    )))
}

async fn delete_job(
    State(state): State<AgentState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiResponse> {
    authorize(&headers, &state)?;
    let removed = state.jobs.write().await.remove(&id).is_some();
    Ok(Json(json!({ "ok": removed })))
}

async fn process_job(state: AgentState, id: String) {
    let _guard = state.queue.lock().await;
    let request = {
        let mut jobs = state.jobs.write().await;
        let Some(job) = jobs.get_mut(&id) else { return };
        job.status = "rendering".to_string();
        job.request.clone()
    };
    let Some(request) = request else { return };
    let (printer_name, document_name, copies, usage) = {
        let jobs = state.jobs.read().await;
        let job = jobs.get(&id).unwrap();
        (
            job.printer_name.clone(),
            job.document_name.clone(),
            job.copies,
            job.usage.clone().unwrap_or_else(|| "document".to_string()),
        )
    };
    let artifact_dir = state.root.join("artifacts");
    let template_name = request
        .template
        .get("name")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let html = request
        .rendered_html
        .clone()
        .or_else(|| {
            request
                .rendered_pages
                .as_ref()
                .and_then(|pages| pages.first().cloned())
        })
        .unwrap_or_else(|| template_to_html(&request.template, &request.data));
    let _ = fs::write(artifact_dir.join(format!("{id}.html")), &html);
    let _ = fs::write(
        artifact_dir.join(format!("{id}.json")),
        serde_json::to_vec_pretty(
            &json!({ "template": request.template.clone(), "data": request.data.clone() }),
        ),
    );
    let result = if printer_name.trim().is_empty() {
        Err(("NO_PRINTER".to_string(), "未配置打印机".to_string(), 0usize))
    } else {
        update_status(&state, &id, "printing", None, None, None).await;
        let text = html_to_text(&html);
        let bytes = if usage == "document" || request.render_mode.as_deref() == Some("webview") {
            text.into_bytes()
        } else {
            escpos_text(&text)
        };
        let mut written = 0usize;
        let mut error = None;
        for _ in 0..copies {
            match printer::write_raw(&printer_name, &bytes, &document_name) {
                Ok(size) => written += size,
                Err(e) => {
                    error = Some(e.to_string());
                    break;
                }
            }
        }
        if let Some(message) = error {
            Err(("PRINT_FAILED".to_string(), message, written))
        } else {
            Ok(written)
        }
    };
    match result {
        Ok(bytes) => {
            update_status(&state, &id, "printed", Some("打印完成"), None, Some(bytes)).await
        }
        Err((code, message, bytes)) => {
            update_status(
                &state,
                &id,
                "failed",
                Some(&message),
                Some(&code),
                Some(bytes),
            )
            .await
        }
    }
    if let Some(job) = state.jobs.read().await.get(&id).cloned() {
        let history = HistoryEntry {
            id: job.job_id.clone(),
            created_at: job.created_at,
            printer_name: job.printer_name,
            document_name: job.document_name,
            template_name,
            usage: job.usage,
            render_mode: job.render_mode,
            copies: job.copies,
            status: job.status,
            error_code: job.error_code,
            message: job.message,
            bytes_written: job.bytes_written,
            snapshot_truncated: false,
        };
        let mut items = state.history.write().await;
        items.retain(|item| item.id != history.id);
        items.insert(0, history);
        let _ = persist_json(&state.root.join("print-history.json"), &*items);
    }
}

async fn update_status(
    state: &AgentState,
    id: &str,
    status: &str,
    message: Option<&str>,
    error_code: Option<&str>,
    bytes: Option<usize>,
) {
    if let Some(job) = state.jobs.write().await.get_mut(id) {
        job.status = status.to_string();
        job.message = message.map(ToOwned::to_owned);
        job.error_code = error_code.map(ToOwned::to_owned);
        job.bytes_written = bytes;
    }
}

async fn list_artifacts(
    State(state): State<AgentState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiResponse> {
    authorize(&headers, &state)?;
    let names = [
        ("html", "渲染 HTML", "text/html"),
        ("json", "任务快照", "application/json"),
    ];
    let artifacts = names.iter().filter_map(|(name, label, content_type)| { let path = state.root.join("artifacts").join(format!("{id}.{name}")); let size = fs::metadata(&path).ok()?.len(); Some(json!({ "name": format!("{name}"), "label": label, "contentType": content_type, "size": size, "url": format!("/print-jobs/{id}/artifacts/{name}") })) }).collect::<Vec<_>>();
    Ok(Json(json!({ "jobId": id, "artifacts": artifacts })))
}

async fn download_artifact(
    State(state): State<AgentState>,
    headers: HeaderMap,
    Path((id, name)): Path<(String, String)>,
) -> Result<Response, ApiResponse> {
    authorize(&headers, &state)?;
    if !["html", "json"].contains(&name.as_str()) {
        return Err(ApiError::new(
            StatusCode::NOT_FOUND,
            "ARTIFACT_NOT_FOUND",
            "产物不存在",
        ));
    }
    let path = state.root.join("artifacts").join(format!("{id}.{name}"));
    let bytes = fs::read(path)
        .map_err(|_| ApiError::new(StatusCode::NOT_FOUND, "ARTIFACT_NOT_FOUND", "产物不存在"))?;
    let content_type = if name == "html" {
        "text/html; charset=utf-8"
    } else {
        "application/json"
    };
    Ok(([("content-type", content_type)], Body::from(bytes)).into_response())
}

async fn print_history(
    State(state): State<AgentState>,
    headers: HeaderMap,
    Query(query): Query<HistoryQuery>,
) -> Result<Json<Value>, ApiResponse> {
    authorize(&headers, &state)?;
    let items = state.history.read().await;
    let limit = query.limit.unwrap_or(100).min(500);
    Ok(Json(
        json!({ "history": items.iter().take(limit).cloned().collect::<Vec<_>>(), "count": items.len() }),
    ))
}

async fn history_item(
    State(state): State<AgentState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiResponse> {
    authorize(&headers, &state)?;
    let item = state
        .history
        .read()
        .await
        .iter()
        .find(|entry| entry.id == id)
        .cloned();
    let Some(item) = item else {
        return Err(ApiError::new(
            StatusCode::NOT_FOUND,
            "HISTORY_NOT_FOUND",
            "打印记录不存在",
        ));
    };
    let snapshot = fs::read_to_string(state.root.join("artifacts").join(format!("{id}.json")))
        .ok()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        .unwrap_or_else(|| json!({}));
    Ok(Json(
        json!({ "id": id, "createdAt": item.created_at, "printerName": item.printer_name, "documentName": item.document_name, "templateName": item.template_name, "usage": item.usage, "renderMode": item.render_mode, "copies": item.copies, "status": item.status, "errorCode": item.error_code, "message": item.message, "bytesWritten": item.bytes_written, "snapshotTruncated": item.snapshot_truncated, "template": snapshot.get("template"), "data": snapshot.get("data") }),
    ))
}

async fn delete_history_item(
    State(state): State<AgentState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiResponse> {
    authorize(&headers, &state)?;
    let mut items = state.history.write().await;
    let old = items.len();
    items.retain(|item| item.id != id);
    persist_json(&state.root.join("print-history.json"), &*items).ok();
    Ok(Json(json!({ "ok": old != items.len() })))
}
async fn clear_history(
    State(state): State<AgentState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiResponse> {
    authorize(&headers, &state)?;
    state.history.write().await.clear();
    persist_json(
        &state.root.join("print-history.json"),
        &Vec::<HistoryEntry>::new(),
    )
    .ok();
    Ok(Json(json!({ "ok": true })))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawRequest {
    printer_name: Option<String>,
    init: Option<bool>,
    feed: Option<u32>,
    cut: Option<bool>,
    text: Option<String>,
}
async fn test_raw(
    State(state): State<AgentState>,
    headers: HeaderMap,
    Json(request): Json<RawRequest>,
) -> Result<Json<Value>, ApiResponse> {
    authorize(&headers, &state)?;
    let printer_name = request
        .printer_name
        .or_else(|| {
            printer::list_printers()
                .into_iter()
                .find(|p| p.is_default)
                .map(|p| p.name)
        })
        .unwrap_or_default();
    if printer_name.is_empty() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "NO_PRINTER",
            "没有可用打印机",
        ));
    }
    let mut bytes = Vec::new();
    if request.init.unwrap_or(true) {
        bytes.extend_from_slice(b"\x1b\x40")
    }
    bytes.extend_from_slice(
        request
            .text
            .unwrap_or_else(|| "HPrint ESC/POS RAW Test\n".to_string())
            .as_bytes(),
    );
    bytes.extend(std::iter::repeat_n(
        b'\n',
        request.feed.unwrap_or(3) as usize,
    ));
    if request.cut.unwrap_or(false) {
        bytes.extend_from_slice(b"\x1d\x56\x00")
    }
    let written = printer::write_raw(&printer_name, &bytes, "HPrint RAW Test")
        .map_err(|e| ApiError::new(StatusCode::BAD_GATEWAY, "PRINT_FAILED", e.to_string()))?;
    Ok(Json(
        json!({ "success": true, "printer": printer_name, "init": request.init.unwrap_or(true), "feedLines": request.feed.unwrap_or(3), "cut": request.cut.unwrap_or(false), "text": "HPrint ESC/POS RAW Test", "bytesWritten": written }),
    ))
}

async fn diagnostics(
    State(state): State<AgentState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiResponse> {
    authorize(&headers, &state)?;
    let printers = printer::list_printers();
    let jobs = state.jobs.read().await;
    Ok(Json(
        json!({ "agent": { "version": "1.0.0-reconstructed", "protocolVersion": "2026-06" }, "system": { "platform": std::env::consts::OS, "arch": std::env::consts::ARCH }, "printers": { "count": printers.len(), "defaultPrinter": printers.iter().find(|p| p.is_default).map(|p| p.name.clone()) }, "jobs": { "total": jobs.len(), "queued": jobs.values().filter(|j| j.status == "queued").count(), "printed": jobs.values().filter(|j| j.status == "printed").count(), "failed": jobs.values().filter(|j| j.status == "failed").count() }, "uptimeSeconds": state.started_at.elapsed().as_secs() }),
    ))
}
async fn auth_config(
    State(state): State<AgentState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiResponse> {
    authorize(&headers, &state)?;
    Ok(Json(
        json!({ "authEnabled": state.token.is_some(), "allowedOrigins": state.allowed_origins.as_ref() }),
    ))
}

#[derive(Debug, Deserialize)]
struct PdfRequest {
    html: Option<String>,
}
async fn export_pdf(
    State(state): State<AgentState>,
    headers: HeaderMap,
    Json(request): Json<PdfRequest>,
) -> Result<Json<Value>, ApiResponse> {
    authorize(&headers, &state)?;
    let text = html_to_text(request.html.as_deref().unwrap_or(""));
    let pdf = minimal_pdf(&text);
    Ok(Json(
        json!({ "pdf": BASE64.encode(pdf), "mode": "text-fallback" }),
    ))
}

async fn configured_printer(state: &AgentState, usage: &str) -> Option<String> {
    state
        .settings
        .read()
        .await
        .get("printerSettings")
        .and_then(|v| v.get(usage))
        .and_then(|v| v.get("printerName"))
        .and_then(Value::as_str)
        .filter(|v| !v.is_empty())
        .map(ToOwned::to_owned)
}
fn persist_json(path: &PathBuf, value: &impl Serialize) -> io::Result<()> {
    let temp = path.with_extension("tmp");
    fs::write(
        &temp,
        serde_json::to_vec_pretty(value).map_err(io::Error::other)?,
    )?;
    fs::rename(temp, path)
}
fn template_to_html(template: &Value, data: &Value) -> String {
    let name = template
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("HPrint");
    format!(
        "<html><body><h1>{}</h1><pre>{}</pre></body></html>",
        name,
        serde_json::to_string_pretty(data).unwrap_or_default()
    )
}
fn html_to_text(html: &str) -> String {
    let mut out = String::with_capacity(html.len());
    let mut tag = false;
    for ch in html.chars() {
        match ch {
            '<' => tag = true,
            '>' => {
                tag = false;
                out.push(' ')
            }
            _ if !tag => out.push(ch),
            _ => {}
        }
    }
    out.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}
fn escpos_text(text: &str) -> Vec<u8> {
    let mut bytes = b"\x1b\x40".to_vec();
    bytes.extend_from_slice(text.as_bytes());
    bytes.extend_from_slice(b"\n\n");
    bytes.extend_from_slice(b"\x1d\x56\x00");
    bytes
}
fn minimal_pdf(text: &str) -> Vec<u8> {
    let safe = text.replace('(', "[").replace(')', "]").replace('\n', " ");
    let objects = [
        "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n",
        "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n",
        "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n",
        &format!(
            "4 0 obj<< /Length {} >>stream\nBT /F1 12 Tf 40 780 Td ({}) Tj ET\nendstream endobj\n",
            safe.len() + 34,
            safe
        ),
        "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n",
    ];
    let mut pdf = b"%PDF-1.4\n".to_vec();
    let mut offsets = vec![0usize];
    for object in objects {
        offsets.push(pdf.len());
        pdf.extend_from_slice(object.as_bytes())
    }
    let xref = pdf.len();
    pdf.extend_from_slice(format!("xref\n0 {}\n0000000000 65535 f \n", offsets.len()).as_bytes());
    for offset in offsets.iter().skip(1) {
        pdf.extend_from_slice(format!("{:010} 00000 n \n", offset).as_bytes())
    }
    pdf.extend_from_slice(
        format!(
            "trailer<< /Size {} /Root 1 0 R >>\nstartxref\n{}\n%%EOF",
            offsets.len(),
            xref
        )
        .as_bytes(),
    );
    pdf
}
