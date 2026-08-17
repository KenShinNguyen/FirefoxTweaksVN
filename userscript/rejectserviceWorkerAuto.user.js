// ==UserScript==
// @name        Reject serviceWorker Auto
// @namespace   rejectserviceWorkerAuto
// @match       *://*/*
// @run-at      document-start
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_registerMenuCommand
// @grant       unsafeWindow
// @version     1.5
// @author      -
// @description Rejects serviceWorker registration everywhere, except on the hosts you opt out of.
// ==/UserScript==

var DEBUG = false;
var UNREGISTER_EXISTING = true; // Also drop workers that were registered before this script was installed
var RELOAD_WHEN_CONTROLLED = false; // Reload by itself when a dropped worker is still controlling the page
var name = 'rejectserviceWorkerAuto';
var prefix = "autoinject" + name;
var mark = "__" + name + "__";
var host = location.hostname;
var isTopFrame = window.self === window.top;
var injectedStatus = false;
var hostarray = [];
// Firefox runs the script in a sandbox, so patching our own `window` would only be visible to us.
var pageWindow = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
var nativeRegister = null;
var blockedRegister = null;

function log() {
    if (DEBUG) console.log.apply(console, [name].concat([].slice.call(arguments)));
}

// null on insecure origins and in browsers without serviceWorker support: nothing to block there.
function serviceWorkerPrototype() {
    try {
        var container = pageWindow.ServiceWorkerContainer;
        return (container && container.prototype && container.prototype.register) ? container.prototype : null;
    } catch (err) {
        return null;
    }
}

function serviceWorkerContainer() {
    try {
        return pageWindow.navigator.serviceWorker || null;
    } catch (err) {
        return null;
    }
}

// Browsers reject with a SecurityError DOMException when serviceWorkers are turned off,
// so sites that inspect err.name keep working instead of choking on a bare string.
function rejection() {
    var message = "This method is not allowed!";
    var error;
    try {
        error = new pageWindow.DOMException(message, "SecurityError");
    } catch (err) {
        error = new Error(message);
    }
    try {
        return pageWindow.Promise.reject(error);
    } catch (err) {
        return Promise.reject(error);
    }
}

function register() {
    return rejection();
}

// Non-null while a worker is still serving this page: unregistering does not evict it,
// the page stays controlled until it navigates away or reloads.
function controller() {
    var container = serviceWorkerContainer();
    return (container && container.controller) ? container.controller : null;
}

// Resolves to true when at least one registration was actually dropped.
function unregisterExisting() {
    var container = serviceWorkerContainer();
    if (!container || typeof container.getRegistrations !== 'function') return Promise.resolve(false);
    return container.getRegistrations().then(function (registrations) {
        var pending = [];
        for (var i = 0; i < registrations.length; i++) {
            pending.push(registrations[i].unregister());
        }
        return Promise.all(pending);
    }).then(function (dropped) {
        if (dropped.length) log("dropped", dropped.length, "registration(s) on", host);
        return dropped.length > 0;
    }, function (err) {
        log("could not drop existing registrations", err);
        return false;
    });
}

// One reload per tab. Without the marker a site that keeps handing us a controller
// (or a storage-less origin) would have us reloading in a loop.
function reloadOnce() {
    try {
        if (pageWindow.sessionStorage.getItem(mark)) return false;
        pageWindow.sessionStorage.setItem(mark, "1");
    } catch (err) {
        log("no sessionStorage to guard the reload, skipping it", err);
        return false;
    }
    location.reload();
    return true;
}

function dropController() {
    if (controller() === null) return;
    if (RELOAD_WHEN_CONTROLLED) {
        if (!reloadOnce()) log("worker still controls this page, reload skipped");
    } else if (isTopFrame) {
        addMenu("Reload without serviceWorker", function () { location.reload(); });
    }
}

// Returns true while this copy of the script owns the patch.
function inject() {
    //if (window.self !== window.top) return; // Not in frames
    if (injectedStatus !== false) return true; // Not if already injected
    var proto = serviceWorkerPrototype();
    if (!proto) return false;
    // A second copy of this script must not wrap the first one: it would save our own
    // blocker as the native method and "restore" it right back on.
    if (pageWindow[mark]) {
        log("already blocked by another copy of this script");
        return false;
    }
    // Patch the prototype, not navigator.serviceWorker: an own property on the instance is
    // bypassed by ServiceWorkerContainer.prototype.register.call(navigator.serviceWorker, ...).
    var blocked = (typeof exportFunction === 'function') ? exportFunction(register, pageWindow) : register;
    try {
        // Whatever sits here now, even another blocker, is what restore() has to give back.
        nativeRegister = proto.register;
        proto.register = blocked;
        pageWindow[mark] = true;
    } catch (err) {
        log("could not patch register", err);
        return false;
    }
    blockedRegister = proto.register;
    injectedStatus = true;
    log("rejecting serviceWorker registration on", host);
    if (UNREGISTER_EXISTING) {
        unregisterExisting().then(function (dropped) {
            if (dropped) dropController();
        });
    }
    return true;
}

function restore() {
    if (injectedStatus === false) return;
    var proto = serviceWorkerPrototype();
    if (proto && nativeRegister && proto.register === blockedRegister) {
        try {
            proto.register = nativeRegister;
        } catch (err) {
            log("could not restore register", err);
            return;
        }
    } else {
        // Someone patched register after us; handing our copy back would undo their work.
        log("register is no longer ours, leaving it alone");
    }
    injectedStatus = false;
    blockedRegister = null;
    nativeRegister = null;
    try {
        delete pageWindow[mark];
    } catch (err) {
        log("could not clear the marker", err);
    }
}

function addHost() {
    if (hostarray.indexOf(host) > -1) return;
    hostarray.push(host);
    GM_setValue(prefix, JSON.stringify(hostarray));
    restore(); // Applies to this page too, no reload needed
}

function removeHost() {
    var index = hostarray.indexOf(host);
    if (index > -1) {
        hostarray.splice(index, 1);
        GM_setValue(prefix, JSON.stringify(hostarray));
    }
    inject();
}

// This should work in Violentmonkey and Tampermonkey, but unfortunately not Greasemonkey.
function addMenu(label, action) {
    try {
        GM_registerMenuCommand(label, action);
    } catch (err) {
        console.log("Error adding Inject menu items: " + name);
        console.log(err);
    }
}

try {
    hostarray = JSON.parse(GM_getValue(prefix, "[]"));
    if (!Array.isArray(hostarray)) hostarray = [];
} catch (err) {
    hostarray = []; // A broken list must not stop us from injecting
    log("could not read the host list", err);
}

if (hostarray.indexOf(host) > -1) {
    // Menu commands are per frame, so only the top one would end up with duplicates.
    if (isTopFrame) {
        addMenu("Inject " + name, inject);
        addMenu("Auto-Inject on " + host, removeHost);
    }
} else {
    // Nothing patched means nothing of ours to stop: either the origin has no serviceWorker
    // support, or another copy of the script owns the patch and its own command already works.
    var owned = inject();
    if (isTopFrame && owned) addMenu("Stop Auto-Injecting " + name, addHost);
}
