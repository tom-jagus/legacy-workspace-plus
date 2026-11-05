import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Hyprland
import Quickshell.Io
import qs.Commons
import qs.Ui
import "WorkspaceModel.js" as WorkspaceModel

BarWidget {
  id: root
  moduleName: "omarchy.workspaces"

  // Resolve this bar's output, never whichever monitor currently has focus.
  readonly property var monitor: {
    var window = root.QsWindow.window
    return window && window.screen ? Hyprland.monitorFor(window.screen) : null
  }
  readonly property string monitorName: monitor ? monitor.name : ""
  property var assignments: ({})
  property bool rulesPending: false

  function refreshRules() {
    root.rulesPending = true
    rulesTimer.restart()
  }

  Timer {
    id: rulesTimer
    interval: 50
    onTriggered: {
      if (rulesProc.running) return
      root.rulesPending = false
      rulesProc.running = true
    }
  }

  Process {
    id: rulesProc
    command: ["hyprctl", "-j", "workspacerules"]
    stdout: StdioCollector { id: rulesOutput }
    onExited: function(exitCode) {
      if (exitCode === 0) {
        try {
          root.assignments = WorkspaceModel.parseAssignments(rulesOutput.text)
        } catch (error) {
          console.warn("Legacy workspaces: cannot read assignments:", error)
        }
      } else {
        console.warn("Legacy workspaces: hyprctl workspacerules failed:", exitCode)
      }
      if (root.rulesPending) rulesTimer.restart()
    }
  }

  Component.onCompleted: refreshRules()

  Connections {
    target: Quickshell
    function onScreensChanged() {
      Hyprland.refreshMonitors()
      Hyprland.refreshWorkspaces()
      root.refreshRules()
    }
  }

  Connections {
    target: Hyprland
    function onRawEvent(event) {
      var name = event ? String(event.name) : ""
      if (name === "configreloaded" || name === "monitoradded" || name === "monitoraddedv2"
          || name === "monitorremoved" || name === "monitorremovedv2") {
        Hyprland.refreshMonitors()
        Hyprland.refreshWorkspaces()
        root.refreshRules()
      } else if ((name === "workspacev2" && root.monitor && root.monitor.focused)
          || name === "moveworkspacev2" || name === "changeworkspaceid") {
        // Quickshell can otherwise leave the unfocused monitor's active
        // workspace stale after a workspace moves between displays.
        Hyprland.refreshMonitors()
        Hyprland.refreshWorkspaces()
      }
    }
  }

  function workspaceById(id) {
    var values = Hyprland.workspaces.values
    for (var i = 0; i < values.length; i++) {
      if (values[i].id === id) return values[i]
    }

    return null
  }

  function workspaceIds() {
    var monitors = []
    var values = Hyprland.monitors.values
    for (var i = 0; i < values.length; i++) {
      var monitor = values[i]
      var ipc = monitor.lastIpcObject || {}
      monitors.push({
        name: monitor.name,
        id: monitor.id,
        description: monitor.description,
        disabled: ipc.disabled === true,
        mirrorOf: ipc.mirrorOf || "none"
      })
    }

    var workspaces = []
    values = Hyprland.workspaces.values
    for (var j = 0; j < values.length; j++) {
      workspaces.push({ id: values[j].id, monitor: values[j].monitor })
    }
    return WorkspaceModel.workspaceIds(root.monitorName, monitors, root.assignments, workspaces)
  }

  function focusWorkspace(id) {
    if (!root.bar) return
    root.bar.run("hyprctl dispatch " + Util.shellQuote("hl.dsp.focus({ workspace = \"" + id + "\" })"))
  }

  readonly property real trailingGap: root.vertical ? 0 : Style.spaceReal(1.5)

  implicitWidth: grid.implicitWidth + trailingGap
  implicitHeight: grid.implicitHeight

  GridLayout {
    id: grid
    anchors.fill: parent
    anchors.rightMargin: root.trailingGap
    columns: root.vertical ? 1 : root.workspaceIds().length
    columnSpacing: root.vertical ? 0 : Style.space(1)
    rowSpacing: root.vertical ? Style.space(2) : 0

    Repeater {
      model: root.workspaceIds()

      WidgetButton {
        required property int modelData

        readonly property var workspace: root.workspaceById(modelData)
        readonly property bool occupied: workspace !== null && workspace.toplevels.values.length > 0
        readonly property bool focused: root.monitor !== null && root.monitor.activeWorkspace !== null
          && root.monitor.activeWorkspace.id === modelData

        bar: root.bar
        text: focused ? "\uDB85\uDCFB" : WorkspaceModel.workspaceLabel(modelData)
        opacity: occupied || focused ? 1 : 0.5
        horizontalMargin: 6
        verticalPadding: 6
        fixedWidth: root.vertical ? root.barSize : Style.space(20)
        fixedHeight: root.barSize
        onPressed: function() { root.focusWorkspace(modelData) }
      }
    }
  }
}
