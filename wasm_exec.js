// Copyright 2018 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.
(() => {
	// Map multiple JavaScript environments to a single common API,
	// preferring web standards over Node.js API.
	//
	// Environments considered:
	// - Browsers
	// - Node.js
	// - Electron
	// - Parcel

	if (typeof global !== "undefined") {
		// global already exists
	} else if (typeof window !== "undefined") {
		window.global = window;
	} else if (typeof self !== "undefined") {
		self.global = self;
	} else {
		throw new Error("cannot export Go (neither global, window nor self is defined)");
	}

	if (!global.require && typeof require !== "undefined") {
		global.require = require;
	}

	if (!global.fs && global.require) {
		global.fs = require("fs");
	}

	const enosys = () => {
		const err = new Error("Function not implemented");
		err.code = "ENOSYS";
		return err;
	};

	const enoent = () => {
		const err = new Error("No such file or directory");
		err.code = "ENOENT";
		return err;
	};

	const eisdir = () => {
		const err = new Error("Is a directory");
		err.code = "EISDIR";
		return err;
	};

	const ebadf = () => {
		const err = new Error("Bad file number");
		err.code = "EBADF";
		return err;
	};

	const simplifyPath = (path) => {
		var arr = path.split('/');
		var stack = [];
		var len = arr.length;
		var item = '';
		for (var i = 0; i < len; i++) {
			item = arr[i];
			if (item === '' || item === '.') continue;
			if (item === '..') {
				stack.pop();
			} else {
				stack.push(item);
			}
		}
		return '/' + stack.join('/');
	};

	const inspectPath = (path) => {
		var arr = path.split('/');
		var stack = [];
		var len = arr.length;
		var item = '';
		for (var i = 0; i < len; i++) {
			item = arr[i];
			if (item === '' || item === '.') continue;
			if (item === '..') {
				stack.pop();
			} else {
				stack.push(item);
			}
		}
		return stack;
	};

	// transverse from root function

	global.eventBus = new EventEmitter();

	// TODO: https://blog.merzlabs.com/posts/native-file-system/
	// TODO: https://github.com/jvilk/BrowserFS/blob/master/src/core/FS.ts#L300
	// TODO: https://github.com/wcchoi/go-wasm-pdfcpu/blob/master/wasm_exec.js#L145

	// TODO: https://github.com/KriNeko/KriNeko.github.io/blob/master/fs-test/script.js
	// TODO: https://wicg.github.io/file-system-access/

	// TODO: https://developers.google.com/web/updates/2011/08/Seek-into-local-files-with-the-File-System-API
	// TODO: https://web.dev/file-system-access/

	// TODO: https://www-numi.fnal.gov/offline_software/srt_public_context/WebDocs/Errors/unix_system_errors.html

	// https://trevor.la/home/

	if (!global.fs) {
		let outputBuf = "";
		global.fs = {
			writeSync(fd, buf) {
				if (fd === 1 || fd === 2) {
					outputBuf += decoder.decode(buf);
					const nl = outputBuf.lastIndexOf("\n");
					if (nl != -1) {
						// console.log(outputBuf.substr(0, nl));
						eventBus.emit('printEvent', outputBuf.substr(0, nl)); // + "\r\n"
						outputBuf = outputBuf.substr(nl + 1);
					}
					return buf.length;
				} else {
					console.log("STUB called writeSync()");
					callback(enosys());
				}
			},
			async write(fd, buf, offset, length, position, callback) {
				if (fd === 1 || fd === 2) {
					if (offset !== 0 || length !== buf.length || position !== null) {
						throw new Error("not implemented");
					}
					const n = this.writeSync(fd, buf);
					return callback(null, n, buf);
				} else {
					console.log(`called write(${JSON.stringify([fd, "buf", offset, length, position]).slice(1, -1)})`);
					const os = global.fs.constants;

					let handle = this.dirent[fd];
					let stream = await handle.sysfile.createWritable({
						keepExistingData: Boolean(handle.flags & os.O_APPEND),
					});
					await stream.write({ type: "write", position: handle.pos + offset, data: buf });
					await stream.close();
					return callback(null, length);
				}

				callback(enosys());
			},
			chmod(path, mode, callback) { console.log("called chmod()"); callback(enosys()); },
			chown(path, uid, gid, callback) { console.log("called chown()"); callback(enosys()); },
			close(fd, callback) {
				console.log("STUB called close()");
				// TODO: add an actual close cleanup
				callback(null);
			},
			fchmod(fd, mode, callback) { console.log("called fchmod()"); callback(enosys()); },
			fchown(fd, uid, gid, callback) { console.log("called fchown()"); callback(enosys()); },
			async fstat(fd, callback) {
				console.log(`called fstat(${fd})`);
				let handle = this.dirent[fd];
				if (handle instanceof FileHandle) {
					var stat;
					if (handle.isDir) {
						stat = new DirStats();
					} else {
						let jsfile = await handle.sysfile.getFile();
						stat = new FileStats(jsfile);
					}
					return callback(null, stat);
				}

				return callback(enosys());
			},
			fsync(fd, callback) { console.log("STUB called fsync()"); callback(null); },
			ftruncate(fd, length, callback) { console.log("called ftruncate()"); callback(enosys()); },
			lchown(path, uid, gid, callback) { console.log("called lchown()"); callback(enosys()); },
			link(path, link, callback) { console.log("called link()"); callback(enosys()); },
			async lstat(path, callback) {
				console.log(`called lstat(${JSON.stringify(path)})`);
				const cb = (err, val) => { return [err, val]; };
				let [err, fd] = await this.open(path, 0, 0, cb);
				if (err !== null) {
					return callback(err);
				}
				let ret = await this.fstat(fd, callback);
				// TODO: close fd here
				return;
			},
			mkdir(path, perm, callback) { console.log(`called mkdir(${path})`); callback(enosys()); },
			async open(path, flags, mode, callback) {
				console.log(`called open(${JSON.stringify([path, flags, mode]).slice(1, -1)})`);
				const os = global.fs.constants;

				let parts = inspectPath(path);
				var parent = global.rootHandle;
				var isDir = false;

				if (path == "/" || parts.length == 0) {
					console.log(`rare to get zero parts on ${path}`);
					return callback(null, 3);
				}

				ident = [];

				while (parts.length > 1) {
					let part = parts.shift();
					ident.push(part);
					parent = await parent.getDirectoryHandle(part).catch(error => error);
					if (parent instanceof Error) {
						console.error(`got parent error ${parent}`);
						return callback(enoent());
					}
					global.fs.direntMap[ident] = parent;
				}

				let name = parts.shift();
				let options = { create: Boolean(flags & os.O_CREAT) };
				var handle = await parent.getFileHandle(name, options).catch(error => error);
				if (handle instanceof Error && handle.name == "TypeMismatchError") {
					handle = await parent.getDirectoryHandle(name);
					isDir = true;
				}

				console.log(handle);

				if (handle instanceof Error && handle.name == "NotFoundError") {
					return callback(enoent());
				}

				var pos = 0;
				if (flags & os.O_WRONLY || flags & os.O_RDWR) {
					if (flags & os.O_TRUNC) {
						let writer = await handle.createWritable({ keepExistingData: false });
						writer.close();
					}

					if (flags & os.O_APPEND) {
						let jsfile = await handle.getFile();
						pos = jsfile.size;
					}
				}

				let entry = new FileHandle(handle, pos, flags, isDir);
				let fd = this.dirent.push(entry) - 1;

				console.log("open success");
				return callback(null, fd);
				// callback(enosys());
			},
			async read(fd, buffer, offset, length, position, callback) {
				console.log(`called read(${JSON.stringify([fd, "buf", offset, length, position]).slice(1, -1)})`);
				let handle = this.dirent[fd];

				if (handle.isDir) {
					return callback(eisdir());
				}

				let jsfile = await handle.sysfile.getFile();

				let reader = jsfile.stream().getReader();
				let { value: view, done } = await reader.read();

				if (handle.end) {
					this.dirent[fd].end = false;
					return callback(null, 0);
				} else {
					buffer.set(view);
					this.dirent[fd].end = true;
					return callback(null, view.byteLength);
				}
			},
			async readdir(path, callback) {
				console.log(`called readdir(${JSON.stringify(path)})`);

				const cb = (err, val) => { return [err, val]; };
				let [err, fd] = await this.open(path, 0, 0, cb);

				let handle = this.dirent[fd];
				if (!(handle instanceof FileHandle) || handle === undefined) {
					return callback(ebadf());
				}

				// TODO: close fd here

				const files = [];
				for await (let [name, _handle] of handle.sysfile) {
					orig.log(name);
					files.push(name);
				}
				callback(null, files);
			},
			readlink(path, callback) { console.log("called readlink()"); callback(enosys()); },
			rename(from, to, callback) { console.log("called rename()"); callback(enosys()); },
			rmdir(path, callback) { console.log("called rmdir()"); callback(enosys()); },
			async stat(path, callback) {
				console.log(`called stat("${path}")`);
				// return callback(enosys());
				await this.lstat(path, callback);
			},
			symlink(path, link, callback) { console.log("called symlink()"); callback(enosys()); },
			truncate(path, length, callback) { console.log("called truncate()"); callback(enosys()); },
			unlink(path, callback) { console.log("called unlink()"); callback(enosys()); },
			utimes(path, atime, mtime, callback) { console.log("called utimes()"); callback(enosys()); },
		};

		global.fs.constants = {
			O_RDONLY: 0,
			O_WRONLY: 1,
			O_RDWR: 2,
			O_CREAT: 64,
			O_EXCL: 128,
			O_NOCTTY: 256,
			O_TRUNC: 512,
			O_APPEND: 1024,
			O_DIRECTORY: 65536,
			O_NOATIME: 262144,
			O_NOFOLLOW: 131072,
			O_SYNC: 1052672,
			O_DIRECT: 16384,
			O_NONBLOCK: 2048,
		};

		global.fs.dirent = [
			"special", // stdin
			"special", // stdout
			"special", // stderr
		];

		global.fs.direntMap = {};
	}

	if (!global.process) {
		global.process = {
			getuid() { return -1; },
			getgid() { return -1; },
			geteuid() { return -1; },
			getegid() { return -1; },
			getgroups() { throw enosys(); },
			pid: -1,
			ppid: -1,
			umask() { throw enosys(); },
			cwd() { throw enosys(); },
			chdir() { throw enosys(); },
		}
	}

	if (!global.crypto) {
		const nodeCrypto = require("crypto");
		global.crypto = {
			getRandomValues(b) {
				nodeCrypto.randomFillSync(b);
			},
		};
	}

	if (!global.performance) {
		global.performance = {
			now() {
				const [sec, nsec] = process.hrtime();
				return sec * 1000 + nsec / 1000000;
			},
		};
	}

	if (!global.TextEncoder) {
		global.TextEncoder = require("util").TextEncoder;
	}

	if (!global.TextDecoder) {
		global.TextDecoder = require("util").TextDecoder;
	}

	// End of polyfills for common API.

	const encoder = new TextEncoder("utf-8");
	const decoder = new TextDecoder("utf-8");

	global.Go = class {
		constructor() {
			this.argv = ["js"];
			this.env = {};
			this.exit = (code) => {
				if (code !== 0) {
					console.warn(`exit code: ${code}`);
				}
			};
			this._exitPromise = new Promise((resolve) => {
				this._resolveExitPromise = resolve;
			});
			this._pendingEvent = null;
			this._scheduledTimeouts = new Map();
			this._nextCallbackTimeoutID = 1;

			const setInt64 = (addr, v) => {
				this.mem.setUint32(addr + 0, v, true);
				this.mem.setUint32(addr + 4, Math.floor(v / 4294967296), true);
			}

			const getInt64 = (addr) => {
				const low = this.mem.getUint32(addr + 0, true);
				const high = this.mem.getInt32(addr + 4, true);
				return low + high * 4294967296;
			}

			const loadValue = (addr) => {
				const f = this.mem.getFloat64(addr, true);
				if (f === 0) {
					return undefined;
				}
				if (!isNaN(f)) {
					return f;
				}

				const id = this.mem.getUint32(addr, true);
				return this._values[id];
			}

			const storeValue = (addr, v) => {
				const nanHead = 0x7FF80000;

				if (typeof v === "number") {
					if (isNaN(v)) {
						this.mem.setUint32(addr + 4, nanHead, true);
						this.mem.setUint32(addr, 0, true);
						return;
					}
					if (v === 0) {
						this.mem.setUint32(addr + 4, nanHead, true);
						this.mem.setUint32(addr, 1, true);
						return;
					}
					this.mem.setFloat64(addr, v, true);
					return;
				}

				switch (v) {
					case undefined:
						this.mem.setFloat64(addr, 0, true);
						return;
					case null:
						this.mem.setUint32(addr + 4, nanHead, true);
						this.mem.setUint32(addr, 2, true);
						return;
					case true:
						this.mem.setUint32(addr + 4, nanHead, true);
						this.mem.setUint32(addr, 3, true);
						return;
					case false:
						this.mem.setUint32(addr + 4, nanHead, true);
						this.mem.setUint32(addr, 4, true);
						return;
				}

				let id = this._ids.get(v);
				if (id === undefined) {
					id = this._idPool.pop();
					if (id === undefined) {
						id = this._values.length;
					}
					this._values[id] = v;
					this._goRefCounts[id] = 0;
					this._ids.set(v, id);
				}
				this._goRefCounts[id]++;
				let typeFlag = 1;
				switch (typeof v) {
					case "string":
						typeFlag = 2;
						break;
					case "symbol":
						typeFlag = 3;
						break;
					case "function":
						typeFlag = 4;
						break;
				}
				this.mem.setUint32(addr + 4, nanHead | typeFlag, true);
				this.mem.setUint32(addr, id, true);
			}

			const loadSlice = (addr) => {
				const array = getInt64(addr + 0);
				const len = getInt64(addr + 8);
				return new Uint8Array(this._inst.exports.mem.buffer, array, len);
			}

			const loadSliceOfValues = (addr) => {
				const array = getInt64(addr + 0);
				const len = getInt64(addr + 8);
				const a = new Array(len);
				for (let i = 0; i < len; i++) {
					a[i] = loadValue(array + i * 8);
				}
				return a;
			}

			const loadString = (addr) => {
				const saddr = getInt64(addr + 0);
				const len = getInt64(addr + 8);
				return decoder.decode(new DataView(this._inst.exports.mem.buffer, saddr, len));
			}

			const timeOrigin = Date.now() - performance.now();
			this.importObject = {
				go: {
					// Go's SP does not change as long as no Go code is running. Some operations (e.g. calls, getters and setters)
					// may synchronously trigger a Go event handler. This makes Go code get executed in the middle of the imported
					// function. A goroutine can switch to a new stack if the current stack is too small (see morestack function).
					// This changes the SP, thus we have to update the SP used by the imported function.

					// func wasmExit(code int32)
					"runtime.wasmExit": (sp) => {
						const code = this.mem.getInt32(sp + 8, true);
						this.exited = true;
						delete this._inst;
						delete this._values;
						delete this._goRefCounts;
						delete this._ids;
						delete this._idPool;
						this.exit(code);
					},

					// func wasmWrite(fd uintptr, p unsafe.Pointer, n int32)
					"runtime.wasmWrite": (sp) => {
						const fd = getInt64(sp + 8);
						const p = getInt64(sp + 16);
						const n = this.mem.getInt32(sp + 24, true);
						fs.writeSync(fd, new Uint8Array(this._inst.exports.mem.buffer, p, n));
					},

					// func resetMemoryDataView()
					"runtime.resetMemoryDataView": (sp) => {
						this.mem = new DataView(this._inst.exports.mem.buffer);
					},

					// func nanotime1() int64
					"runtime.nanotime1": (sp) => {
						setInt64(sp + 8, (timeOrigin + performance.now()) * 1000000);
					},

					// func walltime1() (sec int64, nsec int32)
					"runtime.walltime1": (sp) => {
						const msec = (new Date).getTime();
						setInt64(sp + 8, msec / 1000);
						this.mem.setInt32(sp + 16, (msec % 1000) * 1000000, true);
					},

					// func scheduleTimeoutEvent(delay int64) int32
					"runtime.scheduleTimeoutEvent": (sp) => {
						const id = this._nextCallbackTimeoutID;
						this._nextCallbackTimeoutID++;
						this._scheduledTimeouts.set(id, setTimeout(
							() => {
								this._resume();
								while (this._scheduledTimeouts.has(id)) {
									// for some reason Go failed to register the timeout event, log and try again
									// (temporary workaround for https://github.com/golang/go/issues/28975)
									console.warn("scheduleTimeoutEvent: missed timeout event");
									this._resume();
								}
							},
							getInt64(sp + 8) + 1, // setTimeout has been seen to fire up to 1 millisecond early
						));
						this.mem.setInt32(sp + 16, id, true);
					},

					// func clearTimeoutEvent(id int32)
					"runtime.clearTimeoutEvent": (sp) => {
						const id = this.mem.getInt32(sp + 8, true);
						clearTimeout(this._scheduledTimeouts.get(id));
						this._scheduledTimeouts.delete(id);
					},

					// func getRandomData(r []byte)
					"runtime.getRandomData": (sp) => {
						crypto.getRandomValues(loadSlice(sp + 8));
					},

					// func finalizeRef(v ref)
					"syscall/js.finalizeRef": (sp) => {
						const id = this.mem.getUint32(sp + 8, true);
						this._goRefCounts[id]--;
						if (this._goRefCounts[id] === 0) {
							const v = this._values[id];
							this._values[id] = null;
							this._ids.delete(v);
							this._idPool.push(id);
						}
					},

					// func stringVal(value string) ref
					"syscall/js.stringVal": (sp) => {
						storeValue(sp + 24, loadString(sp + 8));
					},

					// func valueGet(v ref, p string) ref
					"syscall/js.valueGet": (sp) => {
						const result = Reflect.get(loadValue(sp + 8), loadString(sp + 16));
						sp = this._inst.exports.getsp(); // see comment above
						storeValue(sp + 32, result);
					},

					// func valueSet(v ref, p string, x ref)
					"syscall/js.valueSet": (sp) => {
						Reflect.set(loadValue(sp + 8), loadString(sp + 16), loadValue(sp + 32));
					},

					// func valueDelete(v ref, p string)
					"syscall/js.valueDelete": (sp) => {
						Reflect.deleteProperty(loadValue(sp + 8), loadString(sp + 16));
					},

					// func valueIndex(v ref, i int) ref
					"syscall/js.valueIndex": (sp) => {
						storeValue(sp + 24, Reflect.get(loadValue(sp + 8), getInt64(sp + 16)));
					},

					// valueSetIndex(v ref, i int, x ref)
					"syscall/js.valueSetIndex": (sp) => {
						Reflect.set(loadValue(sp + 8), getInt64(sp + 16), loadValue(sp + 24));
					},

					// func valueCall(v ref, m string, args []ref) (ref, bool)
					"syscall/js.valueCall": (sp) => {
						try {
							const v = loadValue(sp + 8);
							const m = Reflect.get(v, loadString(sp + 16));
							const args = loadSliceOfValues(sp + 32);
							const result = Reflect.apply(m, v, args);
							sp = this._inst.exports.getsp(); // see comment above
							storeValue(sp + 56, result);
							this.mem.setUint8(sp + 64, 1);
						} catch (err) {
							storeValue(sp + 56, err);
							this.mem.setUint8(sp + 64, 0);
						}
					},

					// func valueInvoke(v ref, args []ref) (ref, bool)
					"syscall/js.valueInvoke": (sp) => {
						try {
							const v = loadValue(sp + 8);
							const args = loadSliceOfValues(sp + 16);
							const result = Reflect.apply(v, undefined, args);
							sp = this._inst.exports.getsp(); // see comment above
							storeValue(sp + 40, result);
							this.mem.setUint8(sp + 48, 1);
						} catch (err) {
							storeValue(sp + 40, err);
							this.mem.setUint8(sp + 48, 0);
						}
					},

					// func valueNew(v ref, args []ref) (ref, bool)
					"syscall/js.valueNew": (sp) => {
						try {
							const v = loadValue(sp + 8);
							const args = loadSliceOfValues(sp + 16);
							const result = Reflect.construct(v, args);
							sp = this._inst.exports.getsp(); // see comment above
							storeValue(sp + 40, result);
							this.mem.setUint8(sp + 48, 1);
						} catch (err) {
							storeValue(sp + 40, err);
							this.mem.setUint8(sp + 48, 0);
						}
					},

					// func valueLength(v ref) int
					"syscall/js.valueLength": (sp) => {
						setInt64(sp + 16, parseInt(loadValue(sp + 8).length));
					},

					// valuePrepareString(v ref) (ref, int)
					"syscall/js.valuePrepareString": (sp) => {
						const str = encoder.encode(String(loadValue(sp + 8)));
						storeValue(sp + 16, str);
						setInt64(sp + 24, str.length);
					},

					// valueLoadString(v ref, b []byte)
					"syscall/js.valueLoadString": (sp) => {
						const str = loadValue(sp + 8);
						loadSlice(sp + 16).set(str);
					},

					// func valueInstanceOf(v ref, t ref) bool
					"syscall/js.valueInstanceOf": (sp) => {
						this.mem.setUint8(sp + 24, loadValue(sp + 8) instanceof loadValue(sp + 16));
					},

					// func copyBytesToGo(dst []byte, src ref) (int, bool)
					"syscall/js.copyBytesToGo": (sp) => {
						const dst = loadSlice(sp + 8);
						const src = loadValue(sp + 32);
						if (!(src instanceof Uint8Array)) {
							this.mem.setUint8(sp + 48, 0);
							return;
						}
						const toCopy = src.subarray(0, dst.length);
						dst.set(toCopy);
						setInt64(sp + 40, toCopy.length);
						this.mem.setUint8(sp + 48, 1);
					},

					// func copyBytesToJS(dst ref, src []byte) (int, bool)
					"syscall/js.copyBytesToJS": (sp) => {
						const dst = loadValue(sp + 8);
						const src = loadSlice(sp + 16);
						if (!(dst instanceof Uint8Array)) {
							this.mem.setUint8(sp + 48, 0);
							return;
						}
						const toCopy = src.subarray(0, dst.length);
						dst.set(toCopy);
						setInt64(sp + 40, toCopy.length);
						this.mem.setUint8(sp + 48, 1);
					},

					"debug": (value) => {
						console.log(value);
					},
				}
			};
		}

		async run(instance) {
			this._inst = instance;
			this.mem = new DataView(this._inst.exports.mem.buffer);
			this._values = [ // JS values that Go currently has references to, indexed by reference id
				NaN,
				0,
				null,
				true,
				false,
				global,
				this,
			];
			this._goRefCounts = []; // number of references that Go has to a JS value, indexed by reference id
			this._ids = new Map();  // mapping from JS values to reference ids
			this._idPool = [];      // unused ids that have been garbage collected
			this.exited = false;    // whether the Go program has exited

			// Pass command line arguments and environment variables to WebAssembly by writing them to the linear memory.
			let offset = 4096;

			const strPtr = (str) => {
				const ptr = offset;
				const bytes = encoder.encode(str + "\0");
				new Uint8Array(this.mem.buffer, offset, bytes.length).set(bytes);
				offset += bytes.length;
				if (offset % 8 !== 0) {
					offset += 8 - (offset % 8);
				}
				return ptr;
			};

			const argc = this.argv.length;

			const argvPtrs = [];
			this.argv.forEach((arg) => {
				argvPtrs.push(strPtr(arg));
			});
			argvPtrs.push(0);

			const keys = Object.keys(this.env).sort();
			keys.forEach((key) => {
				argvPtrs.push(strPtr(`${key}=${this.env[key]}`));
			});
			argvPtrs.push(0);

			const argv = offset;
			argvPtrs.forEach((ptr) => {
				this.mem.setUint32(offset, ptr, true);
				this.mem.setUint32(offset + 4, 0, true);
				offset += 8;
			});

			this._inst.exports.run(argc, argv);
			if (this.exited) {
				this._resolveExitPromise();
			}
			await this._exitPromise;
		}

		_resume() {
			if (this.exited) {
				throw new Error("Go program has already exited");
			}
			this._inst.exports.resume();
			if (this.exited) {
				this._resolveExitPromise();
			}
		}

		_makeFuncWrapper(id) {
			const go = this;
			return function () {
				const event = { id: id, this: this, args: arguments };
				go._pendingEvent = event;
				go._resume();
				return event.result;
			};
		}
	}

	if (
		global.require &&
		global.require.main === module &&
		global.process &&
		global.process.versions &&
		!global.process.versions.electron
	) {
		if (process.argv.length < 3) {
			console.error("usage: go_js_wasm_exec [wasm binary] [arguments]");
			process.exit(1);
		}

		const go = new Go();
		go.argv = process.argv.slice(2);
		go.env = Object.assign({ TMPDIR: require("os").tmpdir() }, process.env);
		go.exit = process.exit;
		WebAssembly.instantiate(fs.readFileSync(process.argv[2]), go.importObject).then((result) => {
			process.on("exit", (code) => { // Node.js exits if no event handler is pending
				if (code === 0 && !go.exited) {
					// deadlock, make Go print error and stack traces
					go._pendingEvent = { id: 0 };
					go._resume();
				}
			});
			return go.run(result.instance);
		}).catch((err) => {
			console.error(err);
			process.exit(1);
		});
	}
})();
