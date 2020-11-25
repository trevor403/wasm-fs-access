// +build js,wasm

package main

import (
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"syscall/js"

	"github.com/gonuts/go-shellquote"
	"github.com/shirou/toybox/applets/basename"
	"github.com/shirou/toybox/applets/cat"
	"github.com/shirou/toybox/applets/cksum"
	"github.com/shirou/toybox/applets/cp"
	"github.com/shirou/toybox/applets/date"
	"github.com/shirou/toybox/applets/diff"
	"github.com/shirou/toybox/applets/dirname"
	"github.com/shirou/toybox/applets/du"
	"github.com/shirou/toybox/applets/echo"
	"github.com/shirou/toybox/applets/head"
	"github.com/shirou/toybox/applets/ln"
	"github.com/shirou/toybox/applets/ls"
	"github.com/shirou/toybox/applets/md5sum"
	"github.com/shirou/toybox/applets/mkdir"
	"github.com/shirou/toybox/applets/mv"
	"github.com/shirou/toybox/applets/rm"
	"github.com/shirou/toybox/applets/rmdir"
	"github.com/shirou/toybox/applets/seq"
	"github.com/shirou/toybox/applets/sha1sum"
	"github.com/shirou/toybox/applets/sha256sum"
	"github.com/shirou/toybox/applets/sha512sum"
	"github.com/shirou/toybox/applets/sleep"
	"github.com/shirou/toybox/applets/wc"
	"github.com/shirou/toybox/applets/wget"
)

var Applets map[string]Applet

type Applet func(io.Writer, []string) error

func init() {
	Applets = map[string]Applet{
		"basename":  basename.Main,
		"cat":       cat.Main,
		"cksum":     cksum.Main,
		"cp":        cp.Main,
		"date":      date.Main,
		"dirname":   dirname.Main,
		"diff":      diff.Main,
		"du":        du.Main,
		"echo":      echo.Main,
		"head":      head.Main,
		"ls":        ls.Main,
		"ln":        ln.Main,
		"mkdir":     mkdir.Main,
		"mv":        mv.Main,
		"md5sum":    md5sum.Main,
		"sha1sum":   sha1sum.Main,
		"sha256sum": sha256sum.Main,
		"sha512sum": sha512sum.Main,
		"sleep":     sleep.Main,
		"seq":       seq.Main,
		"rm":        rm.Main,
		"rmdir":     rmdir.Main,
		"wc":        wc.Main,
		"wget":      wget.Main,
	}
}

func runner(this js.Value, args []js.Value) interface{} {
	pargs, err := shellquote.Split(args[0].String())
	if err != nil {
		panic(err)
	}
	if len(pargs) == 0 {
		js.Global().Get("readLine").Invoke()
		return nil
	}

	callname := pargs[0]
	fargs := pargs[1:]
	applet, ok := Applets[callname]
	if !ok {
		fmt.Println("applet not found")
		js.Global().Get("readLine").Invoke()
		return nil
		// return args[0].Invoke("applet not found").String()
	}

	go func() {
		err = applet(os.Stdout, fargs)
		if err != nil {
			fmt.Println("ERROR", err)
		}
		js.Global().Get("readLine").Invoke()
	}()
	// if err != nil {
	// 	return args[0].Invoke(err.Error()).String()
	// }

	// return args[0].Invoke(false).String()
	return nil
}

func main() {
	fmt.Println("Testing WASM Filesystem")

	wait := make(chan struct{}, 0)
	js.Global().Set("runner", js.FuncOf(runner))
	<-wait

	err := os.Remove("/JSON/hello.txt")
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}

	err = ioutil.WriteFile("/JSON/hello.txt", []byte("test"), 0o755)
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}

	err = ioutil.WriteFile("/JSON/hello.txt", []byte("hi"), 0o755)
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}

	f, err := os.OpenFile("/JSON/hello.txt", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o755)
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
	if _, err := f.WriteString("a"); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
	if _, err := f.WriteString("b"); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
	f.Close()

	content, err := ioutil.ReadFile("/JSON/hello.txt")
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
	fmt.Printf("File contents: %#v\n", string(content))

	dir := "/ISO"
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
