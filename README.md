# Legacy Workspace Plus

Legacy Workspace Plus is an Omarchy bar widget based on the legacy workspace
widget. It displays one global set of workspaces, numbered 1 through 10, with
monitor-aware workspace lists.

It is for people who prefer the older workspace model and assign specific
workspaces to specific monitors. For example, you might keep your browser and
work on workspaces 1–5 on an external display, with communication, music, and
other applications on workspaces 6–10 on your laptop screen.

The widget reads those assignments from Hyprland. There is no second mapping to
maintain in the plugin, and switching keyboard focus does not change which
workspace numbers belong on each bar.

## What Plus adds

- Each monitor's bar shows only the workspace numbers assigned to that monitor.
- All ten numbers appear on the remaining display when only one independent
  monitor is active.
- Empty assigned workspaces remain visible, so you can click them before opening
  an application.
- Each bar marks its own monitor's active workspace, even when another monitor
  has keyboard focus.
- Workspace assignments refresh after configuration reloads and display changes.

Workspace 10 is labelled `0`, matching the number-row shortcut. The active
workspace uses the original widget's marker, and empty inactive workspaces are
shown dimmed.

For a configuration assigning 1–5 to an external monitor and 6–10 to a laptop:

| Active displays | External bar | Laptop bar |
| --- | --- | --- |
| Both | `1 2 3 4 5` | `6 7 8 9 0` |
| External only | `1 2 3 4 5 6 7 8 9 0` | Not displayed |
| Laptop only | Not displayed | `1 2 3 4 5 6 7 8 9 0` |

The widget changes what the bar displays. It does not move windows, renumber
workspaces, or install keyboard shortcuts. Clicking a number focuses that global
workspace through Hyprland.

## Requirements

- Omarchy's Quickshell-based shell and its bundled QML components.
- A Hyprland configuration using global workspace numbers 1–10.
- `hyprctl` with JSON output for `workspacerules`.

The current implementation has been used on Omarchy 4.5.0 with Hyprland 0.56.2.
It is not a standalone widget for other bars or desktop environments. Node.js is
needed only to run the tests.

### Omarchy 4.5 compatibility

**Installing this widget does not disable Omarchy 4.5's per-monitor workspace
manager.** That manager assigns each monitor its own block of ten workspace IDs.
This widget is intended for a global set of ten instead.

If you already restored global workspaces, keep that configuration. Otherwise,
back up your Hyprland configuration and configure global workspace handling
before using this widget. Do not edit packaged files under
`/usr/share/omarchy/`.

The following compatibility override replaces the workspace actions and skips
the per-monitor manager in Omarchy 4.5.0. Put it in your user configuration after
the Omarchy bootstrap and **before** `require("default.hypr.omarchy")`, or load it
from a personal Lua file at that point:

```lua
package.preload["default.hypr.monitor-workspaces"] = function()
  local workspaces = {}

  function workspaces.focus(id)
    return hl.dsp.focus({ workspace = tostring(id) })
  end

  function workspaces.move_window(id, follow)
    return hl.dsp.window.move({
      workspace = tostring(id),
      follow = follow ~= false,
    })
  end

  function workspaces.move_to_monitor(direction)
    return hl.dsp.workspace.move({ monitor = direction })
  end

  function workspaces.move_window_to_monitor(direction)
    return hl.dsp.window.move({ monitor = direction })
  end

  o.workspaces = workspaces
  return workspaces
end
```

This override relies on an internal Omarchy module name. Review it after future
Omarchy updates. It affects the default number-key and monitor-move actions, but
does not change workspace-cycling shortcuts such as Super+Tab.

## Configure workspace assignments

Keep your assignments in your personal Hyprland configuration, loaded after
Omarchy's defaults. For example:

```lua
for id = 1, 5 do
  hl.workspace_rule({
    workspace = tostring(id),
    monitor = "DP-1",
    default = id == 1,
  })
end

for id = 6, 10 do
  hl.workspace_rule({
    workspace = tostring(id),
    monitor = "eDP-1",
    default = id == 6,
  })
end
```

Replace the monitor names with those reported by `hyprctl monitors`. If you
already have workspace rules, update those rather than adding competing rules.
You can keep layout and application-placement rules alongside them.

Reload and check the configuration:

```bash
hyprctl reload
hyprctl configerrors
hyprctl -j workspacerules
```

Existing workspaces that were renumbered by the per-monitor manager are not
renumbered back by the widget. Move their windows into your intended workspaces
or save your work and start a fresh graphical session.

## Install locally

Clone the repository and enter its directory:

```bash
git clone https://github.com/tom-jagus/legacy-workspace-plus.git
cd legacy-workspace-plus
```

Copy the plugin files into your user plugin directory:

```bash
plugin_dir="$HOME/.config/omarchy/plugins/tomjagus.legacy-workspace-plus"
mkdir -p "$plugin_dir"
cp manifest.json Workspaces.qml WorkspaceModel.js THIRD_PARTY_NOTICES.md "$plugin_dir/"
omarchy-shell shell rescanPlugins
omarchy plugin enable tomjagus.legacy-workspace-plus --section left
```

The manifest identifies this as a clone of `omarchy.workspaces`, allowing the
shell to replace the built-in widget with this one. The installed plugin ID is
`tomjagus.legacy-workspace-plus`; its display name is **Legacy Workspace Plus**.

Installation copies the files rather than linking them. After changing the
source, repeat the copy command to update the installed version. User plugin
files reload automatically when saved.

To return to the built-in widget:

```bash
omarchy plugin disable tomjagus.legacy-workspace-plus
omarchy plugin enable omarchy.workspaces
```

This does not undo your Hyprland configuration. The current built-in widget
expects Omarchy's per-monitor workspace model, so restore matching workspace
handling separately if you return to the stock setup.

## Behaviour and limits

- The widget supports numeric workspace rules for IDs 1–10. Named workspaces,
  special workspaces, and IDs above 10 are not displayed.
- Assignments can identify monitors by connector name, numeric monitor ID, or a
  `desc:` description prefix. Connector names can change when using a dock.
- When multiple monitors are active, a configured assignment takes precedence
  over a workspace temporarily located on another monitor.
- If a workspace has no assignment, or its assigned monitor is absent, its
  current monitor determines where it appears. If it does not yet exist and
  has no available assigned monitor, it falls back to the first available
  independent monitor.
- Disabled and mirrored outputs do not count as independent monitors. Display
  power-saving through DPMS alone is not the same as disabling an output.
- The plugin reads assignments when it starts, after a configuration reload, and
  when the display setup changes. It does not continuously poll workspace rules.

## Run the tests

From the source directory:

```bash
node --test tests/workspace-model.test.cjs
```

The tests exercise workspace filtering without a compositor, including empty
workspaces, one-display fallback, reconnection, assignment changes, mirrored
outputs, and the `0` label. They do not replace testing the visible widget and
physical monitor changes in an Omarchy session.

## Attribution

The original workspace widget comes from [Omarchy](https://omarchy.org/).
Legacy Workspace Plus extends that widget with monitor-aware filtering,
single-monitor fallback, and per-monitor active-workspace indicators. It is a
community extension, not an official Omarchy plugin.

The inherited Omarchy code is covered by the upstream MIT licence reproduced
in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). A licence for the new
additions has not yet been declared.
