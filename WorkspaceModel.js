// Read numeric workspace assignments without creating any workspaces.
function parseAssignments(text) {
  var rules = JSON.parse(text)
  if (!Array.isArray(rules)) throw new Error("Expected a workspace-rule array")

  var assignments = {}
  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i]
    if (!rule || rule.enabled === false || typeof rule.monitor !== "string") continue
    var selector = String(rule.workspaceString || "")
    if (!/^(?:[1-9]|10)$/.test(selector) || rule.monitor === "") continue
    assignments[Number(selector)] = rule.monitor
  }
  return assignments
}

function activeMonitors(monitors) {
  return monitors.filter(function(monitor) {
    return monitor && monitor.name && monitor.disabled !== true
      && (!monitor.mirrorOf || monitor.mirrorOf === "none")
  })
}

function matchesMonitor(selector, monitor) {
  if (selector === monitor.name || selector === String(monitor.id)) return true
  if (selector.indexOf("desc:") === 0) {
    return String(monitor.description || "").indexOf(selector.slice(5)) === 0
  }
  return false
}

function workspaceIds(monitorName, monitors, assignments, workspaces) {
  var active = activeMonitors(monitors)
  var host = active.find(function(monitor) { return monitor.name === monitorName })
  if (!host) return []

  var ids = []
  for (var id = 1; id <= 10; id++) {
    if (active.length === 1) {
      ids.push(id)
      continue
    }

    var selector = assignments[id]
    var owner = selector ? active.find(function(monitor) {
      return matchesMonitor(selector, monitor)
    }) : null

    // Unassigned workspaces, or ones whose assigned output is absent, follow
    // their live monitor. Empty ones fall back to one output, not every bar.
    if (!owner) {
      var workspace = workspaces.find(function(workspace) { return workspace.id === id })
      var liveName = workspace && workspace.monitor ? workspace.monitor.name : ""
      owner = active.find(function(monitor) { return monitor.name === liveName }) || active[0]
    }

    if (owner.name === monitorName) ids.push(id)
  }
  return ids
}

function workspaceLabel(id) {
  return id === 10 ? "0" : String(id)
}
