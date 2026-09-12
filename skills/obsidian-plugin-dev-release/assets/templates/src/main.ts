import { App, Notice, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";
import { exec, spawn } from "child_process";
import * as nodePath from "path";
import * as fs from "fs";

interface MySettings {
  executable: string;
  debug: boolean;
}

const DEFAULT_SETTINGS: MySettings = {
  executable: "",
  debug: false,
};

function quote(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

export default class MyPlugin extends Plugin {
  settings: MySettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: "open-current-file",
      name: "Open the current file",
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) void this.launch(this.absPath(file));
        return true;
      },
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof TFile)) return;
        menu.addItem((item) =>
          item
            .setTitle("Open externally")
            .setIcon("file-code")
            .onClick(() => void this.launch(this.absPath(file)))
        );
      })
    );

    this.addRibbonIcon("file-code", "Open the current file", () => {
      const file = this.app.workspace.getActiveFile();
      if (!file) {
        new Notice("No active file.");
        return;
      }
      void this.launch(this.absPath(file));
    });

    this.addSettingTab(new MySettingTab(this.app, this));
  }

  vaultPath(): string {
    const adapter = this.app.vault.adapter as { getBasePath?: () => string };
    return adapter.getBasePath?.() ?? "";
  }

  absPath(file: TFile): string {
    return nodePath.join(this.vaultPath(), file.path);
  }

  /** The value the user configured, before any correction. */
  rawExecutable(): string {
    return (this.settings.executable ?? "").trim() || "code";
  }

  /**
   * Resolve to something that can actually be spawned.
   * Never spawn a bare command name: the Electron child shell lacks PATHEXT on
   * Windows, so "cmd /c code" fails with exit code 9009.
   */
  resolveExecutable(): Promise<string | null> {
    return new Promise((resolve) => {
      const exe = this.rawExecutable();

      if (nodePath.isAbsolute(exe)) {
        try {
          resolve(fs.existsSync(exe) ? exe : null);
        } catch {
          resolve(null);
        }
        return;
      }

      const probe =
        process.platform === "win32"
          ? `where "${exe}" 2>nul`
          : `command -v "${exe}" 2>/dev/null`;

      exec(probe, (_err, stdout) => {
        const lines = (stdout ?? "")
          .trim()
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        if (!lines.length) {
          resolve(null);
          return;
        }
        const script = lines.find((line) => /\.(cmd|bat)$/i.test(line));
        resolve(script ?? lines[0]);
      });
    });
  }

  async launch(target: string): Promise<void> {
    const exe = await this.resolveExecutable();
    if (!exe) {
      new Notice(
        `Cannot find "${this.rawExecutable()}". Set a full absolute path in the plugin settings.`,
        15000
      );
      return;
    }

    const commandLine = [quote(exe), quote(target)].join(" ");
    if (this.settings.debug) {
      console.log("[my-plugin] commandLine =", commandLine);
    }

    const child = spawn(commandLine, {
      shell: true,
      detached: true,
      stdio: this.settings.debug ? "inherit" : "ignore",
      windowsHide: true,
    });

    child.on("error", (err: Error) => {
      new Notice(`Could not start: ${err.message}`);
    });

    if (this.settings.debug) {
      child.on("exit", (code) => {
        console.log("[my-plugin] child exited with code", code);
      });
    }

    child.unref();
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}

class MySettingTab extends PluginSettingTab {
  private plugin: MyPlugin;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Executable")
      .setDesc("A command name on PATH, or a full absolute path.")
      .addText((text) =>
        text
          .setPlaceholder("code")
          .setValue(this.plugin.settings.executable)
          .onChange(async (value) => {
            this.plugin.settings.executable = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Debug logging")
      .setDesc("Logs the resolved command line and the exit code.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.debug).onChange(async (value) => {
          this.plugin.settings.debug = value;
          await this.plugin.saveSettings();
        })
      );
  }
}
