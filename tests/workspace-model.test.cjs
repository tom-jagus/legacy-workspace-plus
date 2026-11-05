const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// Exercise the same plain JavaScript that QML imports, without a compositor.
const model = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'WorkspaceModel.js'), 'utf8'), model);

const laptop = { id: 0, name: 'eDP-1', description: 'Laptop panel' };
const external = { id: 1, name: 'DP-1', description: 'External display 123' };
const monitors = [laptop, external];
const all = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const rules = all.map(id => ({
  workspaceString: String(id), enabled: true, monitor: id <= 5 ? 'DP-1' : 'eDP-1'
}));
const assignments = model.parseAssignments(JSON.stringify(rules));
const ids = (name, outputs = monitors, mapping = assignments, workspaces = []) =>
  Array.from(model.workspaceIds(name, outputs, mapping, workspaces));

test('both monitors show all assigned numbers, including empty workspaces', () => {
  assert.deepEqual(ids('DP-1'), [1, 2, 3, 4, 5]);
  assert.deepEqual(ids('eDP-1'), [6, 7, 8, 9, 10]);
});

test('the result depends on the host monitor, not pointer focus or output order', () => {
  assert.deepEqual(ids('DP-1', [{ ...external, focused: false }, { ...laptop, focused: true }]), [1, 2, 3, 4, 5]);
  assert.deepEqual(ids('eDP-1', [{ ...external, focused: true }, { ...laptop, focused: false }]), [6, 7, 8, 9, 10]);
});

test('disconnecting the external monitor shows all ten on the laptop', () => {
  assert.deepEqual(ids('eDP-1', [laptop]), all);
});

test('disabling the laptop shows all ten on the external monitor', () => {
  assert.deepEqual(ids('DP-1', [external, { ...laptop, disabled: true }]), all);
  assert.deepEqual(ids('eDP-1', [external, { ...laptop, disabled: true }]), []);
});

test('an external-only monitor list also shows all ten', () => {
  assert.deepEqual(ids('DP-1', [external]), all);
});

test('reconnecting the external monitor restores the split without changing assignments', () => {
  assert.deepEqual(ids('eDP-1', [laptop]), all);
  assert.deepEqual(ids('eDP-1'), [6, 7, 8, 9, 10]);
  assert.deepEqual(ids('DP-1'), [1, 2, 3, 4, 5]);
});

test('mirrored outputs do not count as independent displays', () => {
  assert.deepEqual(ids('eDP-1', [laptop, { ...external, mirrorOf: 'eDP-1' }]), all);
  assert.deepEqual(ids('DP-1', [laptop, { ...external, mirrorOf: 'eDP-1' }]), []);
});

test('a changed Hyprland assignment moves the number to the other bar', () => {
  const changed = model.parseAssignments(JSON.stringify([
    ...rules, { workspaceString: '5', enabled: true, monitor: 'eDP-1' }
  ]));
  assert.deepEqual(ids('DP-1', monitors, changed), [1, 2, 3, 4]);
  assert.deepEqual(ids('eDP-1', monitors, changed), [5, 6, 7, 8, 9, 10]);
});

test('configured ownership wins over a workspace temporarily on another monitor', () => {
  const workspaces = [{ id: 2, monitor: laptop }];
  assert.deepEqual(ids('DP-1', monitors, assignments, workspaces), [1, 2, 3, 4, 5]);
  assert.deepEqual(ids('eDP-1', monitors, assignments, workspaces), [6, 7, 8, 9, 10]);
});

test('unassigned workspaces follow live ownership, with one fallback for empty ones', () => {
  const workspaces = [{ id: 2, monitor: external }];
  assert.deepEqual(ids('DP-1', monitors, {}, workspaces), [2]);
  assert.deepEqual(ids('eDP-1', monitors, {}, workspaces), [1, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('an absent assigned output falls back to live ownership without duplicate numbers', () => {
  const changed = { ...assignments, 5: 'DP-99' };
  const workspaces = [{ id: 5, monitor: laptop }];
  assert.deepEqual(ids('DP-1', monitors, changed, workspaces), [1, 2, 3, 4]);
  assert.deepEqual(ids('eDP-1', monitors, changed, workspaces), [5, 6, 7, 8, 9, 10]);
});

test('monitor description and numeric id selectors are resolved', () => {
  assert.equal(model.matchesMonitor('desc:External display', external), true);
  assert.equal(model.matchesMonitor('1', external), true);
  assert.equal(model.matchesMonitor('desc:Other', external), false);
});

test('special, out-of-range, disabled, and monitorless rules are ignored', () => {
  const parsed = model.parseAssignments(JSON.stringify([
    ...rules,
    { workspaceString: 'special:qconsole', monitor: 'DP-1' },
    { workspaceString: '11', monitor: 'DP-1' },
    { workspaceString: '1', enabled: false, monitor: 'eDP-1' },
    { workspaceString: '1', enabled: true },
    { workspaceString: '2', enabled: true, monitor: '' },
    null
  ]));
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), JSON.parse(JSON.stringify(assignments)));
});

test('invalid JSON and non-array rule responses are rejected', () => {
  assert.throws(() => model.parseAssignments('invalid'));
  assert.throws(() => model.parseAssignments('{}'));
});

test('no bar is assigned to a missing or not-yet-known host output', () => {
  assert.deepEqual(ids(''), []);
  assert.deepEqual(ids('DP-99'), []);
  assert.deepEqual(ids('eDP-1', []), []);
});

test('workspace 10 is labelled zero without changing its numeric identity', () => {
  assert.equal(model.workspaceLabel(10), '0');
  assert.equal(model.workspaceLabel(6), '6');
  assert.equal(ids('eDP-1').at(-1), 10);
});
