// ==UserScript==
// @name        Reject serviceWorker Auto
// @namespace   rejectserviceWorkerAuto
// @match       *://*/*
// @run-at      document-start
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_registerMenuCommand
// @grant       unsafeWindow
// @version     1.4
// @author      -
// @description Rejects serviceWorker registration everywhere, except on the hosts you opt out of.
// ==/UserScript==

var DEBUG = false;
var UNREGISTER_EXISTING = true; // Also drop workers that were registered before this script was installed
var name = 'rejectserviceWorkerAuto';
var prefix = "autoinject" + name;
var host = location.hostname;
var isTopFrame = window.self === window.top;
var injectedStatus = false;
var hostarray = [];
// Firefox runs the script in a sandbox, so patching our own `window` would only be visible to us.
var pageWindow = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
var nativeRegister = null;

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

function unregisterExisting() {
    try {
        var serviceWorker = pageWindow.navigator.serviceWorker;
        if (!serviceWorker || typeof serviceWorker.getRegistrations !== 'function') return;
        serviceWorker.getRegistrations().then(function (registrations) {
            for (var i = 0; i < registrations.length; i++) {
                registrations[i].unregister();
            }
        }, function (err) {
            log("could not list registrations", err);
        });
    } catch (err) {
        log("could not list registrations", err);
    }
}

function inject() {
    //if (window.self !== window.top) return; // Not in frames
    if (injectedStatus !== false) return; // Not if already injected
    var proto = serviceWorkerPrototype();
    if (!proto) return;
    // Patch the prototype, not navigator.serviceWorker: an own property on the instance is
    // bypassed by ServiceWorkerContainer.prototype.register.call(navigator.serviceWorker, ...).
    var blocked = (typeof exportFunction === 'function') ? exportFunction(register, pageWindow) : register;
    try {
        nativeRegister = proto.register;
        proto.register = blocked;
    } catch (err) {
        log("could not patch register", err);
        return;
    }
    injectedStatus = true;
    if (UNREGISTER_EXISTING) unregisterExisting();
    log("rejecting serviceWorker registration on", host);
}

function restore() {
    if (injectedStatus === false || !nativeRegister) return;
    var proto = serviceWorkerPrototype();
    if (!proto) return;
    try {
        proto.register = nativeRegister;
    } catch (err) {
        log("could not restore register", err);
        return;
    }
    injectedStatus = false;
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
    inject();
    if (isTopFrame) addMenu("Stop Auto-Injecting " + name, addHost);
}
