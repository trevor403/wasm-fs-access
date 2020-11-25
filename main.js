import { OpenFiles, FIRST_PREOPEN_FD } from './wasi-fs-access/fileSystem.js';

window.global = window;

var term = new Terminal({
    screenKeys: true,
    useStyle: true,
    cursorBlink: true,
});
window.term = term;

term.open(document.getElementById('xterm'));
const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);
fitAddon.fit();

const localEcho = new LocalEchoController(term);
global.readLine = async function() {
    const input = await localEcho.read("~$ ");
    global.runner(input)
    // console.orig.warn(input);
    // let ret = await new Promise(function(resolve) {
    // 	global.runner(input, resolve);
    // });
    // if (ret) {
    // 	term.writeln(ret);
    // }
    // await readLine();
};

console.orig = {
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console)
};

// console.log = function(a) {
// 	console.orig.log(a);
// 	term.writeln(a);
// };

console.warn = function(a) {
    term.writeln('\u001b[34m' + a + '\u001b[39m');
};

console.error = function(a) {
    orig.error(a);
    term.writeln('\u001b[31m' + a + '\u001b[39m');
}

function fetchAndInstantiate(url, importObject) {
    return fetch(url, {cache: "no-cache"}).then(response =>
        response.arrayBuffer()
    ).then(bytes =>
        WebAssembly.instantiate(bytes, importObject)
    ).then(results =>
        results.instance
    );
}

async function init() {
    var db = new Dexie("nativefs");
    db.version(1).stores({
        filerefs: 'name,dirent'
    });

    var directoryHandle;
    var row = await db.filerefs.get("root");
    if (row === undefined) {
        directoryHandle = await window.showDirectoryPicker();
        if (directoryHandle.name != "GoD-Tool") {
            console.error("Must select GoD-Tool directory");
            return;
        }
        await db.filerefs.put({name: "root", dirent: directoryHandle});
    } else {
        directoryHandle = row.dirent;
    }

    const options = {mode: 'readwrite'};
    if ((await directoryHandle.queryPermission(options)) !== 'granted') {
        await directoryHandle.requestPermission(options);
    }

    // global.rootHandle = directoryHandle;
    // global.fs.dirent[3] = new FileHandle(directoryHandle, 0, 0, true);

    let preOpen = {};
    preOpen["/"] = directoryHandle;
    let openFiles = new OpenFiles(preOpen);
    global.fs.openFiles = openFiles;
    global.fs.rootHandle = global.fs.openFiles.getPreOpen(FIRST_PREOPEN_FD)

    var go = new Go();
    var instance = await fetchAndInstantiate("main.wasm", go.importObject);
    go.run(instance);

    global.readLine();
}

document.getElementById('start').onclick = init;
