# fabric-guide-line

🤩 Help you easily append guideline and auto-snap to your fabric.

## Example

See  👉  [CodeSandbox](https://codesandbox.io/s/frosty-clarke-w85qe7?file=/src/App.tsx).

## Quick Start

```shell
npm install fabric-guideline-plugin --save
```
After install, you can use it in your project.

```tsx
import { AlignGuidelines } from "fabric-guideline-plugin";
````

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

You can also set some options to customize the guideline.

```ts
const guideline = new AlignGuidelines({
  canvas: fabricCanvas,
  pickObjTypes: [{ key: "myType", value: "box" }],
  aligningOptions: {
    lineColor: "#32D10A",
    lineWidth: 2,
    lineMargin: 2
  },
});
```

## Development

If you want to develop this plugin, you can easily start with the following steps:

```shell
$ git clone https://github.com/caijinyc/guideline.git
$ cd guideline
$ pnpm install
$ pnpm dev
```
