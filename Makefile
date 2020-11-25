ifeq ($(OS),Windows_NT)
    BROWSER = start
else
    BROWSER = xdg-open
endif

.PHONY: all clean serve

all: main.wasm

%.wasm: %.go
	GOOS=js GOARCH=wasm go build -o "$@" "$<"

clean:
	rm -f *.wasm
