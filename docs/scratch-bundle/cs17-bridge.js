/**
 * CS17 postMessage bridge for the embedded Scratch editor.
 *
 * Wires the Scratch VM to a host page (the React /dashboard) over postMessage.
 * Protocol lives in cs17_portal/docs/scratch-integration-spec.md section 3.
 *
 *   host   -> editor  load-project  {sb3: ArrayBuffer}  -> vm.loadProject(sb3)
 *   host   -> editor  request-sb3   {}                  -> editor serializes + replies
 *   editor -> host    project-sb3   {sb3: ArrayBuffer, thumbnail?: dataURL}
 *   editor -> host    ready         {}                  -> booted, safe to load-project
 *   editor -> host    dirty         {}                  -> project changed since last save
 *
 * The VM singleton imported here is the exact instance the GUI renders against
 * (reducers/vm.js initialState); the editor flow never dispatches SET_VM, so it
 * stays the live VM. If a future flow swaps the VM, re-read it from the store.
 */

import {vmInitialState as vm} from '../reducers/vm.js';

// ponytail: wildcard target origin for the spike, pin to the portal origin before prod
const HOST_ORIGIN = '*';

const isEmbedded = () => window.parent && window.parent !== window;

const postToHost = (type, payload = {}, transfer = []) => {
    if (!isEmbedded()) return;
    window.parent.postMessage(Object.assign({type}, payload), HOST_ORIGIN, transfer);
};

// editor -> host: project changed since last save (drives host autosave + unsaved guard)
vm.on('PROJECT_CHANGED', () => postToHost('dirty'));

const loadProject = async sb3 => {
    await vm.loadProject(sb3);
    if (vm.renderer) vm.renderer.draw();
};

// scratch-render's WebGL canvas is created without preserveDrawingBuffer, so a bare
// canvas.toDataURL() reads back an empty (white) buffer. requestSnapshot() renders into
// a readable buffer and captures inside the same draw call, giving a real stage PNG.
const captureThumbnail = () => new Promise(resolve => {
    const renderer = vm.renderer;
    if (!renderer || typeof renderer.requestSnapshot !== 'function') {
        resolve(undefined);
        return;
    }
    let settled = false;
    const finish = dataURL => {
        if (settled) return;
        settled = true;
        resolve(dataURL);
    };
    try {
        renderer.requestSnapshot(dataURL => finish(dataURL));
        // requestSnapshot only fires on the renderer's next frame; force a draw so the
        // capture resolves now even when the stage is idle (dirty is set by requestSnapshot).
        renderer.draw();
    } catch (snapshotError) {
        finish(undefined);
    }
    // thumbnail is optional — never let a stuck renderer block the save
    setTimeout(() => finish(undefined), 1000);
});

const sendSb3 = async () => {
    const blob = await vm.saveProjectSb3();
    const sb3 = await blob.arrayBuffer();
    const thumbnail = await captureThumbnail();
    postToHost('project-sb3', {sb3, thumbnail}, [sb3]);
};

window.addEventListener('message', async event => {
    const data = event.data || {};
    if (data.type === 'load-project') {
        await loadProject(data.sb3);
    } else if (data.type === 'request-sb3') {
        await sendSb3();
    }
});

// editor -> host: booted; host waits for this before sending load-project
if (document.readyState === 'complete') {
    postToHost('ready');
} else {
    window.addEventListener('load', () => postToHost('ready'));
}

// expose for host-side debugging and direct access if ever needed
window.cs17vm = vm;
