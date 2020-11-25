// +build js,wasm

package main

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
)

// var Applets map[string]Applet

// type Applet func(io.Writer, []string) error

// func init() {
// 	Applets = map[string]Applet{
// 		"basename":  basename.Main,
// 		"cat":       cat.Main,
// 		"chgrp":     chgrp.Main,
// 		"chown":     chown.Main,
// 		"chmod":     chmod.Main,
// 		"cksum":     cksum.Main,
// 		"cp":        cp.Main,
// 		"date":      date.Main,
// 		"dirname":   dirname.Main,
// 		"diff":      diff.Main,
// 		"du":        du.Main,
// 		"echo":      echo.Main,
// 		"head":      head.Main,
// 		"ls":        ls.Main,
// 		"ln":        ln.Main,
// 		"mkdir":     mkdir.Main,
// 		"mv":        mv.Main,
// 		"md5sum":    md5sum.Main,
// 		"sha1sum":   sha1sum.Main,
// 		"sha256sum": sha256sum.Main,
// 		"sha512sum": sha512sum.Main,
// 		"sleep":     sleep.Main,
// 		"seq":       seq.Main,
// 		"rm":        rm.Main,
// 		"rmdir":     rmdir.Main,
// 		"tr":        tr.Main,
// 		"yes":       yes.Main,
// 		"wc":        wc.Main,
// 		"wget":      wget.Main,
// 		"which":     which.Main,
// 	}
// }

// func runner(this js.Value, args []js.Value) interface{} {
// 	pargs, err := shellquote.Split(args[0].String())
// 	if err != nil {
// 		panic(err)
// 	}
// 	if len(pargs) == 0 {
// 		js.Global().Get("readLine").Invoke()
// 		return nil
// 	}

// 	callname := pargs[0]
// 	fargs := pargs[1:]
// 	applet, ok := Applets[callname]
// 	if !ok {
// 		fmt.Println("applet not found")
// 		js.Global().Get("readLine").Invoke()
// 		return nil
// 		// return args[0].Invoke("applet not found").String()
// 	}

// 	go func() {
// 		err = applet(os.Stdout, fargs)
// 		if err != nil {
// 			fmt.Println("ERROR", err)
// 		}
// 		js.Global().Get("readLine").Invoke()
// 	}()
// 	// if err != nil {
// 	// 	return args[0].Invoke(err.Error()).String()
// 	// }

// 	// return args[0].Invoke(false).String()
// 	return nil
// }

func main() {
	fmt.Println("Testing WASM Filesystem")

	// wait := make(chan struct{}, 0)
	// js.Global().Set("runner", js.FuncOf(runner))
	// <-wait

	err := ioutil.WriteFile("/JSON/hello.txt", []byte("test"), 0o755)
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}

	f, err := os.OpenFile("/JSON/hello.txt", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
	if _, err := f.WriteString(": text to append\n"); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
	f.Close()

	content, err := ioutil.ReadFile("/JSON/hello.txt")
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
	fmt.Printf("File contents: %s\n", content)

	dir := "/JSON/"
	c, err := ioutil.ReadDir(dir)
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
	fmt.Println("Listing directory")
	for _, entry := range c {
		var suffix string
		if entry.IsDir() {
			suffix = "/"
		}
		fmt.Println("\t", filepath.Join(dir, entry.Name())+suffix)
	}
}
