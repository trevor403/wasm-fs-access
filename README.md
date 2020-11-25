# wasm-fs-access

An adapter to use [GoogleChromeLabs/wasi-fs-access](https://github.com/GoogleChromeLabs/wasi-fs-access) with Golang's wasm_exec runtime.

This is based on the native [File System Access API](https://wicg.github.io/file-system-access/) which was recently added to Chrome 86.

I wanted to do this so I could benefit from the use of Golang over TinyGo in the browser. I also wanted to use the wasm/js target over WASI which removes access to the `syscall/js` package. I needed this for websockets and http fetch in particular.
