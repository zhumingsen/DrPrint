//! 描述：把客户端提交的 HTML 渲成 1bit 位图（Edge 无头截图），供标签/小票 raw-raster 出纸

use std::{
    fs,
    io,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Clone, Debug)]
pub struct MonoRaster {
    pub width: u32,
    pub height: u32,
    pub bytes: Vec<u8>,
}

fn find_edge() -> Option<PathBuf> {
    const CANDIDATES: &[&str] = &[
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ];
    CANDIDATES.iter().map(PathBuf::from).find(|p| p.exists())
}

fn temp_pair(prefix: &str) -> io::Result<(PathBuf, PathBuf)> {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let dir = std::env::temp_dir().join("hprint-raster");
    fs::create_dir_all(&dir)?;
    let html = dir.join(format!("{prefix}-{stamp}.html"));
    let png = dir.join(format!("{prefix}-{stamp}.png"));
    Ok((html, png))
}

/// 从模板 HTML 里猜原始纸张像素（客户端通常按 ~96DPI 渲染）
fn detect_source_px(html: &str) -> Option<(f64, f64)> {
    // 优先 .hprint-paper { width:xxpx; height:yypx }
    let lower = html.to_lowercase();
    let search_regions = [
        ".hprint-paper",
        "body",
        "html, body",
        "html,body",
    ];
    for marker in search_regions {
        if let Some(idx) = lower.find(marker) {
            let slice = &html[idx..html.len().min(idx + 500)];
            if let (Some(w), Some(h)) = (extract_px(slice, "width"), extract_px(slice, "height")) {
                if w > 8.0 && h > 8.0 {
                    return Some((w, h));
                }
            }
        }
    }
    // 退路：全文第一处成对 width/height px
    if let (Some(w), Some(h)) = (extract_px(html, "width"), extract_px(html, "height")) {
        if w > 8.0 && h > 8.0 {
            return Some((w, h));
        }
    }
    None
}

fn extract_px(text: &str, prop: &str) -> Option<f64> {
    let lower = text.to_lowercase();
    let key = format!("{prop}:");
    let mut start = 0usize;
    while let Some(rel) = lower[start..].find(&key) {
        let abs = start + rel + key.len();
        let rest = text[abs..].trim_start();
        let num: String = rest
            .chars()
            .take_while(|c| c.is_ascii_digit() || *c == '.')
            .collect();
        let after = rest[num.len()..].trim_start().to_lowercase();
        if after.starts_with("px") {
            if let Ok(v) = num.parse::<f64>() {
                return Some(v);
            }
        }
        start = abs;
    }
    None
}

fn extract_body(html: &str) -> String {
    if let Some(start) = html.find("<body") {
        if let Some(gt) = html[start..].find('>') {
            let body_start = start + gt + 1;
            if let Some(end_rel) = html[body_start..].to_lowercase().find("</body>") {
                return html[body_start..body_start + end_rel].to_string();
            }
            return html[body_start..].to_string();
        }
    }
    html.to_string()
}

fn extract_style(html: &str) -> String {
    if let Some(start) = html.to_lowercase().find("<style") {
        if let Some(gt) = html[start..].find('>') {
            let style_start = start + gt + 1;
            if let Some(end_rel) = html[style_start..].to_lowercase().find("</style>") {
                return html[style_start..style_start + end_rel].to_string();
            }
        }
    }
    String::new()
}

/// 用 CSS zoom 把 ~96DPI 页面放大到打印机点阵，不依赖截图前 JS 是否执行。
fn wrap_html_for_raster(html: &str, width_px: u32, height_px: u32) -> String {
    let body = extract_body(html);
    let style = extract_style(html);
    let (src_w, src_h) = detect_source_px(html).unwrap_or_else(|| {
        // 找不到时按 96DPI 反推
        let mm_w = width_px as f64 * 25.4 / 203.0;
        let mm_h = height_px as f64 * 25.4 / 203.0;
        (mm_w * 96.0 / 25.4, mm_h * 96.0 / 25.4)
    });
    let zoom = (width_px as f64 / src_w)
        .min(height_px as f64 / src_h)
        .max(0.1);

    format!(
        r#"<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
{style}
html, body {{
  margin: 0 !important;
  padding: 0 !important;
  width: {width_px}px !important;
  height: {height_px}px !important;
  overflow: hidden !important;
  background: #ffffff !important;
}}
#hprint-zoom {{
  zoom: {zoom};
  width: {src_w}px;
  height: {src_h}px;
  transform-origin: top left;
  overflow: hidden;
}}
.hprint-paper {{
  margin: 0 !important;
}}
</style>
</head>
<body>
<div id="hprint-zoom">{body}</div>
</body>
</html>"#,
        style = style,
        width_px = width_px,
        height_px = height_px,
        zoom = zoom,
        src_w = src_w,
        src_h = src_h,
        body = body
    )
}

fn rgba_to_mono(img: &image::RgbaImage, threshold: u8) -> MonoRaster {
    let (width, height) = img.dimensions();
    let width_bytes = width.div_ceil(8);
    let mut bytes = vec![0u8; (width_bytes * height) as usize];
    for y in 0..height {
        for x in 0..width {
            let px = img.get_pixel(x, y).0;
            let gray = if px[3] < 16 {
                255u8
            } else {
                ((0.299 * px[0] as f32) + (0.587 * px[1] as f32) + (0.114 * px[2] as f32)) as u8
            };
            if gray < threshold {
                let idx = (y * width_bytes + x / 8) as usize;
                bytes[idx] |= 0x80 >> (x % 8);
            }
        }
    }
    MonoRaster {
        width,
        height,
        bytes,
    }
}

/// 描述: HTML → 1bit 位图（Edge headless screenshot）
pub fn html_to_mono_raster(
    html: &str,
    width_mm: f64,
    height_mm: f64,
    threshold: u8,
) -> io::Result<MonoRaster> {
    let edge = find_edge().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::NotFound,
            "未找到 Microsoft Edge，无法将 HTML 渲染为标签位图",
        )
    })?;

    // 标签机常见 203DPI；按纸张毫米换算目标点阵，保证打满标签
    let width_px = ((width_mm * 203.0 / 25.4).round() as u32).max(8);
    let height_px = ((height_mm * 203.0 / 25.4).round() as u32).max(8);
    let (html_path, png_path) = temp_pair("job")?;
    let wrapped = wrap_html_for_raster(html, width_px, height_px);
    fs::write(&html_path, wrapped)?;

    let file_url = format!(
        "file:///{}",
        html_path
            .to_string_lossy()
            .replace('\\', "/")
            .replace(' ', "%20")
    );

    let status = Command::new(&edge)
        .args([
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--force-device-scale-factor=1",
            "--run-all-compositor-stages-before-draw",
            "--virtual-time-budget=3000",
            &format!("--window-size={width_px},{height_px}"),
            &format!("--screenshot={}", png_path.to_string_lossy()),
            &file_url,
        ])
        .status()?;

    if !status.success() {
        let _ = fs::remove_file(&html_path);
        return Err(io::Error::other(format!(
            "Edge 截图失败，exit={status}"
        )));
    }

    for _ in 0..40 {
        if png_path.exists() && fs::metadata(&png_path).map(|m| m.len() > 0).unwrap_or(false) {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(50));
    }

    let result = read_png_mono(&png_path, width_px, height_px, threshold);
    let _ = fs::remove_file(&html_path);
    let _ = fs::remove_file(&png_path);
    result
}

fn read_png_mono(
    path: &Path,
    target_w: u32,
    target_h: u32,
    threshold: u8,
) -> io::Result<MonoRaster> {
    let img = image::open(path)
        .map_err(|e| io::Error::other(format!("读取截图失败: {e}")))?
        .to_rgba8();

    // Edge 偶发截出与窗口不一致的尺寸，统一缩放到目标点阵，避免标签内容偏小/偏大
    let rgba = if img.width() != target_w || img.height() != target_h {
        image::imageops::resize(
            &img,
            target_w,
            target_h,
            image::imageops::FilterType::Triangle,
        )
    } else {
        img
    };
    Ok(rgba_to_mono(&rgba, threshold))
}
