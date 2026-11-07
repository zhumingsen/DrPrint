use std::io;

#[derive(Clone, Debug)]
pub struct SystemPrinter {
    pub name: String,
    pub is_default: bool,
    pub status: String,
    pub driver_name: String,
    pub port_name: String,
}

#[cfg(windows)]
pub fn list_printers() -> Vec<SystemPrinter> {
    match list_printers_winspool() {
        Ok(items) if !items.is_empty() => items,
        _ => list_printers_powershell(),
    }
}

#[cfg(windows)]
fn list_printers_winspool() -> io::Result<Vec<SystemPrinter>> {
    use std::ptr;

    const PRINTER_ENUM_LOCAL: u32 = 0x00000002;
    const PRINTER_ENUM_CONNECTIONS: u32 = 0x00000004;

    #[repr(C)]
    struct PrinterInfo2W {
        server_name: *mut u16,
        printer_name: *mut u16,
        share_name: *mut u16,
        port_name: *mut u16,
        driver_name: *mut u16,
        comment: *mut u16,
        location: *mut u16,
        dev_mode: *mut std::ffi::c_void,
        sep_file: *mut u16,
        print_processor: *mut u16,
        datatype: *mut u16,
        parameters: *mut u16,
        security_descriptor: *mut std::ffi::c_void,
        attributes: u32,
        priority: u32,
        default_priority: u32,
        start_time: u32,
        until_time: u32,
        status: u32,
        c_jobs: u32,
        average_ppm: u32,
    }

    #[link(name = "winspool")]
    unsafe extern "system" {
        fn EnumPrintersW(
            flags: u32,
            name: *mut u16,
            level: u32,
            buffer: *mut u8,
            cb_buf: u32,
            pcb_needed: *mut u32,
            pc_returned: *mut u32,
        ) -> i32;
        fn GetDefaultPrinterW(buffer: *mut u16, pcch_buffer: *mut u32) -> i32;
    }

    fn wide_to_string(ptr: *mut u16) -> String {
        if ptr.is_null() {
            return String::new();
        }
        unsafe {
            let mut len = 0usize;
            while *ptr.add(len) != 0 {
                len += 1;
            }
            String::from_utf16_lossy(std::slice::from_raw_parts(ptr, len))
        }
    }

    let default_name = unsafe {
        let mut size = 0u32;
        let _ = GetDefaultPrinterW(ptr::null_mut(), &mut size);
        if size == 0 {
            String::new()
        } else {
            let mut buf = vec![0u16; size as usize];
            if GetDefaultPrinterW(buf.as_mut_ptr(), &mut size) != 0 {
                String::from_utf16_lossy(&buf[..buf.iter().position(|&c| c == 0).unwrap_or(buf.len())])
            } else {
                String::new()
            }
        }
    };

    unsafe {
        let mut needed = 0u32;
        let mut returned = 0u32;
        let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
        EnumPrintersW(
            flags,
            ptr::null_mut(),
            2,
            ptr::null_mut(),
            0,
            &mut needed,
            &mut returned,
        );
        if needed == 0 {
            return Ok(Vec::new());
        }

        let mut buffer = vec![0u8; needed as usize];
        let ok = EnumPrintersW(
            flags,
            ptr::null_mut(),
            2,
            buffer.as_mut_ptr(),
            needed,
            &mut needed,
            &mut returned,
        );
        if ok == 0 {
            return Err(io::Error::last_os_error());
        }

        let infos = std::slice::from_raw_parts(
            buffer.as_ptr() as *const PrinterInfo2W,
            returned as usize,
        );

        let mut items = Vec::with_capacity(returned as usize);
        for info in infos {
            let name = wide_to_string(info.printer_name);
            if name.is_empty() {
                continue;
            }
            items.push(SystemPrinter {
                is_default: !default_name.is_empty() && name == default_name,
                status: match info.status {
                    0 => "ready",
                    0x00000001 => "paused",
                    0x00000400 => "printing",
                    0x00000080 => "offline",
                    _ => "unknown",
                }
                .to_string(),
                driver_name: wide_to_string(info.driver_name),
                port_name: wide_to_string(info.port_name),
                name,
            });
        }
        Ok(items)
    }
}

/// PowerShell 回退：强制 UTF-8，避免系统 ANSI/GBK 导致 JSON 解析失败后整表为空。
#[cfg(windows)]
fn list_printers_powershell() -> Vec<SystemPrinter> {
    let script = r#"
$ErrorActionPreference='Stop'
$OutputEncoding = [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
Get-Printer |
  Select-Object Name,@{n='Default';e={[bool]$_.Default}},PrinterStatus,DriverName,PortName |
  ConvertTo-Json -Compress
"#;
    let output = std::process::Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .output();
    let Ok(output) = output else {
        return Vec::new();
    };
    if !output.status.success() {
        return Vec::new();
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) else {
        return Vec::new();
    };
    let values = match value {
        serde_json::Value::Array(items) => items,
        object @ serde_json::Value::Object(_) => vec![object],
        _ => return Vec::new(),
    };
    values
        .into_iter()
        .filter_map(|item| {
            let object = item.as_object()?;
            let name = object.get("Name")?.as_str()?.to_string();
            let status = object
                .get("PrinterStatus")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            Some(SystemPrinter {
                is_default: object
                    .get("Default")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false),
                status: match status {
                    0 => "unknown",
                    3 => "idle",
                    4 => "printing",
                    5 => "warming-up",
                    7 => "offline",
                    _ => "ready",
                }
                .to_string(),
                driver_name: object
                    .get("DriverName")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                port_name: object
                    .get("PortName")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                name,
            })
        })
        .collect()
}

#[cfg(not(windows))]
pub fn list_printers() -> Vec<SystemPrinter> {
    Vec::new()
}

#[cfg(windows)]
pub fn write_raw(printer_name: &str, bytes: &[u8], document_name: &str) -> io::Result<usize> {
    use std::ffi::c_void;
    use std::ptr;

    #[repr(C)]
    struct DocInfo {
        name: *mut u16,
        output: *mut u16,
        datatype: *mut u16,
    }

    // 导入库是 winspool.lib（DLL 名为 winspool.drv）
    #[link(name = "winspool")]
    unsafe extern "system" {
        fn OpenPrinterW(name: *mut u16, handle: *mut isize, defaults: *const c_void) -> i32;
        fn ClosePrinter(handle: isize) -> i32;
        fn StartDocPrinterW(handle: isize, level: u32, info: *const DocInfo) -> u32;
        fn EndDocPrinter(handle: isize) -> i32;
        fn StartPagePrinter(handle: isize) -> i32;
        fn EndPagePrinter(handle: isize) -> i32;
        fn WritePrinter(
            handle: isize,
            buffer: *const c_void,
            length: u32,
            written: *mut u32,
        ) -> i32;
    }

    let mut printer_w: Vec<u16> = printer_name.encode_utf16().chain([0]).collect();
    let mut document_w: Vec<u16> = document_name.encode_utf16().chain([0]).collect();
    let mut datatype_w: Vec<u16> = "RAW".encode_utf16().chain([0]).collect();
    let mut handle = 0isize;
    let mut written = 0u32;
    let info = DocInfo {
        name: document_w.as_mut_ptr(),
        output: ptr::null_mut(),
        datatype: datatype_w.as_mut_ptr(),
    };

    unsafe {
        if OpenPrinterW(printer_w.as_mut_ptr(), &mut handle, ptr::null()) == 0 {
            return Err(io::Error::last_os_error());
        }
        let result = (|| {
            if StartDocPrinterW(handle, 1, &info) == 0 {
                return Err(io::Error::last_os_error());
            }
            if StartPagePrinter(handle) == 0 {
                return Err(io::Error::last_os_error());
            }
            let ok = WritePrinter(
                handle,
                bytes.as_ptr() as *const c_void,
                bytes.len().try_into().unwrap_or(u32::MAX),
                &mut written,
            ) != 0;
            let page_result = EndPagePrinter(handle);
            let doc_result = EndDocPrinter(handle);
            if !ok || page_result == 0 || doc_result == 0 {
                return Err(io::Error::last_os_error());
            }
            Ok(written as usize)
        })();
        ClosePrinter(handle);
        result
    }
}

#[cfg(not(windows))]
pub fn write_raw(_printer_name: &str, _bytes: &[u8], _document_name: &str) -> io::Result<usize> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "RAW 打印仅支持 Windows",
    ))
}

/// 描述: 通过 Windows 打印机驱动（GDI）输出 1bit 位图。
/// 适用于 GP 等装了 Windows 驱动、RAW TSPL 会被当成文本狂打的机型。
#[cfg(windows)]
pub fn print_mono_gdi(
    printer_name: &str,
    width: u32,
    height: u32,
    mono: &[u8],
    document_name: &str,
    width_mm: f64,
    height_mm: f64,
) -> io::Result<usize> {
    use std::ffi::c_void;
    use std::mem::size_of;
    use std::ptr;

    #[repr(C)]
    struct DocInfoW {
        cb_size: i32,
        doc_name: *const u16,
        output: *const u16,
        datatype: *const u16,
        fw_type: u32,
    }

    #[repr(C)]
    struct BitmapInfoHeader {
        size: u32,
        width: i32,
        height: i32,
        planes: u16,
        bit_count: u16,
        compression: u32,
        size_image: u32,
        x_pels_per_meter: i32,
        y_pels_per_meter: i32,
        clr_used: u32,
        clr_important: u32,
    }

    #[link(name = "gdi32")]
    unsafe extern "system" {
        fn CreateDCW(
            driver: *const u16,
            device: *const u16,
            port: *const u16,
            init_data: *const c_void,
        ) -> *mut c_void;
        fn DeleteDC(hdc: *mut c_void) -> i32;
        fn StartDocW(hdc: *mut c_void, doc_info: *const DocInfoW) -> i32;
        fn EndDoc(hdc: *mut c_void) -> i32;
        fn StartPage(hdc: *mut c_void) -> i32;
        fn EndPage(hdc: *mut c_void) -> i32;
        fn StretchDIBits(
            hdc: *mut c_void,
            x_dest: i32,
            y_dest: i32,
            dest_width: i32,
            dest_height: i32,
            x_src: i32,
            y_src: i32,
            src_width: i32,
            src_height: i32,
            bits: *const c_void,
            bmi: *const BitmapInfoHeader,
            usage: u32,
            rop: u32,
        ) -> i32;
        fn GetDeviceCaps(hdc: *mut c_void, index: i32) -> i32;
    }

    const HORZRES: i32 = 8;
    const VERTRES: i32 = 10;
    const LOGPIXELSX: i32 = 88;
    const LOGPIXELSY: i32 = 90;
    const DIB_RGB_COLORS: u32 = 0;
    const SRCCOPY: u32 = 0x00CC_0020;
    const BI_RGB: u32 = 0;

    let width_bytes = width.div_ceil(8) as usize;
    let expected = width_bytes * height as usize;
    if mono.len() < expected {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "位图数据长度不足",
        ));
    }

    // 转 24bpp top-down DIB，行对齐 4 字节；1=黑
    let stride = ((width as usize * 3 + 3) / 4) * 4;
    let mut dib = vec![255u8; stride * height as usize];
    for y in 0..height as usize {
        for x in 0..width as usize {
            let bit = (mono[y * width_bytes + x / 8] >> (7 - (x % 8))) & 1;
            if bit == 1 {
                let i = y * stride + x * 3;
                dib[i] = 0;
                dib[i + 1] = 0;
                dib[i + 2] = 0;
            }
        }
    }

    let mut driver = "WINSPOOL\0".encode_utf16().collect::<Vec<u16>>();
    let mut device = printer_name.encode_utf16().chain([0]).collect::<Vec<u16>>();
    let mut doc_name = document_name.encode_utf16().chain([0]).collect::<Vec<u16>>();

    unsafe {
        let hdc = CreateDCW(
            driver.as_mut_ptr(),
            device.as_mut_ptr(),
            ptr::null(),
            ptr::null(),
        );
        if hdc.is_null() {
            return Err(io::Error::last_os_error());
        }

        let result = (|| {
            let info = DocInfoW {
                cb_size: size_of::<DocInfoW>() as i32,
                doc_name: doc_name.as_mut_ptr(),
                output: ptr::null(),
                datatype: ptr::null(),
                fw_type: 0,
            };
            if StartDocW(hdc, &info) <= 0 {
                return Err(io::Error::last_os_error());
            }
            if StartPage(hdc) <= 0 {
                let _ = EndDoc(hdc);
                return Err(io::Error::last_os_error());
            }

            let dpi_x = GetDeviceCaps(hdc, LOGPIXELSX).max(96) as f64;
            let dpi_y = GetDeviceCaps(hdc, LOGPIXELSY).max(96) as f64;
            let page_w = GetDeviceCaps(hdc, HORZRES).max(1);
            let page_h = GetDeviceCaps(hdc, VERTRES).max(1);
            let mut dest_w = ((width_mm.max(1.0) / 25.4) * dpi_x).round() as i32;
            let mut dest_h = ((height_mm.max(1.0) / 25.4) * dpi_y).round() as i32;
            dest_w = dest_w.clamp(1, page_w);
            dest_h = dest_h.clamp(1, page_h);

            let header = BitmapInfoHeader {
                size: size_of::<BitmapInfoHeader>() as u32,
                width: width as i32,
                height: -(height as i32), // top-down
                planes: 1,
                bit_count: 24,
                compression: BI_RGB,
                size_image: dib.len() as u32,
                x_pels_per_meter: 0,
                y_pels_per_meter: 0,
                clr_used: 0,
                clr_important: 0,
            };

            let drawn = StretchDIBits(
                hdc,
                0,
                0,
                dest_w,
                dest_h,
                0,
                0,
                width as i32,
                height as i32,
                dib.as_ptr() as *const c_void,
                &header,
                DIB_RGB_COLORS,
                SRCCOPY,
            );
            let page_ok = EndPage(hdc) > 0;
            let doc_ok = EndDoc(hdc) > 0;
            if drawn == 0 || !page_ok || !doc_ok {
                return Err(io::Error::last_os_error());
            }
            Ok((dest_w * dest_h) as usize)
        })();

        DeleteDC(hdc);
        result
    }
}

#[cfg(not(windows))]
pub fn print_mono_gdi(
    _printer_name: &str,
    _width: u32,
    _height: u32,
    _mono: &[u8],
    _document_name: &str,
    _width_mm: f64,
    _height_mm: f64,
) -> io::Result<usize> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "GDI 打印仅支持 Windows",
    ))
}

#[cfg(all(test, windows))]
mod tests {
    use super::list_printers;

    #[test]
    fn list_printers_not_empty_on_dev_machine() {
        let items = list_printers();
        assert!(
            !items.is_empty(),
            "本机应能枚举到打印机，实际为 0（检查 winspool / PowerShell 回退）"
        );
        for item in &items {
            assert!(!item.name.is_empty());
        }
    }
}
