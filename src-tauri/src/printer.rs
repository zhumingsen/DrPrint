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
    let script = r#"$ErrorActionPreference='Stop'; Get-Printer | Select-Object Name,Default,PrinterStatus,DriverName,PortName | ConvertTo-Json -Compress"#;
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
    let Ok(value) = serde_json::from_slice::<serde_json::Value>(&output.stdout) else {
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

    #[link(name = "winspool.drv")]
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
