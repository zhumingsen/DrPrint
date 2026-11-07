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

/// 强制页面按目标点阵尺寸渲染，避免屏幕 DPI 下标签过小。
fn wrap_html_for_raster(html: &str, width_px: u32, height_px: u32) -> String {
    format!(
        r#"<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
html, body {{
  margin: 0 !important;
  padding: 0 !important;
  width: {width_px}px !important;
  height: {height_px}px !important;
  overflow: hidden !important;
  background: #ffffff !important;
}}
body > * {{
  transform-origin: top left;
}}
</style>
</head>
<body>
<div id="hprint-raster-root" style="width:{width_px}px;height:{height_px}px;overflow:hidden;position:relative;">
{html}
</div>
<script>
(function () {{
  var root = document.getElementById('hprint-raster-root');
  var paper = root.querySelector('.hprint-paper') || root.firstElementChild;
  if (!paper) return;
  var rect = paper.getBoundingClientRect();
  var sw = rect.width || paper.offsetWidth || {width_px};
  var sh = rect.height || paper.offsetHeight || {height_px};
  if (sw < 1 || sh < 1) return;
  var sx = {width_px} / sw;
  var sy = {height_px} / sh;
  var scale = Math.min(sx, sy);
  paper.style.transformOrigin = 'top left';
  paper.style.transform = 'scale(' + scale + ')';
}})();
</script>
</body>
</html>"#,
        html = extract_body(html),
        width_px = width_px,
        height_px = height_px
    )
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

    let width_px = ((width_mm * 203.0 / 25.4).round() as u32).max(8);
    let height_px = ((height_mm * 203.0 / 25.4).round() as u32).max(8);
    let (html_path, png_path) = temp_pair("job")?;
    let wrapped = wrap_html_for_raster(html, width_px, height_px);
    fs::write(&html_path, wrapped)?;

    // file URL
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

    // headless 有时异步落盘，短暂等待
    for _ in 0..20 {
        if png_path.exists() && fs::metadata(&png_path).map(|m| m.len() > 0).unwrap_or(false) {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(50));
    }

    let result = read_png_mono(&png_path, threshold);
    let _ = fs::remove_file(&html_path);
    let _ = fs::remove_file(&png_path);
    result
}

fn read_png_mono(path: &Path, threshold: u8) -> io::Result<MonoRaster> {
    let img = image::open(path)
        .map_err(|e| io::Error::other(format!("读取截图失败: {e}")))?
        .to_rgba8();
    Ok(rgba_to_mono(&img, threshold))
}
