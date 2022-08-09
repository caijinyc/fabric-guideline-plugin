# fabric-guide-line

Help you easily append guideline and auto snap to your fabric.

## Example

<video src="./doc/example.mov" controls="controls"></video>

## Usage

```ts
import { fabric } from "fabric";
import { AlignGuidelines } from "fabric-guideline-plugin";

const fabricCanvas = new fabric.Canvas("myCanvas");

const guideline = new AlignGuidelines({
  canvas: fabricCanvas,
});

guideline.init();
```

## Development

```shell
git clone https://github.com/caijinyc/guideline.git
cd guideline

pnpm install
pnpm dev
```
