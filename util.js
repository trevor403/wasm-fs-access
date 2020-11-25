class EventEmitter {
    constructor() {
        this._events = {};
    }

    on(name, listener) {
        if (!this._events[name]) {
            this._events[name] = [];
        }

        this._events[name].push(listener);
    }

    removeListener(name, listenerToRemove) {
        if (!this._events[name]) {
            throw new Error(`Can't remove a listener. Event "${name}" doesn't exits.`);
        }

        const filterListeners = (listener) => listener !== listenerToRemove;

        this._events[name] = this._events[name].filter(filterListeners);
    }

    emit(name, data) {
        if (!this._events[name]) {
            throw new Error(`Can't emit an event. Event "${name}" doesn't exits.`);
        }

        const fireCallbacks = (callback) => {
            callback(data);
        };

        this._events[name].forEach(fireCallbacks);
    }
}

const S_IFDIR  = 0o040000;  // # directory
const S_IFCHR  = 0o020000;  // # character device
const S_IFBLK  = 0o060000;  // # block device
const S_IFREG  = 0o100000;  // # regular file
const S_IFIFO  = 0o010000;  // # fifo (named pipe)
const S_IFLNK  = 0o120000;  // # symbolic link
const S_IFSOCK = 0o140000;  // # socket file

class FileHandle {
    constructor(sysfile, pos, flags, isDir) {
        this.sysfile = sysfile;
        this.pos = pos;
        this.flags = flags;
        this.isDir = isDir;
    }
}

class FileStats {
    constructor(jsfile) {
        this.dev = 0;
        this.ino = 0;
        this.nlink = 0;
        this.rdev = 0;

        this.mode = 0o755 | S_IFREG;

        this.uid = 1000;
        this.gid = 1000;

        this.blksize = 512;
        this.size = jsfile.size;
        this.blocks = Math.ceil(jsfile.size / this.blksize);

        this.mtimeMs = jsfile.lastModified;
        this.atimeMs = 0;
        this.ctimeMs = 0;
    }

    isDirectory() {
        return false
    }
}

class DirStats {
    constructor() {
        this.dev = 0;
        this.ino = 0;
        this.mode = 0o755 | S_IFDIR;
        this.nlink = 0;
        this.uid = 1000;
        this.gid = 1000;
        this.rdev = 0;
        this.size = 0;
        this.blksize = 512;
        this.blocks = 0;

        this.mtimeMs = 0;
        this.atimeMs = 0;
        this.ctimeMs = 0;
    }

    isDirectory() {
        return true
    }
}


function getDirectoryEntry(expectedName) {
    let db;
    var request = indexedDB.open("WritableFilesDemo");
    request.onerror = function(e) { console.log(e); }
    request.onsuccess = function(e) { db = e.target.result; }

    let file_id = "root";
    let transaction = db.transaction(["filerefs"], "readwrite");
    request = transaction.objectStore("filerefs").get(file_id);
    request.onsuccess = function(e) {
        orig.log(e);
        // let ref = e.result;
    }
}