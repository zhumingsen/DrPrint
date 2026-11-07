mod agent_server;
mod printer;
mod raster;

use std::path::PathBuf;
use std::sync::{Arc, atomic::AtomicU16};
use tauri::Manager;

pub struct AgentPort(pub Arc<AtomicU16>);

#[tauri::command]
fn get_agent_port(state: tauri::State<'_, AgentPort>) -> u16 {
    state.0.load(std::sync::atomic::Ordering::Relaxed)
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
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
