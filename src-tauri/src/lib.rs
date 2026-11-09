mod agent_server;
mod printer;
mod raster;

use std::path::PathBuf;
use std::sync::{Arc, atomic::AtomicU16};
use tauri::{
    Manager, WindowEvent,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

pub struct AgentPort(pub Arc<AtomicU16>);

#[tauri::command]
fn get_agent_port(state: tauri::State<'_, AgentPort>) -> u16 {
    state.0.load(std::sync::atomic::Ordering::Relaxed)
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let port = Arc::new(AtomicU16::new(0));
    let port_for_server = Arc::clone(&port);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AgentPort(port))
        .invoke_handler(tauri::generate_handler![get_agent_port])
        .setup(move |app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("hprint-agent-data"));
            let state = agent_server::AgentState::new(data_dir);
            tauri::async_runtime::spawn(agent_server::serve(state, port_for_server));

            // 托盘：右键菜单退出；左键唤起主窗口；关窗隐藏到托盘
            let show_i = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &sep, &quit_i])?;

            let icon = app
                .default_window_icon()
                .cloned()
                .expect("缺少默认窗口图标，请检查 tauri.conf.json bundle.icon");

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(icon)
                .tooltip("HPrint Agent")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // 点关闭：隐藏到托盘，保持 Agent 服务继续跑
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
